import { readFileSync } from "node:fs";

/**
 * Resources already deployed on the Demo contact stack. A Demo package that
 * omits any of them makes CloudFormation propose a deletion.
 */
export const PRESERVED_DEMO_ANALYTICS_IDS = [
  "AnalyticsMeasureFunction",
  "AnalyticsMeasureLogGroup",
  "AnalyticsMeasureRole",
  "AnalyticsMeasureFunctionPostMeasurePermission",
  "AnalyticsReportFunction",
  "AnalyticsReportLogGroup",
  "AnalyticsReportRole",
  "AnalyticsReportFunctionGetSummaryPermission",
  "TrafficStatsTable",
];

export const COLLECTOR_CODE_URI =
  "s3://aws-sam-cli-managed-default-samclisourcebucket-pjopzssdwf27/demo/087bcd8fc88fe771071d57216dbbe448";

const DEMO_ROUTES = ["/analytics/collect", "/analytics/measure", "/analytics/summary"];

const PRODUCTION_OMISSIONS = [
  ...PRESERVED_DEMO_ANALYTICS_IDS,
  ...DEMO_ROUTES,
  "AGGREGATE_MEASUREMENT_ENABLED",
  "AnalyticsDeployment",
  "DeployAnalytics",
  "occasionfun-co-uk-demo-traffic-stats",
  "occasionfun-co-uk-demo-analytics-measure",
  "occasionfun-co-uk-demo-analytics-report",
  "analytics-measure-dist/",
  "analytics-report-dist/",
  COLLECTOR_CODE_URI,
];

export function resourceBlock(template, logicalId) {
  const match = new RegExp(`^  ${logicalId}:\\s*$`, "m").exec(template);
  if (!match) return "";
  const rest = template.slice(match.index + match[0].length);
  const next = rest.search(/^  [A-Za-z]/m);
  return next === -1 ? template.slice(match.index) : template.slice(match.index, match.index + match[0].length + next);
}

function routeWindow(template, route) {
  const at = template.indexOf(`${route}:`);
  if (at === -1) return "";
  return template.slice(at, at + 800);
}

function measurementFlag(template) {
  return [...template.matchAll(/AGGREGATE_MEASUREMENT_ENABLED:\s*(?:"([^"]*)"|'([^']*)')/g)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
}

/**
 * Reject a Demo template that would drop a deployed analytics resource,
 * route, retention policy, or the pinned collector object.
 */
export function assertDemoAnalyticsTemplate(template, label = "Demo template") {
  if (typeof template !== "string" || template.trim() === "") {
    throw new Error(`${label} is empty.`);
  }
  const errors = [];
  const blocks = new Map();
  for (const id of PRESERVED_DEMO_ANALYTICS_IDS) {
    const block = resourceBlock(template, id);
    if (!block) errors.push(`${label} is missing ${id}.`);
    else blocks.set(id, block);
  }
  for (const route of DEMO_ROUTES) {
    if (!template.includes(route)) errors.push(`${label} is missing ${route}.`);
  }
  const summary = routeWindow(template, "/analytics/summary");
  if (summary && !summary.includes("AdminAccessTokenAuthorizer")) {
    errors.push(`${label} does not keep Cognito authorization on GET /analytics/summary.`);
  }
  if (summary && !summary.includes("AnalyticsReportFunction")) {
    errors.push(`${label} does not integrate GET /analytics/summary with AnalyticsReportFunction.`);
  }
  const measure = routeWindow(template, "/analytics/measure");
  if (measure && !measure.includes("AnalyticsMeasureFunction")) {
    errors.push(`${label} does not integrate POST /analytics/measure with AnalyticsMeasureFunction.`);
  }
  const collect = routeWindow(template, "/analytics/collect");
  if (collect && !collect.includes("AnalyticsIngestFunction")) {
    errors.push(`${label} does not integrate POST /analytics/collect with AnalyticsIngestFunction.`);
  }
  const flags = measurementFlag(template);
  if (flags.length !== 1 || flags[0] !== "false") {
    errors.push(`${label} must set AGGREGATE_MEASUREMENT_ENABLED to the string false exactly once.`);
  }
  const ingest = resourceBlock(template, "AnalyticsIngestFunction");
  const collectorUses = ingest ? ingest.split(COLLECTOR_CODE_URI).length - 1 : 0;
  if (!ingest || collectorUses !== 1 || ingest.includes("CodeUri: analytics-dist/")) {
    errors.push(`${label} must keep AnalyticsIngestFunction on the deployed collector object.`);
  }
  const table = blocks.get("TrafficStatsTable") ?? "";
  if (table && (!table.includes("DeletionPolicy: Retain") || !table.includes("UpdateReplacePolicy: Retain"))) {
    errors.push(`${label} must retain TrafficStatsTable on deletion and replacement.`);
  }
  const measureFunction = blocks.get("AnalyticsMeasureFunction") ?? "";
  if (measureFunction && measurementFlag(measureFunction).join(",") !== "false") {
    errors.push(`${label} must keep aggregate measurement disabled on AnalyticsMeasureFunction.`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

/** Production rendering must not carry Demo analytics resources or the collector object. */
export function assertProductionOmitsDemoAnalytics(template, label = "Production template") {
  if (typeof template !== "string" || template.trim() === "") {
    throw new Error(`${label} is empty.`);
  }
  const errors = [];
  for (const token of PRODUCTION_OMISSIONS) {
    if (template.includes(token)) errors.push(`${label} still contains ${token}.`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

function readOption(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  const value = argv[index + 1] ?? "";
  if (!value || value.startsWith("--")) throw new Error(`Pass a path after ${name}.`);
  return value;
}

const invokedDirectly = process.argv[1]?.endsWith("assert-demo-analytics-template.mjs");
if (invokedDirectly) {
  try {
    const templatePath = readOption(process.argv, "--template");
    const productionPath = readOption(process.argv, "--production-template");
    if (!templatePath && !productionPath) {
      throw new Error("Pass --template, --production-template, or both.");
    }
    if (templatePath) assertDemoAnalyticsTemplate(readFileSync(templatePath, "utf8"), templatePath);
    if (productionPath) {
      assertProductionOmitsDemoAnalytics(readFileSync(productionPath, "utf8"), productionPath);
    }
    console.log("Analytics template check passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Analytics template check failed.");
    process.exit(1);
  }
}
