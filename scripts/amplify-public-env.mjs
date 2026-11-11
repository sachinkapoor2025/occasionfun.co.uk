import { writeFileSync } from "node:fs";
import { DEMO, PRODUCTION } from "./deployment-targets.mjs";

/**
 * Demo is the only branch that may fall back to the existing demo API.
 * Every other branch refuses that API id and endpoint. An empty production
 * endpoint stays empty so the demo API is never injected as a fallback.
 */
export function resolvePublicEnv(branch, current = {}) {
  const name = typeof branch === "string" ? branch : "";
  const endpoint = current.NEXT_PUBLIC_CONTACT_ENDPOINT ?? "";
  const site = current.NEXT_PUBLIC_SITE_URL ?? "";

  if (name !== "demo") {
    for (const [key, value] of Object.entries(current)) {
      if (!key.startsWith("NEXT_PUBLIC_") || typeof value !== "string" || value.length === 0) {
        continue;
      }
      if (value === DEMO.endpoint || value.includes(DEMO.apiId)) {
        throw new Error(
          `Amplify branch "${name || "(unset)"}" refused the demo contact API.`,
        );
      }
    }
    return {
      NEXT_PUBLIC_CONTACT_ENDPOINT: endpoint,
      NEXT_PUBLIC_SITE_URL: site || (name === "main" || name === "master" ? PRODUCTION.siteUrl : ""),
    };
  }

  return {
    NEXT_PUBLIC_CONTACT_ENDPOINT: endpoint || DEMO.endpoint,
    NEXT_PUBLIC_SITE_URL: site || DEMO.siteUrl,
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
