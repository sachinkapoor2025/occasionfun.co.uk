/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AdminGate,
  UNAUTHORISED_ADMIN_EXPLANATION,
  UNAUTHORISED_ADMIN_MESSAGE,
} from "../src/components/admin/AdminGate";

const replace = vi.hoisted(() => vi.fn());
const logOut = vi.hoisted(() => vi.fn(async () => {}));
const restoreSession = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{ status: "signed-in" | "signed-out" | "unapproved" }> => ({
      status: "signed-in",
    }),
  ),
);
const currentAccessToken = vi.hoisted(() =>
  vi.fn(async () => ({ status: "token" as const, token: "access-token" })),
);
const fetchAdminHealth = vi.hoisted(() => vi.fn());
const fetchEnquirySummary = vi.hoisted(() =>
  vi.fn(async () => ({
    status: "ok" as const,
    total: 0,
    byNotificationStatus: { pending: 0, sending: 0, sent: 0, failed: 0 },
  })),
);
const fetchEnquiries = vi.hoisted(() =>
  vi.fn(async () => ({ status: "ok" as const, items: [] as [], cursor: null })),
);
const fetchEnquiry = vi.hoisted(() => vi.fn());
const updateEnquiryReview = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("../src/lib/admin/auth", () => ({
  isAuthConfigured: () => true,
  logOut,
  restoreSession,
  currentAccessToken,
}));

vi.mock("../src/lib/admin/api", () => ({
  isAdminApiConfigured: () => true,
  notificationStatuses: ["pending", "sending", "sent", "failed"],
  fetchAdminHealth,
  fetchEnquirySummary,
  fetchEnquiries,
  fetchEnquiry,
  updateEnquiryReview,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  restoreSession.mockResolvedValue({ status: "signed-in" });
  currentAccessToken.mockResolvedValue({ status: "token", token: "access-token" });
});

describe("admin health gate", () => {
  it("shows a successful health response for an admin access token", async () => {
    fetchAdminHealth.mockResolvedValue({
      status: "ok",
      body: { ok: true, status: "ok", service: "admin", requestId: "req-1" },
    });
    render(<AdminGate />);

    expect(await screen.findByText("Status: ok")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeVisible();
    expect(screen.getByText("Admin Panel")).toBeVisible();
    expect(screen.queryByText("The administration service is available.")).toBeNull();
    expect(screen.getAllByText("Not connected").length).toBeGreaterThan(0);
    expect(fetchAdminHealth).toHaveBeenCalledWith("access-token");
    expect(replace).not.toHaveBeenCalled();
  });

  it("opens an empty enquiry list with no fabricated records", async () => {
    fetchAdminHealth.mockResolvedValue({
      status: "ok",
      body: { ok: true, status: "ok", service: "admin", requestId: "req-1" },
    });
    render(<AdminGate />);

    fireEvent.click(await screen.findByRole("button", { name: "Enquiries" }));

    expect(screen.getByRole("heading", { name: "Enquiries" })).toBeVisible();
    expect(await screen.findByText("No enquiries in this notification status.")).toBeVisible();
    expect(screen.queryByText(/@/)).toBeNull();
  });

  it("clears an invalid session after HTTP 401", async () => {
    fetchAdminHealth.mockResolvedValue({ status: "unauthorized" });
    render(<AdminGate />);

    await waitFor(() => {
      expect(logOut).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/admin/login/");
    });
    expect(screen.queryByText("The administration service is available.")).toBeNull();
  });

  it("shows an authorization failure after HTTP 403", async () => {
    fetchAdminHealth.mockResolvedValue({ status: "forbidden" });
    render(<AdminGate />);

    expect(await screen.findByRole("heading", { name: UNAUTHORISED_ADMIN_MESSAGE })).toBeVisible();
    expect(screen.getByText(UNAUTHORISED_ADMIN_EXPLANATION)).toBeVisible();
    expect(screen.queryByText(/403|forbidden/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(screen.queryByText("The administration service is available.")).toBeNull();
    expect(screen.queryByText("Status: ok")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Administration" })).toBeNull();
    expect(logOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      expect(logOut).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/admin/login/?signedOut=1");
    });
  });

  it("calls the protected API for a signed-in user outside the admin group", async () => {
    restoreSession.mockResolvedValue({ status: "unapproved" });
    fetchAdminHealth.mockResolvedValue({ status: "forbidden" });
    render(<AdminGate />);

    expect(await screen.findByRole("heading", { name: UNAUTHORISED_ADMIN_MESSAGE })).toBeVisible();
    expect(screen.getByText(UNAUTHORISED_ADMIN_EXPLANATION)).toBeVisible();
    expect(fetchAdminHealth).toHaveBeenCalledWith("access-token");
    expect(screen.queryByText("The administration service is available.")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Overview" })).toBeNull();
    expect(logOut).not.toHaveBeenCalled();
  });

  it("keeps the session when the network fails", async () => {
    fetchAdminHealth.mockResolvedValue({ status: "unavailable" });
    render(<AdminGate />);

    expect(
      await screen.findByText("The administration service could not be reached."),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: UNAUTHORISED_ADMIN_MESSAGE })).toBeNull();
    expect(screen.queryByText(UNAUTHORISED_ADMIN_EXPLANATION)).toBeNull();
    expect(logOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated visitor to login", async () => {
    restoreSession.mockResolvedValue({ status: "signed-out" });
    render(<AdminGate />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/admin/login/");
    });
    expect(fetchAdminHealth).not.toHaveBeenCalled();
  });
});
