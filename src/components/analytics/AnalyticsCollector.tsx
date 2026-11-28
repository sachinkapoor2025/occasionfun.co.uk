"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { createPageCollector } from "@/lib/analytics/collector";
import { isAnalyticsConsentGranted, subscribeConsent } from "@/lib/consent";

const collector = createPageCollector({
  endpoint: process.env.NEXT_PUBLIC_ANALYTICS_COLLECT_URL,
  now: () => new Date(),
  randomId: () => crypto.randomUUID(),
  fetchPage: async (url, raw, signal) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw,
      signal,
      keepalive: true,
      credentials: "omit",
      cache: "no-store",
    });
    return { status: response.status, body: await response.text() };
  },
  getPage: () => ({
    pathname: window.location.pathname,
    search: window.location.search,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
  }),
});

export function AnalyticsCollector() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isAnalyticsConsentGranted()) {
      collector.abandon();
      return;
    }
    void collector.sync();
  }, [pathname]);

  useEffect(() => {
    return subscribeConsent(() => {
      if (!isAnalyticsConsentGranted()) collector.abandon();
      else void collector.sync();
    });
  }, []);

  return null;
}
