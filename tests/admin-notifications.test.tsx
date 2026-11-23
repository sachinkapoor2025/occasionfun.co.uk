/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationBoard } from "../src/components/admin/panel/NotificationBoard";

const fetchEnquirySummary = vi.hoisted(() => vi.fn());
const fetchEnquiries = vi.hoisted(() => vi.fn());
const fetchEnquiry = vi.hoisted(() => vi.fn());
const onUnauthorised = vi.hoisted(() => vi.fn());

vi.mock("../src/lib/admin/auth", () => ({
  currentAccessToken: async () => ({ status: "token" as const, token: "access-token" }),
}));

vi.mock("../src/lib/admin/api", () => ({
  notificationStatuses: ["pending", "sending", "sent", "failed"],
  fetchEnquirySummary,
  fetchEnquiries,
  fetchEnquiry,
}));

const summary = {
  status: "ok" as const,
  total: 8,
  byNotificationStatus: { pending: 2, sending: 1, sent: 4, failed: 1 },
};

const first = {
  id: "a".repeat(64),
  submittedAt: "2026-11-23T09:00:00.000Z",
  name: "Ada Lovelace",
  organisation: "Analytical Engines",
  email: "ada@example.com",
  phone: null,
  enquiryType: "Wedding",
  message: "Preview",
  messageTruncated: true,
  notificationStatus: "pending" as const,
  reviewStatus: "new" as const,
  notificationAttempts: 2,
  lastNotificationError: "RetryLimitReached",
  notifiedAt: "2026-11-23T09:05:00.000Z",
};

const second = {
  ...first,
  id: "b".repeat(64),
  name: "Grace Hopper",
  email: "grace@example.com",
  notificationStatus: "failed" as const,
  notificationAttempts: undefined,
  lastNotificationError: undefined,
  notifiedAt: undefined,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("email notifications", () => {
  it("shows an empty delivery list without fabricated records", async () => {
    fetchEnquirySummary.mockResolvedValue({
      status: "ok",
      total: 0,
      byNotificationStatus: { pending: 0, sending: 0, sent: 0, failed: 0 },
    });
    fetchEnquiries.mockResolvedValue({ status: "ok", items: [], cursor: null });
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText("No notifications in this status.")).toBeVisible();
    expect(screen.getByRole("button", { name: /^pending/i })).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: /^failed/i })).toHaveTextContent("0");
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByText("Failed notifications are terminal and are not retried automatically.")).toBeVisible();
  });

  it("loads summary counts from the administration API", async () => {
    fetchEnquirySummary.mockResolvedValue(summary);
    fetchEnquiries.mockResolvedValue({ status: "ok", items: [], cursor: null });
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByRole("button", { name: /^pending/i })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /^sending/i })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /^sent/i })).toHaveTextContent("4");
    expect(screen.getByRole("button", { name: /^failed/i })).toHaveTextContent("1");
    expect(fetchEnquirySummary).toHaveBeenCalledWith("access-token");
  });

  it("filters each notification status", async () => {
    fetchEnquirySummary.mockResolvedValue(summary);
    fetchEnquiries.mockResolvedValue({ status: "ok", items: [], cursor: null });
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    await screen.findByText("No notifications in this status.");
    for (const status of ["sending", "sent", "failed", "pending"] as const) {
      fireEvent.change(screen.getByLabelText("Notification status"), { target: { value: status } });
      await waitFor(() => {
        expect(fetchEnquiries).toHaveBeenLastCalledWith("access-token", { status, cursor: null });
      });
    }
  });

  it("shows delivery facts for a saved notification", async () => {
    fetchEnquirySummary.mockResolvedValue(summary);
    fetchEnquiries.mockResolvedValue({ status: "ok", items: [first], cursor: null });
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText("Ada Lovelace")).toBeVisible();
    const table = screen.getByRole("table", { name: "Email notifications" });
    expect(within(table).getByText("ada@example.com")).toBeVisible();
    expect(within(table).getByText("aaaaaaaaaaaa")).toBeVisible();
    expect(within(table).getByText("2")).toBeVisible();
    expect(within(table).getByText("RetryLimitReached")).toBeVisible();
    expect(screen.getByText("2026-11-23 09:05")).toBeVisible();
    expect(screen.getByText("2026-11-23 09:00")).toBeVisible();
  });

  it("shows a safe empty value when delivery fields were not stored", async () => {
    fetchEnquirySummary.mockResolvedValue(summary);
    fetchEnquiries.mockResolvedValue({ status: "ok", items: [second], cursor: null });
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText("Grace Hopper")).toBeVisible();
    expect(screen.getByText("Not recorded")).toBeVisible();
    expect(screen.getByText("None recorded")).toBeVisible();
    expect(screen.getByText("Not sent")).toBeVisible();
  });

  it("opens the notification that belongs to the enquiry", async () => {
    fetchEnquirySummary.mockResolvedValue(summary);
    fetchEnquiries.mockResolvedValue({ status: "ok", items: [first], cursor: null });
    fetchEnquiry.mockResolvedValue({ status: "ok", enquiry: { ...first, message: "The full celebration plan.", messageTruncated: false } });
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    fireEvent.click(await screen.findByRole("button", { name: "View notification for Ada Lovelace" }));
    expect(await screen.findByText("This notification belongs to the enquiry submitted by Ada Lovelace.")).toBeVisible();
    expect(screen.getByText(first.id)).toBeVisible();
    expect(screen.getAllByText("RetryLimitReached").length).toBeGreaterThan(0);
    expect(fetchEnquiry).toHaveBeenCalledWith("access-token", first.id);
    expect(screen.queryByText("The full celebration plan.")).toBeNull();
  });

  it("loads the next page from the returned cursor", async () => {
    fetchEnquirySummary.mockResolvedValue(summary);
    fetchEnquiries
      .mockResolvedValueOnce({ status: "ok", items: [first], cursor: "cursor-2" })
      .mockResolvedValueOnce({ status: "ok", items: [second], cursor: null });
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText("Ada Lovelace")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Grace Hopper")).toBeVisible();
    expect(fetchEnquiries).toHaveBeenLastCalledWith("access-token", {
      status: "pending",
      cursor: "cursor-2",
    });
  });

  it("keeps the next page available when the page is empty and a cursor remains", async () => {
    fetchEnquirySummary.mockResolvedValue(summary);
    fetchEnquiries.mockResolvedValue({ status: "ok", items: [], cursor: "cursor-2" });
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText("No matching notifications on this page. More records are available.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("shows a loading state before records arrive", async () => {
    fetchEnquirySummary.mockReturnValue(new Promise(() => {}));
    fetchEnquiries.mockReturnValue(new Promise(() => {}));
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    expect(screen.getByText("Loading notifications…")).toBeVisible();
    expect(screen.getAllByText("Loading…")).toHaveLength(4);
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.queryByText(/@/)).toBeNull();
  });

  it("shows an error when delivery records cannot be loaded", async () => {
    fetchEnquirySummary.mockResolvedValue({ status: "unavailable" });
    fetchEnquiries.mockResolvedValue({ status: "unavailable" });
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText(/Notification delivery records could not be loaded/)).toBeVisible();
    expect(screen.getAllByText("Could not be loaded")).toHaveLength(4);
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });

  it("does not show delivery records after a forbidden response", async () => {
    fetchEnquirySummary.mockResolvedValue({ status: "forbidden" });
    fetchEnquiries.mockResolvedValue({ status: "forbidden" });
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText(/Notification delivery records could not be loaded/)).toBeVisible();
    expect(screen.queryByText("ada@example.com")).toBeNull();
    expect(onUnauthorised).not.toHaveBeenCalled();
  });

  it("refreshes the summary and the current list", async () => {
    fetchEnquirySummary.mockResolvedValue(summary);
    fetchEnquiries.mockResolvedValue({ status: "ok", items: [first], cursor: null });
    render(<NotificationBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText("Ada Lovelace")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => {
      expect(fetchEnquirySummary).toHaveBeenCalledTimes(2);
      expect(fetchEnquiries).toHaveBeenCalledTimes(2);
    });
  });
});
