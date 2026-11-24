import { describe, expect, it } from "vitest";

import {
  aggregateReport,
  CAMPAIGN_KEY_CAP,
  DISTINCT_VISITOR_CAP,
  PAGE_VIEW_READ_CAP,
  PROFILE_LOOKUP_CAP,
  VISITOR_DAY_READ_CAP,
  type PageViewFact,
  type ProfileBatch,
  type ReportSources,
  type VisitorDayFact,
} from "@/lib/analytics/report";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const FUTURE = 2_000_000_000;

function page(index: number, overrides: Partial<PageViewFact> = {}): PageViewFact {
  return {
    visitorId: `visitor-${index}`,
    expiresAt: FUTURE,
    pagePath: "/contact",
    source: "search",
    deviceCategory: "desktop",
    browserCategory: "chrome",
    ...overrides,
  };
}

function day(index: number, overrides: Partial<VisitorDayFact> = {}): VisitorDayFact {
  return {
    visitorId: `visitor-${index}`,
    day: "2026-11-24",
    expiresAt: FUTURE,
    firstSeenDay: "2026-11-01",
    newVisitor: false,
    source: "search",
    landingPath: "/contact",
    ...overrides,
  };
}

function sources(options: {
  pages?: PageViewFact[];
  days?: VisitorDayFact[];
  lookup?: (ids: readonly string[]) => ProfileBatch;
  onLookup?: (ids: readonly string[]) => void;
}): ReportSources & { lookups: string[][] } {
  const lookups: string[][] = [];
  return {
    lookups,
    pageViews: () => options.pages ?? [],
    visitorDays: () => options.days ?? [],
    lookupProfiles: (ids) => {
      lookups.push([...ids]);
      options.onLookup?.(ids);
      return (
        options.lookup?.(ids) ?? {
          profiles: new Map(ids.map((id) => [id, { firstSeenDay: "2026-11-24" }])),
          missing: new Set<string>(),
          unprocessed: [],
        }
      );
    },
  };
}

describe("reporting aggregation", () => {
  it("aggregates visitors, pages, sources, campaigns, and landing pages", () => {
    const reader = sources({
      pages: [
        page(1, { utmSource: "google", utmMedium: "cpc", utmCampaign: "autumn", source: "campaign" }),
        page(1, { pagePath: "/about", source: "direct" }),
        page(2, { pagePath: "/about", expiresAt: 1 }),
      ],
      days: [
        day(1, { firstSeenDay: "2026-11-24", newVisitor: true, landingPath: "/contact", source: "campaign" }),
        day(2, { firstSeenDay: "2026-10-01", landingPath: "/about", source: "direct", expiresAt: 1 }),
      ],
    });
    const report = aggregateReport("2026-11-24", "2026-11-24", NOW, reader);
    expect(report.status).toBe("ok");
    if (report.status !== "ok") return;
    expect(report.pageViews).toBe(2);
    expect(report.visitorDays).toBe(1);
    expect(report.uniqueVisitors).toBe(1);
    expect(report.partialDates).toEqual(["2026-11-24"]);
    expect(report.sources).toMatchObject({ campaign: 1, direct: 0 });
    expect(report.devices.desktop).toBe(2);
    expect(report.paths).toEqual([
      { name: "/about", count: 1 },
      { name: "/contact", count: 1 },
    ]);
    expect(report.landingPages).toEqual([{ name: "/contact", count: 1 }]);
    expect(report.campaigns).toEqual([{ name: "google|cpc|autumn", count: 1 }]);
    expect(report.newReturning).toEqual({ status: "complete", newVisitors: 1, returningVisitors: 0 });
    expect(report.daily).toEqual([
      { date: "2026-11-24", pageViews: 2, visitorDays: 1, partial: true },
    ]);
  });

  it("keeps the top 50 campaigns and marks the result approximate above 256 keys", () => {
    const pages = Array.from({ length: CAMPAIGN_KEY_CAP + 1 }, (_, index) =>
      page(index, { utmCampaign: `campaign_${index}` }),
    );
    const report = aggregateReport("2026-11-24", "2026-11-24", NOW, sources({ pages }));
    expect(report.status).toBe("ok");
    if (report.status !== "ok") return;
    expect(report.campaignsApproximate).toBe(true);
    expect(report.campaigns).toHaveLength(50);
    expect(report.campaignsOther).toBe(CAMPAIGN_KEY_CAP + 1 - 50);
  });

  it("completes on an exact cap and discards totals when the next record would exceed it", () => {
    const pages = Array.from({ length: PAGE_VIEW_READ_CAP }, (_, index) => page(index));
    const days = Array.from({ length: VISITOR_DAY_READ_CAP }, (_, index) => day(index));
    const full = aggregateReport("2026-11-24", "2026-11-24", NOW, sources({ pages, days }));
    expect(full.status).toBe("ok");
    if (full.status !== "ok") return;
    expect(full.pageViews).toBe(PAGE_VIEW_READ_CAP);
    expect(full.visitorDays).toBe(VISITOR_DAY_READ_CAP);
    expect(full.uniqueVisitors).toBe(DISTINCT_VISITOR_CAP);

    const tooManyPages = aggregateReport(
      "2026-11-24",
      "2026-11-24",
      NOW,
      sources({ pages: [...pages, page(PAGE_VIEW_READ_CAP)] }),
    );
    expect(tooManyPages).toEqual({ status: "too_large" });

    const tooManyDays = aggregateReport(
      "2026-11-24",
      "2026-11-24",
      NOW,
      sources({ days: [...days, day(VISITOR_DAY_READ_CAP)] }),
    );
    expect(tooManyDays).toEqual({ status: "too_large" });
  });

  it("stops before profile lookups when the required set exceeds 2,000", () => {
    const days = Array.from({ length: PROFILE_LOOKUP_CAP + 1 }, (_, index) =>
      day(index, { newVisitor: true, firstSeenDay: "2026-11-24" }),
    );
    const reader = sources({ days });
    expect(aggregateReport("2026-11-24", "2026-11-24", NOW, reader)).toEqual({ status: "too_large" });
    expect(reader.lookups).toEqual([]);

    const exact = sources({
      days: days.slice(0, PROFILE_LOOKUP_CAP),
    });
    const report = aggregateReport("2026-11-24", "2026-11-24", NOW, exact);
    expect(report.status).toBe("ok");
    if (report.status !== "ok") return;
    expect(report.newReturning).toEqual({
      status: "complete",
      newVisitors: PROFILE_LOOKUP_CAP,
      returningVisitors: 0,
    });
    expect(exact.lookups.reduce((sum, batch) => sum + batch.length, 0)).toBe(PROFILE_LOOKUP_CAP);
    expect(exact.lookups.every((batch) => batch.length <= 100)).toBe(true);
  });

  it("omits new and returning numbers when a required profile stays unresolved", () => {
    const reader = sources({
      pages: [page(1)],
      days: [day(1, { newVisitor: true, firstSeenDay: "2026-11-24" })],
      lookup: () => ({ profiles: new Map(), missing: new Set<string>(), unprocessed: ["visitor-1"] }),
    });
    const report = aggregateReport("2026-11-24", "2026-11-24", NOW, reader);
    expect(report.status).toBe("ok");
    if (report.status !== "ok") return;
    expect(reader.lookups).toHaveLength(4);
    expect(report.uniqueVisitors).toBe(1);
    expect(report.pageViews).toBe(1);
    expect(report.newReturning).toEqual({ status: "incomplete", reason: "profile_unavailable" });
    expect(report.newReturning).not.toHaveProperty("newVisitors");
    expect(report.newReturning).not.toHaveProperty("returningVisitors");
  });
});
