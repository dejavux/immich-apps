import {
  messagingApi,
  type MessageEvent,
  type WebhookEvent,
} from "@line/bot-sdk";

import { env } from "../config/env";
import { ImmichClient } from "../../shared/immich-client";
import { downloadLineMessageContent } from "../../shared/line-content";
import {
  isImageFileName,
  lineEventTimeIso,
  resolveUploadFilename,
} from "../../shared/media-types";
import { logger } from "../../shared/logger";
import {
  coordinateImageSetReply,
  type UploadSummaryItem,
} from "./image-set-batch";
import {
  uploadDurationSeconds,
  uploadsTotal,
  webhookEventsTotal,
} from "../metrics";

const messagingClient = new messagingApi.MessagingApiClient({
  channelAccessToken: env.lineAccessToken,
});

const blobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: env.lineAccessToken,
});

const immichClient = new ImmichClient(env.immichBaseUrl, env.immichApiKey);

export async function handleWebhookEvents(
  events: WebhookEvent[] | undefined,
): Promise<void> {
  if (!events?.length) {
    return;
  }

  await Promise.all(events.map((event) => handleEvent(event)));
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  webhookEventsTotal.inc({ type: event.type });

  if (event.type === "message" && event.message.type === "image") {
    await handleImageMessage(event as MessageEvent);
    return;
  }

  if (event.type === "message" && event.message.type === "file") {
    await handleFileMessage(event as MessageEvent);
    return;
  }

  if (
    event.type === "message" &&
    event.message.type === "text" &&
    "replyToken" in event
  ) {
    await messagingClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text:
            "請傳送照片給我，我會自動上傳到 Immich 📸\n\n" +
            "• 一般照片：直接傳圖\n" +
            "• 保留原檔：請用「檔案」傳送（非相簿），支援 JPG/HEIC/PNG 等",
        },
      ],
    });
  }
}

async function handleImageMessage(event: MessageEvent): Promise<void> {
  await uploadLineMedia(event, {
    source: "line-image",
    preferredFileName: undefined,
  });
}

async function handleFileMessage(event: MessageEvent): Promise<void> {
  if (event.message.type !== "file") {
    return;
  }

  const fileName = event.message.fileName;
  if (!isImageFileName(fileName)) {
    await replyText(
      event.replyToken,
      `❌ 目前僅支援圖片檔案（JPG/HEIC/PNG 等）。收到：${fileName}\n請改以「檔案」傳送圖片原檔。`,
    );
    return;
  }

  await uploadLineMedia(event, {
    source: "line-file",
    preferredFileName: fileName,
  });
}

async function uploadLineMedia(
  event: MessageEvent,
  params: { source: "line-image" | "line-file"; preferredFileName?: string },
): Promise<void> {
  const userId = event.source.userId ?? "unknown";
  const messageId = event.message.id;
  const replyToken = event.replyToken;
  const eventTime = lineEventTimeIso(event.timestamp);
  const imageSet =
    event.message.type === "image" ? event.message.imageSet : undefined;
  const started = Date.now();

  logger.info(
    {
      userId,
      messageId,
      source: params.source,
      preferredFileName: params.preferredFileName,
      imageSet,
    },
    "Processing LINE media",
  );

  const modeLabel =
    params.source === "line-file" ? "原檔（file）" : "照片（image）";

  let summaryItem: UploadSummaryItem;

  try {
    const { buffer, contentType } = await downloadLineMessageContent(
      blobClient,
      messageId,
    );
    const { filename, contentType: uploadContentType } = resolveUploadFilename({
      messageId,
      preferredFileName: params.preferredFileName,
      contentType,
    });

    logger.info(
      {
        messageId,
        source: params.source,
        filename,
        contentType: uploadContentType,
        lineContentType: contentType,
        bytes: buffer.length,
        fileCreatedAt: eventTime,
      },
      "Downloaded LINE content",
    );

    const asset = await immichClient.uploadAsset(buffer, {
      deviceId: `LINE-${userId}`,
      deviceAssetId: messageId,
      filename,
      contentType: uploadContentType,
      fileCreatedAt: eventTime,
      fileModifiedAt: eventTime,
      source: params.source,
    });

    await immichClient.tagAsset(asset.id, ["line-import", lineUserTag(userId)]);

    const assetUrl = immichClient.assetPageUrl(asset.id, env.immichWebUrl);

    logger.info(
      {
        assetId: asset.id,
        userId,
        messageId,
        source: params.source,
        bytes: buffer.length,
      },
      "Uploaded to Immich",
    );

    uploadsTotal.inc({ source: params.source, status: "success" });
    uploadDurationSeconds.observe(
      { source: params.source },
      (Date.now() - started) / 1000,
    );

    summaryItem = {
      filename,
      assetUrl,
      bytes: buffer.length,
      modeLabel,
      success: true,
    };
  } catch (error) {
    logger.error(
      { error, userId, messageId, source: params.source },
      "Failed to upload LINE media",
    );

    uploadsTotal.inc({ source: params.source, status: "failure" });
    uploadDurationSeconds.observe(
      { source: params.source },
      (Date.now() - started) / 1000,
    );

    summaryItem = {
      filename: params.preferredFileName ?? messageId,
      bytes: 0,
      modeLabel,
      success: false,
    };
  }

  await coordinateImageSetReply({
    userId,
    replyToken,
    imageSet,
    item: summaryItem,
    sendReply: async (token, text) => {
      await messagingClient.replyMessage({
        replyToken: token,
        messages: [{ type: "text", text }],
      });
    },
  });
}

async function replyText(replyToken: string, text: string): Promise<void> {
  await messagingClient.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}

function lineUserTag(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  return `line-user-${safe || "unknown"}`;
}
