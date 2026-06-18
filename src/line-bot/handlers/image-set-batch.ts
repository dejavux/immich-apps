import type { messagingApi } from "@line/bot-sdk";

import { imageSetBatchesTotal } from "../metrics";

/** LINE imageSet metadata (multi-photo upload batch). */
export type LineImageSet = {
  id?: string;
  total?: number;
};

export type UploadSummaryItem = {
  filename: string;
  assetUrl?: string;
  /** Bot-proxied preview URL (e.g. /media/assets/<id>/preview.jpg). Only set on success. */
  assetPreviewUrl?: string;
  bytes: number;
  modeLabel: string;
  success: boolean;
  /** Optional Immich post-upload metadata note (EXIF / faces). */
  metadataNote?: string;
};

type BatchState = {
  userId: string;
  replyToken: string;
  total?: number;
  items: UploadSummaryItem[];
  flushTimer?: ReturnType<typeof setTimeout>;
};

const FLUSH_DELAY_MS = 2_000;
const batches = new Map<string, BatchState>();
const batchLocks = new Map<string, Promise<void>>();

function batchKey(userId: string, setId: string): string {
  return `${userId}:${setId}`;
}

function isBatchComplete(state: BatchState): boolean {
  if (state.total !== undefined && state.total > 0) {
    return state.items.length >= state.total;
  }
  return false;
}

export function buildBatchSummaryText(items: UploadSummaryItem[]): string {
  const ok = items.filter((i) => i.success);
  const failed = items.filter((i) => !i.success);
  const lines: string[] = [];

  if (failed.length === 0) {
    lines.push(`✅ 已上傳 ${ok.length} 張到 Immich`);
  } else {
    lines.push(
      `✅ 已上傳 ${ok.length} 張` +
        (failed.length > 0 ? ` · ❌ 失敗 ${failed.length} 張` : ""),
    );
  }

  const preview = ok.slice(0, 3);
  for (const item of preview) {
    lines.push(
      `📄 ${item.filename} (${formatBytes(item.bytes)}) — ${item.modeLabel}`,
    );
    if (item.assetUrl) {
      lines.push(`🔗 ${item.assetUrl}`);
    }
  }

  if (ok.length > preview.length) {
    lines.push(`… 另有 ${ok.length - preview.length} 張`);
  }

  return lines.join("\n");
}

export function buildSingleUploadText(item: UploadSummaryItem): string {
  if (!item.success) {
    return "❌ 照片上傳失敗，請稍後再試";
  }
  const lines = [
    `✅ 照片已上傳到 Immich（${item.modeLabel}）`,
    `📄 ${item.filename} (${formatBytes(item.bytes)})`,
  ];
  if (item.metadataNote) {
    lines.push(item.metadataNote);
  }
  lines.push("", `🔗 ${item.assetUrl ?? ""}`);
  return lines.join("\n");
}

export function buildSingleUploadFlexMessages(
  item: UploadSummaryItem,
): messagingApi.Message[] {
  if (!item.success) {
    return [{ type: "text", text: "❌ 照片上傳失敗，請稍後再試" }];
  }

  if (!item.assetPreviewUrl || !item.assetUrl) {
    return [{ type: "text", text: buildSingleUploadText(item) }];
  }

  const bodyContents: messagingApi.FlexComponent[] = [
    {
      type: "text",
      text: item.filename,
      weight: "bold",
      size: "sm",
      wrap: true,
    },
    {
      type: "text",
      text: `${formatBytes(item.bytes)} · ${item.modeLabel}`,
      size: "xs",
      color: "#888888",
    },
  ];

  if (item.metadataNote) {
    bodyContents.push({
      type: "text",
      text: item.metadataNote,
      size: "xs",
      color: "#555555",
      wrap: true,
    });
  }

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    hero: {
      type: "image",
      url: item.assetPreviewUrl,
      size: "full",
      aspectRatio: "1:1",
      aspectMode: "cover",
      action: { type: "uri", uri: item.assetUrl },
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: bodyContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: { type: "uri", label: "在 Immich 查看", uri: item.assetUrl },
          style: "link",
          height: "sm",
        },
      ],
    },
  };

  return [
    { type: "text", text: "✅ 照片已上傳到 Immich" },
    { type: "flex", altText: `✅ ${item.filename} 已上傳`, contents: bubble },
  ];
}

export async function coordinateImageSetReply(params: {
  userId: string;
  replyToken: string;
  imageSet?: LineImageSet;
  item: UploadSummaryItem;
  sendMessages: (
    replyToken: string,
    messages: messagingApi.Message[],
  ) => Promise<void>;
}): Promise<void> {
  const { imageSet } = params;

  if (!imageSet?.id) {
    await params.sendMessages(
      params.replyToken,
      buildSingleUploadFlexMessages(params.item),
    );
    return;
  }

  const key = batchKey(params.userId, imageSet.id);

  await withBatchLock(key, async () => {
    let state = batches.get(key);
    if (!state) {
      state = {
        userId: params.userId,
        replyToken: params.replyToken,
        total: imageSet.total,
        items: [],
      };
      batches.set(key, state);
    }

    state.replyToken = params.replyToken;
    if (imageSet.total !== undefined) {
      state.total = imageSet.total;
    }
    state.items.push(params.item);

    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
      state.flushTimer = undefined;
    }

    if (isBatchComplete(state)) {
      await flushBatch(key, params.sendMessages);
      return;
    }

    if (state.total === undefined) {
      state.flushTimer = setTimeout(() => {
        void withBatchLock(key, async () => {
          await flushBatch(key, params.sendMessages);
        });
      }, FLUSH_DELAY_MS);
    }
  });
}

async function flushBatch(
  key: string,
  sendMessages: (
    replyToken: string,
    messages: messagingApi.Message[],
  ) => Promise<void>,
): Promise<void> {
  const state = batches.get(key);
  if (!state || state.items.length === 0) {
    batches.delete(key);
    return;
  }

  const messages: messagingApi.Message[] =
    state.items.length === 1
      ? buildSingleUploadFlexMessages(state.items[0])
      : [{ type: "text", text: buildBatchSummaryText(state.items) }];

  await sendMessages(state.replyToken, messages);
  if (state.items.length > 1) {
    imageSetBatchesTotal.inc();
  }
  batches.delete(key);
}

async function withBatchLock(
  key: string,
  fn: () => Promise<void>,
): Promise<void> {
  const previous = batchLocks.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  batchLocks.set(
    key,
    run.finally(() => {
      if (batchLocks.get(key) === run) {
        batchLocks.delete(key);
      }
    }),
  );
  await run;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** @internal test helper */
export function resetImageSetBatchesForTest(): void {
  batches.clear();
  batchLocks.clear();
}
