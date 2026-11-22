import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/routes";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function configured() {
  vi.stubEnv("ENVIRONMENT", "demo");
  vi.stubEnv("COGNITO_REGION", "eu-west-2");
  vi.stubEnv("COGNITO_USER_POOL_ID", "eu-west-2_demoPool");
  vi.stubEnv("COGNITO_CLIENT_ID", "democlient");
}

describe("protected health route", () => {
  it("returns success only when the authoriser context grants admin", async () => {
    configured();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const result = await api({
      routeKey: "GET /health",
      requestContext: {
        requestId: "req-health",
        authorizer: { lambda: { hasAdmin: "true" } },
      },
    });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      ok: true,
      status: "ok",
      service: "admin",
      requestId: "req-health",
    });
    expect(result.headers["cache-control"]).toBe("no-store");
  });

  it("rejects a health request that did not pass the authoriser", async () => {
    configured();
    const result = await api({
      routeKey: "GET /health",
      requestContext: { requestId: "req-open" },
    });
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toEqual({
      ok: false,
      error: "unauthorized",
      requestId: "req-open",
    });
  });

  it("rejects a health request whose authoriser context is not admin", async () => {
    configured();
    const result = await api({
      routeKey: "GET /health",
      requestContext: {
        requestId: "req-group",
        authorizer: { lambda: { hasAdmin: "false" } },
      },
    });
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      ok: false,
      error: "forbidden",
      requestId: "req-group",
    });
  });

  it("does not report healthy when environment configuration is missing", async () => {
    const result = await api({
      routeKey: "GET /health",
      requestContext: {
        requestId: "req-config",
        authorizer: { lambda: { hasAdmin: "true" } },
      },
    });
    expect(result.statusCode).toBe(503);
    expect(JSON.parse(result.body)).toEqual({
      ok: false,
      error: "unavailable",
      requestId: "req-config",
    });
  });
});
