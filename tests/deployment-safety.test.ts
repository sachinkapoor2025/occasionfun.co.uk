import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findUnsafeChanges,
  inspectChangeSet,
  inspectChangeSetFile,
} from "../scripts/assert-safe-change-set.mjs";
import {
  deploymentIsFinal,
  inspectJobs,
  isExactCommit,
  normalizeJob,
  planAutoBuildChange,
  planRelease,
  readJobPage,
  selectExistingJob,
  verifyAutoBuildDisabled,
} from "../scripts/amplify-demo-release.mjs";
import { classifyDescribeStacks } from "../scripts/classify-stack-describe.mjs";
import { resolvePublicEnv } from "../scripts/amplify-public-env.mjs";
import {
  assertDeployConfig,
  parseFlatYaml,
} from "../scripts/assert-deploy-config.mjs";
import {
  AWS_ACCOUNT_ID,
  AWS_REGION,
  DEMO,
  PRODUCTION,
  SMTP_SECRET_ARN,
  originsValue,
} from "../scripts/deployment-targets.mjs";
import {
  assertInvalidEnquiry,
  assertNoSecrets,
  assertPreflight,
  assertWebsite,
  secretFindings,
} from "../scripts/smoke-demo.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function workflow(name: string): string {
  return readFileSync(path.join(root, ".github/workflows", name), "utf8");
}

function baseInput(environment: "demo" | "prod") {
  const target = environment === "demo" ? DEMO : PRODUCTION;
  return {
    environment,
    stackName: target.stackName,
    accountId: AWS_ACCOUNT_ID,
    region: AWS_REGION,
    allowCreate: target.allowCreate,
    expectedTable: target.table,
    expectedContactFunction: target.contactFunction,
    expectedRetryFunction: target.retryFunction,
    expectedContactLogGroup: target.contactLogGroup,
    expectedRetryLogGroup: target.retryLogGroup,
    expectedApiId: environment === "demo" ? DEMO.apiId : "",
    expectedEndpoint: environment === "demo" ? DEMO.endpoint : "",
    parameters: {
      Environment: target.environment,
      SmtpSecretArn: SMTP_SECRET_ARN,
      AllowedOrigins: originsValue(target.origins),
    },
  };
}

describe("deployment configuration", () => {
  it("accepts the existing demo target and the separate production target", () => {
    expect(assertDeployConfig(baseInput("demo"))).toEqual([]);
    expect(assertDeployConfig(baseInput("prod"))).toEqual([]);
  });

  it("requires the exact demo API id and DynamoDB table name", () => {
    expect(DEMO.apiId).toBe("0e6zpkvbkj");
    expect(DEMO.table).toBe("occasionfun-co-uk-leads");
    expect(PRODUCTION.table).toBe("occasionfun-co-uk-prod-leads");
    const api = baseInput("demo");
    api.expectedApiId = "not-the-demo-api";
    expect(assertDeployConfig(api).join(" ")).toMatch(/0e6zpkvbkj/);
    const table = baseInput("demo");
    table.expectedTable = "occasionfun-co-uk-other";
    expect(assertDeployConfig(table).join(" ")).toMatch(/DynamoDB/);
    expect(baseInput("prod").parameters.Environment).toBe("prod");
    expect(baseInput("demo").parameters.Environment).toBe("demo");
    expect(baseInput("prod").parameters.AllowedOrigins).not.toContain(DEMO.apiId);
    expect(baseInput("prod").stackName).not.toBe(baseInput("demo").stackName);
  });

  it("rejects a production deployment that targets demo resources", () => {
    const input = baseInput("prod");
    input.stackName = DEMO.stackName;
    input.expectedTable = DEMO.table;
    input.expectedEndpoint = DEMO.endpoint;
    input.parameters.AllowedOrigins = originsValue(DEMO.origins);
    const errors = assertDeployConfig(input);
    expect(errors.join(" ")).toMatch(/demo stack/);
    expect(errors.join(" ")).toMatch(/demo DynamoDB/);
    expect(errors.join(" ")).toMatch(/demo API/);
    expect(errors.join(" ")).toMatch(/Amplify/);
  });

  it("rejects a second SMTP secret and wildcard origins", () => {
    const input = baseInput("demo");
    input.parameters.SmtpSecretArn = "arn:aws:secretsmanager:eu-west-2:796174527529:secret:other-AbCdEf";
    input.parameters.AllowedOrigins = "*";
    const errors = assertDeployConfig(input).join(" ");
    expect(errors).toMatch(/existing shared secret/);
    expect(errors).toMatch(/Wildcard/);
  });

  it("reads the flat parameter file used by SAM", () => {
    const text = [
      "Environment: demo",
      `SmtpSecretArn: ${SMTP_SECRET_ARN}`,
      `AllowedOrigins: "${originsValue(DEMO.origins)}"`,
    ].join("\n");
    expect(parseFlatYaml(text).AllowedOrigins).toBe(originsValue(DEMO.origins));
  });
});

describe("change set safety", () => {
  it("allows an in-place update of the existing demo resources", () => {
    const findings = findUnsafeChanges(
      [
        {
          ResourceChange: {
            Action: "Modify",
            LogicalResourceId: "ContactFunction",
            Replacement: "False",
            ResourceType: "AWS::Lambda::Function",
          },
        },
      ],
      { mode: "update" },
    );
    expect(findings).toEqual([]);
  });

  it("stops replacement or deletion before execution", () => {
    const findings = findUnsafeChanges(
      [
        {
          ResourceChange: {
            Action: "Modify",
            LogicalResourceId: "LeadsTable",
            Replacement: "True",
          },
        },
        {
          ResourceChange: {
            Action: "Remove",
            LogicalResourceId: "ContactHttpApi",
            Replacement: "False",
          },
        },
        {
          ResourceChange: {
            Action: "Modify",
            LogicalResourceId: "ContactLogGroup",
            Replacement: "Conditional",
          },
        },
      ],
      { mode: "update" },
    );
    expect(findings.map((finding) => finding.logicalId)).toEqual([
      "LeadsTable",
      "ContactHttpApi",
      "ContactLogGroup",
    ]);
  });

  it("treats recreating a protected demo resource as unsafe", () => {
    const findings = findUnsafeChanges(
      [
        {
          ResourceChange: {
            Action: "Add",
            LogicalResourceId: "ContactRetryFunction",
            Replacement: "False",
          },
        },
      ],
      { mode: "update" },
    );
    expect(findings).toHaveLength(1);
  });

  it("allows the first production stack to add its own resources", () => {
    const findings = findUnsafeChanges(
      [
        {
          ResourceChange: {
            Action: "Add",
            LogicalResourceId: "LeadsTable",
            Replacement: "False",
          },
        },
      ],
      { mode: "create" },
    );
    expect(findings).toEqual([]);
  });

  it("rejects replacement True and Conditional on their own", () => {
    const replacement = findUnsafeChanges(
      [
        {
          ResourceChange: {
            Action: "Modify",
            LogicalResourceId: "ContactFunction",
            Replacement: "True",
          },
        },
      ],
      { mode: "update" },
    );
    expect(replacement[0]?.reasons).toContain("replacement");
    const conditional = findUnsafeChanges(
      [
        {
          ResourceChange: {
            Action: "Modify",
            LogicalResourceId: "ContactRetryLogGroup",
            Replacement: "Conditional",
          },
        },
      ],
      { mode: "update" },
    );
    expect(conditional[0]?.reasons).toContain("replacement");
  });

  it("rejects an unexpected resource addition on an existing stack", () => {
    const findings = findUnsafeChanges(
      [
        {
          ResourceChange: {
            Action: "Add",
            LogicalResourceId: "NewQueue",
            Replacement: "False",
            ResourceType: "AWS::SQS::Queue",
          },
        },
      ],
      { mode: "update" },
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.reasons).toContain("unexpected resource addition");
  });

  it("fails closed for a missing file, invalid JSON, a missing Changes array, and an empty array", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "occasionfun-changeset-"));
    const missing = path.join(directory, "missing.json");
    expect(() => inspectChangeSetFile(missing, "update")).toThrow(/missing/);
    expect(() => inspectChangeSetFile(directory, "update")).toThrow(/unreadable/);

    const invalid = path.join(directory, "invalid.json");
    writeFileSync(invalid, "{not json");
    expect(() => inspectChangeSetFile(invalid, "update")).toThrow(/not valid JSON/);

    expect(inspectChangeSet({ StackId: "stack" }, "update").error).toMatch(/missing the Changes array/);
    expect(inspectChangeSet({ Changes: [] }, "update").ok).toBe(false);
    expect(inspectChangeSet({ Changes: [] }, "update").error).toMatch(/empty change set/);
    expect(inspectChangeSet([], "update").ok).toBe(false);

    const empty = path.join(directory, "empty.json");
    writeFileSync(empty, JSON.stringify({ Changes: [] }));
    expect(inspectChangeSetFile(empty, "update").ok).toBe(false);

    const safe = path.join(directory, "safe.json");
    writeFileSync(
      safe,
      JSON.stringify({
        Changes: [
          {
            ResourceChange: {
              Action: "Modify",
              LogicalResourceId: "ContactFunction",
              Replacement: "False",
            },
          },
        ],
      }),
    );
    expect(inspectChangeSetFile(safe, "update").ok).toBe(true);

    const cli = spawnSync(
      process.execPath,
      ["scripts/assert-safe-change-set.mjs", "--mode", "update", "--file", missing],
      { cwd: root, encoding: "utf8" },
    );
    expect(cli.status).toBe(1);
    expect(cli.stderr).toMatch(/missing/);
    rmSync(directory, { recursive: true, force: true });
  });
});

describe("demo smoke checks", () => {
  it("accepts the demo site, preflight, and an invalid enquiry", () => {
    expect(() => assertWebsite(200)).not.toThrow();
    expect(() =>
      assertPreflight(204, {
        "access-control-allow-origin": DEMO.siteUrl,
        "access-control-allow-methods": "POST,OPTIONS",
      }),
    ).not.toThrow();
    expect(() =>
      assertInvalidEnquiry(
        400,
        JSON.stringify({ ok: false, saved: false, notification: "none" }),
      ),
    ).not.toThrow();
  });

  it("rejects a wildcard origin, an accepted enquiry, and credential markers", () => {
    expect(() => assertPreflight(204, { "access-control-allow-origin": "*" })).toThrow(
      /every origin/,
    );
    expect(() =>
      assertInvalidEnquiry(200, JSON.stringify({ ok: true, saved: true, notification: "sent" })),
    ).toThrow(/must not save/);
    expect(secretFindings("smtp password smtp-32Px2G")).toContain("smtp-secret-suffix");
    expect(() => assertNoSecrets("response", "AKIAIOSFODNN7EXAMPLE")).toThrow(
      /aws-access-key-id/,
    );
  });
});

describe("GitHub Actions workflows", () => {
  const pipeline = workflow("ci-cd.yml");
  const validate = pipeline.slice(pipeline.indexOf("  validate:"), pipeline.indexOf("  deploy-demo:"));
  const demo = pipeline.slice(pipeline.indexOf("  deploy-demo:"), pipeline.indexOf("  deploy-production:"));
  const production = pipeline.slice(
    pipeline.indexOf("  deploy-production:"),
    pipeline.indexOf("  smoke-test:"),
  );
  const smoke = pipeline.slice(pipeline.indexOf("  smoke-test:"));

  it("keeps validation on pull requests and on demo and main", () => {
    expect(pipeline).toContain("pull_request:");
    expect(pipeline).toContain("branches: [main, demo]");
    expect(pipeline).toContain("branches: [demo, main, master]");
    expect(validate).toContain("npm run lint");
    expect(validate).toContain("npm run typecheck");
    expect(validate).toContain("npm run test");
    expect(validate).toContain("npm run typecheck --prefix infra/contact-api");
    expect(validate).toContain("npm test --prefix infra/contact-api");
    expect(validate).toContain("sam build --template template.yaml");
    expect(validate).toContain("sam validate --lint --template template.yaml");
    expect(validate).toContain("npm run build");
    expect(validate).toContain("node-version: \"24\"");
    expect(validate).not.toContain("secrets.AWS_ACCESS_KEY_ID");
    expect(validate).not.toContain("deploy-contact-stack.sh");
  });

  it("deploys demo only after validation of that push and only to the existing resources", () => {
    const deployScript = readFileSync(path.join(root, "scripts/deploy-contact-stack.sh"), "utf8");
    expect(pipeline).toContain("branches: [demo, main, master]");
    expect(pipeline).not.toContain("workflow_dispatch:");
    expect(pipeline).not.toContain("workflow_run:");
    expect(pipeline).not.toContain("wait-for-ci.sh");
    expect(pipeline).toContain("cancel-in-progress: false");
    expect(demo).toContain("needs: validate");
    expect(demo).toContain("github.event_name == 'push' && github.ref == 'refs/heads/demo'");
    expect(demo).toContain("ref: ${{ github.sha }}");
    expect(demo).toContain("--stack-name occasionfun-co-uk-contact");
    expect(demo).toContain("--allow-create false");
    expect(demo).toContain(DEMO.table);
    expect(demo).toContain(DEMO.contactFunction);
    expect(demo).toContain(DEMO.retryFunction);
    expect(demo).toContain(DEMO.apiId);
    expect(demo).toContain(DEMO.endpoint);
    expect(demo).toContain(originsValue(DEMO.origins));
    expect(demo).toContain(SMTP_SECRET_ARN);
    expect(demo).toContain("aws-region: eu-west-2");
    expect(demo).toContain("secrets.AWS_ACCESS_KEY_ID");
    expect(demo).toContain("secrets.AWS_SECRET_ACCESS_KEY");
    expect(demo).not.toContain("secrets.AWS_PRODUCTION_ACCESS_KEY_ID");
    expect(deployScript).toContain("--no-execute-changeset");
    expect(deployScript.indexOf("assert-safe-change-set.mjs")).toBeLessThan(
      deployScript.indexOf("execute-change-set"),
    );
    expect(deployScript).toContain("delete-change-set");
    expect(deployScript).not.toContain("delete-stack");
    expect(deployScript).toContain("classify-stack-describe.mjs");
    expect(deployScript).not.toContain('stack_status=""');
    expect(deployScript.indexOf("classify-stack-describe.mjs")).toBeLessThan(
      deployScript.indexOf('change_mode="create"'),
    );
    expect(deployScript).toContain("mktemp --suffix=.json");
    expect(deployScript).toContain('--file "$changes"');
    expect(deployScript).toContain("--next-token");
    expect(deployScript.indexOf("No changes to deploy")).toBeLessThan(
      deployScript.indexOf("mktemp --suffix=.json"),
    );
    expect(demo).toContain("node scripts/amplify-demo-release.mjs release");
    expect(demo.indexOf("disable-auto-build")).toBeLessThan(demo.indexOf("deploy-contact-stack.sh"));
    expect(demo.indexOf("deploy-contact-stack.sh")).toBeLessThan(
      demo.indexOf("amplify-demo-release.mjs release"),
    );
    expect(production).not.toContain("disable-auto-build");
    expect(production).not.toContain("update-branch");
    expect(demo).not.toContain("smoke-demo.mjs");
    expect(smoke).toContain("needs: deploy-demo");
    expect(smoke).toContain("persist-credentials: false");
    expect(smoke).toContain('GITHUB_TOKEN: ""');
    expect(smoke).toContain('GH_TOKEN: ""');
    expect(smoke).toContain("node scripts/smoke-demo.mjs");
    expect(smoke).not.toContain("AWS_ACCESS_KEY_ID");
    expect(smoke).not.toContain("AWS_SECRET_ACCESS_KEY");
    expect(pipeline).not.toContain("id-token:");
    for (const removed of ["ci.yml", "deploy-demo.yml", "deploy-production.yml", "smoke-test.yml"]) {
      expect(existsSync(path.join(root, ".github/workflows", removed))).toBe(false);
    }
  });

  it("runs demo deployment only after validation and never from a pull request", () => {
    expect(pipeline).not.toContain("workflow_dispatch:");
    expect(pipeline).not.toContain("inputs:");
    expect(pipeline).not.toContain("inputs.operation");
    expect(demo).toContain("needs: validate");
    expect(demo).toContain("github.event_name == 'push' && github.ref == 'refs/heads/demo'");
    expect(validate.indexOf("npm run test")).toBeLessThan(validate.length);
    expect(pipeline.indexOf("  validate:")).toBeLessThan(pipeline.indexOf("  deploy-demo:"));
    expect(pipeline.indexOf("  deploy-demo:")).toBeLessThan(pipeline.indexOf("  smoke-test:"));
    expect(demo).toContain("AMPLIFY_APP_ID: d2oib89bmco9su");
    expect(demo).toContain("AMPLIFY_BRANCH: demo");
    expect(demo).toContain("node scripts/amplify-demo-release.mjs disable-auto-build");
    expect(demo.indexOf("disable-auto-build")).toBeLessThan(demo.indexOf("sam build"));
    expect(smoke).toContain("if: success()");
  });

  it("cannot deploy production without the environment gate or with demo credentials", () => {
    expect(pipeline).toContain("branches: [demo, main, master]");
    expect(production).toContain("needs: validate");
    expect(production).toContain("github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(production).toContain("environment: production");
    expect(production).toContain("vars.PRODUCTION_DEPLOYMENTS_ENABLED == 'true'");
    expect(production.indexOf("required_reviewers")).toBeLessThan(
      production.indexOf("configure-aws-credentials"),
    );
    expect(production.indexOf("environment: production")).toBeLessThan(
      production.indexOf("required_reviewers"),
    );
    expect(production).toContain("required_reviewers");
    expect(production).toContain("secrets.AWS_PRODUCTION_ACCESS_KEY_ID");
    expect(production).toContain("secrets.AWS_PRODUCTION_SECRET_ACCESS_KEY");
    expect(production).not.toContain("secrets.AWS_ACCESS_KEY_ID");
    expect(production).not.toContain("secrets.AWS_SECRET_ACCESS_KEY");
    expect(production).toContain(
      "node scripts/render-contact-template.mjs --environment prod --output infra/contact-api/template.production.yaml",
    );
    expect(production).toContain("sam build --template template.production.yaml");
    expect(production).not.toContain("sam build --template template.yaml");
    expect(demo).toContain("sam build --template template.yaml");
    expect(demo).not.toContain("template.production.yaml");
    expect(production).toContain("--stack-name occasionfun-co-uk-prod-contact");
    expect(production).toContain(PRODUCTION.table);
    expect(production).toContain(PRODUCTION.contactFunction);
    expect(production).toContain(PRODUCTION.retryFunction);
    expect(production).toContain(originsValue(PRODUCTION.origins));
    expect(production).toContain("Production Amplify deployment is disabled.");
    expect(production).not.toContain("amplify start-job");
    expect(production).not.toContain(DEMO.endpoint);
    expect(production).not.toContain(DEMO.table);
  });

  it("does not grant OIDC permissions or print credential values", () => {
    expect(pipeline).not.toContain("id-token:");
    expect(pipeline).not.toContain("--guided");
    expect(pipeline).not.toContain("echo ${{ secrets");
    expect(pipeline).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(smoke).toContain("node scripts/smoke-demo.mjs");
    expect(smoke).toContain("persist-credentials: false");
    expect(smoke).toContain('GITHUB_TOKEN: ""');
    expect(smoke).toContain("contents: read");
  });

  it("pins third-party actions to full commit SHAs", () => {
    const pins = new Map([
      ["actions/checkout", "11d5960a326750d5838078e36cf38b85af677262"],
      ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
      ["actions/upload-artifact", "ea165f8d65b6e75b540449e92b4886f43607fa02"],
      ["aws-actions/configure-aws-credentials", "7474bc4690e29a8392af63c5b98e7449536d5c3a"],
      ["aws-actions/setup-sam", "f84ec7d548307efafe33230528756de3c5841a17"],
    ]);
    for (const file of [pipeline]) {
      const uses = [...file.matchAll(/uses:\s*(\S+)/g)].map((match) => match[1]);
      expect(uses.length).toBeGreaterThan(0);
      for (const use of uses) {
        const [action, sha] = use.split("@");
        expect(sha).toMatch(/^[0-9a-f]{40}$/);
        expect(pins.get(action)).toBe(sha);
        expect(file).toContain(`# v`);
      }
    }
  });

  it("keeps the Amplify demo fallback off every non-demo branch", () => {
    const amplify = readFileSync(path.join(root, "amplify.yml"), "utf8");
    expect(amplify).toContain("node scripts/amplify-public-env.mjs");
    expect(resolvePublicEnv("demo", {})).toEqual({
      NEXT_PUBLIC_CONTACT_ENDPOINT: DEMO.endpoint,
      NEXT_PUBLIC_SITE_URL: DEMO.siteUrl,
    });
    const productionEndpoint = "https://prod123.execute-api.eu-west-2.amazonaws.com/contact";
    expect(
      resolvePublicEnv("main", { NEXT_PUBLIC_CONTACT_ENDPOINT: productionEndpoint }),
    ).toEqual({
      NEXT_PUBLIC_CONTACT_ENDPOINT: productionEndpoint,
      NEXT_PUBLIC_SITE_URL: PRODUCTION.siteUrl,
    });
    expect(resolvePublicEnv("master", {}).NEXT_PUBLIC_CONTACT_ENDPOINT).toBe("");
    expect(resolvePublicEnv("master", {}).NEXT_PUBLIC_SITE_URL).toBe(PRODUCTION.siteUrl);
    for (const branch of ["main", "master", "feature", "production", ""]) {
      expect(() =>
        resolvePublicEnv(branch, { NEXT_PUBLIC_CONTACT_ENDPOINT: DEMO.endpoint }),
      ).toThrow(/refused the demo contact API/);
    }
  });
});

describe("Amplify commit matching", () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const other = "fedcba9876543210fedcba9876543210fedcba98";

  it("requires the full commit SHA and does not accept a prefix", () => {
    expect(isExactCommit(sha, sha)).toBe(true);
    expect(isExactCommit(sha.slice(0, 7), sha)).toBe(false);
    expect(isExactCommit(sha, sha.slice(0, 7))).toBe(false);
    expect(isExactCommit(`${sha}extra`, sha)).toBe(false);
    expect(
      selectExistingJob(
        [{ jobId: "prefix", commitId: sha.slice(0, 12), status: "RUNNING", startTime: "2" }],
        sha,
      ),
    ).toMatchObject({
      action: "wait",
      jobId: "prefix",
      reason: "unattributed-build-still-running",
    });
    expect(
      selectExistingJob(
        [{ jobId: "current", commitId: sha, status: "RUNNING", startTime: "2" }],
        sha,
      ),
    ).toMatchObject({ action: "wait", jobId: "current" });
  });

  it("treats this commit as final only when it is the latest success", () => {
    expect(
      deploymentIsFinal(
        [
          { jobId: "older", commitId: other, status: "SUCCEED", endTime: "2020-01-01T00:00:00Z" },
          { jobId: "current", commitId: sha, status: "SUCCEED", endTime: "2020-01-02T00:00:00Z" },
        ],
        sha,
      ).ok,
    ).toBe(true);
    expect(
      deploymentIsFinal(
        [
          { jobId: "current", commitId: sha, status: "SUCCEED", endTime: "2020-01-01T00:00:00Z" },
          { jobId: "newer", commitId: other, status: "SUCCEED", endTime: "2020-01-02T00:00:00Z" },
        ],
        sha,
      ).ok,
    ).toBe(false);
    expect(
      deploymentIsFinal(
        [
          { jobId: "current", commitId: sha, status: "SUCCEED", endTime: "2020-01-02T00:00:00Z" },
          { jobId: "running", commitId: other, status: "RUNNING", endTime: "" },
        ],
        sha,
      ).reason,
    ).toBe("another-commit-is-still-running");
  });
});

describe("Amplify single publisher", () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const other = "fedcba9876543210fedcba9876543210fedcba98";
  const idle = [
    { jobId: "old", commitId: other, status: "SUCCEED", endTime: "2020-01-01T00:00:00Z" },
  ];

  it("continues when auto-build is already disabled", () => {
    expect(
      planAutoBuildChange({ branchName: "demo", enableAutoBuild: false }, idle, sha).action,
    ).toBe("already-disabled");
    expect(verifyAutoBuildDisabled({ branchName: "demo", enableAutoBuild: false }).ok).toBe(true);
  });

  it("disables auto-build when it is enabled and no other commit is running", () => {
    expect(planAutoBuildChange({ branchName: "demo", enableAutoBuild: true }, idle, sha).action).toBe(
      "disable",
    );
    expect(planAutoBuildChange({ branchName: "main", enableAutoBuild: true }, idle, sha).action).toBe(
      "fail",
    );
  });

  it("fails auto-build verification when the setting is missing or still enabled", () => {
    expect(
      planAutoBuildChange({ branchName: "demo", enableAutoBuild: undefined }, idle, sha).reason,
    ).toBe("Amplify enableAutoBuild is unavailable.");
    expect(verifyAutoBuildDisabled({ branchName: "demo", enableAutoBuild: true }).ok).toBe(false);
    expect(verifyAutoBuildDisabled({ branchName: "main", enableAutoBuild: false }).ok).toBe(false);
  });

  it("accepts a job list that omits commit ids and never treats those jobs as this commit", () => {
    const omitted = normalizeJob({ jobId: "manual", status: "SUCCEED", endTime: "2020-01-01T00:00:00Z" });
    expect(omitted.commitId).toBe("");
    expect(inspectJobs([omitted]).ok).toBe(true);
    expect(
      readJobPage({
        jobSummaries: [{ jobId: "manual", status: "SUCCEED", endTime: "2020-01-01T00:00:00Z" }],
      }).ok,
    ).toBe(true);
    expect(inspectJobs([]).ok).toBe(true);
    expect(
      planAutoBuildChange({ branchName: "demo", enableAutoBuild: true }, [], sha).action,
    ).toBe("disable");
    expect(
      planAutoBuildChange({ branchName: "demo", enableAutoBuild: false }, [omitted], sha).action,
    ).toBe("already-disabled");
    expect(
      planAutoBuildChange({ branchName: "demo", enableAutoBuild: true }, [omitted], sha).action,
    ).toBe("disable");
    expect(
      planAutoBuildChange(
        { branchName: "demo", enableAutoBuild: true },
        [{ jobId: "manual", commitId: "", status: "RUNNING", endTime: "" }],
        sha,
      ),
    ).toMatchObject({ action: "wait", reason: "unattributed-build-still-running" });
    expect(
      planAutoBuildChange(
        { branchName: "demo", enableAutoBuild: true },
        [{ jobId: "prefix", commitId: sha.slice(0, 12), status: "RUNNING", endTime: "" }],
        sha,
      ).action,
    ).toBe("wait");
    expect(
      selectExistingJob(
        [{ jobId: "manual", commitId: "", status: "SUCCEED", endTime: "2020-01-03T00:00:00Z" }],
        sha,
      ),
    ).toMatchObject({ action: "start" });
    expect(
      deploymentIsFinal(
        [
          { jobId: "ours", commitId: sha, status: "SUCCEED", endTime: "2020-01-02T00:00:00Z" },
          { jobId: "manual", commitId: "", status: "SUCCEED", endTime: "2020-01-01T00:00:00Z" },
        ],
        sha,
      ).ok,
    ).toBe(true);
    expect(
      deploymentIsFinal(
        [
          { jobId: "ours", commitId: sha, status: "SUCCEED", endTime: "2020-01-01T00:00:00Z" },
          { jobId: "manual", commitId: "", status: "SUCCEED", endTime: "2020-01-02T00:00:00Z" },
        ],
        sha,
      ).reason,
    ).toBe("latest-successful-job-commit-is-unavailable");
    expect(
      planRelease(
        [{ jobId: "manual", commitId: "", status: "SUCCEED", endTime: "2020-01-02T00:00:00Z" }],
        sha,
      ),
    ).toMatchObject({ action: "start" });
    expect(
      planRelease(
        [{ jobId: "manual", commitId: "", status: "RUNNING", endTime: "" }],
        sha,
      ),
    ).toMatchObject({ action: "wait", reason: "unattributed-build-still-running" });
    expect(inspectJobs([{ jobId: "bad", commitId: 12, status: "SUCCEED" }]).reason).toBe(
      "Amplify job commit information is unavailable.",
    );
  });

  it("waits while an Amplify job from another commit is still running", () => {
    expect(
      planAutoBuildChange(
        { branchName: "demo", enableAutoBuild: true },
        [{ jobId: "older", commitId: other, status: "RUNNING", endTime: "" }],
        sha,
      ),
    ).toMatchObject({ action: "wait", reason: "older-build-still-running" });
  });

  it("fails when another commit becomes the latest deployment", () => {
    expect(planRelease(idle, sha)).toMatchObject({ action: "start" });
    expect(
      planRelease(
        [
          { jobId: "ours", commitId: sha, status: "SUCCEED", endTime: "2020-01-01T00:00:00Z" },
          { jobId: "newer", commitId: other, status: "SUCCEED", endTime: "2020-01-02T00:00:00Z" },
        ],
        sha,
      ).reason,
    ).toBe("another-commit-became-the-latest-deployment");
    expect(inspectJobs([{ jobId: "1", commitId: sha, status: "" }]).ok).toBe(false);
    expect(
      deploymentIsFinal(
        [{ jobId: "ours", commitId: sha, status: "SUCCEED", endTime: "" }],
        sha,
      ).reason,
    ).toBe("Amplify job completion time is unavailable.");
  });

  it("does not call Amplify when the release command is omitted", () => {
    const result = spawnSync(process.execPath, ["scripts/amplify-demo-release.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/disable-auto-build\|release/);
  });
});

describe("describe-stacks classification", () => {
  const stack = "occasionfun-co-uk-prod-contact";
  const missing = `An error occurred (ValidationError) when calling the DescribeStacks operation: Stack with id ${stack} does not exist`;

  it("recognises a confirmed missing stack and an existing stack", () => {
    expect(classifyDescribeStacks({ exitStatus: 254, stderr: missing, stackName: stack })).toEqual({
      result: "missing",
    });
    expect(
      classifyDescribeStacks({
        exitStatus: 254,
        stderr: `An error occurred (ValidationError) when calling the DescribeStacks operation: Stack with id arn:aws:cloudformation:eu-west-2:796174527529:stack/${stack}/1234abcd-1234-1234-1234-1234567890ab does not exist`,
        stackName: stack,
      }).result,
    ).toBe("missing");
    expect(
      classifyDescribeStacks({ exitStatus: 0, stderr: "", stackName: stack }),
    ).toEqual({ result: "exists" });
  });

  it("fails closed for access, credentials, network, throttling, and other errors", () => {
    expect(
      classifyDescribeStacks({
        exitStatus: 254,
        stderr:
          "An error occurred (AccessDenied) when calling the DescribeStacks operation: User is not authorized to perform: cloudformation:DescribeStacks",
        stackName: stack,
      }).reason,
    ).toBe("access-denied");
    expect(
      classifyDescribeStacks({
        exitStatus: 254,
        stderr:
          "An error occurred (UnrecognizedClientException) when calling the DescribeStacks operation: The security token included in the request is invalid.",
        stackName: stack,
      }).reason,
    ).toBe("invalid-credentials");
    expect(
      classifyDescribeStacks({
        exitStatus: 253,
        stderr: 'Could not connect to the endpoint URL: "https://cloudformation.eu-west-2.amazonaws.com/"',
        stackName: stack,
      }).reason,
    ).toBe("network");
    expect(
      classifyDescribeStacks({
        exitStatus: 254,
        stderr: "An error occurred (Throttling) when calling the DescribeStacks operation: Rate exceeded",
        stackName: stack,
      }).reason,
    ).toBe("throttling");
    expect(
      classifyDescribeStacks({
        exitStatus: 254,
        stderr:
          "An error occurred (ValidationError) when calling the DescribeStacks operation: 1 validation error detected",
        stackName: stack,
      }).reason,
    ).toBe("unexpected");
    expect(
      classifyDescribeStacks({
        exitStatus: 254,
        stderr: `Stack ${stack} does not exist`,
        stackName: stack,
      }).reason,
    ).toBe("unexpected");
  });
});

describe("deployment script configuration check", () => {
  it("accepts the demo parameter file without calling AWS", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "occasionfun-deploy-"));
    const parameters = path.join(directory, "parameters.yaml");
    writeFileSync(
      parameters,
      [
        "Environment: demo",
        `SmtpSecretArn: ${SMTP_SECRET_ARN}`,
        `AllowedOrigins: "${originsValue(DEMO.origins)}"`,
        "",
      ].join("\n"),
    );
    const bash =
      process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";
    const result = spawnSync(
      bash,
      [
        "scripts/deploy-contact-stack.sh",
        "--check-only",
        "--environment",
        "demo",
        "--stack-name",
        DEMO.stackName,
        "--parameters-file",
        parameters,
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
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          MSYS_NO_PATHCONV: "1",
          MSYS2_ARG_CONV_EXCL: "*",
        },
      },
    );
    rmSync(directory, { recursive: true, force: true });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("No change set was created.");
  });
});

const DEMO_CLOUDFORMATION_ROLE_ARN =
  "arn:aws:iam::796174527529:role/occasionfun-cloudformation-demo";

function runConfigCheck(
  environment: "demo" | "prod",
  extraArgs: string[] = [],
): { status: number | null; stdout: string; stderr: string } {
  const target = environment === "demo" ? DEMO : PRODUCTION;
  const directory = mkdtempSync(path.join(tmpdir(), "occasionfun-deploy-"));
  const parameters = path.join(directory, "parameters.yaml");
  writeFileSync(
    parameters,
    [
      `Environment: ${target.environment}`,
      `SmtpSecretArn: ${SMTP_SECRET_ARN}`,
      `AllowedOrigins: "${originsValue(target.origins)}"`,
      "",
    ].join("\n"),
  );
  const bash =
    process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";
  const args = [
    "scripts/deploy-contact-stack.sh",
    "--check-only",
    "--environment",
    environment,
    "--stack-name",
    target.stackName,
    "--parameters-file",
    parameters,
    "--allow-create",
    String(target.allowCreate),
    "--expected-table",
    target.table,
    "--expected-contact-function",
    target.contactFunction,
    "--expected-retry-function",
    target.retryFunction,
    "--expected-contact-log-group",
    target.contactLogGroup,
    "--expected-retry-log-group",
    target.retryLogGroup,
    ...extraArgs,
  ];
  if (environment === "demo") {
    args.push("--expected-api-id", DEMO.apiId, "--expected-endpoint", DEMO.endpoint);
  }
  const result = spawnSync(bash, args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      MSYS_NO_PATHCONV: "1",
      MSYS2_ARG_CONV_EXCL: "*",
    },
  });
  rmSync(directory, { recursive: true, force: true });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("CloudFormation execution role", () => {
  const deployScript = readFileSync(path.join(root, "scripts/deploy-contact-stack.sh"), "utf8");
  const samDeploy = deployScript.slice(
    deployScript.indexOf("sam_args=("),
    deployScript.indexOf('deploy_status="${PIPESTATUS[0]}"'),
  );

  it("passes the demo execution role to every demo SAM change set", () => {
    expect(DEMO.stackName).toBe("occasionfun-co-uk-contact");
    expect(DEMO.apiId).toBe("0e6zpkvbkj");
    expect(DEMO.table).toBe("occasionfun-co-uk-leads");
    expect(DEMO.endpoint).toBe(
      "https://0e6zpkvbkj.execute-api.eu-west-2.amazonaws.com/contact",
    );
    expect(deployScript).toContain(
      `DEMO_CLOUDFORMATION_ROLE_ARN="${DEMO_CLOUDFORMATION_ROLE_ARN}"`,
    );
    expect(samDeploy).toContain('--stack-name "$STACK_NAME"');
    expect(samDeploy).toContain('if [ "$ENVIRONMENT" = "demo" ]; then');
    expect(samDeploy).toContain('--role-arn "$DEMO_CLOUDFORMATION_ROLE_ARN"');
    expect(samDeploy.indexOf('if [ "$ENVIRONMENT" = "demo" ]; then')).toBeLessThan(
      samDeploy.indexOf('--role-arn "$DEMO_CLOUDFORMATION_ROLE_ARN"'),
    );
    expect(workflow("ci-cd.yml")).toContain("--stack-name occasionfun-co-uk-contact");
    expect(workflow("ci-cd.yml")).toContain(DEMO.apiId);
    expect(workflow("ci-cd.yml")).toContain(DEMO.table);
    expect(workflow("ci-cd.yml")).toContain(SMTP_SECRET_ARN);

    const omitted = runConfigCheck("demo");
    expect(omitted.status, omitted.stderr || omitted.stdout).toBe(0);
    expect(omitted.stdout).toContain(
      `Demo change sets use CloudFormation role ${DEMO_CLOUDFORMATION_ROLE_ARN}.`,
    );
    expect(omitted.stdout).toContain("No change set was created.");

    const explicit = runConfigCheck("demo", ["--role-arn", DEMO_CLOUDFORMATION_ROLE_ARN]);
    expect(explicit.status, explicit.stderr || explicit.stdout).toBe(0);
    expect(explicit.stdout).toContain(DEMO_CLOUDFORMATION_ROLE_ARN);
    expect(explicit.stdout).toContain("No change set was created.");
  });

  it("rejects a different CloudFormation role before calling AWS", () => {
    const result = runConfigCheck("demo", [
      "--role-arn",
      "arn:aws:iam::796174527529:role/occasionfun-cloudformation-other",
    ]);
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(
      /rejected a different CloudFormation execution role/,
    );
    expect(`${result.stdout}\n${result.stderr}`).toContain(DEMO_CLOUDFORMATION_ROLE_ARN);
    expect(result.stdout).not.toContain("No change set was created.");
    expect(result.stdout).not.toContain("get-caller-identity");
  });

  it("keeps the demo stack name and the existing change-set checks", () => {
    expect(DEMO.stackName).toBe("occasionfun-co-uk-contact");
    expect(deployScript).toContain('--stack-name "$STACK_NAME"');
    expect(deployScript).not.toContain("delete-stack");
    expect(deployScript.indexOf("assert-safe-change-set.mjs")).toBeLessThan(
      deployScript.indexOf("execute-change-set"),
    );
    const unsafe = findUnsafeChanges(
      [
        {
          ResourceChange: {
            Action: "Add",
            LogicalResourceId: "ContactFunction",
            Replacement: "False",
          },
        },
        {
          ResourceChange: {
            Action: "Remove",
            LogicalResourceId: "LeadsTable",
            Replacement: "False",
          },
        },
        {
          ResourceChange: {
            Action: "Modify",
            LogicalResourceId: "ContactHttpApi",
            Replacement: "True",
          },
        },
      ],
      { mode: "update" },
    );
    expect(unsafe.map((finding) => finding.logicalId)).toEqual([
      "ContactFunction",
      "LeadsTable",
      "ContactHttpApi",
    ]);
    expect(
      findUnsafeChanges(
        [
          {
            ResourceChange: {
              Action: "Modify",
              LogicalResourceId: "ContactFunction",
              Replacement: "False",
            },
          },
        ],
        { mode: "update" },
      ),
    ).toEqual([]);
  });

  it("does not let production use the demo execution role", () => {
    const productionJob = workflow("ci-cd.yml");
    const productionSlice = productionJob.slice(
      productionJob.indexOf("  deploy-production:"),
      productionJob.indexOf("  smoke-test:"),
    );
    expect(productionSlice).not.toContain("occasionfun-cloudformation-demo");
    expect(productionSlice).not.toContain("secrets.AWS_ACCESS_KEY_ID");
    expect(productionSlice).toContain("--stack-name occasionfun-co-uk-prod-contact");
    expect(samDeploy).not.toContain("--role-arn \"$ROLE_ARN\"");
    const result = runConfigCheck("prod", ["--role-arn", DEMO_CLOUDFORMATION_ROLE_ARN]);
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(
      /Production cannot use the demo CloudFormation execution role/,
    );
    expect(result.stdout).not.toContain("Demo change sets use CloudFormation role");
    expect(result.stdout).not.toContain("No change set was created.");

    const withoutRole = runConfigCheck("prod");
    expect(withoutRole.status, withoutRole.stderr || withoutRole.stdout).toBe(0);
    expect(withoutRole.stdout).not.toContain(DEMO_CLOUDFORMATION_ROLE_ARN);
    expect(withoutRole.stdout).toContain("No change set was created.");
  });
});
