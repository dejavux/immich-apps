import {
  buildBatchSummaryText,
  buildSingleUploadText,
  type UploadSummaryItem,
} from "./image-set-batch";

describe("buildBatchSummaryText", () => {
  it("summarizes successful multi-upload", () => {
    const items: UploadSummaryItem[] = [
      {
        filename: "a.jpg",
        assetUrl: "https://immich.3q.fi/photos/1",
        bytes: 1024,
        modeLabel: "照片（image）",
        success: true,
      },
      {
        filename: "b.heic",
        assetUrl: "https://immich.3q.fi/photos/2",
        bytes: 2048,
        modeLabel: "原檔（file）",
        success: true,
      },
    ];

    const text = buildBatchSummaryText(items);
    expect(text).toContain("已上傳 2 張到 Immich");
    expect(text).toContain("a.jpg");
    expect(text).toContain("b.heic");
  });

  it("includes failure count", () => {
    const items: UploadSummaryItem[] = [
      {
        filename: "ok.jpg",
        bytes: 100,
        modeLabel: "照片（image）",
        success: true,
      },
      {
        filename: "bad.jpg",
        bytes: 0,
        modeLabel: "照片（image）",
        success: false,
      },
    ];

    const text = buildBatchSummaryText(items);
    expect(text).toContain("失敗 1 張");
  });
});

describe("buildSingleUploadText", () => {
  it("formats success", () => {
    const text = buildSingleUploadText({
      filename: "x.png",
      assetUrl: "https://immich.3q.fi/photos/x",
      bytes: 512,
      modeLabel: "照片（image）",
      success: true,
    });
    expect(text).toContain("x.png");
    expect(text).toContain("512 B");
  });

  it("formats failure", () => {
    const text = buildSingleUploadText({
      filename: "x.png",
      bytes: 0,
      modeLabel: "照片（image）",
      success: false,
    });
    expect(text).toContain("失敗");
  });
});
