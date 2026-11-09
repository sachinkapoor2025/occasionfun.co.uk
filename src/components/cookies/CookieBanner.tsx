"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

const STORAGE_KEY = "occasionfun-cookie-consent";

type ConsentValue = "essential" | "all";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("occasionfun-cookie-consent", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("occasionfun-cookie-consent", onStoreChange);
  };
}

function getConsentSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return "pending";
}

/**
 * Consent banner for UK cookie requirements.
 * Non-essential analytics are not loaded by default and remain inactive
 * until explicit consent is recorded. No analytics provider is installed yet.
 */
export function CookieBanner() {
  const consent = useSyncExternalStore(
    subscribe,
    getConsentSnapshot,
    getServerSnapshot,
  );

  const saveConsent = useCallback((value: ConsentValue) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ value, updatedAt: new Date().toISOString() }),
      );
    } catch {
      // Ignore storage failures; banner can reappear.
    }
    window.dispatchEvent(new Event("occasionfun-cookie-consent"));
  }, []);

  if (consent === "pending" || consent) {
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
            We use essential cookies to make this site work. Optional analytics
            cookies are not enabled by default and will not be set unless you
            choose to allow them. See our{" "}
            <Link
              href="/cookies"
              className="font-semibold text-accent underline-offset-2 hover:underline"
            >
              cookie notice
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => saveConsent("essential")}
          >
            Essential only
          </Button>
          <Button type="button" onClick={() => saveConsent("all")}>
            Allow optional cookies
          </Button>
        </div>
      </Container>
    </div>
  );
}
