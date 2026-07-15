import type { PlannerStore } from "./types.js";
import { MemoryPlannerStore } from "./memory-store.js";

let store: PlannerStore | null = null;

export function getPlannerStore(): PlannerStore {
  if (!store) {
    // Phase A1–A2: in-memory store; Postgres wiring when DATABASE_URL set
    store = new MemoryPlannerStore();
  }
  return store;
}

/** 測試用：重置 singleton */
export function resetPlannerStoreForTests(next?: PlannerStore): void {
  store = next ?? new MemoryPlannerStore(false);
}

export { hashApiKeyForTests } from "./crypto.js";
