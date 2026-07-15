/** 旅行社識別（全社統一） */
export type AgencyId = "lion" | "cola" | "phoenix" | "generic";

export type TourTag =
  | "無購物"
  | "含購物"
  | "彩妝店"
  | "保證五星"
  | "親子設施"
  | "自然景觀"
  | "世界遺產"
  | "主題樂園"
  | "夜間活動"
  | "升等飯店"
  | "高雄出發"
  | "台北出發"
  | "商務飯店"
  | "吃到飽";

export type FlightLeg = {
  date?: string | null;
  airline?: string | null;
  departTime?: string | null;
  arriveTime?: string | null;
  from: string;
  to: string;
  duration?: string | null;
};

export type HotelStay = {
  nights: number;
  names: string[];
  note?: string | null;
  guaranteed?: boolean;
};

export type DayPlan = {
  day: number;
  highlights: string[];
};

/** 旅行社行程摘要（列表可精簡；extract 填滿詳情） */
export type TourSummary = {
  /** 穩定 id，例：lion:26JK801TWJ-T */
  id?: string;
  /** 短團名，例：濟州島-0801-0805 */
  shortName: string;
  /** 官網長標題 */
  officialTitle: string;
  agency: AgencyId;
  groupId: string;
  destination: string;
  days: number;
  departDate: string | null;
  returnDate: string | null;
  priceFromTwd: number | null;
  tags: TourTag[];
  statusText?: string | null;
  flights: { outbound?: FlightLeg; inbound?: FlightLeg };
  hotels: HotelStay[];
  highlights: string[];
  dayPlans: DayPlan[];
  familyNotes: string[];
  sourceUrl: string;
  /** ISO 8601；extract 時填入 */
  extractedAt?: string;
};
