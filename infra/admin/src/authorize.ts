import { AsyncLocalStorage } from "node:async_hooks";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { CognitoJwtInvalidGroupError } from "aws-jwt-verify/error";
import type { Fetcher } from "aws-jwt-verify/https";
import { SimpleJwksCache } from "aws-jwt-verify/jwk";
import { ADMIN_GROUP, type AuthConfig } from "./config";

const BEARER =
  /^Bearer ([A-Za-z0-9_-]+=*\.[A-Za-z0-9_-]+=*\.[A-Za-z0-9_-]+=*)$/i;
const SUBJECT = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9]{0,80}$/;
const SAFE_ERROR_CODE = /^ERR_[A-Z0-9_]{1,60}$/;
const MAX_HEADER_LENGTH = 12_000;
const MAX_ERROR_DETAIL = 180;
const VERIFICATION_STAGES = ["parse", "jwks", "import_key", "signature"] as const;

export type VerificationStage = (typeof VERIFICATION_STAGES)[number];
const RECEIVED = "(?:undefined|null)";
const KEY_TYPES =
  "string or an instance of ArrayBuffer, Buffer, TypedArray, DataView, KeyObject, or CryptoKey";

// Full-message allowlist. Node otherwise interpolates the received value, which can be key material.
const SAFE_ERROR_DETAILS: readonly RegExp[] = [
  /^Invalid JWK (?:format|RSA key|EC key|OKP key)$/,
  /^Invalid key object type (?:public|private|secret), expected (?:private|public|secret|private or public)\.$/,
  new RegExp(`^The "algorithm" argument must be of type string\\. Received ${RECEIVED}$`),
  new RegExp(
    `^The "(?:key|key\\.key)" (?:argument|property) must be of type (?:object|${KEY_TYPES})\\. Received ${RECEIVED}$`,
  ),
  /^The property 'options\.dsaEncoding' is invalid\. Received '(?:der|ieee-p1363)'$/,
];

export type Decision =
  | { outcome: "allow"; sub: string }
  | {
      outcome: "unauthorized";
      reason: "missing_token" | "malformed_token" | "jwks_unavailable" | "misconfigured";
    }
  | {
      outcome: "unauthorized";
      reason: "invalid_token";
      errorName?: string;
      errorCode?: string;
      errorDetail?: string;
      verificationStage?: VerificationStage;
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

function errorClassName(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  // Node 24 leaves Error.name as "Error" on these subclasses.
  const className = error.constructor?.name;
  if (typeof className === "string" && className !== "Error" && SAFE_ERROR_NAME.test(className)) {
    return className;
  }
  if (error.name !== "Error" && SAFE_ERROR_NAME.test(error.name)) return error.name;
  return undefined;
}

function isJwksError(error: unknown): boolean {
  const name = errorClassName(error);
  return name !== undefined && /Fetch|Jwks|Network/i.test(name);
}

function subject(value: unknown): string | null {
  return typeof value === "string" && SUBJECT.test(value) ? value : null;
}

type StageMarker = { stage: VerificationStage };

const stages = new AsyncLocalStorage<StageMarker>();

type MarkedVerifier = AccessVerifier & {
  jwksCache: {
    getJwk: (jwksUri: string, decomposedJwt: unknown) => Promise<unknown>;
    stageMarkersInstalled?: boolean;
  };
  publicKeyCache: {
    transformJwkToKeyObjectAsyncFn: (
      jwk: unknown,
      alg?: unknown,
      issuer?: unknown,
    ) => Promise<unknown>;
    stageMarkersInstalled?: boolean;
  };
};

function markVerifier(verifier: AccessVerifier): void {
  const marked = verifier as MarkedVerifier;
  if (!marked.jwksCache.stageMarkersInstalled) {
    const getJwk = marked.jwksCache.getJwk.bind(marked.jwksCache);
    marked.jwksCache.getJwk = async (jwksUri, decomposedJwt) => {
      const current = stages.getStore();
      if (current) current.stage = "jwks";
      return getJwk(jwksUri, decomposedJwt);
    };
    marked.jwksCache.stageMarkersInstalled = true;
  }
  if (!marked.publicKeyCache.stageMarkersInstalled) {
    const transform = marked.publicKeyCache.transformJwkToKeyObjectAsyncFn.bind(
      marked.publicKeyCache,
    );
    marked.publicKeyCache.transformJwkToKeyObjectAsyncFn = async (jwk, alg, issuer) => {
      const current = stages.getStore();
      if (current) current.stage = "import_key";
      const key = await transform(jwk, alg, issuer);
      if (current) current.stage = "signature";
      return key;
    };
    marked.publicKeyCache.stageMarkersInstalled = true;
  }
}

function redactTypeErrorMessage(message: string): string | undefined {
  const pem = /-----BEGIN [A-Z0-9 ]+-----[\s\S]*?-----END [A-Z0-9 ]+-----/g;
  const bearer = /Bearer\s+\S+/gi;
  const jwt = /[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,}){2}/g;
  const encoded = /[A-Za-z0-9+/_=-]{25,}/g;
  const received = / Received (?!undefined\b|null\b).*$/;
  const redacted = message
    .replace(pem, "[redacted]")
    .replace(bearer, "[redacted]")
    .replace(jwt, "[redacted]")
    .replace(encoded, "[redacted]")
    .replace(received, " Received [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ERROR_DETAIL);
  if (!redacted || redacted === "[redacted]") return undefined;
  if (
    /Bearer/i.test(redacted) ||
    /eyJ[A-Za-z0-9_-]{8,}/.test(redacted) ||
    /[A-Za-z0-9+/_=-]{25,}/.test(redacted) ||
    /-----BEGIN /.test(redacted)
  ) {
    return undefined;
  }
  return redacted;
}

function verificationDiagnostic(
  error: unknown,
  stage: VerificationStage | undefined,
): {
  errorCode?: string;
  errorDetail?: string;
  verificationStage?: VerificationStage;
} {
  if (!(error instanceof Error)) return {};
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  const typeError = errorClassName(error) === "TypeError";
  const detail = typeError
    ? redactTypeErrorMessage(error.message)
    : SAFE_ERROR_DETAILS.some((pattern) => pattern.test(error.message))
      ? error.message.slice(0, MAX_ERROR_DETAIL)
      : undefined;
  return {
    ...(code && SAFE_ERROR_CODE.test(code) ? { errorCode: code } : {}),
    ...(detail ? { errorDetail: detail } : {}),
    ...(typeError && stage && VERIFICATION_STAGES.includes(stage) ? { verificationStage: stage } : {}),
  };
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
  const marker: StageMarker = { stage: "parse" };
  try {
    const payload = await stages.run(marker, async () => {
      const verifier = verifierFor(config, fetcher);
      markVerifier(verifier);
      return verifier.verify(token);
    });
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
    const errorName = errorClassName(error);
    return {
      outcome: "unauthorized",
      reason: "invalid_token",
      ...(errorName ? { errorName } : {}),
      ...verificationDiagnostic(error, errorName === "TypeError" ? marker.stage : undefined),
    };
  }
}
