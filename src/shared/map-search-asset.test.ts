import {
  enrichSearchAssetHits,
  isUuidLikeFileName,
  mapSearchAssetItem,
} from "./map-search-asset";

describe("mapSearchAssetItem", () => {
  it("extracts exif location and people", () => {
    const hit = mapSearchAssetItem({
      id: "abc",
      originalFileName: "IMG_0001.jpg",
      localDateTime: "2024-06-01T12:00:00.000Z",
      exifInfo: { country: "Japan", city: "Tokyo" },
      people: [{ name: "rayna" }, { name: "steffi" }],
    });
    expect(hit).toEqual({
      id: "abc",
      originalFileName: "IMG_0001.jpg",
      localDateTime: "2024-06-01T12:00:00.000Z",
      country: "Japan",
      city: "Tokyo",
      personNames: ["rayna", "steffi"],
    });
  });
});

describe("enrichSearchAssetHits", () => {
  it("fills missing people from search plan but not location", () => {
    const enriched = enrichSearchAssetHits(
      [
        {
          id: "abc",
          localDateTime: "2019-07-14T12:00:00.000Z",
          originalFileName: "11111111-1111-4111-8111-111111111111.jpg",
        },
      ],
      { country: "Denmark", city: "Copenhagen", personNames: ["steffi"] },
    );
    expect(enriched[0]).toMatchObject({
      personNames: ["steffi"],
    });
    expect(enriched[0].country).toBeUndefined();
    expect(enriched[0].city).toBeUndefined();
  });

  it("preserves API metadata when present", () => {
    const enriched = enrichSearchAssetHits(
      [
        {
          id: "abc",
          country: "Japan",
          city: "Tokyo",
          personNames: ["rayna"],
        },
      ],
      { country: "Denmark", personNames: ["steffi"] },
      "steffi",
    );
    expect(enriched[0]).toEqual({
      id: "abc",
      country: "Japan",
      city: "Tokyo",
      personNames: ["rayna"],
    });
  });
});

describe("isUuidLikeFileName", () => {
  it("detects uuid filenames", () => {
    expect(isUuidLikeFileName("11111111-1111-4111-8111-111111111111.jpg")).toBe(
      true,
    );
    expect(isUuidLikeFileName("beach.jpg")).toBe(false);
  });
});
