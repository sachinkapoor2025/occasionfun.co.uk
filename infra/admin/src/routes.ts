import { readAuthConfig } from "./config";
import { jsonResult, logEvent, type HttpResult } from "./http";

export type ApiEvent = {
  routeKey?: string;
  rawPath?: string;
  requestContext?: {
    requestId?: string;
    http?: { method?: string; path?: string };
    authorizer?: { lambda?: { hasAdmin?: unknown } };
  };
};

type Route = (requestId: string) => HttpResult;

const routes: Record<string, Route> = {
  "GET /health": (requestId) =>
    jsonResult(200, {
      ok: true,
      status: "ok",
      service: "admin",
      requestId,
    }),
};

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

export async function api(event: ApiEvent): Promise<HttpResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const key = routeKey(event);
  const route = routes[key];
  if (!route) {
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
  const result = route(requestId);
  logEvent({ requestId, route: key, status: result.statusCode });
  return result;
}
