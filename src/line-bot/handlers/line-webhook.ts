import {
  messagingApi,
  type MessageEvent,
  type WebhookEvent,
} from "@line/bot-sdk";

import { env } from "../config/env";
import { WELCOME_MESSAGE } from "../services/line-welcome";
import { ImmichClient } from "../../shared/immich-client";
import { downloadLineMessageContent } from "../../shared/line-content";
import {
  isSupportedMediaFileName,
  isVideoFileName,
  lineEventTimeIso,
  resolveUploadFilename,
} from "../../shared/media-types";
import { logger } from "../../shared/logger";
import {
  LINE_BOT_RECEIVED_TIME_DESCRIPTION,
  LINE_FORWARDED_TAG,
  resolveUploadTimestamps,
} from "../../shared/upload-timestamps";
import {
  coordinateImageSetReply,
  type UploadSummaryItem,
} from "./image-set-batch";
import { assetPreviewUrl } from "../services/line-search-reply";
import { handleTextMessage } from "./text-search";
import {
  uploadDurationSeconds,
  uploadsTotal,
  assetMetadataReadyTotal,
  assetMetadataWaitSeconds,
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

  if (event.type === "follow" && "replyToken" in event) {
    await messagingClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: WELCOME_MESSAGE }],
    });
    return;
  }

  if (event.type === "message" && event.message.type === "image") {
    await handleImageMessage(event as MessageEvent);
    return;
  }

  if (event.type === "message" && event.message.type === "video") {
    await handleVideoMessage(event as MessageEvent);
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
    await handleTextMessage(event as MessageEvent, async (messages) => {
      await messagingClient.replyMessage({
        replyToken: event.replyToken,
        messages,
      });
    });
    return;
  }

  if (event.type === "message") {
    logger.info(
      { messageType: event.message.type, userId: event.source.userId },
      "Ignoring unsupported LINE message type",
    );
  }
}

async function handleImageMessage(event: MessageEvent): Promise<void> {
  await uploadLineMedia(event, {
    source: "line-image",
    preferredFileName: undefined,
    fallbackExt: "jpg",
  });
}

async function handleVideoMessage(event: MessageEvent): Promise<void> {
  await uploadLineMedia(event, {
    source: "line-video",
    preferredFileName: undefined,
    fallbackExt: "mp4",
  });
}

async function handleFileMessage(event: MessageEvent): Promise<void> {
  if (event.message.type !== "file") {
    return;
  }

  const fileName = event.message.fileName;
  if (!isSupportedMediaFileName(fileName)) {
    await replyText(
      event.replyToken,
      `❌ 目前支援圖片（JPG/HEIC/PNG）與影片（MOV/MP4）。收到：${fileName}\n轉傳影片可直接傳送，或改以「檔案」傳送原檔。`,
    );
    return;
  }

  await uploadLineMedia(event, {
    source: isVideoFileName(fileName) ? "line-video" : "line-file",
    preferredFileName: fileName,
    fallbackExt: isVideoFileName(fileName) ? "mp4" : "jpg",
  });
}

async function uploadLineMedia(
  event: MessageEvent,
  params: {
    source: "line-image" | "line-file" | "line-video";
    preferredFileName?: string;
    fallbackExt?: string;
  },
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
    params.source === "line-file"
      ? "原檔（file）"
      : params.source === "line-video"
        ? "影片（video）"
        : "照片（image）";

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
      fallbackExt: params.fallbackExt,
    });

    const timestampPlan = await resolveUploadTimestamps(buffer, eventTime);

    logger.info(
      {
        messageId,
        source: params.source,
        filename,
        contentType: uploadContentType,
        lineContentType: contentType,
        bytes: buffer.length,
        fileCreatedAt: timestampPlan.fileCreatedAt ?? "(immich-exif)",
        exifDateTimeOriginal: timestampPlan.exifDateTimeOriginal,
        usedBotReceivedTime: timestampPlan.usedBotReceivedTime,
      },
      "Downloaded LINE content",
    );

    const asset = await immichClient.uploadAsset(buffer, {
      filename,
      contentType: uploadContentType,
      ...(timestampPlan.omitFileTimestamps
        ? {}
        : {
            fileCreatedAt: timestampPlan.fileCreatedAt,
            fileModifiedAt: timestampPlan.fileModifiedAt,
          }),
      source: params.source,
    });

    const tags = ["line-import", lineUserTag(userId)];
    if (timestampPlan.usedBotReceivedTime) {
      tags.push(LINE_FORWARDED_TAG);
    }
    await immichClient.tagAsset(asset.id, tags);

    if (timestampPlan.usedBotReceivedTime) {
      await immichClient.updateAssetDescription(
        asset.id,
        LINE_BOT_RECEIVED_TIME_DESCRIPTION,
      );
    }

    if (env.immichLineAlbumName) {
      const albumId = await immichClient.findOrCreateAlbum(
        env.immichLineAlbumName,
      );
      await immichClient.addAssetsToAlbum(albumId, [asset.id]);
    }

    let metadataNote: string | undefined;
    if (env.assetMetadataWaitMs > 0) {
      const metaStarted = Date.now();
      const snapshot = await immichClient.waitForAssetMetadata(asset.id, {
        timeoutMs: env.assetMetadataWaitMs,
      });
      assetMetadataWaitSeconds.observe((Date.now() - metaStarted) / 1000);
      assetMetadataReadyTotal.inc({
        ready: snapshot?.hasMetadata ? "true" : "false",
      });
      metadataNote = immichClient.buildMetadataReplyNote(snapshot);
    }

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
      assetPreviewUrl: assetPreviewUrl(env.lineBotPublicUrl, asset.id),
      bytes: buffer.length,
      modeLabel,
      success: true,
      metadataNote,
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
      errorReason:
        error instanceof Error ? error.message : "照片上傳失敗，請稍後再試",
    };
  }

  await coordinateImageSetReply({
    userId,
    replyToken,
    imageSet,
    item: summaryItem,
    sendMessages: async (token, messages) => {
      await messagingClient.replyMessage({ replyToken: token, messages });
    },
    pushMessage: async (uid, messages) => {
      await messagingClient.pushMessage({ to: uid, messages });
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
