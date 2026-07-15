import type { TourSummary } from "@family-memories/planner-schema";

import type { TourExtractAdapter } from "../types.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function parsePhoenixTourUrl(url: URL): { tourCode: string } | null {
  if (!/phoenixtour\.com\.tw$/i.test(url.hostname) && !/phoenix\.com\.tw$/i.test(url.hostname)) {
    return null;
  }
  const code =
    url.searchParams.get("TourCode") ??
    url.searchParams.get("GroupNo") ??
    url.pathname.match(/\/(?:tour|group)\/([A-Za-z0-9_-]+)/i)?.[1] ??
    "";
  if (!code) {
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
 * Phase A2 PoC：鳳凰 URL 僅做 HTML title 抽取；完整解析待後續 adapter。
 */
export async function extractPhoenixTour(url: URL): Promise<TourSummary> {
  const parsed = parsePhoenixTourUrl(url);
  if (!parsed) {
    throw new Error("無法解析鳳凰旅行社 URL");
  }

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`鳳凰 HTML HTTP ${res.status}`);
  }
  const html = await res.text();
  const title = titleFromHtml(html) ?? `鳳凰行程 ${parsed.tourCode}`;
  const extractedAt = new Date().toISOString();

  return {
    id: `phoenix:${parsed.tourCode}`,
    shortName: parsed.tourCode,
    officialTitle: title,
    agency: "phoenix",
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
    familyNotes: ["鳳凰 extract 為 Phase A2 stub；欄位待完整 HTML 解析"],
    sourceUrl: url.toString(),
    extractedAt,
  };
}

export const phoenixExtractAdapter: TourExtractAdapter = {
  agency: "phoenix",
  canHandle(url: URL): boolean {
    return parsePhoenixTourUrl(url) !== null;
  },
  extract(url: URL): Promise<TourSummary> {
    return extractPhoenixTour(url);
  },
};
