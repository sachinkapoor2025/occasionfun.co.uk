export const ADMIN_GROUP = "admin";
export const REQUIRED_REGION = "eu-west-2";

const POOL_ID = /^[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]+$/;
const CLIENT_ID = /^[A-Za-z0-9]{1,128}$/;

export type AuthConfig = {
  environment: "demo" | "prod";
  region: string;
  userPoolId: string;
  clientId: string;
  issuer: string;
};

export type EnvSource = Record<string, string | undefined>;

export function readAuthConfig(env: EnvSource = process.env): AuthConfig | null {
  const environment = env.ENVIRONMENT?.trim();
  const region = env.COGNITO_REGION?.trim() ?? "";
  const userPoolId = env.COGNITO_USER_POOL_ID?.trim() ?? "";
  const clientId = env.COGNITO_CLIENT_ID?.trim() ?? "";
  if (environment !== "demo" && environment !== "prod") return null;
  if (region !== REQUIRED_REGION) return null;
  if (!POOL_ID.test(userPoolId) || !userPoolId.startsWith(`${region}_`)) return null;
  if (!CLIENT_ID.test(clientId)) return null;
  return {
    environment,
    region,
    userPoolId,
    clientId,
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  };
}
