import {
  addMonthsUtc,
  ageToTakenRange,
  explicitDateRange,
  parseIsoDateOnly,
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

describe("addMonthsUtc", () => {
  it("adds months across year boundary", () => {
    const start = parseIsoDateOnly("2019-10-01")!;
    const result = addMonthsUtc(start, 6);
    expect(result.toISOString()).toBe("2020-04-01T00:00:00.000Z");
  });
});
