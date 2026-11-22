"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  AuthConfigError,
  AuthFlowError,
  confirmRegistration,
  isAuthConfigured,
} from "@/lib/admin/auth";
import { AuthCard } from "./AuthCard";
import { FormStatus } from "./FormStatus";
import { fieldClass, labelClass } from "./fields";

export function ConfirmRegistrationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const configured = isAuthConfigured();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await confirmRegistration(email, code);
      router.push("/admin/login/?confirmed=1");
    } catch (caught) {
      setError(
        caught instanceof AuthConfigError || caught instanceof AuthFlowError
          ? caught.message
          : "That confirmation code was not accepted.",
      );
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Confirm your email"
      intro="Enter the confirmation code sent to your email. After it is accepted, sign in with your email and password."
    >
      {configured ? null : (
        <FormStatus message="Administrator sign-in is not configured for this environment." />
      )}
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className={labelClass} htmlFor="admin-confirm-email">
            Email
          </label>
          <input
            id="admin-confirm-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="admin-confirm-code">
            Confirmation code
          </label>
          <input
            id="admin-confirm-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "admin-confirm-error" : undefined}
          />
        </div>
        <div id="admin-confirm-error">
          <FormStatus message={error} />
        </div>
        <Button type="submit" className="w-full" disabled={pending || !configured}>
          {pending ? "Confirming…" : "Confirm email"}
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
