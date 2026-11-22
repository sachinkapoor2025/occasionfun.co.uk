import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAdminHealth } from "../src/lib/admin/api";

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
