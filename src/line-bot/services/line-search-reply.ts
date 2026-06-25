import type { messagingApi } from "@line/bot-sdk";

import type {
  PhotoSearchAssetHit,
  PhotoSearchResult,
} from "../../shared/types/photo-search";
import type { ImmichPersonSummary } from "../../shared/types/immich";

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

export function buildConfirmQuickReply(): messagingApi.QuickReply {
  return {
    items: [
      {
        type: "action",
        action: { type: "message", label: "✅ 確認搜尋", text: "確認" },
      },
      {
        type: "action",
        action: { type: "message", label: "❌ 取消", text: "取消" },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "✏️ 改條件",
          text: "請告訴我要改什麼",
        },
      },
    ],
  };
}

export function buildEmptyQuickReply(
  actions: Array<{ label: string; text: string }>,
): messagingApi.QuickReply {
  return {
    items: actions.map((action) => ({
      type: "action" as const,
      action: {
        type: "message" as const,
        label: action.label.slice(0, 20),
        text: action.text,
      },
    })),
  };
}
export function buildPersonQuickReply(
  people: ImmichPersonSummary[],
): messagingApi.QuickReply {
  return {
    items: people.slice(0, 13).map((person, index) => {
      const label = person.birthDate
        ? `${person.name} (${person.birthDate})`
        : person.name;
      return {
        type: "action",
        action: {
          type: "message",
          label: label.slice(0, 20),
          text: String(index + 1),
        },
      };
    }),
  };
}

export function buildViewAllButtonMessage(
  viewAllUrl: string,
  remaining: number,
): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: `查看更多 ${remaining} 張 →`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "10px",
        contents: [
          {
            type: "button",
            action: {
              type: "uri",
              label: `查看更多（共 ${remaining} 張）→`,
              uri: viewAllUrl,
            },
            style: "primary",
            height: "sm",
          },
        ],
      },
    },
  };
}

export function buildSearchReplyMessages(
  result: PhotoSearchResult,
  publicBotBaseUrl: string,
  immichWebUrl: string,
): messagingApi.Message[] {
  if (
    result.kind === "clarify" &&
    result.personCandidates &&
    result.personCandidates.length > 1
  ) {
    return [
      {
        type: "text",
        text: result.message,
        quickReply: buildPersonQuickReply(result.personCandidates),
      },
    ];
  }

  if (result.kind === "confirm") {
    return [
      {
        type: "text",
        text: result.message,
        quickReply: buildConfirmQuickReply(),
      },
    ];
  }

  if (result.kind === "empty" && result.quickReplyActions?.length) {
    return [
      {
        type: "text",
        text: result.message,
        quickReply: buildEmptyQuickReply(result.quickReplyActions),
      },
    ];
  }

  if (
    result.kind === "results" &&
    result.assets?.length &&
    publicBotBaseUrl.trim().length > 0
  ) {
    const remaining =
      result.total !== undefined && result.total > result.assets.length
        ? result.total - result.assets.length
        : 0;

    const messages: messagingApi.Message[] = [
      { type: "text", text: result.message },
      buildPhotoSearchFlexCarousel({
        assets: result.assets,
        header: result.message,
        publicBotBaseUrl,
        immichWebUrl,
      }),
    ];

    if (remaining > 0 && result.viewAllUrl) {
      messages.push(buildViewAllButtonMessage(result.viewAllUrl, remaining));
    }

    return messages;
  }

  return [{ type: "text", text: result.message }];
}
