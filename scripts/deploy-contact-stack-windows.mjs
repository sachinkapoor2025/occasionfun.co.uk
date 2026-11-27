/**
 * Windows-native Demo change-set runner for the contact stack.
 *
 * PowerShell cannot launch WSL `/bin/bash`, so this file repeats
 * scripts/deploy-contact-stack.sh without a shell script. It keeps the
 * Bash script unchanged for CI and for systems that have Bash.
 *
 * Usage (from the repository root, after the documented sam build):
 *
 *   node scripts/deploy-contact-stack-windows.mjs ^
 *     --environment demo ^
 *     --stack-name occasionfun-co-uk-contact ^
 *     --parameters-file demo-api-parameters.yaml ^
 *     --allow-create false ^
 *     --no-execute ^
 *     --expected-report-sha256 <64-hex-sha256> ^
 *     --expected-table occasionfun-co-uk-leads ^
 *     --expected-contact-function occasionfun-co-uk-contact ^
 *     --expected-retry-function occasionfun-co-uk-contact-retry ^
 *     --expected-contact-log-group /aws/lambda/occasionfun-co-uk-contact ^
 *     --expected-retry-log-group /aws/lambda/occasionfun-co-uk-contact-retry ^
 *     --expected-api-id 0e6zpkvbkj ^
 *     --expected-endpoint https://0e6zpkvbkj.execute-api.eu-west-2.amazonaws.com/contact
 *
 * --check-only validates arguments and the parameter file and does not call AWS.
 * --no-execute is mandatory for every path that talks to AWS. This file never
 * runs a change set. Credentials come from the AWS CLI chain (an SSO
 * session is enough). The runner does not read or set access keys.
 *
 * The Bash script refuses to start unless AWS_ACCESS_KEY_ID and
 * AWS_SECRET_ACCESS_KEY are set, which an SSO session does not provide.
 * This runner instead requires aws sts get-caller-identity to return account
 * 796174527529 in eu-west-2, then runs the same assert-deploy-config and
 * assert-safe-change-set checks. A failed safety check still deletes the
 * unexecuted change set.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertDemoAnalyticsTemplate } from "./assert-demo-analytics-template.mjs";
import { assertDeployConfig, parseFlatYaml } from "./assert-deploy-config.mjs";
import { inspectChangeSet } from "./assert-safe-change-set.mjs";
import { classifyDescribeStacks } from "./classify-stack-describe.mjs";
import { AWS_ACCOUNT_ID, AWS_REGION, DEMO } from "./deployment-targets.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEMO_CLOUDFORMATION_ROLE_ARN =
  "arn:aws:iam::796174527529:role/occasionfun-cloudformation-demo";
export const PRODUCTION_CLOUDFORMATION_ROLE_ARN =
  "arn:aws:iam::796174527529:role/occasionfun-cloudformation-production";
export const EXPECTED_CALLER_ROLE =
  "assumed-role/AWSReservedSSO_AdministratorAccess_34a9613e80846402/";
export const TRAFFIC_STATS_TABLE_NAME = "occasionfun-co-uk-demo-traffic-stats";
export const STABLE_STACK_STATUSES = [
  "CREATE_COMPLETE",
  "UPDATE_COMPLETE",
  "UPDATE_ROLLBACK_COMPLETE",
  "IMPORT_COMPLETE",
];

export const EXPECTED_ANALYTICS_REPORT_CHANGES = [
  { logicalId: "AnalyticsReportLogGroup", action: "Add" },
  { logicalId: "AnalyticsReportRole", action: "Add" },
  { logicalId: "AnalyticsReportFunction", action: "Add" },
  { logicalId: "AnalyticsReportFunctionGetSummaryPermission", action: "Add" },
  { logicalId: "AdminHttpApi", action: "Modify" },
];

const UNCHANGED_LOGICAL_IDS = new Set([
  "AnalyticsIngestFunction",
  "AnalyticsIngestLogGroup",
  "AnalyticsIngestRole",
  "AnalyticsIngestFunctionPostCollectPermission",
  "AnalyticsMeasureFunction",
  "AnalyticsMeasureLogGroup",
  "AnalyticsMeasureRole",
  "AnalyticsMeasureFunctionPostMeasurePermission",
  "AnalyticsHttpApi",
  "AnalyticsHttpApiApiGatewayDefaultStage",
  "TrafficStatsTable",
  "VisitorsTable",
  "PageViewsTable",
  "AdminAuthorizerFunction",
  "AdminAuthorizerRole",
  "AdminAuthorizerLogGroup",
  "AdminAuthorizerInvokePermission",
  "AdminUserPool",
  "AdminUserPoolClient",
  "AdminGroup",
  "AdminApiFunction",
  "AdminApiRole",
  "LeadsTable",
  "ContactFunction",
  "ContactRetryFunction",
  "ContactHttpApi",
  "ContactLogGroup",
  "ContactRetryLogGroup",
  "ContactHttpApiApiGatewayDefaultStage",
]);

const VALUE_FLAGS = {
  "--environment": "environment",
  "--stack-name": "stackName",
  "--parameters-file": "parametersFile",
  "--allow-create": "allowCreate",
  "--expected-table": "expectedTable",
  "--expected-contact-function": "expectedContactFunction",
  "--expected-retry-function": "expectedRetryFunction",
  "--expected-contact-log-group": "expectedContactLogGroup",
  "--expected-retry-log-group": "expectedRetryLogGroup",
  "--expected-api-id": "expectedApiId",
  "--expected-endpoint": "expectedEndpoint",
  "--role-arn": "requestedRoleArn",
  "--expected-report-sha256": "expectedReportSha256",
  "--change-set-output": "changeSetOutput",
};

export function parseDeployArgs(argv) {
  const args = {
    environment: "",
    stackName: "",
    parametersFile: "",
    allowCreate: "",
    expectedTable: "",
    expectedContactFunction: "",
    expectedRetryFunction: "",
    expectedContactLogGroup: "",
    expectedRetryLogGroup: "",
    expectedApiId: "",
    expectedEndpoint: "",
    requestedRoleArn: "",
    expectedReportSha256: "",
    changeSetOutput: "",
    checkOnly: false,
    noExecute: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--check-only") {
      args.checkOnly = true;
      continue;
    }
    if (token === "--no-execute") {
      args.noExecute = true;
      continue;
    }
    const property = VALUE_FLAGS[token];
    if (!property) throw new Error(`Unknown argument: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Pass a value after ${token}.`);
    args[property] = value;
    index += 1;
  }
  return args;
}

export function cloudFormationRole(environment, requestedRoleArn) {
  if (environment === "demo") {
    if (requestedRoleArn && requestedRoleArn !== DEMO_CLOUDFORMATION_ROLE_ARN) {
      return {
        error: `Demo deployment rejected a different CloudFormation execution role.\nExpected: ${DEMO_CLOUDFORMATION_ROLE_ARN}`,
      };
    }
    return {
      arn: DEMO_CLOUDFORMATION_ROLE_ARN,
      message: `Demo change sets use CloudFormation role ${DEMO_CLOUDFORMATION_ROLE_ARN}.`,
    };
  }
  if (environment === "prod") {
    if (requestedRoleArn === DEMO_CLOUDFORMATION_ROLE_ARN) {
      return { error: "Production cannot use the demo CloudFormation execution role." };
    }
    if (requestedRoleArn && requestedRoleArn !== PRODUCTION_CLOUDFORMATION_ROLE_ARN) {
      return {
        error: `Production deployment rejected a different CloudFormation execution role.\nExpected: ${PRODUCTION_CLOUDFORMATION_ROLE_ARN}`,
      };
    }
    return {
      arn: PRODUCTION_CLOUDFORMATION_ROLE_ARN,
      message: `Production change sets use CloudFormation role ${PRODUCTION_CLOUDFORMATION_ROLE_ARN}.`,
    };
  }
  return { error: "Environment must be demo or prod." };
}

export function validateWindowsInvocation(args) {
  const errors = [];
  if (!args.checkOnly && !args.noExecute) {
    errors.push("This Windows runner does not execute change sets. Pass --no-execute.");
  }
  if (!args.checkOnly && args.environment !== "demo") {
    errors.push("This Windows runner only prepares the demo change set. Pass --environment demo and --no-execute.");
  }
  if (args.allowCreate !== "true" && args.allowCreate !== "false") {
    errors.push("Pass --allow-create true or false.");
  }
  if (args.environment === "demo" || args.environment === "prod") {
    const role = cloudFormationRole(args.environment, args.requestedRoleArn);
    if (role.error) errors.push(role.error);
  } else if (!args.checkOnly) {
    errors.push("Pass --environment demo.");
  }
  const haystack = [
    args.stackName,
    args.parametersFile,
    args.expectedTable,
    args.expectedContactFunction,
    args.expectedRetryFunction,
    args.expectedContactLogGroup,
    args.expectedRetryLogGroup,
    args.expectedApiId,
    args.expectedEndpoint,
    args.requestedRoleArn,
    args.changeSetOutput,
  ].join("\n");
  if (
    args.environment !== "prod" &&
    /occasionfun-co-uk-prod|occasionfun-cloudformation-production/.test(haystack)
  ) {
    errors.push("Production resources are not targeted by this Windows runner.");
  }
  if (!args.checkOnly && !/^[a-f0-9]{64}$/.test(args.expectedReportSha256)) {
    errors.push(
      "Pass --expected-report-sha256 with the 64-character SHA-256 of analytics-report-dist/report.js.",
    );
  }
  return errors;
}

export function readSamDeployResult(log) {
  const text = String(log ?? "").replace(/\r/g, "");
  const bucketMatch = text.match(/Deployment s3 bucket[^:]*:\s*(\S+)/);
  const arns = [...text.matchAll(/arn:aws:cloudformation:\S*changeSet\S*/g)].map((match) =>
    match[0].replace(/[),.;]+$/g, ""),
  );
  return {
    bucket: bucketMatch?.[1] ?? "",
    arn: arns.at(-1) ?? "",
    noChanges: text.includes("No changes to deploy"),
  };
}

export function assertArtifactBucket(bucket) {
  if (!bucket) throw new Error("Deployment artifact bucket was not reported. No change set was executed.");
  if (bucket === "occasionfun.co.uk" || bucket === "www.occasionfun.co.uk") {
    throw new Error("Refusing to store deployment artifacts in a website bucket.");
  }
}

export function assertMeasurementDisabled(templateText, label) {
  const text = String(templateText);
  const values = [...text.matchAll(/AGGREGATE_MEASUREMENT_ENABLED:\s*(?:"([^"]*)"|'([^']*)')/g)].map(
    (match) => match[1] ?? match[2],
  );
  if (values.length !== 1 || values[0] !== "false") {
    throw new Error(`${label} must set AGGREGATE_MEASUREMENT_ENABLED to the string false exactly once.`);
  }
}

export function assertNoProductionResourceAssignment(templateText) {
  const hits = String(templateText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
      /^(FunctionName|TableName|RoleName|LogGroupName|Name|StackName):\s*.*(occasionfun-co-uk-prod|occasionfun-cloudformation-production)\b/.test(
        line,
      ),
    );
  if (hits.length > 0) {
    throw new Error(`Template assigns a production resource:\n${hits.join("\n")}`);
  }
}

export function assertMeasureUrlUnset(env) {
  if (env.NEXT_PUBLIC_ANALYTICS_MEASURE_URL) {
    throw new Error("NEXT_PUBLIC_ANALYTICS_MEASURE_URL must remain unset.");
  }
}

export function reviewAnalyticsReportChangeSet(changes) {
  const findings = [];
  const seen = new Map();
  for (const change of changes ?? []) {
    const resource = change?.ResourceChange ?? {};
    const logicalId = resource.LogicalResourceId ?? "unknown";
    const action = resource.Action ?? "";
    const replacement = resource.Replacement ?? "";
    if (UNCHANGED_LOGICAL_IDS.has(logicalId)) {
      findings.push(
        `${logicalId} must remain unchanged (action=${action}, replacement=${replacement || "n/a"}).`,
      );
    }
    if (action === "Remove") findings.push(`${logicalId} would be removed.`);
    if (replacement === "True" || replacement === "Conditional") {
      findings.push(`${logicalId} would be replaced (${replacement}).`);
    }
    seen.set(logicalId, { action, replacement });
  }
  for (const expected of EXPECTED_ANALYTICS_REPORT_CHANGES) {
    const actual = seen.get(expected.logicalId);
    if (!actual) findings.push(`Missing ${expected.logicalId}.`);
    else if (actual.action !== expected.action) {
      findings.push(`${expected.logicalId} action is ${actual.action}, expected ${expected.action}.`);
    }
  }
  const expectedIds = new Set(EXPECTED_ANALYTICS_REPORT_CHANGES.map((item) => item.logicalId));
  for (const logicalId of seen.keys()) {
    if (!expectedIds.has(logicalId)) findings.push(`Unexpected resource ${logicalId}.`);
  }
  const admin = seen.get("AdminHttpApi");
  if (admin && admin.action === "Modify" && admin.replacement !== "False") {
    findings.push(`AdminHttpApi replacement is ${admin.replacement || "n/a"}, expected False.`);
  }
  return findings;
}

export function changeSetDisposition(safetyOk, reviewFindings) {
  if (!safetyOk) return "delete";
  if (reviewFindings.length === 0) return "keep";
  const protectedFinding = reviewFindings.some(
    (finding) =>
      finding.includes("must remain unchanged") ||
      finding.includes("would be removed") ||
      finding.includes("would be replaced"),
  );
  return protectedFinding ? "delete" : "retain";
}

function parameterOverrideArgument(file) {
  return `file://${path.resolve(file).replace(/\\/g, "/")}`;
}

function quoteCmd(value) {
  if (value.length === 0) return '""';
  if (!/[\s"&|<>^]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function runCli(command, args, { allowFailure = false } = {}) {
  const invoke =
    process.platform === "win32" && command === "sam"
      ? {
          command: process.env.ComSpec || "cmd.exe",
          args: ["/d", "/s", "/c", ["sam", ...args.map(quoteCmd)].join(" ")],
        }
      : { command, args };
  const result = spawnSync(invoke.command, invoke.args, {
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw new Error(`Could not start ${command}: ${result.error.message}`);
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `${command} exited ${result.status}.\n${(result.stderr || result.stdout || "").trim()}`,
    );
  }
  return result;
}

function awsJson(args) {
  const result = runCli("aws", [...args, "--region", AWS_REGION, "--output", "json"]);
  return JSON.parse(result.stdout);
}

function physicalId(stackName, logicalId) {
  const detail = awsJson([
    "cloudformation",
    "describe-stack-resource",
    "--stack-name",
    stackName,
    "--logical-resource-id",
    logicalId,
  ]);
  return detail.StackResourceDetail?.PhysicalResourceId ?? "";
}

function requirePhysical(stackName, logicalId, expected) {
  const actual = physicalId(stackName, logicalId);
  if (actual !== expected) {
    throw new Error(
      `Resource ${logicalId} does not have the expected physical name.\nExpected: ${expected}\nActual: ${actual}`,
    );
  }
}

function summariseChange(change) {
  const resource = change?.ResourceChange ?? {};
  return {
    logicalId: resource.LogicalResourceId ?? "",
    resourceType: resource.ResourceType ?? "",
    action: resource.Action ?? "",
    replacement: resource.Replacement ?? "",
    scope: resource.Scope ?? [],
    details: resource.Details ?? [],
  };
}

function analyticsDeployment(parameters) {
  const value = parameters.AnalyticsDeployment ?? "";
  if (!value) return "disabled";
  if (value !== "enabled" && value !== "disabled") {
    throw new Error("AnalyticsDeployment must be enabled or disabled.");
  }
  return value;
}

async function waitForChangeSet(arn) {
  let description = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    description = awsJson(["cloudformation", "describe-change-set", "--change-set-name", arn]);
    const status = description.Status ?? "";
    if (status === "CREATE_COMPLETE") return description;
    if (status === "FAILED") {
      throw new Error(
        `Change set failed and was not executed.\n${description.StatusReason || "No reason reported."}`,
      );
    }
    if (status !== "CREATE_PENDING" && status !== "CREATE_IN_PROGRESS") {
      throw new Error(`Unexpected change set status: ${status}. It was not executed.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Change set was not ready. It was not executed.");
}

function allChanges(arn, firstPage) {
  const changes = [...(firstPage.Changes ?? [])];
  let token = firstPage.NextToken || "";
  while (token) {
    const page = awsJson([
      "cloudformation",
      "describe-change-set",
      "--change-set-name",
      arn,
      "--next-token",
      token,
    ]);
    changes.push(...(page.Changes ?? []));
    token = page.NextToken || "";
  }
  return changes;
}

function saveChangeSet(file, payload) {
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Change set inventory: ${file}`);
}

function printInventory(changes) {
  for (const change of changes.map(summariseChange)) {
    console.log(
      [
        change.logicalId,
        change.resourceType,
        change.action,
        change.replacement || "n/a",
        change.scope.join("|") || "n/a",
      ].join("\t"),
    );
  }
}

function deleteUnexecuted(arn) {
  console.error("Deleting the unexecuted change set.");
  const deleted = runCli(
    "aws",
    ["cloudformation", "delete-change-set", "--change-set-name", arn, "--region", AWS_REGION],
    { allowFailure: true },
  );
  if (deleted.status !== 0) console.error((deleted.stderr || "").trim());
}

async function prepareChangeSet(args) {
  process.env.AWS_REGION = AWS_REGION;
  process.env.AWS_DEFAULT_REGION = AWS_REGION;
  assertMeasureUrlUnset(process.env);

  const reportPath = path.join(root, "infra/contact-api/analytics-report-dist/report.js");
  if (!existsSync(reportPath)) throw new Error(`Report bundle is missing: ${reportPath}`);
  const reportBytes = readFileSync(reportPath);
  const digest = createHash("sha256").update(reportBytes).digest("hex");
  if (digest !== args.expectedReportSha256) {
    throw new Error(
      `Report bundle SHA-256 does not match.\nExpected: ${args.expectedReportSha256}\nActual: ${digest}`,
    );
  }
  console.log(`Report bundle SHA-256 matches (${reportBytes.length} bytes).`);

  const sourceTemplate = readFileSync(path.join(root, "infra/contact-api/template.yaml"), "utf8");
  assertMeasurementDisabled(sourceTemplate, "infra/contact-api/template.yaml");
  assertNoProductionResourceAssignment(sourceTemplate);
  assertDemoAnalyticsTemplate(sourceTemplate, "infra/contact-api/template.yaml");
  const builtTemplatePath = path.join(root, "infra/contact-api/.aws-sam/build/template.yaml");
  if (!existsSync(builtTemplatePath)) {
    throw new Error("SAM build output is missing. Run sam build before deployment.");
  }
  const builtTemplate = readFileSync(builtTemplatePath, "utf8");
  assertMeasurementDisabled(builtTemplate, "SAM build template");
  assertNoProductionResourceAssignment(builtTemplate);
  assertDemoAnalyticsTemplate(builtTemplate, "SAM build template");
  if (existsSync(path.join(root, "infra/contact-api/.aws-sam/build/AnalyticsIngestFunction"))) {
    throw new Error("SAM rebuilt the existing analytics collector.");
  }

  const identity = awsJson(["sts", "get-caller-identity"]);
  if (identity.Account !== AWS_ACCOUNT_ID) {
    throw new Error("AWS account does not match the OccasionFun account.");
  }
  if (!String(identity.Arn ?? "").includes(EXPECTED_CALLER_ROLE)) {
    throw new Error(`Caller is not the reauthenticated administrator role.\nActual: ${identity.Arn}`);
  }
  if (
    String(identity.Arn).includes("occasionfun-cloudformation-production") ||
    String(identity.Arn).includes("prod-contact")
  ) {
    throw new Error("Caller identity targets production. No change set was created.");
  }
  console.log(`Caller: ${identity.Arn}`);
  console.log(`Account: ${identity.Account}`);
  console.log(`Region: ${AWS_REGION}`);

  const parameters = parseFlatYaml(readFileSync(args.parametersFile, "utf8"));
  const configErrors = assertDeployConfig({
    environment: args.environment,
    stackName: args.stackName,
    accountId: identity.Account,
    region: AWS_REGION,
    allowCreate: args.allowCreate === "true",
    expectedTable: args.expectedTable,
    expectedContactFunction: args.expectedContactFunction,
    expectedRetryFunction: args.expectedRetryFunction,
    expectedContactLogGroup: args.expectedContactLogGroup,
    expectedRetryLogGroup: args.expectedRetryLogGroup,
    expectedApiId: args.expectedApiId,
    expectedEndpoint: args.expectedEndpoint,
    parameters,
  });
  if (configErrors.length > 0) {
    throw new Error(configErrors.join("\n"));
  }
  console.log("Deployment configuration matches the selected environment.");
  console.log("AWS account matches.");

  const role = awsJson(["iam", "get-role", "--role-name", "occasionfun-cloudformation-demo"]);
  if (role.Role?.Arn !== DEMO_CLOUDFORMATION_ROLE_ARN) {
    throw new Error("Demo CloudFormation execution role ARN does not match.");
  }
  if (!JSON.stringify(role.Role?.AssumeRolePolicyDocument ?? {}).includes("cloudformation.amazonaws.com")) {
    throw new Error("Demo CloudFormation execution role does not trust CloudFormation.");
  }
  console.log(`Demo execution role is available: ${role.Role.Arn}`);

  const described = runCli(
    "aws",
    ["cloudformation", "describe-stacks", "--stack-name", args.stackName, "--region", AWS_REGION, "--output", "json"],
    { allowFailure: true },
  );
  const classification = classifyDescribeStacks({
    exitStatus: described.status ?? 1,
    stderr: described.stderr || "",
    stackName: args.stackName,
  });
  if (classification.result !== "exists") {
    throw new Error(
      `Could not determine whether stack ${args.stackName} exists (${classification.reason || classification.result}). No change set was created.`,
    );
  }
  const stack = JSON.parse(described.stdout).Stacks?.[0];
  if (!stack || stack.StackName !== DEMO.stackName) {
    throw new Error("Described stack is not the demo contact stack. No change set was created.");
  }
  if (!String(stack.StackId).includes(`:${AWS_ACCOUNT_ID}:`) || !String(stack.StackId).includes(`:${AWS_REGION}:`)) {
    throw new Error("Demo stack is not in the OccasionFun account and eu-west-2.");
  }
  if (!STABLE_STACK_STATUSES.includes(stack.StackStatus)) {
    throw new Error(`Stack ${args.stackName} is ${stack.StackStatus}. Refusing to create a change set.`);
  }
  requirePhysical(args.stackName, "LeadsTable", args.expectedTable);
  requirePhysical(args.stackName, "ContactFunction", args.expectedContactFunction);
  requirePhysical(args.stackName, "ContactRetryFunction", args.expectedRetryFunction);
  requirePhysical(args.stackName, "ContactLogGroup", args.expectedContactLogGroup);
  requirePhysical(args.stackName, "ContactRetryLogGroup", args.expectedRetryLogGroup);
  requirePhysical(args.stackName, "ContactHttpApi", args.expectedApiId);
  requirePhysical(args.stackName, "TrafficStatsTable", TRAFFIC_STATS_TABLE_NAME);
  const endpoint = (stack.Outputs ?? []).find((output) => output.OutputKey === "ContactEndpoint")?.OutputValue;
  if (endpoint !== args.expectedEndpoint) {
    throw new Error(
      `Deployed API endpoint is not the existing demo endpoint.\nExpected: ${args.expectedEndpoint}\nActual: ${endpoint}`,
    );
  }
  console.log("Contact endpoint check passed.");
  console.log(`Traffic-stats table ${TRAFFIC_STATS_TABLE_NAME} is managed by ${args.stackName}.`);

  const samArgs = [
    "deploy",
    "--template-file",
    builtTemplatePath,
    "--stack-name",
    args.stackName,
    "--region",
    AWS_REGION,
    "--capabilities",
    "CAPABILITY_IAM",
    "CAPABILITY_NAMED_IAM",
    "CAPABILITY_AUTO_EXPAND",
    "--resolve-s3",
    "--s3-prefix",
    args.environment,
    "--no-execute-changeset",
    "--no-confirm-changeset",
    "--no-fail-on-empty-changeset",
    "--parameter-overrides",
    parameterOverrideArgument(args.parametersFile),
    "--role-arn",
    DEMO_CLOUDFORMATION_ROLE_ARN,
  ];
  console.log(`Creating an unexecuted change set with: sam ${samArgs.join(" ")}`);
  const deploy = runCli("sam", samArgs, { allowFailure: true });
  const log = `${deploy.stdout || ""}\n${deploy.stderr || ""}`;
  if (deploy.status !== 0) {
    console.error(log.trim());
    throw new Error("Change set creation failed. No change set was executed.");
  }
  const parsed = readSamDeployResult(log);
  assertArtifactBucket(parsed.bucket);
  console.log(`Deployment artifact bucket: ${parsed.bucket}`);
  if (parsed.noChanges) {
    throw new Error(
      "CloudFormation reported no changes. The analytics report resources were not added. No change set was executed.",
    );
  }
  if (!parsed.arn) throw new Error("Change set ARN was not found. No change set was executed.");

  const ready = await waitForChangeSet(parsed.arn);
  const changes = allChanges(parsed.arn, ready);
  const inventoryPath =
    args.changeSetOutput || path.join(tmpdir(), "occasionfun-demo-analytics-report-changeset.json");
  const payload = {
    ChangeSetId: ready.ChangeSetId ?? parsed.arn,
    StackName: ready.StackName ?? args.stackName,
    Status: ready.Status,
    StatusReason: ready.StatusReason ?? "",
    ExecutionStatus: ready.ExecutionStatus ?? "",
    Changes: changes,
  };
  saveChangeSet(inventoryPath, payload);
  printInventory(changes);

  const safety = inspectChangeSet(
    { Changes: changes },
    "update",
    { environment: "demo", analyticsDeployment: analyticsDeployment(parameters) },
  );
  const reviewFindings = reviewAnalyticsReportChangeSet(changes);
  const disposition = changeSetDisposition(safety.ok, reviewFindings);
  if (!safety.ok) {
    console.error(safety.error || "Change set proposes an unsafe resource change and was not executed.");
    for (const finding of safety.findings ?? []) {
      console.error(
        `${finding.logicalId} action=${finding.action} replacement=${finding.replacement || "n/a"} ${finding.reasons.join(", ")}`,
      );
    }
  }
  for (const finding of reviewFindings) console.error(finding);
  if (disposition === "delete") {
    deleteUnexecuted(parsed.arn);
    throw new Error("Change set was not executed.");
  }
  if (disposition === "retain") {
    throw new Error("Change set does not match the analytics report review and was not executed.");
  }
  if (payload.Status !== "CREATE_COMPLETE" || payload.ExecutionStatus === "EXECUTE_COMPLETE" || payload.ExecutionStatus === "EXECUTE_IN_PROGRESS") {
    throw new Error(`Change set ${parsed.arn} is ${payload.Status} / ${payload.ExecutionStatus}. It was not executed by this runner.`);
  }
  console.log("Change set passed the safety check and was not executed.");
  console.log(`Change set ARN: ${payload.ChangeSetId}`);
  console.log(`Change set status: ${payload.Status}`);
  console.log(`Execution status: ${payload.ExecutionStatus}`);
}

function checkOnly(args) {
  if (args.environment !== "demo" && args.environment !== "prod") {
    throw new Error("Environment must be demo or prod.");
  }
  const role = cloudFormationRole(args.environment, args.requestedRoleArn);
  if (role.error) throw new Error(role.error);
  console.log(role.message);
  const parameters = parseFlatYaml(readFileSync(args.parametersFile, "utf8"));
  const errors = assertDeployConfig({
    environment: args.environment,
    stackName: args.stackName,
    accountId: AWS_ACCOUNT_ID,
    region: AWS_REGION,
    allowCreate: args.allowCreate === "true",
    expectedTable: args.expectedTable,
    expectedContactFunction: args.expectedContactFunction,
    expectedRetryFunction: args.expectedRetryFunction,
    expectedContactLogGroup: args.expectedContactLogGroup,
    expectedRetryLogGroup: args.expectedRetryLogGroup,
    expectedApiId: args.expectedApiId,
    expectedEndpoint: args.expectedEndpoint,
    parameters,
  });
  if (errors.length > 0) throw new Error(errors.join("\n"));
  console.log("Deployment configuration matches the selected environment.");
  console.log("AWS account matches.");
  console.log("Configuration check only. No change set was created.");
}

const invokedDirectly = process.argv[1]?.endsWith("deploy-contact-stack-windows.mjs");
if (invokedDirectly) {
  try {
    const args = parseDeployArgs(process.argv.slice(2));
    const errors = validateWindowsInvocation(args);
    if (errors.length > 0) throw new Error(errors.join("\n"));
    if (args.checkOnly) checkOnly(args);
    else await prepareChangeSet(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Deployment failed.");
    process.exit(1);
  }
}
