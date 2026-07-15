import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { finalizeTour } from "../src/adapters/lion/normalize.js";
import { parseLionDetailUrl } from "../src/adapters/lion/extract.js";
import { parseColaTourUrl } from "../src/adapters/cola/extract.js";
import { parsePhoenixTourUrl } from "../src/adapters/phoenix/extract.js";
import {
  extractCacheKey,
  getExtractCache,
  normalizeTourUrl,
  resetExtractCacheForTests,
  setExtractCache,
} from "../src/cache/extract-cache.js";
import { resetPlannerStoreForTests } from "../src/db/client.js";
import { MemoryPlannerStore } from "../src/db/memory-store.js";
import { compareTours } from "../src/services/tour-compare.js";
import { extractTour } from "../src/services/tour-extract.js";
import {
  shortlistAdd,
  shortlistList,
  shortlistRemove,
} from "../src/services/shortlist.js";
import type { TourSummary } from "@family-memories/planner-schema";

type FixtureFile = {
  tours: Array<Parameters<typeof finalizeTour>[0]>;
};

function loadFixture(): TourSummary[] {
  const path = resolve(__dirname, "fixtures/jeju-compare.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as FixtureFile;
  return raw.tours.map((t) => finalizeTour(t));
}

const LION_URL =
  "https://travel.liontravel.com/detail?NormGroupID=93ef5ca9-a580-407e-a6cb-f935bcaccdc1&GroupID=26JK801TWJ-T";

describe("URL parsers", () => {
  it("parses lion detail URL", () => {
    const parsed = parseLionDetailUrl(new URL(LION_URL));
    expect(parsed).toEqual({
      normGroupId: "93ef5ca9-a580-407e-a6cb-f935bcaccdc1",
      groupId: "26JK801TWJ-T",
    });
  });

  it("parses cola tour URL", () => {
    const parsed = parseColaTourUrl(
      new URL("https://tour.colatour.com.tw/tour/JP-TOKYO-5D"),
    );
    expect(parsed?.tourCode).toBe("JP-TOKYO-5D");
  });

  it("parses phoenix tour URL", () => {
    const parsed = parsePhoenixTourUrl(
      new URL("https://www.phoenixtour.com.tw/tour/PHX12345"),
    );
    expect(parsed?.tourCode).toBe("PHX12345");
  });
});

describe("extract cache", () => {
  beforeEach(() => {
    resetExtractCacheForTests();
  });

  it("stores and retrieves by normalized URL hash", async () => {
    const url = normalizeTourUrl(LION_URL);
    const key = extractCacheKey(url);
    const summary = loadFixture()[0];

    await setExtractCache({
      cacheKey: key,
      agency: "lion",
      summary: { ...summary, extractedAt: "2026-07-15T00:00:00.000Z" },
    });

    const cached = await getExtractCache(key);
    expect(cached?.summary.groupId).toBe("26JK801TWJ-T");
    expect(cached?.agency).toBe("lion");
  });
});

describe("extractTour (lion mock)", () => {
  const familyId = "family-extract-test";

  beforeEach(() => {
    resetPlannerStoreForTests(new MemoryPlannerStore(false));
    resetExtractCacheForTests();
    jest.restoreAllMocks();
  });

  it("extracts lion tour from mocked APIs", async () => {
    const travelPayload = {
      GoAirline: "德威航空",
      GoDepartureTime: "14:25",
      GoArriveTime: "17:30",
      GoDepartureAirport: "桃園機場",
      GoArriveAirport: "濟州機場",
      BackAirline: "德威航空",
      BackDepartureTime: "12:20",
      BackArriveTime: "13:25",
      BackDepartureAirport: "濟州機場",
      BackArriveAirport: "桃園機場",
      GroupInfo: {
        TourName: "濟州無購物五日",
        NormGroupID: "93ef5ca9-a580-407e-a6cb-f935bcaccdc1",
        GroupID: "26JK801TWJ-T",
        TourDays: 5,
        GoDate: "2026/08/01",
        BackDate: "2026/08/05",
        StraightLowestPrice: 31900,
        TagList: [{ TagName: "無購物店" }],
      },
    };
    const dayTripPayload = {
      DailyList: [
        {
          Day: 1,
          TravelPoint: "桃園→濟州",
          HotelDesc: "JEJU IN HOTEL 或 HAEMA HOTEL",
          AttractionsList: [{ Name: "漢拏樹木園" }],
        },
      ],
    };

    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("travelinfojson")) {
        return new Response(JSON.stringify(travelPayload), { status: 200 });
      }
      if (url.includes("daytripinfojson")) {
        return new Response(JSON.stringify(dayTripPayload), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });

    const result = await extractTour({ familyId, url: LION_URL });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.cached).toBe(false);
    expect(result.summary.agency).toBe("lion");
    expect(result.summary.groupId).toBe("26JK801TWJ-T");
    expect(result.summary.extractedAt).toBeTruthy();
    expect(result.summary.flights.outbound?.airline).toBe("德威航空");

    const cached = await extractTour({ familyId, url: LION_URL });
    expect(cached.ok).toBe(true);
    if (cached.ok) {
      expect(cached.cached).toBe(true);
    }
  });
});

describe("compareTours", () => {
  const familyId = "family-compare-test";
  const tours = loadFixture();

  beforeEach(() => {
    resetPlannerStoreForTests(new MemoryPlannerStore(false));
  });

  it("compares inline fixture tours", async () => {
    const result = await compareTours({
      familyId,
      tours: tours.slice(0, 2),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.count).toBe(2);
    expect(result.tableMarkdown).toContain("短團名");
    expect(result.tours[0].shortName).toMatch(/濟州島-/);
  });

  it("compares shortlist tourIds", async () => {
    const a = tours[0];
    const b = tours[1];
    await shortlistAdd({ familyId, summary: a });
    await shortlistAdd({ familyId, summary: b });

    const result = await compareTours({
      familyId,
      tourIds: [a.id!, b.id!],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBe(2);
    }
  });
});

describe("shortlist service", () => {
  const familyId = "family-shortlist-test";
  const tour = loadFixture()[0];

  beforeEach(() => {
    resetPlannerStoreForTests(new MemoryPlannerStore(false));
  });

  it("adds, lists, and removes", async () => {
    const added = await shortlistAdd({ familyId, summary: tour });
    expect(added.ok).toBe(true);

    const listed = await shortlistList(familyId);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.items).toHaveLength(1);
      expect(listed.items[0].tourId).toBe(tour.id);
    }

    const removed = await shortlistRemove({ familyId, tourId: tour.id! });
    expect(removed.ok).toBe(true);

    const after = await shortlistList(familyId);
    if (after.ok) {
      expect(after.items).toHaveLength(0);
    }
  });
});
