import {
  formatResultsMessage,
  mergePlans,
  resolveTakenRange,
} from "./photo-search-service";
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
