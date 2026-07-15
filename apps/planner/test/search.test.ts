import { buildSearchBody } from "../src/adapters/lion/search.js";

describe("lion search buildSearchBody", () => {
  it("uses GoDatestart with lowercase s (not GoDateStart)", () => {
    const body = buildSearchBody({
      keywords: "濟州",
      goDateStart: "2026-08-01",
      goDateEnd: "2026-08-07",
      travelType: 1,
      page: 1,
      pageSize: 20,
    });

    expect(body.GoDatestart).toBe("2026-08-01");
    expect(body.GoDateEnd).toBe("2026-08-07");
    expect(body).not.toHaveProperty("GoDateStart");
    expect(body.Keywords).toBe("濟州");
    expect(body.TravelType).toBe(1);
    expect(body.Page).toBe(1);
    expect(body.PageSize).toBe(20);
  });

  it("normalizes slash dates", () => {
    const body = buildSearchBody({
      keywords: "沖繩",
      goDateStart: "2026/08/01",
      goDateEnd: "2026/08/07",
    });
    expect(body.GoDatestart).toBe("2026-08-01");
    expect(body.GoDateEnd).toBe("2026-08-07");
  });
});
