import type { TourSummary, WizardStep } from "@family-memories/planner-schema";

import {
  promptForStep,
  wizardAnswer,
  wizardBack,
  wizardStart,
  wizardStatus,
} from "../services/wizard-engine.js";
import { wizardSearch } from "../services/wizard-search.js";
import { compareTours } from "../services/tour-compare.js";
import { extractTour } from "../services/tour-extract.js";
import {
  shortlistAdd,
  shortlistList,
  shortlistRemove,
} from "../services/shortlist.js";
import { wizardRefine } from "../services/wizard-refine.js";

function sessionPayload(
  session: NonNullable<Awaited<ReturnType<typeof wizardStatus>>>,
) {
  const prompt = promptForStep(session.step, session.answers);
  return {
    ok: true,
    sessionId: session.sessionId,
    step: session.step,
    answers: session.answers,
    clarification: session.clarification,
    readyForSearch: session.readyForSearch ?? false,
    tourType: session.tourType,
    resultTourIds: session.resultTourIds ?? [],
    prompt: prompt.prompt,
  };
}

export async function handleWizardStart(familyId: string) {
  const { session, prompt } = await wizardStart(familyId);
  return {
    ok: true,
    sessionId: session.sessionId,
    step: session.step,
    prompt: prompt.prompt,
    tourType: session.tourType,
  };
}

export async function handleWizardStatus(familyId: string, sessionId: string) {
  const session = await wizardStatus(sessionId);
  if (!session || session.familyId !== familyId) {
    return { ok: false, error: "session_not_found", message: "找不到 session" };
  }
  return sessionPayload(session);
}

export async function handleWizardAnswer(
  familyId: string,
  input: { sessionId: string; step: WizardStep; value: string },
) {
  const result = await wizardAnswer({
    sessionId: input.sessionId,
    familyId,
    step: input.step,
    value: input.value,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      message: result.message,
      session: "session" in result ? sessionPayload(result.session) : undefined,
    };
  }

  return {
    ok: true,
    session: sessionPayload(result.session),
    prompt: result.prompt?.prompt,
  };
}

export async function handleWizardBack(familyId: string, sessionId: string) {
  const result = await wizardBack({ sessionId, familyId });
  if (!result.ok) {
    return { ok: false, error: result.error, message: result.message };
  }
  return {
    ok: true,
    session: sessionPayload(result.session),
    prompt: result.prompt?.prompt,
  };
}

export async function handleWizardSearch(familyId: string, sessionId: string) {
  const result = await wizardSearch({ sessionId, familyId });
  if (!result.ok) {
    return { ok: false, error: result.error, message: result.message };
  }
  return {
    ok: true,
    sessionId: result.sessionId,
    count: result.tours.length,
    tours: result.tours,
  };
}

export async function handleWizardRefine(
  familyId: string,
  input: { sessionId: string; field: string; value: string },
) {
  const result = await wizardRefine({
    sessionId: input.sessionId,
    familyId,
    field: input.field as Parameters<typeof wizardRefine>[0]["field"],
    value: input.value,
  });
  if (!result.ok) {
    return { ok: false, error: result.error, message: result.message };
  }
  return {
    ok: true,
    sessionId: result.sessionId,
    field: result.field,
    answers: result.answers,
    count: result.count,
    tours: result.tours,
  };
}

export async function handleExtractTour(
  familyId: string,
  input: { url: string; skipCache?: boolean },
) {
  const result = await extractTour({
    familyId,
    url: input.url,
    skipCache: input.skipCache,
  });
  if (!result.ok) {
    return { ok: false, error: result.error, message: result.message };
  }
  return {
    ok: true,
    cached: result.cached,
    extractedAt: result.extractedAt,
    summary: result.summary,
  };
}

export async function handleCompareTours(
  familyId: string,
  input: { tourIds?: string[]; tours?: TourSummary[] },
) {
  const result = await compareTours({
    familyId,
    tourIds: input.tourIds,
    tours: input.tours,
  });
  if (!result.ok) {
    return { ok: false, error: result.error, message: result.message };
  }
  return {
    ok: true,
    count: result.count,
    tours: result.tours,
    tableMarkdown: result.tableMarkdown,
  };
}

export async function handleShortlistAdd(
  familyId: string,
  input: { tourId?: string; url?: string; summary?: TourSummary },
) {
  const result = await shortlistAdd({
    familyId,
    tourId: input.tourId,
    url: input.url,
    summary: input.summary,
  });
  if (!result.ok) {
    return { ok: false, error: result.error, message: result.message };
  }
  return { ok: true, item: result.item };
}

export async function handleShortlistList(familyId: string) {
  return shortlistList(familyId);
}

export async function handleShortlistRemove(familyId: string, tourId: string) {
  const result = await shortlistRemove({ familyId, tourId });
  if (!result.ok) {
    return { ok: false, error: result.error, message: result.message };
  }
  return { ok: true, removed: result.removed };
}

export function jsonToolText(payload: unknown): { type: "text"; text: string } {
  return { type: "text", text: JSON.stringify(payload, null, 2) };
}
