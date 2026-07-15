import type { AgencyId, TourSummary } from "@family-memories/planner-schema";

export type { AgencyId };

export type SearchParams = {
  keywords: string;
  dateWindow: { from: string; to: string };
  duration?: { minDays: number; maxDays: number };
  departFrom?: "TPE" | "KHH" | "RMQ" | "ANY";
  tourType: "group" | "fit";
  mustTags?: string[];
  budget?: string;
  page?: number;
  pageSize?: number;
};

export interface TourSearchAdapter {
  readonly agency: AgencyId;
  supportsSearch: boolean;
  search(params: SearchParams): Promise<TourSummary[]>;
}

export interface TourExtractAdapter {
  readonly agency: AgencyId;
  canHandle(url: URL): boolean;
  extract(url: URL): Promise<TourSummary>;
}

export interface TourAdapterRegistry {
  searchAdapter(agency: AgencyId): TourSearchAdapter | null;
  extractAdapterForUrl(url: URL): TourExtractAdapter | null;
}
