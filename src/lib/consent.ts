/**
 * Versioned cookie consent for this browser.
 * This module records the choice. The page collector reads it and sends a
 * page view only after an analytics grant.
 */

export const CONSENT_STORAGE_KEY = "occasionfun-cookie-consent";
export const CONSENT_CHANGE_EVENT = "occasionfun-cookie-consent";
export const CURRENT_CONSENT_VERSION = 1;
export const ANALYTICS_VISITOR_ID_KEY = "occasionfun-analytics-visitor-id";
export const ANALYTICS_SESSION_ID_KEY = "occasionfun-analytics-session-id";
export const WITHDRAWAL_BLOCK_KEY = "occasionfun-analytics-withdrawal-blocked";

export const CONSENT_SAVE_ERROR =
  "This browser could not save your cookie preference. Analytics stays off. You can try again.";

export const CONSENT_SAVE_INCOMPLETE =
  "This browser could not fully save your cookie preference. Analytics stays off. You can try again.";

export const CONSENT_WITHDRAW_ERROR =
  "This browser could not save your essential-only choice. Analytics stays off. You can try again.";

export const CONSENT_WITHDRAW_UNPERSISTED =
  "Withdrawal could not be saved in this browser. Analytics is off for this page only. Refreshing may apply the previous choice again because this browser refused the save.";

const SERVER_CONSENT_SNAPSHOT = "server";
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export type ConsentChoice = "essential" | "all";

export type ConsentRecord = {
  version: 1;
  value: ConsentChoice;
  categories: {
    essential: true;
    analytics: boolean;
  };
  updatedAt: string;
};

export type ConsentRejection = "missing" | "legacy" | "invalid" | "unreadable";

export type ConsentParseResult =
  | { ok: true; record: ConsentRecord }
  | { ok: false; reason: ConsentRejection };

export type SaveError = "save-failed" | "save-incomplete" | "withdraw-failed" | "withdraw-unpersisted";

export type SaveResult = { ok: true; record: ConsentRecord } | { ok: false; error: SaveError };

export type ConsentView = {
  ready: boolean;
  outcome: "pending" | "essential" | "analytics";
  reason: ConsentRejection | "essential" | "analytics";
  analyticsGranted: boolean;
  withdrawalBlocked: boolean;
  saveError: SaveError | null;
};

let saveError: SaveError | null = null;
let pageAnalyticsBlocked = false;
let blockedConsentStamp: string | null = null;

export function createConsentRecord(choice: ConsentChoice, now: Date): ConsentRecord {
  return {
    version: CURRENT_CONSENT_VERSION,
    value: choice,
    categories: {
      essential: true,
      analytics: choice === "all",
    },
    updatedAt: now.toISOString(),
  };
}

export function isIsoTimestamp(value: string): boolean {
  if (!ISO_UTC.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

export function parseConsent(raw: string | null): ConsentParseResult {
  if (raw === null) return { ok: false, reason: "missing" };
  if (raw.trim() === "") return { ok: false, reason: "invalid" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "invalid" };
  }

  const record = parsed as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, "version")) {
    return { ok: false, reason: "legacy" };
  }

  const consent = validRecord(record);
  if (!consent) return { ok: false, reason: "invalid" };
  return { ok: true, record: consent };
}

/**
 * True only for a verified version-1 analytics grant with no withdrawal block.
 * A storage read error fails closed.
 */
export function isAnalyticsConsentGranted(): boolean {
  if (pageAnalyticsBlocked || withdrawalBlockIsActive()) return false;
  const stored = readStoredConsent();
  return stored.ok && grantsAnalytics(stored.record);
}

export function saveConsent(choice: ConsentChoice, now = new Date()): SaveResult {
  const saved = writeConsent(choice, now);
  if (!saved.ok) {
    saveError = "save-failed";
    publish();
    return saved;
  }
  if (choice === "essential") clearAnalyticsIdentifiers();
  if (!clearWithdrawalFlag()) return blockAfterUnverifiedFlag("save-incomplete");
  acceptVerifiedConsent();
  publish();
  return saved;
}

export function withdrawAnalytics(now = new Date()): SaveResult {
  const saved = writeConsent("essential", now);
  if (saved.ok) {
    clearAnalyticsIdentifiers();
    if (!clearWithdrawalFlag()) return blockAfterUnverifiedFlag("withdraw-failed");
    acceptVerifiedConsent();
    publish();
    return saved;
  }
  // The essential-only record was not verified. Leave the stored consent record
  // as it is and try to persist a separate block. If that write also fails,
  // only this page can keep analytics off: a refresh has no stored block.
  if (trySetWithdrawalFlag()) {
    rememberWithdrawalBlock("withdraw-failed");
    publish();
    return { ok: false, error: "withdraw-failed" };
  }
  rememberWithdrawalBlock("withdraw-unpersisted");
  publish();
  return { ok: false, error: "withdraw-unpersisted" };
}

export function getConsentSnapshot(): string {
  return encodeClientSnapshot();
}

export function getServerConsentSnapshot(): string {
  return SERVER_CONSENT_SNAPSHOT;
}

export function subscribeConsent(onStoreChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (
      event.key &&
      event.key !== CONSENT_STORAGE_KEY &&
      event.key !== WITHDRAWAL_BLOCK_KEY
    ) {
      return;
    }
    reconcileMemoryBlock();
    onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
  };
}

export function readConsentView(snapshot: string): ConsentView {
  if (snapshot === SERVER_CONSENT_SNAPSHOT) {
    return {
      ready: false,
      outcome: "pending",
      reason: "missing",
      analyticsGranted: false,
      withdrawalBlocked: false,
      saveError: null,
    };
  }

  const [errorName, memory, flag, reason] = snapshot.split("|");
  const saveFailure = saveFailureName(errorName);
  const withdrawalBlocked = memory === "1" || flag === "1";
  if (reason === "essential") {
    return {
      ready: true,
      outcome: "essential",
      reason: "essential",
      analyticsGranted: false,
      withdrawalBlocked,
      saveError: saveFailure,
    };
  }
  if (reason === "analytics") {
    return {
      ready: true,
      outcome: "analytics",
      reason: "analytics",
      analyticsGranted: !withdrawalBlocked,
      withdrawalBlocked,
      saveError: saveFailure,
    };
  }
  const pendingReason: ConsentRejection =
    reason === "legacy" || reason === "invalid" || reason === "unreadable" ? reason : "missing";
  return {
    ready: true,
    outcome: "pending",
    reason: pendingReason,
    analyticsGranted: false,
    withdrawalBlocked,
    saveError: saveFailure,
  };
}

/** Clears the in-page error and withdrawal block. Does not write storage. */
export function resetConsentSession(): void {
  saveError = null;
  pageAnalyticsBlocked = false;
  blockedConsentStamp = null;
}

function writeConsent(choice: ConsentChoice, now: Date): SaveResult {
  const record = createConsentRecord(choice, now);
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    const stored = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    if (!stored.ok || stored.record.updatedAt !== record.updatedAt || stored.record.value !== choice) {
      return { ok: false, error: "save-failed" };
    }
    return { ok: true, record };
  } catch {
    return { ok: false, error: "save-failed" };
  }
}

function acceptVerifiedConsent(): void {
  pageAnalyticsBlocked = false;
  blockedConsentStamp = null;
  saveError = null;
}

function rememberWithdrawalBlock(error: SaveError): void {
  pageAnalyticsBlocked = true;
  blockedConsentStamp = consentStamp();
  saveError = error;
}

function blockAfterUnverifiedFlag(error: SaveError): SaveResult {
  rememberWithdrawalBlock(error);
  publish();
  return { ok: false, error };
}

function reconcileMemoryBlock(): void {
  if (!pageAnalyticsBlocked || blockedConsentStamp === null) return;
  if (withdrawalBlockIsActive()) return;
  const stamp = consentStamp();
  if (stamp !== null && stamp !== blockedConsentStamp) {
    pageAnalyticsBlocked = false;
    blockedConsentStamp = null;
  }
}

function readStoredConsent(): ConsentParseResult {
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}

function encodeClientSnapshot(): string {
  const errorName = saveError ?? "";
  const memory = pageAnalyticsBlocked ? "1" : "0";
  const flag = withdrawalBlockIsActive() ? "1" : "0";
  try {
    const stored = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    if (!stored.ok) return `${errorName}|${memory}|${flag}|${stored.reason}`;
    return `${errorName}|${memory}|${flag}|${stored.record.value === "all" ? "analytics" : "essential"}`;
  } catch {
    return `${errorName}|${memory}|${flag}|unreadable`;
  }
}

function withdrawalBlockIsActive(): boolean {
  try {
    return window.localStorage.getItem(WITHDRAWAL_BLOCK_KEY) === "1";
  } catch {
    return true;
  }
}

function trySetWithdrawalFlag(): boolean {
  try {
    window.localStorage.setItem(WITHDRAWAL_BLOCK_KEY, "1");
    return window.localStorage.getItem(WITHDRAWAL_BLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function clearWithdrawalFlag(): boolean {
  try {
    window.localStorage.removeItem(WITHDRAWAL_BLOCK_KEY);
    return window.localStorage.getItem(WITHDRAWAL_BLOCK_KEY) !== "1";
  } catch {
    return false;
  }
}

function consentStamp(): string | null {
  try {
    const stored = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    if (!stored.ok) return null;
    return `${stored.record.value}|${stored.record.updatedAt}`;
  } catch {
    return null;
  }
}

function saveFailureName(value: string): SaveError | null {
  if (
    value === "save-failed" ||
    value === "save-incomplete" ||
    value === "withdraw-failed" ||
    value === "withdraw-unpersisted"
  ) {
    return value;
  }
  return null;
}

function publish(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

function clearAnalyticsIdentifiers(): void {
  try {
    window.localStorage.removeItem(ANALYTICS_VISITOR_ID_KEY);
  } catch {
    // The consent record is already essential. A stuck id is not a new grant.
  }
  try {
    window.sessionStorage.removeItem(ANALYTICS_SESSION_ID_KEY);
  } catch {
    // Same as above. Other session values are left untouched.
  }
}

function grantsAnalytics(record: ConsentRecord): boolean {
  return (
    record.version === CURRENT_CONSENT_VERSION &&
    record.value === "all" &&
    record.categories.essential === true &&
    record.categories.analytics === true &&
    isIsoTimestamp(record.updatedAt)
  );
}

function validRecord(record: Record<string, unknown>): ConsentRecord | null {
  if (record.version !== CURRENT_CONSENT_VERSION) return null;
  if (record.value !== "essential" && record.value !== "all") return null;
  if (!record.categories || typeof record.categories !== "object" || Array.isArray(record.categories)) {
    return null;
  }
  const categories = record.categories as Record<string, unknown>;
  if (categories.essential !== true) return null;
  if (typeof categories.analytics !== "boolean") return null;
  if (typeof record.updatedAt !== "string" || !isIsoTimestamp(record.updatedAt)) return null;
  if (record.value === "all" && categories.analytics !== true) return null;
  if (record.value === "essential" && categories.analytics !== false) return null;
  return {
    version: CURRENT_CONSENT_VERSION,
    value: record.value,
    categories: {
      essential: true,
      analytics: categories.analytics,
    },
    updatedAt: record.updatedAt,
  };
}
