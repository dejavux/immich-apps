import type {
  TourSummary,
  WizardAnswers,
} from "@family-memories/planner-schema";

import { getWizardSessionStore } from "../cache/wizard-session-store.js";
import {
  parseBudgetInput,
  parseDepartFromInput,
  parseDestinationInput,
  parseDurationInput,
  parseMustInput,
  parseWhenInput,
} from "./wizard-parser.js";
import { wizardSearch } from "./wizard-search.js";

export type WizardRefineField =
  | "destination"
  | "when"
  | "duration"
  | "depart_from"
  | "must"
  | "budget";

export type WizardRefineResult =
  | {
      ok: true;
      sessionId: string;
      field: WizardRefineField;
      answers: WizardAnswers;
      count: number;
      tours: TourSummary[];
    }
  | {
      ok: false;
      error:
        | "session_not_found"
        | "wizard_not_complete"
        | "invalid_field"
        | "need_clarification"
        | "not_ready"
        | "quota_exceeded"
        | "not_supported"
        | "adapter_failed";
      message: string;
    };

function parseRefineField(
  field: WizardRefineField,
  value: string,
):
  | { ok: true; patch: Partial<WizardAnswers> }
  | { ok: false; clarification: string } {
  switch (field) {
    case "when": {
      const parsed = parseWhenInput(value);
      if (!parsed.ok) return { ok: false, clarification: parsed.clarification };
      return { ok: true, patch: { when: parsed.value } };
    }
    case "duration": {
      const parsed = parseDurationInput(value);
      if (!parsed.ok) return { ok: false, clarification: parsed.clarification };
      return { ok: true, patch: { duration: parsed.value } };
    }
    case "destination": {
      const parsed = parseDestinationInput(value);
      if (!parsed.ok) return { ok: false, clarification: parsed.clarification };
      return { ok: true, patch: { destination: parsed.value } };
    }
    case "depart_from": {
      const parsed = parseDepartFromInput(value);
      if (!parsed.ok) return { ok: false, clarification: parsed.clarification };
      return { ok: true, patch: { depart_from: parsed.value } };
    }
    case "must": {
      const parsed = parseMustInput(value);
      if (!parsed.ok) return { ok: false, clarification: parsed.clarification };
      return { ok: true, patch: { must: parsed.value } };
    }
    case "budget": {
      const parsed = parseBudgetInput(value);
      if (!parsed.ok) return { ok: false, clarification: parsed.clarification };
      return { ok: true, patch: { budget: parsed.value } };
    }
    default:
      return { ok: false, clarification: "不支援的欄位" };
  }
}

function isWizardCompleteForRefine(session: {
  readyForSearch?: boolean;
  resultTourIds?: string[];
  answers: WizardAnswers;
}): boolean {
  if (session.readyForSearch || (session.resultTourIds?.length ?? 0) > 0)
    return true;
  const a = session.answers;
  return Boolean(
    a.when && a.duration && a.destination && a.depart_from && a.budget,
  );
}

export async function wizardRefine(input: {
  sessionId: string;
  familyId: string;
  field: WizardRefineField;
  value: string;
}): Promise<WizardRefineResult> {
  const store = getWizardSessionStore();
  const session = await store.get(input.sessionId);
  if (!session || session.familyId !== input.familyId) {
    return {
      ok: false,
      error: "session_not_found",
      message: "找不到 wizard session",
    };
  }

  if (!isWizardCompleteForRefine(session)) {
    return {
      ok: false,
      error: "wizard_not_complete",
      message: "請先完成 wizard 問卷並至少搜尋一次，再使用 refine",
    };
  }

  const parsed = parseRefineField(input.field, input.value);
  if (!parsed.ok) {
    return {
      ok: false,
      error: "need_clarification",
      message: parsed.clarification,
    };
  }

  const answers: WizardAnswers = { ...session.answers, ...parsed.patch };
  const next = {
    ...session,
    answers,
    step: "review" as const,
    readyForSearch: true,
    clarification: undefined,
  };
  await store.set(next);

  const search = await wizardSearch({
    sessionId: input.sessionId,
    familyId: input.familyId,
  });
  if (!search.ok) {
    return { ok: false, error: search.error, message: search.message };
  }

  return {
    ok: true,
    sessionId: input.sessionId,
    field: input.field,
    answers,
    count: search.tours.length,
    tours: search.tours,
  };
}
