/**
 * Demo aggregate measurement. Disabled unless AGGREGATE_MEASUREMENT_ENABLED
 * is the string "true". The JSON body may contain only pagePath and landing.
 * Country, source, device, and browser are derived here and are not returned.
 */

import { acceptAggregateMeasurement } from "@/lib/analytics/aggregate";
import { sourceFromReferrer } from "@/lib/analytics/referrer-source";
import { browserCategoryFromUserAgent, deviceCategoryFromUserAgent } from "@/lib/analytics/user-agent";
import { countryFromIp, openCountryReader, type CountryLookup } from "./country";
import { documentTrafficUpdates, storeAggregateMeasurement, type TrafficUpdate } from "./traffic-stats";

export const MAX_MEASURE_BODY_BYTES = 8192;

const REQUEST_ID = /^[A-Za-z0-9_=-]{1,128}$/;

export type MeasureEvent = {
  body?: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
  requestContext?: {
    requestId?: string;
    http?: { method?: string; sourceIp?: string };
  };
};

type MeasureResponse = {
  statusCode: number;
  headers: { "content-type": string };
  body: string;
};

export type MeasureLog = {
  code: "measure_rejected" | "measure_failed";
  requestId: string;
};

export type MeasureDependencies = {
  tableName: string;
  enabled: boolean;
  now: () => Date;
  dynamo: TrafficUpdate;
  countryFor: (ip: string | undefined) => string | undefined;
  log: (entry: MeasureLog) => void;
};

function json(
  statusCode: number,
  body: { code: string; retry: false; reason?: string },
): MeasureResponse {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function requestId(event: MeasureEvent): string {
  const id = event.requestContext?.requestId;
  return typeof id === "string" && REQUEST_ID.test(id) ? id : "";
}

function header(headers: MeasureEvent["headers"], name: string): string {
  if (!headers) return "";
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && typeof value === "string") return value;
  }
  return "";
}

function decodeBody(event: MeasureEvent): string | null {
  if (typeof event.body !== "string") return null;
  if (!event.isBase64Encoded) return event.body;
  try {
    return Buffer.from(event.body, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export async function handleMeasure(event: MeasureEvent, dependencies: MeasureDependencies): Promise<MeasureResponse> {
  if (!dependencies.enabled) return json(204, { code: "disabled", retry: false });
  if (event.requestContext?.http?.method !== "POST") {
    return json(405, { code: "rejected", retry: false });
  }
  if (!dependencies.tableName) return json(503, { code: "unavailable", retry: false });

  const raw = decodeBody(event);
  if (raw === null || Buffer.byteLength(raw) > MAX_MEASURE_BODY_BYTES) {
    dependencies.log({ code: "measure_rejected", requestId: requestId(event) });
    return json(400, { code: "rejected", retry: false, reason: "invalid_body" });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    dependencies.log({ code: "measure_rejected", requestId: requestId(event) });
    return json(400, { code: "rejected", retry: false, reason: "invalid_body" });
  }

  const sourceIp = event.requestContext?.http?.sourceIp;
  const accepted = acceptAggregateMeasurement(body, {
    country: dependencies.countryFor(typeof sourceIp === "string" ? sourceIp : undefined),
    source: sourceFromReferrer(header(event.headers, "referer")),
    deviceCategory: deviceCategoryFromUserAgent(header(event.headers, "user-agent")),
    browserCategory: browserCategoryFromUserAgent(header(event.headers, "user-agent")),
    now: dependencies.now(),
  });
  if (!accepted.ok) {
    dependencies.log({ code: "measure_rejected", requestId: requestId(event) });
    return json(400, { code: "rejected", retry: false, reason: accepted.reason });
  }

  try {
    const stored = await storeAggregateMeasurement(dependencies.tableName, accepted.measurement, dependencies.dynamo);
    if (stored !== "stored") {
      dependencies.log({ code: "measure_failed", requestId: requestId(event) });
      return json(503, { code: "unavailable", retry: false });
    }
    return json(202, { code: "accepted", retry: false });
  } catch {
    dependencies.log({ code: "measure_failed", requestId: requestId(event) });
    return json(503, { code: "unavailable", retry: false });
  }
}

let readerPromise: Promise<CountryLookup | null> | undefined;

export async function handler(event: MeasureEvent): Promise<MeasureResponse> {
  const enabled = process.env.AGGREGATE_MEASUREMENT_ENABLED === "true";
  const reader = enabled ? await sharedCountryReader(process.env.GEOLITE2_COUNTRY_DB) : null;
  return handleMeasure(event, {
    tableName: process.env.TRAFFIC_STATS_TABLE_NAME ?? "",
    enabled,
    now: () => new Date(),
    dynamo: documentTrafficUpdates(),
    countryFor: (ip) => countryFromIp(ip, reader),
    log: (entry) => {
      console.log(JSON.stringify(entry));
    },
  });
}

function sharedCountryReader(databasePath: string | undefined): Promise<CountryLookup | null> {
  readerPromise ??= openCountryReader(databasePath);
  return readerPromise;
}
