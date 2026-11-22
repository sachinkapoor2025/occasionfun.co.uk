"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  AuthConfigError,
  AuthFlowError,
  confirmPasswordReset,
  isAuthConfigured,
  passwordMeetsPolicy,
} from "@/lib/admin/auth";
import { AuthCard } from "./AuthCard";
import { FormStatus } from "./FormStatus";
import { PasswordField } from "./PasswordField";
import { fieldClass, labelClass } from "./fields";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const configured = isAuthConfigured();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm || !passwordMeetsPolicy(password)) {
      setError(
        "That code is not valid, or the new password does not meet the password policy.",
      );
      return;
    }
    setPending(true);
    try {
      await confirmPasswordReset(email, code, password);
      router.push("/admin/login/");
    } catch (caught) {
      const message =
        caught instanceof AuthConfigError || caught instanceof AuthFlowError
          ? caught.message
          : "That code is not valid, or the new password does not meet the password policy.";
      setError(message);
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      intro="Use the code from the reset email. The new password needs at least 8 characters, with upper case, lower case, a number, and a symbol."
    >
      {configured ? null : (
        <FormStatus message="Administrator sign-in is not configured for this environment." />
      )}
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className={labelClass} htmlFor="admin-new-email">
            Email
          </label>
          <input
            id="admin-new-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="admin-reset-code">
            Reset code
          </label>
          <input
            id="admin-reset-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={fieldClass}
          />
        </div>
        <PasswordField
          label="New password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <PasswordField
          label="Confirm new password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
        />
        <FormStatus message={error} />
        <Button type="submit" className="w-full" disabled={pending || !configured}>
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/admin/login/" className="font-semibold text-accent">
          Return to sign-in
        </Link>
      </p>
    </AuthCard>
  );
}
