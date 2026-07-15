import type { TourSummary } from "@family-memories/planner-schema";

import { extractAdapterForUrl } from "../adapters/registry.js";
import {
  extractCacheKey,
  getExtractCache,
  normalizeTourUrl,
  setExtractCache,
} from "../cache/extract-cache.js";
import { env } from "../config/env.js";
import { getPlannerStore } from "../db/client.js";

export type ExtractTourResult =
  | { ok: true; summary: TourSummary; cached: boolean; extractedAt: string }
  | {
      ok: false;
      error: "invalid_url" | "quota_exceeded" | "adapter_failed" | "not_supported";
      message: string;
    };

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function extractTour(input: {
  familyId: string;
  url: string;
  skipCache?: boolean;
}): Promise<ExtractTourResult> {
  let url: URL;
  try {
    url = normalizeTourUrl(input.url);
  } catch {
    return { ok: false, error: "invalid_url", message: "URL 格式無效" };
  }

  const usage = await getPlannerStore().getUsageDaily(input.familyId, todayUtc());
  if (usage.extractCount >= env.quotaExtractPerDay) {
    return {
      ok: false,
      error: "quota_exceeded",
      message: `今日 extract 次數已達上限（${env.quotaExtractPerDay}）`,
    };
  }

  const cacheKey = extractCacheKey(url);
  if (!input.skipCache) {
    const cached = await getExtractCache(cacheKey);
    if (cached) {
      return {
        ok: true,
        summary: cached.summary,
        cached: true,
        extractedAt: cached.extractedAt,
      };
    }
  }

  const adapter = extractAdapterForUrl(url);
  if (!adapter) {
    return {
      ok: false,
      error: "not_supported",
      message: "無法辨識此 URL 的旅行社；generic-llm 未啟用",
    };
  }

  try {
    const summary = await adapter.extract(url);
    const extractedAt = summary.extractedAt ?? new Date().toISOString();
    const withMeta = { ...summary, extractedAt, sourceUrl: url.toString() };
    await setExtractCache({
      cacheKey,
      agency: adapter.agency,
      summary: withMeta,
    });
    await getPlannerStore().incrementExtractCount(input.familyId, todayUtc());

    return {
      ok: true,
      summary: withMeta,
      cached: false,
      extractedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: "adapter_failed", message };
  }
}
