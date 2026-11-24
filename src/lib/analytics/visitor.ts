/**
 * Profile and day-item merge rules.
 * Earlier event time supplies first-seen. Later event time supplies last-seen.
 * Pure functions. No AWS calls.
 */

import type { SanitisedEvent, TrafficSource } from "./event";

export const FIRST_SEEN_GUARD_MS = 15 * 60 * 1000;

export type VisitorProfile = {
  visitorId: string;
  itemKey: "PROFILE";
  firstSeenAt: string;
  lastSeenAt: string;
  firstSeenDay: string;
  lastSeenDay: string;
  firstLandingPath: string;
  latestPath: string;
  firstSource: TrafficSource;
  latestSource: TrafficSource;
  firstCampaign?: string;
  latestCampaign?: string;
  expiresAt: number;
};

export type DayRecord = {
  visitorId: string;
  itemKey: `DAY#${string}`;
  day: string;
  dayFirstAt: string;
  lastEventAt: string;
  firstSeenDay: string;
  newVisitor: boolean;
  source: TrafficSource;
  landingPath: string;
  expiresAt: number;
};

export type DayCorrection = {
  previous: DayRecord;
  next: DayRecord;
};

export function campaignLabel(event: Pick<SanitisedEvent, "utmSource" | "utmMedium" | "utmCampaign" | "source">): string | undefined {
  if (!event.utmSource && !event.utmMedium && !event.utmCampaign) {
    return event.source === "campaign" ? "campaign" : undefined;
  }
  return `${event.utmSource ?? ""}|${event.utmMedium ?? ""}|${event.utmCampaign ?? ""}`;
}

export function profileFromEvent(event: SanitisedEvent): VisitorProfile {
  const campaign = campaignLabel(event);
  return {
    visitorId: event.visitorId,
    itemKey: "PROFILE",
    firstSeenAt: event.occurredAt,
    lastSeenAt: event.occurredAt,
    firstSeenDay: event.eventDay,
    lastSeenDay: event.eventDay,
    firstLandingPath: event.pagePath,
    latestPath: event.pagePath,
    firstSource: event.source,
    latestSource: event.source,
    ...(campaign ? { firstCampaign: campaign, latestCampaign: campaign } : {}),
    expiresAt: event.expiresAt,
  };
}

export function mergeProfile(
  existing: VisitorProfile | null,
  event: SanitisedEvent,
  now: Date,
): VisitorProfile {
  if (!existing) return profileFromEvent(event);
  const eventMs = Date.parse(event.occurredAt);
  const tooOldToMoveFirstSeen = now.getTime() - eventMs > FIRST_SEEN_GUARD_MS;
  const next: VisitorProfile = { ...existing };
  if (eventMs < Date.parse(existing.firstSeenAt) && !tooOldToMoveFirstSeen) {
    const campaign = campaignLabel(event);
    next.firstSeenAt = event.occurredAt;
    next.firstSeenDay = event.eventDay;
    next.firstLandingPath = event.pagePath;
    next.firstSource = event.source;
    if (campaign) next.firstCampaign = campaign;
    else delete next.firstCampaign;
  }
  if (eventMs > Date.parse(existing.lastSeenAt)) {
    const campaign = campaignLabel(event);
    next.lastSeenAt = event.occurredAt;
    next.lastSeenDay = event.eventDay;
    next.latestPath = event.pagePath;
    next.latestSource = event.source;
    next.expiresAt = event.expiresAt;
    if (campaign) next.latestCampaign = campaign;
    else delete next.latestCampaign;
  }
  return next;
}

export function mergeDay(
  existing: DayRecord | null,
  event: SanitisedEvent,
  profileFirstSeenDay: string,
): DayRecord {
  if (!existing) {
    return {
      visitorId: event.visitorId,
      itemKey: `DAY#${event.eventDay}`,
      day: event.eventDay,
      dayFirstAt: event.occurredAt,
      lastEventAt: event.occurredAt,
      firstSeenDay: profileFirstSeenDay,
      newVisitor: event.eventDay === profileFirstSeenDay,
      source: event.source,
      landingPath: event.pagePath,
      expiresAt: event.expiresAt,
    };
  }
  const next: DayRecord = { ...existing };
  const eventMs = Date.parse(event.occurredAt);
  if (eventMs < Date.parse(existing.dayFirstAt)) {
    next.dayFirstAt = event.occurredAt;
    next.source = event.source;
    next.landingPath = event.pagePath;
  }
  if (eventMs > Date.parse(existing.lastEventAt)) {
    next.lastEventAt = event.occurredAt;
    next.expiresAt = event.expiresAt;
  }
  if (profileFirstSeenDay < next.firstSeenDay) {
    next.firstSeenDay = profileFirstSeenDay;
    next.newVisitor = next.day === profileFirstSeenDay;
  }
  return next;
}

/**
 * Day copies move earlier only. The corrected day is marked new before any
 * previous first day is cleared.
 */
export function planDayCorrections(days: readonly DayRecord[], correctedFirstSeenDay: string): DayCorrection[] {
  const needs = days.filter((day) => day.firstSeenDay > correctedFirstSeenDay);
  needs.sort((left, right) => {
    if (left.day === correctedFirstSeenDay) return -1;
    if (right.day === correctedFirstSeenDay) return 1;
    return left.day < right.day ? -1 : 1;
  });
  return needs.map((previous) => ({
    previous,
    next: {
      ...previous,
      firstSeenDay: correctedFirstSeenDay,
      newVisitor: previous.day === correctedFirstSeenDay,
    },
  }));
}

export type DayClassification = {
  visitorId: string;
  firstSeenDay: string;
  newVisitor: boolean;
};

export function visitorNeedsProfile(items: readonly DayClassification[]): boolean {
  const copies = new Set(items.map((item) => item.firstSeenDay));
  return items.some((item) => item.newVisitor) || copies.size > 1;
}

export function resolveFirstSeenDay(
  items: readonly DayClassification[],
  profile: { firstSeenDay: string } | null,
): string {
  const earliest = [...items.map((item) => item.firstSeenDay)].sort()[0] ?? "";
  if (profile && profile.firstSeenDay < earliest) return profile.firstSeenDay;
  return earliest;
}

export function isNewVisitor(firstSeenDay: string, selectedDates: readonly string[]): boolean {
  return selectedDates.includes(firstSeenDay);
}
