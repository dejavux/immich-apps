import type {
  BudgetRange,
  SearchParams,
  TourSummary,
} from "@family-memories/planner-schema";

import {
  addTourDays,
  detailUrl,
  searchLionGroupList,
  type LionNormGroupHit,
} from "../adapters/lion/search.js";
import { finalizeTour } from "../adapters/lion/normalize.js";

const DEPARTURE_ID: Record<string, string | null> = {
  TPE: "TPE",
  KHH: "KHH",
  RMQ: "RMQ",
  ANY: null,
};

function hitToSummary(hit: LionNormGroupHit): TourSummary {
  const group = hit.groups[0];
  const departDate = group?.goDate?.replace(/\//g, "-") ?? null;
  const returnRaw = departDate
    ? addTourDays(group?.goDate ?? "", hit.tourDays)
    : null;
  const returnDate = returnRaw?.replace(/\//g, "-") ?? null;
  const groupId = group?.groupId ?? hit.normGroupId;

  return finalizeTour({
    agency: "lion",
    groupId,
    officialTitle: hit.tourName,
    days: hit.tourDays,
    departDate,
    returnDate,
    priceFromTwd: group?.priceFromTwd ?? hit.priceFromTwd,
    statusText: group?.statusText ?? null,
    flights: {},
    hotels: [],
    highlights: hit.tagNames,
    dayPlans: [],
    familyNotes: [],
    sourceUrl: detailUrl(hit.normGroupId, groupId),
  });
}

function budgetMaxTwd(budget?: BudgetRange): number | null {
  switch (budget) {
    case "<2萬":
      return 20000;
    case "2–3萬":
      return 30000;
    case "3–4萬":
      return 40000;
    default:
      return null;
  }
}

function budgetMinTwd(budget?: BudgetRange): number | null {
  switch (budget) {
    case "2–3萬":
      return 20000;
    case "3–4萬":
      return 30000;
    default:
      return null;
  }
}

function matchesMust(tour: TourSummary, must: string[]): boolean {
  if (!must.length) return true;
  const hay = `${tour.officialTitle} ${tour.tags.join(" ")} ${tour.highlights.join(" ")}`;
  return must.every((term) => {
    if (/無購物/.test(term)) {
      return tour.tags.includes("無購物") || /無購物/.test(hay);
    }
    return hay.includes(term);
  });
}

function matchesBudget(tour: TourSummary, budget?: BudgetRange): boolean {
  if (!budget || budget === "不限" || tour.priceFromTwd == null) return true;
  const max = budgetMaxTwd(budget);
  const min = budgetMinTwd(budget);
  if (max != null && tour.priceFromTwd > max) return false;
  if (min != null && tour.priceFromTwd < min) return false;
  return true;
}

/** 依 destination 產生雄獅搜尋關鍵字（可多筆合併搜尋） */
export function destinationKeywordList(params: SearchParams): string[] {
  const dest = params.destination;
  if (!dest || dest.mode === "open") return ["跟團旅遊"];
  if (dest.mode === "suggest") {
    const hint = dest.hint?.trim();
    return [hint || "跟團旅遊"];
  }
  if (dest.keywords.length) return dest.keywords;
  return ["跟團旅遊"];
}

function tourStableId(tour: TourSummary): string {
  return tour.id ?? `lion:${tour.groupId}`;
}

function filterTours(
  params: SearchParams,
  tours: TourSummary[],
): TourSummary[] {
  let filtered = tours;

  if (params.duration) {
    filtered = filtered.filter(
      (t) =>
        t.days >= params.duration!.minDays &&
        t.days <= params.duration!.maxDays,
    );
  }

  if (params.mustTags?.length) {
    filtered = filtered.filter((t) => matchesMust(t, params.mustTags!));
  }

  if (params.budget) {
    filtered = filtered.filter((t) => matchesBudget(t, params.budget));
  }

  return filtered;
}

export async function searchToursFromWizard(
  params: SearchParams,
): Promise<TourSummary[]> {
  if (params.tourType === "fit") {
    throw new Error("not_supported");
  }

  const keywordList = destinationKeywordList(params);
  const seen = new Set<string>();
  const merged: TourSummary[] = [];

  for (const keywords of keywordList) {
    const result = await searchLionGroupList({
      keywords,
      goDateStart: params.dateWindow.from,
      goDateEnd: params.dateWindow.to,
      travelType: 1,
      departureId: DEPARTURE_ID[params.departFrom ?? "ANY"] ?? null,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    });

    for (const hit of result.hits) {
      const tour = hitToSummary(hit);
      const id = tourStableId(tour);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(tour);
    }
  }

  return filterTours(params, merged);
}
