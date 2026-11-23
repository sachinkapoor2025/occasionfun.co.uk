import { describe, expect, it, vi } from "vitest";
import { enquiryStore } from "../src/enquiry-dynamo";
import { type StoredEnquiry } from "../src/enquiries";
import { api } from "../src/routes";

const ID = "a".repeat(64);
const NEXT = "b".repeat(64);

function lead(overrides: Partial<StoredEnquiry> = {}): StoredEnquiry {
  return {
    idempotencyKey: ID,
    createdAt: "2026-11-23T09:00:00.000Z",
    notificationDueAt: "2026-11-23T09:00:00.000Z",
    name: "Ada Lovelace",
    organisation: "Analytical Engines",
    email: "ada@example.com",
    phone: null,
    enquiryType: "Wedding",
    message: `${"Please plan a celebration. ".repeat(12)}The full text stays on the detail view.`,
    notificationStatus: "pending",
    ...overrides,
  };
}

function adminEvent(routeKey: string, extra: Record<string, unknown> = {}) {
  return {
    routeKey,
    requestContext: {
      requestId: "req-enquiry",
      authorizer: { lambda: { hasAdmin: "true" } },
    },
    ...extra,
  };
}

function configured() {
  vi.stubEnv("ENVIRONMENT", "demo");
  vi.stubEnv("COGNITO_REGION", "eu-west-2");
  vi.stubEnv("COGNITO_USER_POOL_ID", "eu-west-2_demoPool");
  vi.stubEnv("COGNITO_CLIENT_ID", "democlient");
}

describe("enquiry routes", () => {
  it("lists a page for an admin and returns the DynamoDB continuation key", async () => {
    configured();
    const first = lead();
    const second = lead({ idempotencyKey: NEXT, name: "Grace Hopper" });
    const seen: unknown[] = [];
    const result = await api(adminEvent("GET /enquiries", { queryStringParameters: { status: "pending", limit: "1" } }), {
      count: async () => 0,
      list: async (query) => {
        seen.push(query);
        return { items: [first], cursor: { notificationDueAt: first.notificationDueAt, idempotencyKey: first.idempotencyKey } };
      },
      get: async () => null,
      setReview: async () => null,
    });
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Ada Lovelace");
    expect(body.items[0].messageTruncated).toBe(true);
    expect(body.items[0].reviewStatus).toBe("new");
    expect(body.cursor).toEqual(expect.any(String));
    expect(seen[0]).toMatchObject({ status: "pending", limit: 1 });

    const next = await api(
      adminEvent("GET /enquiries", { queryStringParameters: { status: "pending", cursor: body.cursor } }),
      {
        count: async () => 0,
        list: async (query) => {
          expect(query.cursor).toEqual({
            notificationDueAt: first.notificationDueAt,
            idempotencyKey: first.idempotencyKey,
          });
          return { items: [second] };
        },
        get: async () => null,
        setReview: async () => null,
      },
    );
    expect(JSON.parse(next.body).items[0].name).toBe("Grace Hopper");
    expect(JSON.parse(next.body).cursor).toBeNull();
  });

  it("returns an empty page without inventing enquiries", async () => {
    configured();
    const result = await api(adminEvent("GET /enquiries", { queryStringParameters: { status: "sent" } }), {
      count: async () => 0,
      list: async () => ({ items: [] }),
      get: async () => null,
      setReview: async () => null,
    });
    expect(JSON.parse(result.body)).toMatchObject({ ok: true, items: [], cursor: null });
  });

  it("rejects a non-admin before reading enquiries", async () => {
    configured();
    const result = await api(
      {
        routeKey: "GET /enquiries",
        queryStringParameters: { status: "pending" },
        requestContext: {
          requestId: "req-group",
          authorizer: { lambda: { hasAdmin: "false" } },
        },
      },
      {
        count: async () => {
          throw new Error("store was called");
        },
        list: async () => {
          throw new Error("store was called");
        },
        get: async () => {
          throw new Error("store was called");
        },
        setReview: async () => {
          throw new Error("store was called");
        },
      },
    );
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).error).toBe("forbidden");
  });

  it("rejects a missing authoriser context", async () => {
    configured();
    const result = await api({
      routeKey: "GET /enquiries",
      queryStringParameters: { status: "pending" },
      requestContext: { requestId: "req-open" },
    });
    expect(result.statusCode).toBe(401);
  });

  it("returns one enquiry with its full message", async () => {
    configured();
    const result = await api(
      adminEvent("GET /enquiries/{idempotencyKey}", { pathParameters: { idempotencyKey: ID } }),
      {
        count: async () => 0,
        list: async () => ({ items: [] }),
        get: async () => lead({ reviewStatus: "reviewed" }),
        setReview: async () => null,
      },
    );
    const body = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(body.enquiry.id).toBe(ID);
    expect(body.enquiry.messageTruncated).toBe(false);
    expect(body.enquiry.reviewStatus).toBe("reviewed");
    expect(body.enquiry.message).toContain("The full text stays on the detail view.");
    expect(body.enquiry).not.toHaveProperty("notificationAttempts");
    expect(body.enquiry).not.toHaveProperty("lastNotificationError");
    expect(body.enquiry).not.toHaveProperty("notifiedAt");
    expect(body.enquiry).not.toHaveProperty("sendingOwner");
  });

  it("returns stored delivery fields without the sending lock", async () => {
    configured();
    const result = await api(
      adminEvent("GET /enquiries/{idempotencyKey}", { pathParameters: { idempotencyKey: ID } }),
      {
        count: async () => 0,
        list: async () => ({ items: [] }),
        get: async () =>
          lead({
            notificationStatus: "failed",
            notificationAttempts: 6,
            lastNotificationError: "RetryLimitReached",
            notifiedAt: "2026-11-23T09:05:00.000Z",
          }),
        setReview: async () => null,
      },
    );
    const enquiry = JSON.parse(result.body).enquiry;
    expect(result.statusCode).toBe(200);
    expect(enquiry.notificationAttempts).toBe(6);
    expect(enquiry.lastNotificationError).toBe("RetryLimitReached");
    expect(enquiry.notifiedAt).toBe("2026-11-23T09:05:00.000Z");
    expect(enquiry.notificationStatus).toBe("failed");
    expect(enquiry).not.toHaveProperty("sendingOwner");
    expect(JSON.stringify(enquiry)).not.toMatch(/password|secret|smtp/i);
  });

  it("omits unsafe delivery values from the response", async () => {
    configured();
    const result = await api(
      adminEvent("GET /enquiries", { queryStringParameters: { status: "pending" } }),
      {
        count: async () => 0,
        list: async () => ({
          items: [
            lead({
              notificationAttempts: -1,
              lastNotificationError: "password=hidden",
              notifiedAt: "yesterday",
            }),
          ],
        }),
        get: async () => null,
        setReview: async () => null,
      },
    );
    const enquiry = JSON.parse(result.body).items[0];
    expect(enquiry.name).toBe("Ada Lovelace");
    expect(enquiry).not.toHaveProperty("notificationAttempts");
    expect(enquiry).not.toHaveProperty("lastNotificationError");
    expect(enquiry).not.toHaveProperty("notifiedAt");
    expect(JSON.stringify(enquiry)).not.toContain("password");
  });

  it("rejects a non-admin detail request before reading the enquiry", async () => {
    configured();
    const result = await api(
      {
        routeKey: "GET /enquiries/{idempotencyKey}",
        pathParameters: { idempotencyKey: ID },
        requestContext: {
          requestId: "req-detail",
          authorizer: { lambda: { hasAdmin: "false" } },
        },
      },
      {
        count: async () => {
          throw new Error("store was called");
        },
        list: async () => {
          throw new Error("store was called");
        },
        get: async () => {
          throw new Error("store was called");
        },
        setReview: async () => {
          throw new Error("store was called");
        },
      },
    );
    expect(result.statusCode).toBe(403);
  });

  it("reports a missing enquiry", async () => {
    configured();
    const result = await api(
      adminEvent("GET /enquiries/{idempotencyKey}", { pathParameters: { idempotencyKey: ID } }),
      {
        count: async () => 0,
        list: async () => ({ items: [] }),
        get: async () => null,
        setReview: async () => null,
      },
    );
    expect(result.statusCode).toBe(404);
  });

  it("updates review status without changing the notification status", async () => {
    configured();
    const stored = lead();
    const result = await api(
      adminEvent("PATCH /enquiries/{idempotencyKey}", {
        pathParameters: { idempotencyKey: ID },
        body: JSON.stringify({ reviewStatus: "closed" }),
      }),
      {
        count: async () => 0,
        list: async () => ({ items: [] }),
        get: async () => stored,
        setReview: async (id, review) => {
          expect(id).toBe(ID);
          expect(review).toBe("closed");
          return { ...stored, reviewStatus: review, notificationStatus: stored.notificationStatus };
        },
      },
    );
    const body = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(body.enquiry.reviewStatus).toBe("closed");
    expect(body.enquiry.notificationStatus).toBe("pending");
  });

  it("does not treat the Lambda context as an enquiry store", async () => {
    configured();
    vi.stubEnv("LEADS_TABLE_NAME", "");
    const lambdaContext = {
      functionName: "occasionfun-co-uk-demo-admin-api",
      awsRequestId: "lambda-request",
      callbackWaitsForEmptyEventLoop: true,
      getRemainingTimeInMillis: () => 30000,
    };

    const health = await api(adminEvent("GET /health"), lambdaContext);
    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body).status).toBe("ok");

    const summary = await api(adminEvent("GET /enquiries/summary"), lambdaContext);
    const list = await api(
      adminEvent("GET /enquiries", { queryStringParameters: { status: "pending" } }),
      lambdaContext,
    );
    expect(summary.statusCode).toBe(503);
    expect(JSON.parse(summary.body).error).toBe("enquiry_unavailable");
    expect(list.statusCode).toBe(503);
    expect(JSON.parse(list.body).error).toBe("enquiry_unavailable");

    const denied = await api(
      {
        routeKey: "GET /enquiries/summary",
        requestContext: {
          requestId: "req-context",
          authorizer: { lambda: { hasAdmin: "false" } },
        },
      },
      lambdaContext,
    );
    expect(denied.statusCode).toBe(403);
    expect(JSON.parse(denied.body).error).toBe("forbidden");
  });

  it("counts real notification statuses for the dashboard", async () => {
    configured();
    const result = await api(adminEvent("GET /enquiries/summary"), {
      count: async (status) => ({ pending: 2, sending: 0, sent: 5, failed: 1 })[status],
      list: async () => ({ items: [] }),
      get: async () => null,
      setReview: async () => null,
    });
    expect(JSON.parse(result.body)).toMatchObject({
      ok: true,
      total: 8,
      byNotificationStatus: { pending: 2, sending: 0, sent: 5, failed: 1 },
    });
  });
});

describe("enquiry DynamoDB access", () => {
  it("queries the notification index and never scans", async () => {
    const input: Record<string, unknown>[] = [];
    const store = enquiryStore("occasionfun-co-uk-leads", {
      query: async (value) => {
        input.push(value);
        return {
          Items: [lead() as unknown as Record<string, unknown>],
          LastEvaluatedKey: {
            notificationStatus: "pending",
            notificationDueAt: lead().notificationDueAt,
            idempotencyKey: ID,
          },
        };
      },
      get: async () => ({ Item: undefined }),
      update: async () => ({ Attributes: undefined }),
    });
    const page = await store.list({
      status: "pending",
      limit: 20,
      q: "ada@example.com",
      review: "new",
    });
    expect(input[0]).toMatchObject({
      TableName: "occasionfun-co-uk-leads",
      IndexName: "notification-due",
      KeyConditionExpression: "#status = :status",
      ScanIndexForward: false,
      Limit: 20,
    });
    expect(input[0]).not.toHaveProperty("Scan");
    expect(page.cursor?.idempotencyKey).toBe(ID);
    expect(page.items[0]?.email).toBe("ada@example.com");
  });

  it("sets only the review attributes", async () => {
    let input: Record<string, unknown> = {};
    const store = enquiryStore("occasionfun-co-uk-leads", {
      query: async () => ({}),
      get: async () => ({ Item: undefined }),
      update: async (value) => {
        input = value;
        return { Attributes: { ...lead(), reviewStatus: "reviewed" } as unknown as Record<string, unknown> };
      },
    });
    const updated = await store.setReview(ID, "reviewed", "2026-11-23T10:00:00.000Z");
    expect(input.UpdateExpression).toBe("SET reviewStatus = :review, reviewUpdatedAt = :now");
    expect(String(input.UpdateExpression)).not.toContain("notificationStatus");
    expect(updated?.reviewStatus).toBe("reviewed");
    expect(updated?.notificationStatus).toBe("pending");
  });

  it("keeps delivery facts and drops the sending lock and secrets", async () => {
    const store = enquiryStore("occasionfun-co-uk-leads", {
      query: async () => ({}),
      get: async () => ({
        Item: {
          ...(lead() as unknown as Record<string, unknown>),
          sendingOwner: "lock-token",
          password: "secret-value",
          notificationAttempts: 3,
          lastNotificationError: "SmtpTimeout",
          notifiedAt: "2026-11-23T09:05:00.000Z",
        },
      }),
      update: async () => ({ Attributes: undefined }),
    });
    const found = await store.get(ID);
    expect(found?.notificationAttempts).toBe(3);
    expect(found?.lastNotificationError).toBe("SmtpTimeout");
    expect(found?.notifiedAt).toBe("2026-11-23T09:05:00.000Z");
    expect(found).not.toHaveProperty("sendingOwner");
    expect(found).not.toHaveProperty("password");
    expect(JSON.stringify(found)).not.toContain("lock-token");
    expect(JSON.stringify(found)).not.toContain("secret-value");
  });

  it("omits missing or unsafe delivery fields", async () => {
    const store = enquiryStore("occasionfun-co-uk-leads", {
      query: async () => ({}),
      get: async () => ({
        Item: {
          ...(lead() as unknown as Record<string, unknown>),
          notificationAttempts: 1.5,
          lastNotificationError: "password=hidden",
          notifiedAt: "not-a-time",
        },
      }),
      update: async () => ({ Attributes: undefined }),
    });
    const found = await store.get(ID);
    expect(found).not.toHaveProperty("notificationAttempts");
    expect(found).not.toHaveProperty("lastNotificationError");
    expect(found).not.toHaveProperty("notifiedAt");
    expect(JSON.stringify(found)).not.toContain("password");
  });
});
