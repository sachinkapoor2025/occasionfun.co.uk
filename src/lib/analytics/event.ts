/**
 * Event validation plus the deterministic payload hash.
 * Hashing uses node:crypto, so browser code must import event-core.ts instead.
 * Pure functions. No AWS calls and no browser storage.
 */

import { createHash } from "node:crypto";

import { sanitiseEvent, type EventDraft, type RejectReason } from "./event-core";

export type {
  BrowserCategory,
  DeviceCategory,
  EventDraft,
  RejectReason,
  TrafficSource,
} from "./event-core";

export {
  BROWSER_VALUES,
  DEVICE_VALUES,
  SOURCE_VALUES,
  allowedPagePaths,
  normaliseIdentifier,
  normalisePagePath,
  normaliseReferrer,
  sanitiseEvent,
} from "./event-core";

const HASH_FIELDS = [
  "visitorId",
  "eventId",
  "occurredAt",
  "sessionId",
  "pagePath",
  "source",
  "referrerHost",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
  "deviceCategory",
  "browserCategory",
] as const;

export type SanitisedEvent = EventDraft & {
  payloadHash: string;
};

export type EventValidation =
  | { ok: true; event: SanitisedEvent }
  | { ok: false; reason: RejectReason };

export function payloadHash(event: Pick<EventDraft, (typeof HASH_FIELDS)[number]>): string {
  const canonical: Record<string, string> = {};
  for (const field of HASH_FIELDS) {
    const value = event[field];
    if (value !== undefined) canonical[field] = value;
  }
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function validateEvent(body: unknown, now: Date): EventValidation {
  const result = sanitiseEvent(body, now);
  if (!result.ok) return result;
  return {
    ok: true,
    event: {
      ...result.event,
      payloadHash: payloadHash(result.event),
    },
  };
}
