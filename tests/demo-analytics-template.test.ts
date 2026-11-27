import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findUnsafeChanges } from "../scripts/assert-safe-change-set.mjs";
import {
  COLLECTOR_CODE_URI,
  PRESERVED_DEMO_ANALYTICS_IDS,
  assertDemoAnalyticsTemplate,
  assertProductionOmitsDemoAnalytics,
} from "../scripts/assert-demo-analytics-template.mjs";
import { renderContactTemplate } from "../scripts/render-contact-template.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const template = readFileSync(path.join(root, "infra/contact-api/template.yaml"), "utf8");
const deployScript = readFileSync(path.join(root, "scripts/deploy-contact-stack.sh"), "utf8");
const workflow = readFileSync(path.join(root, ".github/workflows/ci-cd.yml"), "utf8");

function without(source: string, token: string): string {
  return source.replaceAll(token, "");
}

describe("demo analytics template guard", () => {
  it("accepts the source template, the rendered demo template, and rejects production", () => {
    expect(() => assertDemoAnalyticsTemplate(template, "source")).not.toThrow();
    const demo = renderContactTemplate(template, "demo");
    expect(demo).toBe(template);
    expect(() => assertDemoAnalyticsTemplate(demo, "rendered demo")).not.toThrow();
    const production = renderContactTemplate(template, "prod");
    expect(() => assertProductionOmitsDemoAnalytics(production, "production")).not.toThrow();
    expect(() => assertDemoAnalyticsTemplate(production, "production")).toThrow(/missing AnalyticsMeasureFunction/);
  });

  it("rejects omission of each deployed logical ID, route, retention policy, and collector object", () => {
    for (const id of PRESERVED_DEMO_ANALYTICS_IDS) {
      expect(() => assertDemoAnalyticsTemplate(without(template, `  ${id}:`), id)).toThrow(
        new RegExp(`missing ${id}`),
      );
    }
    for (const route of ["/analytics/collect", "/analytics/measure", "/analytics/summary"]) {
      expect(() => assertDemoAnalyticsTemplate(without(template, route), route)).toThrow(
        new RegExp(`missing ${route.replaceAll("/", "\\/")}`),
      );
    }
    const retainedTable = template.replace(/(TrafficStatsTable:[\s\S]*?DeletionPolicy:) Retain/, "$1 Delete");
    expect(retainedTable).not.toBe(template);
    expect(() => assertDemoAnalyticsTemplate(retainedTable, "table")).toThrow(/retain TrafficStatsTable/);
    expect(() => assertDemoAnalyticsTemplate(template.replace(COLLECTOR_CODE_URI, "s3://example/other"), "collector")).toThrow(
      /deployed collector object/,
    );
    expect(() =>
      assertDemoAnalyticsTemplate(
        template.replace('AGGREGATE_MEASUREMENT_ENABLED: "false"', 'AGGREGATE_MEASUREMENT_ENABLED: "true"'),
        "flag",
      ),
    ).toThrow(/string false exactly once/);
  });

  it("keeps summary authorization and treats every preserved removal or collector modification as unsafe", () => {
    expect(template).toContain("AdminAccessTokenAuthorizer");
    const removals = PRESERVED_DEMO_ANALYTICS_IDS.map((logicalId) => ({
      ResourceChange: {
        Action: "Remove",
        LogicalResourceId: logicalId,
        Replacement: "False",
      },
    }));
    const findings = findUnsafeChanges(removals, {
      mode: "update",
      environment: "demo",
      analyticsDeployment: "enabled",
    });
    expect(findings.map((finding) => finding.logicalId).sort()).toEqual([...PRESERVED_DEMO_ANALYTICS_IDS].sort());
    expect(findings.every((finding) => finding.reasons.includes("deletion"))).toBe(true);
    expect(
      findUnsafeChanges(
        [
          {
            ResourceChange: {
              Action: "Modify",
              LogicalResourceId: "AnalyticsIngestFunction",
              Replacement: "False",
            },
          },
        ],
        { mode: "update", environment: "demo", analyticsDeployment: "enabled" },
      )[0]?.reasons,
    ).toContain("existing analytics collector would be modified");
  });

  it("runs the same template check from the deploy script and both GitHub package stages", () => {
    const demoGuard = deployScript.slice(
      deployScript.indexOf('template="$ROOT/infra/contact-api/.aws-sam/build/template.yaml"'),
      deployScript.indexOf("sam_args=("),
    );
    expect(demoGuard).toContain('if [ "$ENVIRONMENT" = "demo" ]; then');
    expect(demoGuard).toContain('assert-demo-analytics-template.mjs" --template "$template"');
    expect(workflow).toContain("node scripts/assert-demo-analytics-template.mjs --template infra/contact-api/template.yaml");
    expect(workflow).toContain("node scripts/assert-demo-analytics-template.mjs --template infra/contact-api/template.demo.yaml");
    expect(workflow).toContain(
      "node scripts/assert-demo-analytics-template.mjs --template infra/contact-api/.aws-sam/build/template.yaml",
    );
    expect(workflow).toContain(
      "node scripts/assert-demo-analytics-template.mjs --production-template infra/contact-api/template.production.yaml",
    );
    expect(workflow).toContain("node ../../scripts/assert-demo-analytics-template.mjs --template template.demo.yaml");
    expect(workflow).toContain("node ../../scripts/assert-demo-analytics-template.mjs --template .aws-sam/build/template.yaml");
  });
});
