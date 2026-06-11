import type { PhotoSearchPlan } from "../../shared/types/photo-search";

export const PHOTO_SEARCH_SYSTEM_PROMPT = `你是 Immich 照片庫 LINE Bot 的搜尋助手。使用者用繁體中文描述想找的照片。
你只輸出 JSON，不要 markdown，不要解釋。

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

使用者「生日 2019-03-15」（前文在找小蕊）→
{"intent":"search_photos","personNames":["小蕊"],"ageYears":1.5,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":"2019-03-15","personChoice":null}

使用者「2」且前文在選人物 →
{"intent":"search_photos","personNames":[],"ageYears":null,"ageMonths":null,"dateFrom":null,"dateTo":null,"birthDate":null,"personChoice":2}`;

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
  if (plan.sceneQueryEn?.trim()) {
    return plan;
  }
  return {
    ...plan,
    sceneQueryEn: translateSceneQueryFallback(plan.sceneQuery),
  };
}

/** Rule-based fallback when LLM is unavailable. */
export function parseSearchPlanFallback(text: string): PhotoSearchPlan {
  const trimmed = text.trim();
  if (/^(取消|算了|不用了)/.test(trimmed)) {
    return { intent: "cancel", personNames: [] };
  }
  if (/上傳|怎麼傳|如何使用|help/i.test(trimmed)) {
    return { intent: "upload_help", personNames: [] };
  }

  const personAgeMatch = trimmed.match(
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

  const sceneMatch = trimmed.match(
    /(?:找|搜|查).*?(?:在|有|是)(.+?)(?:的)?(?:照片|相片|圖)/,
  );
  if (sceneMatch) {
    return ensureSceneQueryEn({
      intent: "search_photos",
      personNames: [],
      sceneQuery: sceneMatch[1].trim(),
    });
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

  if (/找|搜|查/.test(trimmed) && /照片|相片|圖/.test(trimmed)) {
    const nameMatch = trimmed.match(
      /(?:找|搜|查).*?([^\s，,、]{1,8}?)的?(?:照片|相片)/,
    );
    return {
      intent: "search_photos",
      personNames: nameMatch ? [nameMatch[1].trim()] : [],
    };
  }

  return { intent: "unknown", personNames: [] };
}
