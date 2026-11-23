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

  // The fetcher throws before verification, so this checks the log filter only.
  it("logs a TypeError code and allowlisted detail while staying at 401", async () => {
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
    const cases = [
      {
        message: 'The "algorithm" argument must be of type string. Received undefined',
        code: "ERR_INVALID_ARG_TYPE",
      },
      {
        message: "Invalid JWK format",
        code: "ERR_CRYPTO_INVALID_JWK",
      },
    ] as const;
    for (const [index, item] of cases.entries()) {
      const failure = new TypeError(item.message);
      Object.defineProperty(failure, "code", { value: item.code });
      const result = await authorizer(
        {
          headers: { authorization: `Bearer ${token}` },
          requestContext: { requestId: `req-type-${index}` },
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
        requestId: `req-type-${index}`,
        route: "authorizer",
        status: 401,
        error: "invalid_token",
        errorName: "TypeError",
        errorCode: item.code,
        errorDetail: item.message,
      });
      expect(JSON.parse(logged)).not.toHaveProperty("verificationStage");
      expect(logged).not.toContain(token);
      expect(item.message.length).toBeLessThanOrEqual(180);
    }
  });

  it("omits error text that contains a JWT or a bearer token", async () => {
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
    const planted = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJl";
    const bearer = `Bearer ${planted}`;
    const className = "SecretClassName";
    const failures = [
      { message: `verification failed for ${planted}`, code: "ERR_INVALID_ARG_TYPE" },
      { message: bearer, code: planted },
      {
        message: `The "algorithm" argument must be of type string. Received an instance of ${className}`,
        code: "ERR_INVALID_ARG_TYPE",
      },
      {
        message: 'The "key.key" property must be of type object. Received type string (\'not-a-key\')',
        code: "ERR_INVALID_ARG_TYPE",
      },
    ];
    for (const [index, item] of failures.entries()) {
      const failure = new TypeError(item.message);
      Object.defineProperty(failure, "code", { value: item.code });
      const result = await authorizer(
        {
          headers: { authorization: `Bearer ${token}` },
          requestContext: { requestId: `req-redact-${index}` },
        },
        {
          async fetch() {
            throw failure;
          },
        },
      );
      expect(result).toEqual({ errorMessage: "Unauthorized" });
      const logged = String(info.mock.calls.at(-1)?.[0]);
      const parsed = JSON.parse(logged) as Record<string, unknown>;
      expect(parsed.status).toBe(401);
      expect(parsed.error).toBe("invalid_token");
      expect(parsed.errorName).toBe("TypeError");
      expect(parsed).not.toHaveProperty("errorDetail");
      expect(parsed).not.toHaveProperty("verificationStage");
      expect(logged).not.toContain(token);
      expect(logged).not.toContain(planted);
      expect(logged).not.toContain(bearer);
      expect(logged).not.toContain("Bearer");
      expect(logged).not.toContain(className);
      expect(logged).not.toContain("not-a-key");
    }
    const withCode = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(withCode.errorCode).toBe("ERR_INVALID_ARG_TYPE");
    const withoutCode = JSON.parse(String(info.mock.calls[1]?.[0])) as Record<string, unknown>;
    expect(withoutCode).not.toHaveProperty("errorCode");
  });

  it("verifies generated tokens against controlled JWKS responses", async () => {
    const keys = await tokenFixture();
    vi.stubEnv("ENVIRONMENT", "demo");
    vi.stubEnv("COGNITO_REGION", "eu-west-2");
    vi.stubEnv("COGNITO_USER_POOL_ID", DEMO_POOL);
    vi.stubEnv("COGNITO_CLIENT_ID", DEMO_CLIENT);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const adminClaims = { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["admin"] };
    const admin = await signToken(keys.privateKey, adminClaims, { issuer });
    const member = await signToken(
      keys.privateKey,
      { token_use: "access", client_id: DEMO_CLIENT, "cognito:groups": ["readers"] },
      { issuer },
    );
    const forged = await signToken(keys.otherPrivateKey, adminClaims, { issuer });
    const bytes = (body: string) => {
      const encoded = Buffer.from(body);
      return {
        async fetch() {
          return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
        },
      };
    };
    const coordinate = "bad-x-coordinate";
    const scenarios = [
      {
        id: "admin",
        token: admin,
        fetcher: keys.fetcher,
        result: {
          isAuthorized: true,
          context: { sub: "11111111-2222-4333-8444-555555555555", hasAdmin: "true" },
        },
        log: { requestId: "req-real-admin", route: "authorizer", status: 200 },
        hidden: [] as string[],
      },
      {
        id: "member",
        token: member,
        fetcher: keys.fetcher,
        result: { isAuthorized: false },
        log: {
          requestId: "req-real-member",
          route: "authorizer",
          status: 403,
          error: "missing_admin_group",
        },
        hidden: [] as string[],
      },
      {
        id: "forged",
        token: forged,
        fetcher: keys.fetcher,
        result: { errorMessage: "Unauthorized" },
        log: {
          requestId: "req-real-forged",
          route: "authorizer",
          status: 401,
          error: "invalid_token",
          errorName: "JwtInvalidSignatureError",
        },
        hidden: ["Invalid signature"],
      },
      {
        id: "jwks-text",
        token: admin,
        fetcher: bytes("not-json"),
        result: { errorMessage: "Unauthorized" },
        log: {
          requestId: "req-real-jwks-text",
          route: "authorizer",
          status: 401,
          error: "jwks_unavailable",
        },
        hidden: ["not-json", "SyntaxError"],
      },
      {
        id: "missing-modulus",
        token: admin,
        fetcher: bytes(JSON.stringify({ keys: [{ kty: "RSA", kid: "test-key", use: "sig", e: "AQAB" }] })),
        result: { errorMessage: "Unauthorized" },
        log: {
          requestId: "req-real-modulus",
          route: "authorizer",
          status: 401,
          error: "invalid_token",
          errorName: "JwkValidationError",
        },
        hidden: ["Missing modulus"],
      },
      {
        id: "bad-rsa-modulus",
        token: admin,
        fetcher: bytes(
          JSON.stringify({
            keys: [{ kty: "RSA", kid: "test-key", use: "sig", alg: "RS256", n: "@@@", e: "AQAB" }],
          }),
        ),
        result: { errorMessage: "Unauthorized" },
        log: {
          requestId: "req-real-rsa",
          route: "authorizer",
          status: 401,
          error: "invalid_token",
          errorName: "JwtInvalidSignatureError",
        },
        hidden: ["@@@", "TypeError"],
      },
      {
        id: "bad-ec-key",
        token: admin,
        fetcher: bytes(
          JSON.stringify({
            keys: [
              {
                kty: "EC",
                crv: "P-256",
                x: coordinate,
                y: "bad-y-coordinate",
                kid: "test-key",
                use: "sig",
              },
            ],
          }),
        ),
        result: { errorMessage: "Unauthorized" },
        log: {
          requestId: "req-real-ec",
          route: "authorizer",
          status: 401,
          error: "invalid_token",
          errorName: "TypeError",
          errorCode: "ERR_CRYPTO_INVALID_JWK",
          errorDetail: "Invalid JWK EC key",
        },
        hidden: [coordinate, "bad-y-coordinate"],
      },
    ] as const;

    for (const scenario of scenarios) {
      const result = await authorizer(
        {
          headers: { authorization: `Bearer ${scenario.token}` },
          requestContext: { requestId: scenario.log.requestId },
        },
        scenario.fetcher,
      );
      expect(result).toEqual(scenario.result);
      const logged = String(info.mock.calls.at(-1)?.[0]);
      const parsed = JSON.parse(logged) as Record<string, unknown>;
      expect(parsed).toEqual(scenario.log);
      expect(parsed).not.toHaveProperty("verificationStage");
      expect(logged).not.toContain(scenario.token);
      expect(logged).not.toContain("Bearer");
      for (const hidden of scenario.hidden) expect(logged).not.toContain(hidden);
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
