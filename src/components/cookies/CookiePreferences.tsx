"use client";

import { Button } from "@/components/ui/Button";
import {
  CONSENT_SAVE_ERROR,
  CONSENT_SAVE_INCOMPLETE,
  CONSENT_WITHDRAW_ERROR,
  CONSENT_WITHDRAW_UNPERSISTED,
} from "@/lib/consent";
import { useConsent } from "./useConsent";

export function CookiePreferences() {
  const consent = useConsent();

  return (
    <section
      aria-labelledby="cookie-settings-heading"
      className="rounded-lg border border-slate-200 bg-surface p-4"
    >
      <h2 id="cookie-settings-heading" className="text-xl text-navy-900">
        Cookie settings
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{statusText(consent)}</p>
      {consent.saveError ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-navy-900">
          {consent.saveError === "withdraw-unpersisted"
            ? CONSENT_WITHDRAW_UNPERSISTED
            : consent.saveError === "withdraw-failed"
              ? CONSENT_WITHDRAW_ERROR
              : consent.saveError === "save-incomplete"
                ? CONSENT_SAVE_INCOMPLETE
                : CONSENT_SAVE_ERROR}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            consent.outcome === "analytics" ? consent.withdraw() : consent.choose("essential")
          }
        >
          Essential only
        </Button>
        <Button type="button" onClick={() => consent.choose("all")}>
          Allow analytics
        </Button>
      </div>
    </section>
  );
}

function statusText(consent: ReturnType<typeof useConsent>): string {
  if (!consent.ready) return "Checking this browser…";
  if (consent.saveError === "withdraw-unpersisted") {
    return "Analytics is off for this page. Withdrawal could not be saved in this browser. Refreshing may apply the previous choice again because this browser refused the save.";
  }
  if (consent.saveError === "save-incomplete") {
    return "Analytics is off. This browser could not fully save your cookie preference. You can try again.";
  }
  if (consent.withdrawalBlocked) {
    return "Analytics is off. The essential-only choice could not be saved. Analytics stays off until a new choice is saved successfully.";
  }
  if (consent.outcome === "essential") {
    return "Current choice: essential only. Analytics is off.";
  }
  if (consent.outcome === "analytics") {
    return "Current choice: analytics allowed. Page views on this browser can be stored. You can switch back to essential only, which stops further collection.";
  }
  if (consent.reason === "legacy" || consent.reason === "invalid" || consent.reason === "unreadable") {
    return "A previous or unreadable choice is stored. It does not allow analytics. Please choose again.";
  }
  return "You have not made a choice yet. Analytics is off until you allow it.";
}
