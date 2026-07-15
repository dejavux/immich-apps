import type { DateWindow } from "./date-window.js";
import type { DurationRange } from "./duration-range.js";

export type WizardStep =
  | "when"
  | "duration"
  | "depart_from"
  | "must"
  | "budget"
  | "review";

export type DepartFrom = "TPE" | "KHH" | "RMQ" | "ANY";

export type BudgetRange = "<2萬" | "2–3萬" | "3–4萬" | "不限";

export type TourType = "group" | "fit";

export type WizardAnswers = {
  when?: DateWindow;
  duration?: DurationRange;
  depart_from?: DepartFrom;
  must?: string[];
  budget?: BudgetRange;
};

/** 有狀態 wizard session（熱資料 Redis；索引 Postgres） */
export type WizardSession = {
  sessionId: string;
  familyId: string;
  step: WizardStep;
  answers: WizardAnswers;
  clarification?: string;
  /** review 步驟確認後才可 wizard_search */
  readyForSearch?: boolean;
  resultTourIds?: string[];
  shortlistTourIds?: string[];
  tourType: TourType;
};

export const WIZARD_STEP_ORDER: readonly WizardStep[] = [
  "when",
  "duration",
  "depart_from",
  "must",
  "budget",
  "review",
] as const;
