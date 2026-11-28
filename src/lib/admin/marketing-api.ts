export type CampaignSending = "blocked" | "restricted";

export type MarketingSettings = {
  configured: boolean;
  host: string | null;
  port: 465 | 587 | null;
  username: string | null;
  passwordSet: boolean;
  updatedAt: string | null;
};

export type MarketingSender = {
  id: string;
  fromName: string;
  fromEmail: string;
  smtpTestStatus: "untested" | "smtp-accepted";
  smtpAcceptedAt: string | null;
  updatedAt: string;
};

export type MarketingAudit = {
  at: string;
  action: string;
  outcome: "ok" | "failed";
  actorSub: string;
  target?: string;
};

export type MarketingOverview = {
  status: "ok";
  settings: MarketingSettings;
  senders: MarketingSender[];
  allowlist: { emails: string[]; campaignSending: CampaignSending };
  audit: MarketingAudit[];
};

export type MarketingResult = MarketingOverview | MarketingProblem;

export type MarketingProblem =
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "unconfigured" }
  | { status: "error"; error: string };

const ERRORS = [
  "invalid_body",
  "invalid_settings",
  "invalid_sender",
  "invalid_allowlist",
  "invalid_recipient",
  "smtp_unconfigured",
  "smtp_failed",
  "sender_not_found",
  "rate_limited",
  "invalid_contact",
  "invalid_campaign",
  "invalid_recipient",
  "invalid_schedule",
  "invalid_csv",
  "csv_too_large",
  "unsubscribed_locked",
  "campaign_locked",
  "duplicate_name",
  "smtp_failed",
  "smtp_unconfigured",
  "not_found",
  "invalid_tag",
  "invalid_segment",
  "invalid_action",
  "invalid_body",
  "invalid_criteria",
  "marketing_unavailable",
  "unavailable",
] as const;

function adminBase() {
  return (process.env.NEXT_PUBLIC_ADMIN_API_BASE ?? "").trim().replace(/\/$/, "");
}

function endpoint(base: string, path: string, accessToken: string) {
  const url = new URL(path, `${base}/`);
  if (url.username || url.password || url.href.includes(accessToken)) return null;
  return url;
}

function problem(status: number, body: unknown): MarketingProblem {
  if (status === 401) return { status: "unauthorized" };
  if (status === 403) return { status: "forbidden" };
  if (status === 429) return { status: "error", error: "rate_limited" };
  const error = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  if (typeof error === "string" && ERRORS.includes(error as (typeof ERRORS)[number])) {
    return { status: "error", error };
  }
  return { status: "unavailable" };
}

async function request(
  accessToken: string,
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<MarketingResult> {
  const base = adminBase();
  if (!base) return { status: "unconfigured" };
  if (!accessToken) return { status: "unauthorized" };
  const url = endpoint(base, path, accessToken);
  if (!url) return { status: "unavailable" };
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) return problem(response.status, payload);
    const overview = readOverview(payload);
    return overview ?? { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

function readOverview(body: unknown): MarketingOverview | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.ok !== true) return null;
  if ("password" in record) return null;
  const settings = readSettings(record.settings);
  const allowlist = readAllowlist(record.allowlist);
  if (!settings || !allowlist || !Array.isArray(record.senders) || !Array.isArray(record.audit)) return null;
  const senders = record.senders.map(readSender);
  const audit = record.audit.map(readAudit);
  if (senders.some((sender) => sender === null) || audit.some((entry) => entry === null)) return null;
  return {
    status: "ok",
    settings,
    senders: senders as MarketingSender[],
    allowlist,
    audit: audit as MarketingAudit[],
  };
}

function readSettings(value: unknown): MarketingSettings | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if ("password" in record || typeof record.configured !== "boolean" || typeof record.passwordSet !== "boolean") {
    return null;
  }
  if (record.port !== null && record.port !== 465 && record.port !== 587) return null;
  if (![record.host, record.username, record.updatedAt].every((item) => item === null || typeof item === "string")) {
    return null;
  }
  return {
    configured: record.configured,
    host: record.host as string | null,
    port: record.port,
    username: record.username as string | null,
    passwordSet: record.passwordSet,
    updatedAt: record.updatedAt as string | null,
  };
}

function readAllowlist(value: unknown): MarketingOverview["allowlist"] | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.emails) || record.emails.some((email) => typeof email !== "string")) return null;
  if (record.campaignSending !== "blocked" && record.campaignSending !== "restricted") return null;
  return { emails: record.emails, campaignSending: record.campaignSending };
}

function readSender(value: unknown): MarketingSender | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if ("verificationStatus" in record || "password" in record) return null;
  if (
    typeof record.id !== "string" ||
    typeof record.fromName !== "string" ||
    typeof record.fromEmail !== "string" ||
    (record.smtpTestStatus !== "untested" && record.smtpTestStatus !== "smtp-accepted") ||
    typeof record.updatedAt !== "string" ||
    !(record.smtpAcceptedAt === null || typeof record.smtpAcceptedAt === "string")
  ) {
    return null;
  }
  return {
    id: record.id,
    fromName: record.fromName,
    fromEmail: record.fromEmail,
    smtpTestStatus: record.smtpTestStatus,
    smtpAcceptedAt: record.smtpAcceptedAt,
    updatedAt: record.updatedAt,
  };
}

function readAudit(value: unknown): MarketingAudit | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.at !== "string" ||
    typeof record.action !== "string" ||
    (record.outcome !== "ok" && record.outcome !== "failed") ||
    typeof record.actorSub !== "string" ||
    !(record.target === undefined || typeof record.target === "string")
  ) {
    return null;
  }
  return {
    at: record.at,
    action: record.action,
    outcome: record.outcome,
    actorSub: record.actorSub,
    ...(typeof record.target === "string" ? { target: record.target } : {}),
  };
}

export function fetchMarketingSettings(accessToken: string) {
  return request(accessToken, "marketing/settings", "GET");
}

export function saveMarketingSettings(
  accessToken: string,
  input: { host: string; port: number; username: string; password?: string },
) {
  const body: Record<string, unknown> = { host: input.host, port: input.port, username: input.username };
  if (input.password) body.password = input.password;
  return request(accessToken, "marketing/settings", "POST", body);
}

export function testMarketingConnection(
  accessToken: string,
  input: { host: string; port: number; username: string; password?: string },
) {
  const body: Record<string, unknown> = { host: input.host, port: input.port, username: input.username };
  if (input.password) body.password = input.password;
  return request(accessToken, "marketing/settings/test-connection", "POST", body);
}

export function sendMarketingTestEmail(accessToken: string, input: { to: string; senderId: string }) {
  return request(accessToken, "marketing/settings/test-email", "POST", input);
}

export function saveMarketingSender(
  accessToken: string,
  input: { id?: string; fromName: string; fromEmail: string; remove?: boolean },
) {
  if (input.remove && input.id) {
    return request(accessToken, `marketing/senders/${encodeURIComponent(input.id)}`, "POST", { remove: true });
  }
  if (input.id) {
    return request(accessToken, `marketing/senders/${encodeURIComponent(input.id)}`, "POST", {
      fromName: input.fromName,
      fromEmail: input.fromEmail,
    });
  }
  return request(accessToken, "marketing/senders", "POST", {
    fromName: input.fromName,
    fromEmail: input.fromEmail,
  });
}

export function saveMarketingAllowlist(accessToken: string, emails: string[]) {
  return request(accessToken, "marketing/allowlist", "POST", { emails });
}

export type WorkspaceResult =
  | { status: "ok"; body: Record<string, unknown> }
  | MarketingProblem;

export async function marketingWorkspace(
  accessToken: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<WorkspaceResult> {
  const base = adminBase();
  if (!base) return { status: "unconfigured" };
  if (!accessToken) return { status: "unauthorized" };
  const url = endpoint(base, "marketing/workspace", accessToken);
  if (!url) return { status: "unavailable" };
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) return problem(response.status, payload);
    if (!payload || typeof payload !== "object" || (payload as { ok?: unknown }).ok !== true) return { status: "unavailable" };
    if ("password" in (payload as Record<string, unknown>)) return { status: "unavailable" };
    return { status: "ok", body: payload as Record<string, unknown> };
  } catch {
    return { status: "unavailable" };
  }
}
