/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AggregateBoard } from "../src/components/admin/panel/AggregateBoard";
import { reportingWindow } from "../src/lib/analytics/dates";
import type { AggregateDaily, AggregateReport } from "../src/lib/admin/api";

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
    period: { start: "2026-11-18", end: "2026-11-24", timeZone: "Europe/London" },
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

function dailySeries(count: number): AggregateDaily[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `2026-10-${String(index + 1).padStart(2, "0")}`,
    pageViews: index + 1,
    visits: 1,
    partial: false,
  }));
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
    expect(screen.queryByText("No analytics data available for this period.")).toBeNull();
  });

  it("requests the last 7 London dates by default", async () => {
    fetchAggregateSummary.mockResolvedValue({ status: "ok", report: emptyReport() });
    renderBoard();
    expect(screen.getByRole("radio", { name: "Last 7 days" })).toBeChecked();
    expect(await screen.findByText("No analytics data available for this period.")).toBeVisible();
    expect(fetchAggregateSummary).toHaveBeenCalledTimes(1);
    expect(fetchAggregateSummary).toHaveBeenCalledWith("access-token", {
      start: "2026-11-18",
      end: "2026-11-24",
    });
    expect(screen.getByText("Selected period: Last 7 days, 2026-11-18 to 2026-11-24, Europe/London. Both dates are inclusive.")).toBeVisible();
  });

  it("requests the last 15 and last 30 London dates when those periods are selected", async () => {
    fetchAggregateSummary.mockResolvedValue({ status: "ok", report: emptyReport() });
    renderBoard();
    expect(await screen.findByText("No analytics data available for this period.")).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: "Last 15 days" }));
    await waitFor(() =>
      expect(fetchAggregateSummary).toHaveBeenLastCalledWith("access-token", {
        start: "2026-11-10",
        end: "2026-11-24",
      }),
    );
    expect(screen.getByText(/Selected period: Last 15 days, 2026-11-10 to 2026-11-24/)).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: "Last 30 days" }));
    await waitFor(() =>
      expect(fetchAggregateSummary).toHaveBeenLastCalledWith("access-token", {
        start: "2026-10-26",
        end: "2026-11-24",
      }),
    );
    expect(screen.getByText(/Selected period: Last 30 days, 2026-10-26 to 2026-11-24/)).toBeVisible();
  });

  it("requests a custom inclusive range and rejects an inverted range", async () => {
    fetchAggregateSummary.mockResolvedValue({ status: "ok", report: emptyReport() });
    renderBoard();
    expect(await screen.findByText("No analytics data available for this period.")).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: "Custom date range" }));
    fireEvent.change(screen.getByLabelText("Start date, London"), { target: { value: "2026-11-01" } });
    await waitFor(() =>
      expect(fetchAggregateSummary).toHaveBeenLastCalledWith("access-token", {
        start: "2026-11-01",
        end: "2026-11-24",
      }),
    );
    fireEvent.change(screen.getByLabelText("End date, London"), { target: { value: "2026-11-20" } });
    await waitFor(() =>
      expect(fetchAggregateSummary).toHaveBeenLastCalledWith("access-token", {
        start: "2026-11-01",
        end: "2026-11-20",
      }),
    );

    const calls = fetchAggregateSummary.mock.calls.length;
    fireEvent.change(screen.getByLabelText("End date, London"), { target: { value: "2026-10-31" } });
    expect(screen.getByText("The end date is before the start date.")).toBeVisible();
    expect(fetchAggregateSummary).toHaveBeenCalledTimes(calls);
  });

  it("keeps the latest 90 London dates as the maximum range", async () => {
    const window = reportingWindow(NOW);
    expect(window.dates).toHaveLength(90);
    expect(window).toMatchObject({ start: "2026-08-27", end: "2026-11-24" });
    fetchAggregateSummary.mockResolvedValue({ status: "ok", report: emptyReport() });
    renderBoard();
    expect(await screen.findByText("No analytics data available for this period.")).toBeVisible();
    expect(screen.getByText("The longest period is the latest 90 London dates, 2026-08-27 to 2026-11-24.")).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: "Custom date range" }));
    fireEvent.change(screen.getByLabelText("Start date, London"), { target: { value: "2026-08-27" } });
    await waitFor(() =>
      expect(fetchAggregateSummary).toHaveBeenLastCalledWith("access-token", {
        start: "2026-08-27",
        end: "2026-11-24",
      }),
    );

    const calls = fetchAggregateSummary.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Start date, London"), { target: { value: "2026-08-26" } });
    expect(screen.getByText("Dates must fall inside the latest 90 London dates.")).toBeVisible();
    expect(fetchAggregateSummary).toHaveBeenCalledTimes(calls);
  });

  it("renders stored totals and only the categories that have counts", async () => {
    fetchAggregateSummary.mockResolvedValue({
      status: "ok",
      report: emptyReport({
        pageViews: 4,
        visits: 1,
        daily: [{ date: "2026-11-24", pageViews: 4, visits: 1, partial: false }],
        countries: [{ country: "GB", pageViews: 4, visits: 1 }],
        paths: [{ name: "/contact", count: 4 }],
        sources: { direct: 0, internal: 0, search: 4, social: 0, referral: 0, campaign: 0 },
        devices: { desktop: 0, mobile: 4, tablet: 0, other: 0 },
        browsers: { chrome: 0, safari: 4, firefox: 0, edge: 0, other: 0 },
      }),
    });
    renderBoard();
    const views = (await screen.findByRole("heading", { name: "Page views" })).closest("article");
    const visits = screen.getByRole("heading", { name: "Landing visits" }).closest("article");
    expect(views).toHaveTextContent("4");
    expect(visits).toHaveTextContent("1");
    expect(screen.getByText("GB")).toBeVisible();
    expect(screen.getByText("/contact")).toBeVisible();
    expect(screen.getByText("Search")).toBeVisible();
    expect(screen.getByText("Mobile")).toBeVisible();
    expect(screen.getByText("Safari")).toBeVisible();
    expect(screen.queryByText("Direct")).toBeNull();
    expect(screen.queryByText("Desktop")).toBeNull();
    expect(screen.queryByText("Chrome")).toBeNull();
    expect(screen.queryByText("No analytics data available for this period.")).toBeNull();
  });

  it("shows an empty period without zero-filled tables", async () => {
    fetchAggregateSummary.mockResolvedValue({ status: "ok", report: emptyReport() });
    renderBoard();
    expect(await screen.findByText("No analytics data available for this period.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Page views" }).closest("article")).toHaveTextContent("0");
    expect(screen.queryByRole("heading", { name: "Daily traffic" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Countries" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Most visited pages" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Traffic sources" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Device categories" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Browser categories" })).toBeNull();
    expect(screen.queryByText("Direct")).toBeNull();
    expect(screen.queryByText("Chrome")).toBeNull();
    expect(screen.queryByText("GB")).toBeNull();
  });

  it("keeps a stored country visible when the totals are otherwise small", async () => {
    fetchAggregateSummary.mockResolvedValue({
      status: "ok",
      report: emptyReport({
        visits: 1,
        countries: [{ country: "GB", pageViews: 0, visits: 1 }],
      }),
    });
    renderBoard();
    expect(await screen.findByText("GB")).toBeVisible();
    expect(screen.queryByText("No analytics data available for this period.")).toBeNull();
  });

  it("shows a failure when the report cannot be loaded", async () => {
    fetchAggregateSummary.mockResolvedValue({ status: "unavailable" });
    renderBoard();
    expect(await screen.findByText("The aggregate report could not be loaded.")).toBeVisible();
    expect(screen.queryByText("No analytics data available for this period.")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Page views" })).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("signs out on HTTP 401 and keeps a forbidden account on the page", async () => {
    fetchAggregateSummary.mockResolvedValueOnce({ status: "unauthorized" });
    const first = renderBoard();
    await waitFor(() => expect(onUnauthorised).toHaveBeenCalledOnce());
    first.unmount();

    fetchAggregateSummary.mockResolvedValueOnce({ status: "forbidden" });
    renderBoard();
    expect(await screen.findByText("This account cannot read aggregate reports.")).toBeVisible();
    expect(screen.queryByText("No analytics data available for this period.")).toBeNull();
    expect(onUnauthorised).toHaveBeenCalledOnce();
  });

  it("pages daily rows at 10, 20 and 30 without skipping or repeating them", async () => {
    const daily = dailySeries(25);
    fetchAggregateSummary.mockResolvedValue({
      status: "ok",
      report: emptyReport({ pageViews: 25, visits: 25, daily }),
    });
    renderBoard();
    const table = () => screen.getByRole("heading", { name: "Daily traffic" }).closest("section") as HTMLElement;
    expect(await screen.findByText("Daily traffic page 1 of 3")).toBeVisible();
    expect(within(table()).getByText("2026-10-01")).toBeVisible();
    expect(within(table()).getByText("2026-10-10")).toBeVisible();
    expect(within(table()).queryByText("2026-10-11")).toBeNull();
    expect(screen.getByRole("button", { name: "Daily traffic previous page" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Daily traffic next page" }));
    expect(screen.getByText("Daily traffic page 2 of 3")).toBeVisible();
    expect(within(table()).getByText("2026-10-11")).toBeVisible();
    expect(within(table()).getByText("2026-10-20")).toBeVisible();
    expect(within(table()).queryByText("2026-10-01")).toBeNull();
    expect(within(table()).queryByText("2026-10-21")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Daily traffic next page" }));
    expect(screen.getByText("Daily traffic page 3 of 3")).toBeVisible();
    expect(within(table()).getByText("2026-10-21")).toBeVisible();
    expect(within(table()).getByText("2026-10-25")).toBeVisible();
    expect(within(table()).queryByText("2026-10-20")).toBeNull();
    expect(screen.getByRole("button", { name: "Daily traffic next page" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Daily traffic previous page" }));
    expect(within(table()).getByText("2026-10-11")).toBeVisible();
    expect(within(table()).queryByText("2026-10-21")).toBeNull();

    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "20" } });
    expect(screen.getByText("Daily traffic page 1 of 2")).toBeVisible();
    expect(within(table()).getByText("2026-10-01")).toBeVisible();
    expect(within(table()).getByText("2026-10-20")).toBeVisible();
    expect(within(table()).queryByText("2026-10-21")).toBeNull();

    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "30" } });
    expect(screen.getByText("Daily traffic page 1 of 1")).toBeVisible();
    expect(within(table()).getByText("2026-10-01")).toBeVisible();
    expect(within(table()).getByText("2026-10-25")).toBeVisible();
    expect(screen.getByRole("button", { name: "Daily traffic next page" })).toBeDisabled();
  });

  it("returns to the first page when the reporting period changes", async () => {
    const daily = dailySeries(25);
    fetchAggregateSummary.mockResolvedValue({
      status: "ok",
      report: emptyReport({ pageViews: 25, visits: 25, daily }),
    });
    renderBoard();
    expect(await screen.findByText("Daily traffic page 1 of 3")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Daily traffic next page" }));
    expect(screen.getByText("Daily traffic page 2 of 3")).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: "Last 15 days" }));
    expect(await screen.findByText("Daily traffic page 1 of 3")).toBeVisible();
    const table = screen.getByRole("heading", { name: "Daily traffic" }).closest("section") as HTMLElement;
    expect(within(table).getByText("2026-10-01")).toBeVisible();
    expect(within(table).queryByText("2026-10-11")).toBeNull();
  });
});
