"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  createMeasureClient,
  postMeasure,
  type MeasureClient,
} from "@/lib/analytics/measure-client";

/**
 * Aggregate measurement stays inactive until a future approved build sets
 * NEXT_PUBLIC_ANALYTICS_MEASURE_URL. This module does not contain a live URL.
 * Consent is not read here, so a withdrawal cannot change this client or
 * the separate individual collector.
 */
const defaultMeasure = createMeasureClient({
  endpoint: process.env.NEXT_PUBLIC_ANALYTICS_MEASURE_URL,
  fetchMeasure: postMeasure,
  getPathname: () => window.location.pathname,
});

export function AggregateMeasure({ client = defaultMeasure }: { client?: MeasureClient }) {
  const pathname = usePathname();

  useEffect(() => {
    // The request is not aborted on cleanup. Aborting and sending again
    // could count the same navigation twice.
    void client.record();
  }, [pathname, client]);

  return null;
}
