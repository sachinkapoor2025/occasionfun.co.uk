/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminGate, UNAUTHORISED_ADMIN_MESSAGE } from "../src/components/admin/AdminGate";

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
  fetchAdminHealth,
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

    expect(await screen.findByText("The administration service is available.")).toBeVisible();
    expect(screen.getByText("Status: ok")).toBeVisible();
    expect(fetchAdminHealth).toHaveBeenCalledWith("access-token");
    expect(replace).not.toHaveBeenCalled();
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

    expect(await screen.findByText(UNAUTHORISED_ADMIN_MESSAGE)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Account not authorised" })).toBeVisible();
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

    expect(await screen.findByText(UNAUTHORISED_ADMIN_MESSAGE)).toBeVisible();
    expect(fetchAdminHealth).toHaveBeenCalledWith("access-token");
    expect(screen.queryByText("The administration service is available.")).toBeNull();
    expect(logOut).not.toHaveBeenCalled();
  });

  it("keeps the session when the network fails", async () => {
    fetchAdminHealth.mockResolvedValue({ status: "unavailable" });
    render(<AdminGate />);

    expect(
      await screen.findByText("The administration service could not be reached."),
    ).toBeVisible();
    expect(screen.queryByText(UNAUTHORISED_ADMIN_MESSAGE)).toBeNull();
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
