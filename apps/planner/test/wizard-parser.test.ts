import {
  parseBudgetInput,
  parseDepartFromInput,
  parseDestinationInput,
  parseDurationInput,
  parseMustInput,
  parseReviewInput,
  parseWhenInput,
} from "../src/services/wizard-parser.js";

describe("wizard-parser when", () => {
  const now = new Date("2026-07-15T00:00:00Z");

  it("parses 暑假 as Jul-Aug same year", () => {
    const r = parseWhenInput("暑假", now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.from).toBe("2026-07-01");
      expect(r.value.to).toBe("2026-08-31");
      expect(r.value.label).toBe("暑假");
    }
  });

  it("parses 7-8月 range", () => {
    const r = parseWhenInput("7-8月", now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.from).toBe("2026-07-01");
      expect(r.value.to).toBe("2026-08-31");
    }
  });

  it("parses 明年1月底", () => {
    const r = parseWhenInput("明年1月底", now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.from).toBe("2027-01-20");
      expect(r.value.to).toBe("2027-01-31");
    }
  });

  it("returns clarification for unknown input", () => {
    const r = parseWhenInput("隨便啦", now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.clarification).toMatch(/無法判斷/);
  });
});

describe("wizard-parser duration", () => {
  it("parses 4-5天", () => {
    const r = parseDurationInput("4-5天");
    expect(r).toEqual({ ok: true, value: { minDays: 4, maxDays: 5 } });
  });

  it("parses 一週左右", () => {
    const r = parseDurationInput("一週左右");
    expect(r).toEqual({ ok: true, value: { minDays: 6, maxDays: 8 } });
  });
});

describe("wizard-parser destination", () => {
  it("parses specific place", () => {
    expect(parseDestinationInput("濟州")).toEqual({
      ok: true,
      value: { mode: "specific", keywords: ["濟州"] },
    });
  });

  it("parses multiple places", () => {
    expect(parseDestinationInput("日本、九州")).toEqual({
      ok: true,
      value: { mode: "specific", keywords: ["日本", "九州"] },
    });
  });

  it("parses open", () => {
    expect(parseDestinationInput("還沒想好")).toEqual({
      ok: true,
      value: { mode: "open" },
    });
  });

  it("parses suggest with hint", () => {
    const r = parseDestinationInput("推薦親子海島");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.mode).toBe("suggest");
      if (r.value.mode === "suggest") {
        expect(r.value.hint).toMatch(/親子/);
      }
    }
  });
});

describe("wizard-parser other steps", () => {
  it("parses depart_from 台北", () => {
    expect(parseDepartFromInput("台北")).toEqual({ ok: true, value: "TPE" });
  });

  it("limits must to 3 items", () => {
    const r = parseMustInput("a, b, c, d");
    expect(r.ok).toBe(false);
  });

  it("parses budget 兩萬內", () => {
    expect(parseBudgetInput("兩萬內")).toEqual({ ok: true, value: "<2萬" });
  });

  it("parses review confirm", () => {
    expect(parseReviewInput("確認")).toEqual({
      ok: true,
      value: { type: "confirm" },
    });
  });
});
