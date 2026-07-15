import type { AgencyId } from "@family-memories/planner-schema";

import { colaExtractAdapter } from "./cola/extract.js";
import { genericLlmExtractAdapter } from "./generic-llm/extract.js";
import { lionExtractAdapter } from "./lion/extract.js";
import { phoenixExtractAdapter } from "./phoenix/extract.js";
import type { TourAdapterRegistry, TourExtractAdapter } from "./types.js";

const EXTRACT_ADAPTERS: TourExtractAdapter[] = [
  lionExtractAdapter,
  colaExtractAdapter,
  phoenixExtractAdapter,
];

export function extractAdapterForUrl(url: URL): TourExtractAdapter | null {
  for (const adapter of EXTRACT_ADAPTERS) {
    if (adapter.canHandle(url)) {
      return adapter;
    }
  }
  if (genericLlmExtractAdapter.canHandle(url)) {
    return genericLlmExtractAdapter;
  }
  return null;
}

export const tourAdapterRegistry: TourAdapterRegistry = {
  searchAdapter(_agency: AgencyId) {
    return null;
  },
  extractAdapterForUrl,
};

export { extractAdapterForUrl as defaultExtractAdapterForUrl };
