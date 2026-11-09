/**
 * Local production smoke checks for AWS-readiness verification.
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

async function checkGet(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const text = await res.text();
  return {
    path,
    status: res.status,
    ok: res.status >= 200 && res.status < 400,
    bytes: text.length,
    hasOccasionfun: /OCCASIONFUN LTD/i.test(text),
  };
}

async function main() {
  const routes = [
    "/",
    "/about",
    "/services",
    "/services/cloud-aws-devops",
    "/public-sector",
    "/technology-partner",
    "/how-we-work",
    "/trust",
    "/policies",
    "/contact",
    "/privacy",
    "/cookies",
    "/terms",
    "/robots.txt",
    "/sitemap.xml",
  ];

  const routeResults = [];
  for (const path of routes) {
    try {
      routeResults.push(await checkGet(path));
    } catch (error) {
      routeResults.push({
        path,
        status: 0,
        ok: false,
        error: String(error),
      });
    }
  }

  const failedRoutes = routeResults.filter((r) => !r.ok);

  let contactValid;
  try {
    const res = await fetch(`${BASE}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Tester",
        organisation: "Local Verification Org",
        email: "smoke@example.com",
        phone: "",
        enquiryType: "Other",
        message:
          "Local production smoke test enquiry for AWS deployment readiness.",
        consent: true,
        companyWebsite: "",
      }),
    });
    const json = await res.json().catch(() => ({}));
    contactValid = { status: res.status, ok: res.ok, bodyOk: Boolean(json.ok) };
  } catch (error) {
    contactValid = { status: 0, ok: false, error: String(error) };
  }

  let contactInvalid;
  try {
    const res = await fetch(`${BASE}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x", email: "bad" }),
    });
    contactInvalid = { status: res.status, ok: res.status === 400 };
  } catch (error) {
    contactInvalid = { status: 0, ok: false, error: String(error) };
  }

  const summary = {
    routesPassed: failedRoutes.length === 0,
    contactValidOk: Boolean(contactValid?.ok && contactValid?.bodyOk),
    contactInvalidOk: Boolean(contactInvalid?.ok),
  };

  console.log(
    JSON.stringify({ routeResults, contactValid, contactInvalid, summary }, null, 2),
  );

  if (!summary.routesPassed || !summary.contactValidOk || !summary.contactInvalidOk) {
    process.exit(1);
  }
}

main();
