/**
 * Consent-gated page-view collector for the public site.
 * Sends one exact JSON body to the first-party ingest endpoint.
 * A retry resends those bytes. No third-party collector.
 */

import {
  ANALYTICS_SESSION_ID_KEY,
  ANALYTICS_VISITOR_ID_KEY,
  CONSENT_STORAGE_KEY,
  isAnalyticsConsentGranted,
  parseConsent,
  type ConsentRecord,
} from "@/lib/consent";
import type {
  BrowserCategory,
  DeviceCategory,
  EventDraft,
  TrafficSource,
} from "@/lib/analytics/event-core";

type EventCore = typeof import("@/lib/analytics/event-core");

let eventCorePromise: Promise<EventCore> | null = null;

function loadEventCore(): Promise<EventCore> {
  eventCorePromise ??= import("@/lib/analytics/event-core");
  return eventCorePromise;
}

export const PENDING_PAGE_VIEW_KEY = "occasionfun-analytics-pending-page-view";

const UTM_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const UTM_QUERY = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_term", "utmTerm"],
  ["utm_content", "utmContent"],
] as const;

type UtmField = (typeof UTM_QUERY)[number][1];
type CollectDisposition = "accepted" | "terminal" | "retry" | "dropped";

export type PageSnapshot = {
  pathname: string;
  search: string;
  referrer: string;
  userAgent: string;
};

export type PageCollectorOptions = {
  endpoint: string | undefined;
  now: () => Date;
  randomId: () => string;
  fetchPage: (
    url: string,
    raw: string,
    signal: AbortSignal,
  ) => Promise<{ status: number; body: string }>;
  getPage: () => PageSnapshot;
};

export type PageCollector = {
  sync: () => Promise<void>;
  abandon: () => void;
};

export function classifyCollectResponse(status: number, body: string): Exclude<CollectDisposition, "dropped"> {
  let code: string | undefined;
  let retry = false;
  try {
    const parsed = JSON.parse(body) as { code?: unknown; retry?: unknown };
    if (typeof parsed.code === "string") code = parsed.code;
    retry = parsed.retry === true;
  } catch {
    // A non-JSON body is classified from the status code.
  }
  if (code === "accepted" || status === 202) return "accepted";
  if (code === "event_unavailable" || status === 503 || status >= 500) return "retry";
  if (
    code === "rejected" ||
    code === "event_conflict" ||
    code === "event_stale" ||
    code === "event_future" ||
    code === "event_expired"
  ) {
    return "terminal";
  }
  if (retry) return "retry";
  if (status === 400 || status === 405 || status === 409 || status === 413) return "terminal";
  if (status >= 200 && status < 300) return "accepted";
  return "retry";
}

export function deviceCategoryFromUserAgent(userAgent: string): DeviceCategory {
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet") || (ua.includes("android") && !ua.includes("mobile"))) {
    return "tablet";
  }
  if (ua.includes("mobi") || ua.includes("iphone") || ua.includes("ipod")) return "mobile";
  if (!ua.trim()) return "other";
  return "desktop";
}

export function browserCategoryFromUserAgent(userAgent: string): BrowserCategory {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("firefox/") || ua.includes("fxios/")) return "firefox";
  if (ua.includes("chrome/") || ua.includes("crios/")) return "chrome";
  if (ua.includes("safari/")) return "safari";
  return "other";
}

export function createPageCollector(options: PageCollectorOptions): PageCollector {
  let lastPath: string | null = null;
  let pendingOwned = false;
  let generation = 0;
  let abortController: AbortController | null = null;
  let chain: Promise<void> = Promise.resolve();

  function dropTracking(): void {
    generation += 1;
    abortController?.abort();
    abortController = null;
    pendingOwned = false;
    lastPath = null;
    try {
      window.sessionStorage.removeItem(PENDING_PAGE_VIEW_KEY);
    } catch {
      // Consent is already off. A stuck payload is not sent again.
    }
  }

  function clearPending(session: Storage): void {
    pendingOwned = false;
    try {
      session.removeItem(PENDING_PAGE_VIEW_KEY);
    } catch {
      // The next attempt will see the old payload and send those same bytes.
    }
  }

  async function send(endpoint: string, raw: string, gen: number): Promise<CollectDisposition> {
    const controller = new AbortController();
    abortController = controller;
    try {
      const response = await options.fetchPage(endpoint, raw, controller.signal);
      if (gen !== generation) return "dropped";
      return classifyCollectResponse(response.status, response.body);
    } catch {
      if (gen !== generation) return "dropped";
      return "retry";
    } finally {
      if (abortController === controller) abortController = null;
    }
  }

  async function step(): Promise<void> {
    const gen = generation;
    if (!isAnalyticsConsentGranted()) {
      dropTracking();
      return;
    }
    const endpoint = options.endpoint?.trim();
    if (!endpoint) return;
    const core = await loadEventCore();
    if (gen !== generation || !isAnalyticsConsentGranted()) return;
    let stores: { local: Storage; session: Storage };
    try {
      stores = { local: window.localStorage, session: window.sessionStorage };
    } catch {
      return;
    }

    let page: PageSnapshot;
    try {
      page = options.getPage();
    } catch {
      return;
    }
    const path = core.normalisePagePath(page.pathname);
    const pending = readPending(stores.session);
    if (pending) {
      const outcome = await send(endpoint, pending, gen);
      if (gen !== generation || !isAnalyticsConsentGranted()) return;
      if (outcome === "retry") return;
      const owned = pendingOwned;
      const sentPath = pathFromPayload(pending, core);
      clearPending(stores.session);
      if (owned && sentPath !== null && sentPath === path) {
        lastPath = sentPath;
        return;
      }
    }

    if (gen !== generation || !isAnalyticsConsentGranted()) return;
    if (!path || lastPath === path) return;
    const raw = buildPayload(stores, page, path, options, core, lastPath !== null);
    if (!raw || gen !== generation || !isAnalyticsConsentGranted()) {
      if (!isAnalyticsConsentGranted()) dropTracking();
      return;
    }
    if (!writePending(stores.session, raw)) return;
    pendingOwned = true;
    lastPath = path;
    const outcome = await send(endpoint, raw, gen);
    if (gen !== generation || !isAnalyticsConsentGranted()) return;
    if (outcome === "retry") return;
    clearPending(stores.session);
  }

  return {
    sync() {
      const run = chain.then(step);
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    abandon() {
      dropTracking();
    },
  };
}

function readPending(session: Storage): string | null {
  try {
    const raw = session.getItem(PENDING_PAGE_VIEW_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function writePending(session: Storage, raw: string): boolean {
  try {
    session.setItem(PENDING_PAGE_VIEW_KEY, raw);
    return session.getItem(PENDING_PAGE_VIEW_KEY) === raw;
  } catch {
    return false;
  }
}

function pathFromPayload(raw: string, core: EventCore): string | null {
  try {
    const parsed = JSON.parse(raw) as { pagePath?: unknown };
    return core.normalisePagePath(parsed.pagePath);
  } catch {
    return null;
  }
}

function readConsentRecord(): ConsentRecord | null {
  try {
    const parsed = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    if (!parsed.ok || parsed.record.value !== "all" || parsed.record.categories.analytics !== true) {
      return null;
    }
    return parsed.record;
  } catch {
    return null;
  }
}

function identifier(storage: Storage, key: string, randomId: () => string, core: EventCore): string | null {
  try {
    const existing = core.normaliseIdentifier(storage.getItem(key));
    if (existing) return existing;
    const created = core.normaliseIdentifier(randomId());
    if (!created) return null;
    storage.setItem(key, created);
    return core.normaliseIdentifier(storage.getItem(key));
  } catch {
    return null;
  }
}

function keepUtm(value: string | null): string | undefined {
  if (!value || !UTM_PATTERN.test(value)) return undefined;
  if (/\d{8,}/.test(value) || UUID_PATTERN.test(value.toLowerCase())) return undefined;
  return value;
}

function readUtms(search: string): Partial<Record<UtmField, string>> {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const utm: Partial<Record<UtmField, string>> = {};
  for (const [query, field] of UTM_QUERY) {
    const kept = keepUtm(params.get(query));
    if (kept) utm[field] = kept;
  }
  return utm;
}

function sourceFor(referrerHost: string, hasUtm: boolean): TrafficSource {
  if (hasUtm) return "campaign";
  if (referrerHost === "direct" || referrerHost === "internal") return referrerHost;
  if (/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|baidu)\./.test(referrerHost)) return "search";
  if (
    referrerHost === "t.co" ||
    referrerHost === "x.com" ||
    /(^|\.)(facebook|instagram|linkedin|youtube|tiktok|pinterest|reddit)\./.test(referrerHost)
  ) {
    return "social";
  }
  return "referral";
}

function buildPayload(
  stores: { local: Storage; session: Storage },
  page: PageSnapshot,
  path: string,
  options: PageCollectorOptions,
  core: EventCore,
  followedInPage: boolean,
): string | null {
  const consent = readConsentRecord();
  if (!consent) return null;
  const visitorId = identifier(stores.local, ANALYTICS_VISITOR_ID_KEY, options.randomId, core);
  const sessionId = identifier(stores.session, ANALYTICS_SESSION_ID_KEY, options.randomId, core);
  const eventId = core.normaliseIdentifier(options.randomId());
  if (!visitorId || !sessionId || !eventId) return null;

  const now = options.now();
  const utm = readUtms(page.search);
  const referrerHost = followedInPage ? "internal" : core.normaliseReferrer(page.referrer);
  const candidate = {
    visitorId,
    sessionId,
    eventId,
    occurredAt: now.toISOString(),
    pagePath: path,
    source: sourceFor(referrerHost, Object.keys(utm).length > 0),
    referrerHost,
    ...utm,
    deviceCategory: deviceCategoryFromUserAgent(page.userAgent),
    browserCategory: browserCategoryFromUserAgent(page.userAgent),
    consent: {
      version: consent.version,
      value: consent.value,
      categories: {
        essential: true as const,
        analytics: true as const,
      },
      updatedAt: consent.updatedAt,
    },
  };
  const sanitised = core.sanitiseEvent(candidate, now);
  if (!sanitised.ok || consent.value !== "all") return null;
  return canonicalPayload(sanitised.event, {
    version: consent.version,
    value: consent.value,
    categories: { essential: true, analytics: true },
    updatedAt: consent.updatedAt,
  });
}

function canonicalPayload(
  event: EventDraft,
  consent: {
    version: 1;
    value: "all";
    categories: { essential: true; analytics: true };
    updatedAt: string;
  },
): string {
  const body: Record<string, unknown> = {
    visitorId: event.visitorId,
    sessionId: event.sessionId,
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    pagePath: event.pagePath,
    source: event.source,
    referrerHost: event.referrerHost,
  };
  if (event.utmSource) body.utmSource = event.utmSource;
  if (event.utmMedium) body.utmMedium = event.utmMedium;
  if (event.utmCampaign) body.utmCampaign = event.utmCampaign;
  if (event.utmTerm) body.utmTerm = event.utmTerm;
  if (event.utmContent) body.utmContent = event.utmContent;
  body.deviceCategory = event.deviceCategory;
  body.browserCategory = event.browserCategory;
  body.consent = consent;
  return JSON.stringify(body);
}
