"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  AuthConfigError,
  isAuthConfigured,
  requestPasswordReset,
} from "@/lib/admin/auth";
import { AuthCard } from "./AuthCard";
import { FormStatus } from "./FormStatus";
import { fieldClass, labelClass } from "./fields";

const SENT =
  "If an account exists for that email, a reset code has been sent.";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const configured = isAuthConfigured();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof AuthConfigError
          ? caught.message
          : "The reset request could not be sent. Try again later.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      intro="Enter the email address for the administrator account. A reset code is sent only when that account can be recovered."
    >
      {configured ? null : (
        <FormStatus message="Administrator sign-in is not configured for this environment." />
      )}
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className={labelClass} htmlFor="admin-reset-email">
            Email
          </label>
          <input
            id="admin-reset-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />
        </div>
        <FormStatus message={sent ? SENT : null} tone="success" />
        <FormStatus message={error} />
        <Button type="submit" className="w-full" disabled={pending || !configured}>
          {pending ? "Sending…" : "Send reset code"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link
          href={
            email
              ? `/admin/reset-password/?email=${encodeURIComponent(email.trim())}`
              : "/admin/reset-password/"
          }
          className="font-semibold text-accent"
        >
          Enter a reset code
        </Link>
      </p>
    </AuthCard>
  );
}
