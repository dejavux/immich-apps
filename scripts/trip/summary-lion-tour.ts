/**
 * 雄獅行程摘要／比較 prototype
 *
 * 短團名：目的地-MMDD-MMDD（例 濟州島-0801-0805）
 * tags：無購物、彩妝店、保證五星、親子設施…
 *
 * 用法：
 *   npx tsx scripts/trip/summary-lion-tour.ts --fixture scripts/trip/fixtures/jeju-compare.json
 *   npx tsx scripts/trip/summary-lion-tour.ts --fixture ... --format json
 *
 * 列表搜尋：
 *   npx tsx scripts/trip/search-lion-tours.ts --keyword 濟州 --from 2026-08-01 --to 2026-08-07
 * 詳情頁 live URL 抓取仍需 Playwright；本檔先吃 fixture。
 * 暫時放在 immich-apps（Family Memory 相關探勘），非正式產品路徑。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  compareTours,
  finalizeTour,
  formatTourCard,
} from "./lion-tour-normalize.js";
import type { TourSummary } from "./lion-tour-types.js";

type FixtureFile = {
  tours: Array<Parameters<typeof finalizeTour>[0]>;
};

function parseArgs(argv: string[]): {
  fixture?: string;
  format: "text" | "json" | "table";
} {
  let fixture: string | undefined;
  let format: "text" | "json" | "table" = "text";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--fixture" && argv[i + 1]) fixture = argv[++i];
    else if (arg === "--format" && argv[i + 1]) {
      const v = argv[++i];
      if (v === "json" || v === "table" || v === "text") format = v;
    }
  }
  return { fixture, format };
}

function loadFixture(path: string): TourSummary[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as FixtureFile;
  return raw.tours.map((t) => finalizeTour(t));
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.fixture) {
    console.error(
      "Usage: npx tsx scripts/trip/summary-lion-tour.ts --fixture scripts/trip/fixtures/jeju-compare.json [--format text|table|json]",
    );
    process.exit(1);
  }

  const tours = loadFixture(resolve(args.fixture));

  if (args.format === "json") {
    console.log(JSON.stringify(tours, null, 2));
    return;
  }

  if (args.format === "table" || args.format === "text") {
    console.log(compareTours(tours));
    console.log("");
    for (const tour of tours) {
      console.log(formatTourCard(tour));
      console.log("");
    }
  }
}

main();
