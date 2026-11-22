"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  AuthConfigError,
  AuthFlowError,
  PASSWORD_POLICY_MESSAGE,
  isAuthConfigured,
  registerAccount,
} from "@/lib/admin/auth";
import { AuthCard } from "./AuthCard";
import { FormStatus } from "./FormStatus";
import { PasswordField } from "./PasswordField";
import { fieldClass, labelClass } from "./fields";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const configured = isAuthConfigured();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await registerAccount(email, password, confirmPassword);
      if (result.status === "confirm") {
        router.push(
          `/admin/register/confirm/?email=${encodeURIComponent(email.trim())}`,
        );
        return;
      }
      router.push("/admin/login/?confirmed=1");
    } catch (caught) {
      setError(
        caught instanceof AuthConfigError || caught instanceof AuthFlowError
          ? caught.message
          : "The account could not be created. Check the details and try again.",
      );
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Create an account"
      intro="Create an OccasionFun account with your email address. A new account is not an administrator until an authorised person approves it."
    >
      {configured ? null : (
        <FormStatus message="Administrator sign-in is not configured for this environment." />
      )}
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className={labelClass} htmlFor="admin-register-email">
            Email
          </label>
          <input
            id="admin-register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "admin-register-error" : undefined}
          />
        </div>
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          invalid={Boolean(error)}
          describedBy="admin-register-password-hint"
        />
        <p id="admin-register-password-hint" className="text-xs leading-5 text-slate-600">
          {PASSWORD_POLICY_MESSAGE}
        </p>
        <PasswordField
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          invalid={Boolean(error)}
          describedBy={error ? "admin-register-error" : undefined}
        />
        <div id="admin-register-error">
          <FormStatus message={error} />
        </div>
        <Button type="submit" className="w-full" disabled={pending || !configured}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/admin/login/" className="font-semibold text-accent">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
