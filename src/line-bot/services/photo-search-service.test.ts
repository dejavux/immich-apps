import {
  formatResultsMessage,
  mergePlans,
  resolveTakenRange,
} from "./photo-search-service";
import {
  ensureActivityFromText,
  ensureSceneQueryEn,
  parseSearchPlanFallback,
  translateSceneQueryFallback,
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
    expect(plan.sceneQuery).toBe("海邊");
    expect(plan.sceneQueryEn).toContain("beach");
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
});

describe("tryParsePersonScenePhoto", () => {
  it("extracts eating activity", () => {
    const parsed = tryParsePersonScenePhoto("小蕊在吃飯的照片");
    expect(parsed?.personNames).toEqual(["小蕊"]);
    expect(parsed?.sceneQuery).toBe("吃飯");
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
