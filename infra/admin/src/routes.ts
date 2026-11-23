import { readAuthConfig } from "./config";
import { createDynamoEnquiryStore, EnquiryUnavailable } from "./enquiry-dynamo";
import {
  encodeCursor,
  isEnquiryId,
  NOTIFICATION_STATUSES,
  parseEnquiryQuery,
  reviewStatus,
  toEnquiry,
  type EnquiryStore,
} from "./enquiries";
import { jsonResult, logEvent, type HttpResult } from "./http";

export type ApiEvent = {
  routeKey?: string;
  rawPath?: string;
  body?: string;
  isBase64Encoded?: boolean;
  pathParameters?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext?: {
    requestId?: string;
    http?: { method?: string; path?: string };
    authorizer?: { lambda?: { hasAdmin?: unknown } };
  };
};

type EnquiryRoute = (event: ApiEvent, store: EnquiryStore, requestId: string) => Promise<HttpResult>;

export async function api(event: ApiEvent, store?: EnquiryStore): Promise<HttpResult>;
export async function api(event: ApiEvent, store?: unknown): Promise<HttpResult>;
export async function api(event: ApiEvent, store?: unknown): Promise<HttpResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const key = routeKey(event);
  const health = key === "GET /health";
  const enquiry = enquiryRoute(key);
  if (!health && !enquiry) {
    logEvent({ requestId, route: key, status: 404, error: "not_found" });
    return jsonResult(404, { ok: false, error: "not_found", requestId });
  }
  if (!readAuthConfig()) {
    logEvent({ requestId, route: key, status: 503, error: "misconfigured" });
    return jsonResult(503, { ok: false, error: "unavailable", requestId });
  }
  const access = adminAccess(event);
  if (access === "missing") {
    logEvent({ requestId, route: key, status: 401, error: "unauthorized" });
    return jsonResult(401, { ok: false, error: "unauthorized", requestId });
  }
  if (access === "denied") {
    logEvent({ requestId, route: key, status: 403, error: "forbidden" });
    return jsonResult(403, { ok: false, error: "forbidden", requestId });
  }
  if (health) {
    const result = jsonResult(200, {
      ok: true,
      status: "ok",
      service: "admin",
      requestId,
    });
    logEvent({ requestId, route: key, status: result.statusCode });
    return result;
  }
  try {
    const result = await enquiry!(event, storeFor(store), requestId);
    logEvent({ requestId, route: key, status: result.statusCode });
    return result;
  } catch (error) {
    if (error instanceof EnquiryUnavailable) {
      logEvent({ requestId, route: key, status: 503, error: "enquiry_unavailable" });
      return jsonResult(503, { ok: false, error: "enquiry_unavailable", requestId });
    }
    throw error;
  }
}

function routeKey(event: ApiEvent): string {
  if (event.routeKey && event.routeKey !== "$default") return event.routeKey;
  const method = event.requestContext?.http?.method ?? "";
  const path = event.requestContext?.http?.path ?? event.rawPath ?? "";
  return `${method} ${path}`;
}

function adminAccess(event: ApiEvent): "allow" | "denied" | "missing" {
  const claim = event.requestContext?.authorizer?.lambda?.hasAdmin;
  if (claim === undefined) return "missing";
  return claim === "true" ? "allow" : "denied";
}

function isEnquiryStore(value: unknown): value is EnquiryStore {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.count === "function" &&
    typeof candidate.list === "function" &&
    typeof candidate.get === "function" &&
    typeof candidate.setReview === "function"
  );
}

function storeFor(store: unknown): EnquiryStore {
  if (isEnquiryStore(store)) return store;
  const table = process.env.LEADS_TABLE_NAME?.trim();
  if (!table) throw new EnquiryUnavailable();
  return createDynamoEnquiryStore(table);
}

function enquiryRoute(key: string): EnquiryRoute | null {
  if (key === "GET /enquiries/summary") return summary;
  if (key === "GET /enquiries") return list;
  if (key === "GET /enquiries/{idempotencyKey}") return detail;
  if (key === "PATCH /enquiries/{idempotencyKey}") return review;
  return null;
}

async function summary(_event: ApiEvent, store: EnquiryStore, requestId: string): Promise<HttpResult> {
  const counts = await Promise.all(NOTIFICATION_STATUSES.map((status) => store.count(status)));
  const byNotificationStatus = {
    pending: counts[0],
    sending: counts[1],
    sent: counts[2],
    failed: counts[3],
  };
  return jsonResult(200, {
    ok: true,
    total: counts.reduce((sum, count) => sum + count, 0),
    byNotificationStatus,
    requestId,
  });
}

async function list(event: ApiEvent, store: EnquiryStore, requestId: string): Promise<HttpResult> {
  const parsed = parseEnquiryQuery(event.queryStringParameters);
  if ("error" in parsed) {
    return jsonResult(400, { ok: false, error: parsed.error, requestId });
  }
  const page = await store.list(parsed.query);
  return jsonResult(200, {
    ok: true,
    items: page.items.map((item) => toEnquiry(item, true)),
    cursor: page.cursor ? encodeCursor(parsed.query.status, page.cursor) : null,
    requestId,
  });
}

async function detail(event: ApiEvent, store: EnquiryStore, requestId: string): Promise<HttpResult> {
  const id = event.pathParameters?.idempotencyKey ?? "";
  if (!isEnquiryId(id)) return jsonResult(400, { ok: false, error: "invalid_id", requestId });
  const item = await store.get(id);
  if (!item) return jsonResult(404, { ok: false, error: "not_found", requestId });
  return jsonResult(200, { ok: true, enquiry: toEnquiry(item, false), requestId });
}

async function review(event: ApiEvent, store: EnquiryStore, requestId: string): Promise<HttpResult> {
  const id = event.pathParameters?.idempotencyKey ?? "";
  if (!isEnquiryId(id)) return jsonResult(400, { ok: false, error: "invalid_id", requestId });
  const next = reviewChange(event.body, event.isBase64Encoded);
  if (!next) return jsonResult(400, { ok: false, error: "invalid_review", requestId });
  const item = await store.setReview(id, next, new Date().toISOString());
  if (!item) return jsonResult(404, { ok: false, error: "not_found", requestId });
  return jsonResult(200, { ok: true, enquiry: toEnquiry(item, false), requestId });
}

function reviewChange(body: string | undefined, encoded: boolean | undefined): "new" | "reviewed" | "closed" | null {
  if (!body) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded ? Buffer.from(body, "base64").toString("utf8") : body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.reviewStatus !== "string") return null;
  return reviewStatus(record.reviewStatus);
}
