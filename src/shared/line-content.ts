import type { messagingApi } from "@line/bot-sdk";

import { streamToBuffer } from "./stream";

export interface LineMessageContent {
  buffer: Buffer;
  contentType: string | undefined;
}

export async function downloadLineMessageContent(
  blobClient: messagingApi.MessagingApiBlobClient,
  messageId: string,
): Promise<LineMessageContent> {
  const { httpResponse, body } =
    await blobClient.getMessageContentWithHttpInfo(messageId);
  const buffer = await streamToBuffer(body);
  const rawType = httpResponse.headers.get("content-type");
  const contentType = rawType?.split(";")[0]?.trim().toLowerCase();

  return {
    buffer,
    contentType:
      contentType && contentType.length > 0 ? contentType : undefined,
  };
}
