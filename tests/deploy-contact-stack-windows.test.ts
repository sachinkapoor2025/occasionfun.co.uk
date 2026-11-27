import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEMO_CLOUDFORMATION_ROLE_ARN,
  EXPECTED_ANALYTICS_REPORT_CHANGES,
  PRODUCTION_CLOUDFORMATION_ROLE_ARN,
  assertArtifactBucket,
  assertMeasurementDisabled,
  assertNoProductionResourceAssignment,
  changeSetDisposition,
  parseDeployArgs,
  readSamDeployResult,
  reviewAnalyticsReportChangeSet,
  validateWindowsInvocation,
} from "../scripts/deploy-contact-stack-windows.mjs";
import { DEMO, PRODUCTION, SMTP_SECRET_ARN, originsValue } from "../scripts/deployment-targets.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(root, "scripts/deploy-contact-stack-windows.mjs");

function demoArgs(parametersFile: string, extra: string[] = []): string[] {
  return [
    scriptPath,
    "--check-only",
    "--environment",
    "demo",
    "--stack-name",
    DEMO.stackName,
    "--parameters-file",
    parametersFile,
    "--allow-create",
    "false",
    "--expected-table",
    DEMO.table,
    "--expected-contact-function",
    DEMO.contactFunction,
    "--expected-retry-function",
    DEMO.retryFunction,
    "--expected-contact-log-group",
    DEMO.contactLogGroup,
    "--expected-retry-log-group",
    DEMO.retryLogGroup,
    "--expected-api-id",
    DEMO.apiId,
    "--expected-endpoint",
    DEMO.endpoint,
    ...extra,
  ];
}

function writeDemoParameters(analytics = "AnalyticsDeployment: enabled"): string {
  const directory = mkdtempSync(path.join(tmpdir(), "occasionfun-windows-deploy-"));
  const parameters = path.join(directory, "parameters.yaml");
  writeFileSync(
    parameters,
    [
      "Environment: demo",
      `SmtpSecretArn: ${SMTP_SECRET_ARN}`,
      `AllowedOrigins: "${originsValue(DEMO.origins)}"`,
      "AdminDeploymentPhase: api",
      analytics,
      "",
    ].join("\n"),
  );
  return parameters;
}

function runScript(args: string[]) {
  return spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
}

function change(logicalId: string, action: string, replacement = "False") {
  return { ResourceChange: { LogicalResourceId: logicalId, Action: action, Replacement: replacement } };
}

describe("Windows contact deploy argument validation", () => {
  it("rejects an unknown argument before AWS", () => {
    const result = runScript([scriptPath, "--execute"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown argument: --execute");
    expect(result.stdout).not.toContain("Change set ARN");
  });

  it("refuses to run a demo change set unless --no-execute is present", () => {
    const result = runScript([
      scriptPath,
      "--environment",
      "demo",
      "--stack-name",
      DEMO.stackName,
      "--allow-create",
      "false",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Pass --no-execute.");
    expect(result.stdout).not.toContain("Creating an unexecuted change set");
  });

  it("rejects the production stack and the production execution role for demo", () => {
    const productionStack = validateWindowsInvocation(
      parseDeployArgs([
        "--check-only",
        "--environment",
        "demo",
        "--stack-name",
        PRODUCTION.stackName,
        "--allow-create",
        "false",
      ]),
    );
    expect(productionStack).toContain("Production resources are not targeted by this Windows runner.");

    const productionRole = validateWindowsInvocation(
      parseDeployArgs([
        "--no-execute",
        "--environment",
        "demo",
        "--allow-create",
        "false",
        "--role-arn",
        PRODUCTION_CLOUDFORMATION_ROLE_ARN,
        "--expected-report-sha256",
        "a".repeat(64),
      ]),
    );
    expect(productionRole.join("\n")).toContain("Demo deployment rejected a different CloudFormation execution role.");
    expect(productionRole.join("\n")).toContain(DEMO_CLOUDFORMATION_ROLE_ARN);
  });

  it("accepts the demo configuration without calling AWS", () => {
    const parameters = writeDemoParameters();
    const result = runScript(demoArgs(parameters));
    rmSync(path.dirname(parameters), { recursive: true, force: true });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain(`Demo change sets use CloudFormation role ${DEMO_CLOUDFORMATION_ROLE_ARN}.`);
    expect(result.stdout).toContain("Configuration check only. No change set was created.");
  });

  it("rejects a demo parameter file that omits analytics", () => {
    const parameters = writeDemoParameters("AnalyticsDeployment: disabled");
    const result = runScript(demoArgs(parameters));
    rmSync(path.dirname(parameters), { recursive: true, force: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Demo deployments must set AnalyticsDeployment to enabled.");
    expect(result.stdout).not.toContain("No change set was created.");
  });

  it("does not contain an execute-change-set call", () => {
    const source = readFileSync(scriptPath, "utf8");
    expect(source).not.toContain("execute-change-set");
    expect(source).toContain("--no-execute-changeset");
    expect(source).toContain("assert-safe-change-set.mjs");
  });
});

describe("Windows change-set review", () => {
  const expected = [
    change("AnalyticsReportLogGroup", "Add", ""),
    change("AnalyticsReportRole", "Add", ""),
    change("AnalyticsReportFunction", "Add", ""),
    change("AnalyticsReportFunctionGetSummaryPermission", "Add", ""),
    change("AdminHttpApi", "Modify", "False"),
  ];

  it("accepts only the report additions and an in-place admin API change", () => {
    expect(reviewAnalyticsReportChangeSet(expected)).toEqual([]);
    expect(changeSetDisposition(true, [])).toBe("keep");
    expect(EXPECTED_ANALYTICS_REPORT_CHANGES).toHaveLength(5);
  });

  it("rejects a measure modification, a replacement, and an unexpected resource", () => {
    const measure = reviewAnalyticsReportChangeSet([
      ...expected,
      change("AnalyticsMeasureFunction", "Modify", "False"),
    ]);
    expect(measure.join("\n")).toContain("AnalyticsMeasureFunction must remain unchanged");
    expect(changeSetDisposition(true, measure)).toBe("delete");

    const replaced = reviewAnalyticsReportChangeSet([
      ...expected.slice(0, 4),
      change("AdminHttpApi", "Modify", "True"),
    ]);
    expect(replaced.join("\n")).toContain("AdminHttpApi would be replaced");
    expect(changeSetDisposition(true, replaced)).toBe("delete");

    const extra = reviewAnalyticsReportChangeSet([
      ...expected,
      change("AdminHttpApiApiGatewayDefaultStage", "Modify", "False"),
    ]);
    expect(extra).toContain("Unexpected resource AdminHttpApiApiGatewayDefaultStage.");
    expect(changeSetDisposition(true, extra)).toBe("retain");
    expect(changeSetDisposition(false, extra)).toBe("delete");
  });

  it("reads the SAM log and refuses a website artifact bucket", () => {
    const parsed = readSamDeployResult(`
      Deployment s3 bucket                       : aws-sam-cli-managed-default-samclisourcebucket-pjopzssdwf27
      Changeset created successfully. arn:aws:cloudformation:eu-west-2:796174527529:changeSet/samcli-deploy1/abc-def.
    `);
    expect(parsed.bucket).toBe("aws-sam-cli-managed-default-samclisourcebucket-pjopzssdwf27");
    expect(parsed.arn).toBe(
      "arn:aws:cloudformation:eu-west-2:796174527529:changeSet/samcli-deploy1/abc-def",
    );
    expect(() => assertArtifactBucket("occasionfun.co.uk")).toThrow(/website bucket/);
    expect(() => assertArtifactBucket("")).toThrow(/not reported/);
  });

  it("requires the aggregate flag to stay the string false", () => {
    expect(() =>
      assertMeasurementDisabled('AGGREGATE_MEASUREMENT_ENABLED: "false"\n', "template"),
    ).not.toThrow();
    expect(() =>
      assertMeasurementDisabled("AGGREGATE_MEASUREMENT_ENABLED: 'false'\n", "template"),
    ).not.toThrow();
    expect(() =>
      assertMeasurementDisabled('AGGREGATE_MEASUREMENT_ENABLED: "true"\n', "template"),
    ).toThrow(/string false/);
    expect(() =>
      assertNoProductionResourceAssignment(
        "Description: production as stack occasionfun-co-uk-prod-contact.\nFunctionName: occasionfun-co-uk-contact\n",
      ),
    ).not.toThrow();
    expect(() =>
      assertNoProductionResourceAssignment("FunctionName: occasionfun-co-uk-prod-contact\n"),
    ).toThrow(/production resource/);
  });
});
