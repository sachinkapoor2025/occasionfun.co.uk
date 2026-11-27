/**
 * Aggregate statistics for a London date range.
 * Callers supply counter rows. This module does not call AWS.
 * Dimensional totals use page views. Visits stay a separate landing count.
 * No visitor identifiers and no journeys.
 */

import {
  BROWSER_VALUES,
  DEVICE_VALUES,
  SOURCE_VALUES,
  normalisePagePath,
  type BrowserCategory,
  type DeviceCategory,
  type TrafficSource,
} from "./event-core";
import { isRetentionPartial, validateReportRange } from "./dates";
import { normaliseCountryCode, type AggregateMetric } from "./aggregate";
import { TOP_LIST_LIMIT, type CountedName } from "./report";

export type AggregateCounterRow = {
  statDay: string;
  metric: AggregateMetric;
  country: string;
  pagePath: string;
  source: TrafficSource;
  deviceCategory: DeviceCategory;
  browserCategory: BrowserCategory;
  count: number;
  expiresAt: number;
};

export type CountryTotal = {
  country: string;
  pageViews: number;
  visits: number;
};

export type AggregateStatistics = {
  status: "ok";
  dates: string[];
  partialDates: string[];
  daily: Array<{ date: string; pageViews: number; visits: number; partial: boolean }>;
  pageViews: number;
  visits: number;
  countries: CountryTotal[];
  countriesOther: { pageViews: number; visits: number };
  paths: CountedName[];
  pathsOther: number;
  sources: Record<TrafficSource, number>;
  devices: Record<DeviceCategory, number>;
  browsers: Record<BrowserCategory, number>;
};

export type AggregateReportResult =
  | AggregateStatistics
  | { status: "invalid_range"; reason: "invalid_date" | "inverted" | "outside_window" | "too_long" };

type CountryBucket = { pageViews: number; visits: number };

export function aggregateStatistics(
  start: string,
  end: string,
  now: Date,
  rows: readonly AggregateCounterRow[],
): AggregateReportResult {
  const range = validateReportRange(start, end, now);
  if (!range.ok) return { status: "invalid_range", reason: range.reason };

  const nowSeconds = Math.floor(now.getTime() / 1000);
  const selected = new Set(range.dates);
  const partial = new Set<string>();
  const dailyPageViews = new Map<string, number>();
  const dailyVisits = new Map<string, number>();
  const countries = new Map<string, CountryBucket>();
  const paths = new Map<string, number>();
  const sources = emptySources();
  const devices: Record<DeviceCategory, number> = { desktop: 0, mobile: 0, tablet: 0, other: 0 };
  const browsers: Record<BrowserCategory, number> = {
    chrome: 0,
    safari: 0,
    firefox: 0,
    edge: 0,
    other: 0,
  };
  let pageViews = 0;
  let visits = 0;

  for (const day of range.dates) {
    if (isRetentionPartial(day, now)) partial.add(day);
  }

  for (const row of rows) {
    if (!selected.has(row.statDay)) continue;
    const counted = countable(row);
    if (!counted) continue;
    if (row.expiresAt <= nowSeconds) {
      partial.add(row.statDay);
      continue;
    }
    const country = countries.get(counted.country) ?? { pageViews: 0, visits: 0 };
    if (counted.metric === "visit") {
      visits += counted.count;
      dailyVisits.set(row.statDay, (dailyVisits.get(row.statDay) ?? 0) + counted.count);
      country.visits += counted.count;
      countries.set(counted.country, country);
      continue;
    }
    pageViews += counted.count;
    dailyPageViews.set(row.statDay, (dailyPageViews.get(row.statDay) ?? 0) + counted.count);
    country.pageViews += counted.count;
    countries.set(counted.country, country);
    paths.set(counted.pagePath, (paths.get(counted.pagePath) ?? 0) + counted.count);
    sources[counted.source] += counted.count;
    devices[counted.deviceCategory] += counted.count;
    browsers[counted.browserCategory] += counted.count;
  }

  const countryRank = rankCountries(countries);
  const pathRank = rankCounts(paths);
  const partialDates = range.dates.filter((day) => partial.has(day));
  return {
    status: "ok",
    dates: range.dates,
    partialDates,
    daily: range.dates.map((date) => ({
      date,
      pageViews: dailyPageViews.get(date) ?? 0,
      visits: dailyVisits.get(date) ?? 0,
      partial: partial.has(date),
    })),
    pageViews,
    visits,
    countries: countryRank.rows,
    countriesOther: countryRank.other,
    paths: pathRank.rows,
    pathsOther: pathRank.other,
    sources,
    devices,
    browsers,
  };
}

function emptySources(): Record<TrafficSource, number> {
  return { direct: 0, internal: 0, search: 0, social: 0, referral: 0, campaign: 0 };
}

type CountableRow = {
  metric: AggregateMetric;
  country: string;
  pagePath: string;
  source: TrafficSource;
  deviceCategory: DeviceCategory;
  browserCategory: BrowserCategory;
  count: number;
};

function countable(row: AggregateCounterRow): CountableRow | null {
  if (row.metric !== "page_view" && row.metric !== "visit") return null;
  if (!Number.isSafeInteger(row.count) || row.count <= 0) return null;
  if (!Number.isSafeInteger(row.expiresAt)) return null;
  const country = normaliseCountryCode(row.country);
  if (!country.ok || country.country !== row.country) return null;
  const pagePath = normalisePagePath(row.pagePath);
  if (!pagePath) return null;
  const source = enumValue(row.source, SOURCE_VALUES);
  const deviceCategory = enumValue(row.deviceCategory, DEVICE_VALUES);
  const browserCategory = enumValue(row.browserCategory, BROWSER_VALUES);
  if (!source || !deviceCategory || !browserCategory) return null;
  return {
    metric: row.metric,
    country: country.country,
    pagePath,
    source,
    deviceCategory,
    browserCategory,
    count: row.count,
  };
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  return allowed.find((item) => item === lower) ?? null;
}

function rankCounts(counts: Map<string, number>): { rows: CountedName[]; other: number } {
  const ranked = [...counts.entries()].sort(byCountThenName);
  const rows = ranked.slice(0, TOP_LIST_LIMIT).map(([name, count]) => ({ name, count }));
  const other = ranked.slice(TOP_LIST_LIMIT).reduce((sum, entry) => sum + entry[1], 0);
  return { rows, other };
}

function rankCountries(counts: Map<string, CountryBucket>): {
  rows: CountryTotal[];
  other: { pageViews: number; visits: number };
} {
  const ranked = [...counts.entries()].sort((left, right) => {
    if (right[1].pageViews !== left[1].pageViews) return right[1].pageViews - left[1].pageViews;
    return compareName(left[0], right[0]);
  });
  const rows = ranked.slice(0, TOP_LIST_LIMIT).map(([country, totals]) => ({
    country,
    pageViews: totals.pageViews,
    visits: totals.visits,
  }));
  const rest = ranked.slice(TOP_LIST_LIMIT);
  return {
    rows,
    other: {
      pageViews: rest.reduce((sum, entry) => sum + entry[1].pageViews, 0),
      visits: rest.reduce((sum, entry) => sum + entry[1].visits, 0),
    },
  };
}

function byCountThenName(left: [string, number], right: [string, number]): number {
  if (right[1] !== left[1]) return right[1] - left[1];
  return compareName(left[0], right[0]);
}

function compareName(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
