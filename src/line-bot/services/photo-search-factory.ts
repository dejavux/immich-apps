import { env } from "../config/env";
import { ImmichClient } from "../../shared/immich-client";
import { PhotoSearchService } from "./photo-search-service";
import { QwenClient } from "./qwen-client";
import { SearchSessionStore } from "./search-session-store";

const immichClient = new ImmichClient(env.immichBaseUrl, env.immichApiKey);
const sessionStore = new SearchSessionStore(env.searchSessionTtlMs);

const qwenClient =
  env.photoSearchEnabled && env.qwenBaseUrl
    ? new QwenClient({
        baseUrl: env.qwenBaseUrl,
        apiKey: env.qwenApiKey || undefined,
        model: env.qwenModel,
        timeoutMs: env.qwenTimeoutMs,
      })
    : undefined;

export const photoSearchService = new PhotoSearchService({
  immichClient,
  immichWebUrl: env.immichWebUrl,
  sessionStore,
  qwenClient,
  maxResults: env.searchMaxResults,
  ageWindowDays: env.searchAgeWindowDays,
});

/** @internal test helper */
export function resetPhotoSearchForTest(): void {
  sessionStore.resetForTest();
}
