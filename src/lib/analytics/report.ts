/**
 * Reporting aggregation. Callers supply already-read rows.
 * This module does not call AWS and does not keep raw pages.
 */

import {
  JOURNEY_PAGE_SIZE,
  eventSortInJourney,
  isRetentionPartial,
  validateReportRange,
  type JourneyBounds,
} from "./dates";
import type { BrowserCategory, DeviceCategory, TrafficSource } from "./event";
import { isNewVisitor, resolveFirstSeenDay, visitorNeedsProfile } from "./visitor";

export const PAGE_VIEW_READ_CAP = 20_000;
export const VISITOR_DAY_READ_CAP = 20_000;
export const DISTINCT_VISITOR_CAP = 20_000;
export const PROFILE_LOOKUP_CAP = 2_000;
export const CAMPAIGN_KEY_CAP = 256;
export const TOP_LIST_LIMIT = 50;
export const REPORT_DATE_CHUNK = 4;
export const PROFILE_BATCH_SIZE = 100;
export const PROFILE_UNPROCESSED_RETRIES = 3;

export type PageViewFact = {
  visitorId: string;
  expiresAt: number;
  pagePath: string;
  source: TrafficSource;
  deviceCategory: DeviceCategory;
  browserCategory: BrowserCategory;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export type VisitorDayFact = {
  visitorId: string;
  day: string;
  expiresAt: number;
  firstSeenDay: string;
  newVisitor: boolean;
  source: TrafficSource;
  landingPath: string;
};

export type ProfileFact = { firstSeenDay: string };

export type ProfileBatch = {
  profiles: ReadonlyMap<string, ProfileFact>;
  missing: ReadonlySet<string>;
  unprocessed: readonly string[];
};

export interface ReportSources {
  pageViews(day: string): readonly PageViewFact[];
  visitorDays(day: string): readonly VisitorDayFact[];
  lookupProfiles(ids: readonly string[]): ProfileBatch;
}

export type CountedName = { name: string; count: number };

export type NewReturning =
  | { status: "complete"; newVisitors: number; returningVisitors: number }
  | { status: "incomplete"; reason: "profile_unavailable" };

export type AnalyticsReport = {
  status: "ok";
  dates: string[];
  partialDates: string[];
  daily: Array<{ date: string; pageViews: number; visitorDays: number; partial: boolean }>;
  pageViews: number;
  visitorDays: number;
  uniqueVisitors: number;
  sources: Record<TrafficSource, number>;
  devices: Record<DeviceCategory, number>;
  browsers: Record<BrowserCategory, number>;
  paths: CountedName[];
  pathsOther: number;
  landingPages: CountedName[];
  landingPagesOther: number;
  campaigns: CountedName[];
  campaignsOther: number;
  campaignsApproximate: boolean;
  newReturning: NewReturning;
};

export type ReportResult =
  | AnalyticsReport
  | { status: "too_large" }
  | { status: "invalid_range"; reason: "invalid_date" | "inverted" | "outside_window" | "too_long" };

export type JourneyRow = {
  eventSort: string;
  expiresAt: number;
};

export type JourneyPage = {
  events: JourneyRow[];
  cursor: string | null;
};

function emptySources(): Record<TrafficSource, number> {
  return { direct: 0, internal: 0, search: 0, social: 0, referral: 0, campaign: 0 };
}

function campaignKey(row: PageViewFact): string | undefined {
  if (!row.utmSource && !row.utmMedium && !row.utmCampaign) {
    return row.source === "campaign" ? "campaign" : undefined;
  }
  return `${row.utmSource ?? ""}|${row.utmMedium ?? ""}|${row.utmCampaign ?? ""}`;
}

function addCount(counts: Map<string, number>, key: string, approximate: { value: boolean; other: number }, cap: number): void {
  const current = counts.get(key);
  if (current === undefined && counts.size >= cap) {
    approximate.value = true;
    approximate.other += 1;
    return;
  }
  counts.set(key, (current ?? 0) + 1);
}

function topCounts(counts: Map<string, number>, other: number): { rows: CountedName[]; other: number } {
  const ranked = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0;
  });
  const rows = ranked.slice(0, TOP_LIST_LIMIT).map(([name, count]) => ({ name, count }));
  const rest = ranked.slice(TOP_LIST_LIMIT).reduce((sum, entry) => sum + entry[1], 0);
  return { rows, other: rest + other };
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }
  return groups;
}

export function selectJourneyPage(
  events: readonly JourneyRow[],
  bounds: JourneyBounds,
  now: Date,
  cursor: string | null,
  pageSize = JOURNEY_PAGE_SIZE,
): JourneyPage {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const live = events
    .filter(
      (event) =>
        event.expiresAt > nowSeconds &&
        eventSortInJourney(event.eventSort, bounds) &&
        (cursor === null || event.eventSort > cursor),
    )
    .slice()
    .sort((left, right) => (left.eventSort < right.eventSort ? -1 : left.eventSort > right.eventSort ? 1 : 0));
  const page = live.slice(0, pageSize);
  const last = page.length === pageSize ? page[page.length - 1] : undefined;
  return { events: page, cursor: last ? last.eventSort : null };
}

export function aggregateReport(start: string, end: string, now: Date, sources: ReportSources): ReportResult {
  const range = validateReportRange(start, end, now);
  if (!range.ok) return { status: "invalid_range", reason: range.reason };
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const partial = new Set<string>();
  const dailyPageViews = new Map<string, number>();
  const dailyVisitors = new Map<string, number>();
  const pathCounts = new Map<string, number>();
  const landingCounts = new Map<string, number>();
  const campaignCounts = new Map<string, number>();
  const campaignOverflow = { value: false, other: 0 };
  const sourceCounts = emptySources();
  const deviceCounts: Record<DeviceCategory, number> = { desktop: 0, mobile: 0, tablet: 0, other: 0 };
  const browserCounts: Record<BrowserCategory, number> = {
    chrome: 0,
    safari: 0,
    firefox: 0,
    edge: 0,
    other: 0,
  };
  const visitors = new Map<string, VisitorDayFact[]>();
  let pageViews = 0;
  let pageViewsRead = 0;
  let visitorDays = 0;
  let visitorDaysRead = 0;

  for (let offset = 0; offset < range.dates.length; offset += REPORT_DATE_CHUNK) {
    const dates = range.dates.slice(offset, offset + REPORT_DATE_CHUNK);
    for (const day of dates) {
      if (isRetentionPartial(day, now)) partial.add(day);
      const pages = sources.pageViews(day);
      for (const row of pages) {
        if (pageViewsRead >= PAGE_VIEW_READ_CAP) return { status: "too_large" };
        pageViewsRead += 1;
        if (row.expiresAt <= nowSeconds) {
          partial.add(day);
          continue;
        }
        pageViews += 1;
        dailyPageViews.set(day, (dailyPageViews.get(day) ?? 0) + 1);
        pathCounts.set(row.pagePath, (pathCounts.get(row.pagePath) ?? 0) + 1);
        deviceCounts[row.deviceCategory] += 1;
        browserCounts[row.browserCategory] += 1;
        const campaign = campaignKey(row);
        if (campaign) addCount(campaignCounts, campaign, campaignOverflow, CAMPAIGN_KEY_CAP);
      }
      const days = sources.visitorDays(day);
      for (const row of days) {
        if (visitorDaysRead >= VISITOR_DAY_READ_CAP) return { status: "too_large" };
        visitorDaysRead += 1;
        if (row.expiresAt <= nowSeconds) {
          partial.add(day);
          continue;
        }
        if (!visitors.has(row.visitorId) && visitors.size >= DISTINCT_VISITOR_CAP) {
          return { status: "too_large" };
        }
        visitorDays += 1;
        dailyVisitors.set(day, (dailyVisitors.get(day) ?? 0) + 1);
        sourceCounts[row.source] += 1;
        landingCounts.set(row.landingPath, (landingCounts.get(row.landingPath) ?? 0) + 1);
        const group = visitors.get(row.visitorId);
        if (group) group.push(row);
        else visitors.set(row.visitorId, [row]);
      }
    }
  }

  const required: string[] = [];
  for (const [visitorId, items] of visitors) {
    if (visitorNeedsProfile(items)) required.push(visitorId);
  }
  if (required.length > PROFILE_LOOKUP_CAP) return { status: "too_large" };

  const resolved = new Map<string, ProfileFact>();
  const missing = new Set<string>();
  let pending = required;
  const attempts = 1 + PROFILE_UNPROCESSED_RETRIES;
  for (let attempt = 0; attempt < attempts && pending.length > 0; attempt += 1) {
    const again: string[] = [];
    for (const batch of chunks(pending, PROFILE_BATCH_SIZE)) {
      const lookedUp = sources.lookupProfiles(batch);
      const waiting = new Set(lookedUp.unprocessed);
      for (const id of batch) {
        if (waiting.has(id)) {
          again.push(id);
          continue;
        }
        const profile = lookedUp.profiles.get(id);
        if (profile) resolved.set(id, profile);
        else missing.add(id);
      }
    }
    pending = again;
  }

  let unresolved = pending.length > 0 || [...required].some((id) => missing.has(id));
  let newVisitors = 0;
  let returningVisitors = 0;
  if (!unresolved) {
    for (const [visitorId, items] of visitors) {
      const profile = visitorNeedsProfile(items) ? (resolved.get(visitorId) ?? null) : null;
      if (visitorNeedsProfile(items) && !profile) {
        unresolved = true;
        break;
      }
      const firstSeen = resolveFirstSeenDay(items, profile);
      if (isNewVisitor(firstSeen, range.dates)) newVisitors += 1;
      else returningVisitors += 1;
    }
  }

  const paths = topCounts(pathCounts, 0);
  const landing = topCounts(landingCounts, 0);
  const campaigns = topCounts(campaignCounts, campaignOverflow.other);
  const partialDates = range.dates.filter((day) => partial.has(day));
  return {
    status: "ok",
    dates: range.dates,
    partialDates,
    daily: range.dates.map((date) => ({
      date,
      pageViews: dailyPageViews.get(date) ?? 0,
      visitorDays: dailyVisitors.get(date) ?? 0,
      partial: partial.has(date),
    })),
    pageViews,
    visitorDays,
    uniqueVisitors: visitors.size,
    sources: sourceCounts,
    devices: deviceCounts,
    browsers: browserCounts,
    paths: paths.rows,
    pathsOther: paths.other,
    landingPages: landing.rows,
    landingPagesOther: landing.other,
    campaigns: campaigns.rows,
    campaignsOther: campaigns.other,
    campaignsApproximate: campaignOverflow.value,
    newReturning: unresolved
      ? { status: "incomplete", reason: "profile_unavailable" }
      : { status: "complete", newVisitors, returningVisitors },
  };
}
