import { describe, expect, it } from "vitest";

import { validateEvent, type SanitisedEvent } from "@/lib/analytics/event";
import {
  isNewVisitor,
  mergeDay,
  mergeProfile,
  planDayCorrections,
  resolveFirstSeenDay,
  visitorNeedsProfile,
  type DayRecord,
} from "@/lib/analytics/visitor";

const NOW = new Date("2026-11-24T12:00:00.000Z");

function event(occurredAt: string, pagePath: string, source = "search"): SanitisedEvent {
  const validated = validateEvent(
    {
      visitorId: "11111111-1111-4111-8111-111111111111",
      sessionId: "22222222-2222-4222-8222-222222222222",
      eventId: "33333333-3333-4333-8333-333333333333",
      occurredAt,
      pagePath,
      source,
      deviceCategory: "mobile",
      browserCategory: "safari",
      consent: {
        version: 1,
        value: "all",
        categories: { essential: true, analytics: true },
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    },
    NOW,
  );
  if (!validated.ok) throw new Error(validated.reason);
  return validated.event;
}

describe("visitor classification", () => {
  it("keeps the earliest and latest events, including several events on one London day", () => {
    const later = event("2026-11-24T11:55:00.000Z", "/contact");
    const earlier = event("2026-11-24T11:50:00.000Z", "/about", "direct");
    const profile = mergeProfile(mergeProfile(null, later, NOW), earlier, NOW);
    expect(profile.firstSeenAt).toBe("2026-11-24T11:50:00.000Z");
    expect(profile.firstLandingPath).toBe("/about");
    expect(profile.firstSource).toBe("direct");
    expect(profile.lastSeenAt).toBe("2026-11-24T11:55:00.000Z");
    expect(profile.latestPath).toBe("/contact");

    const day = mergeDay(mergeDay(null, later, profile.firstSeenDay), earlier, profile.firstSeenDay);
    expect(day.dayFirstAt).toBe("2026-11-24T11:50:00.000Z");
    expect(day.lastEventAt).toBe("2026-11-24T11:55:00.000Z");
    expect(day.landingPath).toBe("/about");
    expect(day.source).toBe("direct");
    expect(day.newVisitor).toBe(true);
  });

  it("does not move first-seen backward when an existing profile receives an event older than 15 minutes", () => {
    const recent = event("2026-11-24T11:50:00.000Z", "/contact");
    const profile = mergeProfile(null, recent, NOW);
    const boundary = event("2026-11-24T11:45:00.000Z", "/about", "direct");
    const justOutside = event("2026-11-24T11:44:59.999Z", "/trust", "referral");
    expect(mergeProfile(profile, boundary, NOW).firstLandingPath).toBe("/about");
    const kept = mergeProfile(profile, justOutside, NOW);
    expect(kept.firstSeenAt).toBe(profile.firstSeenAt);
    expect(kept.firstLandingPath).toBe("/contact");
    expect(mergeProfile(null, justOutside, NOW).firstLandingPath).toBe("/trust");
  });

  it("keeps stored attributes when the event time is equal", () => {
    const first = event("2026-11-24T11:30:00.000Z", "/contact", "search");
    const sameTime = event("2026-11-24T11:30:00.000Z", "/about", "direct");
    const profile = mergeProfile(mergeProfile(null, first, NOW), sameTime, NOW);
    expect(profile.firstLandingPath).toBe("/contact");
    expect(profile.latestPath).toBe("/contact");
  });

  it("marks the corrected day as new before clearing the previous day", () => {
    const visitorId = "11111111-1111-4111-8111-111111111111";
    const previous: DayRecord = {
      visitorId,
      itemKey: "DAY#2026-11-24",
      day: "2026-11-24",
      dayFirstAt: "2026-11-24T00:05:00.000Z",
      lastEventAt: "2026-11-24T00:05:00.000Z",
      firstSeenDay: "2026-11-24",
      newVisitor: true,
      source: "direct",
      landingPath: "/contact",
      expiresAt: 1,
    };
    const corrected: DayRecord = {
      ...previous,
      itemKey: "DAY#2026-11-23",
      day: "2026-11-23",
      firstSeenDay: "2026-11-24",
      newVisitor: false,
    };
    const plan = planDayCorrections([previous, corrected], "2026-11-23");
    expect(plan.map((step) => [step.next.day, step.next.newVisitor])).toEqual([
      ["2026-11-23", true],
      ["2026-11-24", false],
    ]);
  });

  it("classifies a visitor as new only when the resolved first day is inside the selection", () => {
    const copies = [
      { visitorId: "a", firstSeenDay: "2026-11-24", newVisitor: false },
      { visitorId: "a", firstSeenDay: "2026-11-24", newVisitor: false },
    ];
    expect(visitorNeedsProfile(copies)).toBe(false);
    expect(isNewVisitor(resolveFirstSeenDay(copies, null), ["2026-11-23", "2026-11-24"])).toBe(true);
    const disagree = [
      { visitorId: "a", firstSeenDay: "2026-11-24", newVisitor: false },
      { visitorId: "a", firstSeenDay: "2026-11-20", newVisitor: true },
    ];
    expect(visitorNeedsProfile(disagree)).toBe(true);
    expect(resolveFirstSeenDay(disagree, { firstSeenDay: "2026-11-01" })).toBe("2026-11-01");
    expect(resolveFirstSeenDay(disagree, { firstSeenDay: "2026-11-22" })).toBe("2026-11-20");
    expect(isNewVisitor("2026-11-01", ["2026-11-23", "2026-11-24"])).toBe(false);
  });
});
