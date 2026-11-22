/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminGate } from "../src/components/admin/AdminGate";
import { LoginForm, SIGNED_OUT_MESSAGE } from "../src/components/admin/LoginForm";

const replace = vi.hoisted(() => vi.fn());
const logOut = vi.hoisted(() => vi.fn(async () => {}));
const restoreSession = vi.hoisted(() =>
  vi.fn(async () => ({ status: "signed-in" as const })),
);
const searchParams = vi.hoisted(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock("../src/lib/admin/auth", () => ({
  isAuthConfigured: () => true,
  logOut,
  restoreSession,
  signInWithPassword: vi.fn(),
  AuthConfigError: class AuthConfigError extends Error {},
  AuthFlowError: class AuthFlowError extends Error {},
}));

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_ADMIN_API_BASE;
});

afterEach(() => {
  cleanup();
  searchParams.delete("signedOut");
  delete process.env.NEXT_PUBLIC_ADMIN_API_BASE;
});

describe("sign-out message", () => {
  it("shows that other devices may remain signed in", () => {
    searchParams.set("signedOut", "1");
    render(<LoginForm />);

    expect(screen.getByRole("status")).toHaveTextContent(SIGNED_OUT_MESSAGE);
    expect(screen.getByRole("status").textContent).not.toMatch(
      /other devices (have been|were) (revoked|signed out)/i,
    );
  });

  it("does not show the sign-out notice on a normal visit", () => {
    render(<LoginForm />);

    expect(screen.queryByText(SIGNED_OUT_MESSAGE)).toBeNull();
  });

  it("clears the local session and does not claim remote revocation from the button", async () => {
    render(<AdminGate />);

    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/admin/login/?signedOut=1");
    });
    expect(logOut).toHaveBeenCalledTimes(1);
  });
});
