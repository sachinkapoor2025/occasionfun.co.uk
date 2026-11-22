import { CognitoJwtVerifier } from "aws-jwt-verify";
import { CognitoJwtInvalidGroupError } from "aws-jwt-verify/error";
import type { Fetcher } from "aws-jwt-verify/https";
import { SimpleJwksCache } from "aws-jwt-verify/jwk";
import { ADMIN_GROUP, type AuthConfig } from "./config";

const BEARER =
  /^Bearer ([A-Za-z0-9_-]+=*\.[A-Za-z0-9_-]+=*\.[A-Za-z0-9_-]+=*)$/i;
const SUBJECT = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_HEADER_LENGTH = 12_000;

export type Decision =
  | { outcome: "allow"; sub: string }
  | {
      outcome: "unauthorized";
      reason:
        | "missing_token"
        | "malformed_token"
        | "invalid_token"
        | "jwks_unavailable"
        | "misconfigured";
    }
  | { outcome: "forbidden"; reason: "missing_admin_group" };

type AccessVerifier = {
  verify(token: string): Promise<{ sub?: unknown }>;
};

let cached: { key: string; verifier: AccessVerifier } | undefined;

export function resetVerifierCache(): void {
  cached = undefined;
}

function verifierFor(config: AuthConfig, fetcher?: Fetcher): AccessVerifier {
  const properties = {
    userPoolId: config.userPoolId,
    tokenUse: "access" as const,
    clientId: config.clientId,
    groups: ADMIN_GROUP,
    includeRawJwtInErrors: false,
  };
  if (fetcher) {
    return CognitoJwtVerifier.create(properties, {
      jwksCache: new SimpleJwksCache({ fetcher }),
    });
  }
  const key = `${config.userPoolId}\n${config.clientId}`;
  if (!cached || cached.key !== key) {
    cached = { key, verifier: CognitoJwtVerifier.create(properties) };
  }
  return cached.verifier;
}

function bearerToken(header: string | undefined): string | null | undefined {
  if (header === undefined) return undefined;
  if (header.length === 0 || header.length > MAX_HEADER_LENGTH) return null;
  const match = BEARER.exec(header);
  return match ? match[1] : null;
}

function isGroupError(error: unknown): boolean {
  return (
    error instanceof CognitoJwtInvalidGroupError ||
    (error instanceof Error && error.name === "CognitoJwtInvalidGroupError")
  );
}

function isJwksError(error: unknown): boolean {
  return error instanceof Error && /Fetch|Jwks|Network/i.test(error.name);
}

function subject(value: unknown): string | null {
  return typeof value === "string" && SUBJECT.test(value) ? value : null;
}

export async function decide(
  authorizationHeader: string | undefined,
  config: AuthConfig | null,
  fetcher?: Fetcher,
): Promise<Decision> {
  if (!config) return { outcome: "unauthorized", reason: "misconfigured" };
  const token = bearerToken(authorizationHeader);
  if (token === undefined) return { outcome: "unauthorized", reason: "missing_token" };
  if (token === null) return { outcome: "unauthorized", reason: "malformed_token" };
  try {
    const payload = await verifierFor(config, fetcher).verify(token);
    const sub = subject(payload.sub);
    if (!sub) return { outcome: "unauthorized", reason: "invalid_token" };
    return { outcome: "allow", sub };
  } catch (error) {
    if (isGroupError(error)) {
      return { outcome: "forbidden", reason: "missing_admin_group" };
    }
    if (isJwksError(error)) {
      return { outcome: "unauthorized", reason: "jwks_unavailable" };
    }
    return { outcome: "unauthorized", reason: "invalid_token" };
  }
}
