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

const DEPLOYED_RETRY_PERMISSION = {
  Type: "AWS::Lambda::Permission",
  Properties: {
    Action: "lambda:InvokeFunction",
    FunctionName: { Ref: "ContactRetryFunction" },
    Principal: "events.amazonaws.com",
    SourceArn: { "Fn::GetAtt": ["ContactRetryFunctionRetrySchedule", "Arn"] },
  },
};

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

function retryFunctionBlock(template) {
  const start = template.indexOf("  ContactRetryFunction:");
  const end = template.indexOf("  ContactHttpApi:");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("ContactRetryFunction block was not found.");
  }
  return template.slice(start, end);
}

/**
 * SAM's Schedule event generates this permission. It matches the permission
 * already deployed when the function name stays the demo literal and the
 * schedule does not set a rule name or SourceAccount.
 */
export function retrySchedulePermission(template) {
  const block = retryFunctionBlock(template);
  const functionName = block.match(/^ +FunctionName: (.+)$/m)?.[1] ?? "";
  const schedule = block.slice(block.indexOf("RetrySchedule:"));
  const risks = [];
  if (!functionName || /^[!{]/.test(functionName)) {
    risks.push("retry function name is not a literal");
  }
  if (functionName !== DEMO.retryFunction) {
    risks.push("retry function name differs from the deployed demo function");
  }
  if (/^ +Name:/m.test(schedule)) {
    risks.push("EventBridge rule name would replace the existing rule");
  }
  if (template.includes("SourceAccount")) {
    risks.push("SourceAccount would replace the Lambda permission");
  }
  if (!schedule.includes("Type: Schedule") || !schedule.includes("Schedule: rate(5 minutes)")) {
    risks.push("retry schedule changed");
  }
  return {
    functionName,
    requiresReplacement: risks.length > 0,
    risks,
    permission: DEPLOYED_RETRY_PERMISSION,
  };
}

export function renderContactTemplate(template, environment) {
  const target = targetForEnvironment(environment);
  if (/^ +(TableName|LogGroupName|FunctionName):\s*[!{]/m.test(template)) {
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
  if (environment === "demo" && retrySchedulePermission(rendered).requiresReplacement) {
    throw new Error("Demo retry permission would require replacement.");
  }
  writeFileSync(output, rendered);
}
