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
- personNames: string[]  人物暱稱/姓名
- ageYears: number|null   年齡（可小數，1.5 = 一歲半）
- ageMonths: number|null  月齡（優先於 ageYears 若兩者皆有）
- dateFrom: string|null    YYYY-MM-DD 起始拍攝日
- dateTo: string|null      YYYY-MM-DD 結束拍攝日
- birthDate: string|null   使用者提供的生日 YYYY-MM-DD
- personChoice: number|null  使用者選擇的人物編號（1-based）
- sceneQuery: string|null    場景描述（使用者語言），例如「在海邊」「生日蛋糕」
- sceneQueryEn: string|null  給 Immich CLIP 的英文關鍵字，例如 beach ocean sunset

範例：
使用者「幫我找小蕊一歲半的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":1.5,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"sceneQuery":null,"sceneQueryEn":null}

使用者「找在海邊的照片」→
{"intent":"search_photos","personNames":[],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"sceneQuery":"在海邊","sceneQueryEn":"beach ocean seaside"}

使用者「小蕊在海邊一歲半的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":1.5,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":null,"sceneQuery":"在海邊","sceneQueryEn":"beach ocean"}

使用者「找找小蕊今年在學校的照片」→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":null,"ageMonths":null,"dateFrom":"${year}-01-01","dateTo":"${today}","birthDate":null,"personChoice":null,"sceneQuery":"學校","sceneQueryEn":"school classroom campus"}

使用者「生日 2019-03-15」（前文在找小蕊）→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":1.5,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":"2019-03-15","personChoice":null}

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

const SCENE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/海邊|海灘|沙灘|海邊/, "beach ocean seaside"],
  [/山|登山|爬山/, "mountain hiking"],
  [/生日|慶生|蛋糕/, "birthday party cake"],
  [/吃飯|用餐|餐廳|美食/, "dining restaurant food"],
  [/公園|遊樂/, "park playground"],
  [/游泳|泳池/, "swimming pool"],
  [/雪|滑雪|冬天/, "snow winter"],
  [/婚禮|結婚/, "wedding ceremony"],
  [/貓|喵/, "cat pet"],
  [/狗|汪/, "dog pet"],
  [/花|櫻/, "flowers blossom"],
  [/夕陽|日落/, "sunset golden hour"],
  [/學校|校園|教室|補習/, "school classroom campus"],
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
  if (!plan.sceneQuery?.trim()) {
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

  const personSceneMatch = working.match(
    /(?:找|搜|查)+(?:找)?(?:我)?(.{1,10}?)在(.+?)(?:的)?(?:照片|相片|圖)/,
  );
  if (personSceneMatch) {
    const person = personSceneMatch[1].replace(/的$/, "").trim();
    const scene = cleanScenePhrase(personSceneMatch[2]);
    const plan: PhotoSearchPlan = {
      intent: "search_photos",
      personNames: person ? [person] : [],
      sceneQuery: scene,
    };
    if (rel) {
      plan.dateFrom = rel.dateFrom;
      plan.dateTo = rel.dateTo;
      plan.dateRangeLabel = rel.label;
    }
    return ensureSceneQueryEn(plan);
  }

  const personAgeMatch = working.match(
    /(?:找|搜|查).*?([^\d\s，,、的]{1,8}?)(?:的)?(?:大約|約)?(\d+(?:\.\d+)?)\s*歲/,
  );
  if (personAgeMatch) {
    return {
      intent: "search_photos",
      personNames: [personAgeMatch[1].trim()],
      ageYears: Number.parseFloat(personAgeMatch[2]),
    };
  }

  const personHalfYearMatch = trimmed.match(/(?:找|搜|查)(?:我)?(.+?)一歲半/);
  if (personHalfYearMatch) {
    const name = personHalfYearMatch[1].replace(/的.*$/, "").trim();
    return ensureSceneQueryEn({
      intent: "search_photos",
      personNames: [name],
      ageYears: 1.5,
    });
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
    const plan: PhotoSearchPlan = {
      intent: "search_photos",
      personNames: nameMatch ? [nameMatch[1].replace(/的$/, "").trim()] : [],
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
