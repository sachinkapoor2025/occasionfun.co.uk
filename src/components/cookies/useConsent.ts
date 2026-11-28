"use client";

import { useSyncExternalStore } from "react";
import {
  getConsentSnapshot,
  getServerConsentSnapshot,
  readConsentView,
  saveConsent,
  subscribeConsent,
  withdrawAnalytics,
  type ConsentChoice,
  type ConsentView,
  type SaveResult,
} from "@/lib/consent";

export function useConsent(): ConsentView & {
  choose: (choice: ConsentChoice) => SaveResult;
  withdraw: () => SaveResult;
} {
  const snapshot = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getServerConsentSnapshot,
  );
  const view = readConsentView(snapshot);
  return {
    ...view,
    choose: saveConsent,
    withdraw: withdrawAnalytics,
  };
}
