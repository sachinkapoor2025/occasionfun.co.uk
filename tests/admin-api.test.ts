import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAdminHealth,
  fetchAggregateSummary,
  fetchEnquiries,
  fetchEnquiry,
  updateEnquiryReview,
} from "../src/lib/admin/api";

const BASE = "https://0yjlr5feea.execute-api.eu-west-2.amazonaws.com";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_ADMIN_API_BASE;
});

describe("admin health client", () => {
  it("sends the access token on GET /health and keeps it out of the URL", async () => {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = `${BASE}/`;
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        status: "ok",
        service: "admin",
        requestId: "req-1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAdminHealth("access-token")).resolves.toEqual({
      status: "ok",
      body: { ok: true, status: "ok", service: "admin", requestId: "req-1" },
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe(`${BASE}/health`);
    expect(url.href).not.toContain("access-token");
    expect(url.search).toBe("");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer access-token",
    );
  });

  it("reports HTTP 401 and 403 without treating either as success", async () => {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = BASE;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAdminHealth("access-token")).resolves.toEqual({
      status: "unauthorized",
    });
    await expect(fetchAdminHealth("access-token")).resolves.toEqual({
      status: "forbidden",
    });
  });

  it("reports a network failure without throwing", async () => {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = BASE;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(fetchAdminHealth("access-token")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("does not call the API when the base URL is absent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAdminHealth("access-token")).resolves.toEqual({
      status: "unconfigured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const enquiry = {
  id: "a".repeat(64),
  submittedAt: "2026-11-23T09:00:00.000Z",
  name: "Ada Lovelace",
  organisation: "Analytical Engines",
  email: "ada@example.com",
  phone: null,
  enquiryType: "Wedding",
  message: "Hello",
  messageTruncated: false,
  notificationStatus: "pending",
  reviewStatus: "new",
};

describe("enquiry client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_ADMIN_API_BASE;
  });

  it("sends the access token on the enquiry list and keeps it out of the URL", async () => {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = BASE;
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: true, items: [enquiry], cursor: "next-page", requestId: "req-1" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchEnquiries("access-token", { status: "pending", cursor: "next-page", q: "Ada" }),
    ).resolves.toMatchObject({ status: "ok", cursor: "next-page" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/enquiries");
    expect(url.searchParams.get("status")).toBe("pending");
    expect(url.searchParams.get("cursor")).toBe("next-page");
    expect(url.searchParams.get("q")).toBe("Ada");
    expect(url.href).not.toContain("access-token");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("rejects a non-admin list response", async () => {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = BASE;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 403 })));
    await expect(fetchEnquiries("access-token", { status: "pending" })).resolves.toEqual({
      status: "forbidden",
    });
  });

  it("patches review status with the access token", async () => {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = BASE;
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: true, enquiry: { ...enquiry, reviewStatus: "reviewed" }, requestId: "req-1" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateEnquiryReview("access-token", enquiry.id, "reviewed")).resolves.toMatchObject({
      status: "ok",
      enquiry: { reviewStatus: "reviewed" },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe(`/enquiries/${enquiry.id}`);
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ reviewStatus: "reviewed" }));
    expect(url.href).not.toContain("access-token");
  });

  it("reads delivery fields and ignores a sending lock or secret", async () => {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = BASE;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          enquiry: {
            ...enquiry,
            notificationStatus: "sent",
            notificationAttempts: 2,
            lastNotificationError: "SmtpTimeout",
            notifiedAt: "2026-11-23T09:05:00.000Z",
            sendingOwner: "lock-token",
            password: "secret-value",
          },
          requestId: "req-1",
        }),
      ),
    );

    const result = await fetchEnquiry("access-token", enquiry.id);
    expect(result).toMatchObject({
      status: "ok",
      enquiry: {
        notificationAttempts: 2,
        lastNotificationError: "SmtpTimeout",
        notifiedAt: "2026-11-23T09:05:00.000Z",
      },
    });
    expect(result.status === "ok" && result.enquiry).not.toHaveProperty("sendingOwner");
    expect(result.status === "ok" && result.enquiry).not.toHaveProperty("password");
  });

  it("keeps an enquiry when optional delivery fields are absent or unsafe", async () => {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = BASE;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          items: [{ ...enquiry, lastNotificationError: "password=hidden", notificationAttempts: 1.2 }],
          cursor: null,
          requestId: "req-1",
        }),
      ),
    );

    const result = await fetchEnquiries("access-token", { status: "pending" });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.items[0]?.name).toBe("Ada Lovelace");
    expect(result.items[0]).not.toHaveProperty("lastNotificationError");
    expect(result.items[0]).not.toHaveProperty("notificationAttempts");
  });
});

describe("aggregate summary client", () => {
  const summary = {
    ok: true,
    requestId: "req-1",
    period: { start: "2026-11-24", end: "2026-11-24", timeZone: "Europe/London" },
    pageViews: 2,
    visits: 1,
    daily: [{ date: "2026-11-24", pageViews: 2, visits: 1, partial: false }],
    countries: [{ country: "GB", pageViews: 2, visits: 1 }],
    countriesOther: { pageViews: 0, visits: 0 },
    paths: [{ name: "/contact", count: 2 }],
    pathsOther: 0,
    sources: { direct: 0, internal: 0, search: 2, social: 0, referral: 0, campaign: 0 },
    devices: { desktop: 0, mobile: 2, tablet: 0, other: 0 },
    browsers: { chrome: 0, safari: 2, firefox: 0, edge: 0, other: 0 },
    partialDates: [],
    visitorId: "11111111-1111-4111-8111-111111111111",
  };

  it("requests the admin summary with the date range and drops identifier fields", async () => {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = BASE;
    const fetchMock = vi.fn(async () => Response.json(summary));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchAggregateSummary("access-token", { start: "2026-11-24", end: "2026-11-24" });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.report.pageViews).toBe(2);
    expect(result.report.visits).toBe(1);
    expect(result.report).not.toHaveProperty("visitorId");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/analytics/summary");
    expect(url.searchParams.get("start")).toBe("2026-11-24");
    expect(url.searchParams.get("end")).toBe("2026-11-24");
    expect(url.href).not.toContain("access-token");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("reports HTTP 401 and 403 for the summary", async () => {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = BASE;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(fetchAggregateSummary("access-token", { start: "2026-11-24", end: "2026-11-24" })).resolves.toEqual({
      status: "unauthorized",
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 403 })));
    await expect(fetchAggregateSummary("access-token", { start: "2026-11-24", end: "2026-11-24" })).resolves.toEqual({
      status: "forbidden",
    });
  });

  it("keeps an API date rejection instead of treating it as a loaded report", async () => {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = BASE;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: false, error: "too_long", requestId: "req-1" }, { status: 400 })),
    );
    await expect(fetchAggregateSummary("access-token", { start: "2026-08-26", end: "2026-11-24" })).resolves.toEqual({
      status: "invalid_range",
      reason: "too_long",
    });
  });
});
