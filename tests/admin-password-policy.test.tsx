/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "../src/components/admin/RegisterForm";
import { ResetPasswordForm } from "../src/components/admin/ResetPasswordForm";

const push = vi.hoisted(() => vi.fn());
const signUp = vi.hoisted(() => vi.fn());
const confirmResetPassword = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("email=ada@example.com"),
}));

vi.mock("aws-amplify", () => ({
  Amplify: { configure: vi.fn() },
}));

vi.mock("aws-amplify/auth", () => ({
  signIn: vi.fn(),
  confirmSignIn: vi.fn(),
  fetchAuthSession: vi.fn(),
  resetPassword: vi.fn(),
  confirmResetPassword,
  signOut: vi.fn(),
  signUp,
  confirmSignUp: vi.fn(),
}));

vi.mock("aws-amplify/auth/cognito", () => ({
  cognitoUserPoolsTokenProvider: { setKeyValueStorage: vi.fn() },
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_COGNITO_REGION = "eu-west-2";
  process.env.NEXT_PUBLIC_COGNITO_POOL_ID = "eu-west-2_demo";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "client";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("admin password screens", () => {
  it("registers an 8-character password and rejects a shorter one", async () => {
    signUp.mockResolvedValue({
      isSignUpComplete: false,
      nextStep: { signUpStep: "CONFIRM_SIGN_UP" },
    });
    render(<RegisterForm />);

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    fill("Email", "ada@example.com");
    fill("Password", "Abcdef1!");
    fill("Confirm password", "Abcdef1!");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        username: "ada@example.com",
        password: "Abcdef1!",
        options: { userAttributes: { email: "ada@example.com" } },
      });
    });

    cleanup();
    signUp.mockClear();
    render(<RegisterForm />);
    fill("Email", "ada@example.com");
    fill("Password", "Abcde1!");
    fill("Confirm password", "Abcde1!");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/at least 8 characters/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("accepts an 8-character reset password and keeps confirmation matching", async () => {
    confirmResetPassword.mockResolvedValue(undefined);
    render(<ResetPasswordForm />);

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    fill("Reset code", "123456");
    fill("New password", "Abcdef1!");
    fill("Confirm new password", "Abcdef1!");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(confirmResetPassword).toHaveBeenCalledWith({
        username: "ada@example.com",
        confirmationCode: "123456",
        newPassword: "Abcdef1!",
      });
      expect(push).toHaveBeenCalledWith("/admin/login/");
    });
  });

  it("rejects a short or mismatched new password before calling Cognito", async () => {
    render(<ResetPasswordForm />);
    fill("Reset code", "123456");
    fill("New password", "Abcde1!");
    fill("Confirm new password", "Abcde1!");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      await screen.findByText(/does not meet the password policy/i),
    ).toBeInTheDocument();
    expect(confirmResetPassword).not.toHaveBeenCalled();

    fill("New password", "Abcdef1!");
    fill("Confirm new password", "Abcdef2!");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(confirmResetPassword).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
