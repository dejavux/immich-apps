import { parsePersonAliases, resolvePersonSearchName } from "./person-aliases";

describe("person-aliases", () => {
  it("parses comma-separated alias map", () => {
    const map = parsePersonAliases("小蕊:rayna,蕊蕊:rayna");
    expect(map.get("小蕊")).toBe("rayna");
    expect(map.get("蕊蕊")).toBe("rayna");
  });

  it("resolves nickname to Immich name", () => {
    const map = parsePersonAliases("小蕊:rayna");
    expect(resolvePersonSearchName("小蕊", map)).toBe("rayna");
    expect(resolvePersonSearchName("rayna", map)).toBe("rayna");
  });
});
