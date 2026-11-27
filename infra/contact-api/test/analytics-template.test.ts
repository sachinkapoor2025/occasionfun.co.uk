import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderContactTemplate } from "../../../scripts/render-contact-template.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const template = readFileSync(path.join(packageRoot, "template.yaml"), "utf8");

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
    expect(visitors).toContain("DeletionPolicy: Retain");
    expect(visitors).toContain("UpdateReplacePolicy: Retain");
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

    expect(pages).toContain("DeletionPolicy: Retain");
    expect(pages).toContain("UpdateReplacePolicy: Retain");
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
    expect(fn).toContain("Runtime: nodejs24.x");
    expect(fn).toContain("MemorySize: 256");
    expect(fn).toContain("Timeout: 10");
    expect(fn).toContain("- arm64");
    expect(fn).toContain(
      "CodeUri: s3://aws-sam-cli-managed-default-samclisourcebucket-pjopzssdwf27/demo/087bcd8fc88fe771071d57216dbbe448",
    );
    expect(fn).not.toContain("CodeUri: analytics-dist/");
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
    expect(role).not.toContain("TrafficStatsTable");
    expect(fn).not.toContain("TRAFFIC_STATS_TABLE_NAME");
    expect(fn).not.toContain("AGGREGATE_MEASUREMENT_ENABLED");
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
    expect(api).toContain("/analytics/measure:");
    expect(api).toContain("ThrottlingBurstLimit: 10");
    expect(api).toContain("ThrottlingRateLimit: 5");
    expect(api).toContain("post:");
    expect(api).not.toContain("security:");
    expect(api).not.toContain("Authorizer");
    expect(resources.match(/Condition: DeployAnalytics/g)?.length).toBeGreaterThanOrEqual(11);
  });

  it("defines the aggregate counter table and a separate measure function", () => {
    const table = block(resources, "TrafficStatsTable");
    const role = block(resources, "AnalyticsMeasureRole");
    const fn = block(resources, "AnalyticsMeasureFunction");
    const permission = block(resources, "AnalyticsMeasureFunctionPostMeasurePermission");
    expect(table).toContain("Condition: DeployAnalytics");
    expect(table).toContain("DeletionPolicy: Retain");
    expect(table).toContain("UpdateReplacePolicy: Retain");
    expect(table).toContain("TableName: occasionfun-co-uk-demo-traffic-stats");
    expect(table).toContain("BillingMode: PAY_PER_REQUEST");
    expect(table).toContain("AttributeName: statDay");
    expect(table).toContain("AttributeName: statKey");
    expect(table).toContain("KeyType: HASH");
    expect(table).toContain("KeyType: RANGE");
    expect(table).toContain("PointInTimeRecoveryEnabled: true");
    expect(table).toContain("SSEType: KMS");
    expect(table).toContain("AttributeName: expiresAt");
    expect(table).not.toContain("GlobalSecondaryIndexes");
    expect(table).not.toContain("IndexName");
    expect(role).toContain("RoleName: occasionfun-co-uk-demo-analytics-measure");
    expect(role).toContain("dynamodb:UpdateItem");
    expect(role).toContain("!GetAtt TrafficStatsTable.Arn");
    expect(role).not.toContain("VisitorsTable");
    expect(role).not.toContain("PageViewsTable");
    expect(role).not.toContain("LeadsTable");
    expect(role).not.toContain("dynamodb:Scan");
    expect(role).not.toContain("dynamodb:PutItem");
    expect(role).not.toContain("dynamodb:GetItem");
    expect(role).not.toContain("dynamodb:Query");
    expect(fn).toContain("FunctionName: occasionfun-co-uk-demo-analytics-measure");
    expect(fn).toContain("CodeUri: analytics-measure-dist/");
    expect(fn).toContain("Handler: measure.handler");
    expect(fn).not.toContain("CodeUri: analytics-dist/");
    expect(fn).toContain("TRAFFIC_STATS_TABLE_NAME: !Ref TrafficStatsTable");
    expect(fn).toContain('AGGREGATE_MEASUREMENT_ENABLED: "false"');
    expect(fn).not.toContain('AGGREGATE_MEASUREMENT_ENABLED: "true"');
    expect(fn).toContain('GEOLITE2_COUNTRY_DB: ""');
    expect(fn).not.toContain("VISITORS_TABLE_NAME");
    expect(permission).toContain("POST/analytics/measure");
    expect(permission).toContain("FunctionName: !Ref AnalyticsMeasureFunction");
    expect(permission).not.toContain("POST/analytics/collect");
    expect(block(resources, "AnalyticsIngestFunction")).not.toContain("analytics-measure-dist/");
  });

  it("keeps the aggregate report role to Query on the traffic-stats table", () => {
    const role = block(template, "AnalyticsReportRole");
    const fn = block(template, "AnalyticsReportFunction");
    const permission = block(template, "AnalyticsReportFunctionGetSummaryPermission");
    expect(role).toContain("Condition: DeployAdminApi");
    expect(role).toContain("RoleName: occasionfun-co-uk-demo-analytics-report");
    expect(role).toContain("dynamodb:Query");
    expect(role).toContain("table/occasionfun-co-uk-demo-traffic-stats");
    expect(role).not.toContain("dynamodb:UpdateItem");
    expect(role).not.toContain("dynamodb:Scan");
    expect(role).not.toContain("dynamodb:PutItem");
    expect(role).not.toContain("dynamodb:GetItem");
    expect(role).not.toContain("dynamodb:DeleteItem");
    expect(role).not.toContain("VisitorsTable");
    expect(role).not.toContain("PageViewsTable");
    expect(role).not.toContain("LeadsTable");
    expect(fn).toContain("FunctionName: occasionfun-co-uk-demo-analytics-report");
    expect(fn).toContain("CodeUri: analytics-report-dist/");
    expect(fn).toContain("Handler: report.handler");
    expect(fn).toContain("TRAFFIC_STATS_TABLE_NAME: occasionfun-co-uk-demo-traffic-stats");
    expect(fn).not.toContain("AGGREGATE_MEASUREMENT_ENABLED");
    expect(fn).not.toContain("LEADS_TABLE_NAME");
    expect(permission).toContain("GET/analytics/summary");
    expect(permission).toContain("${AdminHttpApi}");
    expect(permission).not.toContain("${AnalyticsHttpApi}");
    expect(permission).not.toContain("POST/analytics/measure");
    expect(block(template, "AnalyticsMeasureRole")).toContain("dynamodb:UpdateItem");
    expect(block(template, "AnalyticsMeasureRole")).not.toContain("dynamodb:Query");
    expect(block(template, "AnalyticsMeasureFunction")).toContain('AGGREGATE_MEASUREMENT_ENABLED: "false"');
    expect(block(template, "AnalyticsHttpApi")).not.toContain("/analytics/summary");
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
      "TrafficStatsTable",
      "AnalyticsMeasureFunction",
      "occasionfun-co-uk-demo-traffic-stats",
      "occasionfun-co-uk-demo-analytics-measure",
      "TRAFFIC_STATS_TABLE_NAME",
      "AGGREGATE_MEASUREMENT_ENABLED",
      "GEOLITE2_COUNTRY_DB",
      "/analytics/measure",
      "analytics-measure-dist/",
      "AnalyticsReport",
      "occasionfun-co-uk-demo-analytics-report",
      "analytics-report-dist/",
      "/analytics/summary",
      "087bcd8fc88fe771071d57216dbbe448",
      "aws-sam-cli-managed-default-samclisourcebucket-pjopzssdwf27",
    ]) {
      expect(production).not.toContain(name);
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
