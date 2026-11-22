import { writeFileSync } from "node:fs";
import { DEMO, PRODUCTION } from "./deployment-targets.mjs";

function publicValues(current) {
  return Object.entries(current).filter(
    ([key, value]) => key.startsWith("NEXT_PUBLIC_") && typeof value === "string" && value.length > 0,
  );
}

const ADMIN_ENV_KEYS = [
  "NEXT_PUBLIC_COGNITO_REGION",
  "NEXT_PUBLIC_COGNITO_POOL_ID",
  "NEXT_PUBLIC_COGNITO_CLIENT_ID",
  "NEXT_PUBLIC_ADMIN_API_BASE",
];

function mentionsApi(value, target) {
  return value === target.endpoint || value.includes(target.apiId);
}

function mentionsDemoAdmin(value) {
  return [DEMO.adminApiId, DEMO.adminApiBase, DEMO.cognitoPoolId, DEMO.cognitoClientId].some(
    (marker) => value.includes(marker),
  );
}

function demoAdminEnv(current) {
  return {
    NEXT_PUBLIC_COGNITO_REGION: current.NEXT_PUBLIC_COGNITO_REGION || DEMO.cognitoRegion,
    NEXT_PUBLIC_COGNITO_POOL_ID: current.NEXT_PUBLIC_COGNITO_POOL_ID || DEMO.cognitoPoolId,
    NEXT_PUBLIC_COGNITO_CLIENT_ID: current.NEXT_PUBLIC_COGNITO_CLIENT_ID || DEMO.cognitoClientId,
    NEXT_PUBLIC_ADMIN_API_BASE: current.NEXT_PUBLIC_ADMIN_API_BASE || DEMO.adminApiBase,
  };
}

function passedAdminEnv(current) {
  const admin = {};
  for (const key of ADMIN_ENV_KEYS) {
    if (typeof current[key] === "string" && current[key]) admin[key] = current[key];
  }
  return admin;
}

function refuseApi(branch, label) {
  throw new Error(`Amplify branch "${branch || "(unset)"}" refused the ${label} contact API.`);
}

/**
 * Demo may use only the demo API and falls back to it when the branch
 * variable is empty. main and master may use only the production API and
 * fall back to it when the branch variable is empty. A demo URL on any
 * other branch, or a production URL on demo, is refused.
 */
export function resolvePublicEnv(branch, current = {}) {
  const name = typeof branch === "string" ? branch : "";
  const endpoint = current.NEXT_PUBLIC_CONTACT_ENDPOINT ?? "";
  const site = current.NEXT_PUBLIC_SITE_URL ?? "";
  const values = publicValues(current);

  if (name === "demo") {
    if (values.some(([, value]) => mentionsApi(value, PRODUCTION))) {
      refuseApi(name, "production");
    }
    return {
      NEXT_PUBLIC_CONTACT_ENDPOINT: endpoint || DEMO.endpoint,
      NEXT_PUBLIC_SITE_URL: site || DEMO.siteUrl,
      ...demoAdminEnv(current),
    };
  }

  if (values.some(([, value]) => mentionsApi(value, DEMO))) {
    refuseApi(name, "demo");
  }
  if (values.some(([, value]) => mentionsDemoAdmin(value))) {
    throw new Error(`Amplify branch "${name || "(unset)"}" refused the demo administration API.`);
  }

  if (name === "main" || name === "master") {
    const chosen = endpoint || PRODUCTION.endpoint;
    const hostname = URL.canParse(chosen) ? new URL(chosen).hostname : "";
    const productionHost = new URL(PRODUCTION.endpoint).hostname;
    if (chosen !== PRODUCTION.endpoint || hostname !== productionHost) {
      throw new Error(
        `Amplify branch "${name}" refused a contact API that is not the production API.`,
      );
    }
    return {
      NEXT_PUBLIC_CONTACT_ENDPOINT: PRODUCTION.endpoint,
      NEXT_PUBLIC_SITE_URL: site || PRODUCTION.siteUrl,
      ...passedAdminEnv(current),
    };
  }

  return {
    NEXT_PUBLIC_CONTACT_ENDPOINT: endpoint,
    NEXT_PUBLIC_SITE_URL: site,
    ...passedAdminEnv(current),
  };
}

export function renderPublicEnv(branch, env) {
  const resolved = resolvePublicEnv(branch, env);
  const lines = [];
  const managed = new Set(["NEXT_PUBLIC_CONTACT_ENDPOINT", "NEXT_PUBLIC_SITE_URL", ...ADMIN_ENV_KEYS]);
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("NEXT_PUBLIC_") || !value) continue;
    if (managed.has(key)) continue;
    lines.push(`${key}=${value}`);
  }
  if (resolved.NEXT_PUBLIC_CONTACT_ENDPOINT) {
    lines.push(`NEXT_PUBLIC_CONTACT_ENDPOINT=${resolved.NEXT_PUBLIC_CONTACT_ENDPOINT}`);
  }
  if (resolved.NEXT_PUBLIC_SITE_URL) {
    lines.push(`NEXT_PUBLIC_SITE_URL=${resolved.NEXT_PUBLIC_SITE_URL}`);
  }
  for (const key of ADMIN_ENV_KEYS) {
    if (resolved[key]) lines.push(`${key}=${resolved[key]}`);
  }
  return `${lines.join("\n")}\n`;
}

const invokedDirectly = process.argv[1]?.endsWith("amplify-public-env.mjs");
if (invokedDirectly) {
  try {
    writeFileSync(".env.production", renderPublicEnv(process.env.AWS_BRANCH ?? "", process.env));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Amplify public environment is invalid.");
    process.exit(1);
  }
}
