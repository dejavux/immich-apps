import { messagingApi, type MessageEvent, type WebhookEvent } from '@line/bot-sdk';

import { env } from '../config/env';
import { ImmichClient } from '../../shared/immich-client';
import { logger } from '../../shared/logger';
import { streamToBuffer } from '../../shared/stream';

const messagingClient = new messagingApi.MessagingApiClient({
  channelAccessToken: env.lineAccessToken,
});

const blobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: env.lineAccessToken,
});

const immichClient = new ImmichClient(env.immichBaseUrl, env.immichApiKey);

export async function handleWebhookEvents(events: WebhookEvent[] | undefined): Promise<void> {
  if (!events?.length) {
    return;
  }

  await Promise.all(events.map((event) => handleEvent(event)));
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  if (event.type === 'message' && event.message.type === 'image') {
    await handleImageMessage(event as MessageEvent);
    return;
  }

  if (event.type === 'message' && event.message.type === 'text' && 'replyToken' in event) {
    await messagingClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: 'text',
          text: '請直接傳送或轉發照片給我，我會自動上傳到 Immich 📸',
        },
      ],
    });
  }
}

async function handleImageMessage(event: MessageEvent): Promise<void> {
  const userId = event.source.userId ?? 'unknown';
  const messageId = event.message.id;
  const replyToken = event.replyToken;

  logger.info({ userId, messageId }, 'Processing LINE image');

  try {
    const imageStream = await blobClient.getMessageContent(messageId);
    const imageBuffer = await streamToBuffer(imageStream);

    const asset = await immichClient.uploadAsset(imageBuffer, {
      deviceId: `LINE-${userId}`,
      deviceAssetId: messageId,
    });

    const assetUrl = immichClient.assetPageUrl(asset.id, env.immichWebUrl);

    logger.info({ assetId: asset.id, userId, messageId }, 'Uploaded to Immich');

    await messagingClient.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: `✅ 照片已上傳到 Immich\n\n🔗 ${assetUrl}`,
        },
      ],
    });
  } catch (error) {
    logger.error({ error, userId, messageId }, 'Failed to upload LINE image');

    await messagingClient.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: '❌ 照片上傳失敗，請稍後再試',
        },
      ],
    });
  }
}
