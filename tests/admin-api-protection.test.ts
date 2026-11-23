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

function invokePermissions(source: string): { name: string; body: string }[] {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n {2}(?=[A-Z])/);
  return blocks
    .filter((block) => block.includes("Type: AWS::Lambda::Permission"))
    .map((block) => ({
      name: block.slice(0, block.indexOf(":")),
      body: block,
    }));
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
    expect(permissions.map((permission) => permission.name).sort()).toEqual([
      "AdminApiInvokePermission",
      "AdminAuthorizerInvokePermission",
      "AdminEnquiryListInvokePermission",
      "AdminEnquiryReadInvokePermission",
      "AdminEnquiryReviewInvokePermission",
      "AdminEnquirySummaryInvokePermission",
    ]);
    for (const permission of permissions) {
      expect(permission.body).toContain("Action: lambda:InvokeFunction");
      expect(permission.body).toContain("Principal: apigateway.amazonaws.com");
      expect(permission.body).toContain("SourceAccount: !Ref AWS::AccountId");
      expect(permission.body).toContain("${AdminHttpApi}");
      expect(permission.body).not.toContain("/*/");
      expect(permission.body).not.toMatch(/Principal:\s*"\*"/);
    }
    expect(permissions[0].body).not.toBe(permissions[1].body);
    const sources = permissions.map((permission) => permission.body).join("\n");
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
});
