import { randomUUID } from "node:crypto";

import {
  WIZARD_STEP_ORDER,
  type WizardAnswers,
  type WizardSession,
  type WizardStep,
} from "@family-memories/planner-schema";

import { getWizardSessionStore } from "../cache/wizard-session-store.js";
import {
  parseBudgetInput,
  parseDepartFromInput,
  parseDestinationInput,
  parseDurationInput,
  parseMustInput,
  parseReviewInput,
  parseWhenInput,
} from "./wizard-parser.js";

export type WizardPrompt = {
  step: WizardStep;
  prompt: string;
};

export type WizardAnswerResult =
  | { ok: true; session: WizardSession; prompt?: WizardPrompt }
  | {
      ok: false;
      error: "need_clarification";
      message: string;
      session: WizardSession;
    }
  | { ok: false; error: "invalid_step" | "session_not_found"; message: string };

const STEP_PROMPTS: Record<WizardStep, string> = {
  when: "大概什麼時候出發？（例：暑假、7–8 月、明年 1 月底）",
  duration: "希望玩幾天？（例：4–5 天、一週左右）",
  destination:
    "想去哪裡？（例：濟州、日本、東南亞；或「還沒想好」「給我建議」）",
  depart_from: "從哪裡出發？（台北／高雄／台中／不限）",
  must: "有沒有硬條件？最多 3 條，用逗號分隔（例：無購物、親子；可回「無」）",
  budget: "每人預算大概多少？（<2萬／2–3萬／3–4萬／不限）",
  review: "請確認以下條件。回覆「確認」開始搜尋，或「修改預算」等調整某一步。",
};

function formatDestination(answers: WizardAnswers): string {
  const dest = answers.destination;
  if (!dest) return "—";
  if (dest.mode === "open") return "還沒想好";
  if (dest.mode === "suggest")
    return dest.hint ? `給建議（${dest.hint}）` : "給建議";
  return dest.keywords.join("、");
}

function stepIndex(step: WizardStep): number {
  return WIZARD_STEP_ORDER.indexOf(step);
}

function nextStep(step: WizardStep): WizardStep | null {
  const idx = stepIndex(step);
  if (idx < 0 || idx >= WIZARD_STEP_ORDER.length - 1) return null;
  return WIZARD_STEP_ORDER[idx + 1] ?? null;
}

function prevStep(step: WizardStep): WizardStep | null {
  const idx = stepIndex(step);
  if (idx <= 0) return null;
  return WIZARD_STEP_ORDER[idx - 1] ?? null;
}

export function buildReviewSummary(answers: WizardAnswers): string {
  const lines = [
    `出發區間：${answers.when?.label ?? `${answers.when?.from} ~ ${answers.when?.to}`}`,
    `天數：${answers.duration ? `${answers.duration.minDays}–${answers.duration.maxDays} 天` : "—"}`,
    `目的地：${formatDestination(answers)}`,
    `出發地：${answers.depart_from ?? "—"}`,
    `硬條件：${answers.must?.length ? answers.must.join("、") : "無"}`,
    `預算：${answers.budget ?? "—"}`,
    "行程類型：跟團（group）",
  ];
  return lines.join("\n");
}

function promptForStep(step: WizardStep, answers: WizardAnswers): WizardPrompt {
  if (step === "review") {
    return {
      step,
      prompt: `${STEP_PROMPTS.review}\n\n${buildReviewSummary(answers)}`,
    };
  }
  return { step, prompt: STEP_PROMPTS[step] };
}

function parseStepValue(
  step: WizardStep,
  value: string,
):
  | { ok: true; patch: Partial<WizardAnswers> }
  | { ok: false; clarification: string } {
  switch (step) {
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
      return { ok: false, clarification: "review 步驟請用 parseReviewInput" };
  }
}

export async function wizardStart(familyId: string): Promise<{
  session: WizardSession;
  prompt: WizardPrompt;
}> {
  const session: WizardSession = {
    sessionId: randomUUID(),
    familyId,
    step: "when",
    answers: {},
    tourType: "group",
    readyForSearch: false,
  };
  await getWizardSessionStore().set(session);
  return { session, prompt: promptForStep("when", {}) };
}

export async function wizardStatus(
  sessionId: string,
): Promise<WizardSession | null> {
  return getWizardSessionStore().get(sessionId);
}

export async function wizardAnswer(input: {
  sessionId: string;
  familyId: string;
  step: WizardStep;
  value: string;
}): Promise<WizardAnswerResult> {
  const store = getWizardSessionStore();
  const session = await store.get(input.sessionId);
  if (!session || session.familyId !== input.familyId) {
    return {
      ok: false,
      error: "session_not_found",
      message: "找不到 wizard session",
    };
  }
  if (session.step !== input.step) {
    return {
      ok: false,
      error: "invalid_step",
      message: `目前步驟為 ${session.step}，與請求的 ${input.step} 不符`,
    };
  }

  if (input.step === "review") {
    const parsed = parseReviewInput(input.value);
    if (!parsed.ok) {
      const next = { ...session, clarification: parsed.clarification };
      await store.set(next);
      return {
        ok: false,
        error: "need_clarification",
        message: parsed.clarification,
        session: next,
      };
    }
    if (parsed.value.type === "edit") {
      const next: WizardSession = {
        ...session,
        step: parsed.value.step,
        readyForSearch: false,
        clarification: undefined,
      };
      await store.set(next);
      return {
        ok: true,
        session: next,
        prompt: promptForStep(next.step, next.answers),
      };
    }

    const next: WizardSession = {
      ...session,
      readyForSearch: true,
      clarification: undefined,
    };
    await store.set(next);
    return {
      ok: true,
      session: next,
      prompt: {
        step: "review",
        prompt: "已確認條件，可呼叫 wizard_search 開始搜尋。",
      },
    };
  }

  const parsed = parseStepValue(input.step, input.value);
  if (!parsed.ok) {
    const next = { ...session, clarification: parsed.clarification };
    await store.set(next);
    return {
      ok: false,
      error: "need_clarification",
      message: parsed.clarification,
      session: next,
    };
  }

  const answers: WizardAnswers = { ...session.answers, ...parsed.patch };
  const following = nextStep(input.step);
  const next: WizardSession = {
    ...session,
    answers,
    step: following ?? "review",
    readyForSearch: false,
    clarification: undefined,
  };
  await store.set(next);
  return {
    ok: true,
    session: next,
    prompt: promptForStep(next.step, next.answers),
  };
}

export async function wizardBack(input: {
  sessionId: string;
  familyId: string;
}): Promise<WizardAnswerResult> {
  const store = getWizardSessionStore();
  const session = await store.get(input.sessionId);
  if (!session || session.familyId !== input.familyId) {
    return {
      ok: false,
      error: "session_not_found",
      message: "找不到 wizard session",
    };
  }

  const previous = prevStep(session.step);
  if (!previous) {
    return {
      ok: false,
      error: "invalid_step",
      message: "已在第一步，無法再往回",
    };
  }

  const next: WizardSession = {
    ...session,
    step: previous,
    readyForSearch: false,
    clarification: undefined,
  };
  await store.set(next);
  return {
    ok: true,
    session: next,
    prompt: promptForStep(previous, next.answers),
  };
}

export function isSessionReadyForSearch(session: WizardSession): boolean {
  return Boolean(session.readyForSearch && session.step === "review");
}

export { promptForStep, STEP_PROMPTS };
