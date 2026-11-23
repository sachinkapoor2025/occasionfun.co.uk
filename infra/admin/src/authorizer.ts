import type { Fetcher } from "aws-jwt-verify/https";
import { decide, type Decision } from "./authorize";
import { readAuthConfig } from "./config";
import { logEvent } from "./http";

export type AuthorizerEvent = {
  version?: string;
  type?: string;
  routeArn?: string;
  identitySource?: string[];
  routeKey?: string;
  rawPath?: string;
  headers?: Record<string, string | undefined>;
  requestContext?: {
    requestId?: string;
    http?: { method?: string; path?: string };
  };
};

export type AuthorizerResult =
  | { isAuthorized: true; context: { sub: string; hasAdmin: "true" } }
  | { isAuthorized: false }
  | { errorMessage: "Unauthorized" };

function authorizationHeader(
  headers: Record<string, string | undefined> | undefined,
): string | undefined {
  if (!headers) return undefined;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === "authorization") return value;
  }
  return undefined;
}

function statusFor(decision: Decision): number {
  if (decision.outcome === "allow") return 200;
  if (decision.outcome === "forbidden") return 403;
  return 401;
}

export function authorizerResponse(decision: Decision): AuthorizerResult {
  if (decision.outcome === "allow") {
    return {
      isAuthorized: true,
      context: { sub: decision.sub, hasAdmin: "true" },
    };
  }
  if (decision.outcome === "forbidden") return { isAuthorized: false };
  return { errorMessage: "Unauthorized" };
}

async function complete(
  event: AuthorizerEvent,
  fetcher?: Fetcher,
): Promise<AuthorizerResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const decision = await decide(
    authorizationHeader(event.headers),
    readAuthConfig(),
    fetcher,
  );
  const invalidToken =
    decision.outcome === "unauthorized" && decision.reason === "invalid_token";
  logEvent({
    requestId,
    route: "authorizer",
    status: statusFor(decision),
    error: decision.outcome === "allow" ? undefined : decision.reason,
    errorName: invalidToken ? decision.errorName : undefined,
    errorCode: invalidToken ? decision.errorCode : undefined,
    errorDetail: invalidToken ? decision.errorDetail : undefined,
    verificationStage: invalidToken ? decision.verificationStage : undefined,
  });
  return authorizerResponse(decision);
}

// Lambda calls this as (event, context, callback). The context is not a Fetcher.
// Verification uses aws-jwt-verify's default SimpleFetcher.
export async function authorizer(
  event: AuthorizerEvent,
  _context?: unknown,
): Promise<AuthorizerResult> {
  return complete(event);
}

export async function authorizeWithFetcher(
  event: AuthorizerEvent,
  fetcher: Fetcher,
): Promise<AuthorizerResult> {
  return complete(event, fetcher);
}
