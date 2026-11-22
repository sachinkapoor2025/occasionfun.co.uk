/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmRegistrationForm } from "../src/components/admin/ConfirmRegistrationForm";
import { LoginForm } from "../src/components/admin/LoginForm";
import { RegisterForm } from "../src/components/admin/RegisterForm";

const push = vi.hoisted(() => vi.fn());
const registerAccount = vi.hoisted(() => vi.fn());
const confirmRegistration = vi.hoisted(() => vi.fn());
const signInWithPassword = vi.hoisted(() => vi.fn());
const searchParams = vi.hoisted(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock("../src/lib/admin/auth", () => ({
  isAuthConfigured: () => true,
  registerAccount,
  confirmRegistration,
  signInWithPassword,
  PASSWORD_POLICY_MESSAGE:
    "Use at least 8 characters, with an upper-case letter, a lower-case letter, a number, and a symbol.",
  AuthConfigError: class AuthConfigError extends Error {},
  AuthFlowError: class AuthFlowError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthFlowError";
    }
  },
}));

afterEach(() => {
  cleanup();
  searchParams.delete("email");
  searchParams.delete("confirmed");
  vi.clearAllMocks();
});

describe("admin registration screens", () => {
  it("sends a password sign-in to the admin area without an authenticator step", async () => {
    signInWithPassword.mockResolvedValue({ status: "signed-in" });
    render(<LoginForm />);

    expect(screen.queryByText(/authenticator/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Correct-horse-1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith(
        "ada@example.com",
        "Correct-horse-1!",
      );
      expect(push).toHaveBeenCalledWith("/admin/");
    });
    expect(push.mock.calls.map((call) => call[0])).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/mfa/i)]),
    );
  });

  it("links the login page to registration", () => {
    render(<LoginForm />);

    expect(
      screen.getByRole("link", { name: "Create Account" }).getAttribute("href"),
    ).toMatch(/^\/admin\/register\/?$/);
  });

  it("sends a valid registration to Cognito and continues to confirmation", async () => {
    registerAccount.mockResolvedValue({ status: "confirm" });
    render(<RegisterForm />);

    expect(
      screen.getByText(
        "Use at least 8 characters, with an upper-case letter, a lower-case letter, a number, and a symbol.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Correct-horse-1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Correct-horse-1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(registerAccount).toHaveBeenCalledWith(
        "ada@example.com",
        "Correct-horse-1!",
        "Correct-horse-1!",
      );
      expect(push).toHaveBeenCalledWith(
        "/admin/register/confirm/?email=ada%40example.com",
      );
    });
  });

  it("confirms the code and returns to admin login", async () => {
    searchParams.set("email", "ada@example.com");
    confirmRegistration.mockResolvedValue(undefined);
    render(<ConfirmRegistrationForm />);

    fireEvent.change(screen.getByLabelText("Confirmation code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm email" }));

    await waitFor(() => {
      expect(confirmRegistration).toHaveBeenCalledWith("ada@example.com", "123456");
      expect(push).toHaveBeenCalledWith("/admin/login/?confirmed=1");
    });
  });
});
