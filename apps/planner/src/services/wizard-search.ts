import type {
  SearchParams,
  TourSummary,
} from "@family-memories/planner-schema";

import { env } from "../config/env.js";
import { getPlannerStore } from "../db/client.js";
import { getWizardSessionStore } from "../cache/wizard-session-store.js";
import { isSessionReadyForSearch } from "../services/wizard-engine.js";
import { searchToursFromWizard } from "../services/tour-search.js";

export type WizardSearchResult =
  | { ok: true; tours: TourSummary[]; sessionId: string }
  | {
      ok: false;
      error:
        | "not_ready"
        | "quota_exceeded"
        | "not_supported"
        | "adapter_failed"
        | "session_not_found";
      message: string;
    };

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function sessionToSearchParams(session: {
  answers: {
    when?: SearchParams["dateWindow"];
    duration?: SearchParams["duration"];
    destination?: SearchParams["destination"];
    depart_from?: SearchParams["departFrom"];
    must?: string[];
    budget?: SearchParams["budget"];
  };
  tourType: SearchParams["tourType"];
}): SearchParams | null {
  if (!session.answers.when) return null;
  return {
    keywords: "",
    dateWindow: session.answers.when,
    duration: session.answers.duration,
    destination: session.answers.destination,
    departFrom: session.answers.depart_from,
    tourType: session.tourType,
    mustTags: session.answers.must,
    budget: session.answers.budget,
  };
}

export async function wizardSearch(input: {
  sessionId: string;
  familyId: string;
}): Promise<WizardSearchResult> {
  const store = getWizardSessionStore();
  const session = await store.get(input.sessionId);
  if (!session || session.familyId !== input.familyId) {
    return {
      ok: false,
      error: "session_not_found",
      message: "找不到 wizard session",
    };
  }
  if (!isSessionReadyForSearch(session)) {
    return {
      ok: false,
      error: "not_ready",
      message: "請先在 review 步驟確認條件後再搜尋",
    };
  }

  const usage = await getPlannerStore().getUsageDaily(
    input.familyId,
    todayUtc(),
  );
  if (usage.searchCount >= env.quotaSearchPerDay) {
    return {
      ok: false,
      error: "quota_exceeded",
      message: `今日搜尋次數已達上限（${env.quotaSearchPerDay}）`,
    };
  }

  const params = sessionToSearchParams(session);
  if (!params) {
    return { ok: false, error: "not_ready", message: "wizard 答案不完整" };
  }

  try {
    const tours = await searchToursFromWizard(params);
    await getPlannerStore().incrementSearchCount(input.familyId, todayUtc());

    const next = {
      ...session,
      resultTourIds: tours.map((t) => t.id ?? `lion:${t.groupId}`),
    };
    await store.set(next);

    return { ok: true, tours, sessionId: session.sessionId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "not_supported") {
      return {
        ok: false,
        error: "not_supported",
        message: "此行程類型尚未支援",
      };
    }
    return {
      ok: false,
      error: "adapter_failed",
      message: `搜尋失敗：${message}`,
    };
  }
}
