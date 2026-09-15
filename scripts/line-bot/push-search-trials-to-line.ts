/**
 * Run diverse photo-search queries and push results to LINE (push API).
 *
 * Usage:
 *   export IMMICH_API_KEY=... LINE_CHANNEL_ACCESS_TOKEN=... ADMIN_LINE_USER_IDS=...
 *   npx ts-node scripts/line-bot/push-search-trials-to-line.ts
 */
import axios from "axios";
import type { messagingApi } from "@line/bot-sdk";

import { env } from "../../src/line-bot/config/env";
import { buildSearchReplyMessages } from "../../src/line-bot/services/line-search-reply";
import {
  photoSearchService,
  resetPhotoSearchForTest,
} from "../../src/line-bot/services/photo-search-factory";

const TRIAL_USER_ID = "search-trial-runner";

interface TrialCase {
  label: string;
  query: string;
  emoji: string;
}

const TRIALS: TrialCase[] = [
  { emoji: "🏖", label: "場景 · 海邊", query: "找在海邊的照片" },
  { emoji: "🌅", label: "場景 · 日落", query: "找日落黃昏的照片" },
  { emoji: "🇩🇰", label: "人物+地點", query: "找 steffi 在丹麥的照片" },
  { emoji: "👶", label: "人物+年齡", query: "幫我找小蕊一歲半的照片" },
  { emoji: "🗾", label: "地點 · 日本", query: "找在日本的照片" },
  { emoji: "🏙", label: "地點 · 台北", query: "找在台北的照片" },
  { emoji: "👨‍👩‍👧", label: "人物+地點", query: "找小蕊在日本的照片" },
  { emoji: "💃", label: "行為 · 跳舞", query: "找跳舞的照片" },
  { emoji: "🍜", label: "行為 · 吃美食", query: "找吃美食的照片" },
  { emoji: "📅", label: "時間 · 指定日", query: "找 2024-06-01 的相片" },
  { emoji: "🎢", label: "事件 · 迪士尼", query: "找在迪士尼的照片" },
  { emoji: "🎄", label: "事件 · 聖誕", query: "找聖誕節聚餐的照片" },
];

async function linePush(
  token: string,
  userId: string,
  messages: messagingApi.Message[],
): Promise<void> {
  await axios.post(
    "https://api.line.me/v2/bot/message/push",
    { to: userId, messages },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 60_000,
    },
  );
}

async function runSearch(query: string) {
  resetPhotoSearchForTest();
  let result = await photoSearchService.handleMessage(TRIAL_USER_ID, query);
  if (result.kind === "confirm") {
    result = await photoSearchService.handleMessage(TRIAL_USER_ID, "確認");
  }
  return result;
}

async function main(): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  const userIds = (process.env.ADMIN_LINE_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!token || userIds.length === 0) {
    console.error("Need LINE_CHANNEL_ACCESS_TOKEN and ADMIN_LINE_USER_IDS");
    process.exit(1);
  }

  const intro: messagingApi.TextMessage = {
    type: "text",
    text:
      "🧪 Immich v3.2.1 搜尋測試（完整版）\n" +
      `共 ${TRIALS.length} 組：人物 / 地點 / 時間 / 行為 / 事件\n` +
      "每組含查詢條件 + 縮圖 carousel 👇",
  };

  for (const userId of userIds) {
    await linePush(token, userId, [intro]);
    console.log(`Pushed intro -> ${userId}`);
  }

  let passed = 0;
  let empty = 0;
  let other = 0;

  for (const trial of TRIALS) {
    console.log(`\n== ${trial.emoji} ${trial.label}: ${trial.query} ==`);
    try {
      const result = await runSearch(trial.query);
      const header: messagingApi.TextMessage = {
        type: "text",
        text: `${trial.emoji} 【${trial.label}】\n查詢：「${trial.query}」\n狀態：${result.kind}`,
      };

      const replyMessages = buildSearchReplyMessages(
        result,
        env.lineBotPublicUrl,
        env.immichWebUrl,
      );

      const batch: messagingApi.Message[] = [header, ...replyMessages];

      for (const userId of userIds) {
        // LINE push allows max 5 messages per request
        for (let i = 0; i < batch.length; i += 5) {
          await linePush(token, userId, batch.slice(i, i + 5));
        }
        console.log(`  pushed ${batch.length} msg(s) -> ${userId}`);
      }

      if (result.kind === "results") {
        passed += 1;
        console.log(`  results: ${result.assets?.length ?? 0} / ${result.total ?? "?"}`);
      } else if (result.kind === "empty") {
        empty += 1;
        console.log(`  empty: ${result.message.slice(0, 80)}`);
      } else {
        other += 1;
        console.log(`  ${result.kind}: ${result.message.slice(0, 120)}`);
      }
    } catch (error) {
      other += 1;
      const errText =
        error instanceof Error ? error.message : String(error);
      console.error(`  ERROR: ${errText}`);
      const errMsg: messagingApi.TextMessage = {
        type: "text",
        text: `${trial.emoji} 【${trial.label}】失敗\n${errText}`,
      };
      for (const userId of userIds) {
        await linePush(token, userId, [errMsg]);
      }
    }

    await new Promise((r) => setTimeout(r, 2500));
  }

  const summary: messagingApi.TextMessage = {
    type: "text",
    text:
      `✅ 測試完成\n` +
      `有結果：${passed} · 無結果：${empty} · 其他：${other}\n` +
      `Server: v3.2.1 · Bot: ${process.env.BOT_TAG ?? "latest"}`,
  };

  for (const userId of userIds) {
    await linePush(token, userId, [summary]);
  }

  console.log(`\nDone. passed=${passed} empty=${empty} other=${other}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
