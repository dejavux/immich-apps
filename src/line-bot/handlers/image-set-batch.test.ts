import {
  buildBatchProgressText,
  buildBatchSummaryText,
  buildSingleUploadText,
  buildSingleUploadFlexMessages,
  buildUploadFailureFlexMessages,
  coordinateImageSetReply,
  resetImageSetBatchesForTest,
  shouldSendBatchProgress,
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

  it("returns error flex for failure", () => {
    const messages = buildUploadFailureFlexMessages({
      filename: "x.jpg",
      bytes: 0,
      modeLabel: "照片（image）",
      success: false,
      errorReason: "檔案過大",
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("flex");
    if (messages[0].type === "flex" && messages[0].contents.type === "bubble") {
      expect(JSON.stringify(messages[0].contents)).toContain("上傳失敗");
      expect(JSON.stringify(messages[0].contents)).toContain("檔案過大");
      expect(JSON.stringify(messages[0].contents)).toContain("改以檔案傳送");
    }
  });

  it("returns error flex via buildSingleUploadFlexMessages", () => {
    const messages = buildSingleUploadFlexMessages({
      filename: "x.jpg",
      bytes: 0,
      modeLabel: "照片（image）",
      success: false,
      errorReason: "timeout",
    });
    expect(messages[0].type).toBe("flex");
  });
});

describe("batch upload progress", () => {
  beforeEach(() => {
    resetImageSetBatchesForTest();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("formats progress text", () => {
    expect(buildBatchProgressText(3, 8)).toBe("處理中 3/8…");
  });

  it("sends throttled progress via pushMessage", async () => {
    const pushMessage = jest.fn().mockResolvedValue(undefined);
    const sendMessages = jest.fn().mockResolvedValue(undefined);
    const item: UploadSummaryItem = {
      filename: "a.jpg",
      bytes: 100,
      modeLabel: "照片（image）",
      success: true,
    };

    await coordinateImageSetReply({
      userId: "u1",
      replyToken: "r1",
      imageSet: { id: "set1", total: 4 },
      item,
      sendMessages,
      pushMessage,
    });

    expect(pushMessage).toHaveBeenCalledWith("u1", [
      { type: "text", text: "處理中 1/4…" },
    ]);

    await coordinateImageSetReply({
      userId: "u1",
      replyToken: "r2",
      imageSet: { id: "set1", total: 4 },
      item: { ...item, filename: "b.jpg" },
      sendMessages,
      pushMessage,
    });

    expect(pushMessage).toHaveBeenCalledWith("u1", [
      { type: "text", text: "處理中 2/4…" },
    ]);
  });

  it("sends progress on every item until complete", async () => {
    const pushMessage = jest.fn().mockResolvedValue(undefined);
    const sendMessages = jest.fn().mockResolvedValue(undefined);
    const item: UploadSummaryItem = {
      filename: "a.jpg",
      bytes: 100,
      modeLabel: "照片（image）",
      success: true,
    };

    for (let i = 1; i <= 3; i += 1) {
      await coordinateImageSetReply({
        userId: "u2",
        replyToken: `r${i}`,
        imageSet: { id: "set2", total: 4 },
        item: { ...item, filename: `p${i}.jpg` },
        sendMessages,
        pushMessage,
      });
    }

    expect(pushMessage).toHaveBeenCalledTimes(3);
    expect(pushMessage).toHaveBeenLastCalledWith("u2", [
      { type: "text", text: "處理中 3/4…" },
    ]);
  });
});

describe("shouldSendBatchProgress", () => {
  it("sends on first item when total known", () => {
    expect(
      shouldSendBatchProgress({
        userId: "u1",
        replyToken: "r1",
        total: 4,
        items: [{ filename: "a", bytes: 1, modeLabel: "x", success: true }],
      }),
    ).toBe(true);
  });

  it("sends every item while batch incomplete", () => {
    expect(
      shouldSendBatchProgress({
        userId: "u1",
        replyToken: "r1",
        total: 4,
        items: [
          { filename: "a", bytes: 1, modeLabel: "x", success: true },
          { filename: "b", bytes: 1, modeLabel: "x", success: true },
          { filename: "c", bytes: 1, modeLabel: "x", success: true },
        ],
      }),
    ).toBe(true);
  });
});
