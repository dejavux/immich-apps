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
