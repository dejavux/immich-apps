import {
  registerImmichCountryAlias,
  registerImmichCountryValues,
  resetImmichCountryAliasesForTest,
  resolveImmichCountryAlias,
} from "./country-lookup-runtime";

describe("country-lookup-runtime", () => {
  beforeEach(() => {
    resetImmichCountryAliasesForTest();
  });

  it("resolves short alias to canonical Immich name", () => {
    registerImmichCountryAlias("Taiwan", "Taiwan, Province of China");
    expect(resolveImmichCountryAlias("taiwan")).toBe(
      "Taiwan, Province of China",
    );
  });

  it("registers distinct countries with comma short forms", () => {
    registerImmichCountryValues(["Taiwan, Province of China", "Japan"]);
    expect(resolveImmichCountryAlias("Taiwan")).toBe(
      "Taiwan, Province of China",
    );
    expect(resolveImmichCountryAlias("Japan")).toBe("Japan");
  });
});
