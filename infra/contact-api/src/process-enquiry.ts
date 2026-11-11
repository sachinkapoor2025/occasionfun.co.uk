import { createHash, randomUUID } from "node:crypto";
import { company } from "../../../src/config/company";
import {
  contactFormSchema,
  formatZodErrors,
  type ContactFormInput,
} from "../../../src/lib/validation";

export const MAX_BODY_BYTES = 16_384;
/** Connection attempts inside one claimed invocation. */
export const SMTP_ATTEMPTS = 2;
/** Claimed delivery attempts across the API and the scheduled retry. */
export const MAX_NOTIFICATION_ATTEMPTS = 6;
/**
 * A sending lock older than this can be recovered. It is longer than the
 * API Lambda timeout so a live invocation is not treated as abandoned.
 */
export const LOCK_TIMEOUT_MS = 90_000;
export const RETENTION_SECONDS = 365 * 24 * 60 * 60;
const RETRY_DELAY_MS = 5 * 60 * 1000;

export type NotificationStatus = "pending" | "sending" | "sent" | "failed";

export type ContactHttpEvent = {
  body?: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
  requestContext?: {
    http?: { method?: string };
  };
};

export type LeadRecord = {
  idempotencyKey: string;
  leadId: string;
  createdAt: string;
  expiresAt: number;
  name: string;
  organisation: string;
  email: string;
  phone: string | null;
  enquiryType: string;
  message: string;
  consent: true;
  notificationStatus: NotificationStatus;
  notificationAttempts: number;
  notificationDueAt: string;
  sendingStartedAt?: string;
  sendingOwner?: string;
  lastNotificationError?: string;
};

export type ClaimResult =
  | { outcome: "claimed"; lead: LeadRecord }
  | { outcome: "busy"; lead: LeadRecord }
  | { outcome: "sent"; lead: LeadRecord }
  | { outcome: "failed"; lead: LeadRecord }
  | { outcome: "missing" };

export type LeadStore = {
  insert(lead: LeadRecord): Promise<"created" | "duplicate">;
  read(idempotencyKey: string): Promise<LeadRecord | null>;
  claim(
    idempotencyKey: string,
    owner: string,
    now: Date,
    options: { respectSchedule: boolean },
  ): Promise<ClaimResult>;
  markSent(idempotencyKey: string, owner: string): Promise<"updated" | "lost">;
  markPending(
    idempotencyKey: string,
    owner: string,
    errorName: string,
    dueAt: string,
  ): Promise<"updated" | "lost">;
  markFailed(
    idempotencyKey: string,
    owner: string,
    errorName: string,
  ): Promise<"updated" | "lost">;
  listDue(
    status: "pending" | "sending",
    dueBefore: string,
    limit: number,
  ): Promise<LeadRecord[]>;
};

export type EnquiryDeps = {
  store: LeadStore;
  sendMail(lead: LeadRecord): Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  newId?: () => string;
  newOwner?: () => string;
};

export type ApiResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

export type RetrySummary = {
  processed: number;
  sent: number;
  pending: number;
  skipped: number;
  failed: number;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

const savedMessage =
  "Thank you. Your enquiry has been received and will be reviewed.";
const pendingMessage =
  "Your enquiry was saved. The notification email is delayed and will be retried.";
const processingMessage =
  "Your enquiry was saved. Notification is already being processed.";
const failedMessage =
  "Your enquiry was saved, but notification delivery has failed and needs attention.";

/**
 * SMTP cannot guarantee exactly-once delivery. The sending lock stops a second
 * invocation from starting while the lock is current, and it stops a caller
 * that lost the lock from changing the row. It does not remove the window
 * where the mail server accepts the message and this process stops before
 * markSent records that fact. A later recovery can send the message again.
 */
function json(
  statusCode: number,
  body: {
    ok: boolean;
    saved: boolean;
    notification: NotificationStatus | "none";
    message: string;
    errors?: Record<string, string>;
  },
): ApiResult {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  };
}

function header(event: ContactHttpEvent, name: string): string | undefined {
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (key.toLowerCase() === name && typeof value === "string") return value;
  }
  return undefined;
}

export function enquiryDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function idempotencyKey(input: ContactFormInput, day: string): string {
  const stable = JSON.stringify({
    day,
    name: input.name,
    organisation: input.organisation,
    email: input.email.toLowerCase(),
    phone: input.phone ?? "",
    enquiryType: input.enquiryType,
    message: input.message,
  });
  return createHash("sha256").update(stable).digest("hex");
}

/** Days from LEAD_RETENTION_DAYS, or 365 when that setting is absent or invalid. */
export function retentionSeconds(): number {
  const configured = Number(process.env.LEAD_RETENTION_DAYS ?? "365");
  if (!Number.isInteger(configured) || configured < 1) return RETENTION_SECONDS;
  return configured * 24 * 60 * 60;
}

/** Epoch seconds for DynamoDB TTL. Deletion after this time is asynchronous. */
export function expiresAtEpoch(created: Date): number {
  return Math.floor(created.getTime() / 1000) + retentionSeconds();
}

export function enquirySubject(enquiryType: string, prefix?: string): string {
  const subject = `${company.legalName} enquiry: ${enquiryType.replace(/[\r\n]/g, " ")}`;
  const trimmed = (prefix ?? "").replace(/[\r\n]/g, "").trim();
  if (!trimmed) return subject;
  return `${trimmed} ${subject}`;
}

export function enquiryText(lead: LeadRecord): string {
  return [
    `Name: ${lead.name}`,
    `Organisation: ${lead.organisation}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone ?? "—"}`,
    `Type: ${lead.enquiryType}`,
    "",
    lead.message,
  ].join("\n");
}

function hasHeaderInjection(value: string): boolean {
  return /[\r\n]/.test(value);
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "Error";
}

async function notifyLead(
  deps: EnquiryDeps,
  now: Date,
  idempotencyKeyValue: string,
  respectSchedule: boolean,
): Promise<ApiResult> {
  const owner = (deps.newOwner ?? randomUUID)();
  let claim: ClaimResult;
  try {
    claim = await deps.store.claim(idempotencyKeyValue, owner, now, {
      respectSchedule,
    });
  } catch (error) {
    console.error("Lead claim failed", errorName(error));
    return json(503, {
      ok: false,
      saved: true,
      notification: "pending",
      message: pendingMessage,
    });
  }

  if (claim.outcome === "missing") {
    return json(503, {
      ok: false,
      saved: false,
      notification: "none",
      message: "The enquiry could not be saved. Please try again later.",
    });
  }
  if (claim.outcome === "sent") {
    return json(200, {
      ok: true,
      saved: true,
      notification: "sent",
      message: savedMessage,
    });
  }
  if (claim.outcome === "busy") {
    return json(202, {
      ok: true,
      saved: true,
      notification: "sending",
      message: processingMessage,
    });
  }
  if (claim.outcome === "failed") {
    return json(502, {
      ok: false,
      saved: true,
      notification: "failed",
      message: failedMessage,
    });
  }

  const lead = claim.lead;
  if (lead.notificationAttempts > MAX_NOTIFICATION_ATTEMPTS) {
    try {
      await deps.store.markFailed(lead.idempotencyKey, owner, "RetryLimitReached");
    } catch (error) {
      console.error("Lead failure state update failed", errorName(error));
    }
    return json(502, {
      ok: false,
      saved: true,
      notification: "failed",
      message: failedMessage,
    });
  }

  const sleep =
    deps.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let sent = false;
  let failure = "Error";
  for (let attempt = 1; attempt <= SMTP_ATTEMPTS; attempt += 1) {
    try {
      await deps.sendMail(lead);
      sent = true;
      break;
    } catch (error) {
      failure = errorName(error);
      console.error("SMTP notification failed", failure);
      if (attempt < SMTP_ATTEMPTS) await sleep(50 * attempt);
    }
  }

  if (!sent) {
    const dueAt = new Date(now.getTime() + RETRY_DELAY_MS).toISOString();
    try {
      const marked = await deps.store.markPending(
        lead.idempotencyKey,
        owner,
        failure,
        dueAt,
      );
      if (marked === "lost") {
        console.error("Lead pending update lost the sending lock");
      }
    } catch (error) {
      console.error("Lead pending update failed", errorName(error));
    }
    return json(502, {
      ok: false,
      saved: true,
      notification: "pending",
      message: pendingMessage,
    });
  }

  try {
    const marked = await deps.store.markSent(lead.idempotencyKey, owner);
    if (marked === "lost") {
      console.error("Lead sent update lost the sending lock");
      return json(502, {
        ok: false,
        saved: true,
        notification: "pending",
        message: pendingMessage,
      });
    }
  } catch (error) {
    console.error("Lead sent update failed", errorName(error));
    return json(502, {
      ok: false,
      saved: true,
      notification: "pending",
      message: pendingMessage,
    });
  }

  return json(200, {
    ok: true,
    saved: true,
    notification: "sent",
    message: savedMessage,
  });
}

export async function processEnquiry(
  event: ContactHttpEvent,
  deps: EnquiryDeps,
): Promise<ApiResult> {
  const method = event.requestContext?.http?.method?.toUpperCase();
  if (method !== "POST") {
    return json(405, {
      ok: false,
      saved: false,
      notification: "none",
      message: "Method not allowed.",
    });
  }

  if (event.isBase64Encoded) {
    return json(415, {
      ok: false,
      saved: false,
      notification: "none",
      message: "Content-Type must be application/json.",
    });
  }

  const contentType = header(event, "content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json(415, {
      ok: false,
      saved: false,
      notification: "none",
      message: "Content-Type must be application/json.",
    });
  }

  const declaredLength = Number(header(event, "content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(413, {
      ok: false,
      saved: false,
      notification: "none",
      message: "The enquiry is too large.",
    });
  }

  const raw = event.body ?? "";
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return json(413, {
      ok: false,
      saved: false,
      notification: "none",
      message: "The enquiry is too large.",
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return json(400, {
      ok: false,
      saved: false,
      notification: "none",
      message: "Invalid request body.",
    });
  }

  const parsed = contactFormSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, {
      ok: false,
      saved: false,
      notification: "none",
      message: "Please correct the highlighted fields.",
      errors: formatZodErrors(parsed.error),
    });
  }

  if (parsed.data.companyWebsite?.trim()) {
    return json(400, {
      ok: false,
      saved: false,
      notification: "none",
      message: "The enquiry could not be accepted.",
    });
  }

  if (
    hasHeaderInjection(parsed.data.name) ||
    hasHeaderInjection(parsed.data.email) ||
    hasHeaderInjection(parsed.data.organisation)
  ) {
    return json(400, {
      ok: false,
      saved: false,
      notification: "none",
      message: "Please correct the highlighted fields.",
    });
  }

  const now = (deps.now ?? (() => new Date()))();
  const createdAt = now.toISOString();
  const lead: LeadRecord = {
    idempotencyKey: idempotencyKey(parsed.data, enquiryDay(now)),
    leadId: (deps.newId ?? randomUUID)(),
    createdAt,
    expiresAt: expiresAtEpoch(now),
    name: parsed.data.name,
    organisation: parsed.data.organisation,
    email: parsed.data.email,
    phone: parsed.data.phone ? parsed.data.phone : null,
    enquiryType: parsed.data.enquiryType,
    message: parsed.data.message,
    consent: true,
    notificationStatus: "pending",
    notificationAttempts: 0,
    notificationDueAt: createdAt,
  };

  try {
    const inserted = await deps.store.insert(lead);
    if (inserted === "duplicate") {
      const existing = await deps.store.read(lead.idempotencyKey);
      if (!existing) {
        return json(503, {
          ok: false,
          saved: false,
          notification: "none",
          message: "The enquiry could not be saved. Please try again later.",
        });
      }
      if (existing.notificationStatus === "sent") {
        return json(200, {
          ok: true,
          saved: true,
          notification: "sent",
          message: savedMessage,
        });
      }
      if (existing.notificationStatus === "failed") {
        return json(502, {
          ok: false,
          saved: true,
          notification: "failed",
          message: failedMessage,
        });
      }
    }
  } catch (error) {
    console.error("Lead save failed", errorName(error));
    return json(503, {
      ok: false,
      saved: false,
      notification: "none",
      message: "The enquiry could not be saved. Please try again later.",
    });
  }

  return notifyLead(deps, now, lead.idempotencyKey, false);
}

export async function retryDueNotifications(
  deps: EnquiryDeps,
): Promise<RetrySummary> {
  const now = (deps.now ?? (() => new Date()))();
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS).toISOString();
  const summary: RetrySummary = {
    processed: 0,
    sent: 0,
    pending: 0,
    skipped: 0,
    failed: 0,
  };
  const pending = await deps.store.listDue("pending", now.toISOString(), 2);
  const abandoned = await deps.store.listDue(
    "sending",
    staleBefore,
    Math.max(0, 2 - pending.length),
  );
  const due = [...pending, ...abandoned];

  for (const lead of due) {
    summary.processed += 1;
    const result = await notifyLead(deps, now, lead.idempotencyKey, true);
    const body = JSON.parse(result.body) as { notification: string };
    if (body.notification === "sent") summary.sent += 1;
    else if (body.notification === "failed") summary.failed += 1;
    else if (body.notification === "sending") summary.skipped += 1;
    else summary.pending += 1;
  }

  return summary;
}
