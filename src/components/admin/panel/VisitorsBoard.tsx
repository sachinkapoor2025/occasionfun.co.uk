"use client";

import { useEffect, useState } from "react";
import { currentAccessToken } from "@/lib/admin/auth";
import {
  fetchPageViewActivity,
  fetchVisitorActivity,
  type ActivityFilter,
  type AggregateRangeReason,
  type PageViewActivity,
  type VisitorActivity,
} from "@/lib/admin/api";
import { addLondonDays, londonDate, reportingWindow, validateReportRange } from "@/lib/analytics/dates";
import { SOURCE_VALUES, allowedPagePaths } from "@/lib/analytics/event-core";

const RANGE_MESSAGE: Record<AggregateRangeReason, string> = {
  invalid_date: "Enter a real start and end date.",
  inverted: "The end date is before the start date.",
  outside_window: "Dates must fall inside the latest 90 London dates.",
  too_long: "The range cannot be longer than 90 London dates.",
};

const SOURCE_LABEL = {
  direct: "Direct",
  internal: "Internal",
  search: "Search",
  social: "Social",
  referral: "Referral",
  campaign: "Campaign",
} as const;

const PERIOD_OPTIONS = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "15", label: "Last 15 days", days: 15 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "custom", label: "Custom date range", days: null },
] as const;

type PeriodChoice = (typeof PERIOD_OPTIONS)[number]["id"];
type BoardStatus = "loading" | "error" | "forbidden" | "unconfigured" | "invalid" | "ready";

const londonTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  dateStyle: "medium",
  timeStyle: "short",
});

export function VisitorsBoard({
  onUnauthorised,
  now = () => new Date(),
}: {
  onUnauthorised: () => void;
  now?: () => Date;
}) {
  const [clock] = useState(() => now());
  const allowed = reportingWindow(clock);
  const initial = inclusiveLondonRange(7, clock);
  const [choice, setChoice] = useState<PeriodChoice>("7");
  const [draftStart, setDraftStart] = useState(initial.start);
  const [draftEnd, setDraftEnd] = useState(initial.end);
  const [applied, setApplied] = useState(initial);
  const [path, setPath] = useState("");
  const [source, setSource] = useState("");
  const [viewOffset, setViewOffset] = useState(0);
  const [visitorOffset, setVisitorOffset] = useState(0);
  const [rangeError, setRangeError] = useState<AggregateRangeReason | null>(null);
  const [reload, setReload] = useState(0);
  const [fetched, setFetched] = useState<{
    key: string;
    status: Exclude<BoardStatus, "loading">;
    visitors: VisitorActivity | null;
    pages: PageViewActivity | null;
  } | null>(null);
  const requestKey = [applied.start, applied.end, path, source, viewOffset, visitorOffset, reload].join("\u0000");
  const status: BoardStatus = fetched?.key === requestKey ? fetched.status : "loading";
  const visitors = fetched?.key === requestKey ? fetched.visitors : null;
  const pages = fetched?.key === requestKey ? fetched.pages : null;
  const choiceLabel = PERIOD_OPTIONS.find((option) => option.id === choice)?.label ?? "Last 7 days";

  useEffect(() => {
    let cancelled = false;
    const key = requestKey;
    void (async () => {
      const access = await currentAccessToken();
      if (cancelled) return;
      if (access.status !== "token") {
        onUnauthorised();
        return;
      }
      const shared: ActivityFilter = {
        start: applied.start,
        end: applied.end,
        limit: 25,
        ...(path ? { path } : {}),
        ...(source ? { source } : {}),
      };
      const [visitorResult, pageResult] = await Promise.all([
        fetchVisitorActivity(access.token, {
          ...shared,
          ...(visitorOffset > 0 ? { offset: visitorOffset } : {}),
        }),
        fetchPageViewActivity(access.token, {
          ...shared,
          ...(viewOffset > 0 ? { offset: viewOffset } : {}),
        }),
      ]);
      if (cancelled) return;
      const outcome = combine(visitorResult.status, pageResult.status);
      if (outcome === "unauthorized") {
        onUnauthorised();
        return;
      }
      setFetched({
        key,
        status: outcome,
        visitors: visitorResult.status === "ok" ? visitorResult.activity : null,
        pages: pageResult.status === "ok" ? pageResult.activity : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [applied.end, applied.start, onUnauthorised, path, requestKey, source, viewOffset, visitorOffset]);

  function applyPreset(next: PeriodChoice) {
    setChoice(next);
    setRangeError(null);
    setViewOffset(0);
    setVisitorOffset(0);
    const option = PERIOD_OPTIONS.find((item) => item.id === next);
    if (!option?.days) return;
    const range = inclusiveLondonRange(option.days, clock);
    setDraftStart(range.start);
    setDraftEnd(range.end);
    setApplied(range);
  }

  function applyCustom() {
    const range = validateReportRange(draftStart, draftEnd, clock);
    if (!range.ok) {
      setRangeError(range.reason);
      return;
    }
    setRangeError(null);
    setViewOffset(0);
    setVisitorOffset(0);
    setApplied({ start: range.start, end: range.end });
  }

  const empty =
    status === "ready" &&
    visitors !== null &&
    pages !== null &&
    !visitors.summary.truncated &&
    !pages.summary.truncated &&
    (visitors.summary.recordedVisitors ?? 0) === 0 &&
    (pages.summary.pageViews ?? 0) === 0 &&
    visitors.items.length === 0 &&
    pages.items.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-navy-900">Visitors & Activity</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Page views are stored only after a visitor allows analytics cookies. This list does not show visitor identifiers.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-navy-900"
          onClick={() => setReload((value) => value + 1)}
        >
          Refresh
        </button>
      </header>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-navy-900">Reporting period</legend>
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <label key={option.id} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
              <input
                type="radio"
                name="visitor-period"
                checked={choice === option.id}
                onChange={() => applyPreset(option.id)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {choice === "custom" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-sm font-semibold text-navy-900">
              Start date, London
              <input
                type="date"
                className="mt-1 block rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm"
                value={draftStart}
                min={allowed.start}
                max={allowed.end}
                onChange={(event) => setDraftStart(event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-navy-900">
              End date, London
              <input
                type="date"
                className="mt-1 block rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm"
                value={draftEnd}
                min={allowed.start}
                max={allowed.end}
                onChange={(event) => setDraftEnd(event.target.value)}
              />
            </label>
            <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={applyCustom}>
              Apply dates
            </button>
          </div>
        ) : null}
      </fieldset>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="text-sm font-semibold text-navy-900">
          Page
          <select
            className="mt-1 block w-full rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm"
            value={path}
            onChange={(event) => {
              setPath(event.target.value);
              setViewOffset(0);
              setVisitorOffset(0);
            }}
          >
            <option value="">All pages</option>
            {allowedPagePaths().map((page) => (
              <option key={page} value={page}>
                {page}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-navy-900">
          Traffic source
          <select
            className="mt-1 block w-full rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setViewOffset(0);
              setVisitorOffset(0);
            }}
          >
            <option value="">All sources</option>
            {SOURCE_VALUES.map((item) => (
              <option key={item} value={item}>
                {SOURCE_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm leading-6 text-slate-600">
        {choiceLabel}, {applied.start} to {applied.end}, Europe/London.
      </p>
      {rangeError ? <p className="text-sm font-semibold text-navy-900">{RANGE_MESSAGE[rangeError]}</p> : null}
      {status === "loading" ? <p className="text-sm text-slate-600">Loading visitor records…</p> : null}
      {status === "error" ? (
        <p className="text-sm leading-6 text-slate-600">Visitor records could not be loaded.</p>
      ) : null}
      {status === "forbidden" ? (
        <p className="text-sm leading-6 text-slate-600">This account cannot read visitor records.</p>
      ) : null}
      {status === "unconfigured" ? (
        <p className="text-sm leading-6 text-slate-600">The administration API is not configured, so no visitor records were requested.</p>
      ) : null}
      {status === "invalid" ? (
        <p className="text-sm leading-6 text-slate-600">That page or traffic source is not available for this report.</p>
      ) : null}
      {status === "error" ? (
        <button type="button" className="text-sm font-semibold text-accent" onClick={() => setReload((value) => value + 1)}>
          Try again
        </button>
      ) : null}
      {empty ? (
        <section className="rounded-lg border border-slate-200 bg-surface px-4 py-5">
          <h3 className="text-sm font-semibold text-navy-900">No consent-authorised analytics records are currently available.</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The collector and visitor tables are installed. A record appears here after a visitor allows analytics cookies and a page view is stored.
          </p>
        </section>
      ) : null}
      {status === "ready" && visitors && pages && !empty ? (
        <ActivityView
          visitors={visitors}
          pages={pages}
          onNextViews={() => {
            if (pages.nextOffset !== null) setViewOffset(pages.nextOffset);
          }}
          onNextVisitors={() => {
            if (visitors.nextOffset !== null) setVisitorOffset(visitors.nextOffset);
          }}
        />
      ) : null}
    </div>
  );
}

function ActivityView({
  visitors,
  pages,
  onNextViews,
  onNextVisitors,
}: {
  visitors: VisitorActivity;
  pages: PageViewActivity;
  onNextViews: () => void;
  onNextVisitors: () => void;
}) {
  const top = pages.summary.mostViewedPage;
  return (
    <div className="space-y-6">
      {visitors.summary.truncated || pages.summary.truncated ? (
        <p className="text-sm leading-6 text-slate-600">
          This range has more records than the report can summarise. Narrow the dates before treating the totals as complete.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visitors.summary.recordedVisitors !== null ? (
          <Metric label="Recorded visitors" value={String(visitors.summary.recordedVisitors)} detail="Distinct visitors in this period." />
        ) : null}
        {pages.summary.pageViews !== null ? (
          <Metric label="Page views" value={String(pages.summary.pageViews)} detail="Consent-based page views." />
        ) : null}
        {visitors.summary.returningVisitors !== null ? (
          <Metric
            label="Returning visitors"
            value={String(visitors.summary.returningVisitors)}
            detail="Visitors whose first consented day is before this period."
          />
        ) : null}
        {top ? <Metric label="Most viewed page" value={String(top.count)} detail={top.path} /> : null}
      </div>
      {pages.items.length > 0 ? (
        <ActivityTable
          title="Page views"
          columns={["Page", "London time", "Source", "Referrer", "Device", "Browser"]}
          rows={pages.items.map((item) => [
            item.pagePath,
            londonTime.format(new Date(item.occurredAt)),
            SOURCE_LABEL[item.source],
            item.referrerHost,
            item.deviceCategory,
            item.browserCategory,
          ])}
          nextOffset={pages.nextOffset}
          onNext={onNextViews}
        />
      ) : null}
      {visitors.items.length > 0 ? (
        <ActivityTable
          title="Visitor days"
          columns={["Day", "First seen", "Last seen", "Source", "Landing page"]}
          rows={visitors.items.map((item) => [
            item.day,
            londonTime.format(new Date(item.firstSeenAt)),
            londonTime.format(new Date(item.lastSeenAt)),
            SOURCE_LABEL[item.source],
            item.landingPath,
          ])}
          nextOffset={visitors.nextOffset}
          onNext={onNextVisitors}
        />
      ) : null}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-surface p-4">
      <h2 className="text-sm font-semibold text-navy-900">{label}</h2>
      <p className="mt-2 text-sm font-semibold text-slate-700">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </article>
  );
}

function ActivityTable({
  title,
  columns,
  rows,
  nextOffset,
  onNext,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  nextOffset: number | null;
  onNext: () => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map((column) => (
                <th key={column} className="py-2 pr-4 font-semibold text-navy-900">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`} className="border-b border-slate-100">
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${index}-${cellIndex}`} className="py-2 pr-4">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextOffset !== null ? (
        <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={onNext}>
          Next {title.toLowerCase()}
        </button>
      ) : null}
    </section>
  );
}

function inclusiveLondonRange(days: number, clock: Date): { start: string; end: string } {
  const end = londonDate(clock);
  return { start: addLondonDays(end, -(days - 1)), end };
}

function combine(left: string, right: string): Exclude<BoardStatus, "loading"> | "unauthorized" {
  if (left === "unauthorized" || right === "unauthorized") return "unauthorized";
  if (left === "forbidden" || right === "forbidden") return "forbidden";
  if (left === "unconfigured" || right === "unconfigured") return "unconfigured";
  if (left === "invalid_query" || right === "invalid_query" || left === "invalid_range" || right === "invalid_range") {
    return "invalid";
  }
  if (left === "ok" && right === "ok") return "ready";
  return "error";
}
