import { writeFileSync } from "node:fs";
import { DEMO, PRODUCTION } from "./deployment-targets.mjs";

function publicValues(current) {
  return Object.entries(current).filter(
    ([key, value]) => key.startsWith("NEXT_PUBLIC_") && typeof value === "string" && value.length > 0,
  );
}

function mentionsApi(value, target) {
  return value === target.endpoint || value.includes(target.apiId);
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
    };
  }

  if (values.some(([, value]) => mentionsApi(value, DEMO))) {
    refuseApi(name, "demo");
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
    };
  }

  return {
    NEXT_PUBLIC_CONTACT_ENDPOINT: endpoint,
    NEXT_PUBLIC_SITE_URL: site,
  };
}

export function renderPublicEnv(branch, env) {
  const resolved = resolvePublicEnv(branch, env);
  const lines = [];
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("NEXT_PUBLIC_") || !value) continue;
    if (key === "NEXT_PUBLIC_CONTACT_ENDPOINT" || key === "NEXT_PUBLIC_SITE_URL") continue;
    lines.push(`${key}=${value}`);
  }
  if (resolved.NEXT_PUBLIC_CONTACT_ENDPOINT) {
    lines.push(`NEXT_PUBLIC_CONTACT_ENDPOINT=${resolved.NEXT_PUBLIC_CONTACT_ENDPOINT}`);
  }
  if (resolved.NEXT_PUBLIC_SITE_URL) {
    lines.push(`NEXT_PUBLIC_SITE_URL=${resolved.NEXT_PUBLIC_SITE_URL}`);
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
