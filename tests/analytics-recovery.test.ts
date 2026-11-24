import { describe, expect, it } from "vitest";

import { validateEvent } from "@/lib/analytics/event";
import {
  ingestPageView,
  type GuardRecord,
  type PageViewStore,
  type StoredEvent,
  type VisitorStateStore,
} from "@/lib/analytics/recovery";
import type { DayRecord, VisitorProfile } from "@/lib/analytics/visitor";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const VISITOR = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";

function payload(eventId: string, occurredAt: string, pagePath = "/contact") {
  return {
    visitorId: VISITOR,
    sessionId: SESSION,
    eventId,
    occurredAt,
    pagePath,
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
}

class Memory {
  calls: string[] = [];
  guards = new Map<string, GuardRecord>();
  events = new Map<string, StoredEvent>();
  profiles = new Map<string, VisitorProfile>();
  days = new Map<string, DayRecord>();
  failGuardRead = false;
  failEventRead = false;
  profileConflicts = 0;
  failDayClears = 0;
  dayList: "items" | "empty" | "unreadable" = "items";

  readonly pageViews: PageViewStore = {
    putGuard: (guard) => {
      this.calls.push("putGuard");
      const key = `${guard.visitorId}|${guard.eventSort}`;
      if (this.guards.has(key)) return "exists";
      this.guards.set(key, structuredClone(guard));
      return "created";
    },
    getGuard: (visitorId, eventId) => {
      this.calls.push("getGuard");
      if (this.failGuardRead) return { ok: false };
      return { ok: true, item: this.guards.get(`${visitorId}|ID#${eventId}`) ?? null };
    },
    putEvent: (event) => {
      this.calls.push("putEvent");
      const key = `${event.visitorId}|${event.eventSort}`;
      if (this.events.has(key)) return "exists";
      this.events.set(key, structuredClone(event));
      return "created";
    },
    getEvent: (visitorId, eventSort) => {
      this.calls.push("getEvent");
      if (this.failEventRead) return { ok: false };
      return { ok: true, item: this.events.get(`${visitorId}|${eventSort}`) ?? null };
    },
  };

  readonly visitors: VisitorStateStore = {
    getProfile: (visitorId) => ({ ok: true, item: this.profiles.get(visitorId) ?? null }),
    compareProfile: (expected, next) => {
      this.calls.push("compareProfile");
      if (this.profileConflicts > 0) {
        this.profileConflicts -= 1;
        return "conflict";
      }
      const current = this.profiles.get(next.visitorId) ?? null;
      if (JSON.stringify(current) !== JSON.stringify(expected)) return "conflict";
      this.profiles.set(next.visitorId, structuredClone(next));
      return "applied";
    },
    getDay: (visitorId, day) => ({
      ok: true,
      item: this.days.get(`${visitorId}|${day}`) ?? null,
    }),
    compareDay: (expected, next) => {
      this.calls.push(`compareDay:${next.day}:${next.newVisitor}`);
      if (this.failDayClears > 0 && next.newVisitor === false) {
        this.failDayClears -= 1;
        return "failed";
      }
      const key = `${next.visitorId}|${next.day}`;
      const current = this.days.get(key) ?? null;
      if (JSON.stringify(current) !== JSON.stringify(expected)) return "conflict";
      this.days.set(key, structuredClone(next));
      return "applied";
    },
    listDays: (visitorId) => {
      if (this.dayList === "unreadable") return { ok: false };
      if (this.dayList === "empty") return { ok: true, item: null };
      return {
        ok: true,
        item: [...this.days.values()].filter((day) => day.visitorId === visitorId),
      };
    },
  };

  ingest(body: unknown, now = NOW) {
    return ingestPageView(body, { pageViews: this.pageViews, visitors: this.visitors }, now);
  }
}

describe("event recovery", () => {
  it("stores one event and treats the same payload as a repair, not a second event", async () => {
    const memory = new Memory();
    const body = payload("33333333-3333-4333-8333-333333333333", "2026-11-24T11:59:00.000Z");
    expect(await memory.ingest(body)).toEqual({ code: "accepted", retry: false });
    expect(memory.calls).toEqual(["putGuard", "putEvent", "compareProfile", "compareDay:2026-11-24:true"]);
    memory.calls = [];
    expect(await memory.ingest(body)).toEqual({ code: "accepted", retry: false });
    expect(memory.events.size).toBe(1);
    expect(memory.calls).toEqual(["putGuard", "getGuard", "putEvent", "getEvent"]);
    expect(memory.profiles.get(VISITOR)?.firstLandingPath).toBe("/contact");
  });

  it("returns a terminal conflict for a different payload and does not update the visitor", async () => {
    const memory = new Memory();
    const eventId = "33333333-3333-4333-8333-333333333333";
    expect((await memory.ingest(payload(eventId, "2026-11-24T11:59:00.000Z", "/contact"))).code).toBe("accepted");
    memory.calls = [];
    const conflict = await memory.ingest(payload(eventId, "2026-11-24T11:59:00.000Z", "/about"));
    expect(conflict).toEqual({ code: "event_conflict", retry: false });
    expect(memory.calls).toEqual(["putGuard", "getGuard"]);
    expect(memory.events.size).toBe(1);
    expect([...memory.events.values()][0]?.pagePath).toBe("/contact");
    expect(memory.profiles.get(VISITOR)?.latestPath).toBe("/contact");
  });

  it("returns retryable event_unavailable when a consistent read is empty", async () => {
    const body = payload("33333333-3333-4333-8333-333333333333", "2026-11-24T11:59:00.000Z");
    const visitors: VisitorStateStore = {
      getProfile: () => { throw new Error("profile read"); },
      compareProfile: () => { throw new Error("profile write"); },
      getDay: () => { throw new Error("day read"); },
      compareDay: () => { throw new Error("day write"); },
      listDays: () => { throw new Error("day list"); },
    };
    const missingGuard = await ingestPageView(body, {
      pageViews: {
        putGuard: () => "exists",
        getGuard: () => ({ ok: true, item: null }),
        putEvent: () => { throw new Error("event write"); },
        getEvent: () => { throw new Error("event read"); },
      },
      visitors,
    }, NOW);
    expect(missingGuard).toEqual({ code: "event_unavailable", retry: true });

    const missingEvent = await ingestPageView(body, {
      pageViews: {
        putGuard: () => "created",
        getGuard: () => { throw new Error("guard read"); },
        putEvent: () => "exists",
        getEvent: () => ({ ok: true, item: null }),
      },
      visitors,
    }, NOW);
    expect(missingEvent).toEqual({ code: "event_unavailable", retry: true });
  });

  it("returns retryable event_unavailable when the consistent read cannot be completed", async () => {
    const memory = new Memory();
    const eventId = "33333333-3333-4333-8333-333333333333";
    const body = payload(eventId, "2026-11-24T11:59:00.000Z");
    expect((await memory.ingest(body)).code).toBe("accepted");
    memory.failGuardRead = true;
    memory.calls = [];
    expect(await memory.ingest(body)).toEqual({ code: "event_unavailable", retry: true });
    expect(memory.calls).toEqual(["putGuard", "getGuard"]);
    memory.failGuardRead = false;
    memory.failEventRead = true;
    expect(await memory.ingest(body)).toEqual({ code: "event_unavailable", retry: true });
    expect(memory.profiles.get(VISITOR)?.firstSeenAt).toBe("2026-11-24T11:59:00.000Z");
  });

  it("does not recreate an expired guard or update visitor statistics", async () => {
    const memory = new Memory();
    const eventId = "44444444-4444-4444-8444-444444444444";
    const occurredAt = "2026-08-01T12:00:00.000Z";
    const validated = validateEvent(payload(eventId, occurredAt), NOW);
    if (!validated.ok) throw new Error(validated.reason);
    memory.guards.set(`${VISITOR}|ID#${eventId}`, {
      visitorId: VISITOR,
      eventSort: `ID#${eventId}`,
      eventId,
      payloadHash: validated.event.payloadHash,
      eventItemSort: validated.event.eventSort,
      expiresAt: validated.event.expiresAt,
    });
    expect(await memory.ingest(payload(eventId, occurredAt))).toEqual({ code: "event_expired", retry: false });
    expect(memory.calls).toEqual(["getGuard"]);
    expect(memory.events.size).toBe(0);
    expect(memory.profiles.size).toBe(0);
  });

  it("repairs a live matching guard without rewriting it, and keeps an unfinished visitor retryable", async () => {
    const memory = new Memory();
    const eventId = "55555555-5555-4555-8555-555555555555";
    const occurredAt = "2026-11-23T11:00:00.000Z";
    const validated = validateEvent(payload(eventId, occurredAt, "/trust"), NOW);
    if (!validated.ok) throw new Error(validated.reason);
    memory.guards.set(`${VISITOR}|ID#${eventId}`, {
      visitorId: VISITOR,
      eventSort: `ID#${eventId}`,
      eventId,
      payloadHash: validated.event.payloadHash,
      eventItemSort: validated.event.eventSort,
      expiresAt: validated.event.expiresAt,
    });
    memory.profiles.set(VISITOR, {
      visitorId: VISITOR,
      itemKey: "PROFILE",
      firstSeenAt: "2026-11-24T11:50:00.000Z",
      lastSeenAt: "2026-11-24T11:50:00.000Z",
      firstSeenDay: "2026-11-24",
      lastSeenDay: "2026-11-24",
      firstLandingPath: "/contact",
      latestPath: "/contact",
      firstSource: "direct",
      latestSource: "direct",
      expiresAt: validated.event.expiresAt,
    });
    expect((await memory.ingest(payload(eventId, occurredAt, "/trust"))).code).toBe("accepted");
    expect(memory.calls[0]).toBe("getGuard");
    expect(memory.calls).not.toContain("putGuard");
    expect(memory.profiles.get(VISITOR)?.firstSeenAt).toBe("2026-11-24T11:50:00.000Z");
    expect(memory.profiles.get(VISITOR)?.lastSeenAt).toBe("2026-11-24T11:50:00.000Z");

    const blocked = new Memory();
    blocked.profileConflicts = 5;
    expect(await blocked.ingest(payload(eventId, "2026-11-24T11:59:00.000Z"))).toEqual({
      code: "event_unavailable",
      retry: true,
    });
    expect(blocked.events.size).toBe(1);
    expect(blocked.profiles.size).toBe(0);
  });

  it("corrects an earlier London day before clearing the previous new-visitor day", async () => {
    const memory = new Memory();
    const now = new Date("2026-11-24T00:10:00.000Z");
    const later = "66666666-6666-4666-8666-666666666666";
    const earlier = "77777777-7777-4777-8777-777777777777";
    expect((await memory.ingest(payload(later, "2026-11-24T00:05:00.000Z", "/contact"), now)).code).toBe("accepted");
    expect((await memory.ingest(payload(earlier, "2026-11-23T23:58:00.000Z", "/about"), now)).code).toBe("accepted");
    expect(memory.profiles.get(VISITOR)?.firstSeenDay).toBe("2026-11-23");
    expect(memory.days.get(`${VISITOR}|2026-11-23`)?.newVisitor).toBe(true);
    expect(memory.days.get(`${VISITOR}|2026-11-24`)?.newVisitor).toBe(false);
    expect(memory.days.get(`${VISITOR}|2026-11-24`)?.firstSeenDay).toBe("2026-11-23");
    const correction = memory.calls.filter((call) => call.startsWith("compareDay:"));
    const markedNew = correction.lastIndexOf("compareDay:2026-11-23:true");
    const cleared = correction.lastIndexOf("compareDay:2026-11-24:false");
    expect(markedNew).toBeGreaterThanOrEqual(0);
    expect(cleared).toBeGreaterThan(markedNew);
  });

  it("finishes an outstanding day correction when the retried profile no longer moves", async () => {
    const memory = new Memory();
    const now = new Date("2026-11-24T00:10:00.000Z");
    const eventId = "88888888-8888-4888-8888-888888888888";
    const body = payload(eventId, "2026-11-23T23:58:00.000Z", "/about");
    memory.profiles.set(VISITOR, {
      visitorId: VISITOR,
      itemKey: "PROFILE",
      firstSeenAt: "2026-11-24T00:05:00.000Z",
      lastSeenAt: "2026-11-24T00:05:00.000Z",
      firstSeenDay: "2026-11-24",
      lastSeenDay: "2026-11-24",
      firstLandingPath: "/contact",
      latestPath: "/contact",
      firstSource: "direct",
      latestSource: "direct",
      expiresAt: 2_000_000_000,
    });
    memory.days.set(`${VISITOR}|2026-11-24`, {
      visitorId: VISITOR,
      itemKey: "DAY#2026-11-24",
      day: "2026-11-24",
      dayFirstAt: "2026-11-24T00:05:00.000Z",
      lastEventAt: "2026-11-24T00:05:00.000Z",
      firstSeenDay: "2026-11-24",
      newVisitor: true,
      source: "direct",
      landingPath: "/contact",
      expiresAt: 2_000_000_000,
    });
    memory.failDayClears = 1;

    expect(await memory.ingest(body, now)).toEqual({ code: "event_unavailable", retry: true });
    expect(memory.profiles.get(VISITOR)?.firstSeenDay).toBe("2026-11-23");
    expect(memory.days.get(`${VISITOR}|2026-11-23`)?.newVisitor).toBe(true);
    expect(memory.days.get(`${VISITOR}|2026-11-24`)).toMatchObject({
      firstSeenDay: "2026-11-24",
      newVisitor: true,
    });

    expect(await memory.ingest(body, now)).toEqual({ code: "accepted", retry: false });
    expect(memory.days.get(`${VISITOR}|2026-11-23`)?.newVisitor).toBe(true);
    expect(memory.days.get(`${VISITOR}|2026-11-24`)).toMatchObject({
      firstSeenDay: "2026-11-23",
      newVisitor: false,
    });

    memory.calls = [];
    expect(await memory.ingest(body, now)).toEqual({ code: "accepted", retry: false });
    expect(memory.calls.some((call) => call.startsWith("compare"))).toBe(false);
  });

  it("treats an empty day list as nothing to correct and an unreadable list as unavailable", async () => {
    const empty = new Memory();
    empty.dayList = "empty";
    const body = payload("99999999-9999-4999-8999-999999999999", "2026-11-24T11:59:00.000Z");
    expect(await empty.ingest(body)).toEqual({ code: "accepted", retry: false });
    expect(empty.days.get(`${VISITOR}|2026-11-24`)?.newVisitor).toBe(true);

    const unreadable = new Memory();
    unreadable.dayList = "unreadable";
    expect(await unreadable.ingest(body)).toEqual({ code: "event_unavailable", retry: true });
  });
});
