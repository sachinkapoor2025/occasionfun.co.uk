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
