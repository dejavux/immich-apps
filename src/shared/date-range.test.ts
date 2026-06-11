import {
  addMonthsUtc,
  ageToTakenRange,
  detectRelativeDateInText,
  explicitDateRange,
  parseIsoDateOnly,
  relativeDateRange,
} from "./date-range";

describe("parseIsoDateOnly", () => {
  it("parses valid YYYY-MM-DD", () => {
    const d = parseIsoDateOnly("2019-03-15");
    expect(d?.toISOString()).toBe("2019-03-15T00:00:00.000Z");
  });

  it("rejects invalid dates", () => {
    expect(parseIsoDateOnly("2019-02-30")).toBeUndefined();
  });
});

describe("ageToTakenRange", () => {
  it("centers window around 18 months from birth", () => {
    const birth = parseIsoDateOnly("2019-03-15");
    expect(birth).toBeDefined();
    const range = ageToTakenRange({
      birthDate: birth!,
      ageYears: 1.5,
      windowDays: 30,
    });
    expect(range.takenAfter).toContain("2020-");
    expect(range.takenBefore).toContain("2020-");
  });
});

describe("explicitDateRange", () => {
  it("builds single-day range", () => {
    const range = explicitDateRange("2024-06-01");
    expect(range?.takenAfter).toBe("2024-06-01T00:00:00.000Z");
    expect(range?.takenBefore).toContain("2024-06-01");
  });
});

describe("relativeDateRange", () => {
  const now = new Date("2026-06-11T12:00:00.000Z");

  it("maps 今年 to Jan 1 through today", () => {
    const range = relativeDateRange("this_year", now);
    expect(range).toEqual({
      dateFrom: "2026-01-01",
      dateTo: "2026-06-11",
      label: "今年",
    });
  });

  it("maps 去年 to full prior calendar year", () => {
    const range = relativeDateRange("last_year", now);
    expect(range.dateFrom).toBe("2025-01-01");
    expect(range.dateTo).toBe("2025-12-31");
  });

  it("detects 今年 in user text", () => {
    const range = detectRelativeDateInText("小蕊今年在學校", now);
    expect(range?.label).toBe("今年");
    expect(range?.dateFrom).toBe("2026-01-01");
  });
});

describe("addMonthsUtc", () => {
  it("adds months across year boundary", () => {
    const start = parseIsoDateOnly("2019-10-01")!;
    const result = addMonthsUtc(start, 6);
    expect(result.toISOString()).toBe("2020-04-01T00:00:00.000Z");
  });
});
