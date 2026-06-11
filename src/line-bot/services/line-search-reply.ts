import type { messagingApi } from "@line/bot-sdk";

import type {
  PhotoSearchAssetHit,
  PhotoSearchResult,
} from "../../shared/types/photo-search";

const CAROUSEL_MAX_BUBBLES = 10;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assetPreviewUrl(
  publicBotBaseUrl: string,
  assetId: string,
): string {
  const base = publicBotBaseUrl.replace(/\/$/, "");
  return `${base}/media/assets/${assetId}/preview.jpg`;
}

export function isValidAssetId(assetId: string): boolean {
  return UUID_RE.test(assetId);
}

export function buildPhotoSearchFlexCarousel(params: {
  assets: PhotoSearchAssetHit[];
  header: string;
  publicBotBaseUrl: string;
  immichWebUrl: string;
}): messagingApi.FlexMessage {
  const webBase = params.immichWebUrl.replace(/\/$/, "");
  const bubbles = params.assets.slice(0, CAROUSEL_MAX_BUBBLES).map((asset) => {
    const dateLabel = asset.localDateTime
      ? asset.localDateTime.slice(0, 10)
      : "未知日期";
    const subtitle = asset.originalFileName ?? asset.id.slice(0, 8);

    return {
      type: "bubble" as const,
      hero: {
        type: "image" as const,
        url: assetPreviewUrl(params.publicBotBaseUrl, asset.id),
        size: "full" as const,
        aspectRatio: "1:1" as const,
        aspectMode: "cover" as const,
        action: {
          type: "uri" as const,
          uri: `${webBase}/photos/${asset.id}`,
        },
      },
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        spacing: "sm" as const,
        contents: [
          {
            type: "text" as const,
            text: dateLabel,
            weight: "bold" as const,
            size: "sm" as const,
          },
          {
            type: "text" as const,
            text: subtitle,
            size: "xs" as const,
            color: "#888888",
            wrap: true,
          },
        ],
      },
    };
  });

  return {
    type: "flex",
    altText: params.header,
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };
}

export function buildSearchReplyMessages(
  result: PhotoSearchResult,
  publicBotBaseUrl: string,
  immichWebUrl: string,
): messagingApi.Message[] {
  if (
    result.kind === "results" &&
    result.assets?.length &&
    publicBotBaseUrl.trim().length > 0
  ) {
    const more =
      result.total !== undefined && result.total > result.assets.length
        ? `\n… 另有 ${result.total - result.assets.length} 張，點縮圖可在 Immich 查看`
        : "";

    return [
      { type: "text", text: `${result.message}${more}` },
      buildPhotoSearchFlexCarousel({
        assets: result.assets,
        header: result.message,
        publicBotBaseUrl,
        immichWebUrl,
      }),
    ];
  }

  return [{ type: "text", text: result.message }];
}
