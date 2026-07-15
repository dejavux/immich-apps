import type { MessageEvent } from "@line/bot-sdk";
import type { messagingApi } from "@line/bot-sdk";

import { logger } from "../../shared/logger";
import { env } from "../config/env";
import { photoSearchTotal } from "../metrics";
import { photoSearchService } from "../services/photo-search-factory";
import { buildSearchReplyMessages } from "../services/line-search-reply";

/** LINE reply tokens expire ~30s after webhook delivery. */
const LINE_REPLY_DEADLINE_MS = 25_000;

export interface TextMessageHandlers {
  reply: (messages: messagingApi.Message[]) => Promise<void>;
  push?: (messages: messagingApi.Message[]) => Promise<void>;
}

export async function handleTextMessage(
  event: MessageEvent,
  handlers: TextMessageHandlers,
): Promise<void> {
  if (event.message.type !== "text") {
    return;
  }

  const userId = event.source.userId ?? "unknown";
  const text = event.message.text.trim();
  if (!text) {
    return;
  }

  const started = Date.now();

  try {
    const result = await photoSearchService.handleMessage(userId, text);
    photoSearchTotal.inc({ kind: result.kind, status: "success" });

    logger.info(
      {
        userId,
        kind: result.kind,
        total: result.total,
        durationMs: Date.now() - started,
      },
      "Photo search handled",
    );

    const messages = buildSearchReplyMessages(
      result,
      env.lineBotPublicUrl,
      env.immichWebUrl,
    );
    await deliverSearchReply(handlers, messages, started);
  } catch (error) {
    photoSearchTotal.inc({ kind: "error", status: "failure" });
    logger.error({ error, userId, text }, "Photo search failed");
    await deliverSearchReply(
      handlers,
      [{ type: "text", text: "❌ 搜尋時發生錯誤，請稍後再試。" }],
      started,
    );
  }
}

async function deliverSearchReply(
  handlers: TextMessageHandlers,
  messages: messagingApi.Message[],
  startedMs: number,
): Promise<void> {
  const elapsed = Date.now() - startedMs;
  if (elapsed >= LINE_REPLY_DEADLINE_MS && handlers.push) {
    logger.warn(
      { elapsedMs: elapsed },
      "LINE reply token likely expired, using push message",
    );
    await handlers.push(messages);
    return;
  }

  try {
    await handlers.reply(messages);
  } catch (error) {
    if (!handlers.push) {
      throw error;
    }
    logger.warn(
      { error, elapsedMs: elapsed },
      "LINE reply failed, falling back to push message",
    );
    await handlers.push(messages);
  }
}
