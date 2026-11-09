/**
 * Local static-export smoke checks (S3-style).
 * Serve `out/` with: npx serve out -p 3000
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
    "/about/",
    "/services/",
    "/services/cloud-aws-devops/",
    "/public-sector/",
    "/technology-partner/",
    "/how-we-work/",
    "/trust/",
    "/policies/",
    "/contact/",
    "/privacy/",
    "/cookies/",
    "/terms/",
    "/robots.txt",
    "/sitemap.xml",
  ];

  const routeResults = [];
  for (const path of routes) {
    try {
      routeResults.push(await checkGet(path));
    } catch (error) {
      routeResults.push({ path, status: 0, ok: false, error: String(error) });
    }
  }

  const failedRoutes = routeResults.filter((r) => !r.ok);
  const summary = { routesPassed: failedRoutes.length === 0, failedRoutes };
  console.log(JSON.stringify({ routeResults, summary }, null, 2));
  if (!summary.routesPassed) process.exit(1);
}

main();
