import type { TourSummary } from "@family-memories/planner-schema";

import { getPlannerStore } from "../db/client.js";
import { extractTour } from "./tour-extract.js";

export type ShortlistAddResult =
  | { ok: true; item: { tourId: string; summary: TourSummary; addedAt: string } }
  | {
      ok: false;
      error: "invalid_request" | "invalid_url" | "adapter_failed" | "quota_exceeded" | "not_supported";
      message: string;
    };

export type ShortlistListResult =
  | { ok: true; items: Array<{ tourId: string; summary: TourSummary; addedAt: string }> }
  | { ok: false; error: "invalid_request"; message: string };

export type ShortlistRemoveResult =
  | { ok: true; removed: boolean }
  | { ok: false; error: "not_found"; message: string };

function stableTourId(summary: TourSummary): string {
  return summary.id ?? `${summary.agency}:${summary.groupId}`;
}

export async function shortlistAdd(input: {
  familyId: string;
  tourId?: string;
  url?: string;
  summary?: TourSummary;
}): Promise<ShortlistAddResult> {
  let summary = input.summary;

  if (!summary && input.url) {
    const extracted = await extractTour({ familyId: input.familyId, url: input.url });
    if (!extracted.ok) {
      return { ok: false, error: extracted.error, message: extracted.message };
    }
    summary = extracted.summary;
  }

  if (!summary) {
    return {
      ok: false,
      error: "invalid_request",
      message: "需要 tourId+summary、summary 或 url",
    };
  }

  const tourId = input.tourId ?? stableTourId(summary);
  const record = await getPlannerStore().addShortlist({
    familyId: input.familyId,
    tourId,
    summary: { ...summary, id: tourId },
  });

  return {
    ok: true,
    item: {
      tourId: record.tourId,
      summary: record.summary,
      addedAt: record.addedAt,
    },
  };
}

export async function shortlistList(familyId: string): Promise<ShortlistListResult> {
  const items = await getPlannerStore().listShortlist(familyId);
  return {
    ok: true,
    items: items.map((row) => ({
      tourId: row.tourId,
      summary: row.summary,
      addedAt: row.addedAt,
    })),
  };
}

export async function shortlistRemove(input: {
  familyId: string;
  tourId: string;
}): Promise<ShortlistRemoveResult> {
  const removed = await getPlannerStore().removeShortlist(input.familyId, input.tourId);
  if (!removed) {
    return { ok: false, error: "not_found", message: "shortlist 無此 tourId" };
  }
  return { ok: true, removed: true };
}
