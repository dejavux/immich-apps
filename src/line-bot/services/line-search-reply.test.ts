import {
  assetPreviewUrl,
  buildPhotoSearchFlexCarousel,
  buildSearchReplyMessages,
} from "./line-search-reply";

describe("line-search-reply", () => {
  const assets = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      originalFileName: "beach.jpg",
      localDateTime: "2024-06-01T12:00:00.000Z",
    },
  ];

  it("builds preview URL on bot host", () => {
    expect(assetPreviewUrl("https://immich-bot.3q.fi", assets[0].id)).toBe(
      "https://immich-bot.3q.fi/media/assets/11111111-1111-4111-8111-111111111111/preview.jpg",
    );
  });

  it("builds flex carousel", () => {
    const flex = buildPhotoSearchFlexCarousel({
      assets,
      header: "🔍 找到 1 張照片",
      publicBotBaseUrl: "https://immich-bot.3q.fi",
      immichWebUrl: "https://immich.3q.fi",
    });
    expect(flex.type).toBe("flex");
    expect(flex.contents.type).toBe("carousel");
    if (flex.contents.type === "carousel") {
      expect(flex.contents.contents[0].hero?.type).toBe("image");
    }
  });

  it("returns text + flex for results", () => {
    const messages = buildSearchReplyMessages(
      {
        kind: "results",
        message: "🔍 找到 1 張照片",
        assets,
        total: 1,
      },
      "https://immich-bot.3q.fi",
      "https://immich.3q.fi",
    );
    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe("text");
    expect(messages[1].type).toBe("flex");
  });

  it("falls back to text-only when public URL missing", () => {
    const messages = buildSearchReplyMessages(
      {
        kind: "results",
        message: "🔍 找到 1 張照片",
        assets,
        total: 1,
      },
      "",
      "https://immich.3q.fi",
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("text");
  });
});
