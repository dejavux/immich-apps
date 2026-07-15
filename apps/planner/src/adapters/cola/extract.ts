import type { TourSummary } from "@family-memories/planner-schema";

import type { TourExtractAdapter } from "../types.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function parseColaTourUrl(url: URL): { tourCode: string } | null {
  if (!/colatour\.com\.tw$/i.test(url.hostname)) {
    return null;
  }
  if (!/\/(tour|group|product)/i.test(url.pathname) && !url.searchParams.has("TourCode")) {
    return null;
  }
  const code =
    url.searchParams.get("TourCode") ??
    url.searchParams.get("tourCode") ??
    url.pathname.match(/\/(?:tour|group|product)\/([A-Za-z0-9_-]+)/i)?.[1] ??
    url.pathname.replace(/\/+$/, "").split("/").pop() ??
    "";
  if (!code || code.length < 2) {
    return null;
  }
  return { tourCode: code };
}

function titleFromHtml(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) return og[1].trim();
  const title = html.match(/<title>([^<]+)<\/title>/i);
  return title?.[1]?.trim() ?? null;
}

/**
 * Phase A2 PoC：可樂 URL 僅做 HTML title 抽取；完整解析待後續 adapter。
 */
export async function extractColaTour(url: URL): Promise<TourSummary> {
  const parsed = parseColaTourUrl(url);
  if (!parsed) {
    throw new Error("無法解析可樂旅遊 URL");
  }

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`可樂 HTML HTTP ${res.status}`);
  }
  const html = await res.text();
  const title = titleFromHtml(html) ?? `可樂行程 ${parsed.tourCode}`;
  const extractedAt = new Date().toISOString();

  return {
    id: `cola:${parsed.tourCode}`,
    shortName: parsed.tourCode,
    officialTitle: title,
    agency: "cola",
    groupId: parsed.tourCode,
    destination: "待解析",
    days: 0,
    departDate: null,
    returnDate: null,
    priceFromTwd: null,
    tags: [],
    flights: {},
    hotels: [],
    highlights: [],
    dayPlans: [],
    familyNotes: ["可樂 extract 為 Phase A2 stub；欄位待完整 HTML 解析"],
    sourceUrl: url.toString(),
    extractedAt,
  };
}

export const colaExtractAdapter: TourExtractAdapter = {
  agency: "cola",
  canHandle(url: URL): boolean {
    return parseColaTourUrl(url) !== null;
  },
  extract(url: URL): Promise<TourSummary> {
    return extractColaTour(url);
  },
};
