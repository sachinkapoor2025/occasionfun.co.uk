"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  AuthConfigError,
  AuthFlowError,
  isAuthConfigured,
  signInWithPassword,
} from "@/lib/admin/auth";
import { AuthCard } from "./AuthCard";
import { FormStatus } from "./FormStatus";
import { PasswordField } from "./PasswordField";
import { fieldClass, labelClass } from "./fields";

export const SIGNED_OUT_MESSAGE =
  "You are signed out on this device. Other devices may remain signed in.";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const signedOut = params.get("signedOut") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const configured = isAuthConfigured();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signInWithPassword(email, password);
      if (result.status === "reset-password") {
        router.push(
          `/admin/reset-password/?email=${encodeURIComponent(email.trim())}`,
        );
        return;
      }
      router.push("/admin/");
    } catch (caught) {
      if (caught instanceof AuthConfigError || caught instanceof AuthFlowError) {
        setError(caught.message);
      } else {
        setError(
          "The email or password is incorrect, or this account cannot sign in.",
        );
      }
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Administrator sign-in"
      intro="Sign in with the email and password for your OccasionFun account."
    >
      {signedOut ? (
        <p role="status" className="mb-4 text-sm leading-6 text-slate-600">
          {SIGNED_OUT_MESSAGE}
        </p>
      ) : null}
      {params.get("confirmed") === "1" ? (
        <p role="status" className="mb-4 text-sm leading-6 text-slate-600">
          Your email is confirmed. Sign in with your email and password.
        </p>
      ) : null}
      {configured ? null : (
        <FormStatus message="Administrator sign-in is not configured for this environment." />
      )}
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className={labelClass} htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "admin-login-error" : undefined}
          />
        </div>
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          invalid={Boolean(error)}
          describedBy={error ? "admin-login-error" : undefined}
        />
        <div id="admin-login-error">
          <FormStatus message={error} />
        </div>
        <Button type="submit" className="w-full" disabled={pending || !configured}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/admin/forgot-password/" className="font-semibold text-accent">
          Forgot password
        </Link>
      </p>
      <p className="mt-3 text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link href="/admin/register/" className="font-semibold text-accent">
          Create Account
        </Link>
      </p>
    </AuthCard>
  );
}
