"use client";

import { useEffect, useState } from "react";
import { currentAccessToken } from "@/lib/admin/auth";
import {
  fetchAggregateSummary,
  type AggregateRangeReason,
  type AggregateReport,
} from "@/lib/admin/api";
import { addLondonDays, londonDate, reportingWindow, validateReportRange } from "@/lib/analytics/dates";
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

const PERIOD_OPTIONS = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "15", label: "Last 15 days", days: 15 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "custom", label: "Custom date range", days: null },
] as const;

type PeriodChoice = (typeof PERIOD_OPTIONS)[number]["id"];
type PageSize = 10 | 20 | 30;

const PAGE_SIZES: readonly PageSize[] = [10, 20, 30];

type BoardState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "forbidden" }
  | { status: "unconfigured" }
  | { status: "ready"; report: AggregateReport };

type TableRow = Array<string | number>;

export function AggregateBoard({
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
  const [rangeError, setRangeError] = useState<AggregateRangeReason | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [reload, setReload] = useState(0);
  const [fetched, setFetched] = useState<{ key: string; state: Exclude<BoardState, { status: "loading" }> } | null>(
    null,
  );
  const requestKey = `${applied.start}\u0000${applied.end}\u0000${reload}`;
  const state: BoardState = fetched?.key === requestKey ? fetched.state : { status: "loading" };
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

  function selectChoice(next: PeriodChoice) {
    setChoice(next);
    if (next === "custom") return;
    const option = PERIOD_OPTIONS.find((item) => item.id === next);
    if (!option?.days) return;
    const range = inclusiveLondonRange(option.days, clock);
    const valid = validateReportRange(range.start, range.end, clock);
    if (!valid.ok) {
      setRangeError(valid.reason);
      return;
    }
    setRangeError(null);
    setDraftStart(valid.start);
    setDraftEnd(valid.end);
    setApplied({ start: valid.start, end: valid.end });
  }

  function changeCustomDate(field: "start" | "end", value: string) {
    const start = field === "start" ? value : draftStart;
    const end = field === "end" ? value : draftEnd;
    if (field === "start") setDraftStart(value);
    else setDraftEnd(value);
    const range = validateReportRange(start, end, clock);
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
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-navy-900">Reporting period</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {PERIOD_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                choice === option.id ? "border-navy-900 font-semibold text-navy-900" : "border-slate-200 text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="reporting-period"
                value={option.id}
                checked={choice === option.id}
                onChange={() => selectChoice(option.id)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      {choice === "custom" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <DateField
            label="Start date, London"
            value={draftStart}
            min={allowed.start}
            max={allowed.end}
            onChange={(value) => changeCustomDate("start", value)}
          />
          <DateField
            label="End date, London"
            value={draftEnd}
            min={allowed.start}
            max={allowed.end}
            onChange={(value) => changeCustomDate("end", value)}
          />
        </div>
      ) : null}
      <p className="text-sm leading-6 text-slate-600">
        Selected period: {choiceLabel}, {applied.start} to {applied.end}, Europe/London. Both dates are inclusive.
      </p>
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
      {state.status === "ready" ? (
        <ReportView report={state.report} pageSize={pageSize} onPageSize={setPageSize} />
      ) : null}
      {state.status === "error" ? (
        <button type="button" className="text-sm font-semibold text-accent" onClick={() => setReload((value) => value + 1)}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

function inclusiveLondonRange(days: number, clock: Date): { start: string; end: string } {
  const end = londonDate(clock);
  return { start: addLondonDays(end, -(days - 1)), end };
}

function reportHasStoredCounts(report: AggregateReport): boolean {
  if (report.pageViews > 0 || report.visits > 0 || report.pathsOther > 0) return true;
  if (report.countriesOther.pageViews > 0 || report.countriesOther.visits > 0) return true;
  if (report.daily.some((day) => day.pageViews > 0 || day.visits > 0)) return true;
  if (report.countries.some((country) => country.pageViews > 0 || country.visits > 0)) return true;
  if (report.paths.some((path) => path.count > 0)) return true;
  return [report.sources, report.devices, report.browsers].some((group) =>
    Object.values(group).some((count) => count > 0),
  );
}

function ReportView({
  report,
  pageSize,
  onPageSize,
}: {
  report: AggregateReport;
  pageSize: PageSize;
  onPageSize: (size: PageSize) => void;
}) {
  const stored = reportHasStoredCounts(report);
  const countryRows = positiveRows([
    ...report.countries
      .filter((country) => country.pageViews > 0 || country.visits > 0)
      .map((country) => [country.country, country.pageViews, country.visits]),
    ...(report.countriesOther.pageViews > 0 || report.countriesOther.visits > 0
      ? [["Other countries", report.countriesOther.pageViews, report.countriesOther.visits]]
      : []),
  ]);
  const pathRows = positiveRows([
    ...report.paths.filter((path) => path.count > 0).map((path) => [path.name, path.count]),
    ...(report.pathsOther > 0 ? [["Other pages", report.pathsOther]] : []),
  ]);
  const sourceRows = positiveRows(SOURCE_VALUES.map((source) => [SOURCE_LABEL[source], report.sources[source]]));
  const deviceRows = positiveRows(DEVICE_VALUES.map((device) => [DEVICE_LABEL[device], report.devices[device]]));
  const browserRows = positiveRows(BROWSER_VALUES.map((browser) => [BROWSER_LABEL[browser], report.browsers[browser]]));
  const dailyRows = stored ? report.daily.map((day) => [day.date, day.pageViews, day.visits, day.partial ? "Partial" : "Complete"]) : [];
  const tableCount = [dailyRows, countryRows, pathRows, sourceRows, deviceRows, browserRows].filter((rows) => rows.length > 0).length;

  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-slate-600">
        London period {report.period.start} to {report.period.end}.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Metric label="Page views" value={report.pageViews} detail="Aggregate page-view counter." />
        <Metric label="Landing visits" value={report.visits} detail="Aggregate landing-visit counter." />
      </div>
      {stored ? null : (
        <p className="rounded-lg border border-dashed border-slate-200 bg-surface px-4 py-5 text-sm leading-6 text-slate-600">
          No analytics data available for this period.
        </p>
      )}
      {stored && report.partialDates.length > 0 ? (
        <p className="text-sm leading-6 text-slate-600">
          Some dates are partial because a counter had reached its retention time: {report.partialDates.join(", ")}.
        </p>
      ) : null}
      {tableCount > 0 ? (
        <label className="block text-sm font-semibold text-navy-900">
          Rows per page
          <select
            className="mt-1 block w-full rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm sm:w-auto"
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value) as PageSize)}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <DataTable
        title="Daily traffic"
        columns={["London date", "Page views", "Landing visits", "Retention"]}
        rows={dailyRows}
        pageSize={pageSize}
        resetKey={`${report.period.start}:${report.period.end}:${pageSize}`}
      />
      <DataTable
        title="Countries"
        columns={["Country", "Page views", "Landing visits"]}
        rows={countryRows}
        pageSize={pageSize}
        resetKey={`${report.period.start}:${report.period.end}:${pageSize}`}
      />
      <DataTable
        title="Most visited pages"
        columns={["Page", "Page views"]}
        rows={pathRows}
        pageSize={pageSize}
        resetKey={`${report.period.start}:${report.period.end}:${pageSize}`}
      />
      <DataTable
        title="Traffic sources"
        columns={["Category", "Page views"]}
        rows={sourceRows}
        pageSize={pageSize}
        resetKey={`${report.period.start}:${report.period.end}:${pageSize}`}
      />
      <DataTable
        title="Device categories"
        columns={["Category", "Page views"]}
        rows={deviceRows}
        pageSize={pageSize}
        resetKey={`${report.period.start}:${report.period.end}:${pageSize}`}
      />
      <DataTable
        title="Browser categories"
        columns={["Category", "Page views"]}
        rows={browserRows}
        pageSize={pageSize}
        resetKey={`${report.period.start}:${report.period.end}:${pageSize}`}
      />
    </div>
  );
}

function positiveRows(rows: TableRow[]): TableRow[] {
  return rows.filter((row) => row.slice(1).some((cell) => typeof cell === "number" && cell > 0));
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

function DataTable({
  title,
  columns,
  rows,
  pageSize,
  resetKey,
}: {
  title: string;
  columns: string[];
  rows: TableRow[];
  pageSize: PageSize;
  resetKey: string;
}) {
  if (rows.length === 0) return null;
  return <PagedTable key={resetKey} title={title} columns={columns} rows={rows} pageSize={pageSize} />;
}

function PagedTable({
  title,
  columns,
  rows,
  pageSize,
}: {
  title: string;
  columns: string[];
  rows: TableRow[];
  pageSize: PageSize;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(rows.length / pageSize);
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);

  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl text-navy-900">{title}</h2>
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
            {visible.map((row) => (
              <tr key={String(row[0])} className="border-b border-slate-100">
                {row.map((cell, index) => (
                  <td key={`${row[0]}-${index}`} className="py-2 pr-4">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-navy-900 disabled:opacity-50"
          aria-label={`${title} previous page`}
          disabled={currentPage <= 1}
          onClick={() => setPage(currentPage - 1)}
        >
          Previous
        </button>
        <p className="text-sm leading-6 text-slate-600">
          {title} page {currentPage} of {totalPages}
        </p>
        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-navy-900 disabled:opacity-50"
          aria-label={`${title} next page`}
          disabled={currentPage >= totalPages}
          onClick={() => setPage(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </section>
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
