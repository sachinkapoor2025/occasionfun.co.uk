import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ingestPageView } from "@/lib/analytics/recovery";
import { analyticsStores, type DynamoRequest } from "../src/dynamo-store";
import { handleCollect, MAX_COLLECT_BODY_BYTES } from "../src/handler";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function conflict(): Error {
  return Object.assign(new Error("exists"), { name: "ConditionalCheckFailedException" });
}

function memoryDynamo(): DynamoRequest & { items: Map<string, Record<string, unknown>>; calls: Array<Record<string, unknown>> } {
  const items = new Map<string, Record<string, unknown>>();
  const calls: Array<Record<string, unknown>> = [];
  const keyOf = (input: Record<string, unknown>) => {
    const key = input.Key as Record<string, string> | undefined;
    const item = input.Item as Record<string, string> | undefined;
    const visitorId = key?.visitorId ?? item?.visitorId ?? "";
    const sort = key?.eventSort ?? key?.itemKey ?? item?.eventSort ?? item?.itemKey ?? "";
    return `${input.TableName}|${visitorId}|${sort}`;
  };
  return {
    items,
    calls,
    async put(input) {
      calls.push(input);
      const id = keyOf(input);
      if (items.has(id)) throw conflict();
      items.set(id, { ...(input.Item as Record<string, unknown>) });
    },
    async get(input) {
      calls.push(input);
      return { Item: items.get(keyOf(input)) };
    },
    async update(input) {
      calls.push(input);
      const id = keyOf(input);
      if (String(input.ConditionExpression).includes("attribute_not_exists") && items.has(id)) throw conflict();
      if (!String(input.ConditionExpression).includes("attribute_not_exists") && !items.has(id)) throw conflict();
      const current = items.get(id) ?? { ...(input.Key as Record<string, unknown>) };
      items.set(id, { ...current, updated: true });
    },
    async query(input) {
      calls.push(input);
      if ("IndexName" in input || String(input.KeyConditionExpression).includes("Scan")) {
        throw new Error("index or scan");
      }
      return { Items: [] };
    },
  };
}

const event = {
  visitorId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  eventId: "33333333-3333-4333-8333-333333333333",
  occurredAt: "2026-11-24T11:59:00.000Z",
  pagePath: "/contact",
  source: "direct",
  deviceCategory: "desktop",
  browserCategory: "firefox",
  consent: {
    version: 1,
    value: "all",
    categories: { essential: true, analytics: true },
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
};

describe("analytics ingestion", () => {
  it("uses a conditional put and a strongly consistent read, and does not scan", () => {
    const source = readFileSync(path.join(packageRoot, "src/dynamo-store.ts"), "utf8");
    expect(source).not.toContain("Scan");
    expect(source).not.toContain("IndexName");
    expect(source).not.toContain("LEADS_TABLE_NAME");
    expect(source).toContain("ConsistentRead: true");
    expect(source).toContain('attribute_not_exists(visitorId)');
  });

  it("reads the existing guard consistently after a conditional put conflict", async () => {
    const dynamo = memoryDynamo();
    const stores = analyticsStores("visitors", "page-views", dynamo);
    await stores.pageViews.putGuard({
      visitorId: event.visitorId,
      eventSort: `ID#${event.eventId}`,
      eventId: event.eventId,
      payloadHash: "abc",
      eventItemSort: `${event.occurredAt}#${event.eventId}`,
      expiresAt: 1,
    });
    const again = await stores.pageViews.putGuard({
      visitorId: event.visitorId,
      eventSort: `ID#${event.eventId}`,
      eventId: event.eventId,
      payloadHash: "different",
      eventItemSort: `${event.occurredAt}#${event.eventId}`,
      expiresAt: 1,
    });
    expect(again).toBe("exists");
    const read = await stores.pageViews.getGuard(event.visitorId, event.eventId);
    expect(read.ok && read.item?.payloadHash).toBe("abc");
    expect(dynamo.calls.at(-1)?.ConsistentRead).toBe(true);
    const days = await stores.visitors.listDays(event.visitorId);
    expect(days).toEqual({ ok: true, item: [] });
    expect(dynamo.calls.at(-1)?.IndexName).toBeUndefined();
  });

  it("accepts one valid public event and rejects an oversized body", async () => {
    const dynamo = memoryDynamo();
    const now = new Date("2026-11-24T12:00:00.000Z");
    const accepted = await handleCollect(
      { body: JSON.stringify(event), requestContext: { http: { method: "POST" } } },
      { visitorsTable: "visitors", pageViewsTable: "page-views", dynamo, now: () => now },
    );
    expect(accepted.statusCode).toBe(202);
    expect(JSON.parse(accepted.body)).toEqual({ code: "accepted", retry: false });
    expect(accepted.headers["content-type"]).toBe("application/json");
    expect(accepted.body).not.toContain("page-views");

    const oversized = await handleCollect(
      {
        body: "x".repeat(MAX_COLLECT_BODY_BYTES + 1),
        requestContext: { http: { method: "POST" } },
      },
      { visitorsTable: "visitors", pageViewsTable: "page-views", dynamo, now: () => now },
    );
    expect(oversized.statusCode).toBe(413);
    expect(JSON.parse(oversized.body)).toEqual({
      code: "rejected",
      retry: false,
      reason: "invalid_body",
    });
    expect(oversized.body).not.toContain("page-views");
  });

  it("rejects an unsupported method and a missing table configuration", async () => {
    const dynamo = memoryDynamo();
    const now = () => new Date("2026-11-24T12:00:00.000Z");
    const method = await handleCollect(
      { body: JSON.stringify(event), requestContext: { http: { method: "GET" } } },
      { visitorsTable: "visitors", pageViewsTable: "page-views", dynamo, now },
    );
    expect(method.statusCode).toBe(405);
    expect(JSON.parse(method.body)).toEqual({ code: "rejected", retry: false });
    expect(method.body).not.toContain("visitors");

    const missing = await handleCollect(
      { body: JSON.stringify(event), requestContext: { http: { method: "POST" } } },
      { visitorsTable: "", pageViewsTable: "", dynamo, now },
    );
    expect(missing.statusCode).toBe(503);
    expect(JSON.parse(missing.body)).toEqual({ code: "event_unavailable", retry: true });
    expect(missing.body).not.toContain("page-views");
  });

  it("keeps retryable storage failures distinct from terminal event results", async () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    const dependencies = {
      visitorsTable: "visitors",
      pageViewsTable: "page-views",
      now: () => now,
    };
    const unavailable = memoryDynamo();
    unavailable.put = async () => {
      throw Object.assign(new Error("InternalServerError reading table visitors"), {
        name: "InternalServerError",
      });
    };
    const failed = await handleCollect(
      { body: JSON.stringify(event), requestContext: { http: { method: "POST" } } },
      { ...dependencies, dynamo: unavailable },
    );
    expect(failed.statusCode).toBe(503);
    expect(JSON.parse(failed.body)).toEqual({ code: "event_unavailable", retry: true });
    expect(failed.body).not.toContain("visitors");
    expect(failed.body).not.toContain("InternalServerError");

    const future = await handleCollect(
      {
        body: JSON.stringify({ ...event, occurredAt: "2026-11-24T12:06:00.000Z" }),
        requestContext: { http: { method: "POST" } },
      },
      { ...dependencies, dynamo: memoryDynamo() },
    );
    expect(future.statusCode).toBe(409);
    expect(JSON.parse(future.body)).toEqual({ code: "event_future", retry: false });

    const stale = await handleCollect(
      {
        body: JSON.stringify({ ...event, occurredAt: "2026-11-23T11:00:00.000Z" }),
        requestContext: { http: { method: "POST" } },
      },
      { ...dependencies, dynamo: memoryDynamo() },
    );
    expect(stale.statusCode).toBe(409);
    expect(JSON.parse(stale.body)).toEqual({ code: "event_stale", retry: false });

    const expiredDynamo = memoryDynamo();
    await expiredDynamo.put({
      TableName: "page-views",
      Item: {
        visitorId: event.visitorId,
        eventSort: `ID#${event.eventId}`,
        eventId: event.eventId,
        payloadHash: "stored-hash",
        eventItemSort: `${event.occurredAt}#${event.eventId}`,
        expiresAt: 1,
      },
    });
    const expired = await handleCollect(
      { body: JSON.stringify(event), requestContext: { http: { method: "POST" } } },
      { ...dependencies, dynamo: expiredDynamo },
    );
    expect(expired.statusCode).toBe(409);
    expect(JSON.parse(expired.body)).toEqual({ code: "event_expired", retry: false });

    const conflictDynamo = memoryDynamo();
    await conflictDynamo.put({
      TableName: "page-views",
      Item: {
        visitorId: event.visitorId,
        eventSort: `ID#${event.eventId}`,
        eventId: event.eventId,
        payloadHash: "stored-hash",
        eventItemSort: `${event.occurredAt}#${event.eventId}`,
        expiresAt: 2_000_000_000,
      },
    });
    const conflicted = await handleCollect(
      { body: JSON.stringify(event), requestContext: { http: { method: "POST" } } },
      { ...dependencies, dynamo: conflictDynamo },
    );
    expect(conflicted.statusCode).toBe(409);
    expect(JSON.parse(conflicted.body)).toEqual({ code: "event_conflict", retry: false });
    expect(conflicted.body).not.toContain("page-views");
    expect(conflicted.body).not.toContain("ConditionalCheckFailedException");
  });

  it("does not accept an event when the day-item query is incomplete", async () => {
    const dynamo = memoryDynamo();
    const laterDay = {
      visitorId: event.visitorId,
      itemKey: "DAY#2026-11-24",
      day: "2026-11-24",
      dayFirstAt: "2026-11-24T00:05:00.000Z",
      lastEventAt: "2026-11-24T00:05:00.000Z",
      firstSeenDay: "2026-11-24",
      newVisitor: true,
      source: "direct",
      landingPath: "/contact",
      expiresAt: 2_000_000_000,
    };
    dynamo.items.set(`visitors|${event.visitorId}|DAY#2026-11-24`, laterDay);
    dynamo.query = async (input) => {
      dynamo.calls.push(input);
      return {
        Items: [laterDay],
        LastEvaluatedKey: { visitorId: event.visitorId, itemKey: laterDay.itemKey },
      };
    };
    const now = new Date("2026-11-24T00:10:00.000Z");
    const stores = analyticsStores("visitors", "page-views", dynamo);
    expect(await stores.visitors.listDays(event.visitorId)).toEqual({ ok: false });
    const result = await ingestPageView(
      { ...event, occurredAt: "2026-11-23T23:58:00.000Z", pagePath: "/about" },
      stores,
      now,
    );
    expect(result).toEqual({ code: "event_unavailable", retry: true });
    expect(result.code).not.toBe("accepted");
    expect(dynamo.items.get(`visitors|${event.visitorId}|DAY#2026-11-24`)).toMatchObject({
      firstSeenDay: "2026-11-24",
      newVisitor: true,
    });
    const response = await handleCollect(
      {
        body: JSON.stringify({ ...event, occurredAt: "2026-11-23T23:58:00.000Z", pagePath: "/about" }),
        requestContext: { http: { method: "POST" } },
      },
      { visitorsTable: "visitors", pageViewsTable: "page-views", dynamo, now: () => now },
    );
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ code: "event_unavailable", retry: true });
  });
});
