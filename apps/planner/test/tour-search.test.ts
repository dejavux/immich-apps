import { destinationKeywordList } from "../src/services/tour-search.js";

describe("destinationKeywordList", () => {
  const base = {
    keywords: "",
    dateWindow: { from: "2026-08-01", to: "2026-08-31", label: "8月" },
    tourType: "group" as const,
  };

  it("uses specific destination keywords", () => {
    expect(
      destinationKeywordList({
        ...base,
        destination: { mode: "specific", keywords: ["濟州", "沖繩"] },
      }),
    ).toEqual(["濟州", "沖繩"]);
  });

  it("falls back to broad search for open", () => {
    expect(
      destinationKeywordList({
        ...base,
        destination: { mode: "open" },
      }),
    ).toEqual(["跟團旅遊"]);
  });

  it("uses hint for suggest", () => {
    expect(
      destinationKeywordList({
        ...base,
        destination: { mode: "suggest", hint: "親子 海島" },
      }),
    ).toEqual(["親子 海島"]);
  });

  it("does not infer from must tags", () => {
    expect(
      destinationKeywordList({
        ...base,
        mustTags: ["濟州", "無購物"],
      }),
    ).toEqual(["跟團旅遊"]);
  });
});
