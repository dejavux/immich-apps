/** Add calendar months to a UTC date (day clamped to month end). */
export function addMonthsUtc(date: Date, months: number): Date {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const targetMonth = result.getUTCMonth() + months;
  result.setUTCMonth(targetMonth);
  return result;
}

export function parseIsoDateOnly(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return date;
}

export function toIsoDateTimeStart(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

export function toIsoDateTimeEnd(date: Date): string {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end.toISOString();
}

export interface AgeDateRangeOptions {
  birthDate: Date;
  ageYears?: number;
  ageMonths?: number;
  /** Days before/after target age date */
  windowDays?: number;
}

/** Map birth date + age (e.g. 1.5y) to Immich takenAfter/takenBefore window. */
export function ageToTakenRange(options: AgeDateRangeOptions): {
  takenAfter: string;
  takenBefore: string;
} {
  const windowDays = options.windowDays ?? 45;
  let totalMonths = 0;
  if (options.ageMonths !== undefined) {
    totalMonths = options.ageMonths;
  } else if (options.ageYears !== undefined) {
    totalMonths = Math.round(options.ageYears * 12);
  } else {
    throw new Error("ageYears or ageMonths required");
  }

  const target = addMonthsUtc(options.birthDate, totalMonths);
  const start = new Date(target);
  start.setUTCDate(start.getUTCDate() - windowDays);
  const end = new Date(target);
  end.setUTCDate(end.getUTCDate() + windowDays);

  return {
    takenAfter: toIsoDateTimeStart(start),
    takenBefore: toIsoDateTimeEnd(end),
  };
}

export function explicitDateRange(
  dateFrom: string,
  dateTo?: string,
): { takenAfter: string; takenBefore: string } | undefined {
  const from = parseIsoDateOnly(dateFrom);
  if (!from) {
    return undefined;
  }
  const to = dateTo ? parseIsoDateOnly(dateTo) : from;
  if (!to) {
    return undefined;
  }
  return {
    takenAfter: toIsoDateTimeStart(from),
    takenBefore: toIsoDateTimeEnd(to),
  };
}

function formatUtcDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type RelativeDateKind =
  | "this_year"
  | "last_year"
  | "this_month"
  | "last_month";

const CHINESE_DIGIT_VALUES: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  兩: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

/** Parse simple Chinese numerals (一～九十九) used in casual date phrases. */
export function parseChineseNumeral(text: string): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const value = Number.parseFloat(trimmed);
    return Number.isFinite(value) ? value : undefined;
  }
  if (trimmed === "十") {
    return 10;
  }
  if (/^十[一二三四五六七八九]$/.test(trimmed)) {
    const digit = CHINESE_DIGIT_VALUES[trimmed[1]];
    return digit === undefined ? undefined : 10 + digit;
  }
  if (/^[一二三四五六七八九]十[一二三四五六七八九]?$/.test(trimmed)) {
    const tens = CHINESE_DIGIT_VALUES[trimmed[0]];
    if (tens === undefined) {
      return undefined;
    }
    const ones = trimmed.length > 2 ? CHINESE_DIGIT_VALUES[trimmed[2]] : 0;
    if (ones === undefined) {
      return undefined;
    }
    return tens * 10 + ones;
  }
  if (trimmed.length === 1 && trimmed in CHINESE_DIGIT_VALUES) {
    return CHINESE_DIGIT_VALUES[trimmed];
  }
  return undefined;
}

const YEARS_AGO_PATTERN =
  /(?:(\d+(?:\.\d+)?)|([一二三四五六七八九十兩两〇零]+))\s*年\s*前/;

export function detectYearsAgoInText(
  text: string,
  now: Date = new Date(),
): { dateFrom: string; dateTo: string; label: string } | undefined {
  const match = YEARS_AGO_PATTERN.exec(text);
  if (!match) {
    return undefined;
  }
  const years = match[1]
    ? Number.parseFloat(match[1])
    : parseChineseNumeral(match[2]);
  if (years === undefined || !Number.isFinite(years) || years <= 0) {
    return undefined;
  }
  const roundedYears = Math.round(years);
  const targetYear = now.getUTCFullYear() - roundedYears;
  const label = match[0].replace(/\s+/g, "");
  return {
    dateFrom: `${targetYear}-01-01`,
    dateTo: `${targetYear}-12-31`,
    label,
  };
}

export function stripYearsAgoTokens(text: string): string {
  return text.replace(YEARS_AGO_PATTERN, "").replace(/\s+/g, " ").trim();
}

export function relativeDateRange(
  kind: RelativeDateKind,
  now: Date = new Date(),
): { dateFrom: string; dateTo: string; label: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = formatUtcDateOnly(now);

  switch (kind) {
    case "this_year":
      return {
        dateFrom: `${year}-01-01`,
        dateTo: today,
        label: "今年",
      };
    case "last_year":
      return {
        dateFrom: `${year - 1}-01-01`,
        dateTo: `${year - 1}-12-31`,
        label: "去年",
      };
    case "this_month": {
      const start = new Date(Date.UTC(year, month, 1));
      return {
        dateFrom: formatUtcDateOnly(start),
        dateTo: today,
        label: "本月",
      };
    }
    case "last_month": {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0));
      return {
        dateFrom: formatUtcDateOnly(start),
        dateTo: formatUtcDateOnly(end),
        label: "上個月",
      };
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

const RELATIVE_DATE_PATTERNS: Array<{
  pattern: RegExp;
  kind: RelativeDateKind;
}> = [
  { pattern: /今年/, kind: "this_year" },
  { pattern: /去年/, kind: "last_year" },
  { pattern: /(?:這個月|本月)/, kind: "this_month" },
  { pattern: /上(?:個|一)月/, kind: "last_month" },
];

export function detectRelativeDateInText(
  text: string,
  now: Date = new Date(),
): { dateFrom: string; dateTo: string; label: string } | undefined {
  const yearsAgo = detectYearsAgoInText(text, now);
  if (yearsAgo) {
    return yearsAgo;
  }
  for (const { pattern, kind } of RELATIVE_DATE_PATTERNS) {
    if (pattern.test(text)) {
      return relativeDateRange(kind, now);
    }
  }
  return undefined;
}

export function stripRelativeDateTokens(text: string): string {
  return stripYearsAgoTokens(text)
    .replace(/今年|去年|(?:這個月|本月)|上(?:個|一)月/g, "")
    .replace(/\s+/g, "")
    .trim();
}
