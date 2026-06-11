import type { MessageEvent } from "@line/bot-sdk";
import type { messagingApi } from "@line/bot-sdk";

import { logger } from "../../shared/logger";
import { env } from "../config/env";
import { photoSearchTotal } from "../metrics";
import { photoSearchService } from "../services/photo-search-factory";
import { buildSearchReplyMessages } from "../services/line-search-reply";

export async function handleTextMessage(
  event: MessageEvent,
  reply: (messages: messagingApi.Message[]) => Promise<void>,
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
    await reply(messages);
  } catch (error) {
    photoSearchTotal.inc({ kind: "error", status: "failure" });
    logger.error({ error, userId, text }, "Photo search failed");
    await reply([{ type: "text", text: "❌ 搜尋時發生錯誤，請稍後再試。" }]);
  }
}
