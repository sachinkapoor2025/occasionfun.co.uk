"use client";

import { useEffect, useState, type FormEvent } from "react";
import { currentAccessToken } from "@/lib/admin/auth";
import {
  fetchAggregateSummary,
  type AggregateRangeReason,
  type AggregateReport,
} from "@/lib/admin/api";
import { reportingWindow, validateReportRange } from "@/lib/analytics/dates";
import { BROWSER_VALUES, DEVICE_VALUES, SOURCE_VALUES } from "@/lib/analytics/event-core";

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

const DEVICE_LABEL = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  other: "Other",
} as const;

const BROWSER_LABEL = {
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  edge: "Edge",
  other: "Other",
} as const;

type BoardState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "forbidden" }
  | { status: "unconfigured" }
  | { status: "ready"; report: AggregateReport };

export function AggregateBoard({
  onUnauthorised,
  now = () => new Date(),
}: {
  onUnauthorised: () => void;
  now?: () => Date;
}) {
  const [clock] = useState(() => now());
  const allowed = reportingWindow(clock);
  const [draftStart, setDraftStart] = useState(allowed.start);
  const [draftEnd, setDraftEnd] = useState(allowed.end);
  const [applied, setApplied] = useState({ start: allowed.start, end: allowed.end });
  const [rangeError, setRangeError] = useState<AggregateRangeReason | null>(null);
  const [reload, setReload] = useState(0);
  const [fetched, setFetched] = useState<{ key: string; state: Exclude<BoardState, { status: "loading" }> } | null>(
    null,
  );
  const requestKey = `${applied.start}\u0000${applied.end}\u0000${reload}`;
  const state: BoardState = fetched?.key === requestKey ? fetched.state : { status: "loading" };

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
      const result = await fetchAggregateSummary(access.token, applied);
      if (cancelled) return;
      if (result.status === "unauthorized") {
        onUnauthorised();
        return;
      }
      if (result.status === "forbidden") {
        setFetched({ key, state: { status: "forbidden" } });
        return;
      }
      if (result.status === "unconfigured") {
        setFetched({ key, state: { status: "unconfigured" } });
        return;
      }
      if (result.status === "invalid_range") {
        setRangeError(result.reason);
        setFetched({ key, state: { status: "error" } });
        return;
      }
      if (result.status !== "ok") {
        setFetched({ key, state: { status: "error" } });
        return;
      }
      setFetched({ key, state: { status: "ready", report: result.report } });
    })();
    return () => {
      cancelled = true;
    };
  }, [applied, onUnauthorised, requestKey]);

  function applyRange(event: FormEvent) {
    event.preventDefault();
    const range = validateReportRange(draftStart, draftEnd, clock);
    if (!range.ok) {
      setRangeError(range.reason);
      return;
    }
    setRangeError(null);
    setApplied({ start: range.start, end: range.end });
  }

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm leading-6 text-slate-600">
        These figures are aggregate counters for page views and landing visits. They are not individual visitors, and they are separate from enquiry records.
      </p>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={applyRange}>
        <DateField label="Start date, London" value={draftStart} min={allowed.start} max={allowed.end} onChange={setDraftStart} />
        <DateField label="End date, London" value={draftEnd} min={allowed.start} max={allowed.end} onChange={setDraftEnd} />
        <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
          Show period
        </button>
      </form>
      <p className="text-sm leading-6 text-slate-600">
        The longest period is the latest 90 London dates, {allowed.start} to {allowed.end}.
      </p>
      {rangeError ? <p className="text-sm font-semibold text-navy-900">{RANGE_MESSAGE[rangeError]}</p> : null}
      {state.status === "loading" ? <p className="text-sm text-slate-600">Loading aggregate counts…</p> : null}
      {state.status === "error" ? (
        <p className="text-sm leading-6 text-slate-600">The aggregate report could not be loaded.</p>
      ) : null}
      {state.status === "forbidden" ? (
        <p className="text-sm leading-6 text-slate-600">This account cannot read aggregate reports.</p>
      ) : null}
      {state.status === "unconfigured" ? (
        <p className="text-sm leading-6 text-slate-600">
          The administration API is not configured, so no aggregate report was requested.
        </p>
      ) : null}
      {state.status === "ready" ? <ReportView report={state.report} /> : null}
      {state.status === "error" ? (
        <button type="button" className="text-sm font-semibold text-accent" onClick={() => setReload((value) => value + 1)}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-navy-900">
      {label}
      <input
        type="date"
        className="mt-1 block w-full rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ReportView({ report }: { report: AggregateReport }) {
  const empty = report.pageViews === 0 && report.visits === 0;
  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-slate-600">
        London period {report.period.start} to {report.period.end}.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Metric label="Page views" value={report.pageViews} detail="Aggregate page-view counter." />
        <Metric label="Landing visits" value={report.visits} detail="Aggregate landing-visit counter." />
      </div>
      {empty ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-surface px-4 py-5 text-sm leading-6 text-slate-600">
          No aggregate counts were stored for this London date range.
        </p>
      ) : null}
      {report.partialDates.length > 0 ? (
        <p className="text-sm leading-6 text-slate-600">
          Some dates are partial because a counter had reached its retention time: {report.partialDates.join(", ")}.
        </p>
      ) : null}
      <section className="space-y-3">
        <h2 className="font-display text-2xl text-navy-900">Daily traffic</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-navy-900">
                <th className="py-2 pr-4 font-semibold">London date</th>
                <th className="py-2 pr-4 font-semibold">Page views</th>
                <th className="py-2 pr-4 font-semibold">Landing visits</th>
                <th className="py-2 font-semibold">Retention</th>
              </tr>
            </thead>
            <tbody>
              {report.daily.map((day) => (
                <tr key={day.date} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{day.date}</td>
                  <td className="py-2 pr-4">{day.pageViews}</td>
                  <td className="py-2 pr-4">{day.visits}</td>
                  <td className="py-2">{day.partial ? "Partial" : "Complete"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <CountTable
        title="Countries"
        columns={["Country", "Page views", "Landing visits"]}
        rows={report.countries.map((country) => [country.country, country.pageViews, country.visits])}
        other={
          report.countriesOther.pageViews > 0 || report.countriesOther.visits > 0
            ? ["Other countries", report.countriesOther.pageViews, report.countriesOther.visits]
            : null
        }
        empty="No country counts in this period."
      />
      <CountTable
        title="Most visited pages"
        columns={["Page", "Page views"]}
        rows={report.paths.map((path) => [path.name, path.count])}
        other={report.pathsOther > 0 ? ["Other pages", report.pathsOther] : null}
        empty="No page counts in this period."
      />
      <CategoryTable
        title="Traffic sources"
        rows={SOURCE_VALUES.map((source) => [SOURCE_LABEL[source], report.sources[source]])}
      />
      <CategoryTable
        title="Device categories"
        rows={DEVICE_VALUES.map((device) => [DEVICE_LABEL[device], report.devices[device]])}
      />
      <CategoryTable
        title="Browser categories"
        rows={BROWSER_VALUES.map((browser) => [BROWSER_LABEL[browser], report.browsers[browser]])}
      />
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-surface p-4">
      <h2 className="text-sm font-semibold text-navy-900">{label}</h2>
      <p className="mt-2 text-sm font-semibold text-slate-700">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </article>
  );
}

function CountTable({
  title,
  columns,
  rows,
  other,
  empty,
}: {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  other: Array<string | number> | null;
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl text-navy-900">{title}</h2>
      {rows.length === 0 && !other ? <p className="text-sm leading-6 text-slate-600">{empty}</p> : null}
      {rows.length > 0 || other ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-navy-900">
                {columns.map((column) => (
                  <th key={column} className="py-2 pr-4 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row[0])} className="border-b border-slate-100">
                  {row.map((cell, index) => (
                    <td key={`${row[0]}-${index}`} className="py-2 pr-4">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {other ? (
                <tr className="border-b border-slate-100">
                  {other.map((cell, index) => (
                    <td key={`other-${index}`} className="py-2 pr-4">
                      {cell}
                    </td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function CategoryTable({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const total = rows.reduce((sum, row) => sum + row[1], 0);
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl text-navy-900">{title}</h2>
      <p className="text-sm leading-6 text-slate-600">Total page views in this breakdown: {total}.</p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-navy-900">
              <th className="py-2 pr-4 font-semibold">Category</th>
              <th className="py-2 pr-4 font-semibold">Page views</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, count]) => (
              <tr key={name} className="border-b border-slate-100">
                <td className="py-2 pr-4">{name}</td>
                <td className="py-2 pr-4">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
