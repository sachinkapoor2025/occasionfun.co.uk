/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnquiryBoard } from "../src/components/admin/panel/EnquiryBoard";

const fetchEnquiries = vi.hoisted(() => vi.fn());
const fetchEnquiry = vi.hoisted(() => vi.fn());
const updateEnquiryReview = vi.hoisted(() => vi.fn());
const onUnauthorised = vi.hoisted(() => vi.fn());

vi.mock("../src/lib/admin/auth", () => ({
  currentAccessToken: async () => ({ status: "token" as const, token: "access-token" }),
}));

vi.mock("../src/lib/admin/api", () => ({
  notificationStatuses: ["pending", "sending", "sent", "failed"],
  fetchEnquiries,
  fetchEnquiry,
  updateEnquiryReview,
}));

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
};

const second = { ...first, id: "b".repeat(64), name: "Grace Hopper", email: "grace@example.com" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("enquiry board", () => {
  it("shows an empty list without fabricated records", async () => {
    fetchEnquiries.mockResolvedValue({ status: "ok", items: [], cursor: null });
    render(<EnquiryBoard onUnauthorised={onUnauthorised} />);
    expect(
      await screen.findByText(
        "Enquiries are ordered by notification due time, newest first. The Submitted column shows the original submission date and time. Retry activity can affect the list order.",
      ),
    ).toBeVisible();
    expect(screen.getByText("No enquiries in this notification status.")).toBeVisible();
    expect(screen.queryByText("No matching enquiries on this page. More records are available.")).toBeNull();
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("keeps the next page available when a page has no matches and a continuation cursor", async () => {
    fetchEnquiries.mockResolvedValue({ status: "ok", items: [], cursor: "cursor-2" });
    render(<EnquiryBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText("No matching enquiries on this page. More records are available.")).toBeVisible();
    expect(screen.queryByText("No enquiries in this notification status.")).toBeNull();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("loads the next page from the returned cursor", async () => {
    fetchEnquiries
      .mockResolvedValueOnce({ status: "ok", items: [first], cursor: "cursor-2" })
      .mockResolvedValueOnce({ status: "ok", items: [second], cursor: null });
    render(<EnquiryBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText("Ada Lovelace")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Grace Hopper")).toBeVisible();
    expect(fetchEnquiries).toHaveBeenLastCalledWith("access-token", {
      status: "pending",
      cursor: "cursor-2",
      q: "",
    });
  });

  it("shows an error when the list cannot be loaded", async () => {
    fetchEnquiries.mockResolvedValue({ status: "unavailable" });
    render(<EnquiryBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText(/could not be loaded/i)).toBeVisible();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });

  it("does not show enquiry records to a forbidden response", async () => {
    fetchEnquiries.mockResolvedValue({ status: "forbidden" });
    render(<EnquiryBoard onUnauthorised={onUnauthorised} />);
    expect(await screen.findByText(/could not be loaded/i)).toBeVisible();
    expect(screen.queryByText("ada@example.com")).toBeNull();
    expect(onUnauthorised).not.toHaveBeenCalled();
  });

  it("shows the full enquiry and saves a review status", async () => {
    fetchEnquiries.mockResolvedValue({ status: "ok", items: [first], cursor: null });
    fetchEnquiry.mockResolvedValue({
      status: "ok",
      enquiry: { ...first, message: "The full celebration plan.", messageTruncated: false },
    });
    updateEnquiryReview.mockResolvedValue({
      status: "ok",
      enquiry: {
        ...first,
        message: "The full celebration plan.",
        messageTruncated: false,
        reviewStatus: "reviewed",
      },
    });
    render(<EnquiryBoard onUnauthorised={onUnauthorised} />);
    fireEvent.click(await screen.findByRole("button", { name: "View Ada Lovelace" }));
    expect(await screen.findByText("The full celebration plan.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));
    expect(await screen.findByText("pending · reviewed")).toBeVisible();
    expect(updateEnquiryReview).toHaveBeenCalledWith("access-token", first.id, "reviewed");
  });
});
