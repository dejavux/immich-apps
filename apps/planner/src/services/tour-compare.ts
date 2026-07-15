import type { TourSummary } from "@family-memories/planner-schema";

import { compareTours as formatCompareMarkdown } from "../adapters/lion/normalize.js";
import { getPlannerStore } from "../db/client.js";

export type CompareToursResult =
  | {
      ok: true;
      count: number;
      tours: TourSummary[];
      tableMarkdown: string;
    }
  | { ok: false; error: "invalid_request" | "not_found"; message: string };

function stableTourId(tour: TourSummary): string {
  return tour.id ?? `${tour.agency}:${tour.groupId}`;
}

export async function compareTours(input: {
  familyId: string;
  tourIds?: string[];
  tours?: TourSummary[];
}): Promise<CompareToursResult> {
  const inline = input.tours ?? [];
  const ids = input.tourIds ?? [];

  if (inline.length + ids.length < 2) {
    return {
      ok: false,
      error: "invalid_request",
      message: "compare_tours 需要至少 2 筆行程（tourIds 或 tours）",
    };
  }

  const resolved: TourSummary[] = [...inline];
  const store = getPlannerStore();

  for (const tourId of ids) {
    const fromShortlist = await store.findShortlistItem(input.familyId, tourId);
    if (!fromShortlist) {
      return {
        ok: false,
        error: "not_found",
        message: `shortlist 找不到 tourId：${tourId}`,
      };
    }
    resolved.push(fromShortlist.summary);
  }

  const deduped = new Map<string, TourSummary>();
  for (const tour of resolved) {
    deduped.set(stableTourId(tour), tour);
  }
  const tours = [...deduped.values()];
  if (tours.length < 2) {
    return {
      ok: false,
      error: "invalid_request",
      message: "去重後至少需要 2 筆不同行程",
    };
  }

  return {
    ok: true,
    count: tours.length,
    tours,
    tableMarkdown: formatCompareMarkdown(tours),
  };
}
