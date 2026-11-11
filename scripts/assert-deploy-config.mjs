import { readFileSync } from "node:fs";
import {
  AWS_ACCOUNT_ID,
  AWS_REGION,
  DEMO,
  SMTP_SECRET_ARN,
  originsValue,
  targetFor,
} from "./deployment-targets.mjs";

/** @returns {Record<string, string>} */
export function parseFlatYaml(text) {
  /** @type {Record<string, string>} */
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf(":");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function assertDeployConfig(input) {
  const errors = [];
  const target = targetFor(input.environment);
  if (!target) {
    errors.push("Environment must be demo or prod.");
    return errors;
  }
  if (input.accountId !== AWS_ACCOUNT_ID) {
    errors.push("AWS account does not match the OccasionFun account.");
  }
  if (input.region !== AWS_REGION) {
    errors.push("AWS region must be eu-west-2.");
  }
  if (input.stackName !== target.stackName) {
    errors.push("Stack name does not match the selected environment.");
  }
  if (input.allowCreate !== target.allowCreate) {
    errors.push("Stack creation setting does not match the selected environment.");
  }
  if (input.expectedTable !== target.table) errors.push("DynamoDB table name is wrong for this environment.");
  if (input.expectedContactFunction !== target.contactFunction) {
    errors.push("Contact Lambda name is wrong for this environment.");
  }
  if (input.expectedRetryFunction !== target.retryFunction) {
    errors.push("Retry Lambda name is wrong for this environment.");
  }
  if (input.expectedContactLogGroup !== target.contactLogGroup) {
    errors.push("Contact log group name is wrong for this environment.");
  }
  if (input.expectedRetryLogGroup !== target.retryLogGroup) {
    errors.push("Retry log group name is wrong for this environment.");
  }
  if (input.parameters.Environment !== target.environment) {
    errors.push("CloudFormation Environment parameter does not match the deployment.");
  }
  if (input.parameters.SmtpSecretArn !== SMTP_SECRET_ARN) {
    errors.push("SMTP parameter must be the existing shared secret. This deployment does not create or replace it.");
  }
  if (input.parameters.AllowedOrigins !== originsValue(target.origins)) {
    errors.push("AllowedOrigins does not match the authorized list for this environment.");
  }
  if (input.parameters.AllowedOrigins?.includes("*")) {
    errors.push("Wildcard origins are not allowed.");
  }
  if (input.environment === "demo") {
    if (input.expectedApiId !== DEMO.apiId) errors.push("Demo API id must stay 0e6zpkvbkj.");
    if (input.expectedEndpoint !== DEMO.endpoint) {
      errors.push("Demo API endpoint must stay the existing execute-api endpoint.");
    }
  }
  if (input.environment === "prod") {
    if (input.stackName === DEMO.stackName) errors.push("Production must not update the demo stack.");
    if (input.expectedTable === DEMO.table) errors.push("Production must not use the demo DynamoDB table.");
    if ((input.expectedEndpoint ?? "").includes(DEMO.apiId)) {
      errors.push("Production must not use the demo API.");
    }
    if (input.parameters.AllowedOrigins.includes("amplifyapp.com")) {
      errors.push("Production origins must not include the Amplify demo hosts.");
    }
    for (const name of [
      input.expectedTable,
      input.expectedContactFunction,
      input.expectedRetryFunction,
    ]) {
      if (!name.includes("prod")) errors.push(`Production resource name is missing prod: ${name}`);
    }
  }
  return errors;
}

function option(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1 || !argv[index + 1]) {
    throw new Error(`Missing ${name}`);
  }
  return argv[index + 1];
}

export function configFromArgv(argv, parameters) {
  return {
    environment: option(argv, "--environment"),
    stackName: option(argv, "--stack-name"),
    accountId: option(argv, "--account-id"),
    region: option(argv, "--region"),
    allowCreate: option(argv, "--allow-create") === "true",
    expectedTable: option(argv, "--expected-table"),
    expectedContactFunction: option(argv, "--expected-contact-function"),
    expectedRetryFunction: option(argv, "--expected-retry-function"),
    expectedContactLogGroup: option(argv, "--expected-contact-log-group"),
    expectedRetryLogGroup: option(argv, "--expected-retry-log-group"),
    expectedApiId: argv.includes("--expected-api-id")
      ? option(argv, "--expected-api-id")
      : "",
    expectedEndpoint: argv.includes("--expected-endpoint")
      ? option(argv, "--expected-endpoint")
      : "",
    parameters,
  };
}

const invokedDirectly = process.argv[1]?.endsWith("assert-deploy-config.mjs");
if (invokedDirectly) {
  try {
    const parameters = parseFlatYaml(
      readFileSync(option(process.argv, "--parameters-file"), "utf8"),
    );
    const errors = assertDeployConfig(configFromArgv(process.argv, parameters));
    if (errors.length > 0) {
      for (const error of errors) console.error(error);
      process.exit(1);
    }
    console.log("Deployment configuration matches the selected environment.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Deployment configuration check failed.");
    process.exit(1);
  }
}
