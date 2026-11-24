/**
 * Europe/London reporting dates for Visitors & Activity.
 * Pure functions. No AWS calls.
 */

export const REPORTING_TIME_ZONE = "Europe/London";
export const MAX_REPORT_DAYS = 90;
export const RETENTION_SECONDS = 90 * 86400;
export const JOURNEY_PAGE_SIZE = 50;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

/** UTC timestamp check used for event consent records. Same rule as the consent record: pattern, then a real date. */
export function isIsoTimestamp(value: string): boolean {
  if (!ISO_UTC.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

const londonFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: REPORTING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type LondonParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type ReportRange =
  | { ok: true; start: string; end: string; dates: string[] }
  | { ok: false; reason: "invalid_date" | "inverted" | "outside_window" | "too_long" };

export type JourneyBounds = {
  start: string;
  endInclusive: string;
};

function londonParts(instant: Date): LondonParts {
  const parts = londonFormatter.formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "NaN");
  let hour = value("hour");
  let day = value("day");
  let month = value("month");
  let year = value("year");
  if (hour === 24) {
    hour = 0;
    const rolled = new Date(Date.UTC(year, month - 1, day) + 86400000);
    year = rolled.getUTCFullYear();
    month = rolled.getUTCMonth() + 1;
    day = rolled.getUTCDate();
  }
  return {
    year,
    month,
    day,
    hour,
    minute: value("minute"),
    second: value("second"),
  };
}

export function londonDate(instant: Date): string {
  const parts = londonParts(instant);
  return formatLondonDate(parts.year, parts.month, parts.day);
}

export function formatLondonDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatUtcTimestamp(instant: Date): string {
  return instant.toISOString();
}

/**
 * The first UTC instant at which the Europe/London clock reads 00:00:00
 * on this calendar date. On the autumn change, local 00:00 occurs twice;
 * the earlier instant is the start of the London date.
 */
export function londonMidnightUtc(londonDay: string): Date {
  const match = DATE_PATTERN.exec(londonDay);
  if (!match) {
    throw new Error("invalid London date");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const desired = Date.UTC(year, month - 1, day, 0, 0, 0);
  const matches: Date[] = [];
  for (const offsetMinutes of [0, 60, -60]) {
    const candidate = new Date(desired - offsetMinutes * 60 * 1000);
    const parts = londonParts(candidate);
    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === 0 &&
      parts.minute === 0 &&
      parts.second === 0
    ) {
      matches.push(candidate);
    }
  }
  if (matches.length === 0) {
    throw new Error("invalid London date");
  }
  matches.sort((left, right) => left.getTime() - right.getTime());
  const earliest = matches[0];
  if (!earliest || londonDate(earliest) !== londonDay) {
    throw new Error("invalid London date");
  }
  return earliest;
}

export function isLondonDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  try {
    return londonDate(londonMidnightUtc(value)) === value;
  } catch {
    return false;
  }
}

export function addLondonDays(londonDay: string, days: number): string {
  const match = DATE_PATTERN.exec(londonDay);
  if (!match) {
    throw new Error("invalid London date");
  }
  const shifted = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days),
  );
  return formatLondonDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

export function londonDatesInclusive(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    if (dates.length > MAX_REPORT_DAYS) break;
    cursor = addLondonDays(cursor, 1);
  }
  return dates;
}

export function reportingWindow(now: Date): { start: string; end: string; dates: string[] } {
  const end = londonDate(now);
  const start = addLondonDays(end, -(MAX_REPORT_DAYS - 1));
  return { start, end, dates: londonDatesInclusive(start, end) };
}

export function validateReportRange(start: string, end: string, now: Date): ReportRange {
  if (!isLondonDate(start) || !isLondonDate(end)) {
    return { ok: false, reason: "invalid_date" };
  }
  if (end < start) {
    return { ok: false, reason: "inverted" };
  }
  const window = reportingWindow(now);
  if (start < window.start || end > window.end) {
    return { ok: false, reason: "outside_window" };
  }
  const dates = londonDatesInclusive(start, end);
  if (dates.length > MAX_REPORT_DAYS) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, start, end, dates };
}

export function journeyBounds(start: string, end: string): JourneyBounds {
  return {
    start: formatUtcTimestamp(londonMidnightUtc(start)),
    endInclusive: formatUtcTimestamp(londonMidnightUtc(addLondonDays(end, 1))),
  };
}

/**
 * Inclusive DynamoDB BETWEEN on eventSort.
 * The bare timestamp has no `#eventId`, so an event at the next London
 * midnight sorts after the upper bound and is excluded. An event at the
 * start midnight sorts after the bare lower bound and is included.
 */
export function eventSortInJourney(eventSort: string, bounds: JourneyBounds): boolean {
  return eventSort >= bounds.start && eventSort <= bounds.endInclusive;
}

export function retentionInstant(londonDay: string): number {
  return Math.floor(londonMidnightUtc(londonDay).getTime() / 1000) + RETENTION_SECONDS;
}

export function isRetentionPartial(londonDay: string, now: Date): boolean {
  return Math.floor(now.getTime() / 1000) >= retentionInstant(londonDay);
}

export function expiresAtFromInstant(isoTimestamp: string): number {
  return Math.floor(Date.parse(isoTimestamp) / 1000) + RETENTION_SECONDS;
}
