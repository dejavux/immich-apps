import type { DayPlan, HotelStay, TourSummary } from "@family-memories/planner-schema";

import { finalizeTour } from "./normalize.js";
import type { TourExtractAdapter } from "../types.js";

const DETAIL_BASE = "https://travel.liontravel.com/detail";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type TravelInfoResponse = {
  GoAirline?: string;
  GoDepartureTime?: string;
  GoArriveTime?: string;
  GoDepartureAirport?: string;
  GoArriveAirport?: string;
  BackAirline?: string;
  BackDepartureTime?: string;
  BackArriveTime?: string;
  BackDepartureAirport?: string;
  BackArriveAirport?: string;
  GroupInfo?: {
    TourName?: string;
    NormGroupID?: string;
    GroupID?: string;
    TourDays?: number;
    GoDate?: string;
    BackDate?: string;
    StraightLowestPrice?: number;
    TagList?: Array<{ TagName?: string }>;
    Status?: number;
  };
};

type DayTripResponse = {
  DailyList?: Array<{
    Day?: number;
    TravelPoint?: string;
    HotelDesc?: string;
    AttractionsList?: Array<{ Name?: string }>;
  }>;
};

export function parseLionDetailUrl(url: URL): { normGroupId: string; groupId: string } | null {
  if (!/liontravel\.com$/i.test(url.hostname)) {
    return null;
  }
  if (!url.pathname.toLowerCase().includes("/detail")) {
    return null;
  }
  const normGroupId =
    url.searchParams.get("NormGroupID") ??
    url.searchParams.get("normgroupid") ??
    "";
  const groupId =
    url.searchParams.get("GroupID") ?? url.searchParams.get("groupid") ?? "";
  if (!normGroupId || !groupId) {
    return null;
  }
  return { normGroupId, groupId };
}

function airportToIata(name: string | undefined): string {
  if (!name) return "";
  if (/桃園|TPE/i.test(name)) return "TPE";
  if (/高雄|KHH/i.test(name)) return "KHH";
  if (/台中|RMQ|清泉崗/i.test(name)) return "RMQ";
  if (/濟州|CJU/i.test(name)) return "CJU";
  return name.slice(0, 8);
}

function parsePrice(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHighlights(day: NonNullable<DayTripResponse["DailyList"]>[number]): string[] {
  const fromAttractions = (day.AttractionsList ?? [])
    .map((a) => a.Name?.trim())
    .filter((x): x is string => Boolean(x));
  if (fromAttractions.length) return fromAttractions;
  const point = stripHtml(day.TravelPoint ?? "");
  return point
    .split(/[、,，+]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 40)
    .slice(0, 8);
}

function parseHotelsFromDaily(daily: NonNullable<DayTripResponse["DailyList"]>): HotelStay[] {
  const stays: HotelStay[] = [];
  for (const day of daily ?? []) {
    const desc = stripHtml(day.HotelDesc ?? "");
    if (!desc || desc === "X" || /溫暖的家|溫馨的家/.test(desc)) continue;
    const guaranteed = /保證|五星|萬豪|神話/.test(desc);
    const names = desc
      .replace(/或同級.*$/, "")
      .split(/或|\/|、/)
      .map((s) => s.trim())
      .filter(Boolean);
    stays.push({
      nights: 1,
      names: names.length ? names : [desc.slice(0, 60)],
      note: desc,
      guaranteed,
    });
  }
  return mergeAdjacentHotels(stays);
}

function mergeAdjacentHotels(stays: HotelStay[]): HotelStay[] {
  if (!stays.length) return [];
  const merged: HotelStay[] = [{ ...stays[0], nights: 1 }];
  for (let i = 1; i < stays.length; i += 1) {
    const prev = merged[merged.length - 1];
    const cur = stays[i];
    if (prev.names.join("|") === cur.names.join("|") && prev.guaranteed === cur.guaranteed) {
      prev.nights += 1;
      continue;
    }
    merged.push({ ...cur, nights: 1 });
  }
  return merged;
}

async function postDetailJson<T>(endpoint: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`${DETAIL_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json;charset=UTF-8",
      Origin: "https://travel.liontravel.com",
      Referer: `https://travel.liontravel.com/detail?NormGroupID=${encodeURIComponent(body.NormGroupID)}&GroupID=${encodeURIComponent(body.GroupID)}&Platform=APP`,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lion ${endpoint} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function extractLionTour(url: URL): Promise<TourSummary> {
  const ids = parseLionDetailUrl(url);
  if (!ids) {
    throw new Error("無法解析雄獅詳情 URL（需要 NormGroupID 與 GroupID）");
  }

  const body = { NormGroupID: ids.normGroupId, GroupID: ids.groupId };
  const [travel, dayTrip] = await Promise.all([
    postDetailJson<TravelInfoResponse>("travelinfojson", body),
    postDetailJson<DayTripResponse>("daytripinfojson", body),
  ]);

  const group = travel.GroupInfo;
  if (!group?.TourName || !group.GroupID) {
    throw new Error("雄獅詳情回應缺少 GroupInfo");
  }

  const departDate = group.GoDate?.replace(/\//g, "-") ?? null;
  const returnDate = group.BackDate?.replace(/\//g, "-") ?? null;
  const daily = dayTrip.DailyList ?? [];
  const dayPlans: DayPlan[] = daily.map((d) => ({
    day: d.Day ?? 0,
    highlights: parseHighlights(d),
  }));
  const hotels = parseHotelsFromDaily(daily);
  const highlights = dayPlans.flatMap((d) => d.highlights).slice(0, 12);
  const tagNames = (group.TagList ?? [])
    .map((t) => t.TagName)
    .filter((x): x is string => Boolean(x));

  const extractedAt = new Date().toISOString();
  const sourceUrl = url.toString();

  return finalizeTour({
    agency: "lion",
    groupId: group.GroupID,
    officialTitle: group.TourName,
    days: group.TourDays ?? daily.length,
    departDate,
    returnDate,
    priceFromTwd: parsePrice(group.StraightLowestPrice),
    statusText: group.Status != null ? String(group.Status) : null,
    flights: {
      outbound: {
        date: group.GoDate ?? null,
        airline: travel.GoAirline ?? null,
        departTime: travel.GoDepartureTime ?? null,
        arriveTime: travel.GoArriveTime ?? null,
        from: airportToIata(travel.GoDepartureAirport),
        to: airportToIata(travel.GoArriveAirport),
      },
      inbound: {
        date: group.BackDate ?? null,
        airline: travel.BackAirline ?? null,
        departTime: travel.BackDepartureTime ?? null,
        arriveTime: travel.BackArriveTime ?? null,
        from: airportToIata(travel.BackDepartureAirport),
        to: airportToIata(travel.BackArriveAirport),
      },
    },
    hotels,
    highlights: highlights.length ? highlights : tagNames,
    dayPlans,
    familyNotes: [],
    sourceUrl,
    extractedAt,
    id: `lion:${group.GroupID}`,
  });
}

export const lionExtractAdapter: TourExtractAdapter = {
  agency: "lion",
  canHandle(url: URL): boolean {
    return parseLionDetailUrl(url) !== null;
  },
  extract(url: URL): Promise<TourSummary> {
    return extractLionTour(url);
  },
};
