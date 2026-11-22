import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const architecture = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../docs/admin-chatbot/technical-architecture.md",
  ),
  "utf8",
);

const rotation = architecture.slice(
  architecture.indexOf("### 6.3.1"),
  architecture.indexOf("### 6.3.2"),
);
const signOut = architecture.slice(
  architecture.indexOf("### 6.3.3"),
  architecture.indexOf("### 6.4"),
);

describe("documented session limitations", () => {
  it("records the accepted duplicated-tab limitation", () => {
    expect(rotation).toContain(
      "the current `sessionStorage` design does not guarantee that duplicated tabs remain authenticated independently after access-token expiry",
    );
    expect(rotation).toContain("within one browser document");
    expect(rotation).toContain("in-flight `fetchAuthSession` promise");
    expect(rotation).toContain("Neither mechanism coordinates a duplicated browser tab");
    expect(rotation).toContain("Chrome or Edge");
    expect(rotation).toContain("independent `sessionStorage` areas");
  });

  it("records the zero-second grace period and reuse consequence", () => {
    expect(rotation).toContain("grace period is 0 seconds");
    expect(rotation).toContain("RefreshTokenReuseException");
    expect(rotation).toContain("The losing tab must sign in again");
    expect(rotation).toContain(
      "The first tab may remain authenticated with its replacement refresh token",
    );
  });

  it("does not claim that refresh tokens are shared across tabs", () => {
    expect(rotation).toContain("intentionally not implemented");
    expect(rotation).toContain("BroadcastChannel");
    expect(rotation).toContain("localStorage");
    expect(rotation).toContain("SharedWorker");
    expect(rotation).toContain("backend session service");
    expect(rotation).toContain("Increasing Cognito's refresh-token grace period");
    expect(rotation).toContain("Cross-tab token synchronisation");
    expect(rotation).toContain("beyond the individual Admin tab");
    expect(rotation).not.toContain("refresh tokens are synchronised across tabs");
    expect(rotation).toContain("Web Locks are not an implemented solution");
  });

  it("records that global sign-out does not prove remote revocation", () => {
    expect(signOut).toContain("signOut({ global: true })");
    expect(signOut).toContain("Local sign-out is guaranteed");
    expect(signOut).toContain("Remote session revocation must not be claimed as guaranteed");
    expect(signOut).toContain("Other devices may remain signed in");
    expect(signOut).toContain("may remain usable until they expire");
    expect(signOut).toContain(
      "A resolved Amplify sign-out promise is not evidence that Cognito revoked sessions on other devices",
    );
    expect(signOut).toContain("does not add a second, direct Cognito `GlobalSignOut` call");
    expect(signOut).toContain(
      "You are signed out on this device. Other devices may remain signed in.",
    );
  });
});
