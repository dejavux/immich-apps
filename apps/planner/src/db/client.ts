import { env } from "../config/env.js";
import { MemoryPlannerStore } from "./memory-store.js";
import { PostgresPlannerStore } from "./postgres-store.js";
import type { PlannerStore } from "./types.js";

let store: PlannerStore | null = null;
let initPromise: Promise<void> | null = null;

export async function initPlannerStore(): Promise<void> {
  if (store) {
    return;
  }
  if (!initPromise) {
    initPromise = (async () => {
      if (env.databaseUrl) {
        const pgStore = new PostgresPlannerStore(env.databaseUrl);
        await pgStore.init();
        store = pgStore;
        return;
      }
      store = new MemoryPlannerStore();
    })();
  }
  await initPromise;
}

export function getPlannerStore(): PlannerStore {
  if (!store) {
    store = new MemoryPlannerStore();
  }
  return store;
}

/** 測試用：重置 singleton */
export function resetPlannerStoreForTests(next?: PlannerStore): void {
  store = next ?? new MemoryPlannerStore(false);
  initPromise = null;
}

export { hashApiKeyForTests } from "./crypto.js";
