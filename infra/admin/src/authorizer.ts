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

export async function authorizer(
  event: AuthorizerEvent,
  fetcher?: Fetcher,
): Promise<AuthorizerResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const decision = await decide(
    authorizationHeader(event.headers),
    readAuthConfig(),
    fetcher,
  );
  logEvent({
    requestId,
    route: "authorizer",
    status: statusFor(decision),
    error: decision.outcome === "allow" ? undefined : decision.reason,
    errorName:
      decision.outcome === "unauthorized" && decision.reason === "invalid_token"
        ? decision.errorName
        : undefined,
  });
  return authorizerResponse(decision);
}
