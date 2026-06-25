export type SearchIntent =
  | "search_photos"
  | "upload_help"
  | "cancel"
  | "unknown";

/** LLM-structured plan for person + date/age photo search (V1). */
export interface PhotoSearchPlan {
  intent: SearchIntent;
  personNames: string[];
  /** Fractional years, e.g. 1.5 = 一歲半 */
  ageYears?: number;
  ageMonths?: number;
  /** Explicit ISO dates YYYY-MM-DD when user states a range */
  dateFrom?: string;
  dateTo?: string;
  /** User-provided birth date YYYY-MM-DD */
  birthDate?: string;
  /** User picked disambiguation option 1-based */
  personChoice?: number;
  /** Scene description in user language, e.g. 在海邊 */
  sceneQuery?: string;
  /** CLIP English query from LLM, e.g. beach ocean */
  sceneQueryEn?: string;
  /** Display label for relative dates, e.g. 今年、去年 */
  dateRangeLabel?: string;
  /** Immich country name extracted from user query (e.g. "Japan", "Taiwan, Province of China"). */
  country?: string;
  /** Immich city name extracted from user query (e.g. "Tokyo", "Taipei"). */
  city?: string;
  /** User explicitly said "年齡不限" / "不限年齡" — skip age/date requirement. */
  anyDate?: boolean;
}

export interface ImmichPersonSummary {
  id: string;
  name: string;
  birthDate?: string | null;
}

export interface PhotoSearchAssetHit {
  id: string;
  originalFileName?: string;
  localDateTime?: string;
}

export interface QuickReplyAction {
  label: string;
  text: string;
}

export interface PhotoSearchResult {
  kind: "results" | "clarify" | "help" | "empty" | "error" | "confirm";
  message: string;
  assets?: PhotoSearchAssetHit[];
  total?: number;
  /** When kind=clarify and multiple people match — drives LINE Quick Reply. */
  personCandidates?: ImmichPersonSummary[];
  /** Immich web deep-link to view all results (shown when results are truncated). */
  viewAllUrl?: string;
  /** When kind=confirm — plan awaiting user confirmation. */
  plan?: Partial<PhotoSearchPlan>;
  /** When kind=empty — suggested follow-up actions. */
  quickReplyActions?: QuickReplyAction[];
}

export interface MetadataSearchParams {
  personIds?: string[];
  takenAfter?: string;
  takenBefore?: string;
  size?: number;
  page?: number;
}
