import type { TourSummary, TourTag } from "@family-memories/planner-schema";

const DEST_ALIASES: Array<{ re: RegExp; name: string }> = [
  { re: /濟州/, name: "濟州島" },
  { re: /沖繩|okinawa/i, name: "沖繩" },
  { re: /北海道/, name: "北海道" },
  { re: /大阪|USJ|環球/, name: "大阪" },
  { re: /東京/, name: "東京" },
  { re: /新加坡/, name: "新加坡" },
];

/** YYYY/MM/DD or YYYY-MM-DD → MMDD */
export function toMmDd(date: string | null | undefined): string | null {
  if (!date) return null;
  const m = date.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  return `${m[2].padStart(2, "0")}${m[3].padStart(2, "0")}`;
}

export function inferDestination(title: string, fallback = "行程"): string {
  for (const row of DEST_ALIASES) {
    if (row.re.test(title)) return row.name;
  }
  return fallback;
}

/**
 * 短團名：目的地-出發MMDD-回程MMDD
 * 例：濟州島-0801-0805
 */
export function buildShortName(input: {
  destination?: string;
  officialTitle: string;
  departDate?: string | null;
  returnDate?: string | null;
}): string {
  const dest = input.destination ?? inferDestination(input.officialTitle);
  const depart = toMmDd(input.departDate);
  const ret = toMmDd(input.returnDate);
  if (depart && ret) return `${dest}-${depart}-${ret}`;
  if (depart) return `${dest}-${depart}`;
  return dest;
}

const TAG_RULES: Array<{ tag: TourTag; test: (hay: string) => boolean }> = [
  { tag: "無購物", test: (s) => /無購物/.test(s) },
  { tag: "彩妝店", test: (s) => /\(彩妝\)|一站購物|彩妝店/.test(s) },
  { tag: "含購物", test: (s) => !/無購物/.test(s) && /(購物|彩妝)/.test(s) },
  {
    tag: "保證五星",
    test: (s) =>
      /(?<!無)保證.{0,8}(五星|萬豪|神話)/.test(s) ||
      /升等一晚.{0,6}(五星|神話)/.test(s),
  },
  {
    tag: "升等飯店",
    test: (s) => /升等一晚|保證入住/.test(s) && !/無保證/.test(s),
  },
  {
    tag: "親子設施",
    test: (s) => /史努比|HARIBO|賽車|鐵道自行車|小火車|主題|親子/.test(s),
  },
  {
    tag: "自然景觀",
    test: (s) => /漢拏|城山|牛島|柱狀節理|瀑布|岬|火山|樹木園|林蔭/.test(s),
  },
  { tag: "世界遺產", test: (s) => /UNESCO|世界自然遺產|世界遺產/.test(s) },
  {
    tag: "主題樂園",
    test: (s) => /EcoLand|Ecoland|史努比|HARIBO|9\.81|賽車/.test(s),
  },
  { tag: "夜間活動", test: (s) => /夜市|星光|夜間/.test(s) },
  { tag: "吃到飽", test: (s) => /百匯|吃到飽|自助餐|藍鼎/.test(s) },
  { tag: "高雄出發", test: (s) => /高雄出發|[|｜]高雄|KHH/.test(s) },
  { tag: "台北出發", test: (s) => /台北出發|桃園|TPE/.test(s) && !/[|｜]高雄|KHH/.test(s) },
  {
    tag: "商務飯店",
    test: (s) => /JEJU IN|HAEMA|BLACK SANDS|PARKSIDE|SIMS|商務/.test(s),
  },
];

export function inferTags(...parts: Array<string | null | undefined>): TourTag[] {
  const hay = parts.filter(Boolean).join("\n");
  const tags = new Set<TourTag>();
  for (const rule of TAG_RULES) {
    if (rule.test(hay)) tags.add(rule.tag);
  }
  if (tags.has("無購物")) {
    tags.delete("含購物");
    tags.delete("彩妝店");
  }
  if (tags.has("彩妝店")) tags.delete("含購物");
  return [...tags];
}

export function formatTourCard(tour: TourSummary): string {
  const flight = tour.flights.outbound
    ? `${tour.flights.outbound.departTime ?? "?"} ${tour.flights.outbound.from} → ${tour.flights.outbound.arriveTime ?? "?"} ${tour.flights.outbound.to}`
    : "—";
  const ret = tour.flights.inbound
    ? `${tour.flights.inbound.departTime ?? "?"} ${tour.flights.inbound.from} → ${tour.flights.inbound.arriveTime ?? "?"} ${tour.flights.inbound.to}`
    : "—";
  const hotel = tour.hotels
    .map((h) => `${h.nights}晚 ${h.names.join("/")}${h.guaranteed ? "（保證）" : ""}`)
    .join("；") || "—";
  const price =
    tour.priceFromTwd != null
      ? `TWD ${tour.priceFromTwd.toLocaleString("zh-TW")}`
      : "—";

  return [
    `## ${tour.shortName}`,
    `- 官網：${tour.officialTitle}`,
    `- 團號：${tour.groupId}`,
    `- 價起：${price}｜${tour.days}天｜${tour.departDate ?? "?"} → ${tour.returnDate ?? "?"}`,
    `- tags：${tour.tags.join("、") || "—"}`,
    `- 去程：${flight}`,
    `- 回程：${ret}`,
    `- 住宿：${hotel}`,
    `- 亮點：${tour.highlights.slice(0, 8).join("、") || "—"}`,
    tour.familyNotes.length ? `- 家庭備註：${tour.familyNotes.join("；")}` : null,
    `- 連結：${tour.sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function compareTours(tours: TourSummary[]): string {
  const headers = ["短團名", "價起", "天數", "出發", "tags", "去程", "住宿摘要", "核心差異"];
  const rows = tours.map((t) => {
    const go = t.flights.outbound
      ? `${t.flights.outbound.departTime ?? ""}-${t.flights.outbound.arriveTime ?? ""}`
      : "";
    const stay = t.hotels
      .map((h) => `${h.nights}晚${h.guaranteed ? "★" : ""}${h.names[0] ?? ""}`)
      .join("+");
    const core = t.highlights.slice(0, 3).join("／");
    return [
      t.shortName,
      t.priceFromTwd != null ? String(t.priceFromTwd) : "",
      String(t.days),
      t.departDate ?? "",
      t.tags.join("|"),
      go,
      stay,
      core,
    ];
  });

  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ];
  return lines.join("\n");
}

export function finalizeTour(
  partial: Omit<TourSummary, "shortName" | "tags" | "destination"> & {
    destination?: string;
    tags?: TourTag[];
  },
): TourSummary {
  const destination =
    partial.destination ?? inferDestination(partial.officialTitle);
  const shortName = buildShortName({
    destination,
    officialTitle: partial.officialTitle,
    departDate: partial.departDate,
    returnDate: partial.returnDate,
  });
  const tags =
    partial.tags && partial.tags.length > 0
      ? partial.tags
      : inferTags(
          partial.officialTitle,
          partial.highlights.join(" "),
          partial.hotels.map((h) => h.names.join(" ")).join(" "),
          partial.hotels.map((h) => h.note ?? "").join(" "),
        );

  return {
    ...partial,
    destination,
    shortName,
    tags,
    id: partial.id ?? `lion:${partial.groupId}`,
  };
}
