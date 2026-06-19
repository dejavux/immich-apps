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
- personNames: string[]  人物暱稱/姓名（勿把「不」或地名併入人名；「小蕊不在台灣」→ personNames=["小蕊"]；「找在日本的照片」→ personNames=[]）
- ageYears: number|null   年齡（7歲 → 7，一歲半 → 1.5）；年齡不是 sceneQuery
- ageMonths: number|null  月齡（優先於 ageYears 若兩者皆有）
- dateFrom: string|null    YYYY-MM-DD 起始拍攝日
- dateTo: string|null      YYYY-MM-DD 結束拍攝日
- birthDate: string|null   使用者提供的生日 YYYY-MM-DD
- personChoice: number|null  使用者選擇的人物編號（1-based）
- country: string|null   拍攝國家（英文，如 Japan / South Korea / Norway；台灣→"Taiwan, Province of China"；無地名→null）
- city: string|null      拍攝城市（英文，如 Tokyo / Taipei；無→null）
- sceneQuery: string|null    非地名的場景/行為/穿著（海邊、吃飯、穿裙子、國外、不在台灣）；若只有地名則 sceneQuery=null
- sceneQueryEn: string|null  給 Immich CLIP 的英文關鍵字（只在 sceneQuery 非 null 時填）

重要：有地名時優先填 country/city，sceneQuery 僅保留非地名部分。

範例：
使用者「找小蕊7歲的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":7,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"country":null,"city":null,"sceneQuery":null,"sceneQueryEn":null}

使用者「找小蕊穿裙子的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"country":null,"city":null,"sceneQuery":"穿裙子","sceneQueryEn":"wearing dress skirt girl"}

使用者「找小蕊在日本的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"country":"Japan","city":null,"sceneQuery":null,"sceneQueryEn":null}

使用者「找在日本的照片」（純地點，無人物）→
{"intent":"search_photos","personNames":[],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"country":"Japan","city":null,"sceneQuery":null,"sceneQueryEn":null}

使用者「找小蕊在日本海邊的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"country":"Japan","city":null,"sceneQuery":"海邊","sceneQueryEn":"beach ocean seaside japan"}

使用者「找小蕊在國外的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"country":null,"city":null,"sceneQuery":"國外","sceneQueryEn":"abroad overseas foreign country travel"}

使用者「找小蕊不在台灣的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"country":null,"city":null,"sceneQuery":"不在台灣","sceneQueryEn":"abroad overseas foreign travel not Taiwan"}

使用者「找在海邊的照片」（純場景，無人物）→
{"intent":"search_photos","personNames":[],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"country":null,"city":null,"sceneQuery":"海邊","sceneQueryEn":"beach ocean seaside"}

使用者「找跳舞的照片」→
{"intent":"search_photos","personNames":[],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"country":null,"city":null,"sceneQuery":"跳舞","sceneQueryEn":"dancing dance performance"}

使用者「2」且前文在選人物 →
{"intent":"search_photos","personNames":[],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":2,"country":null,"city":null,"sceneQuery":null,"sceneQueryEn":null}`;
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
  if (plan.country) {
    parts.push(`國家：${plan.country}`);
  }
  if (plan.city) {
    parts.push(`城市：${plan.city}`);
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
  country?: string | null;
  city?: string | null;
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
    country: raw.country ?? undefined,
    city: raw.city ?? undefined,
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

/**
 * Maps Chinese location keywords to Immich country names (from reverse geocoding).
 * The values must match what Immich stores in exifInfo.country.
 */
export const COUNTRY_LOOKUP: Array<[RegExp, string]> = [
  [/台灣|臺灣/, "Taiwan, Province of China"],
  [/日本/, "Japan"],
  [/韓國|南韓|首爾/, "South Korea"],
  [/挪威/, "Norway"],
  [/新加坡/, "Singapore"],
  [/美國|紐約|洛杉磯|舊金山/, "United States"],
  [/英國|倫敦/, "United Kingdom"],
  [/法國|巴黎/, "France"],
  [/德國/, "Germany"],
  [/義大利|羅馬|威尼斯/, "Italy"],
  [/澳洲|雪梨/, "Australia"],
  [/泰國|曼谷/, "Thailand"],
  [/香港/, "Hong Kong"],
  [/中國|北京|上海/, "China"],
];

/**
 * Maps Chinese city keywords to Immich city names.
 */
export const CITY_LOOKUP: Array<[RegExp, string]> = [
  [/台北|臺北/, "Taipei"],
  [/台中|臺中/, "Taichung"],
  [/高雄/, "Kaohsiung"],
  [/東京/, "Tokyo"],
  [/大阪/, "Osaka"],
  [/京都/, "Kyoto"],
  [/首爾/, "Seoul"],
  [/釜山/, "Busan"],
  [/新加坡市/, "Singapore"],
  [/香港/, "Hong Kong"],
  [/奧斯陸/, "Oslo"],
];

/**
 * Tries to extract a country or city from a Chinese location phrase.
 * Returns the matched Immich country/city names, or undefined if nothing matches.
 */
export function extractLocationFromQuery(query: string): {
  country?: string;
  city?: string;
} {
  const result: { country?: string; city?: string } = {};
  for (const [pattern, cityName] of CITY_LOOKUP) {
    if (pattern.test(query)) {
      result.city = cityName;
      break;
    }
  }
  for (const [pattern, countryName] of COUNTRY_LOOKUP) {
    if (pattern.test(query)) {
      result.country = countryName;
      break;
    }
  }
  return result;
}

/**
 * Returns true if the query string represents a known (positive) country/city location.
 * Negative phrases like "不在台灣" are excluded and should remain as CLIP scene queries.
 */
export function isKnownLocation(query: string): boolean {
  const trimmed = query.trim();
  // "不在X" / "非X" / "國外" etc. are negative/relative – do not promote to country filter
  if (
    /^(?:不在|非|不是|不去|沒在)/.test(trimmed) ||
    /國外|海外/.test(trimmed)
  ) {
    return false;
  }
  return (
    COUNTRY_LOOKUP.some(([p]) => p.test(trimmed)) ||
    CITY_LOOKUP.some(([p]) => p.test(trimmed))
  );
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
  [/跳舞|舞蹈/, "dancing dance performance"],
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

  const scene = withCleanScene.sceneQuery ?? "";

  // When sceneQuery is a pure known location, promote to country/city filter
  // instead of using it as a CLIP scene query.
  if (isKnownLocation(scene)) {
    const { country, city } = extractLocationFromQuery(scene);
    return {
      ...withCleanScene,
      country: withCleanScene.country ?? country,
      city: withCleanScene.city ?? city,
      sceneQuery: undefined,
      sceneQueryEn: undefined,
    };
  }

  if (withCleanScene.sceneQueryEn?.trim()) {
    return withCleanScene;
  }

  return {
    ...withCleanScene,
    sceneQueryEn: translateSceneQueryFallback(scene),
  };
}

/**
 * Attempt to parse a standalone activity / scene without 照片 suffix.
 * e.g. "找跳舞的", "找跳舞的影片" → { sceneQuery: "跳舞" }
 */
function tryParseActivityOnly(
  text: string,
): { sceneQuery: string } | undefined {
  const trimmed = text.trim();
  const match = trimmed.match(
    new RegExp(`^${SEARCH_PREFIX}(${ACTIVITY_WORDS})(?:的|影片|video)?$`, "i"),
  );
  if (match) {
    return { sceneQuery: match[1] };
  }
  return undefined;
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

  // Activity without 照片 suffix (e.g. "找跳舞的")
  const activityOnly = tryParseActivityOnly(working);
  if (activityOnly) {
    const plan: PhotoSearchPlan = {
      intent: "search_photos",
      personNames: [],
      sceneQuery: activityOnly.sceneQuery,
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
    const sceneText = cleanScenePhrase(sceneMatch[1]);
    const { country, city } = extractLocationFromQuery(sceneText);
    const plan: PhotoSearchPlan = {
      intent: "search_photos",
      personNames: [],
      ...(country || city ? { country, city } : { sceneQuery: sceneText }),
    };
    if (rel) {
      plan.dateFrom = rel.dateFrom;
      plan.dateTo = rel.dateTo;
      plan.dateRangeLabel = rel.label;
    }
    return country || city ? plan : ensureSceneQueryEn(plan);
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
    const cleanedName = rawName ? cleanPersonName(rawName) : "";
    const plan: PhotoSearchPlan = {
      intent: "search_photos",
      // Guard: do not use stopwords or location names as person names
      personNames:
        cleanedName &&
        !isPersonStopword(cleanedName) &&
        !isKnownLocation(cleanedName)
          ? [cleanedName]
          : [],
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
