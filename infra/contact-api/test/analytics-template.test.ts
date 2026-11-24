import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderContactTemplate } from "../../../scripts/render-contact-template.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const template = readFileSync(path.join(packageRoot, "template.yaml"), "utf8");
const productionFile = readFileSync(path.join(packageRoot, "template.production.yaml"), "utf8");

function region(begin: string, end: string): string {
  const start = template.indexOf(`  # ${begin}`);
  const stop = template.indexOf(`  # ${end}`);
  if (start === -1 || stop < start) throw new Error(`${begin} was not found`);
  return template.slice(start, stop);
}

function block(source: string, logicalId: string): string {
  const start = source.indexOf(`\n  ${logicalId}:`);
  if (start === -1) throw new Error(`${logicalId} was not found`);
  const next = source.slice(start + 1).search(/\n {2}[A-Za-z]/);
  return next === -1 ? source.slice(start) : source.slice(start, start + 1 + next);
}

describe("demo analytics infrastructure", () => {
  const resources = region("BEGIN DEMO ANALYTICS RESOURCES", "END DEMO ANALYTICS RESOURCES");
  const parameter = region("BEGIN DEMO ANALYTICS PARAMETERS", "END DEMO ANALYTICS PARAMETERS");
  const enabled = template.replace("Default: disabled", "Default: enabled");

  it("defaults analytics to disabled and creates neither table", () => {
    expect(parameter).toContain("Default: disabled");
    expect(parameter).toContain("- disabled");
    expect(parameter).toContain("- enabled");
    expect(template).toContain("DeployAnalytics: !And");
    expect(template).toContain('!Equals [!Ref AnalyticsDeployment, "enabled"]');
    expect(block(template, "VisitorsTable")).toContain("Condition: DeployAnalytics");
    expect(block(template, "PageViewsTable")).toContain("Condition: DeployAnalytics");
    expect(template).not.toMatch(/Condition: IsDemo\b/);
  });

  it("defines both tables with the approved keys, indexes, TTL, PITR, and on-demand billing when enabled", () => {
    expect(enabled).toContain("Default: enabled");
    const visitors = block(resources, "VisitorsTable");
    const pages = block(resources, "PageViewsTable");
    expect(visitors).toContain("TableName: occasionfun-co-uk-demo-visitors");
    expect(visitors).toContain("BillingMode: PAY_PER_REQUEST");
    expect(visitors).toContain("AttributeName: visitorId");
    expect(visitors).toContain("AttributeName: itemKey");
    expect(visitors).toContain("IndexName: by-activity-day");
    expect(visitors).toContain("AttributeName: day");
    expect(visitors).toContain("ProjectionType: INCLUDE");
    for (const attribute of [
      "itemKey",
      "expiresAt",
      "firstSeenDay",
      "newVisitor",
      "source",
      "landingPath",
      "lastEventAt",
      "dayFirstAt",
    ]) {
      expect(visitors).toContain(`- ${attribute}`);
    }
    expect(visitors).toContain("PointInTimeRecoveryEnabled: true");
    expect(visitors).toContain("SSEType: KMS");
    expect(visitors).toContain("AttributeName: expiresAt");
    expect(visitors).toContain("Enabled: true");

    expect(pages).toContain("TableName: occasionfun-co-uk-demo-page-views");
    expect(pages).toContain("BillingMode: PAY_PER_REQUEST");
    expect(pages).toContain("AttributeName: eventSort");
    expect(pages).toContain("IndexName: by-event-day");
    expect(pages).toContain("AttributeName: eventDay");
    expect(pages).toContain("PointInTimeRecoveryEnabled: true");
    expect(pages).toContain("SSEType: KMS");
    expect(pages).toContain("AttributeName: expiresAt");
    for (const attribute of [
      "eventId",
      "sessionId",
      "pagePath",
      "referrerHost",
      "utmSource",
      "utmMedium",
      "utmCampaign",
      "utmTerm",
      "utmContent",
      "deviceCategory",
      "browserCategory",
      "occurredAt",
    ]) {
      expect(pages).toContain(`- ${attribute}`);
    }
  });

  it("keeps ingestion separate, least privilege, and limited to the public collect route", () => {
    const role = block(resources, "AnalyticsIngestRole");
    const fn = block(resources, "AnalyticsIngestFunction");
    const api = block(resources, "AnalyticsHttpApi");
    expect(fn).toContain("FunctionName: occasionfun-co-uk-demo-analytics-ingest");
    expect(fn).toContain("CodeUri: analytics-dist/");
    expect(fn).toContain("Handler: handler.handler");
    expect(fn).not.toContain("CodeUri: dist/");
    expect(fn).not.toContain("CodeUri: admin-dist/");
    expect(fn).toContain("VISITORS_TABLE_NAME: !Ref VisitorsTable");
    expect(fn).toContain("PAGE_VIEWS_TABLE_NAME: !Ref PageViewsTable");
    expect(fn).not.toContain("LEADS_TABLE_NAME");
    expect(fn).not.toContain("Type: HttpApi");
    const permission = block(resources, "AnalyticsIngestFunctionPostCollectPermission");
    expect(permission).toContain("Type: AWS::Lambda::Permission");
    expect(permission).toContain("POST/analytics/collect");
    expect(permission).not.toContain("SourceAccount");
    expect(permission).not.toContain("LeadsTable");
    expect(role).toContain("dynamodb:PutItem");
    expect(role).toContain("dynamodb:UpdateItem");
    expect(role).toContain("dynamodb:GetItem");
    expect(role).toContain("dynamodb:Query");
    expect(role).toContain("!GetAtt VisitorsTable.Arn");
    expect(role).toContain("!GetAtt PageViewsTable.Arn");
    expect(role).not.toContain("LeadsTable");
    expect(role).not.toContain("dynamodb:Scan");
    expect(role).not.toContain("dynamodb:DeleteItem");
    expect(role).not.toContain("/index/");
    expect(api).toContain("https://occasionfun.co.uk");
    expect(api).toContain("https://www.occasionfun.co.uk");
    expect(api).toContain("https://demo.d2oib89bmco9su.amplifyapp.com");
    expect(api).toContain("https://d2oib89bmco9su.amplifyapp.com");
    expect(api).not.toContain("*");
    expect(api).toContain("- POST");
    expect(api).toContain("- OPTIONS");
    expect(api).toContain("- content-type");
    expect(api).toContain("/analytics/collect:");
    expect(api).toContain("post:");
    expect(api).not.toContain("security:");
    expect(api).not.toContain("Authorizer");
    expect(resources.match(/Condition: DeployAnalytics/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("removes analytics from production and leaves contact and admin resources in place", () => {
    const production = renderContactTemplate(template, "prod");
    for (const name of [
      "AnalyticsDeployment",
      "DeployAnalytics",
      "VisitorsTable",
      "PageViewsTable",
      "AnalyticsIngestFunction",
      "AnalyticsHttpApi",
      "occasionfun-co-uk-demo-visitors",
      "occasionfun-co-uk-demo-page-views",
      "VISITORS_TABLE_NAME",
      "PAGE_VIEWS_TABLE_NAME",
      "/analytics/collect",
    ]) {
      expect(production).not.toContain(name);
      expect(productionFile).not.toContain(name);
    }
    expect(production).toContain("TableName: occasionfun-co-uk-prod-leads");
    expect(production).toContain("FunctionName: occasionfun-co-uk-prod-contact");
    expect(template).toContain("FunctionName: occasionfun-co-uk-contact");
    expect(template).toContain("FunctionName: occasionfun-co-uk-demo-admin-api");
    expect(template).toContain("LEADS_TABLE_NAME: !Ref LeadsTable");
    expect(block(template, "ContactFunction")).not.toContain("VISITORS_TABLE_NAME");
    expect(block(template, "AdminApiFunction")).not.toContain("VISITORS_TABLE_NAME");
    const demo = renderContactTemplate(template, "demo");
    expect(demo).toBe(template);
    expect(demo).toContain("Default: disabled");
  });
});
