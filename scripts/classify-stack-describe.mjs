import { readFileSync } from "node:fs";

/**
 * Classify a describe-stacks result.
 * A stack is missing only when CloudFormation reports ValidationError and
 * the exact "Stack with id <name-or-arn> does not exist" line.
 * Every other failure stays a failure.
 */

const ACCESS_DENIED = [
  "An error occurred (AccessDenied) when calling the DescribeStacks operation:",
  "An error occurred (AccessDeniedException) when calling the DescribeStacks operation:",
];

const INVALID_CREDENTIALS = [
  "Unable to locate credentials. You can configure credentials by running \"aws configure\".",
  "An error occurred (InvalidClientTokenId) when calling the DescribeStacks operation:",
  "An error occurred (UnrecognizedClientException) when calling the DescribeStacks operation:",
  "An error occurred (ExpiredToken) when calling the DescribeStacks operation:",
  "An error occurred (ExpiredTokenException) when calling the DescribeStacks operation:",
  "An error occurred (AuthFailure) when calling the DescribeStacks operation:",
  "An error occurred (SignatureDoesNotMatch) when calling the DescribeStacks operation:",
  "An error occurred (InvalidSignatureException) when calling the DescribeStacks operation:",
];

const NETWORK = [
  "Could not connect to the endpoint URL:",
  "Failed to connect to proxy URL:",
  "Connection was closed before we received a valid response from endpoint URL:",
  "Connect timeout on endpoint URL:",
];

const THROTTLING = [
  "An error occurred (Throttling) when calling the DescribeStacks operation:",
  "An error occurred (ThrottlingException) when calling the DescribeStacks operation:",
  "An error occurred (RequestLimitExceeded) when calling the DescribeStacks operation:",
  "An error occurred (TooManyRequestsException) when calling the DescribeStacks operation:",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stderrLines(stderr) {
  return String(stderr ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function startsWithAny(line, prefixes) {
  return prefixes.some((prefix) => line.startsWith(prefix));
}

export function classifyDescribeStacks({ exitStatus, stderr, stackName }) {
  if (!stackName || typeof stackName !== "string") {
    return { result: "fail", reason: "unexpected" };
  }
  if (exitStatus === 0) return { result: "exists" };
  if (!Number.isInteger(exitStatus) || exitStatus < 0) {
    return { result: "fail", reason: "unexpected" };
  }

  const stack = escapeRegExp(stackName);
  const missingLine = new RegExp(
    `^An error occurred \\(ValidationError\\) when calling the DescribeStacks operation: Stack with id (?:${stack}|arn:aws:cloudformation:[a-z0-9-]+:[0-9]{12}:stack/${stack}/[A-Za-z0-9-]+) does not exist$`,
  );
  const hits = new Set();
  for (const line of stderrLines(stderr)) {
    if (missingLine.test(line)) hits.add("missing");
    if (startsWithAny(line, ACCESS_DENIED)) hits.add("access-denied");
    if (startsWithAny(line, INVALID_CREDENTIALS)) hits.add("invalid-credentials");
    if (startsWithAny(line, NETWORK)) hits.add("network");
    if (startsWithAny(line, THROTTLING)) hits.add("throttling");
  }
  if (hits.size === 1 && hits.has("missing")) return { result: "missing" };
  if (hits.size === 1 && hits.has("access-denied")) {
    return { result: "fail", reason: "access-denied" };
  }
  if (hits.size === 1 && hits.has("invalid-credentials")) {
    return { result: "fail", reason: "invalid-credentials" };
  }
  if (hits.size === 1 && hits.has("network")) return { result: "fail", reason: "network" };
  if (hits.size === 1 && hits.has("throttling")) return { result: "fail", reason: "throttling" };
  return { result: "fail", reason: "unexpected" };
}

function option(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1 || !argv[index + 1] || argv[index + 1].startsWith("--")) return "";
  return argv[index + 1];
}

const invokedDirectly = process.argv[1]?.endsWith("classify-stack-describe.mjs");
if (invokedDirectly) {
  try {
    const exitStatus = Number(option(process.argv, "--exit-status"));
    const stackName = option(process.argv, "--stack-name");
    const stderrFile = option(process.argv, "--stderr-file");
    if (!Number.isInteger(exitStatus) || !stackName || !stderrFile) {
      throw new Error("unexpected");
    }
    const stderr = readFileSync(stderrFile, "utf8");
    const classification = classifyDescribeStacks({ exitStatus, stderr, stackName });
    if (classification.result === "fail") {
      console.error(classification.reason);
      process.exit(1);
    }
    console.log(classification.result);
  } catch (error) {
    console.error(error instanceof Error && error.message === "unexpected" ? "unexpected" : "unexpected");
    process.exit(1);
  }
}
