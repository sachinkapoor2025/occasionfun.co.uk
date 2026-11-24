import { describe, expect, it } from "vitest";

import { payloadHash, validateEvent } from "@/lib/analytics/event";
import { newGuardRejection } from "@/lib/analytics/recovery";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const VISITOR = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const EVENT = "33333333-3333-4333-8333-333333333333";

function body(overrides: Record<string, unknown> = {}) {
  return {
    visitorId: VISITOR,
    sessionId: SESSION,
    eventId: EVENT,
    occurredAt: "2026-11-24T11:00:00.000Z",
    pagePath: "/contact/",
    source: "search",
    referrer: "https://www.google.com/search?q=secret-token",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "autumn_audit",
    deviceCategory: "desktop",
    browserCategory: "chrome",
    consent: {
      version: 1,
      value: "all",
      categories: { essential: true, analytics: true },
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("event validation", () => {
  it("sanitises a valid event and keeps the same hash for the same payload", () => {
    const first = validateEvent(body(), NOW);
    const second = validateEvent(body({ pagePath: "/contact", source: "Search" }), NOW);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.event.pagePath).toBe("/contact");
    expect(first.event.referrerHost).toBe("www.google.com");
    expect(JSON.stringify(first.event)).not.toContain("secret-token");
    expect(first.event.eventSort).toBe(`2026-11-24T11:00:00.000Z#${EVENT}`);
    expect(first.event.eventDay).toBe("2026-11-24");
    expect(first.event.payloadHash).toBe(second.event.payloadHash);
    expect(first.event.payloadHash).toBe(payloadHash(first.event));
  });

  it("rejects paths, identifiers, and fields the schema does not store", () => {
    expect(validateEvent(body({ pagePath: "/admin" }), NOW)).toEqual({
      ok: false,
      reason: "invalid_path",
    });
    expect(validateEvent(body({ pagePath: "/services/not-a-service" }), NOW)).toEqual({
      ok: false,
      reason: "invalid_path",
    });
    expect(validateEvent(body({ pagePath: "/contact?ref=1" }), NOW)).toEqual({
      ok: false,
      reason: "invalid_path",
    });
    expect(validateEvent(body({ pagePath: "/contact/12345678" }), NOW)).toEqual({
      ok: false,
      reason: "invalid_path",
    });
    expect(validateEvent(body({ pagePath: "/privacy/person@example.com" }), NOW)).toEqual({
      ok: false,
      reason: "invalid_path",
    });
    expect(validateEvent(body({ visitorId: "not-a-uuid" }), NOW)).toEqual({
      ok: false,
      reason: "invalid_identifier",
    });
    expect(validateEvent(body({ ip: "203.0.113.10" }), NOW)).toEqual({
      ok: false,
      reason: "forbidden_field",
    });
    expect(validateEvent(body({ email: "person@example.com" }), NOW)).toEqual({
      ok: false,
      reason: "forbidden_field",
    });
    expect(validateEvent(body({ fingerprint: "abc" }), NOW)).toEqual({
      ok: false,
      reason: "forbidden_field",
    });
    expect(validateEvent(body({ city: "London" }), NOW)).toEqual({
      ok: false,
      reason: "forbidden_field",
    });
    expect(validateEvent(body({ latitude: 51.5, longitude: -0.1 }), NOW)).toEqual({
      ok: false,
      reason: "forbidden_field",
    });
    expect(validateEvent(body({ userAgent: "Mozilla/5.0" }), NOW)).toEqual({
      ok: false,
      reason: "forbidden_field",
    });
    expect(validateEvent(body({ pageTitle: "Contact" }), NOW)).toEqual({
      ok: false,
      reason: "forbidden_field",
    });
    expect(validateEvent(body({ colour: "navy" }), NOW)).toEqual({
      ok: false,
      reason: "unsupported_field",
    });
  });

  it("drops a raw referrer URL, an IP host, and a rejected UTM value", () => {
    const internal = validateEvent(body({ referrer: "https://occasionfun.co.uk/contact?utm=1" }), NOW);
    const address = validateEvent(body({ referrer: "http://203.0.113.10/secret" }), NOW);
    const messy = validateEvent(body({ utmCampaign: "bad value", utmTerm: "person@example.com" }), NOW);
    expect(internal.ok && internal.event.referrerHost).toBe("internal");
    expect(address.ok && address.event.referrerHost).toBe("direct");
    if (!address.ok) return;
    expect(JSON.stringify(address.event)).not.toContain("203.0.113.10");
    expect(messy.ok && messy.event.utmCampaign).toBeUndefined();
    expect(messy.ok && messy.event.utmTerm).toBeUndefined();
    expect(messy.ok && messy.event.utmSource).toBe("google");
  });

  it("accepts the current service and case-study paths and rejects analytics consent that is not version 1", () => {
    const service = validateEvent(body({ pagePath: "/services/cloud-aws-devops/" }), NOW);
    const study = validateEvent(body({ pagePath: "/our-work/halloweenready" }), NOW);
    expect(service.ok && service.event.pagePath).toBe("/services/cloud-aws-devops");
    expect(study.ok && study.event.pagePath).toBe("/our-work/halloweenready");
    expect(
      validateEvent(
        body({
          consent: {
            version: 1,
            value: "essential",
            categories: { essential: true, analytics: false },
            updatedAt: "2026-08-01T00:00:00.000Z",
          },
        }),
        NOW,
      ),
    ).toEqual({ ok: false, reason: "invalid_consent" });
    expect(
      validateEvent(
        body({
          consent: {
            version: 1,
            value: "all",
            categories: { essential: true, analytics: true },
            updatedAt: "2026-11-24T12:05:00.001Z",
          },
        }),
        NOW,
      ),
    ).toEqual({ ok: false, reason: "invalid_consent" });
    const consent = {
      version: 1,
      value: "all",
      categories: { essential: true, analytics: true },
    };
    expect(validateEvent(body({ consent }), NOW)).toEqual({ ok: false, reason: "invalid_consent" });
    expect(validateEvent(body({ consent: { ...consent, updatedAt: "yesterday" } }), NOW)).toEqual({
      ok: false,
      reason: "invalid_consent",
    });
    expect(validateEvent(body({ consent: { ...consent, updatedAt: "2026-13-01T00:00:00.000Z" } }), NOW)).toEqual({
      ok: false,
      reason: "invalid_consent",
    });
    const aged = validateEvent(
      body({
        consent: {
          version: 1,
          value: "all",
          categories: { essential: true, analytics: true },
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      }),
      NOW,
    );
    expect(aged.ok).toBe(true);
  });

  it("applies the future, stale, and expiry boundaries", () => {
    const expiresAt = (iso: string) => Math.floor(Date.parse(iso) / 1000) + 90 * 86400;
    expect(newGuardRejection("2026-11-24T12:05:00.000Z", expiresAt("2026-11-24T12:05:00.000Z"), NOW)).toBeNull();
    expect(newGuardRejection("2026-11-24T12:05:00.001Z", expiresAt("2026-11-24T12:05:00.001Z"), NOW)).toBe(
      "event_future",
    );
    expect(newGuardRejection("2026-11-23T12:00:00.000Z", expiresAt("2026-11-23T12:00:00.000Z"), NOW)).toBeNull();
    expect(newGuardRejection("2026-11-23T11:59:59.999Z", expiresAt("2026-11-23T11:59:59.999Z"), NOW)).toBe(
      "event_stale",
    );
    const expiredAt = "2026-08-01T12:00:00.000Z";
    expect(newGuardRejection(expiredAt, expiresAt(expiredAt), NOW)).toBe("event_stale");
  });
});
