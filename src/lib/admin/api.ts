import { BROWSER_VALUES, DEVICE_VALUES, SOURCE_VALUES } from "@/lib/analytics/event-core";
import { REPORTING_TIME_ZONE } from "@/lib/analytics/dates";

export type AdminHealth =
  | {
      status: "ok";
      body: { ok: true; status: "ok"; service: "admin"; requestId: string };
    }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "unconfigured" };

export function adminApiBase() {
  return (process.env.NEXT_PUBLIC_ADMIN_API_BASE ?? "").trim().replace(/\/$/, "");
}

export function isAdminApiConfigured() {
  return adminApiBase().length > 0;
}

function healthUrl(base: string, accessToken: string) {
  const endpoint = new URL("health", `${base}/`);
  if (endpoint.search || endpoint.username || endpoint.password) return null;
  if (endpoint.href.includes(accessToken)) return null;
  return endpoint;
}

export async function fetchAdminHealth(accessToken: string): Promise<AdminHealth> {
  const base = adminApiBase();
  if (!base) return { status: "unconfigured" };
  if (!accessToken) return { status: "unauthorized" };
  const endpoint = healthUrl(base, accessToken);
  if (!endpoint) return { status: "unavailable" };

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (response.status === 401) return { status: "unauthorized" };
    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "unavailable" };
    const body: unknown = await response.json();
    if (!isHealthBody(body)) return { status: "unavailable" };
    return { status: "ok", body };
  } catch {
    return { status: "unavailable" };
  }
}

function isHealthBody(
  body: unknown,
): body is { ok: true; status: "ok"; service: "admin"; requestId: string } {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return (
    record.ok === true &&
    record.status === "ok" &&
    record.service === "admin" &&
    typeof record.requestId === "string"
  );
}

export const notificationStatuses = ["pending", "sending", "sent", "failed"] as const;
export const reviewStatuses = ["new", "reviewed", "closed"] as const;

export type NotificationStatus = (typeof notificationStatuses)[number];
export type ReviewStatus = (typeof reviewStatuses)[number];

export type Enquiry = {
  id: string;
  submittedAt: string;
  name: string;
  organisation: string;
  email: string;
  phone: string | null;
  enquiryType: string;
  message: string;
  messageTruncated: boolean;
  notificationStatus: NotificationStatus;
  reviewStatus: ReviewStatus;
  notificationAttempts?: number;
  lastNotificationError?: string;
  notifiedAt?: string;
};

export type EnquirySummary =
  | {
      status: "ok";
      total: number;
      byNotificationStatus: Record<NotificationStatus, number>;
    }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "unconfigured" };

export type EnquiryList =
  | { status: "ok"; items: Enquiry[]; cursor: string | null }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "unconfigured" };

export type EnquiryResult =
  | { status: "ok"; enquiry: Enquiry }
  | { status: "missing" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "unconfigured" };

export async function fetchEnquirySummary(accessToken: string): Promise<EnquirySummary> {
  const result = await readJson(accessToken, "enquiries/summary", undefined, (body) => {
    if (!body || typeof body !== "object") return null;
    const record = body as Record<string, unknown>;
    const counts = record.byNotificationStatus;
    if (record.ok !== true || typeof record.total !== "number" || !counts || typeof counts !== "object") {
      return null;
    }
    const byNotificationStatus = counts as Record<string, unknown>;
    if (!notificationStatuses.every((status) => typeof byNotificationStatus[status] === "number")) {
      return null;
    }
    return {
      total: record.total,
      byNotificationStatus: byNotificationStatus as Record<NotificationStatus, number>,
    };
  });
  if (!result.ok) return { status: enquiryStatus(result.status) };
  return { status: "ok", ...result.value };
}

export async function fetchEnquiries(
  accessToken: string,
  query: { status: NotificationStatus; cursor?: string | null; q?: string },
): Promise<EnquiryList> {
  const parameters: Record<string, string> = { status: query.status };
  if (query.cursor) parameters.cursor = query.cursor;
  if (query.q) parameters.q = query.q;
  const result = await readJson(accessToken, "enquiries", parameters, (body) => {
    if (!body || typeof body !== "object") return null;
    const record = body as Record<string, unknown>;
    if (record.ok !== true || !Array.isArray(record.items)) return null;
    if (record.cursor !== null && typeof record.cursor !== "string") return null;
    const items = record.items.map(readEnquiry).filter((item): item is Enquiry => item !== null);
    if (items.length !== record.items.length) return null;
    return { items, cursor: record.cursor };
  });
  if (!result.ok) return { status: enquiryStatus(result.status) };
  return { status: "ok", ...result.value };
}

export async function fetchEnquiry(accessToken: string, id: string): Promise<EnquiryResult> {
  const result = await readJson(
    accessToken,
    `enquiries/${encodeURIComponent(id)}`,
    undefined,
    (body) => {
      if (!body || typeof body !== "object") return null;
      return readEnquiry((body as { enquiry?: unknown }).enquiry);
    },
    { notFound: true },
  );
  if (!result.ok) return { status: result.status === "invalid_range" ? "unavailable" : result.status };
  return { status: "ok", enquiry: result.value };
}

export async function updateEnquiryReview(
  accessToken: string,
  id: string,
  reviewStatus: ReviewStatus,
): Promise<EnquiryResult> {
  const result = await readJson(
    accessToken,
    `enquiries/${encodeURIComponent(id)}`,
    undefined,
    (body) => {
      if (!body || typeof body !== "object") return null;
      return readEnquiry((body as { enquiry?: unknown }).enquiry);
    },
    { method: "PATCH", body: { reviewStatus }, notFound: true },
  );
  if (!result.ok) return { status: result.status === "invalid_range" ? "unavailable" : result.status };
  return { status: "ok", enquiry: result.value };
}

const RANGE_REASONS = ["invalid_date", "inverted", "outside_window", "too_long"] as const;
export type AggregateRangeReason = (typeof RANGE_REASONS)[number];

export type AggregateDaily = {
  date: string;
  pageViews: number;
  visits: number;
  partial: boolean;
};

export type AggregateCountry = {
  country: string;
  pageViews: number;
  visits: number;
};

export type AggregateCount = {
  name: string;
  count: number;
};

export type AggregateReport = {
  period: { start: string; end: string; timeZone: typeof REPORTING_TIME_ZONE };
  pageViews: number;
  visits: number;
  daily: AggregateDaily[];
  countries: AggregateCountry[];
  countriesOther: { pageViews: number; visits: number };
  paths: AggregateCount[];
  pathsOther: number;
  sources: Record<(typeof SOURCE_VALUES)[number], number>;
  devices: Record<(typeof DEVICE_VALUES)[number], number>;
  browsers: Record<(typeof BROWSER_VALUES)[number], number>;
  partialDates: string[];
};

export type AggregateSummary =
  | { status: "ok"; report: AggregateReport }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "unconfigured" }
  | { status: "invalid_range"; reason: AggregateRangeReason };

export async function fetchAggregateSummary(
  accessToken: string,
  range: { start: string; end: string },
): Promise<AggregateSummary> {
  const result = await readJson(
    accessToken,
    "analytics/summary",
    { start: range.start, end: range.end },
    readAggregateReport,
    { rangeError: true },
  );
  if (!result.ok) {
    if (result.status === "invalid_range") return { status: "invalid_range", reason: result.reason };
    return { status: result.status === "missing" ? "unavailable" : result.status };
  }
  return { status: "ok", report: result.value };
}

type GatewayStatus = "unauthorized" | "forbidden" | "unavailable" | "unconfigured" | "missing";
type ReadFailure = { ok: false; status: GatewayStatus } | { ok: false; status: "invalid_range"; reason: AggregateRangeReason };

function enquiryStatus(status: ReadFailure["status"]): Exclude<GatewayStatus, "missing"> {
  if (status === "missing" || status === "invalid_range") return "unavailable";
  return status;
}

async function readJson<T>(
  accessToken: string,
  path: string,
  query: Record<string, string> | undefined,
  parse: (body: unknown) => T | null,
  options?: { method?: "GET" | "PATCH"; body?: Record<string, string>; notFound?: boolean; rangeError?: boolean },
): Promise<{ ok: true; value: T } | ReadFailure> {
  const base = adminApiBase();
  if (!base) return { ok: false, status: "unconfigured" };
  if (!accessToken) return { ok: false, status: "unauthorized" };
  const endpoint = adminEndpoint(base, path, accessToken, query);
  if (!endpoint) return { ok: false, status: "unavailable" };
  try {
    const response = await fetch(endpoint, {
      method: options?.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
    if (response.status === 401) return { ok: false, status: "unauthorized" };
    if (response.status === 403) return { ok: false, status: "forbidden" };
    if (response.status === 404 && options?.notFound) return { ok: false, status: "missing" };
    if (response.status === 400 && options?.rangeError) return { ok: false, ...rangeFailure(await response.json()) };
    if (!response.ok) return { ok: false, status: "unavailable" };
    const parsed = parse(await response.json());
    return parsed === null ? { ok: false, status: "unavailable" } : { ok: true, value: parsed };
  } catch {
    return { ok: false, status: "unavailable" };
  }
}

function adminEndpoint(
  base: string,
  path: string,
  accessToken: string,
  query?: Record<string, string>,
) {
  const endpoint = new URL(path, `${base}/`);
  for (const [key, value] of Object.entries(query ?? {})) endpoint.searchParams.set(key, value);
  if (endpoint.username || endpoint.password) return null;
  if (endpoint.href.includes(accessToken)) return null;
  return endpoint;
}

function readEnquiry(value: unknown): Enquiry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.submittedAt !== "string" ||
    typeof record.name !== "string" ||
    typeof record.organisation !== "string" ||
    typeof record.email !== "string" ||
    typeof record.enquiryType !== "string" ||
    typeof record.message !== "string" ||
    typeof record.messageTruncated !== "boolean" ||
    !notificationStatuses.includes(record.notificationStatus as NotificationStatus) ||
    !reviewStatuses.includes(record.reviewStatus as ReviewStatus) ||
    !(record.phone === null || typeof record.phone === "string")
  ) {
    return null;
  }
  return {
    id: record.id,
    submittedAt: record.submittedAt,
    name: record.name,
    organisation: record.organisation,
    email: record.email,
    phone: record.phone,
    enquiryType: record.enquiryType,
    message: record.message,
    messageTruncated: record.messageTruncated,
    notificationStatus: record.notificationStatus as NotificationStatus,
    reviewStatus: record.reviewStatus as ReviewStatus,
    ...deliveryFields(record),
  };
}

const LONDON_DATE = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_CODE = /^[A-Z]{2}$/;

function rangeFailure(body: unknown): { status: "invalid_range"; reason: AggregateRangeReason } {
  const reason = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  const matched = RANGE_REASONS.find((item) => item === reason);
  if (matched) return { status: "invalid_range", reason: matched };
  return { status: "invalid_range", reason: "invalid_date" };
}

function countValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

function countRecord<T extends string>(value: unknown, keys: readonly T[]): Record<T, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length) return null;
  const counts = {} as Record<T, number>;
  for (const key of keys) {
    const count = countValue(record[key]);
    if (count === null) return null;
    counts[key] = count;
  }
  return counts;
}

function readAggregateReport(body: unknown): AggregateReport | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const period = record.period;
  if (!period || typeof period !== "object" || Array.isArray(period)) return null;
  const periodRecord = period as Record<string, unknown>;
  if (
    record.ok !== true ||
    typeof record.requestId !== "string" ||
    typeof periodRecord.start !== "string" ||
    typeof periodRecord.end !== "string" ||
    !LONDON_DATE.test(periodRecord.start) ||
    !LONDON_DATE.test(periodRecord.end) ||
    periodRecord.timeZone !== REPORTING_TIME_ZONE
  ) {
    return null;
  }
  const pageViews = countValue(record.pageViews);
  const visits = countValue(record.visits);
  const pathsOther = countValue(record.pathsOther);
  const sources = countRecord(record.sources, SOURCE_VALUES);
  const devices = countRecord(record.devices, DEVICE_VALUES);
  const browsers = countRecord(record.browsers, BROWSER_VALUES);
  const countriesOther = pairCounts(record.countriesOther);
  const daily = readDaily(record.daily);
  const countries = readCountries(record.countries);
  const paths = readCounts(record.paths);
  const partialDates = readDates(record.partialDates);
  if (
    pageViews === null ||
    visits === null ||
    pathsOther === null ||
    !sources ||
    !devices ||
    !browsers ||
    !countriesOther ||
    !daily ||
    !countries ||
    !paths ||
    !partialDates
  ) {
    return null;
  }
  return {
    period: { start: periodRecord.start, end: periodRecord.end, timeZone: REPORTING_TIME_ZONE },
    pageViews,
    visits,
    daily,
    countries,
    countriesOther,
    paths,
    pathsOther,
    sources,
    devices,
    browsers,
    partialDates,
  };
}

function pairCounts(value: unknown): { pageViews: number; visits: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const pageViews = countValue(record.pageViews);
  const visits = countValue(record.visits);
  if (pageViews === null || visits === null || Object.keys(record).length !== 2) return null;
  return { pageViews, visits };
}

function readDaily(value: unknown): AggregateDaily[] | null {
  if (!Array.isArray(value)) return null;
  const daily: AggregateDaily[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const pageViews = countValue(record.pageViews);
    const visits = countValue(record.visits);
    if (
      typeof record.date !== "string" ||
      !LONDON_DATE.test(record.date) ||
      pageViews === null ||
      visits === null ||
      typeof record.partial !== "boolean"
    ) {
      return null;
    }
    daily.push({ date: record.date, pageViews, visits, partial: record.partial });
  }
  return daily;
}

function readCountries(value: unknown): AggregateCountry[] | null {
  if (!Array.isArray(value)) return null;
  const countries: AggregateCountry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const pageViews = countValue(record.pageViews);
    const visits = countValue(record.visits);
    if (
      typeof record.country !== "string" ||
      !COUNTRY_CODE.test(record.country) ||
      pageViews === null ||
      visits === null
    ) {
      return null;
    }
    countries.push({ country: record.country, pageViews, visits });
  }
  return countries;
}

function readCounts(value: unknown): AggregateCount[] | null {
  if (!Array.isArray(value)) return null;
  const counts: AggregateCount[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const count = countValue(record.count);
    if (typeof record.name !== "string" || record.name.length === 0 || record.name.length > 120 || count === null) {
      return null;
    }
    counts.push({ name: record.name, count });
  }
  return counts;
}

function readDates(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !LONDON_DATE.test(item))) return null;
  return value as string[];
}

const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function deliveryFields(
  record: Record<string, unknown>,
): Pick<Enquiry, "notificationAttempts" | "lastNotificationError" | "notifiedAt"> {
  const attempts = record.notificationAttempts;
  const error = record.lastNotificationError;
  const sentAt = record.notifiedAt;
  return {
    ...(typeof attempts === "number" && Number.isInteger(attempts) && attempts >= 0 && attempts <= 99
      ? { notificationAttempts: attempts }
      : {}),
    ...(typeof error === "string" && ERROR_NAME.test(error) ? { lastNotificationError: error } : {}),
    ...(typeof sentAt === "string" && TIMESTAMP.test(sentAt) ? { notifiedAt: sentAt } : {}),
  };
}
