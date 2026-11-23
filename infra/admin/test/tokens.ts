import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose";
import type { Fetcher } from "aws-jwt-verify/https";
import type { AuthConfig } from "../src/config";

export const DEMO_POOL = "eu-west-2_demoPool";
export const PROD_POOL = "eu-west-2_prodPool";
export const DEMO_CLIENT = "democlient";
export const PROD_CLIENT = "prodclient";

export function authConfig(
  userPoolId = DEMO_POOL,
  clientId = DEMO_CLIENT,
  environment: "demo" | "prod" = "demo",
): AuthConfig {
  return {
    environment,
    region: "eu-west-2",
    userPoolId,
    clientId,
    issuer: `https://cognito-idp.eu-west-2.amazonaws.com/${userPoolId}`,
  };
}

export type TokenFixture = {
  fetcher: Fetcher;
  jwks: string;
  privateKey: CryptoKey;
  otherPrivateKey: CryptoKey;
};

export async function tokenFixture(): Promise<TokenFixture> {
  const primary = await generateKeyPair("RS256", { extractable: true });
  const other = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(primary.publicKey);
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  jwk.use = "sig";
  const body = JSON.stringify({ keys: [jwk] });
  return {
    privateKey: primary.privateKey,
    otherPrivateKey: other.privateKey,
    jwks: body,
    fetcher: {
      async fetch() {
        return new TextEncoder().encode(body).buffer;
      },
    },
  };
}

export async function signToken(
  privateKey: CryptoKey,
  claims: Record<string, unknown>,
  options: { issuer: string; subject?: string; expiresIn?: string; kid?: string },
): Promise<string> {
  let builder = new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: options.kid ?? "test-key" })
    .setIssuer(options.issuer)
    .setSubject(options.subject ?? "11111111-2222-4333-8444-555555555555")
    .setIssuedAt();
  builder = builder.setExpirationTime(options.expiresIn ?? "15m");
  return builder.sign(privateKey);
}
