import { DEMO } from "./deployment-targets.mjs";

const secretMarkers = [
  { name: "aws-access-key-id", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "aws-secret-access-key-name", pattern: /AWS_SECRET_ACCESS_KEY/ },
  { name: "smtp-secret-id", pattern: /occasionfun-co-uk\/contact\/smtp/ },
  { name: "smtp-secret-suffix", pattern: /smtp-32Px2G/ },
  { name: "private-key", pattern: /BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/ },
];

export function secretFindings(text) {
  return secretMarkers.filter((marker) => marker.pattern.test(text)).map((marker) => marker.name);
}

export function assertNoSecrets(label, text) {
  const findings = secretFindings(text);
  if (findings.length > 0) {
    throw new Error(`${label} exposed credential markers: ${findings.join(", ")}`);
  }
}

export function assertWebsite(status) {
  if (status !== 200) {
    throw new Error(`Demo website returned HTTP ${status}.`);
  }
}

export function headerValue(headers, name) {
  if (typeof headers.get === "function") return headers.get(name) ?? "";
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found ? String(found[1]) : "";
}

export function assertPreflight(status, headers) {
  if (status !== 200 && status !== 204) {
    throw new Error(`Demo CORS preflight returned HTTP ${status}.`);
  }
  const origin = headerValue(headers, "access-control-allow-origin");
  const methods = headerValue(headers, "access-control-allow-methods");
  if (origin === "*") throw new Error("Demo CORS preflight allows every origin.");
  if (origin !== DEMO.siteUrl) {
    throw new Error("Demo CORS preflight did not allow the demo site origin.");
  }
  if (!methods.toUpperCase().includes("POST")) {
    throw new Error("Demo CORS preflight did not allow POST.");
  }
}

export function assertInvalidEnquiry(status, body) {
  let payload = null;
  try {
    payload = JSON.parse(body);
  } catch {
    payload = null;
  }
  if (
    payload &&
    (payload.saved === true || payload.ok === true || payload.notification === "sent")
  ) {
    throw new Error("Invalid enquiry was accepted. Smoke tests must not save a lead or send mail.");
  }
  if (status < 400 || status >= 500) {
    throw new Error(`Invalid enquiry returned HTTP ${status}. A real enquiry was not sent.`);
  }
  if (!payload) throw new Error("Invalid enquiry did not return JSON.");
}

async function readBody(response) {
  return response.text();
}

export async function runSmokeChecks({ fetchImpl = fetch } = {}) {
  const website = await fetchImpl(DEMO.siteUrl, { redirect: "follow" });
  const websiteBody = await readBody(website);
  assertWebsite(website.status);
  assertNoSecrets("Demo website", websiteBody);

  const preflight = await fetchImpl(DEMO.endpoint, {
    method: "OPTIONS",
    headers: {
      origin: DEMO.siteUrl,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  const preflightBody = await readBody(preflight);
  assertPreflight(preflight.status, preflight.headers);
  assertNoSecrets("Demo API preflight", preflightBody);

  const invalid = await fetchImpl(DEMO.endpoint, {
    method: "POST",
    headers: {
      origin: DEMO.siteUrl,
      "content-type": "application/json",
    },
    body: "{}",
  });
  const invalidBody = await readBody(invalid);
  assertInvalidEnquiry(invalid.status, invalidBody);
  assertNoSecrets("Demo API invalid request", invalidBody);

  return {
    websiteStatus: website.status,
    preflightStatus: preflight.status,
    invalidStatus: invalid.status,
    credentialMarkers: "absent",
  };
}

const invokedDirectly = process.argv[1]?.endsWith("smoke-demo.mjs");
if (invokedDirectly) {
  runSmokeChecks()
    .then((summary) => {
      console.log(JSON.stringify(summary));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "Demo smoke test failed.");
      process.exit(1);
    });
}
