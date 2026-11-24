import { readFileSync } from "node:fs";
import { PROTECTED_LOGICAL_IDS } from "./deployment-targets.mjs";

const protectedIds = new Set(PROTECTED_LOGICAL_IDS);

/**
 * Logical IDs an update of the existing demo stack may add.
 * Every other addition is rejected. Contact resources are not in this list.
 * AdminHttpApiApiGatewayDefaultStage is absent from the source template.
 * The SAM translator emits that stage for AdminHttpApi when StageName is
 * $default. ContactHttpApiApiGatewayDefaultStage already exists and is not listed.
 */
export const ADMIN_UPDATE_ADDITIONS = [
  "AdminUserPool",
  "AdminUserPoolClient",
  "AdminGroup",
  "AdminAuthorizerLogGroup",
  "AdminApiLogGroup",
  "AdminAuthorizerRole",
  "AdminApiRole",
  "AdminAuthorizerFunction",
  "AdminAuthorizerInvokePermission",
  "AdminApiInvokePermission",
  "AdminEnquiryListInvokePermission",
  "AdminEnquirySummaryInvokePermission",
  "AdminEnquiryReadInvokePermission",
  "AdminEnquiryReviewInvokePermission",
  "AdminApiFunction",
  "AdminHttpApi",
  "AdminHttpApiApiGatewayDefaultStage",
];

/**
 * Exact logical IDs a demo update may add only when AnalyticsDeployment is enabled.
 * Production updates never add them. The list has no wildcards.
 * AnalyticsHttpApiApiGatewayDefaultStage is emitted by SAM for StageName $default.
 */
export const ANALYTICS_UPDATE_ADDITIONS = [
  "VisitorsTable",
  "PageViewsTable",
  "AnalyticsIngestLogGroup",
  "AnalyticsIngestRole",
  "AnalyticsIngestFunction",
  "AnalyticsIngestFunctionPostCollectPermission",
  "AnalyticsHttpApi",
  "AnalyticsHttpApiApiGatewayDefaultStage",
];

const adminAdditions = new Set(ADMIN_UPDATE_ADDITIONS);
const analyticsAdditions = new Set(ANALYTICS_UPDATE_ADDITIONS);

function analyticsAdditionsAllowed(environment, analyticsDeployment) {
  return environment === "demo" && analyticsDeployment === "enabled";
}

/**
 * An update of an existing stack may modify resources in place.
 * It may add only ADMIN_UPDATE_ADDITIONS.
 * Analytics IDs are additional only when environment is demo and
 * analyticsDeployment is enabled. Both values must be passed explicitly.
 * It may not remove or replace anything.
 * Protected logical ids: LeadsTable, ContactFunction, ContactRetryFunction,
 * ContactHttpApi, ContactLogGroup, ContactRetryLogGroup.
 * A create change set may add resources and still may not remove or replace them.
 * SAM's "No changes to deploy" message never reaches this checker.
 */
export function findUnsafeChanges(changes, { mode, environment = "", analyticsDeployment = "disabled" }) {
  const allowedAdditions = new Set(adminAdditions);
  if (analyticsAdditionsAllowed(environment, analyticsDeployment)) {
    for (const logicalId of analyticsAdditions) allowedAdditions.add(logicalId);
  }
  const findings = [];
  for (const change of changes ?? []) {
    const resource = change?.ResourceChange ?? {};
    const action = resource.Action ?? "";
    const replacement = resource.Replacement ?? "";
    const logicalId = resource.LogicalResourceId ?? "unknown";
    const reasons = [];
    if (action === "Remove") reasons.push("deletion");
    if (replacement === "True" || replacement === "Conditional") {
      reasons.push("replacement");
    }
    if (mode === "update" && action === "Add") {
      if (protectedIds.has(logicalId)) {
        reasons.push("protected resource would be created again");
      } else if (!allowedAdditions.has(logicalId)) {
        reasons.push("unexpected resource addition");
      }
    }
    if (reasons.length > 0) {
      findings.push({
        logicalId,
        action,
        replacement,
        resourceType: resource.ResourceType ?? "",
        reasons,
      });
    }
  }
  return findings;
}

export function inspectChangeSet(payload, mode, options = {}) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      error: "Change set JSON must be an object with a Changes array.",
    };
  }
  if (!Object.prototype.hasOwnProperty.call(payload, "Changes") || !Array.isArray(payload.Changes)) {
    return { ok: false, error: "Change set is missing the Changes array." };
  }
  if (payload.Changes.length === 0) {
    return {
      ok: false,
      error: "Change set has no resource changes. Refusing to execute an empty change set.",
    };
  }
  const findings = findUnsafeChanges(payload.Changes, {
    mode,
    environment: options.environment,
    analyticsDeployment: options.analyticsDeployment,
  });
  if (findings.length > 0) {
    return {
      ok: false,
      findings,
      error: "Change set proposes an unsafe resource change and was not executed.",
    };
  }
  return { ok: true, findings: [], count: payload.Changes.length };
}

export function inspectChangeSetFile(file, mode, options = {}) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error("Change set file is missing.");
    }
    throw new Error("Change set file is unreadable.");
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Change set file is not valid JSON.");
  }
  return inspectChangeSet(payload, mode, options);
}

function readOptionalArgument(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Pass a value after ${flag}.`);
  }
  return value;
}

function printFindings(findings) {
  console.error("Change set proposes an unsafe resource change and was not executed.");
  for (const finding of findings) {
    console.error(
      `${finding.logicalId} action=${finding.action} replacement=${finding.replacement || "n/a"} ${finding.reasons.join(", ")}`,
    );
  }
}

function readMode(argv) {
  const index = argv.indexOf("--mode");
  const mode = index === -1 ? "" : argv[index + 1];
  if (mode !== "update" && mode !== "create") {
    throw new Error("Change set mode must be update or create.");
  }
  return mode;
}

function readFileArgument(argv) {
  const index = argv.indexOf("--file");
  const file = index === -1 ? "" : argv[index + 1];
  if (!file || file.startsWith("--")) {
    throw new Error("Pass --file with the change set JSON path.");
  }
  return file;
}

const invokedDirectly = process.argv[1]?.endsWith("assert-safe-change-set.mjs");
if (invokedDirectly) {
  try {
    const result = inspectChangeSetFile(readFileArgument(process.argv), readMode(process.argv), {
      environment: readOptionalArgument(process.argv, "--environment"),
      analyticsDeployment: readOptionalArgument(process.argv, "--analytics-deployment"),
    });
    if (!result.ok) {
      if (result.findings?.length) printFindings(result.findings);
      else console.error(result.error);
      process.exit(1);
    }
    console.log(`Change set is safe to execute (${result.count} resource change(s)).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Change set inspection failed.");
    process.exit(1);
  }
}
