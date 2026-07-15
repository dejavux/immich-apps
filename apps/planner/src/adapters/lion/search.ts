/**
 * 雄獅旅遊搜尋 API（官網 SPA 同款）
 * POST https://travel.liontravel.com/search/grouplistinfojson
 */

export type LionSearchParams = {
  keywords: string;
  goDateStart: string; // YYYY-MM-DD
  goDateEnd: string; // YYYY-MM-DD
  travelType?: number; // 0 不限 / 1 團體 / 2 團體自由行
  page?: number;
  pageSize?: number;
  sortType?: number | null; // null = 關聯度（關鍵字預設）
  departureId?: string | null;
  arriveId?: string | null;
};

export type LionNormGroupHit = {
  normGroupId: string;
  tourName: string;
  tourDays: number;
  priceFromTwd: number | null;
  travelType: string;
  tourSource: string;
  status: number;
  tagNames: string[];
  groups: Array<{
    groupId: string;
    goDate: string;
    status: string;
    statusText: string;
    priceFromTwd: number | null;
  }>;
};

export type LionSearchResult = {
  totalCount: number;
  totalPage: number;
  currentPage: number;
  count: number;
  hits: LionNormGroupHit[];
};

const SEARCH_URL =
  "https://travel.liontravel.com/search/grouplistinfojson";

function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeDateInput(raw: string): string {
  const m = raw.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!m) {
    throw new Error(`日期格式須為 YYYY-MM-DD 或 YYYY/MM/DD，收到：${raw}`);
  }
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

type RawNormGroup = {
  NormGroupID?: string;
  TourName?: string;
  TourDays?: number;
  GroupStraightPrice?: string;
  TravelType?: string;
  TourSource?: string;
  Status?: number;
  TagList?: Array<{ TagName?: string }>;
  GroupList?: Array<{
    GroupID?: string;
    GoDate?: string;
    Status?: string;
    StatusText?: string;
    StraightLowestPrice?: string;
  }>;
};

type RawResponse = {
  TotalCount?: number;
  TotalPage?: number;
  CurrentPage?: number;
  Count?: number;
  NormGroupList?: RawNormGroup[];
};

export function buildSearchBody(params: LionSearchParams): Record<string, unknown> {
  return {
    ArriveID: params.arriveId ?? null,
    // 官網前端欄位名為 GoDatestart（小寫 s）；勿同時再送 GoDateStart，會 500
    GoDatestart: normalizeDateInput(params.goDateStart),
    GoDateEnd: normalizeDateInput(params.goDateEnd),
    GroupID: null,
    Keywords: params.keywords,
    IsEnsureGroup: null,
    IsSold: null,
    ThemeID: null,
    TravelPavilionGroupID: null,
    KeywordsCity: null,
    TravelType: params.travelType ?? 0,
    BuIDs: null,
    PreferAirlines: null,
    DepartureID: params.departureId ?? null,
    WeekDay: "",
    PriceList: null,
    AirlineIDs: null,
    TripTypes: "",
    Tags: "",
    SortType: params.sortType === undefined ? null : params.sortType,
    Days: "",
    Page: params.page ?? 1,
    PageSize: params.pageSize ?? 20,
  };
}

function mapHit(raw: RawNormGroup): LionNormGroupHit {
  const groups = (raw.GroupList ?? []).map((g) => ({
    groupId: g.GroupID ?? "",
    goDate: g.GoDate ?? "",
    status: g.Status ?? "",
    statusText: g.StatusText ?? "",
    priceFromTwd: parsePrice(g.StraightLowestPrice),
  }));
  return {
    normGroupId: raw.NormGroupID ?? "",
    tourName: raw.TourName ?? "",
    tourDays: raw.TourDays ?? 0,
    priceFromTwd: parsePrice(raw.GroupStraightPrice) ?? groups[0]?.priceFromTwd ?? null,
    travelType: raw.TravelType ?? "",
    tourSource: raw.TourSource ?? "",
    status: raw.Status ?? 0,
    tagNames: (raw.TagList ?? [])
      .map((t) => t.TagName)
      .filter((x): x is string => Boolean(x)),
    groups,
  };
}

export async function searchLionGroupList(
  params: LionSearchParams,
): Promise<LionSearchResult> {
  const body = buildSearchBody(params);
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json;charset=UTF-8",
      Origin: "https://travel.liontravel.com",
      Referer: `https://travel.liontravel.com/search?Keywords=${encodeURIComponent(params.keywords)}&GoDateStart=${encodeURIComponent(normalizeDateInput(params.goDateStart))}&GoDateEnd=${encodeURIComponent(normalizeDateInput(params.goDateEnd))}&TravelType=${params.travelType ?? 0}&Platform=APP`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lion search HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as RawResponse;
  return {
    totalCount: data.TotalCount ?? 0,
    totalPage: data.TotalPage ?? 0,
    currentPage: data.CurrentPage ?? params.page ?? 1,
    count: data.Count ?? 0,
    hits: (data.NormGroupList ?? []).map(mapHit),
  };
}

/** 多頁抓取（預設最多 3 頁，避免一次打爆） */
export async function searchLionGroupListAll(
  params: LionSearchParams & { maxPages?: number },
): Promise<LionSearchResult> {
  const pageSize = params.pageSize ?? 20;
  const maxPages = params.maxPages ?? 3;
  const first = await searchLionGroupList({ ...params, page: 1, pageSize });
  const pages = Math.min(first.totalPage || 1, maxPages);
  const hits = [...first.hits];

  for (let page = 2; page <= pages; page += 1) {
    const next = await searchLionGroupList({ ...params, page, pageSize });
    hits.push(...next.hits);
  }

  return {
    ...first,
    count: hits.length,
    hits,
  };
}

export function detailUrl(normGroupId: string, groupId: string): string {
  return `https://travel.liontravel.com/detail?NormGroupID=${encodeURIComponent(normGroupId)}&GroupID=${encodeURIComponent(groupId)}`;
}

/** GoDate YYYY/MM/DD + days → return date YYYY/MM/DD */
export function addTourDays(goDate: string, tourDays: number): string | null {
  const m = goDate.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!m || !tourDays) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  dt.setUTCDate(dt.getUTCDate() + Math.max(tourDays - 1, 0));
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}/${mo}/${d}`;
}
