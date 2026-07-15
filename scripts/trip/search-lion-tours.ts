/**
 * 雄獅「關鍵字＋日期 → 列表」
 *
 * 用法：
 *   npx tsx scripts/trip/search-lion-tours.ts --keyword 沖繩 --from 2026-08-01 --to 2026-08-07
 *   npx tsx scripts/trip/search-lion-tours.ts --keyword 濟州 --from 2026/08/01 --to 2026/08/07 --format json
 */
import {
  finalizeTour,
  inferDestination,
  inferTags,
} from "./lion-tour-normalize.js";
import type { TourSummary } from "./lion-tour-types.js";
import {
  addTourDays,
  detailUrl,
  searchLionGroupListAll,
  type LionNormGroupHit,
} from "./lion-search-api.js";

type Args = {
  keyword?: string;
  from?: string;
  to?: string;
  format: "text" | "json" | "table";
  pageSize: number;
  maxPages: number;
  travelType: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    format: "table",
    pageSize: 20,
    maxPages: 2,
    travelType: 0,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--keyword" && next) args.keyword = argv[++i];
    else if (a === "--from" && next) args.from = argv[++i];
    else if (a === "--to" && next) args.to = argv[++i];
    else if (a === "--format" && next) {
      const v = argv[++i];
      if (v === "json" || v === "table" || v === "text") args.format = v;
    } else if (a === "--page-size" && next) args.pageSize = Number(argv[++i]);
    else if (a === "--max-pages" && next) args.maxPages = Number(argv[++i]);
    else if (a === "--travel-type" && next) args.travelType = Number(argv[++i]);
  }
  return args;
}

function hitToSummary(hit: LionNormGroupHit): TourSummary {
  const primary = hit.groups[0];
  const departDate = primary?.goDate || null;
  const returnDate = departDate
    ? addTourDays(departDate, hit.tourDays)
    : null;
  const groupId = primary?.groupId || hit.normGroupId;
  const destination = inferDestination(hit.tourName);
  const tags = inferTags(hit.tourName, hit.tagNames.join(" "));

  return finalizeTour({
    officialTitle: hit.tourName,
    agency: "lion",
    groupId,
    destination,
    days: hit.tourDays,
    departDate,
    returnDate,
    priceFromTwd: primary?.priceFromTwd ?? hit.priceFromTwd,
    tags,
    flights: {},
    hotels: [],
    highlights: hit.tagNames,
    dayPlans: [],
    familyNotes: primary?.statusText ? [primary.statusText] : [],
    sourceUrl: detailUrl(hit.normGroupId, groupId),
  });
}

function formatTable(tours: TourSummary[], totalCount: number): string {
  const headers = ["短團名", "價起", "天數", "出發", "團況", "團號", "官網標題"];
  const rows = tours.map((t) => [
    t.shortName,
    t.priceFromTwd != null ? String(t.priceFromTwd) : "",
    String(t.days),
    t.departDate ?? "",
    t.familyNotes[0] ?? "",
    t.groupId,
    t.officialTitle.replace(/\|/g, "｜").slice(0, 40),
  ]);
  return [
    `共 ${totalCount} 筆（本頁列出 ${tours.length}）`,
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.keyword || !args.from || !args.to) {
    console.error(
      [
        "Usage:",
        "  npx tsx scripts/trip/search-lion-tours.ts --keyword 沖繩 --from 2026-08-01 --to 2026-08-07",
        "  [--format table|json|text] [--page-size 20] [--max-pages 2] [--travel-type 0|1|2]",
      ].join("\n"),
    );
    process.exit(1);
  }

  const result = await searchLionGroupListAll({
    keywords: args.keyword,
    goDateStart: args.from,
    goDateEnd: args.to,
    pageSize: args.pageSize,
    maxPages: args.maxPages,
    travelType: args.travelType,
  });

  const tours = result.hits.map(hitToSummary);

  if (args.format === "json") {
    console.log(
      JSON.stringify(
        {
          query: {
            keyword: args.keyword,
            from: args.from,
            to: args.to,
            travelType: args.travelType,
          },
          totalCount: result.totalCount,
          totalPage: result.totalPage,
          fetched: tours.length,
          tours,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(formatTable(tours, result.totalCount));
  if (args.format === "text") {
    console.log("");
    for (const t of tours) {
      console.log(
        [
          `## ${t.shortName}`,
          `- ${t.officialTitle}`,
          `- ${t.groupId}｜${t.priceFromTwd ?? "—"}｜${t.familyNotes[0] ?? ""}`,
          `- ${t.sourceUrl}`,
          `- tags：${t.tags.join("、") || "—"}`,
        ].join("\n"),
      );
      console.log("");
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
