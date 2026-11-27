/**
 * Admin aggregate report. The caller must already hold hasAdmin "true".
 * Dates are London calendar dates. Counters are read with Query and passed
 * to aggregateStatistics. The response contains totals only.
 */

import { aggregateStatistics } from "@/lib/analytics/aggregate-report";
import { REPORTING_TIME_ZONE, validateReportRange } from "@/lib/analytics/dates";
import { CounterQueryError, documentCounterQuery, readCounterRows, type CounterQuery } from "./counter-query";

const REQUEST_ID = /^[A-Za-z0-9_=-]{1,128}$/;
const QUERY_KEYS = new Set(["start", "end"]);

export type ReportEvent = {
  routeKey?: string;
  rawPath?: string;
  queryStringParameters?: Record<string, string | undefined> | null;
  requestContext?: {
    requestId?: string;
    http?: { method?: string; path?: string };
    authorizer?: { lambda?: { hasAdmin?: unknown } };
  };
};

type ReportResponse = {
  statusCode: number;
  headers: { "content-type": string; "cache-control": string };
  body: string;
};

export type ReportLog = {
  requestId: string;
  route: string;
  status: number;
  error?: string;
};

export type ReportDependencies = {
  tableName: string;
  now: () => Date;
  dynamo: CounterQuery;
  log: (entry: ReportLog) => void;
};

function json(statusCode: number, body: Record<string, unknown>): ReportResponse {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

function requestId(event: ReportEvent): string {
  const value = event.requestContext?.requestId;
  return value && REQUEST_ID.test(value) ? value : "unknown";
}

function routeKey(event: ReportEvent): string {
  if (event.routeKey && event.routeKey !== "$default") return event.routeKey;
  const method = event.requestContext?.http?.method ?? "";
  const path = event.requestContext?.http?.path ?? event.rawPath ?? "";
  return `${method} ${path}`;
}

function adminAccess(event: ReportEvent): "allow" | "denied" | "missing" {
  const claim = event.requestContext?.authorizer?.lambda?.hasAdmin;
  if (claim === undefined) return "missing";
  return claim === "true" ? "allow" : "denied";
}

export async function handleReport(event: ReportEvent, dependencies: ReportDependencies): Promise<ReportResponse> {
  const id = requestId(event);
  const route = routeKey(event);
  const finish = (statusCode: number, body: Record<string, unknown>, error?: string) => {
    dependencies.log({ requestId: id, route, status: statusCode, error });
    return json(statusCode, { ...body, requestId: id });
  };

  if (event.requestContext?.http?.method !== "GET") {
    return finish(405, { ok: false, error: "method_not_allowed" }, "method_not_allowed");
  }
  const access = adminAccess(event);
  if (access === "missing") return finish(401, { ok: false, error: "unauthorized" }, "unauthorized");
  if (access === "denied") return finish(403, { ok: false, error: "forbidden" }, "forbidden");
  if (!dependencies.tableName) return finish(503, { ok: false, error: "unavailable" }, "misconfigured");

  const query = event.queryStringParameters ?? {};
  const keys = Object.keys(query);
  if (keys.some((key) => !QUERY_KEYS.has(key))) {
    return finish(400, { ok: false, error: "invalid_date" }, "invalid_date");
  }
  const range = validateReportRange(query.start ?? "", query.end ?? "", dependencies.now());
  if (!range.ok) return finish(400, { ok: false, error: range.reason }, range.reason);

  let rows;
  try {
    rows = await readCounterRows(range.dates, dependencies.dynamo);
  } catch (error) {
    if (error instanceof CounterQueryError) {
      return finish(503, { ok: false, error: "unavailable" }, "query_failed");
    }
    throw error;
  }

  const report = aggregateStatistics(range.start, range.end, dependencies.now(), rows);
  if (report.status !== "ok") return finish(400, { ok: false, error: report.reason }, report.reason);
  return finish(200, {
    ok: true,
    period: {
      start: report.dates[0] ?? range.start,
      end: report.dates[report.dates.length - 1] ?? range.end,
      timeZone: REPORTING_TIME_ZONE,
    },
    pageViews: report.pageViews,
    visits: report.visits,
    daily: report.daily,
    countries: report.countries,
    countriesOther: report.countriesOther,
    paths: report.paths,
    pathsOther: report.pathsOther,
    sources: report.sources,
    devices: report.devices,
    browsers: report.browsers,
    partialDates: report.partialDates,
  });
}

export async function handler(event: ReportEvent): Promise<ReportResponse> {
  const tableName = process.env.TRAFFIC_STATS_TABLE_NAME?.trim() ?? "";
  return handleReport(event, {
    tableName,
    now: () => new Date(),
    dynamo: documentCounterQuery(tableName),
    log: (entry) => {
      console.info(JSON.stringify(entry));
    },
  });
}
