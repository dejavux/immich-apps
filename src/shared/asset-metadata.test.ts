import {
  formatMetadataNote,
  snapshotFromAssetResponse,
} from "./asset-metadata";

describe("snapshotFromAssetResponse", () => {
  it("extracts metadata fields from asset JSON", () => {
    const snapshot = snapshotFromAssetResponse({
      hasMetadata: true,
      localDateTime: "2024-03-15T06:30:00.000Z",
      exifInfo: { make: "Apple", model: "iPhone 15 Pro" },
      people: [{ id: "1" }, { id: "2" }],
      tags: [{ id: "t1" }],
    });

    expect(snapshot).toEqual({
      hasMetadata: true,
      localDateTime: "2024-03-15T06:30:00.000Z",
      exifMake: "Apple",
      exifModel: "iPhone 15 Pro",
      peopleCount: 2,
      tagCount: 1,
    });
  });
});

describe("formatMetadataNote", () => {
  it("includes camera and people lines", () => {
    const text = formatMetadataNote({
      hasMetadata: true,
      localDateTime: "2024-03-15T06:30:00.000Z",
      exifMake: "Apple",
      exifModel: "iPhone 15 Pro",
      peopleCount: 1,
      tagCount: 2,
    });

    expect(text).toContain("📅 拍攝");
    expect(text).toContain("📷 Apple iPhone 15 Pro");
    expect(text).toContain("👤 偵測 1 人");
  });
});
