/**
 * Identifier-free aggregate measurement.
 * The request body carries a page path and a landing flag.
 * Country, source, device, and browser are supplied by the server.
 * No AWS calls and no browser storage.
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
import { londonDate, retentionInstant } from "./dates";

export const UNKNOWN_COUNTRY = "ZZ";
export const AGGREGATE_METRICS = ["page_view", "visit"] as const;

const PAGE_VIEW_PREFIX = "pv";
const VISIT_PREFIX = "vs";
const COUNTRY_PATTERN = /^[A-Za-z]{2}$/;

const ALLOWED_BODY_KEYS = new Set(["pagePath", "landing"]);

const FORBIDDEN_KEYS = new Set([
  "visitorid",
  "sessionid",
  "eventid",
  "ip",
  "ipaddress",
  "clientip",
  "country",
  "consent",
  "email",
  "emailaddress",
  "fingerprint",
  "devicefingerprint",
  "useragent",
  "ua",
  "referrer",
  "referrerhost",
  "latitude",
  "longitude",
  "lat",
  "lng",
  "location",
  "geo",
  "city",
  "phone",
  "address",
  "postalcode",
  "postcode",
]);

export type AggregateMetric = (typeof AGGREGATE_METRICS)[number];

export type AggregateRejectReason =
  | "invalid_body"
  | "forbidden_field"
  | "unsupported_field"
  | "invalid_path"
  | "invalid_landing"
  | "invalid_country"
  | "invalid_source"
  | "invalid_device"
  | "invalid_browser";

export type AggregateDimensions = {
  pagePath: string;
  country: string;
  source: TrafficSource;
  deviceCategory: DeviceCategory;
  browserCategory: BrowserCategory;
};

export type AggregateServerContext = {
  country: unknown;
  source: unknown;
  deviceCategory: unknown;
  browserCategory: unknown;
  now: Date;
};

export type AggregateMeasurement = AggregateDimensions & {
  landing: boolean;
  statDay: string;
  expiresAt: number;
  pageViewKey: string;
  visitKey: string | null;
};

export type AggregateAcceptance =
  | { ok: true; measurement: AggregateMeasurement }
  | { ok: false; reason: AggregateRejectReason };

export type CountryCodeResult =
  | { ok: true; country: string }
  | { ok: false; reason: "invalid_country" };

const KEY_PREFIX: Record<AggregateMetric, string> = {
  page_view: PAGE_VIEW_PREFIX,
  visit: VISIT_PREFIX,
};

/**
 * Absent country becomes ZZ. Any other value must be two letters.
 * Two letters are stored in uppercase. ZZ is the unknown bucket.
 */
export function normaliseCountryCode(value: unknown): CountryCodeResult {
  if (value === undefined || value === null || value === "") {
    return { ok: true, country: UNKNOWN_COUNTRY };
  }
  if (typeof value !== "string" || !COUNTRY_PATTERN.test(value)) {
    return { ok: false, reason: "invalid_country" };
  }
  return { ok: true, country: value.toUpperCase() };
}

export function counterKey(metric: AggregateMetric, dimensions: AggregateDimensions): string {
  const parts = [
    KEY_PREFIX[metric],
    dimensions.country,
    dimensions.pagePath,
    dimensions.source,
    dimensions.deviceCategory,
    dimensions.browserCategory,
  ];
  if (parts.some((part) => part.length === 0 || part.includes("#"))) {
    throw new Error("aggregate counter key part is not safe");
  }
  return parts.join("#");
}

export function acceptAggregateMeasurement(
  body: unknown,
  context: AggregateServerContext,
): AggregateAcceptance {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "invalid_body" };
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const normalised = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(normalised)) return { ok: false, reason: "forbidden_field" };
    if (!ALLOWED_BODY_KEYS.has(key)) return { ok: false, reason: "unsupported_field" };
  }

  const pagePath = normalisePagePath(record.pagePath);
  if (!pagePath || pagePath.includes("#")) return { ok: false, reason: "invalid_path" };
  if (typeof record.landing !== "boolean") return { ok: false, reason: "invalid_landing" };

  const country = normaliseCountryCode(context.country);
  if (!country.ok) return country;
  const source = enumValue(context.source, SOURCE_VALUES);
  if (!source) return { ok: false, reason: "invalid_source" };
  const deviceCategory = enumValue(context.deviceCategory, DEVICE_VALUES);
  if (!deviceCategory) return { ok: false, reason: "invalid_device" };
  const browserCategory = enumValue(context.browserCategory, BROWSER_VALUES);
  if (!browserCategory) return { ok: false, reason: "invalid_browser" };

  const dimensions: AggregateDimensions = {
    pagePath,
    country: country.country,
    source,
    deviceCategory,
    browserCategory,
  };
  const statDay = londonDate(context.now);
  return {
    ok: true,
    measurement: {
      ...dimensions,
      landing: record.landing,
      statDay,
      expiresAt: retentionInstant(statDay),
      pageViewKey: counterKey("page_view", dimensions),
      visitKey: record.landing ? counterKey("visit", dimensions) : null,
    },
  };
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  return allowed.find((item) => item === lower) ?? null;
}
