import { describe, expect, it } from "vitest";

import {
  addLondonDays,
  eventSortInJourney,
  isIsoTimestamp,
  isRetentionPartial,
  journeyBounds,
  londonDate,
  londonMidnightUtc,
  reportingWindow,
  retentionInstant,
  validateReportRange,
} from "@/lib/analytics/dates";
import { selectJourneyPage } from "@/lib/analytics/report";

const EVENT_ID = "33333333-3333-4333-8333-333333333333";

describe("UTC timestamps", () => {
  it("accepts a UTC timestamp and rejects a malformed or impossible one", () => {
    expect(isIsoTimestamp("2026-08-01T00:00:00.000Z")).toBe(true);
    expect(isIsoTimestamp("2026-08-01T00:00:00Z")).toBe(true);
    expect(isIsoTimestamp("2026-08-01T00:00:00.123456789Z")).toBe(true);
    expect(isIsoTimestamp("")).toBe(false);
    expect(isIsoTimestamp("2026-08-01")).toBe(false);
    expect(isIsoTimestamp("2026-08-01T00:00:00.000+00:00")).toBe(false);
    expect(isIsoTimestamp("2026-08-01t00:00:00.000Z")).toBe(false);
    expect(isIsoTimestamp("2026-08-01T00:00:00.0000000000Z")).toBe(false);
    expect(isIsoTimestamp("2026-13-01T00:00:00.000Z")).toBe(false);
    expect(isIsoTimestamp("2026-11-24T12:60:00.000Z")).toBe(false);
  });
});

describe("London reporting dates", () => {
  it("converts London midnights to UTC, including daylight-saving dates", () => {
    expect(londonMidnightUtc("2026-01-15").toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(londonMidnightUtc("2026-07-15").toISOString()).toBe("2026-07-14T23:00:00.000Z");
    expect(londonMidnightUtc("2026-03-29").toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(londonMidnightUtc("2026-03-30").toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect(londonMidnightUtc("2026-10-25").toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(londonMidnightUtc("2026-10-26").toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("assigns both daylight-saving instants to the London date they belong to", () => {
    expect(londonDate(new Date("2026-03-29T00:30:00.000Z"))).toBe("2026-03-29");
    expect(londonDate(new Date("2026-03-29T01:30:00.000Z"))).toBe("2026-03-29");
    expect(londonDate(new Date("2026-07-15T23:30:00.000Z"))).toBe("2026-07-16");
    expect(londonDate(new Date("2026-10-24T22:30:00.000Z"))).toBe("2026-10-24");
    expect(londonDate(new Date("2026-10-24T23:30:00.000Z"))).toBe("2026-10-25");
    expect(londonDate(new Date("2026-10-25T00:30:00.000Z"))).toBe("2026-10-25");
  });

  it("allows any range inside the 90 London dates ending today", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(reportingWindow(now)).toMatchObject({
      start: "2026-08-27",
      end: "2026-11-24",
    });
    expect(reportingWindow(now).dates).toHaveLength(90);
    expect(validateReportRange("2026-08-27", "2026-11-24", now).ok).toBe(true);
    expect(validateReportRange("2026-11-01", "2026-11-24", now).ok).toBe(true);
    expect(validateReportRange("2026-08-26", "2026-11-24", now)).toEqual({
      ok: false,
      reason: "outside_window",
    });
    expect(validateReportRange("2026-11-24", "2026-11-25", now)).toEqual({
      ok: false,
      reason: "outside_window",
    });
    expect(validateReportRange("2026-11-24", "2026-11-01", now)).toEqual({
      ok: false,
      reason: "inverted",
    });
    expect(validateReportRange("2026-02-31", "2026-11-24", now)).toEqual({
      ok: false,
      reason: "invalid_date",
    });
    expect(validateReportRange("2026-11-24", "2026-11-24", now).ok).toBe(true);
  });

  it("includes an event at the start midnight and excludes the next London midnight", () => {
    const spring = journeyBounds("2026-03-29", "2026-03-29");
    expect(spring).toEqual({
      start: "2026-03-29T00:00:00.000Z",
      endInclusive: "2026-03-29T23:00:00.000Z",
    });
    expect(eventSortInJourney(`2026-03-29T00:00:00.000Z#${EVENT_ID}`, spring)).toBe(true);
    expect(eventSortInJourney(`2026-03-29T22:59:59.999Z#${EVENT_ID}`, spring)).toBe(true);
    expect(eventSortInJourney(`2026-03-29T23:00:00.000Z#${EVENT_ID}`, spring)).toBe(false);

    const autumn = journeyBounds("2026-10-25", "2026-10-25");
    expect(autumn).toEqual({
      start: "2026-10-24T23:00:00.000Z",
      endInclusive: "2026-10-26T00:00:00.000Z",
    });
    expect(eventSortInJourney(`2026-10-24T23:00:00.000Z#${EVENT_ID}`, autumn)).toBe(true);
    expect(eventSortInJourney(`2026-10-25T00:30:00.000Z#${EVENT_ID}`, autumn)).toBe(true);
    expect(eventSortInJourney(`2026-10-26T00:00:00.000Z#${EVENT_ID}`, autumn)).toBe(false);
  });

  it("marks a date partial at its London midnight plus 90 days of seconds", () => {
    const autumn = "2026-10-25";
    expect(new Date(retentionInstant(autumn) * 1000).toISOString()).toBe("2027-01-22T23:00:00.000Z");
    expect(londonDate(new Date("2027-01-22T23:00:00.000Z"))).toBe("2027-01-22");
    expect(isRetentionPartial(autumn, new Date("2027-01-22T22:59:59.000Z"))).toBe(false);
    expect(isRetentionPartial(autumn, new Date("2027-01-22T23:00:00.000Z"))).toBe(true);
    expect(londonMidnightUtc(addLondonDays(autumn, 90)).toISOString()).toBe("2027-01-23T00:00:00.000Z");

    expect(new Date(retentionInstant("2026-01-15") * 1000).toISOString()).toBe(
      "2026-04-15T00:00:00.000Z",
    );
    expect(isRetentionPartial("2026-01-15", new Date("2026-04-14T23:59:59.000Z"))).toBe(false);
    expect(isRetentionPartial("2026-01-15", new Date("2026-04-15T00:00:00.000Z"))).toBe(true);
  });

  it("pages 50 live events and does not let expired rows consume the page", () => {
    const bounds = journeyBounds("2026-11-24", "2026-11-24");
    const now = new Date("2026-11-24T12:00:00.000Z");
    const events = [
      { eventSort: `2026-11-24T00:00:00.000Z#${EVENT_ID}`, expiresAt: 1 },
      ...Array.from({ length: 50 }, (_, index) => ({
        eventSort: `2026-11-24T10:00:00.${String(index).padStart(3, "0")}Z#${EVENT_ID}`,
        expiresAt: 2_000_000_000,
      })),
      { eventSort: `2026-11-25T00:00:00.000Z#${EVENT_ID}`, expiresAt: 2_000_000_000 },
    ];
    const first = selectJourneyPage(events, bounds, now, null);
    expect(first.events).toHaveLength(50);
    expect(first.events[0]?.eventSort.startsWith("2026-11-24T00:00:00.000Z")).toBe(false);
    expect(first.cursor).toBe(first.events[49]?.eventSort);
    const second = selectJourneyPage(events, bounds, now, first.cursor);
    expect(second.events).toEqual([]);
    expect(second.cursor).toBeNull();
  });
});
