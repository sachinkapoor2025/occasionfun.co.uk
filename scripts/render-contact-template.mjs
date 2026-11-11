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

const PRODUCTION_RETRY_PERMISSION = `  ContactRetryFunctionRetrySchedulePermission:
    Type: AWS::Lambda::Permission
    Properties:
      Action: lambda:InvokeFunction
      FunctionName: !Ref ContactRetryFunction
      Principal: events.amazonaws.com
      SourceArn: !GetAtt ContactRetryFunctionRetrySchedule.Arn
`;

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
  if (template.includes("SourceAccount")) risks.push("SourceAccount would replace the Lambda permission");
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

function insertProductionPermission(template) {
  if (/^ {2}ContactRetryFunctionRetrySchedulePermission:/m.test(template)) {
    throw new Error("The demo template must not declare the retry permission.");
  }
  const marker = "  ContactHttpApi:";
  const index = template.indexOf(marker);
  if (index === -1) throw new Error("ContactHttpApi was not found.");
  const block = PRODUCTION_RETRY_PERMISSION.replaceAll("\n", lineEnding(template));
  return template.slice(0, index) + block + template.slice(index);
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
    rendered = nameProductionRetryRule(rendered);
    rendered = insertProductionPermission(rendered);
    const permission = resourceBlock(rendered, "ContactRetryFunctionRetrySchedulePermission");
    if (!permission.includes("FunctionName: !Ref ContactRetryFunction")) {
      throw new Error("Production retry permission must reference its own function.");
    }
    if (!permission.includes("SourceArn: !GetAtt ContactRetryFunctionRetrySchedule.Arn")) {
      throw new Error("Production retry permission must reference its own rule.");
    }
    if (rendered.includes("GHXjmJNlS8ce") || rendered.includes(`function:${DEMO.retryFunction}`)) {
      throw new Error("Production template still targets the demo retry function or rule.");
    }
  } else {
    const demoPermission = retrySchedulePermission(rendered);
    if (demoPermission.requiresReplacement) {
      throw new Error(`Demo retry schedule is not safe: ${demoPermission.risks.join("; ")}`);
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
  writeFileSync(output, rendered);
}
