/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AggregateBoard } from "../src/components/admin/panel/AggregateBoard";
import { reportingWindow } from "../src/lib/analytics/dates";
import type { AggregateReport } from "../src/lib/admin/api";

const fetchAggregateSummary = vi.hoisted(() => vi.fn());
const onUnauthorised = vi.hoisted(() => vi.fn());
const NOW = new Date("2026-11-24T12:00:00.000Z");

vi.mock("../src/lib/admin/auth", () => ({
  currentAccessToken: async () => ({ status: "token" as const, token: "access-token" }),
}));

vi.mock("../src/lib/admin/api", () => ({
  fetchAggregateSummary,
}));

function emptyReport(overrides: Partial<AggregateReport> = {}): AggregateReport {
  return {
    period: { start: "2026-08-27", end: "2026-11-24", timeZone: "Europe/London" },
    pageViews: 0,
    visits: 0,
    daily: [{ date: "2026-11-24", pageViews: 0, visits: 0, partial: false }],
    countries: [],
    countriesOther: { pageViews: 0, visits: 0 },
    paths: [],
    pathsOther: 0,
    sources: { direct: 0, internal: 0, search: 0, social: 0, referral: 0, campaign: 0 },
    devices: { desktop: 0, mobile: 0, tablet: 0, other: 0 },
    browsers: { chrome: 0, safari: 0, firefox: 0, edge: 0, other: 0 },
    partialDates: [],
    ...overrides,
  };
}

function renderBoard() {
  return render(<AggregateBoard onUnauthorised={onUnauthorised} now={() => NOW} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("aggregate analytics board", () => {
  it("shows loading before the report arrives", () => {
    fetchAggregateSummary.mockReturnValue(new Promise(() => undefined));
    renderBoard();
    expect(screen.getByText("Loading aggregate counts…")).toBeVisible();
    expect(screen.queryByText("No aggregate counts were stored for this London date range.")).toBeNull();
  });

  it("renders page-view and landing-visit totals", async () => {
    fetchAggregateSummary.mockResolvedValue({
      status: "ok",
      report: emptyReport({ pageViews: 12, visits: 3, daily: [{ date: "2026-11-24", pageViews: 12, visits: 3, partial: false }] }),
    });
    renderBoard();
    const views = (await screen.findByRole("heading", { name: "Page views" })).closest("article");
    const visits = screen.getByRole("heading", { name: "Landing visits" }).closest("article");
    expect(views).toHaveTextContent("12");
    expect(visits).toHaveTextContent("3");
    expect(screen.getByText("These figures are aggregate counters for page views and landing visits. They are not individual visitors, and they are separate from enquiry records.")).toBeVisible();
  });

  it("renders country, page, source, device, and browser breakdowns", async () => {
    fetchAggregateSummary.mockResolvedValue({
      status: "ok",
      report: emptyReport({
        pageViews: 4,
        visits: 1,
        countries: [{ country: "GB", pageViews: 4, visits: 1 }],
        paths: [{ name: "/contact", count: 4 }],
        sources: { direct: 0, internal: 0, search: 4, social: 0, referral: 0, campaign: 0 },
        devices: { desktop: 0, mobile: 4, tablet: 0, other: 0 },
        browsers: { chrome: 0, safari: 4, firefox: 0, edge: 0, other: 0 },
      }),
    });
    renderBoard();
    expect(await screen.findByRole("heading", { name: "Countries" })).toBeVisible();
    expect(screen.getByText("GB")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Most visited pages" })).toBeVisible();
    expect(screen.getByText("/contact")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Traffic sources" })).toBeVisible();
    expect(screen.getByText("Search")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Device categories" })).toBeVisible();
    expect(screen.getByText("Mobile")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Browser categories" })).toBeVisible();
    expect(screen.getByText("Safari")).toBeVisible();
  });

  it("shows an empty period without invented counts", async () => {
    fetchAggregateSummary.mockResolvedValue({ status: "ok", report: emptyReport() });
    renderBoard();
    expect(await screen.findByText("No aggregate counts were stored for this London date range.")).toBeVisible();
    expect(screen.getByText("No country counts in this period.")).toBeVisible();
    expect(screen.getByText("No page counts in this period.")).toBeVisible();
    expect(screen.queryByText("GB")).toBeNull();
  });

  it("shows a failure when the report cannot be loaded", async () => {
    fetchAggregateSummary.mockResolvedValue({ status: "unavailable" });
    renderBoard();
    expect(await screen.findByText("The aggregate report could not be loaded.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Page views" })).toBeNull();
  });

  it("signs out on HTTP 401 and keeps a forbidden account on the page", async () => {
    fetchAggregateSummary.mockResolvedValueOnce({ status: "unauthorized" });
    const first = renderBoard();
    await waitFor(() => expect(onUnauthorised).toHaveBeenCalledOnce());
    first.unmount();

    fetchAggregateSummary.mockResolvedValueOnce({ status: "forbidden" });
    renderBoard();
    expect(await screen.findByText("This account cannot read aggregate reports.")).toBeVisible();
    expect(onUnauthorised).toHaveBeenCalledOnce();
  });

  it("requests the latest 90 London dates and rejects a date outside that window", async () => {
    const window = reportingWindow(NOW);
    expect(window.dates).toHaveLength(90);
    fetchAggregateSummary.mockResolvedValue({ status: "ok", report: emptyReport() });
    renderBoard();
    expect(await screen.findByText("No aggregate counts were stored for this London date range.")).toBeVisible();
    expect(fetchAggregateSummary).toHaveBeenCalledTimes(1);
    expect(fetchAggregateSummary).toHaveBeenCalledWith("access-token", {
      start: "2026-08-27",
      end: "2026-11-24",
    });

    fireEvent.change(screen.getByLabelText("Start date, London"), { target: { value: "2026-08-26" } });
    fireEvent.submit(screen.getByRole("button", { name: "Show period" }).closest("form") as HTMLFormElement);
    expect(screen.getByText("Dates must fall inside the latest 90 London dates.")).toBeVisible();
    expect(fetchAggregateSummary).toHaveBeenCalledTimes(1);
  });

  it("rejects an end date before the start date before calling the API again", async () => {
    fetchAggregateSummary.mockResolvedValue({ status: "ok", report: emptyReport() });
    renderBoard();
    expect(await screen.findByText("No aggregate counts were stored for this London date range.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("End date, London"), { target: { value: "2026-08-27" } });
    fireEvent.change(screen.getByLabelText("Start date, London"), { target: { value: "2026-11-24" } });
    fireEvent.submit(screen.getByRole("button", { name: "Show period" }).closest("form") as HTMLFormElement);
    expect(screen.getByText("The end date is before the start date.")).toBeVisible();
    expect(fetchAggregateSummary).toHaveBeenCalledTimes(1);
  });
});
