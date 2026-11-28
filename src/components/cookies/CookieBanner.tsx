"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import {
  CONSENT_SAVE_ERROR,
  CONSENT_SAVE_INCOMPLETE,
  CONSENT_WITHDRAW_ERROR,
  CONSENT_WITHDRAW_UNPERSISTED,
} from "@/lib/consent";
import { useConsent } from "./useConsent";

/**
 * Consent banner for UK cookie requirements.
 * A version-1 choice is stored in this browser. Analytics collection starts only after Allow analytics.
 */
export function CookieBanner() {
  const consent = useConsent();

  if (!consent.ready || (consent.outcome !== "pending" && consent.saveError !== "save-incomplete")) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 shadow-[0_-12px_40px_-24px_rgba(11,31,51,0.35)] backdrop-blur"
    >
      <Container className="flex flex-col gap-4 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-navy-900">Cookie preferences</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Essential storage is needed for this site to work, including
            remembering this choice. Analytics storage is optional. Allowing
            analytics stores a first-party page view for pages you open after
            that choice. It does not store your IP address. See our{" "}
            <Link
              href="/cookies"
              className="font-semibold text-accent underline-offset-2 hover:underline"
            >
              cookie notice
            </Link>
            .
          </p>
          {consent.saveError ? (
            <p role="alert" className="mt-2 text-sm font-semibold text-navy-900">
              {consent.saveError === "withdraw-unpersisted"
                ? CONSENT_WITHDRAW_UNPERSISTED
                : consent.saveError === "withdraw-failed"
                  ? CONSENT_WITHDRAW_ERROR
                  : consent.saveError === "save-incomplete"
                    ? CONSENT_SAVE_INCOMPLETE
                    : CONSENT_SAVE_ERROR}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => consent.choose("essential")}>
            Essential only
          </Button>
          <Button type="button" onClick={() => consent.choose("all")}>
            Allow analytics
          </Button>
        </div>
      </Container>
    </div>
  );
}
