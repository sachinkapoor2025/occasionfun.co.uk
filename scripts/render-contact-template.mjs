import { readFileSync, writeFileSync } from "node:fs";
import { DEMO, PRODUCTION } from "./deployment-targets.mjs";

/**
 * Physical names that CloudFormation replaces when the value changes.
 * The demo template stores the names already deployed. Production rendering
 * writes the production literals into a separate template. Neither template
 * uses Fn::If for these properties, so the demo stack is not asked to
 * conditionally replace them.
 */
const PHYSICAL_NAMES = [
  { property: "TableName", key: "table" },
  { property: "LogGroupName", key: "contactLogGroup" },
  { property: "LogGroupName", key: "retryLogGroup" },
  { property: "FunctionName", key: "contactFunction" },
  { property: "FunctionName", key: "retryFunction" },
];

/** API Gateway permissions that may name SourceAccount. The contact retry permission may not. */
const ADMIN_INVOKE_PERMISSION_IDS = new Set([
  "AdminAuthorizerInvokePermission",
  "AdminApiInvokePermission",
  "AdminEnquiryListInvokePermission",
  "AdminEnquirySummaryInvokePermission",
  "AdminEnquiryReadInvokePermission",
  "AdminEnquiryReviewInvokePermission",
  "AnalyticsReportFunctionGetSummaryPermission",
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function targetForEnvironment(environment) {
  if (environment === "demo") return DEMO;
  if (environment === "prod") return PRODUCTION;
  throw new Error("Environment must be demo or prod.");
}

function propertyLine(property, name) {
  return new RegExp(`^ +${property}: ${escapeRegExp(name)}$`, "m");
}

function resourceBlock(template, logicalId) {
  const start = template.indexOf(`  ${logicalId}:`);
  if (start === -1) throw new Error(`${logicalId} was not found.`);
  const rest = template.slice(start + 1);
  const next = rest.search(/\n {2}[A-Za-z]/);
  if (next === -1) throw new Error(`${logicalId} was not found.`);
  return template.slice(start, start + 1 + next);
}

function lineEnding(template) {
  return template.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * The demo application stack no longer owns the retry permission. Declaring
 * it here would make the next demo change set add or replace the retained
 * statement. The rule stays in this stack, without a physical name.
 */
export function retrySchedulePermission(template) {
  const rule = resourceBlock(template, "ContactRetryFunctionRetrySchedule");
  const retryFunction = resourceBlock(template, "ContactRetryFunction");
  const functionName = (retryFunction.match(/^ +FunctionName: (.+)$/m)?.[1] ?? "").trim();
  const declaresPermission = /^ {2}ContactRetryFunctionRetrySchedulePermission:/m.test(template);
  const risks = [];
  if (!functionName || /^[!{]/.test(functionName)) risks.push("retry function name is not a literal");
  if (functionName !== DEMO.retryFunction) {
    risks.push("retry function name differs from the deployed demo function");
  }
  if (declaresPermission) risks.push("demo template declares the retained retry permission");
  if (/^ +Name:/m.test(rule)) risks.push("EventBridge rule name would replace the existing rule");
  if (sourceAccountOutsideAdminPermissions(template)) {
    risks.push("SourceAccount would replace the Lambda permission");
  }
  if (!rule.includes("ScheduleExpression: rate(5 minutes)")) risks.push("retry schedule changed");
  if (!rule.includes("!GetAtt ContactRetryFunction.Arn")) {
    risks.push("rule target is not the retry function");
  }
  return {
    functionName,
    declaresPermission,
    requiresReplacement: risks.length > 0,
    risks,
  };
}

function declaresRetryPermission(template) {
  return /^ {2}ContactRetryFunctionRetrySchedulePermission:/m.test(template);
}

const CONTACT_NAMED_RESOURCES = [
  "LeadsTable",
  "ContactLogGroup",
  "ContactRetryLogGroup",
  "ContactFunction",
  "ContactRetryFunction",
];

/** Only contact physical names must stay literals. An admin permission's FunctionName ref is not one of them. */
function contactPhysicalNameIsIntrinsic(template) {
  return CONTACT_NAMED_RESOURCES.some((logicalId) =>
    /^ +(TableName|LogGroupName|FunctionName):\s*[!{]/m.test(resourceBlock(template, logicalId)),
  );
}

/**
 * SourceAccount on the contact retry rule or on any Lambda permission other
 * than the demo admin API permissions would replace the retained retry
 * permission. SourceAccount on those admin permissions is expected.
 */
function sourceAccountOutsideAdminPermissions(template) {
  const chunks = template.split(/\r?\n(?= {2}[A-Za-z0-9]+:)/);
  for (const chunk of chunks) {
    if (!chunk.includes("SourceAccount")) continue;
    const id = chunk.match(/(?:^|\n) {2}([A-Za-z0-9]+):/)?.[1];
    if (!id || !ADMIN_INVOKE_PERMISSION_IDS.has(id)) return true;
  }
  return false;
}

function removeMarkedRegion(template, beginLabel, endLabel) {
  const ending = lineEnding(template);
  const begin = `  # ${beginLabel}${ending}`;
  const end = `  # ${endLabel}${ending}`;
  const start = template.indexOf(begin);
  const stop = template.indexOf(end);
  if (start === -1 || stop === -1 || stop < start) {
    throw new Error(`Demo admin region ${beginLabel} was not found.`);
  }
  return template.slice(0, start) + template.slice(stop + end.length);
}

/** Production rendering drops every demo admin resource, output, condition, and phase parameter. */
function stripDemoAdmin(template) {
  let rendered = removeMarkedRegion(
    template,
    "BEGIN DEMO ADMIN PARAMETERS",
    "END DEMO ADMIN PARAMETERS",
  );
  rendered = removeMarkedRegion(
    rendered,
    "BEGIN DEMO ADMIN CONDITIONS",
    "END DEMO ADMIN CONDITIONS",
  );
  rendered = removeMarkedRegion(
    rendered,
    "BEGIN DEMO ADMIN RESOURCES",
    "END DEMO ADMIN RESOURCES",
  );
  rendered = removeMarkedRegion(rendered, "BEGIN DEMO ADMIN OUTPUTS", "END DEMO ADMIN OUTPUTS");
  rendered = removeMarkedRegion(
    rendered,
    "BEGIN DEMO ANALYTICS PARAMETERS",
    "END DEMO ANALYTICS PARAMETERS",
  );
  rendered = removeMarkedRegion(
    rendered,
    "BEGIN DEMO ANALYTICS CONDITIONS",
    "END DEMO ANALYTICS CONDITIONS",
  );
  rendered = removeMarkedRegion(
    rendered,
    "BEGIN DEMO ANALYTICS RESOURCES",
    "END DEMO ANALYTICS RESOURCES",
  );
  rendered = removeMarkedRegion(
    rendered,
    "BEGIN DEMO ANALYTICS OUTPUTS",
    "END DEMO ANALYTICS OUTPUTS",
  );
  for (const leftover of [
    "IsDemo",
    "AdminDeploymentPhase",
    "IsAdminIdentityPhase",
    "IsAdminApiPhase",
    "DeployAdminIdentity",
    "DeployAdminApi",
    "AdminUserPool",
    "AdminHttpApi",
    "admin-dist/",
    "SourceAccount",
    "BEGIN DEMO ADMIN",
    "occasionfun-co-uk-demo-users",
    "DeletionProtection",
    "DeletionPolicy",
    "UpdateReplacePolicy",
    "AnalyticsDeployment",
    "DeployAnalytics",
    "VisitorsTable",
    "PageViewsTable",
    "AnalyticsIngest",
    "AnalyticsHttpApi",
    "occasionfun-co-uk-demo-visitors",
    "occasionfun-co-uk-demo-page-views",
    "VISITORS_TABLE_NAME",
    "PAGE_VIEWS_TABLE_NAME",
    "/analytics/collect",
    "TrafficStatsTable",
    "AnalyticsMeasure",
    "occasionfun-co-uk-demo-traffic-stats",
    "occasionfun-co-uk-demo-analytics-measure",
    "TRAFFIC_STATS_TABLE_NAME",
    "AGGREGATE_MEASUREMENT_ENABLED",
    "GEOLITE2_COUNTRY_DB",
    "/analytics/measure",
    "analytics-measure-dist/",
    "AnalyticsReport",
    "occasionfun-co-uk-demo-analytics-report",
    "analytics-report-dist/",
    "/analytics/summary",
    "087bcd8fc88fe771071d57216dbbe448",
    "aws-sam-cli-managed-default-samclisourcebucket-pjopzssdwf27",
  ]) {
    if (rendered.includes(leftover)) {
      throw new Error(`Production template still contains ${leftover}.`);
    }
  }
  return rendered;
}

function nameProductionRetryRule(template) {
  const name = PRODUCTION.retryRuleName;
  if (name.length > 64 || !name.startsWith("occasionfun-co-uk-prod-contact-")) {
    throw new Error("Production retry rule name is outside the execution role permission.");
  }
  const ending = lineEnding(template);
  const needle = `ContactRetryFunctionRetrySchedule:${ending}    Type: AWS::Events::Rule${ending}    Properties:${ending}`;
  if (!template.includes(needle)) {
    throw new Error("Production retry rule properties were not found.");
  }
  const rule = resourceBlock(template, "ContactRetryFunctionRetrySchedule");
  if (/^ +Name:/m.test(rule)) {
    throw new Error("The source retry rule must not set Name.");
  }
  return template.replace(needle, `${needle}      Name: ${name}${ending}`);
}

export function renderContactTemplate(template, environment) {
  const target = targetForEnvironment(environment);
  if (declaresRetryPermission(template)) {
    throw new Error("The application template must not declare the retry permission.");
  }
  if (contactPhysicalNameIsIntrinsic(template)) {
    throw new Error(
      "Physical names must be literals. A conditional name can replace an existing demo resource.",
    );
  }
  let rendered = template;
  if (environment === "prod") {
    const replacements = [...PHYSICAL_NAMES].sort(
      (left, right) => DEMO[right.key].length - DEMO[left.key].length,
    );
    for (const { property, key } of replacements) {
      const pattern = new RegExp(`^( +${property}: )${escapeRegExp(DEMO[key])}$`, "gm");
      const matches = rendered.match(pattern);
      if (!matches || matches.length !== 1) {
        throw new Error(`Expected one ${property} literal for ${DEMO[key]}.`);
      }
      rendered = rendered.replace(pattern, `$1${target[key]}`);
    }
    rendered = nameProductionRetryRule(rendered);
    if (rendered.includes("GHXjmJNlS8ce") || rendered.includes(`function:${DEMO.retryFunction}`)) {
      throw new Error("Production template still targets the demo retry function or rule.");
    }
  } else {
    const demoPermission = retrySchedulePermission(rendered);
    if (demoPermission.requiresReplacement) {
      throw new Error(`Demo retry schedule is not safe: ${demoPermission.risks.join("; ")}`);
    }
  }
  if (declaresRetryPermission(rendered)) {
    throw new Error("The application template must not declare the retry permission.");
  }
  for (const { property, key } of PHYSICAL_NAMES) {
    if (!propertyLine(property, target[key]).test(rendered)) {
      throw new Error(`Missing literal ${property}: ${target[key]}`);
    }
  }
  if (environment === "prod") {
    for (const { property, key } of PHYSICAL_NAMES) {
      if (propertyLine(property, DEMO[key]).test(rendered)) {
        throw new Error(`Production template still contains ${DEMO[key]}.`);
      }
    }
    rendered = stripDemoAdmin(rendered);
  }
  return rendered;
}

function readOption(argv, name) {
  const index = argv.indexOf(name);
  const value = index === -1 ? "" : argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Pass ${name}.`);
  return value;
}

const invokedDirectly = process.argv[1]?.endsWith("render-contact-template.mjs");
if (invokedDirectly) {
  const environment = readOption(process.argv, "--environment");
  const output = readOption(process.argv, "--output");
  const source = new URL("../infra/contact-api/template.yaml", import.meta.url);
  const template = readFileSync(source, "utf8");
  const rendered = renderContactTemplate(template, environment);
  writeFileSync(output, rendered);
}
