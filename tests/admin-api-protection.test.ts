import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const template = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../infra/contact-api/template.yaml",
  ),
  "utf8",
);

const DATA_METHODS = new Set(["get", "post", "put", "patch", "delete", "head"]);
const AUTHORIZER = "AdminAccessTokenAuthorizer";

export function unprotectedRoutes(source: string): string[] {
  const problems: string[] = [];
  source = source.replace(/\r\n/g, "\n");
  if (!/^ {8}security:\n {10}- AdminAccessTokenAuthorizer: \[\]$/m.test(source)) {
    problems.push("default authoriser is not AdminAccessTokenAuthorizer");
  }
  if (/Authorizer:\s*NONE/.test(source) || /AuthorizationType:\s*NONE/.test(source)) {
    problems.push("a route sets the authoriser to NONE");
  }

  const pathsAt = source.indexOf("\n        paths:\n");
  const componentsAt = source.indexOf("\n        components:\n");
  if (pathsAt === -1 || componentsAt === -1 || componentsAt < pathsAt) {
    problems.push("OpenAPI paths are missing");
    return problems;
  }
  const paths = source.slice(pathsAt, componentsAt).split("\n");
  let route = "";
  let method = "";
  let block: string[] = [];
  const routes: { key: string; method: string; block: string }[] = [];

  function flush() {
    if (route && method) routes.push({ key: `${method.toUpperCase()} ${route}`, method, block: block.join("\n") });
  }

  for (const line of paths) {
    const pathMatch = /^ {10}(\/[^:]+):$/.exec(line);
    const methodMatch = /^ {12}([a-z]+):$/.exec(line);
    if (pathMatch) {
      flush();
      route = pathMatch[1];
      method = "";
      block = [];
      continue;
    }
    if (methodMatch) {
      flush();
      method = methodMatch[1];
      block = [];
      continue;
    }
    if (method) block.push(line);
  }
  flush();

  if (routes.length === 0) problems.push("no routes are defined");

  for (const entry of routes) {
    if (entry.method === "options") {
      if (!/NONE:\s*\[\]/.test(entry.block)) {
        problems.push(`${entry.key} preflight is not an explicit non-Lambda CORS response`);
      }
      if (/type:\s*aws_proxy/.test(entry.block)) {
        problems.push(`${entry.key} preflight invokes a Lambda`);
      }
      continue;
    }
    if (!DATA_METHODS.has(entry.method)) {
      problems.push(`${entry.key} uses an unexpected method`);
      continue;
    }
    if (!new RegExp(`${AUTHORIZER}:\\s*\\[\\]`).test(entry.block) || /NONE:/.test(entry.block)) {
      problems.push(`${entry.key} is not protected by ${AUTHORIZER}`);
    }
  }

  return problems;
}

const ADMIN_INVOKE_PERMISSIONS = [
  "AdminApiInvokePermission",
  "AdminAuthorizerInvokePermission",
  "AdminEnquiryListInvokePermission",
  "AdminEnquiryReadInvokePermission",
  "AdminEnquiryReviewInvokePermission",
  "AdminEnquirySummaryInvokePermission",
];

const ANALYTICS_COLLECT_PERMISSION = "AnalyticsIngestFunctionPostCollectPermission";
const ANALYTICS_MEASURE_PERMISSION = "AnalyticsMeasureFunctionPostMeasurePermission";
const ANALYTICS_REPORT_PERMISSION = "AnalyticsReportFunctionGetSummaryPermission";

function invokePermissions(source: string): { name: string; body: string }[] {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n {2}(?=[A-Z])/);
  return blocks
    .filter((block) => block.includes("Type: AWS::Lambda::Permission"))
    .map((block) => ({
      name: block.slice(0, block.indexOf(":")),
      body: block,
    }));
}

function isAdminApiPermission(permission: { body: string }): boolean {
  const invokesAdminFunction =
    permission.body.includes("FunctionName: !Ref AdminApiFunction") ||
    permission.body.includes("FunctionName: !Ref AdminAuthorizerFunction");
  return (
    permission.body.includes("Condition: DeployAdminApi") &&
    invokesAdminFunction &&
    permission.body.includes("${AdminHttpApi}")
  );
}

describe("admin API default protection", () => {
  it("protects every data route and rejects an unprotected route", () => {
    const normalised = template.replace(/\r\n/g, "\n");
    expect(unprotectedRoutes(normalised)).toEqual([]);
    const open = normalised.replace(
      "          /health:",
      "          /open:\n            get:\n              security:\n                - NONE: []\n          /health:",
    );
    expect(unprotectedRoutes(open)).toContain("GET /open is not protected by AdminAccessTokenAuthorizer");
    const missingDefault = normalised.replace(
      "        security:\n          - AdminAccessTokenAuthorizer: []\n",
      "",
    );
    expect(unprotectedRoutes(missingDefault)).toContain(
      "default authoriser is not AdminAccessTokenAuthorizer",
    );
  });

  it("allows only this API Gateway API to invoke the admin Lambdas", () => {
    const permissions = invokePermissions(template);
    const adminPermissions = permissions.filter(isAdminApiPermission);
    expect(adminPermissions.map((permission) => permission.name).sort()).toEqual([
      ...ADMIN_INVOKE_PERMISSIONS,
    ].sort());
    expect(
      permissions.filter(
        (permission) =>
          !isAdminApiPermission(permission) &&
          permission.name !== ANALYTICS_COLLECT_PERMISSION &&
          permission.name !== ANALYTICS_MEASURE_PERMISSION &&
          permission.name !== ANALYTICS_REPORT_PERMISSION,
      ),
    ).toEqual([]);
    for (const permission of adminPermissions) {
      expect(permission.body).toContain("Action: lambda:InvokeFunction");
      expect(permission.body).toContain("Principal: apigateway.amazonaws.com");
      expect(permission.body).toContain("SourceAccount: !Ref AWS::AccountId");
      expect(permission.body).toContain("${AdminHttpApi}");
      expect(permission.body).not.toContain("/*/");
      expect(permission.body).not.toMatch(/Principal:\s*"\*"/);
    }
    expect(adminPermissions[0].body).not.toBe(adminPermissions[1].body);
    const sources = adminPermissions.map((permission) => permission.body).join("\n");
    expect(sources).toContain("${AdminHttpApi}/authorizers/*");
    expect(sources).toContain("${AdminHttpApi}/$default/GET/health");
    expect(sources).toContain("${AdminHttpApi}/$default/GET/enquiries");
    expect(sources).toContain("${AdminHttpApi}/$default/GET/enquiries/summary");
    expect(sources).toContain("${AdminHttpApi}/$default/GET/enquiries/*");
    expect(sources).toContain("${AdminHttpApi}/$default/PATCH/enquiries/*");
    expect(template).not.toMatch(/RoleName:.*contact/);
    expect(template).not.toContain("occasionfun-cloudformation-production");
    const roles = template.split("Type: AWS::IAM::Role").slice(1);
    for (const role of roles) {
      expect(role.slice(0, role.indexOf("Type: AWS::"))).not.toContain("lambda:InvokeFunction");
    }
  });

  it("allows only the analytics API POST /analytics/collect route to invoke the ingestion Lambda", () => {
    const analyticsPermissions = invokePermissions(template).filter(
      (permission) => permission.name === ANALYTICS_COLLECT_PERMISSION,
    );
    expect(analyticsPermissions).toHaveLength(1);
    const body = analyticsPermissions[0].body;
    expect(body).toContain("Condition: DeployAnalytics");
    expect(body).not.toContain("Condition: DeployAdminApi");
    expect(body).toContain("Action: lambda:InvokeFunction");
    expect(body).toContain("FunctionName: !Ref AnalyticsIngestFunction");
    expect(body).toContain("Principal: apigateway.amazonaws.com");
    expect(body).toContain(
      "SourceArn: !Sub arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${AnalyticsHttpApi}/$default/POST/analytics/collect",
    );
    expect(body.match(/SourceArn:/g)).toHaveLength(1);
    expect(body).not.toContain("${AdminHttpApi}");
    expect(body).not.toContain("${ContactHttpApi}");
    expect(body).not.toContain("AdminApiFunction");
    expect(body).not.toContain("AdminAuthorizerFunction");
    expect(body).not.toContain("/*/");
    expect(body).not.toMatch(/Principal:\s*"\*"/);
  });

  it("allows only POST /analytics/measure to invoke the aggregate Lambda", () => {
    const permissions = invokePermissions(template).filter(
      (permission) => permission.name === ANALYTICS_MEASURE_PERMISSION,
    );
    expect(permissions).toHaveLength(1);
    const body = permissions[0].body;
    expect(body).toContain("Condition: DeployAnalytics");
    expect(body).toContain("FunctionName: !Ref AnalyticsMeasureFunction");
    expect(body).toContain(
      "SourceArn: !Sub arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${AnalyticsHttpApi}/$default/POST/analytics/measure",
    );
    expect(body).not.toContain("POST/analytics/collect");
    expect(body).not.toContain("AnalyticsIngestFunction");
    expect(body).not.toContain("/*/");
  });

  it("allows only GET /analytics/summary on the admin API to invoke the report Lambda", () => {
    const permissions = invokePermissions(template).filter(
      (permission) => permission.name === ANALYTICS_REPORT_PERMISSION,
    );
    expect(permissions).toHaveLength(1);
    const body = permissions[0].body;
    expect(body).toContain("Condition: DeployAdminApi");
    expect(body).toContain("FunctionName: !Ref AnalyticsReportFunction");
    expect(body).toContain("SourceAccount: !Ref AWS::AccountId");
    expect(body).toContain(
      "SourceArn: !Sub arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${AdminHttpApi}/$default/GET/analytics/summary",
    );
    expect(body.match(/SourceArn:/g)).toHaveLength(1);
    expect(body).not.toContain("${AnalyticsHttpApi}");
    expect(body).not.toContain("${ContactHttpApi}");
    expect(body).not.toContain("AdminApiFunction");
    expect(body).not.toContain("POST/analytics/measure");
    expect(body).not.toContain("/*/");
    expect(unprotectedRoutes(template.replace(/\r\n/g, "\n"))).toEqual([]);
  });
});
