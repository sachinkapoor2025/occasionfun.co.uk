import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { retentionInstant } from "@/lib/analytics/dates";
import { type CounterQuery } from "../src/counter-query";
import { handleReport, type ReportDependencies, type ReportEvent, type ReportLog } from "../src/report";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-11-24T12:00:00.000Z");
const LIVE = 2_000_000_000;
const VISITOR = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    statDay: "2026-11-24",
    statKey: "pv#GB#/contact#search#mobile#safari",
    metric: "page_view",
    country: "GB",
    pagePath: "/contact",
    source: "search",
    deviceCategory: "mobile",
    browserCategory: "safari",
    count: 1,
    expiresAt: LIVE,
    visitorId: VISITOR,
    sessionId: SESSION,
    ip: "203.0.113.10",
    referer: "https://secret.example/path",
    userAgent: "SecretAgent/1.0",
    ...overrides,
  };
}

function daysQuery(pages: Record<string, unknown>[][] = []): CounterQuery & { days: string[] } {
  const days: string[] = [];
  return {
    days,
    async queryDay(statDay) {
      days.push(statDay);
      const found = pages.find((page) => page[0]?.statDay === statDay);
      return { items: found ?? [] };
    },
  };
}

function harness(
  event: ReportEvent,
  dynamo: CounterQuery = daysQuery(),
  tableName = "occasionfun-co-uk-demo-traffic-stats",
): Promise<{ status: number; body: Record<string, unknown>; logs: ReportLog[] }> & {
  logs: ReportLog[];
} {
  const logs: ReportLog[] = [];
  const dependencies: ReportDependencies = {
    tableName,
    now: () => NOW,
    dynamo,
    log: (entry) => logs.push(entry),
  };
  const pending = handleReport(event, dependencies).then((response) => ({
    status: response.statusCode,
    body: JSON.parse(response.body) as Record<string, unknown>,
    logs,
  }));
  return Object.assign(pending, { logs });
}

function adminEvent(
  query: Record<string, string> | null,
  access: "allow" | "deny" | "missing" = "allow",
): ReportEvent {
  return {
    routeKey: "GET /analytics/summary",
    queryStringParameters: query,
    requestContext: {
      requestId: "req-1",
      http: { method: "GET", path: "/analytics/summary" },
      authorizer: access === "missing" ? {} : { lambda: { hasAdmin: access === "allow" ? "true" : "false" } },
    },
  };
}

describe("aggregate report API", () => {
  it("rejects a missing admin claim and does not query", async () => {
    const dynamo = daysQuery();
    const missing = await harness(adminEvent({ start: "2026-11-24", end: "2026-11-24" }, "missing"), dynamo);
    expect(missing.status).toBe(401);
    expect(missing.body).toMatchObject({ ok: false, error: "unauthorized" });
    expect(dynamo.days).toEqual([]);
  });

  it("rejects a non-admin claim and does not query", async () => {
    const dynamo = daysQuery();
    const denied = await harness(adminEvent({ start: "2026-11-24", end: "2026-11-24" }, "deny"), dynamo);
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ ok: false, error: "forbidden" });
    expect(dynamo.days).toEqual([]);
  });

  it("rejects an invalid, inverted, or future London date before querying", async () => {
    const dynamo = daysQuery();
    const invalid = await harness(adminEvent({ start: "2026-02-31", end: "2026-11-24" }), dynamo);
    const inverted = await harness(adminEvent({ start: "2026-11-24", end: "2026-11-01" }), dynamo);
    const future = await harness(adminEvent({ start: "2026-11-24", end: "2026-11-25" }), dynamo);
    expect(invalid.body).toMatchObject({ ok: false, error: "invalid_date" });
    expect(inverted.body).toMatchObject({ ok: false, error: "inverted" });
    expect(future.body).toMatchObject({ ok: false, error: "outside_window" });
    expect(dynamo.days).toEqual([]);
  });

  it("accepts the 90-day London window and rejects the day before it", async () => {
    const dynamo = daysQuery([[item({ statDay: "2026-08-27", pagePath: "/", count: 1 })]]);
    const full = await harness(adminEvent({ start: "2026-08-27", end: "2026-11-24" }), dynamo);
    expect(full.status).toBe(200);
    expect(full.body.pageViews).toBe(1);
    expect(dynamo.days).toHaveLength(90);
    expect(dynamo.days[0]).toBe("2026-08-27");
    expect(dynamo.days[89]).toBe("2026-11-24");
    expect(full.body.period).toEqual({
      start: "2026-08-27",
      end: "2026-11-24",
      timeZone: "Europe/London",
    });

    const early = daysQuery();
    const rejected = await harness(adminEvent({ start: "2026-08-26", end: "2026-11-24" }), early);
    expect(rejected.status).toBe(400);
    expect(rejected.body).toMatchObject({ ok: false, error: "outside_window" });
    expect(early.days).toEqual([]);
  });

  it("follows a continuation token and then stops", async () => {
    const seen: Array<string | undefined> = [];
    const dynamo: CounterQuery = {
      async queryDay(statDay, startKey) {
        seen.push(startKey ? "next" : "first");
        if (!startKey) {
          return { items: [item()], lastKey: { statDay, statKey: "a" } };
        }
        return { items: [item({ count: 4, pagePath: "/about", statKey: "b" })] };
      },
    };
    const result = await harness(adminEvent({ start: "2026-11-24", end: "2026-11-24" }), dynamo);
    expect(seen).toEqual(["first", "next"]);
    expect(result.status).toBe(200);
    expect(result.body.pageViews).toBe(5);
    expect(result.body.paths).toEqual([
      { name: "/about", count: 4 },
      { name: "/contact", count: 1 },
    ]);
  });

  it("drops an expired counter and keeps a later visit on the same day", async () => {
    const boundary = new Date("2027-01-22T23:00:00.000Z");
    const expiresAt = retentionInstant("2026-10-25");
    const dynamo = daysQuery([
      [
        item({ statDay: "2026-10-25", count: 5, expiresAt }),
        item({ statDay: "2026-10-25", metric: "visit", count: 2, expiresAt: expiresAt + 1 }),
      ],
    ]);
    const logs: ReportLog[] = [];
    const response = await handleReport(adminEvent({ start: "2026-10-25", end: "2026-10-25" }), {
      tableName: "occasionfun-co-uk-demo-traffic-stats",
      now: () => boundary,
      dynamo,
      log: (entry) => logs.push(entry),
    });
    const body = JSON.parse(response.body) as {
      pageViews: number;
      visits: number;
      partialDates: string[];
      daily: Array<{ date: string; pageViews: number; visits: number; partial: boolean }>;
    };
    expect(response.statusCode).toBe(200);
    expect(body.pageViews).toBe(0);
    expect(body.visits).toBe(2);
    expect(body.partialDates).toEqual(["2026-10-25"]);
    expect(body.daily).toEqual([{ date: "2026-10-25", pageViews: 0, visits: 2, partial: true }]);
  });

  it("returns an empty period when the table has no counters", async () => {
    const result = await harness(adminEvent({ start: "2026-11-24", end: "2026-11-24" }));
    expect(result.status).toBe(200);
    expect(result.body.pageViews).toBe(0);
    expect(result.body.visits).toBe(0);
    expect(result.body.daily).toEqual([{ date: "2026-11-24", pageViews: 0, visits: 0, partial: false }]);
    expect(result.body.countries).toEqual([]);
    expect(result.body.paths).toEqual([]);
  });

  it("returns totals only and leaves identifiers out of the body and the log", async () => {
    const dynamo = daysQuery([[item()]]);
    const result = await harness(adminEvent({ start: "2026-11-24", end: "2026-11-24" }), dynamo);
    const encoded = JSON.stringify(result.body) + JSON.stringify(result.logs);
    expect(result.status).toBe(200);
    expect(result.body.pageViews).toBe(1);
    expect(result.body.sources).toMatchObject({ search: 1 });
    expect(result.body.devices).toMatchObject({ mobile: 1 });
    expect(result.body.browsers).toMatchObject({ safari: 1 });
    expect(encoded).not.toContain(VISITOR);
    expect(encoded).not.toContain(SESSION);
    expect(encoded).not.toContain("203.0.113.10");
    expect(encoded).not.toContain("secret.example");
    expect(encoded).not.toContain("SecretAgent");
    expect(encoded).not.toContain("visitorId");
    expect(encoded).not.toContain("sessionId");
    expect(encoded).not.toContain("statKey");
  });

  it("does not query when the table name is missing", async () => {
    const dynamo = daysQuery();
    const result = await harness(adminEvent({ start: "2026-11-24", end: "2026-11-24" }), dynamo, "");
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ ok: false, error: "unavailable" });
    expect(dynamo.days).toEqual([]);
  });

  it("does not call Query by scanning the source", () => {
    const query = readFileSync(path.join(packageRoot, "src/counter-query.ts"), "utf8");
    const report = readFileSync(path.join(packageRoot, "src/report.ts"), "utf8");
    expect(query).toContain("QueryCommand");
    expect(query).not.toMatch(/\bScan/);
    expect(query).not.toContain("UpdateCommand");
    expect(query).not.toContain("PutCommand");
    expect(query).not.toContain("DeleteCommand");
    expect(report).not.toMatch(/\bScan/);
    expect(report).not.toContain("measure");
    expect(report).not.toContain("collector");
  });
});
