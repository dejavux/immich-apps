import {
  buildBatchSummaryText,
  buildSingleUploadText,
  buildSingleUploadFlexMessages,
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

  it("formats success with metadata note", () => {
    const text = buildSingleUploadText({
      filename: "x.png",
      assetUrl: "https://immich.3q.fi/photos/x",
      bytes: 512,
      modeLabel: "原檔（file）",
      success: true,
      metadataNote: "📅 拍攝 2024/03/15\n👤 偵測 1 人",
    });
    expect(text).toContain("📅 拍攝");
    expect(text).toContain("👤 偵測 1 人");
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

describe("buildSingleUploadFlexMessages", () => {
  const successItem: UploadSummaryItem = {
    filename: "photo.jpg",
    assetUrl: "https://immich.3q.fi/photos/abc-123",
    assetPreviewUrl:
      "https://immich-bot.3q.fi/media/assets/abc-123/preview.jpg",
    bytes: 2048,
    modeLabel: "照片（image）",
    success: true,
  };

  it("returns text + flex bubble for success with preview URL", () => {
    const messages = buildSingleUploadFlexMessages(successItem);
    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe("text");
    expect(messages[1].type).toBe("flex");
  });

  it("includes filename in flex body", () => {
    const messages = buildSingleUploadFlexMessages(successItem);
    const flex = messages[1];
    expect(flex.type).toBe("flex");
    if (flex.type === "flex" && flex.contents.type === "bubble") {
      const body = flex.contents.body;
      expect(JSON.stringify(body)).toContain("photo.jpg");
    }
  });

  it("falls back to text when preview URL is missing", () => {
    const messages = buildSingleUploadFlexMessages({
      ...successItem,
      assetPreviewUrl: undefined,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("text");
  });

  it("returns error text for failure", () => {
    const messages = buildSingleUploadFlexMessages({
      filename: "x.jpg",
      bytes: 0,
      modeLabel: "照片（image）",
      success: false,
    });
    expect(messages).toHaveLength(1);
    if (messages[0].type === "text") {
      expect(messages[0].text).toContain("失敗");
    }
  });
});
