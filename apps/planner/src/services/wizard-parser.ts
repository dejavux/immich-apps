import type {
  BudgetRange,
  DateWindow,
  DepartFrom,
  DurationRange,
} from "@family-memories/planner-schema";

export type ParseOk<T> = { ok: true; value: T };
export type ParseClarify = { ok: false; clarification: string };
export type ParseResult<T> = ParseOk<T> | ParseClarify;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function monthRange(y: number, startMonth: number, endMonth: number, label: string): DateWindow {
  const toMonth = endMonth;
  const toDay = lastDayOfMonth(y, toMonth);
  return {
    from: formatDate(y, startMonth, 1),
    to: formatDate(y, toMonth, toDay),
    label,
  };
}

/** 解析 wizard `when` 步驟口語輸入 */
export function parseWhenInput(raw: string, now = new Date()): ParseResult<DateWindow> {
  const text = raw.trim();
  if (!text) {
    return { ok: false, clarification: "請告訴我大概什麼時候出發，例如：暑假、7–8 月、明年 1 月底。" };
  }

  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (/暑假|暑期/.test(text)) {
    const y = month > 8 ? year + 1 : year;
    return { ok: true, value: monthRange(y, 7, 8, "暑假") };
  }

  if (/寒假|春節|過年/.test(text)) {
    const y = month > 2 ? year + 1 : year;
    return { ok: true, value: monthRange(y, 1, 2, "寒假／春節") };
  }

  const monthSpan = text.match(/(\d{1,2})\s*[-–—~～至到]\s*(\d{1,2})\s*月/);
  if (monthSpan) {
    const startM = Number(monthSpan[1]);
    const endM = Number(monthSpan[2]);
    if (startM >= 1 && startM <= 12 && endM >= 1 && endM <= 12 && startM <= endM) {
      let y = year;
      if (startM < month) y += 1;
      return { ok: true, value: monthRange(y, startM, endM, text) };
    }
  }

  const singleMonth = text.match(/(?:明年\s*)?(\d{1,2})\s*月/);
  if (singleMonth) {
    const m = Number(singleMonth[1]);
    if (m >= 1 && m <= 12) {
      let y = year;
      if (/明年/.test(text) || m < month) y += 1;
      const isLate = /底|下旬|末/.test(text);
      const fromDay = isLate ? 20 : 1;
      const toDay = lastDayOfMonth(y, m);
      return {
        ok: true,
        value: {
          from: formatDate(y, m, fromDay),
          to: formatDate(y, m, toDay),
          label: text,
        },
      };
    }
  }

  const isoRange = text.match(
    /(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s*[-–—~～至到]\s*(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,
  );
  if (isoRange) {
    return {
      ok: true,
      value: {
        from: formatDate(Number(isoRange[1]), Number(isoRange[2]), Number(isoRange[3])),
        to: formatDate(Number(isoRange[4]), Number(isoRange[5]), Number(isoRange[6])),
        label: text,
      },
    };
  }

  return {
    ok: false,
    clarification:
      "無法判斷出發區間。請用「暑假」「7–8 月」「明年 1 月底」或明確日期區間再試一次。",
  };
}

/** 解析 wizard `duration` 步驟 */
export function parseDurationInput(raw: string): ParseResult<DurationRange> {
  const text = raw.trim();
  if (!text) {
    return { ok: false, clarification: "請告訴我大概幾天，例如：4–5 天、一週左右、5 天。" };
  }

  const range = text.match(/(\d+)\s*[-–—~～至到]\s*(\d+)\s*天/);
  if (range) {
    const minDays = Number(range[1]);
    const maxDays = Number(range[2]);
    if (minDays > 0 && maxDays >= minDays) {
      return { ok: true, value: { minDays, maxDays } };
    }
  }

    const exact = text.match(/(\d+)\s*天/);
  if (exact) {
    const days = Number(exact[1]);
    if (days > 0) {
      return { ok: true, value: { minDays: days, maxDays: days } };
    }
  }

  if (/一週左右|一周左右|約一週|大概一週/.test(text)) {
    return { ok: true, value: { minDays: 6, maxDays: 8 } };
  }
  if (/一週|一周|七天/.test(text)) {
    return { ok: true, value: { minDays: 7, maxDays: 7 } };
  }

  return {
    ok: false,
    clarification: "無法判斷天數。請用「4–5 天」「5 天」或「一週左右」再試一次。",
  };
}

/** 解析 wizard `depart_from` */
export function parseDepartFromInput(raw: string): ParseResult<DepartFrom> {
  const text = raw.trim();
  if (!text) {
    return { ok: false, clarification: "請告訴我從哪裡出發，例如：台北、高雄、台中、不限。" };
  }
  if (/不限|都可以|隨便/.test(text)) {
    return { ok: true, value: "ANY" };
  }
  if (/台北|桃園|松山|TPE/i.test(text)) {
    return { ok: true, value: "TPE" };
  }
  if (/高雄|小港|KHH/i.test(text)) {
    return { ok: true, value: "KHH" };
  }
  if (/台中|清泉崗|RMQ/i.test(text)) {
    return { ok: true, value: "RMQ" };
  }
  return {
    ok: false,
    clarification: "無法辨識出發地。請回答：台北、高雄、台中，或「不限」。",
  };
}

/** 解析 wizard `must`（最多 3 條） */
export function parseMustInput(raw: string): ParseResult<string[]> {
  const text = raw.trim();
  if (!text || /^(無|沒有|略過|skip)$/i.test(text)) {
    return { ok: true, value: [] };
  }

  const parts = text
    .split(/[,，、;；\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { ok: true, value: [] };
  }
  if (parts.length > 3) {
    return {
      ok: false,
      clarification: "硬條件最多 3 條，請精簡後再送一次（用逗號分隔）。",
    };
  }
  return { ok: true, value: parts };
}

/** 解析 wizard `budget` */
export function parseBudgetInput(raw: string): ParseResult<BudgetRange> {
  const text = raw.trim();
  if (!text) {
    return { ok: false, clarification: "請選擇預算區間：<2萬、2–3萬、3–4萬、不限。" };
  }
  if (/不限|沒限制|都可以/.test(text)) {
    return { ok: true, value: "不限" };
  }
  if (/<\s*2\s*萬|兩萬內|2萬內|二萬內|1\.?5\s*萬|一萬五/.test(text)) {
    return { ok: true, value: "<2萬" };
  }
  if (/2\s*[-–—~～至到]\s*3\s*萬|兩三萬|二三萬/.test(text)) {
    return { ok: true, value: "2–3萬" };
  }
  if (/3\s*[-–—~～至到]\s*4\s*萬|三四萬/.test(text)) {
    return { ok: true, value: "3–4萬" };
  }
  return {
    ok: false,
    clarification: "無法判斷預算。請回答：<2萬、2–3萬、3–4萬，或「不限」。",
  };
}

export type ReviewAction =
  | { type: "confirm" }
  | { type: "edit"; step: "when" | "duration" | "depart_from" | "must" | "budget" };

/** 解析 review 步驟回覆 */
export function parseReviewInput(raw: string): ParseResult<ReviewAction> {
  const text = raw.trim();
  if (!text) {
    return { ok: false, clarification: "請回覆「確認」開始搜尋，或說「修改預算」等指定要改的步驟。" };
  }
  if (/^(是|確認|ok|好|可以|開始搜尋)$/i.test(text)) {
    return { ok: true, value: { type: "confirm" } };
  }

  const editMatchers: Array<{ re: RegExp; step: "when" | "duration" | "depart_from" | "must" | "budget" }> = [
    { re: /修改.*(時間|日期|when|出發區間)|改.*(時間|日期)/i, step: "when" },
    { re: /修改.*(天數|duration|幾天)|改.*天數/i, step: "duration" },
    { re: /修改.*(出發地|depart)|改.*出發/i, step: "depart_from" },
    { re: /修改.*(條件|must|需求)|改.*條件/i, step: "must" },
    { re: /修改.*(預算|budget)|改.*預算/i, step: "budget" },
  ];
  for (const row of editMatchers) {
    if (row.re.test(text)) {
      return { ok: true, value: { type: "edit", step: row.step } };
    }
  }

  return {
    ok: false,
    clarification: "請回覆「確認」開始搜尋，或「修改預算／修改天數」等指定要調整的項目。",
  };
}
