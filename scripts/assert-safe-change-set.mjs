import { readFileSync } from "node:fs";
import { PROTECTED_LOGICAL_IDS } from "./deployment-targets.mjs";

const protectedIds = new Set(PROTECTED_LOGICAL_IDS);

/**
 * An update of an existing stack may modify resources in place.
 * It may not add, remove, or replace anything. There is no Add allowlist.
 * A create change set may add resources and still may not remove or replace them.
 * Protected logical ids: LeadsTable, ContactFunction, ContactRetryFunction,
 * ContactHttpApi, ContactLogGroup, ContactRetryLogGroup.
 * SAM's "No changes to deploy" message never reaches this checker.
 */
export function findUnsafeChanges(changes, { mode }) {
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
      reasons.push(
        protectedIds.has(logicalId)
          ? "protected resource would be created again"
          : "unexpected resource addition",
      );
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

export function inspectChangeSet(payload, mode) {
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
  const findings = findUnsafeChanges(payload.Changes, { mode });
  if (findings.length > 0) {
    return {
      ok: false,
      findings,
      error: "Change set proposes an unsafe resource change and was not executed.",
    };
  }
  return { ok: true, findings: [], count: payload.Changes.length };
}

export function inspectChangeSetFile(file, mode) {
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
  return inspectChangeSet(payload, mode);
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
    const result = inspectChangeSetFile(readFileArgument(process.argv), readMode(process.argv));
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
