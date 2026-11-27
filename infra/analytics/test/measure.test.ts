import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { acceptAggregateMeasurement } from "@/lib/analytics/aggregate";
import { countryFromIp, isNonPublicAddress, openCountryReader, type CountryLookup } from "../src/country";
import { handleMeasure, type MeasureDependencies, type MeasureEvent, type MeasureLog } from "../src/measure";
import { COUNTER_UPDATE_EXPRESSION, type CounterUpdate, type TrafficUpdate } from "../src/traffic-stats";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-11-24T12:00:00.000Z");
const SOURCE_IP = "203.0.113.50";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 UniqueAgentToken";
const REFERER = "https://www.google.co.uk/search?q=UniqueQueryToken&utm_source=google";

function memoryUpdates(): TrafficUpdate & { calls: CounterUpdate[] } {
  const calls: CounterUpdate[] = [];
  return {
    calls,
    async update(input) {
      calls.push(input);
    },
  };
}

function event(body: unknown, extra: Partial<MeasureEvent> = {}): MeasureEvent {
  return {
    body: JSON.stringify(body),
    headers: {
      referer: REFERER,
      "user-agent": USER_AGENT,
      "CloudFront-Viewer-Country": "US",
      "X-Forwarded-For": "8.8.8.8",
    },
    requestContext: {
      requestId: "req-1",
      http: { method: "POST", sourceIp: SOURCE_IP },
    },
    ...extra,
  };
}

function dependencies(overrides: {
  enabled?: boolean;
  dynamo?: TrafficUpdate & { calls: CounterUpdate[] };
  countryFor?: MeasureDependencies["countryFor"];
} = {}): MeasureDependencies & {
  dynamo: TrafficUpdate & { calls: CounterUpdate[] };
  logs: MeasureLog[];
  seenIps: Array<string | undefined>;
} {
  const logs: MeasureLog[] = [];
  const seenIps: Array<string | undefined> = [];
  return {
    tableName: "occasionfun-co-uk-demo-traffic-stats",
    enabled: overrides.enabled ?? true,
    now: () => NOW,
    dynamo: overrides.dynamo ?? memoryUpdates(),
    countryFor: overrides.countryFor ?? ((ip) => {
      seenIps.push(ip);
      return ip === SOURCE_IP ? "FR" : undefined;
    }),
    log(entry) {
      logs.push(entry);
    },
    logs,
    seenIps,
  };
}

function parsed(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

describe("aggregate measurement handler", () => {
  it("accepts only pagePath and landing", async () => {
    const deps = dependencies();
    const response = await handleMeasure(event({ pagePath: "/", landing: true }), deps);
    expect(response.statusCode).toBe(202);
    expect(parsed(response)).toEqual({ code: "accepted", retry: false });
    expect(deps.dynamo.calls).toHaveLength(2);
  });

  it("rejects forged country, source, device, and browser fields", async () => {
    const deps = dependencies();
    const response = await handleMeasure(
      event({
        pagePath: "/",
        landing: true,
        country: "US",
        source: "campaign",
        device: "desktop",
        browser: "chrome",
        visitorId: "visitor-1",
      }),
      deps,
    );
    expect(response.statusCode).toBe(400);
    expect(parsed(response)).toEqual({ code: "rejected", retry: false, reason: "forbidden_field" });
    expect(deps.dynamo.calls).toHaveLength(0);
    expect(JSON.stringify(deps.logs)).not.toContain("US");
    expect(JSON.stringify(deps.logs)).not.toContain("visitor-1");
  });

  it("derives country from sourceIp and ignores forged country headers", async () => {
    const deps = dependencies();
    const response = await handleMeasure(event({ pagePath: "/", landing: false }), deps);
    expect(response.statusCode).toBe(202);
    expect(deps.seenIps).toEqual([SOURCE_IP]);
    expect(deps.dynamo.calls).toHaveLength(1);
    expect(deps.dynamo.calls[0]?.ExpressionAttributeValues[":country"]).toBe("FR");
    const stored = JSON.stringify(deps.dynamo.calls);
    expect(stored).not.toContain("US");
    expect(stored).not.toContain("8.8.8.8");
    expect(stored).not.toContain(SOURCE_IP);
    expect(stored).not.toContain("UniqueAgentToken");
    expect(stored).not.toContain("UniqueQueryToken");
    expect(stored).not.toContain("utm_source");
    expect(JSON.stringify(deps.logs)).not.toContain(SOURCE_IP);
    expect(parsed(response)).not.toHaveProperty("country");
  });

  it("stores ZZ when the address is missing", async () => {
    const deps = dependencies();
    const response = await handleMeasure(
      event(
        { pagePath: "/", landing: false },
        { requestContext: { requestId: "req-1", http: { method: "POST" } } },
      ),
      deps,
    );
    expect(response.statusCode).toBe(202);
    expect(deps.seenIps).toEqual([undefined]);
    expect(deps.dynamo.calls[0]?.ExpressionAttributeValues[":country"]).toBe("ZZ");
  });

  it("classifies referer, device, and browser and increments both counters for a landing", async () => {
    const deps = dependencies();
    await handleMeasure(event({ pagePath: "/", landing: true }), deps);
    const expected = acceptAggregateMeasurement(
      { pagePath: "/", landing: true },
      { country: "FR", source: "search", deviceCategory: "desktop", browserCategory: "chrome", now: NOW },
    );
    expect(expected.ok).toBe(true);
    if (!expected.ok) return;
    expect(deps.dynamo.calls.map((call) => call.Key)).toEqual([
      { statDay: expected.measurement.statDay, statKey: expected.measurement.pageViewKey },
      { statDay: expected.measurement.statDay, statKey: expected.measurement.visitKey },
    ]);
    for (const call of deps.dynamo.calls) {
      expect(call.UpdateExpression).toBe(COUNTER_UPDATE_EXPRESSION);
      expect(call.UpdateExpression.startsWith("ADD #count :one")).toBe(true);
      expect(call.ExpressionAttributeValues[":one"]).toBe(1);
      expect(call.ExpressionAttributeValues[":expiresAt"]).toBe(expected.measurement.expiresAt);
      expect(call.ExpressionAttributeNames["#count"]).toBe("count");
    }
    expect(deps.dynamo.calls[0]?.ExpressionAttributeValues[":metric"]).toBe("page_view");
    expect(deps.dynamo.calls[1]?.ExpressionAttributeValues[":metric"]).toBe("visit");
    expect(deps.dynamo.calls[0]?.ExpressionAttributeValues[":source"]).toBe("search");
    expect(deps.dynamo.calls[0]?.ExpressionAttributeValues[":deviceCategory"]).toBe("desktop");
    expect(deps.dynamo.calls[0]?.ExpressionAttributeValues[":browserCategory"]).toBe("chrome");
  });

  it("increments only the page-view counter when the view is not a landing", async () => {
    const deps = dependencies();
    await handleMeasure(event({ pagePath: "/about", landing: false }), deps);
    expect(deps.dynamo.calls).toHaveLength(1);
    expect(deps.dynamo.calls[0]?.Key.statKey.startsWith("pv#")).toBe(true);
    expect(deps.dynamo.calls[0]?.ExpressionAttributeValues[":pagePath"]).toBe("/about");
    expect(JSON.stringify(deps.dynamo.calls)).not.toContain("vs#");
  });

  it("makes no DynamoDB call when measurement is disabled", async () => {
    const calls: CounterUpdate[] = [];
    const deps = dependencies({
      enabled: false,
      dynamo: {
        calls,
        async update() {
          throw new Error("dynamo must not be called");
        },
      },
      countryFor() {
        throw new Error("country must not be resolved");
      },
    });
    const response = await handleMeasure(event({ pagePath: "/", landing: true, country: "US" }), deps);
    expect(response.statusCode).toBe(204);
    expect(parsed(response)).toEqual({ code: "disabled", retry: false });
    expect(calls).toHaveLength(0);
    expect(deps.logs).toEqual([]);
  });

  it("returns 503 when DynamoDB fails and does not log the address or the exception", async () => {
    const calls: CounterUpdate[] = [];
    const deps = dependencies({
      dynamo: {
        calls,
        async update(input) {
          calls.push(input);
          throw new Error(`denied for ${SOURCE_IP} ${USER_AGENT}`);
        },
      },
    });
    const response = await handleMeasure(event({ pagePath: "/", landing: false }), deps);
    expect(response.statusCode).toBe(503);
    expect(parsed(response)).toEqual({ code: "unavailable", retry: false });
    expect(deps.logs).toEqual([{ code: "measure_failed", requestId: "req-1" }]);
    expect(JSON.stringify(deps.logs)).not.toContain(SOURCE_IP);
    expect(JSON.stringify(deps.logs)).not.toContain("UniqueAgentToken");
    expect(response.body).not.toContain(SOURCE_IP);
  });

  it("returns 503 after a landing visit write fails and keeps the page-view write", async () => {
    const calls: CounterUpdate[] = [];
    const deps = dependencies({
      dynamo: {
        calls,
        async update(input) {
          calls.push(input);
          if (calls.length === 2) throw new Error(`visit failed for ${SOURCE_IP}`);
        },
      },
    });
    const response = await handleMeasure(event({ pagePath: "/", landing: true }), deps);
    expect(response.statusCode).toBe(503);
    expect(parsed(response)).toEqual({ code: "unavailable", retry: false });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.ExpressionAttributeValues[":metric"]).toBe("page_view");
    expect(calls[1]?.ExpressionAttributeValues[":metric"]).toBe("visit");
    expect(JSON.stringify(deps.logs)).not.toContain(SOURCE_IP);
  });
});

describe("offline country lookup", () => {
  const reader: CountryLookup = {
    get(ip) {
      seen.push(ip);
      if (ip === "1.1.1.1") return { country: { iso_code: "au" } };
      if (ip === "2001:4860:4860::8888") return { country: { iso_code: "US" } };
      if (ip === "8.8.4.4") return { country: { iso_code: "United Kingdom" } };
      if (ip === "9.9.9.9") throw new Error(`lookup failed for ${ip}`);
      return null;
    },
  };
  let seen: string[] = [];

  it("returns undefined for a missing, private, or failed lookup", () => {
    seen = [];
    expect(countryFromIp(undefined, reader)).toBeUndefined();
    expect(countryFromIp("", reader)).toBeUndefined();
    for (const ip of ["10.1.2.3", "172.16.5.1", "192.168.1.20", "127.0.0.1", "169.254.1.1", "::1", "fc00::1", "fe80::1", "::ffff:10.0.0.1", "not-an-ip"]) {
      expect(isNonPublicAddress(ip)).toBe(true);
      expect(countryFromIp(ip, reader)).toBeUndefined();
    }
    expect(countryFromIp("1.1.1.1", null)).toBeUndefined();
    expect(countryFromIp("8.8.4.4", reader)).toBeUndefined();
    expect(countryFromIp("9.9.9.9", reader)).toBeUndefined();
    expect(countryFromIp("203.0.113.10", reader)).toBeUndefined();
    expect(seen).not.toContain("10.1.2.3");
    expect(seen).not.toContain("::1");
  });

  it("reads a public address from the local reader only", () => {
    seen = [];
    expect(countryFromIp("1.1.1.1", reader)).toBe("AU");
    expect(countryFromIp("2001:4860:4860::8888", reader)).toBe("US");
    expect(seen).toEqual(["1.1.1.1", "2001:4860:4860::8888"]);
  });

  it("fails closed when the database path is missing or unreadable", async () => {
    expect(await openCountryReader(undefined)).toBeNull();
    expect(await openCountryReader("")).toBeNull();
    expect(await openCountryReader("   ")).toBeNull();
    const directory = mkdtempSync(path.join(tmpdir(), "geolite-"));
    const missing = path.join(directory, "GeoLite2-Country.mmdb");
    expect(await openCountryReader(missing)).toBeNull();
    const corrupt = path.join(directory, "corrupt.mmdb");
    writeFileSync(corrupt, "not a maxmind database");
    expect(await openCountryReader(corrupt)).toBeNull();
  });
});

describe("measurement source boundaries", () => {
  it("does not import the consent collector or scan the table", () => {
    const measure = readFileSync(path.join(packageRoot, "src/measure.ts"), "utf8");
    const storage = readFileSync(path.join(packageRoot, "src/traffic-stats.ts"), "utf8");
    const country = readFileSync(path.join(packageRoot, "src/country.ts"), "utf8");
    expect(measure).not.toContain("collector");
    expect(measure).not.toContain("consent");
    expect(measure).not.toContain("CloudFront-Viewer-Country");
    expect(measure).not.toContain("x-forwarded-for");
    expect(measure).toContain('AGGREGATE_MEASUREMENT_ENABLED === "true"');
    expect(storage).not.toContain("Scan");
    expect(storage).not.toContain("sourceIp");
    expect(storage).toContain("ADD #count :one");
    expect(country).not.toContain("fetch(");
    expect(country).not.toContain("https.request");
  });
});
