export type AdminHealth =
  | {
      status: "ok";
      body: { ok: true; status: "ok"; service: "admin"; requestId: string };
    }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "unconfigured" };

export function adminApiBase() {
  return (process.env.NEXT_PUBLIC_ADMIN_API_BASE ?? "").trim().replace(/\/$/, "");
}

export function isAdminApiConfigured() {
  return adminApiBase().length > 0;
}

function healthUrl(base: string, accessToken: string) {
  const endpoint = new URL("health", `${base}/`);
  if (endpoint.search || endpoint.username || endpoint.password) return null;
  if (endpoint.href.includes(accessToken)) return null;
  return endpoint;
}

export async function fetchAdminHealth(accessToken: string): Promise<AdminHealth> {
  const base = adminApiBase();
  if (!base) return { status: "unconfigured" };
  if (!accessToken) return { status: "unauthorized" };
  const endpoint = healthUrl(base, accessToken);
  if (!endpoint) return { status: "unavailable" };

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (response.status === 401) return { status: "unauthorized" };
    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "unavailable" };
    const body: unknown = await response.json();
    if (!isHealthBody(body)) return { status: "unavailable" };
    return { status: "ok", body };
  } catch {
    return { status: "unavailable" };
  }
}

function isHealthBody(
  body: unknown,
): body is { ok: true; status: "ok"; service: "admin"; requestId: string } {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return (
    record.ok === true &&
    record.status === "ok" &&
    record.service === "admin" &&
    typeof record.requestId === "string"
  );
}

export const notificationStatuses = ["pending", "sending", "sent", "failed"] as const;
export const reviewStatuses = ["new", "reviewed", "closed"] as const;

export type NotificationStatus = (typeof notificationStatuses)[number];
export type ReviewStatus = (typeof reviewStatuses)[number];

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
};

export type EnquirySummary =
  | {
      status: "ok";
      total: number;
      byNotificationStatus: Record<NotificationStatus, number>;
    }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "unconfigured" };

export type EnquiryList =
  | { status: "ok"; items: Enquiry[]; cursor: string | null }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "unconfigured" };

export type EnquiryResult =
  | { status: "ok"; enquiry: Enquiry }
  | { status: "missing" }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "unconfigured" };

export async function fetchEnquirySummary(accessToken: string): Promise<EnquirySummary> {
  const result = await readJson(accessToken, "enquiries/summary", undefined, (body) => {
    if (!body || typeof body !== "object") return null;
    const record = body as Record<string, unknown>;
    const counts = record.byNotificationStatus;
    if (record.ok !== true || typeof record.total !== "number" || !counts || typeof counts !== "object") {
      return null;
    }
    const byNotificationStatus = counts as Record<string, unknown>;
    if (!notificationStatuses.every((status) => typeof byNotificationStatus[status] === "number")) {
      return null;
    }
    return {
      total: record.total,
      byNotificationStatus: byNotificationStatus as Record<NotificationStatus, number>,
    };
  });
  if (!result.ok) return { status: result.status === "missing" ? "unavailable" : result.status };
  return { status: "ok", ...result.value };
}

export async function fetchEnquiries(
  accessToken: string,
  query: { status: NotificationStatus; cursor?: string | null; q?: string },
): Promise<EnquiryList> {
  const parameters: Record<string, string> = { status: query.status };
  if (query.cursor) parameters.cursor = query.cursor;
  if (query.q) parameters.q = query.q;
  const result = await readJson(accessToken, "enquiries", parameters, (body) => {
    if (!body || typeof body !== "object") return null;
    const record = body as Record<string, unknown>;
    if (record.ok !== true || !Array.isArray(record.items)) return null;
    if (record.cursor !== null && typeof record.cursor !== "string") return null;
    const items = record.items.map(readEnquiry).filter((item): item is Enquiry => item !== null);
    if (items.length !== record.items.length) return null;
    return { items, cursor: record.cursor };
  });
  if (!result.ok) return { status: result.status === "missing" ? "unavailable" : result.status };
  return { status: "ok", ...result.value };
}

export async function fetchEnquiry(accessToken: string, id: string): Promise<EnquiryResult> {
  const result = await readJson(
    accessToken,
    `enquiries/${encodeURIComponent(id)}`,
    undefined,
    (body) => {
      if (!body || typeof body !== "object") return null;
      return readEnquiry((body as { enquiry?: unknown }).enquiry);
    },
    { notFound: true },
  );
  if (!result.ok) return { status: result.status };
  return { status: "ok", enquiry: result.value };
}

export async function updateEnquiryReview(
  accessToken: string,
  id: string,
  reviewStatus: ReviewStatus,
): Promise<EnquiryResult> {
  const result = await readJson(
    accessToken,
    `enquiries/${encodeURIComponent(id)}`,
    undefined,
    (body) => {
      if (!body || typeof body !== "object") return null;
      return readEnquiry((body as { enquiry?: unknown }).enquiry);
    },
    { method: "PATCH", body: { reviewStatus }, notFound: true },
  );
  if (!result.ok) return { status: result.status };
  return { status: "ok", enquiry: result.value };
}

type GatewayStatus = "unauthorized" | "forbidden" | "unavailable" | "unconfigured" | "missing";

async function readJson<T>(
  accessToken: string,
  path: string,
  query: Record<string, string> | undefined,
  parse: (body: unknown) => T | null,
  options?: { method?: "GET" | "PATCH"; body?: Record<string, string>; notFound?: boolean },
): Promise<{ ok: true; value: T } | { ok: false; status: GatewayStatus }> {
  const base = adminApiBase();
  if (!base) return { ok: false, status: "unconfigured" };
  if (!accessToken) return { ok: false, status: "unauthorized" };
  const endpoint = adminEndpoint(base, path, accessToken, query);
  if (!endpoint) return { ok: false, status: "unavailable" };
  try {
    const response = await fetch(endpoint, {
      method: options?.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
    if (response.status === 401) return { ok: false, status: "unauthorized" };
    if (response.status === 403) return { ok: false, status: "forbidden" };
    if (response.status === 404 && options?.notFound) return { ok: false, status: "missing" };
    if (!response.ok) return { ok: false, status: "unavailable" };
    const parsed = parse(await response.json());
    return parsed === null ? { ok: false, status: "unavailable" } : { ok: true, value: parsed };
  } catch {
    return { ok: false, status: "unavailable" };
  }
}

function adminEndpoint(
  base: string,
  path: string,
  accessToken: string,
  query?: Record<string, string>,
) {
  const endpoint = new URL(path, `${base}/`);
  for (const [key, value] of Object.entries(query ?? {})) endpoint.searchParams.set(key, value);
  if (endpoint.username || endpoint.password) return null;
  if (endpoint.href.includes(accessToken)) return null;
  return endpoint;
}

function readEnquiry(value: unknown): Enquiry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.submittedAt !== "string" ||
    typeof record.name !== "string" ||
    typeof record.organisation !== "string" ||
    typeof record.email !== "string" ||
    typeof record.enquiryType !== "string" ||
    typeof record.message !== "string" ||
    typeof record.messageTruncated !== "boolean" ||
    !notificationStatuses.includes(record.notificationStatus as NotificationStatus) ||
    !reviewStatuses.includes(record.reviewStatus as ReviewStatus) ||
    !(record.phone === null || typeof record.phone === "string")
  ) {
    return null;
  }
  return {
    id: record.id,
    submittedAt: record.submittedAt,
    name: record.name,
    organisation: record.organisation,
    email: record.email,
    phone: record.phone,
    enquiryType: record.enquiryType,
    message: record.message,
    messageTruncated: record.messageTruncated,
    notificationStatus: record.notificationStatus as NotificationStatus,
    reviewStatus: record.reviewStatus as ReviewStatus,
  };
}
