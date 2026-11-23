export const NOTIFICATION_STATUSES = ["pending", "sending", "sent", "failed"] as const;
export const REVIEW_STATUSES = ["new", "reviewed", "closed"] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type StoredEnquiry = {
  idempotencyKey: string;
  createdAt: string;
  notificationDueAt: string;
  name: string;
  organisation: string;
  email: string;
  phone: string | null;
  enquiryType: string;
  message: string;
  notificationStatus: NotificationStatus;
  reviewStatus?: string;
  notificationAttempts?: number;
  lastNotificationError?: string;
  notifiedAt?: string;
};

export type Enquiry = {
  id: string;
  submittedAt: string;
  name: string;
  organisation: string;
  email: string;
  phone: string | null;
  enquiryType: string;
  message: string;
  messageTruncated: boolean;
  notificationStatus: NotificationStatus;
  reviewStatus: ReviewStatus;
  notificationAttempts?: number;
  lastNotificationError?: string;
  notifiedAt?: string;
};

export type EnquiryQuery = {
  status: NotificationStatus;
  limit: number;
  cursor?: { notificationDueAt: string; idempotencyKey: string };
  q?: string;
  review?: ReviewStatus;
};

export type EnquiryPage = {
  items: StoredEnquiry[];
  cursor?: { notificationDueAt: string; idempotencyKey: string };
};

export interface EnquiryStore {
  count(status: NotificationStatus): Promise<number>;
  list(query: EnquiryQuery): Promise<EnquiryPage>;
  get(id: string): Promise<StoredEnquiry | null>;
  setReview(id: string, review: ReviewStatus, now: string): Promise<StoredEnquiry | null>;
}

const ID = /^[a-f0-9]{64}$/;
const SEARCH = /^[A-Za-z0-9 .@_'+\-]{1,80}$/;
const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const PREVIEW = 160;

export function isEnquiryId(value: string): boolean {
  return ID.test(value);
}

export function notificationStatus(value: string | undefined): NotificationStatus | null {
  return NOTIFICATION_STATUSES.find((status) => status === value) ?? null;
}

export function reviewStatus(value: string | undefined): ReviewStatus | null {
  return REVIEW_STATUSES.find((status) => status === value) ?? null;
}

export function parseEnquiryQuery(
  parameters: Record<string, string | undefined> | undefined,
): { query: EnquiryQuery } | { error: "invalid_status" | "invalid_cursor" | "invalid_search" | "invalid_review" } {
  const status = notificationStatus(parameters?.status);
  if (!status) return { error: "invalid_status" };
  const limit = parseLimit(parameters?.limit);
  const review = parameters?.review ? reviewStatus(parameters.review) : undefined;
  if (parameters?.review && !review) return { error: "invalid_review" };
  const q = parameters?.q?.trim();
  if (q && !SEARCH.test(q)) return { error: "invalid_search" };
  const cursor = parameters?.cursor ? decodeCursor(parameters.cursor, status) : undefined;
  if (parameters?.cursor && !cursor) return { error: "invalid_cursor" };
  return {
    query: {
      status,
      limit,
      ...(cursor ? { cursor } : {}),
      ...(q ? { q } : {}),
      ...(review ? { review } : {}),
    },
  };
}

export function encodeCursor(
  status: NotificationStatus,
  key: { notificationDueAt: string; idempotencyKey: string },
): string {
  return Buffer.from(
    JSON.stringify({ s: status, d: key.notificationDueAt, k: key.idempotencyKey }),
    "utf8",
  ).toString("base64url");
}

export function deliveryFields(source: {
  notificationAttempts?: unknown;
  lastNotificationError?: unknown;
  notifiedAt?: unknown;
}): Pick<Enquiry, "notificationAttempts" | "lastNotificationError" | "notifiedAt"> {
  const attempts = notificationAttempts(source.notificationAttempts);
  const error = notificationError(source.lastNotificationError);
  const sentAt = notificationTime(source.notifiedAt);
  return {
    ...(attempts === undefined ? {} : { notificationAttempts: attempts }),
    ...(error === undefined ? {} : { lastNotificationError: error }),
    ...(sentAt === undefined ? {} : { notifiedAt: sentAt }),
  };
}

export function toEnquiry(item: StoredEnquiry, preview: boolean): Enquiry {
  const message = preview ? item.message.slice(0, PREVIEW) : item.message;
  return {
    id: item.idempotencyKey,
    submittedAt: item.createdAt,
    name: item.name,
    organisation: item.organisation,
    email: item.email,
    phone: item.phone,
    enquiryType: item.enquiryType,
    message,
    messageTruncated: preview && item.message.length > PREVIEW,
    notificationStatus: item.notificationStatus,
    reviewStatus: normalReview(item.reviewStatus),
    ...deliveryFields(item),
  };
}

export function normalReview(value: string | undefined): ReviewStatus {
  return value === "reviewed" || value === "closed" ? value : "new";
}

function notificationAttempts(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 99) return undefined;
  return value;
}

function notificationError(value: unknown): string | undefined {
  if (typeof value !== "string" || !ERROR_NAME.test(value)) return undefined;
  return value;
}

function notificationTime(value: unknown): string | undefined {
  if (typeof value !== "string" || !TIMESTAMP.test(value)) return undefined;
  return value;
}

function parseLimit(value: string | undefined): number {
  if (!value) return 20;
  if (!/^\d{1,2}$/.test(value)) return 20;
  const parsed = Number(value);
  if (parsed < 1) return 20;
  return Math.min(parsed, 50);
}

function decodeCursor(
  value: string,
  status: NotificationStatus,
): { notificationDueAt: string; idempotencyKey: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (record.s !== status) return null;
    if (typeof record.d !== "string" || record.d.length < 20 || record.d.length > 40) return null;
    if (typeof record.k !== "string" || !isEnquiryId(record.k)) return null;
    return { notificationDueAt: record.d, idempotencyKey: record.k };
  } catch {
    return null;
  }
}
