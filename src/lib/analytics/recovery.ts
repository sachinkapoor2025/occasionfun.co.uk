/**
 * Guard and event recovery decisions.
 * Store methods stand in for conditional writes and strongly consistent reads.
 * This module does not call AWS.
 */

import { validateEvent, type RejectReason, type SanitisedEvent } from "./event";
import {
  mergeDay,
  mergeProfile,
  planDayCorrections,
  type DayRecord,
  type VisitorProfile,
} from "./visitor";

const FUTURE_MS = 5 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;
const CAS_ATTEMPTS = 5;

export type IngestCode =
  | "accepted"
  | "rejected"
  | "event_future"
  | "event_stale"
  | "event_expired"
  | "event_conflict"
  | "event_unavailable";

export type IngestResult = {
  code: IngestCode;
  retry: boolean;
  reason?: RejectReason;
};

export type GuardRecord = {
  visitorId: string;
  eventSort: `ID#${string}`;
  eventId: string;
  payloadHash: string;
  eventItemSort: string;
  expiresAt: number;
};

export type StoredEvent = SanitisedEvent & {
  visitorId: string;
  eventSort: string;
};

export type ReadResult<T> = { ok: true; item: T | null } | { ok: false };

export type PutResult = "created" | "exists" | "failed";
export type CompareResult = "applied" | "conflict" | "failed";

type Maybe<T> = T | Promise<T>;

/** Reads are the strongly consistent base-table reads. Index reads are not part of this contract. */
export interface PageViewStore {
  putGuard(guard: GuardRecord): Maybe<PutResult>;
  getGuard(visitorId: string, eventId: string): Maybe<ReadResult<GuardRecord>>;
  putEvent(event: StoredEvent): Maybe<PutResult>;
  getEvent(visitorId: string, eventSort: string): Maybe<ReadResult<StoredEvent>>;
}

export interface VisitorStateStore {
  getProfile(visitorId: string): Maybe<ReadResult<VisitorProfile>>;
  compareProfile(expected: VisitorProfile | null, next: VisitorProfile): Maybe<CompareResult>;
  getDay(visitorId: string, day: string): Maybe<ReadResult<DayRecord>>;
  compareDay(expected: DayRecord | null, next: DayRecord): Maybe<CompareResult>;
  listDays(visitorId: string): Maybe<ReadResult<DayRecord[]>>;
}

export function guardFor(event: SanitisedEvent): GuardRecord {
  return {
    visitorId: event.visitorId,
    eventSort: `ID#${event.eventId}`,
    eventId: event.eventId,
    payloadHash: event.payloadHash,
    eventItemSort: event.eventSort,
    expiresAt: event.expiresAt,
  };
}

export function newGuardRejection(occurredAt: string, expiresAt: number, now: Date): "event_future" | "event_stale" | null {
  const occurredMs = Date.parse(occurredAt);
  const nowMs = now.getTime();
  if (occurredMs - nowMs > FUTURE_MS) return "event_future";
  const nowSeconds = Math.floor(nowMs / 1000);
  if (nowMs - occurredMs > STALE_MS || expiresAt <= nowSeconds) return "event_stale";
  return null;
}

export function guardMatches(existing: GuardRecord, expected: GuardRecord): boolean {
  return (
    existing.visitorId === expected.visitorId &&
    existing.eventSort === expected.eventSort &&
    existing.eventId === expected.eventId &&
    existing.payloadHash === expected.payloadHash &&
    existing.eventItemSort === expected.eventItemSort &&
    existing.expiresAt === expected.expiresAt
  );
}

export function eventMatchesGuard(existing: StoredEvent, guard: GuardRecord): boolean {
  const occurredAt = guard.eventItemSort.split("#")[0] ?? "";
  return (
    existing.visitorId === guard.visitorId &&
    existing.payloadHash === guard.payloadHash &&
    existing.eventSort === guard.eventItemSort &&
    existing.eventId === guard.eventId &&
    existing.occurredAt === occurredAt &&
    existing.expiresAt === guard.expiresAt
  );
}

function stop(code: IngestCode, retry = false): IngestResult {
  return { code, retry };
}

function profilesEqual(left: VisitorProfile, right: VisitorProfile): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function daysEqual(left: DayRecord, right: DayRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function loadGuard(
  store: PageViewStore,
  expected: GuardRecord,
  nowSeconds: number,
): Promise<{ ok: true; guard: GuardRecord } | { ok: false; result: IngestResult }> {
  const read = await store.getGuard(expected.visitorId, expected.eventId);
  if (!read.ok || read.item === null) return { ok: false, result: stop("event_unavailable", true) };
  if (read.item.expiresAt <= nowSeconds) return { ok: false, result: stop("event_expired") };
  if (!guardMatches(read.item, expected)) return { ok: false, result: stop("event_conflict") };
  return { ok: true, guard: read.item };
}

function eventFromGuard(event: SanitisedEvent, guard: GuardRecord): StoredEvent {
  const occurredAt = guard.eventItemSort.split("#")[0] ?? event.occurredAt;
  return {
    ...event,
    occurredAt,
    eventSort: guard.eventItemSort,
    payloadHash: guard.payloadHash,
    expiresAt: guard.expiresAt,
  };
}

async function ensureEvent(
  store: PageViewStore,
  event: StoredEvent,
  guard: GuardRecord,
  nowSeconds: number,
): Promise<IngestResult | null> {
  const put = await store.putEvent(event);
  if (put === "failed") return stop("event_unavailable", true);
  if (put === "created") return null;
  const read = await store.getEvent(event.visitorId, guard.eventItemSort);
  if (!read.ok || read.item === null) return stop("event_unavailable", true);
  if (read.item.expiresAt <= nowSeconds) return stop("event_expired");
  if (!eventMatchesGuard(read.item, guard)) return stop("event_conflict");
  return null;
}

async function applyProfile(
  store: VisitorStateStore,
  event: SanitisedEvent,
  now: Date,
): Promise<{ ok: true; previous: VisitorProfile | null; next: VisitorProfile } | { ok: false }> {
  for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
    const read = await store.getProfile(event.visitorId);
    if (!read.ok) return { ok: false };
    const next = mergeProfile(read.item, event, now);
    if (read.item && profilesEqual(read.item, next)) {
      return { ok: true, previous: read.item, next };
    }
    const written = await store.compareProfile(read.item, next);
    if (written === "applied") return { ok: true, previous: read.item, next };
    if (written === "failed") return { ok: false };
  }
  return { ok: false };
}

async function applyDay(store: VisitorStateStore, event: SanitisedEvent, profile: VisitorProfile): Promise<boolean> {
  for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
    const read = await store.getDay(event.visitorId, event.eventDay);
    if (!read.ok) return false;
    const next = mergeDay(read.item, event, profile.firstSeenDay);
    if (read.item && daysEqual(read.item, next)) return true;
    const written = await store.compareDay(read.item, next);
    if (written === "applied") return true;
    if (written === "failed") return false;
  }
  return false;
}

async function applyCorrections(store: VisitorStateStore, visitorId: string, corrected: string): Promise<boolean> {
  const listed = await store.listDays(visitorId);
  if (!listed.ok) return false;
  const days = listed.item ?? [];
  for (const correction of planDayCorrections(days, corrected)) {
    let applied = false;
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
      const current = await store.getDay(visitorId, correction.next.day);
      if (!current.ok || current.item === null) return false;
      if (
        current.item.firstSeenDay === correction.next.firstSeenDay &&
        current.item.newVisitor === correction.next.newVisitor
      ) {
        applied = true;
        break;
      }
      const next = {
        ...current.item,
        firstSeenDay: corrected,
        newVisitor: current.item.day === corrected,
      };
      const written = await store.compareDay(current.item, next);
      if (written === "applied") {
        applied = true;
        break;
      }
      if (written === "failed") return false;
    }
    if (!applied) return false;
  }
  return true;
}

async function repairVisitor(store: VisitorStateStore, event: SanitisedEvent, now: Date): Promise<boolean> {
  const profile = await applyProfile(store, event, now);
  if (!profile.ok) return false;
  if (!await applyDay(store, event, profile.next)) return false;
  // Corrections depend on the stored day copies, not on whether this attempt moved the profile.
  return applyCorrections(store, event.visitorId, profile.next.firstSeenDay);
}

export async function ingestPageView(
  body: unknown,
  stores: { pageViews: PageViewStore; visitors: VisitorStateStore },
  now: Date,
): Promise<IngestResult> {
  const validated = validateEvent(body, now);
  if (!validated.ok) return { code: "rejected", retry: false, reason: validated.reason };
  const event = validated.event;
  const expected = guardFor(event);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const rejection = newGuardRejection(event.occurredAt, event.expiresAt, now);
  if (rejection === "event_future") return stop("event_future");

  let guard: GuardRecord;
  if (rejection === "event_stale") {
    const read = await stores.pageViews.getGuard(event.visitorId, event.eventId);
    if (!read.ok) return stop("event_unavailable", true);
    if (read.item === null) return stop("event_stale");
    if (read.item.expiresAt <= nowSeconds) return stop("event_expired");
    if (!guardMatches(read.item, expected)) return stop("event_conflict");
    guard = read.item;
  } else {
    const put = await stores.pageViews.putGuard(expected);
    if (put === "failed") return stop("event_unavailable", true);
    if (put === "created") {
      guard = expected;
    } else {
      const existing = await loadGuard(stores.pageViews, expected, nowSeconds);
      if (!existing.ok) return existing.result;
      guard = existing.guard;
    }
  }

  const eventFailure = await ensureEvent(stores.pageViews, eventFromGuard(event, guard), guard, nowSeconds);
  if (eventFailure) return eventFailure;
  if (!await repairVisitor(stores.visitors, event, now)) return stop("event_unavailable", true);
  return stop("accepted");
}
