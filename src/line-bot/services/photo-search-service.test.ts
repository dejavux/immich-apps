import {
  buildSearchConfirmSummary,
  formatResultsMessage,
  isConfirmationAffirmative,
  isConfirmationNegative,
  mergePlans,
  needsClarifyBeforeConfirm,
  PhotoSearchService,
  resolveTakenRange,
} from "./photo-search-service";
import { SearchSessionStore } from "./search-session-store";
import type { ImmichClient } from "../../shared/immich-client";
import {
  ensureActivityFromText,
  ensureAgeFromText,
  ensureSceneQueryEn,
  parseSearchPlanFallback,
  parseLlmSearchResponse,
  sanitizeSearchPlan,
  stripParenthesizedSuffix,
  translateSceneQueryFallback,
  tryParsePersonAge,
  tryParsePersonScenePhoto,
} from "./photo-search-prompt";

describe("buildSearchConfirmSummary", () => {
  it("formats multi-person location search", () => {
    const summary = buildSearchConfirmSummary({
      personNames: ["小光", "steffi"],
      country: "Japan",
      anyDate: true,
    });
    expect(summary).toContain("小光");
    expect(summary).toContain("steffi");
    expect(summary).toContain("日本");
    expect(summary).toContain("不限年齡");
    expect(summary).toMatch(/嗎？$/);
  });

  it("formats scene-only search", () => {
    const summary = buildSearchConfirmSummary({
      sceneQuery: "海邊",
    });
    expect(summary).toContain("海邊");
  });
});

describe("needsClarifyBeforeConfirm", () => {
  it("requires clarify for person without age or location", () => {
    expect(needsClarifyBeforeConfirm({ personNames: ["小蕊"] })).toBe(true);
  });

  it("allows confirm for person with location", () => {
    expect(
      needsClarifyBeforeConfirm({
        personNames: ["小光", "steffi"],
        country: "Japan",
        anyDate: true,
      }),
    ).toBe(false);
  });

  it("requires clarify when no criteria at all", () => {
    expect(needsClarifyBeforeConfirm({})).toBe(true);
  });
});

describe("confirmation keywords", () => {
  it("detects affirmative replies", () => {
    expect(isConfirmationAffirmative("確認")).toBe(true);
    expect(isConfirmationAffirmative("好")).toBe(true);
    expect(isConfirmationAffirmative("Y")).toBe(true);
  });

  it("detects negative replies", () => {
    expect(isConfirmationNegative("取消")).toBe(true);
    expect(isConfirmationNegative("否")).toBe(true);
  });
});

function createMockImmich(overrides: Partial<ImmichClient> = {}): ImmichClient {
  return {
    searchPersonByName: jest
      .fn()
      .mockResolvedValue([{ id: "p1", name: "小光" }]),
    searchMetadata: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    searchSmart: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    ...overrides,
  } as unknown as ImmichClient;
}

describe("PhotoSearchService confirmation flow", () => {
  const sessionStore = new SearchSessionStore(60_000);

  beforeEach(() => {
    sessionStore.resetForTest();
  });

  function createService(immich = createMockImmich()) {
    return new PhotoSearchService({
      immichClient: immich,
      immichWebUrl: "https://immich.3q.fi",
      sessionStore,
      maxResults: 10,
      ageWindowDays: 45,
      personAliases: new Map(),
    });
  }

  it("returns confirm before executing complete plan", async () => {
    const service = createService();
    const result = await service.handleMessage(
      "u1",
      "找小光和 steffi 在日本的照片",
    );
    expect(result.kind).toBe("confirm");
    expect(result.message).toContain("日本");
    expect(sessionStore.get("u1")?.awaitingConfirmation).toBe(true);
  });

  it("executes search after confirmation", async () => {
    const immich = createMockImmich({
      searchMetadata: jest.fn().mockResolvedValue({
        items: [
          {
            id: "a1",
            originalFileName: "x.jpg",
            localDateTime: "2024-01-01T00:00:00.000Z",
          },
        ],
        total: 1,
      }),
    });
    const service = createService(immich);
    await service.handleMessage("u1", "找小光和 steffi 在日本的照片");
    const result = await service.handleMessage("u1", "確認");
    expect(result.kind).toBe("results");
    expect(immich.searchMetadata).toHaveBeenCalled();
  });

  it("cancels pending search", async () => {
    const service = createService();
    await service.handleMessage("u1", "找在日本的照片");
    const result = await service.handleMessage("u1", "取消");
    expect(result.kind).toBe("help");
    expect(result.message).toContain("已取消");
    expect(sessionStore.get("u1")).toBeUndefined();
  });

  it("skips confirmation for person choice", async () => {
    const immich = createMockImmich({
      searchPersonByName: jest.fn().mockResolvedValue([
        { id: "p1", name: "rayna", birthDate: "2019-03-15" },
        { id: "p2", name: "rayna2" },
      ]),
      searchMetadata: jest.fn().mockResolvedValue({
        items: [
          {
            id: "a1",
            originalFileName: "x.jpg",
            localDateTime: "2024-01-01T00:00:00.000Z",
          },
        ],
        total: 1,
      }),
    });
    const service = createService(immich);
    await service.handleMessage("u1", "找小蕊7歲的照片");
    const clarify = await service.handleMessage("u1", "確認");
    expect(clarify.kind).toBe("clarify");
    const result = await service.handleMessage("u1", "1");
    expect(result.kind).toBe("results");
  });
});

describe("PhotoSearchService empty quick reply", () => {
  const sessionStore = new SearchSessionStore(60_000);

  beforeEach(() => {
    sessionStore.resetForTest();
  });

  it("stores failed plan and offers relaxed search", async () => {
    const immich = createMockImmich();
    const service = new PhotoSearchService({
      immichClient: immich,
      immichWebUrl: "https://immich.3q.fi",
      sessionStore,
      maxResults: 10,
      ageWindowDays: 45,
      personAliases: new Map(),
    });

    await service.handleMessage("u1", "找小光和 steffi 在日本的照片");
    const emptyResult = await service.handleMessage("u1", "確認");
    expect(emptyResult.kind).toBe("empty");
    expect(emptyResult.quickReplyActions?.length).toBeGreaterThan(0);

    const relaxed = await service.handleMessage("u1", "放寬年齡");
    expect(relaxed.kind).toBe("confirm");
    expect(relaxed.message).toContain("不限年齡");
  });
});

describe("parseSearchPlanFallback", () => {
  it("parses person and age", () => {
    const plan = parseSearchPlanFallback("幫我找小蕊一歲半的照片");
    expect(plan.intent).toBe("search_photos");
    expect(plan.personNames).toContain("小蕊");
    expect(plan.ageYears).toBe(1.5);
  });

  it("parses birth date", () => {
    const plan = parseSearchPlanFallback("生日 2019-03-15");
    expect(plan.birthDate).toBe("2019-03-15");
  });

  it("parses scene query", () => {
    const plan = parseSearchPlanFallback("找在海邊的照片");
    expect(plan.intent).toBe("search_photos");
    expect(plan.personNames).toEqual([]);
    expect(plan.sceneQuery).toBe("海邊");
    expect(plan.sceneQueryEn).toContain("beach");
  });

  it("does not treat 在 as person for scene-only query", () => {
    expect(tryParsePersonScenePhoto("找在海邊的照片")).toBeUndefined();
  });

  it("parses person scene and 今年", () => {
    const plan = parseSearchPlanFallback(
      "找找小蕊今年在學校的照片",
      new Date("2026-06-11T12:00:00.000Z"),
    );
    expect(plan.personNames).toEqual(["小蕊"]);
    expect(plan.sceneQuery).toBe("學校");
    expect(plan.dateRangeLabel).toBe("今年");
    expect(plan.dateFrom).toBe("2026-01-01");
    expect(plan.dateTo).toBe("2026-06-11");
  });

  it("parses person eating without 找 prefix", () => {
    const plan = parseSearchPlanFallback("小蕊在吃飯的照片");
    expect(plan.personNames).toEqual(["小蕊"]);
    expect(plan.sceneQuery).toBe("吃飯");
    expect(plan.sceneQueryEn).toContain("eating");
  });

  it("parses person eating without 在", () => {
    const plan = parseSearchPlanFallback("小蕊吃飯的照片");
    expect(plan.personNames).toEqual(["小蕊"]);
    expect(plan.sceneQuery).toBe("吃飯");
  });

  it("parses age 7 years", () => {
    const plan = parseSearchPlanFallback("找小蕊7歲的照片");
    expect(plan.personNames).toEqual(["小蕊"]);
    expect(plan.ageYears).toBe(7);
    expect(plan.sceneQuery).toBeUndefined();
  });

  it("parses wearing dress", () => {
    const plan = parseSearchPlanFallback("找小蕊穿裙子的照片");
    expect(plan.personNames).toEqual(["小蕊"]);
    expect(plan.sceneQuery).toBe("穿裙子");
    expect(plan.sceneQueryEn).toContain("dress");
  });

  it("parses abroad location", () => {
    const plan = parseSearchPlanFallback("找小蕊在國外的照片");
    expect(plan.personNames).toEqual(["小蕊"]);
    expect(plan.sceneQuery).toBe("國外");
    expect(plan.sceneQueryEn).toContain("abroad");
  });

  it("parses negated Taiwan without breaking person name", () => {
    const plan = parseSearchPlanFallback("找小蕊不在台灣的照片");
    expect(plan.personNames).toEqual(["小蕊"]);
    expect(plan.sceneQuery).toBe("不在台灣");
    expect(plan.sceneQueryEn).toContain("not Taiwan");
  });

  it("extracts country filter for 在日本 query", () => {
    const plan = parseSearchPlanFallback("找在日本的照片");
    expect(plan.intent).toBe("search_photos");
    expect(plan.personNames).toEqual([]);
    expect(plan.country).toBe("Japan");
    expect(plan.sceneQuery).toBeUndefined();
  });

  it("parses multiple people with country filter", () => {
    const plan = parseSearchPlanFallback("找小光和 steffi 在日本的照片");
    expect(plan.personNames).toEqual(["小光", "steffi"]);
    expect(plan.country).toBe("Japan");
    expect(plan.anyDate).toBe(true);
    expect(plan.sceneQuery).toBeUndefined();
  });

  it("parses multiple people at beach scene", () => {
    const plan = parseSearchPlanFallback("找小光和 steffi 在海邊的照片");
    expect(plan.personNames).toEqual(["小光", "steffi"]);
    expect(plan.sceneQuery).toBe("海邊");
  });

  it("extracts country filter for person+location query", () => {
    const plan = parseSearchPlanFallback("找小蕊在日本的照片");
    expect(plan.personNames).toEqual(["小蕊"]);
    expect(plan.country).toBe("Japan");
    expect(plan.sceneQuery).toBeUndefined();
  });

  it("extracts Taiwan country with correct Immich name", () => {
    const plan = parseSearchPlanFallback("找在台灣的照片");
    expect(plan.country).toBe("Taiwan, Province of China");
  });

  it("parses 找跳舞的 without 照片 suffix", () => {
    const plan = parseSearchPlanFallback("找跳舞的");
    expect(plan.intent).toBe("search_photos");
    expect(plan.sceneQuery).toBe("跳舞");
    expect(plan.sceneQueryEn).toContain("dance");
  });

  it("does not treat location name as person name", () => {
    const plan = parseSearchPlanFallback("找在日本的照片");
    expect(plan.personNames).toEqual([]);
    expect(plan.country).toBe("Japan");
  });

  it("parses 年齡不限 as anyDate=true", () => {
    const plan = parseSearchPlanFallback("年齡不限");
    expect(plan.intent).toBe("search_photos");
    expect(plan.anyDate).toBe(true);
  });

  it("parses 不限年齡 as anyDate=true", () => {
    const plan = parseSearchPlanFallback("不限年齡");
    expect(plan.intent).toBe("search_photos");
    expect(plan.anyDate).toBe(true);
  });

  it("parses bare 7歲 follow-up as ageYears", () => {
    const plan = parseSearchPlanFallback("7歲");
    expect(plan.intent).toBe("search_photos");
    expect(plan.ageYears).toBe(7);
    expect(plan.personNames).toEqual([]);
  });

  it("parses bare 一歲半 follow-up as ageYears=1.5", () => {
    const plan = parseSearchPlanFallback("一歲半");
    expect(plan.intent).toBe("search_photos");
    expect(plan.ageYears).toBe(1.5);
  });

  it("parses bare 18個月 follow-up as ageMonths", () => {
    const plan = parseSearchPlanFallback("18個月");
    expect(plan.intent).toBe("search_photos");
    expect(plan.ageMonths).toBe(18);
    expect(plan.personNames).toEqual([]);
  });
});

describe("sanitizeSearchPlan", () => {
  it("clears stopword person when Qwen mis-parses 找在海邊的照片", () => {
    const plan = sanitizeSearchPlan(
      {
        intent: "search_photos",
        personNames: ["在"],
        sceneQuery: "海邊",
      },
      "找在海邊的照片",
    );
    expect(plan.personNames).toEqual([]);
    expect(plan.sceneQuery).toBe("海邊");
    expect(plan.sceneQueryEn).toContain("beach");
  });

  it("strips （年齡不限） from person name", () => {
    const plan = sanitizeSearchPlan(
      {
        intent: "search_photos",
        personNames: ["小蕊（年齡不限）"],
        country: "Japan",
      },
      "找小蕊（年齡不限）在日本的照片",
    );
    expect(plan.personNames).toEqual(["小蕊"]);
  });
});

describe("stripParenthesizedSuffix", () => {
  it("strips full-width parentheses qualifier", () => {
    expect(stripParenthesizedSuffix("小蕊（年齡不限）")).toBe("小蕊");
  });

  it("strips half-width parentheses qualifier", () => {
    expect(stripParenthesizedSuffix("小蕊(年齡不限)")).toBe("小蕊");
  });

  it("does not modify plain name", () => {
    expect(stripParenthesizedSuffix("小蕊")).toBe("小蕊");
  });
});

describe("parseLlmSearchResponse", () => {
  it("reads anyDate from LLM response", () => {
    const plan = parseLlmSearchResponse({
      intent: "search_photos",
      personNames: ["小蕊"],
      country: "Japan",
      anyDate: true,
    });
    expect(plan.anyDate).toBe(true);
    expect(plan.personNames).toEqual(["小蕊"]);
    expect(plan.country).toBe("Japan");
  });

  it("strips parenthesized suffix from person names via LLM", () => {
    const plan = parseLlmSearchResponse({
      intent: "search_photos",
      personNames: ["小蕊（年齡不限）"],
      country: "Japan",
      anyDate: true,
    });
    expect(plan.personNames).toEqual(["小蕊"]);
  });
});

describe("tryParsePersonScenePhoto", () => {
  it("extracts eating activity", () => {
    const parsed = tryParsePersonScenePhoto("小蕊在吃飯的照片");
    expect(parsed?.personNames).toEqual(["小蕊"]);
    expect(parsed?.sceneQuery).toBe("吃飯");
  });
});

describe("ensureAgeFromText", () => {
  it("fills age when LLM only returned person or wrong scene", () => {
    const plan = ensureAgeFromText(
      {
        intent: "search_photos",
        personNames: ["小蕊"],
        sceneQuery: "7歲",
      },
      "找小蕊7歲的照片",
    );
    expect(plan.ageYears).toBe(7);
    expect(plan.sceneQuery).toBeUndefined();
  });
});

describe("tryParsePersonAge", () => {
  it("extracts 7歲", () => {
    expect(tryParsePersonAge("找小蕊7歲的照片")).toEqual({
      personNames: ["小蕊"],
      ageYears: 7,
    });
  });
});

describe("ensureActivityFromText", () => {
  it("fills scene when LLM only returned person", () => {
    const plan = ensureSceneQueryEn(
      ensureActivityFromText(
        { intent: "search_photos", personNames: ["小蕊"] },
        "小蕊在吃飯的照片",
      ),
    );
    expect(plan.sceneQuery).toBe("吃飯");
    expect(plan.sceneQueryEn).toContain("eating");
  });
});

describe("translateSceneQueryFallback", () => {
  it("maps common Chinese scenes to English", () => {
    expect(translateSceneQueryFallback("海邊")).toContain("beach");
  });
});

describe("mergePlans", () => {
  it("keeps person from session when follow-up is birth date only", () => {
    const merged = mergePlans(
      { personNames: ["小蕊"], ageYears: 1.5 },
      { intent: "search_photos", personNames: [], birthDate: "2019-03-15" },
    );
    expect(merged.personNames).toEqual(["小蕊"]);
    expect(merged.ageYears).toBe(1.5);
    expect(merged.birthDate).toBe("2019-03-15");
  });

  it("propagates anyDate when follow-up says 年齡不限", () => {
    const session = {
      personNames: ["小蕊"],
      country: "Japan",
      intent: "search_photos" as const,
    };
    const merged = mergePlans(session, {
      intent: "search_photos",
      personNames: [],
      anyDate: true,
    });
    expect(merged.anyDate).toBe(true);
    expect(merged.personNames).toEqual(["小蕊"]);
    expect(merged.country).toBe("Japan");
  });
});

describe("resolveTakenRange", () => {
  it("uses dateRangeLabel for relative dates", () => {
    const result = resolveTakenRange(
      {
        dateFrom: "2026-01-01",
        dateTo: "2026-06-11",
        dateRangeLabel: "今年",
      },
      { id: "p1", name: "rayna", birthDate: null },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.label).toBe("今年");
      expect(result.takenAfter).toContain("2026-01-01");
    }
  });

  it("asks for birth date when missing", () => {
    const result = resolveTakenRange(
      { ageYears: 1.5 },
      { id: "p1", name: "小蕊", birthDate: null },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.question).toContain("生日");
    }
  });

  it("computes range from birth and age", () => {
    const result = resolveTakenRange(
      { ageYears: 1.5, birthDate: "2019-03-15" },
      { id: "p1", name: "小蕊", birthDate: null },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.takenAfter).toContain("2020");
    }
  });

  it("computes range for 7 years old", () => {
    const result = resolveTakenRange(
      { ageYears: 7, birthDate: "2019-03-15" },
      { id: "p1", name: "rayna", birthDate: null },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.takenAfter).toContain("2026");
      expect(result.label).toContain("7");
    }
  });
});

describe("formatResultsMessage", () => {
  it("formats asset links", () => {
    const text = formatResultsMessage(
      "小蕊",
      "1.5 歲",
      [
        {
          id: "abc",
          originalFileName: "a.jpg",
          localDateTime: "2020-09-15T00:00:00.000Z",
        },
      ],
      1,
      "https://immich.3q.fi",
    );
    expect(text).toContain("小蕊");
    expect(text).toContain("/photos/abc");
  });
});
