import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildShortName,
  finalizeTour,
  inferTags,
} from "../src/adapters/lion/normalize.js";
import type { TourSummary } from "@family-memories/planner-schema";

type FixtureFile = {
  tours: Array<Parameters<typeof finalizeTour>[0]>;
};

function loadFixture(): TourSummary[] {
  const path = resolve(__dirname, "fixtures/jeju-compare.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as FixtureFile;
  return raw.tours.map((t) => finalizeTour(t));
}

describe("lion normalize", () => {
  const tours = loadFixture();

  it("buildShortName from jeju fixture dates", () => {
    const first = tours[0];
    expect(first.shortName).toBe("濟州島-0801-0805");
    expect(
      buildShortName({
        destination: "濟州島",
        officialTitle: first.officialTitle,
        departDate: "2026/08/01",
        returnDate: "2026/08/05",
      }),
    ).toBe("濟州島-0801-0805");
  });

  it("inferTags detects 無購物 vs 彩妝 on jeju fixture", () => {
    const noShop = tours.find((t) => t.officialTitle.includes("無購物"));
    const cosmetic = tours.find((t) => t.officialTitle.includes("彩妝"));
    expect(noShop?.tags).toContain("無購物");
    expect(noShop?.tags).not.toContain("含購物");
    expect(cosmetic?.tags).toContain("彩妝店");
    expect(inferTags(cosmetic?.officialTitle ?? "")).toContain("彩妝店");
  });

  it("finalizeTour assigns stable id", () => {
    expect(tours[0].id).toBe(`lion:${tours[0].groupId}`);
  });
});
