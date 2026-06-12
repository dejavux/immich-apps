import type { PhotoSearchPlan } from "../../shared/types/photo-search";
import {
  detectRelativeDateInText,
  stripRelativeDateTokens,
} from "../../shared/date-range";

export function buildPhotoSearchSystemPrompt(now = new Date()): string {
  const today = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  return `你是 Immich 照片庫 LINE Bot 的搜尋助手。使用者用繁體中文描述想找的照片。
你只輸出 JSON，不要 markdown，不要解釋。

今天日期：${today}
相對日期請轉成 dateFrom/dateTo（YYYY-MM-DD）：
- 今年 → ${year}-01-01 ～ ${today}
- 去年 → ${year - 1}-01-01 ～ ${year - 1}-12-31
- 本月/這個月 → 當月 1 日 ～ ${today}
- 上個月 → 上個完整曆月

intent 取值：
- search_photos：找照片（含補充生日、選擇人物編號）
- upload_help：問如何上傳、使用方式
- cancel：取消搜尋
- unknown：無法理解

欄位（缺省用 null）：
- personNames: string[]  人物暱稱/姓名（勿把「不」併入人名；「小蕊不在台灣」→ personNames=["小蕊"]）
- ageYears: number|null   年齡（7歲 → 7，一歲半 → 1.5）；年齡不是 sceneQuery
- ageMonths: number|null  月齡（優先於 ageYears 若兩者皆有）
- dateFrom: string|null    YYYY-MM-DD 起始拍攝日
- dateTo: string|null      YYYY-MM-DD 結束拍攝日
- birthDate: string|null   使用者提供的生日 YYYY-MM-DD
- personChoice: number|null  使用者選擇的人物編號（1-based）
- sceneQuery: string|null    場景/行為/穿著/地點（海邊、吃飯、穿裙子、國外、不在台灣）
- sceneQueryEn: string|null  給 Immich CLIP 的英文關鍵字

範例：
使用者「找小蕊7歲的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":7,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"sceneQuery":null,"sceneQueryEn":null}

使用者「找小蕊穿裙子的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"sceneQuery":"穿裙子","sceneQueryEn":"wearing dress skirt girl"}

使用者「找小蕊在國外的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"sceneQuery":"國外","sceneQueryEn":"abroad overseas foreign country travel"}

使用者「找小蕊不在台灣的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"sceneQuery":"不在台灣","sceneQueryEn":"abroad overseas foreign travel not Taiwan"}

使用者「小蕊在吃飯的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"sceneQuery":"吃飯","sceneQueryEn":"eating meal food dining"}

使用者「找在海邊的照片」（純場景，無人物）→
{"intent":"search_photos","personNames":[],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"sceneQuery":"海邊","sceneQueryEn":"beach ocean seaside"}

使用者「2」且前文在選人物 →
{"intent":"search_photos","personNames":[],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":2}`;
}

/** @deprecated use buildPhotoSearchSystemPrompt() */
export const PHOTO_SEARCH_SYSTEM_PROMPT = buildPhotoSearchSystemPrompt();

export function buildSearchUserPrompt(params: {
  message: string;
  sessionSummary?: string;
}): string {
  if (params.sessionSummary) {
    return `【進行中的搜尋上下文】\n${params.sessionSummary}\n\n【使用者最新訊息】\n${params.message}`;
  }
  return params.message;
}

export function summarizeSessionForPrompt(session: {
  plan: Partial<PhotoSearchPlan>;
  personCandidates?: Array<{ name: string; birthDate?: string | null }>;
}): string {
  const parts: string[] = [];
  const plan = session.plan;
  if (plan.personNames?.length) {
    parts.push(`人物：${plan.personNames.join("、")}`);
  }
  if (plan.ageYears !== undefined) {
    parts.push(`年齡：${plan.ageYears} 歲`);
  }
  if (plan.ageMonths !== undefined) {
    parts.push(`月齡：${plan.ageMonths} 個月`);
  }
  if (plan.birthDate) {
    parts.push(`已知生日：${plan.birthDate}`);
  }
  if (plan.dateFrom) {
    parts.push(`日期起：${plan.dateFrom}`);
  }
  if (plan.dateTo) {
    parts.push(`日期迄：${plan.dateTo}`);
  }
  if (plan.dateRangeLabel) {
    parts.push(`相對日期：${plan.dateRangeLabel}`);
  }
  if (plan.sceneQuery) {
    parts.push(`場景：${plan.sceneQuery}`);
  }
  if (session.personCandidates?.length) {
    const list = session.personCandidates
      .map(
        (p, i) =>
          `${i + 1}. ${p.name}${p.birthDate ? `（生日 ${p.birthDate}）` : "（無生日）"}`,
      )
      .join("\n");
    parts.push(`待選人物：\n${list}`);
  }
  return parts.join("\n");
}

export interface RawLlmSearchResponse {
  intent?: string;
  personNames?: string[] | null;
  ageYears?: number | null;
  ageMonths?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  birthDate?: string | null;
  personChoice?: number | null;
  sceneQuery?: string | null;
  sceneQueryEn?: string | null;
}

export function parseLlmSearchResponse(
  raw: RawLlmSearchResponse,
): PhotoSearchPlan {
  const intent = normalizeIntent(raw.intent);
  const plan: PhotoSearchPlan = {
    intent,
    personNames: (raw.personNames ?? []).filter(Boolean),
    ageYears: raw.ageYears ?? undefined,
    ageMonths: raw.ageMonths ?? undefined,
    dateFrom: raw.dateFrom ?? undefined,
    dateTo: raw.dateTo ?? undefined,
    birthDate: raw.birthDate ?? undefined,
    personChoice: raw.personChoice ?? undefined,
    sceneQuery: raw.sceneQuery ?? undefined,
    sceneQueryEn: raw.sceneQueryEn ?? undefined,
  };
  return ensureSceneQueryEn(plan);
}

export function ensureRelativeDatesFromText(
  plan: PhotoSearchPlan,
  message: string,
  now: Date = new Date(),
): PhotoSearchPlan {
  if (plan.dateFrom) {
    if (!plan.dateRangeLabel) {
      const rel = detectRelativeDateInText(message, now);
      if (rel && rel.dateFrom === plan.dateFrom) {
        return { ...plan, dateRangeLabel: rel.label };
      }
    }
    return plan;
  }
  const rel = detectRelativeDateInText(message, now);
  if (!rel) {
    return plan;
  }
  return {
    ...plan,
    dateFrom: rel.dateFrom,
    dateTo: rel.dateTo,
    dateRangeLabel: rel.label,
  };
}

function cleanScenePhrase(value: string): string {
  return stripRelativeDateTokens(value)
    .replace(/^在|於/, "")
    .trim();
}

function normalizeIntent(value: string | undefined): PhotoSearchPlan["intent"] {
  if (
    value === "search_photos" ||
    value === "upload_help" ||
    value === "cancel" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function cleanPersonName(name: string): string {
  return name
    .replace(/^(?:幫|我|找|搜|查)+/, "")
    .replace(/的$/, "")
    .trim();
}

function isAgePhrase(text: string): boolean {
  const trimmed = text.trim();
  return (
    /^\d+(?:\.\d+)?\s*歲?$/.test(trimmed) ||
    trimmed.includes("歲半") ||
    trimmed === "半歲"
  );
}

const SEARCH_PREFIX = "(?:幫)?(?:我)?(?:找|搜|查+)+(?:找)?";
const PHOTO_SUFFIX = "(?:的)?(?:照片|相片|圖)$";

/** 不可當 Immich 人物名的中文片段（介系詞 / 助詞） */
const PERSON_STOPWORDS = new Set(["在", "有", "是", "於", "的"]);

function isPersonStopword(name: string): boolean {
  return PERSON_STOPWORDS.has(name.trim());
}

export function tryParseSceneOnlyPhoto(
  text: string,
): { sceneQuery: string } | undefined {
  const trimmed = text.trim();

  if (tryParsePersonAge(trimmed) || tryParsePersonScenePhoto(trimmed)) {
    return undefined;
  }

  const atScene = trimmed.match(
    new RegExp(`^${SEARCH_PREFIX}在(.+?)${PHOTO_SUFFIX}$`),
  );
  if (atScene) {
    const scene = cleanScenePhrase(atScene[1]);
    if (scene && !isAgePhrase(scene)) {
      return { sceneQuery: scene };
    }
  }

  return undefined;
}

export function sanitizeSearchPlan(
  plan: PhotoSearchPlan,
  message: string,
): PhotoSearchPlan {
  const sceneOnly = tryParseSceneOnlyPhoto(message);
  if (sceneOnly) {
    return ensureSceneQueryEn({
      ...plan,
      intent: plan.intent === "unknown" ? "search_photos" : plan.intent,
      personNames: [],
      sceneQuery: sceneOnly.sceneQuery,
      sceneQueryEn: undefined,
    });
  }

  const names = plan.personNames?.filter(Boolean) ?? [];
  if (
    names.length === 1 &&
    isPersonStopword(names[0]) &&
    plan.sceneQuery?.trim()
  ) {
    return ensureSceneQueryEn({ ...plan, personNames: [] });
  }

  return plan;
}

export function tryParsePersonAge(
  text: string,
): { personNames: string[]; ageYears: number } | undefined {
  const trimmed = text.trim();

  const halfMatch = trimmed.match(
    new RegExp(`^${SEARCH_PREFIX}(.{1,10}?)一歲半${PHOTO_SUFFIX}`),
  );
  if (halfMatch) {
    const person = cleanPersonName(halfMatch[1]);
    if (person) {
      return { personNames: [person], ageYears: 1.5 };
    }
  }

  const patterns = [
    new RegExp(
      `^${SEARCH_PREFIX}(.{1,10}?)(?:的)?(?:大約|約)?(\\d+(?:\\.\\d+)?)\\s*歲`,
    ),
    new RegExp(
      `^(.{1,10}?)(?:的)?(?:大約|約)?(\\d+(?:\\.\\d+)?)\\s*歲${PHOTO_SUFFIX}`,
    ),
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match) {
      continue;
    }
    const person = cleanPersonName(match[1]);
    const age = Number.parseFloat(match[2]);
    if (person && Number.isFinite(age)) {
      return { personNames: [person], ageYears: age };
    }
  }
  return undefined;
}

export function ensureAgeFromText(
  plan: PhotoSearchPlan,
  message: string,
): PhotoSearchPlan {
  const parsed = tryParsePersonAge(message);
  if (!parsed) {
    return plan;
  }

  const sceneLooksLikeAge =
    plan.sceneQuery?.trim() && isAgePhrase(plan.sceneQuery);

  return {
    ...plan,
    intent: plan.intent === "unknown" ? "search_photos" : plan.intent,
    personNames: plan.personNames?.length
      ? plan.personNames
      : parsed.personNames,
    ageYears: parsed.ageYears,
    ...(sceneLooksLikeAge
      ? { sceneQuery: undefined, sceneQueryEn: undefined }
      : {}),
  };
}

const ACTIVITY_WORDS =
  "吃飯|用餐|進食|睡覺|午睡|玩耍|遊玩|游泳|跑步|讀書|看書|唱歌|跳舞|刷牙|洗澡|畫畫|寫字|騎車|開車|坐車|搭車|看電視";

function buildPersonScenePatterns(): RegExp[] {
  return [
    // 找小蕊不在台灣的照片（必須早於「在」模式）
    new RegExp(`^${SEARCH_PREFIX}(.{1,8}?)不在(.+?)${PHOTO_SUFFIX}`),
    new RegExp(`^(.{1,8}?)不在(.+?)${PHOTO_SUFFIX}`),
    new RegExp(`^${SEARCH_PREFIX}(.{1,8}?)(?<!不)在(.+?)${PHOTO_SUFFIX}`),
    new RegExp(`^(.{1,8}?)(?<!不)在(.+?)${PHOTO_SUFFIX}`),
    new RegExp(`^${SEARCH_PREFIX}(.{1,8}?)(穿|戴)(.+?)${PHOTO_SUFFIX}`),
    new RegExp(`^(.{1,8}?)(穿|戴)(.+?)${PHOTO_SUFFIX}`),
    new RegExp(`^${SEARCH_PREFIX}(.{1,8}?)(${ACTIVITY_WORDS})${PHOTO_SUFFIX}`),
    new RegExp(`^(.{1,8}?)(${ACTIVITY_WORDS})${PHOTO_SUFFIX}`),
    new RegExp(
      `^${SEARCH_PREFIX}(.{1,8}?)([^在的照片\\d\\s][^的照片]{1,18}?)${PHOTO_SUFFIX}`,
    ),
  ];
}

export function tryParsePersonScenePhoto(
  text: string,
): { personNames: string[]; sceneQuery: string } | undefined {
  const trimmed = text.trim();

  if (tryParsePersonAge(trimmed)) {
    return undefined;
  }

  for (const pattern of buildPersonScenePatterns()) {
    const match = trimmed.match(pattern);
    if (!match) {
      continue;
    }

    const person = cleanPersonName(match[1]);
    let sceneRaw = match[3] !== undefined ? `${match[2]}${match[3]}` : match[2];
    if (match[2] === "穿" || match[2] === "戴") {
      sceneRaw = `${match[2]}${match[3]}`;
    }

    const scene = pattern.source.includes("不在")
      ? `不在${match[2].trim()}`
      : cleanScenePhrase(sceneRaw);
    if (!person || isPersonStopword(person) || !scene || isAgePhrase(scene)) {
      continue;
    }
    return { personNames: [person], sceneQuery: scene };
  }
  return undefined;
}

export function ensureActivityFromText(
  plan: PhotoSearchPlan,
  message: string,
): PhotoSearchPlan {
  if (plan.ageYears !== undefined || plan.ageMonths !== undefined) {
    return plan;
  }
  if (tryParsePersonAge(message)) {
    return plan;
  }
  if (plan.sceneQuery?.trim() && !isAgePhrase(plan.sceneQuery)) {
    return plan;
  }

  const parsed = tryParsePersonScenePhoto(message);
  if (!parsed) {
    return plan;
  }

  return {
    ...plan,
    intent: plan.intent === "unknown" ? "search_photos" : plan.intent,
    personNames: plan.personNames?.length
      ? plan.personNames
      : parsed.personNames,
    sceneQuery: parsed.sceneQuery,
    sceneQueryEn: undefined,
  };
}

const SCENE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/不在台灣|不是台灣|非台灣/, "abroad overseas foreign travel not Taiwan"],
  [/國外|海外|國外旅行/, "abroad overseas foreign country travel"],
  [/海邊|海灘|沙灘/, "beach ocean seaside"],
  [/山|登山|爬山/, "mountain hiking"],
  [/生日|慶生|蛋糕/, "birthday party cake"],
  [/吃飯|用餐|進食|美食/, "eating meal food dining"],
  [/睡覺|午睡/, "sleeping nap bed"],
  [/玩耍|遊玩/, "playing fun children"],
  [/公園|遊樂/, "park playground"],
  [/游泳|泳池/, "swimming pool"],
  [/雪|滑雪|冬天/, "snow winter"],
  [/婚禮|結婚/, "wedding ceremony"],
  [/貓|喵/, "cat pet"],
  [/狗|汪/, "dog pet"],
  [/花|櫻/, "flowers blossom"],
  [/夕陽|日落/, "sunset golden hour"],
  [/學校|校園|教室|補習/, "school classroom campus"],
  [/讀書|看書/, "reading book study"],
  [/跑步/, "running jogging"],
  [/畫畫|寫字/, "drawing writing art"],
  [/穿裙子|裙子|洋裝|連身裙/, "wearing dress skirt girl"],
  [/穿.*褲/, "wearing pants trousers"],
  [/戴帽子|帽子/, "wearing hat cap"],
  [/眼鏡/, "wearing glasses"],
];

export function translateSceneQueryFallback(sceneQuery: string): string {
  const trimmed = sceneQuery.trim();
  for (const [pattern, english] of SCENE_TRANSLATIONS) {
    if (pattern.test(trimmed)) {
      return english;
    }
  }
  return trimmed;
}

export function ensureSceneQueryEn(plan: PhotoSearchPlan): PhotoSearchPlan {
  if (!plan.sceneQuery?.trim() || isAgePhrase(plan.sceneQuery)) {
    return plan;
  }
  const cleaned = cleanScenePhrase(plan.sceneQuery);
  const withCleanScene =
    cleaned !== plan.sceneQuery ? { ...plan, sceneQuery: cleaned } : plan;
  if (withCleanScene.sceneQueryEn?.trim()) {
    return withCleanScene;
  }
  const scene = withCleanScene.sceneQuery ?? "";
  return {
    ...withCleanScene,
    sceneQueryEn: translateSceneQueryFallback(scene),
  };
}

/** Rule-based fallback when LLM is unavailable. */
export function parseSearchPlanFallback(
  text: string,
  now: Date = new Date(),
): PhotoSearchPlan {
  const trimmed = text.trim();
  if (/^(取消|算了|不用了)/.test(trimmed)) {
    return { intent: "cancel", personNames: [] };
  }
  if (/上傳|怎麼傳|如何使用|help/i.test(trimmed)) {
    return { intent: "upload_help", personNames: [] };
  }

  const rel = detectRelativeDateInText(trimmed, now);
  const working = rel ? stripRelativeDateTokens(trimmed) : trimmed;

  const personAge = tryParsePersonAge(working);
  if (personAge) {
    const plan: PhotoSearchPlan = {
      intent: "search_photos",
      personNames: personAge.personNames,
      ageYears: personAge.ageYears,
    };
    if (rel) {
      plan.dateFrom = rel.dateFrom;
      plan.dateTo = rel.dateTo;
      plan.dateRangeLabel = rel.label;
    }
    return plan;
  }

  const sceneOnly = tryParseSceneOnlyPhoto(working);
  if (sceneOnly) {
    const plan: PhotoSearchPlan = {
      intent: "search_photos",
      personNames: [],
      sceneQuery: sceneOnly.sceneQuery,
    };
    if (rel) {
      plan.dateFrom = rel.dateFrom;
      plan.dateTo = rel.dateTo;
      plan.dateRangeLabel = rel.label;
    }
    return ensureSceneQueryEn(plan);
  }

  const personScene = tryParsePersonScenePhoto(working);
  if (personScene) {
    const plan: PhotoSearchPlan = {
      intent: "search_photos",
      personNames: personScene.personNames,
      sceneQuery: personScene.sceneQuery,
    };
    if (rel) {
      plan.dateFrom = rel.dateFrom;
      plan.dateTo = rel.dateTo;
      plan.dateRangeLabel = rel.label;
    }
    return ensureSceneQueryEn(plan);
  }

  const sceneMatch = working.match(
    /(?:找|搜|查).*?(?:在|有|是)(.+?)(?:的)?(?:照片|相片|圖)/,
  );
  if (sceneMatch) {
    const plan: PhotoSearchPlan = {
      intent: "search_photos",
      personNames: [],
      sceneQuery: cleanScenePhrase(sceneMatch[1]),
    };
    if (rel) {
      plan.dateFrom = rel.dateFrom;
      plan.dateTo = rel.dateTo;
      plan.dateRangeLabel = rel.label;
    }
    return ensureSceneQueryEn(plan);
  }

  const birthMatch = trimmed.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (birthMatch) {
    const y = birthMatch[1];
    const m = birthMatch[2].padStart(2, "0");
    const d = birthMatch[3].padStart(2, "0");
    return {
      intent: "search_photos",
      personNames: [],
      birthDate: `${y}-${m}-${d}`,
    };
  }

  if (/找|搜|查/.test(working) && /照片|相片|圖/.test(working)) {
    const nameMatch = working.match(
      /(?:找|搜|查)+(?:找)?(?:我)?(.{1,10}?)(?:的)?(?:照片|相片|圖)/,
    );
    const rawName = nameMatch ? nameMatch[1].replace(/的$/, "").trim() : "";
    const plan: PhotoSearchPlan = {
      intent: "search_photos",
      personNames: rawName ? [cleanPersonName(rawName)] : [],
    };
    if (rel) {
      plan.dateFrom = rel.dateFrom;
      plan.dateTo = rel.dateTo;
      plan.dateRangeLabel = rel.label;
    }
    return plan;
  }

  return { intent: "unknown", personNames: [] };
}
