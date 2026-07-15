import type { TourSummary } from "@family-memories/planner-schema";

import { env } from "../../config/env.js";
import type { TourExtractAdapter } from "../types.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type LlmExtractResponse = {
  shortName?: string;
  officialTitle?: string;
  destination?: string;
  days?: number;
  departDate?: string | null;
  returnDate?: string | null;
  priceFromTwd?: number | null;
  highlights?: string[];
};

function urlHash(url: URL): string {
  return Buffer.from(url.toString()).toString("base64url").slice(0, 16);
}

export function genericLlmEnabled(): boolean {
  return env.genericExtractEnabled && Boolean(env.genericExtractLlmUrl);
}

/**
 * 未知 URL 的 LLM fallback（預設關閉）；需 GENERIC_EXTRACT_ENABLED + GENERIC_EXTRACT_LLM_URL。
 */
export async function extractGenericLlm(url: URL): Promise<TourSummary> {
  if (!genericLlmEnabled()) {
    throw new Error("generic-llm extract 未啟用（需 GENERIC_EXTRACT_ENABLED 與 GENERIC_EXTRACT_LLM_URL）");
  }

  const pageRes = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!pageRes.ok) {
    throw new Error(`generic fetch HTTP ${pageRes.status}`);
  }
  const html = await pageRes.text();
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? url.hostname;

  const llmRes = await fetch(env.genericExtractLlmUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: url.toString(),
      title,
      htmlSnippet: html.slice(0, 12000),
    }),
  });
  if (!llmRes.ok) {
    const text = await llmRes.text();
    throw new Error(`generic-llm HTTP ${llmRes.status}: ${text.slice(0, 200)}`);
  }

  const parsed = (await llmRes.json()) as LlmExtractResponse;
  const extractedAt = new Date().toISOString();
  const id = `generic:${urlHash(url)}`;

  return {
    id,
    shortName: parsed.shortName ?? title.slice(0, 40),
    officialTitle: parsed.officialTitle ?? title,
    agency: "generic",
    groupId: id,
    destination: parsed.destination ?? "未知",
    days: parsed.days ?? 0,
    departDate: parsed.departDate ?? null,
    returnDate: parsed.returnDate ?? null,
    priceFromTwd: parsed.priceFromTwd ?? null,
    tags: [],
    flights: {},
    hotels: [],
    highlights: parsed.highlights ?? [],
    dayPlans: [],
    familyNotes: ["generic-llm fallback；請以 sourceUrl 人工核對"],
    sourceUrl: url.toString(),
    extractedAt,
  };
}

export const genericLlmExtractAdapter: TourExtractAdapter = {
  agency: "generic",
  canHandle(): boolean {
    return genericLlmEnabled();
  },
  extract(url: URL): Promise<TourSummary> {
    return extractGenericLlm(url);
  },
};
