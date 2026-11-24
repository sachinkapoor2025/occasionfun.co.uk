/**
 * Event validation, sanitisation, and the deterministic payload hash.
 * Pure functions. No AWS calls and no browser storage.
 */

import { createHash } from "node:crypto";

import { company } from "@/config/company";
import { getAllCaseStudySlugs } from "@/content/case-studies";
import { getAllServiceSlugs } from "@/content/services";

import { expiresAtFromInstant, isIsoTimestamp, londonDate } from "./dates";

export const SOURCE_VALUES = [
  "direct",
  "internal",
  "search",
  "social",
  "referral",
  "campaign",
] as const;
export const DEVICE_VALUES = ["desktop", "mobile", "tablet", "other"] as const;
export const BROWSER_VALUES = ["chrome", "safari", "firefox", "edge", "other"] as const;

export type TrafficSource = (typeof SOURCE_VALUES)[number];
export type DeviceCategory = (typeof DEVICE_VALUES)[number];
export type BrowserCategory = (typeof BROWSER_VALUES)[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OCCURRED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UTM_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

const FIXED_PATHS = [
  "/",
  "/about",
  "/contact",
  "/cookies",
  "/how-we-work",
  "/our-work",
  "/policies",
  "/privacy",
  "/public-sector",
  "/services",
  "/technology-partner",
  "/terms",
  "/trust",
] as const;

const ALLOWED_BODY_KEYS = new Set([
  "visitorId",
  "sessionId",
  "eventId",
  "occurredAt",
  "pagePath",
  "source",
  "referrer",
  "referrerHost",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
  "deviceCategory",
  "browserCategory",
  "consent",
]);

const FORBIDDEN_KEYS = new Set([
  "ip",
  "ipaddress",
  "clientip",
  "email",
  "emailaddress",
  "fingerprint",
  "devicefingerprint",
  "city",
  "latitude",
  "longitude",
  "lat",
  "lng",
  "location",
  "preciselocation",
  "geo",
  "useragent",
  "ua",
  "pagetitle",
  "title",
  "enquiryid",
  "leadid",
  "phone",
  "address",
  "postalcode",
  "postcode",
  "zip",
  "zipcode",
]);

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

export type RejectReason =
  | "invalid_body"
  | "unsupported_field"
  | "forbidden_field"
  | "invalid_identifier"
  | "invalid_time"
  | "invalid_path"
  | "invalid_source"
  | "invalid_device"
  | "invalid_browser"
  | "invalid_consent";

export type SanitisedEvent = {
  visitorId: string;
  sessionId: string;
  eventId: string;
  occurredAt: string;
  eventDay: string;
  eventSort: string;
  pagePath: string;
  source: TrafficSource;
  referrerHost: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  deviceCategory: DeviceCategory;
  browserCategory: BrowserCategory;
  payloadHash: string;
  expiresAt: number;
};

export type EventValidation =
  | { ok: true; event: SanitisedEvent }
  | { ok: false; reason: RejectReason };

const allowedPaths = new Set<string>([
  ...FIXED_PATHS,
  ...getAllServiceSlugs().map((slug) => `/services/${slug}`),
  ...getAllCaseStudySlugs().map((slug) => `/our-work/${slug}`),
]);

function siteHosts(): Set<string> {
  const host = new URL(company.siteUrl).hostname.toLowerCase();
  return new Set([host, host.startsWith("www.") ? host.slice(4) : `www.${host}`]);
}

export function allowedPagePaths(): readonly string[] {
  return [...allowedPaths];
}

export function normaliseIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.toLowerCase();
  return UUID_PATTERN.test(id) ? id : null;
}

export function normalisePagePath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 120) return null;
  if (/[?#\\\s@%]/.test(value) || value.includes("..")) return null;
  if (/[\u0000-\u001F\u007F]/.test(value)) return null;
  if (/\d{8,}/.test(value)) return null;
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value)) {
    return null;
  }
  const lower = value.toLowerCase();
  if (!lower.startsWith("/")) return null;
  const path = lower.length > 1 && lower.endsWith("/") ? lower.slice(0, -1) : lower;
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  return allowedPaths.has(path) ? path : null;
}

function isIpHost(host: string): boolean {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function acceptHost(host: string): string | null {
  const normalised = host.trim().toLowerCase().replace(/\.$/, "");
  if (normalised.length === 0 || normalised.length > 80) return null;
  if (isIpHost(normalised) || !HOST_PATTERN.test(normalised)) return null;
  if (siteHosts().has(normalised)) return "internal";
  return normalised;
}

export function normaliseReferrer(value: unknown): string {
  if (typeof value !== "string") return "direct";
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "direct") return "direct";
  if (trimmed.toLowerCase() === "internal") return "internal";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "direct";
      return acceptHost(url.hostname) ?? "direct";
    } catch {
      return "direct";
    }
  }
  return acceptHost(trimmed) ?? "direct";
}

function optionalUtm(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  if (!UTM_PATTERN.test(value)) return undefined;
  if (/\d{8,}/.test(value) || UUID_PATTERN.test(value.toLowerCase())) return undefined;
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  return allowed.find((item) => item === lower) ?? null;
}

function consentAccepted(value: unknown, now: Date): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => !["version", "value", "categories", "updatedAt"].includes(key))) {
    return false;
  }
  if (record.version !== 1 || record.value !== "all") return false;
  if (!record.categories || typeof record.categories !== "object" || Array.isArray(record.categories)) {
    return false;
  }
  const categories = record.categories as Record<string, unknown>;
  const categoryKeys = Object.keys(categories);
  if (categoryKeys.some((key) => key !== "essential" && key !== "analytics")) return false;
  if (categories.essential !== true || categories.analytics !== true) return false;
  if (typeof record.updatedAt !== "string" || !isIsoTimestamp(record.updatedAt)) return false;
  return Date.parse(record.updatedAt) <= now.getTime() + 5 * 60 * 1000;
}

export function payloadHash(event: Omit<SanitisedEvent, "payloadHash" | "eventDay" | "eventSort" | "expiresAt">): string {
  const canonical: Record<string, string> = {};
  for (const field of HASH_FIELDS) {
    const value = event[field];
    if (value !== undefined) canonical[field] = value;
  }
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function validateEvent(body: unknown, now: Date): EventValidation {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "invalid_body" };
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) return { ok: false, reason: "forbidden_field" };
    if (!ALLOWED_BODY_KEYS.has(key)) return { ok: false, reason: "unsupported_field" };
  }
  if ("referrer" in record && "referrerHost" in record) {
    return { ok: false, reason: "unsupported_field" };
  }
  const visitorId = normaliseIdentifier(record.visitorId);
  const sessionId = normaliseIdentifier(record.sessionId);
  const eventId = normaliseIdentifier(record.eventId);
  if (!visitorId || !sessionId || !eventId) return { ok: false, reason: "invalid_identifier" };
  if (typeof record.occurredAt !== "string" || !OCCURRED_AT_PATTERN.test(record.occurredAt)) {
    return { ok: false, reason: "invalid_time" };
  }
  if (Number.isNaN(Date.parse(record.occurredAt))) return { ok: false, reason: "invalid_time" };
  const pagePath = normalisePagePath(record.pagePath);
  if (!pagePath) return { ok: false, reason: "invalid_path" };
  const source = enumValue(record.source, SOURCE_VALUES);
  if (!source) return { ok: false, reason: "invalid_source" };
  const deviceCategory = enumValue(record.deviceCategory, DEVICE_VALUES);
  if (!deviceCategory) return { ok: false, reason: "invalid_device" };
  const browserCategory = enumValue(record.browserCategory, BROWSER_VALUES);
  if (!browserCategory) return { ok: false, reason: "invalid_browser" };
  if (!consentAccepted(record.consent, now)) return { ok: false, reason: "invalid_consent" };

  const utmSource = optionalUtm(record.utmSource);
  const utmMedium = optionalUtm(record.utmMedium);
  const utmCampaign = optionalUtm(record.utmCampaign);
  const utmTerm = optionalUtm(record.utmTerm);
  const utmContent = optionalUtm(record.utmContent);
  if (
    utmSource === null ||
    utmMedium === null ||
    utmCampaign === null ||
    utmTerm === null ||
    utmContent === null
  ) {
    return { ok: false, reason: "invalid_body" };
  }

  const referrerInput = "referrerHost" in record ? record.referrerHost : record.referrer;
  const draft = {
    visitorId,
    sessionId,
    eventId,
    occurredAt: record.occurredAt,
    pagePath,
    source,
    referrerHost: normaliseReferrer(referrerInput),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
    ...(utmTerm ? { utmTerm } : {}),
    ...(utmContent ? { utmContent } : {}),
    deviceCategory,
    browserCategory,
  };
  const event: SanitisedEvent = {
    ...draft,
    eventDay: londonDate(new Date(record.occurredAt)),
    eventSort: `${record.occurredAt}#${eventId}`,
    payloadHash: payloadHash(draft),
    expiresAt: expiresAtFromInstant(record.occurredAt),
  };
  return { ok: true, event };
}
