import { FetchError, NonRetryableFetchError } from "aws-jwt-verify/error";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizer, authorizerResponse } from "../src/authorizer";
import { decide, resetVerifierCache } from "../src/authorize";
import { readAuthConfig } from "../src/config";
import {
  DEMO_CLIENT,
  DEMO_POOL,
  PROD_CLIENT,
  PROD_POOL,
  authConfig,
  signToken,
  tokenFixture,
} from "./tokens";

const demo = authConfig();
const issuer = demo.issuer;

afterEach(() => {
  resetVerifierCache();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("access-token authorisation", () => {
  it("allows an access token whose groups contain admin", async () => {
    const keys = await tokenFixture();
    const token = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["admin"] },
      { issuer },
    );
    const decision = await decide(`Bearer ${token}`, demo, keys.fetcher);
    expect(decision).toEqual({
      outcome: "allow",
      sub: "11111111-2222-4333-8444-555555555555",
    });
    expect(authorizerResponse(decision)).toEqual({
      isAuthorized: true,
      context: { sub: "11111111-2222-4333-8444-555555555555", hasAdmin: "true" },
    });
  });

  it("rejects an invalid signature", async () => {
    const keys = await tokenFixture();
    const token = await signToken(
      keys.otherPrivateKey,
      { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["admin"] },
      { issuer },
    );
    await expect(decide(`Bearer ${token}`, demo, keys.fetcher)).resolves.toEqual({
      outcome: "unauthorized",
      reason: "invalid_token",
      errorName: "JwtInvalidSignatureError",
    });
  });

  it("rejects a token from another issuer", async () => {
    const keys = await tokenFixture();
    const token = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["admin"] },
      { issuer: `https://cognito-idp.eu-west-2.amazonaws.com/${PROD_POOL}` },
    );
    await expect(decide(`Bearer ${token}`, demo, keys.fetcher)).resolves.toEqual({
      outcome: "unauthorized",
      reason: "invalid_token",
      errorName: "ParameterValidationError",
    });
  });

  it("rejects a token for another app client", async () => {
    const keys = await tokenFixture();
    const token = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: "anotherclient", "cognito:groups": ["admin"] },
      { issuer },
    );
    await expect(decide(`Bearer ${token}`, demo, keys.fetcher)).resolves.toEqual({
      outcome: "unauthorized",
      reason: "invalid_token",
      errorName: "CognitoJwtInvalidClientIdError",
    });
  });

  it("rejects an ID token", async () => {
    const keys = await tokenFixture();
    const token = await signToken(
      keys.privateKey,
      { token_use: "id", aud: DEMO_CLIENT, "cognito:groups": ["admin"] },
      { issuer },
    );
    await expect(decide(`Bearer ${token}`, demo, keys.fetcher)).resolves.toEqual({
      outcome: "unauthorized",
      reason: "invalid_token",
      errorName: "CognitoJwtInvalidTokenUseError",
    });
  });

  it("rejects an expired access token", async () => {
    const keys = await tokenFixture();
    const token = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["admin"] },
      { issuer, expiresIn: "-2m" },
    );
    await expect(decide(`Bearer ${token}`, demo, keys.fetcher)).resolves.toEqual({
      outcome: "unauthorized",
      reason: "invalid_token",
      errorName: "JwtExpiredError",
    });
  });

  it("forbids a valid access token without the admin group", async () => {
    const keys = await tokenFixture();
    const token = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["readers"] },
      { issuer },
    );
    const decision = await decide(`Bearer ${token}`, demo, keys.fetcher);
    expect(decision).toEqual({ outcome: "forbidden", reason: "missing_admin_group" });
    expect(authorizerResponse(decision)).toEqual({ isAuthorized: false });
  });

  it("rejects a token issued for the other environment", async () => {
    const keys = await tokenFixture();
    const production = authConfig(PROD_POOL, PROD_CLIENT, "prod");
    const token = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: PROD_CLIENT, "cognito:groups": ["admin"] },
      { issuer: production.issuer },
    );
    await expect(decide(`Bearer ${token}`, demo, keys.fetcher)).resolves.toEqual({
      outcome: "unauthorized",
      reason: "invalid_token",
      errorName: "ParameterValidationError",
    });
    await expect(decide(`Bearer ${token}`, production, keys.fetcher)).resolves.toEqual({
      outcome: "allow",
      sub: "11111111-2222-4333-8444-555555555555",
    });
  });

  it.each([
    undefined,
    "",
    "Bearer",
    "Bearer ",
    "Basic abc.def.ghi",
    "Bearer not-a-jwt",
    "Bearer a.b",
    "Bearer a.b.c extra",
  ])("rejects a missing or malformed Authorization header: %s", async (header) => {
    const keys = await tokenFixture();
    const decision = await decide(header, demo, keys.fetcher);
    expect(decision.outcome).toBe("unauthorized");
    if (header === undefined) expect(decision).toMatchObject({ reason: "missing_token" });
    else expect(decision).toMatchObject({ reason: "malformed_token" });
  });

  it("does not log the bearer token", async () => {
    const token = "header.payload.signaturevalue";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubEnv("ENVIRONMENT", "demo");
    vi.stubEnv("COGNITO_REGION", "eu-west-2");
    vi.stubEnv("COGNITO_USER_POOL_ID", DEMO_POOL);
    vi.stubEnv("COGNITO_CLIENT_ID", DEMO_CLIENT);
    await authorizer({
      headers: { authorization: token },
      requestContext: { requestId: "req-1" },
    });
    const logged = info.mock.calls.flat().join(" ");
    expect(logged).not.toContain(token);
    expect(logged).toContain("malformed_token");
    expect(logged).toContain("req-1");
  });

  it("logs the verifier error name without the token or error message", async () => {
    const keys = await tokenFixture();
    vi.stubEnv("ENVIRONMENT", "demo");
    vi.stubEnv("COGNITO_REGION", "eu-west-2");
    vi.stubEnv("COGNITO_USER_POOL_ID", DEMO_POOL);
    vi.stubEnv("COGNITO_CLIENT_ID", DEMO_CLIENT);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const cases = [
      {
        claims: { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["admin"] },
        options: { issuer },
        key: keys.otherPrivateKey,
        errorName: "JwtInvalidSignatureError",
        hidden: "Invalid signature",
      },
      {
        claims: { token_use: "access", client_id: "anotherclient", "cognito:groups": ["admin"] },
        options: { issuer },
        key: keys.privateKey,
        errorName: "CognitoJwtInvalidClientIdError",
        hidden: "anotherclient",
      },
      {
        claims: { token_use: "id", aud: DEMO_CLIENT, "cognito:groups": ["admin"] },
        options: { issuer },
        key: keys.privateKey,
        errorName: "CognitoJwtInvalidTokenUseError",
        hidden: "Token use",
      },
      {
        claims: { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["admin"] },
        options: { issuer, expiresIn: "-2m" },
        key: keys.privateKey,
        errorName: "JwtExpiredError",
        hidden: "Token expired",
      },
    ] as const;

    for (const [index, item] of cases.entries()) {
      const token = await signToken(item.key, item.claims, item.options);
      const result = await authorizer(
        {
          headers: { authorization: `Bearer ${token}` },
          requestContext: { requestId: `req-name-${index}` },
        },
        keys.fetcher,
      );
      expect(result).toEqual({ errorMessage: "Unauthorized" });
      const logged = String(info.mock.calls.at(-1)?.[0]);
      expect(JSON.parse(logged)).toEqual({
        requestId: `req-name-${index}`,
        route: "authorizer",
        status: 401,
        error: "invalid_token",
        errorName: item.errorName,
      });
      expect(logged).not.toContain(token);
      expect(logged).not.toContain(item.hidden);
    }
  });

  it("keeps a missing admin group at 403 without a verifier error name", async () => {
    const keys = await tokenFixture();
    vi.stubEnv("ENVIRONMENT", "demo");
    vi.stubEnv("COGNITO_REGION", "eu-west-2");
    vi.stubEnv("COGNITO_USER_POOL_ID", DEMO_POOL);
    vi.stubEnv("COGNITO_CLIENT_ID", DEMO_CLIENT);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const token = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["readers"] },
      { issuer },
    );
    await expect(
      authorizer(
        {
          headers: { authorization: `Bearer ${token}` },
          requestContext: { requestId: "req-group" },
        },
        keys.fetcher,
      ),
    ).resolves.toEqual({ isAuthorized: false });
    const logged = String(info.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toEqual({
      requestId: "req-group",
      route: "authorizer",
      status: 403,
      error: "missing_admin_group",
    });
    expect(logged).not.toContain(token);
    expect(logged).not.toContain("errorName");
  });

  it("logs a successful admin decision without an error name", async () => {
    const keys = await tokenFixture();
    vi.stubEnv("ENVIRONMENT", "demo");
    vi.stubEnv("COGNITO_REGION", "eu-west-2");
    vi.stubEnv("COGNITO_USER_POOL_ID", DEMO_POOL);
    vi.stubEnv("COGNITO_CLIENT_ID", DEMO_CLIENT);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const token = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["admin"] },
      { issuer },
    );
    await expect(
      authorizer(
        {
          headers: { authorization: `Bearer ${token}` },
          requestContext: { requestId: "req-allow" },
        },
        keys.fetcher,
      ),
    ).resolves.toEqual({
      isAuthorized: true,
      context: { sub: "11111111-2222-4333-8444-555555555555", hasAdmin: "true" },
    });
    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toEqual({
      requestId: "req-allow",
      route: "authorizer",
      status: 200,
    });
  });

  it("classifies JWKS fetch failures as unavailable and omits the fetch error text", async () => {
    const keys = await tokenFixture();
    vi.stubEnv("ENVIRONMENT", "demo");
    vi.stubEnv("COGNITO_REGION", "eu-west-2");
    vi.stubEnv("COGNITO_USER_POOL_ID", DEMO_POOL);
    vi.stubEnv("COGNITO_CLIENT_ID", DEMO_CLIENT);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const token = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["admin"] },
      { issuer },
    );
    const secret = "jwks-fetch-secret-value";
    const failures = [
      new FetchError("https://cognito.example/secret-jwks.json", secret),
      new NonRetryableFetchError("https://cognito.example/secret-jwks.json", "status 500"),
    ];
    for (const [index, failure] of failures.entries()) {
      const result = await authorizer(
        {
          headers: { authorization: `Bearer ${token}` },
          requestContext: { requestId: `req-jwks-${index}` },
        },
        {
          async fetch() {
            throw failure;
          },
        },
      );
      expect(result).toEqual({ errorMessage: "Unauthorized" });
      const logged = String(info.mock.calls.at(-1)?.[0]);
      expect(JSON.parse(logged)).toEqual({
        requestId: `req-jwks-${index}`,
        route: "authorizer",
        status: 401,
        error: "jwks_unavailable",
      });
      expect(logged).not.toContain(token);
      expect(logged).not.toContain(secret);
      expect(logged).not.toContain("Failed to fetch");
      expect(logged).not.toContain("secret-jwks");
      expect(logged).not.toContain("errorName");
    }
  });
});

describe("environment configuration", () => {
  it("fails closed when required configuration is missing or for the wrong region", () => {
    expect(readAuthConfig({})).toBeNull();
    expect(
      readAuthConfig({
        ENVIRONMENT: "demo",
        COGNITO_REGION: "eu-west-2",
        COGNITO_USER_POOL_ID: DEMO_POOL,
      }),
    ).toBeNull();
    expect(
      readAuthConfig({
        ENVIRONMENT: "demo",
        COGNITO_REGION: "us-east-1",
        COGNITO_USER_POOL_ID: "us-east-1_demoPool",
        COGNITO_CLIENT_ID: DEMO_CLIENT,
      }),
    ).toBeNull();
    expect(
      readAuthConfig({
        ENVIRONMENT: "staging",
        COGNITO_REGION: "eu-west-2",
        COGNITO_USER_POOL_ID: DEMO_POOL,
        COGNITO_CLIENT_ID: DEMO_CLIENT,
      }),
    ).toBeNull();
  });

  it("returns the generic unauthorised authoriser result when configuration is missing", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const result = await authorizer({ headers: {}, requestContext: { requestId: "req-2" } });
    expect(result).toEqual({ errorMessage: "Unauthorized" });
    expect(info.mock.calls.flat().join(" ")).toContain("misconfigured");
  });

  it("uses payload 2.0 results for 401, 403, and an authorised admin token", async () => {
    const keys = await tokenFixture();
    vi.stubEnv("ENVIRONMENT", "demo");
    vi.stubEnv("COGNITO_REGION", "eu-west-2");
    vi.stubEnv("COGNITO_USER_POOL_ID", DEMO_POOL);
    vi.stubEnv("COGNITO_CLIENT_ID", DEMO_CLIENT);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const base = {
      version: "2.0",
      type: "REQUEST",
      routeArn: "arn:aws:execute-api:eu-west-2:000000000000:api/$default/GET/health",
      routeKey: "GET /health",
      rawPath: "/health",
      requestContext: {
        requestId: "req-payload",
        http: { method: "GET", path: "/health" },
      },
    };
    await expect(
      authorizer({ ...base, identitySource: [], headers: {} }, keys.fetcher),
    ).resolves.toEqual({ errorMessage: "Unauthorized" });
    await expect(
      authorizer(
        { ...base, headers: { authorization: "Bearer not-a-token" } },
        keys.fetcher,
      ),
    ).resolves.toEqual({ errorMessage: "Unauthorized" });

    const member = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["readers"] },
      { issuer },
    );
    await expect(
      authorizer({ ...base, headers: { authorization: `Bearer ${member}` } }, keys.fetcher),
    ).resolves.toEqual({ isAuthorized: false });

    const admin = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["admin"] },
      { issuer },
    );
    await expect(
      authorizer({ ...base, headers: { authorization: `Bearer ${admin}` } }, keys.fetcher),
    ).resolves.toEqual({
      isAuthorized: true,
      context: { sub: "11111111-2222-4333-8444-555555555555", hasAdmin: "true" },
    });
  });

  it("reads demo and production configuration separately", () => {
    expect(
      readAuthConfig({
        ENVIRONMENT: "prod",
        COGNITO_REGION: "eu-west-2",
        COGNITO_USER_POOL_ID: PROD_POOL,
        COGNITO_CLIENT_ID: PROD_CLIENT,
      }),
    ).toMatchObject({ environment: "prod", userPoolId: PROD_POOL, clientId: PROD_CLIENT });
  });
});
