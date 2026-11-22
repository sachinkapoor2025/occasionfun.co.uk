import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  renderContactTemplate,
  retrySchedulePermission,
} from "../../../scripts/render-contact-template.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const template = readFileSync(path.join(packageRoot, "template.yaml"), "utf8");
const handlerSource = readFileSync(path.join(packageRoot, "src/handler.ts"), "utf8");

const demoNames = {
  table: "occasionfun-co-uk-leads",
  contactFunction: "occasionfun-co-uk-contact",
  retryFunction: "occasionfun-co-uk-contact-retry",
  contactLogGroup: "/aws/lambda/occasionfun-co-uk-contact",
  retryLogGroup: "/aws/lambda/occasionfun-co-uk-contact-retry",
  subjectPrefix: "[DEMO]",
};

const prodNames = {
  table: "occasionfun-co-uk-prod-leads",
  contactFunction: "occasionfun-co-uk-prod-contact",
  retryFunction: "occasionfun-co-uk-prod-contact-retry",
  retryRuleName: "occasionfun-co-uk-prod-contact-retry",
  contactLogGroup: "/aws/lambda/occasionfun-co-uk-prod-contact",
  retryLogGroup: "/aws/lambda/occasionfun-co-uk-prod-contact-retry",
  subjectPrefix: "[PROD]",
};

function parameterBlock(name: string): string {
  const match = template.match(
    new RegExp(`  ${name}:[\\s\\S]*?(?=\\n  [A-Z]|\\nConditions:|\\nGlobals:)`),
  );
  if (!match) throw new Error(`${name} parameter was not found`);
  return match[0];
}

function hasLiteralLine(source: string, property: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^ +${property}: ${escaped}\\r?$`, "m").test(source);
}

describe("contact API environments", () => {
  it("defaults Environment to demo and allows only demo or prod", () => {
    const parameter = parameterBlock("Environment");
    expect(parameter).toMatch(/Default:\s*demo\b/);
    expect(parameter).toContain("- demo");
    expect(parameter).toContain("- prod");
    expect(template).toContain('IsProduction: !Equals [!Ref Environment, "prod"]');
  });

  it("keeps the existing demo physical names as literals", () => {
    expect(hasLiteralLine(template, "TableName", demoNames.table)).toBe(true);
    expect(hasLiteralLine(template, "LogGroupName", demoNames.contactLogGroup)).toBe(true);
    expect(hasLiteralLine(template, "LogGroupName", demoNames.retryLogGroup)).toBe(true);
    expect(hasLiteralLine(template, "FunctionName", demoNames.contactFunction)).toBe(true);
    expect(hasLiteralLine(template, "FunctionName", demoNames.retryFunction)).toBe(true);
    const contactResources = template.slice(0, template.indexOf("  # BEGIN DEMO ADMIN RESOURCES"));
    expect(contactResources).not.toMatch(/^ +(TableName|LogGroupName|FunctionName):\s*[!{]/m);
    expect(template).not.toContain("ContactRetryFunctionRetrySchedulePermission:");
    const schedule = template.slice(
      template.indexOf("ContactRetryFunctionRetrySchedule:"),
      template.indexOf("ContactHttpApi:"),
    );
    expect(schedule).not.toContain("SourceAccount");
  });

  it("leaves the retained demo retry permission out of the application stack", () => {
    const permission = retrySchedulePermission(template);
    expect(permission.functionName).toBe(demoNames.retryFunction);
    expect(permission.declaresPermission).toBe(false);
    expect(permission.requiresReplacement).toBe(false);
    expect(permission.risks).toEqual([]);
    const retryRule = template.slice(
      template.indexOf("  ContactRetryFunctionRetrySchedule:"),
      template.indexOf("  ContactHttpApi:"),
    );
    expect(retryRule).not.toMatch(/Type:\s*AWS::Lambda::Permission/);
    expect(template.match(/Type:\s*AWS::Lambda::Permission/g)).toHaveLength(2);
    expect(template).not.toMatch(/Type:\s*Schedule\b/);
    expect(template).not.toContain("GHXjmJNlS8ce");
    expect(template).toContain("ScheduleExpression: rate(5 minutes)");
    expect(template).toContain("!GetAtt ContactRetryFunction.Arn");
    const newline = template.includes("\r\n") ? "\r\n" : "\n";
    const restored = template.replace(
      "  ContactHttpApi:",
      [
        "  ContactRetryFunctionRetrySchedulePermission:",
        "    Type: AWS::Lambda::Permission",
        "    Properties:",
        "      Action: lambda:InvokeFunction",
        "      FunctionName: !Ref ContactRetryFunction",
        "      Principal: events.amazonaws.com",
        "      SourceArn: !GetAtt ContactRetryFunctionRetrySchedule.Arn",
        "",
        "  ContactHttpApi:",
      ].join(newline),
    );
    expect(retrySchedulePermission(restored).declaresPermission).toBe(true);
    expect(retrySchedulePermission(restored).requiresReplacement).toBe(true);
    expect(() => renderContactTemplate(restored, "demo")).toThrow(/retry permission/);
    expect(() => renderContactTemplate(restored, "prod")).toThrow(/retry permission/);
  });

  it("gives the future production stack its own literal names", () => {
    const production = renderContactTemplate(template, "prod");
    expect(hasLiteralLine(production, "TableName", prodNames.table)).toBe(true);
    expect(hasLiteralLine(production, "LogGroupName", prodNames.contactLogGroup)).toBe(true);
    expect(hasLiteralLine(production, "LogGroupName", prodNames.retryLogGroup)).toBe(true);
    expect(hasLiteralLine(production, "FunctionName", prodNames.contactFunction)).toBe(true);
    expect(hasLiteralLine(production, "FunctionName", prodNames.retryFunction)).toBe(true);
    expect(hasLiteralLine(production, "TableName", demoNames.table)).toBe(false);
    expect(hasLiteralLine(production, "FunctionName", demoNames.contactFunction)).toBe(false);
    expect(hasLiteralLine(production, "FunctionName", demoNames.retryFunction)).toBe(false);
    expect(production).not.toMatch(/^ +(TableName|LogGroupName):\s*[!{]/m);
    expect(production).not.toContain("SourceAccount");
    expect(production).not.toContain("GHXjmJNlS8ce");
    expect(production).not.toMatch(/Type:\s*Schedule\b/);
    expect(production).not.toContain("ContactRetryFunctionRetrySchedulePermission:");
    expect(production).not.toContain("Type: AWS::Lambda::Permission");
    expect(production).toContain("FunctionName: occasionfun-co-uk-prod-contact-retry");
    expect(production).toContain(`Name: ${prodNames.retryRuleName}`);
    expect(prodNames.retryRuleName.length).toBeLessThanOrEqual(64);
    expect(prodNames.retryRuleName.startsWith("occasionfun-co-uk-prod-contact-")).toBe(true);
    expect(production).not.toContain("FunctionName: occasionfun-co-uk-contact-retry");
    expect(production).not.toContain("arn:aws:lambda:");
    expect(production).not.toContain("arn:aws:events:");
    const demo = renderContactTemplate(template, "demo");
    expect(demo).toBe(template);
    expect(demo).not.toContain("ContactRetryFunctionRetrySchedulePermission:");
  });

  it("points both functions at the table created by the same stack", () => {
    expect(template.match(/LEADS_TABLE_NAME: !Ref LeadsTable/g)).toHaveLength(2);
    expect(template.match(/!GetAtt LeadsTable\.Arn/g)).toHaveLength(2);
    expect(template).toContain("${LeadsTable.Arn}/index/notification-due");
    expect(template).not.toMatch(/arn:aws:dynamodb:/);
    expect(template).toContain(`TableName: ${demoNames.table}`);
    expect(template).not.toContain(`TableName: ${prodNames.table}`);
  });

  it("shares the existing SMTP secret and no other physical name", () => {
    const secret = parameterBlock("SmtpSecretArn");
    expect(secret).toContain("occasionfun-co-uk/contact/smtp");
    expect(secret).toContain(
      'AllowedPattern: "^arn:aws:secretsmanager:eu-west-2:[0-9]{12}:secret:occasionfun-co-uk/contact/smtp-.+$"',
    );
    expect(template.match(/SMTP_SECRET_ARN: !Ref SmtpSecretArn/g)).toHaveLength(2);
    expect(template).not.toMatch(/Type:\s*AWS::SecretsManager::Secret/);
    expect(template.match(/secretsmanager:GetSecretValue/g)).toHaveLength(2);

    const demoPhysicalNames = new Set(Object.values(demoNames).filter((name) => name !== "[DEMO]"));
    const prodPhysicalNames = new Set(Object.values(prodNames).filter((name) => name !== "[PROD]"));
    expect([...demoPhysicalNames].filter((name) => prodPhysicalNames.has(name))).toEqual([]);
    expect(template.match(/SMTP_FROM: enquiries@occasionfun.co.uk/g)).toHaveLength(2);
    expect(
      template.match(
        /SMTP_TO: dgv@mydgv.com,priya.yadav@mydgv.com,nitin.bhatt@mydgv.com,prashant@occasionfun.co.uk,bids@occasionfun.co.uk/g,
      ),
    ).toHaveLength(2);
  });

  it("requires a separate explicit origin list for each deployment", () => {
    const origins = parameterBlock("AllowedOrigins");
    expect(origins).not.toMatch(/Default:/);
    expect(origins).toContain('AllowedPattern: "^https://[A-Za-z0-9.-]+$"');
    expect(origins).not.toContain("https://occasionfun.co.uk");
    expect(origins).not.toContain("amplifyapp.com");
    expect(origins).not.toContain("*");
    expect(template).toContain("AllowOrigins: !Ref AllowedOrigins");
  });

  it("creates the API Gateway and retry schedule inside the stack", () => {
    expect(template).not.toContain("0e6zpkvbkj");
    expect(template.match(/Type: AWS::Serverless::HttpApi/g)).toHaveLength(2);
    expect(template).toContain("ApiId: !Ref ContactHttpApi");
    expect(template).not.toMatch(/Type:\s*Schedule\b/);
    expect(template).toContain("ScheduleExpression: rate(5 minutes)");
    const schedule = template.slice(
      template.indexOf("ContactRetryFunctionRetrySchedule:"),
      template.indexOf("ContactHttpApi:"),
    );
    expect(schedule).not.toMatch(/^ +Name:/m);
    expect(schedule).not.toContain("ContactRetryFunctionRetrySchedulePermission:");
  });

  it("sets the notification subject prefix without changing the sender", () => {
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefix = template.match(
      new RegExp(
        `NOTIFICATION_SUBJECT_PREFIX: !If \\[IsProduction, "${escapeRegExp(prodNames.subjectPrefix)}", "${escapeRegExp(demoNames.subjectPrefix)}"\\]`,
        "g",
      ),
    );
    expect(prefix).toHaveLength(2);
    expect(handlerSource).toContain("process.env.NOTIFICATION_SUBJECT_PREFIX");
    expect(handlerSource).toContain("enquirySubject(");
  });

  it("keeps the retained demo permission in its own template", () => {
    const permissionStack = readFileSync(
      path.join(packageRoot, "demo-retry-permission.yaml"),
      "utf8",
    );
    expect(permissionStack).toContain("Type: AWS::Lambda::Permission");
    expect(permissionStack).toContain("DeletionPolicy: Retain");
    expect(permissionStack).toContain("UpdateReplacePolicy: Retain");
    expect(permissionStack).toContain(`FunctionName: ${demoNames.retryFunction}`);
    expect(permissionStack).toContain(
      "arn:aws:events:eu-west-2:796174527529:rule/occasionfun-co-uk-contact-ContactRetryFunctionRetry-GHXjmJNlS8ce",
    );
    expect(permissionStack).not.toContain("occasionfun-co-uk-prod-");
    expect(permissionStack).not.toContain("SourceAccount");
    expect(permissionStack).not.toContain("*");
  });

  it("keeps the retained production permission in its own template", () => {
    const permissionStack = readFileSync(
      path.join(packageRoot, "prod-retry-permission.yaml"),
      "utf8",
    );
    expect(permissionStack).toContain("Type: AWS::Lambda::Permission");
    expect(permissionStack).toContain("DeletionPolicy: Retain");
    expect(permissionStack).toContain("UpdateReplacePolicy: Retain");
    expect(permissionStack).toContain(`FunctionName: ${prodNames.retryFunction}`);
    expect(permissionStack).toContain(
      "arn:aws:events:eu-west-2:796174527529:rule/occasionfun-co-uk-prod-contact-retry",
    );
    expect(permissionStack).toContain("occasionfun-co-uk-prod-contact-retry-permission");
    expect(permissionStack).not.toContain("GHXjmJNlS8ce");
    expect(permissionStack).not.toContain("occasionfun-co-uk-contact-retry");
    expect(permissionStack).not.toContain("SourceAccount");
    expect(permissionStack).not.toContain("*");
  });

  it("keeps SourceAccount off the contact retry rule and permission", () => {
    const newline = template.includes("\r\n") ? "\r\n" : "\n";
    const withRuleSourceAccount = template.replace(
      "ScheduleExpression: rate(5 minutes)",
      `ScheduleExpression: rate(5 minutes)${newline}      SourceAccount: !Ref AWS::AccountId`,
    );
    expect(retrySchedulePermission(withRuleSourceAccount).risks).toContain(
      "SourceAccount would replace the Lambda permission",
    );
    expect(() => renderContactTemplate(withRuleSourceAccount, "demo")).toThrow(/SourceAccount/);
    const withRetainedSourceAccount = template.replace(
      "  ContactHttpApi:",
      [
        "  ContactRetryFunctionRetrySchedulePermission:",
        "    Type: AWS::Lambda::Permission",
        "    Properties:",
        "      SourceAccount: !Ref AWS::AccountId",
        "      FunctionName: !Ref ContactRetryFunction",
        "",
        "  ContactHttpApi:",
      ].join(newline),
    );
    expect(retrySchedulePermission(withRetainedSourceAccount).risks).toContain(
      "SourceAccount would replace the Lambda permission",
    );
    expect(retrySchedulePermission(template).risks).toEqual([]);
  });

  it("conditions every admin resource on demo and removes them from production", () => {
    const resources = template.slice(
      template.indexOf("  # BEGIN DEMO ADMIN RESOURCES"),
      template.indexOf("  # END DEMO ADMIN RESOURCES"),
    );
    const outputs = template.slice(
      template.indexOf("  # BEGIN DEMO ADMIN OUTPUTS"),
      template.indexOf("  # END DEMO ADMIN OUTPUTS"),
    );
    const adminIds = [
      "AdminUserPool",
      "AdminUserPoolClient",
      "AdminGroup",
      "AdminAuthorizerLogGroup",
      "AdminApiLogGroup",
      "AdminAuthorizerRole",
      "AdminApiRole",
      "AdminAuthorizerFunction",
      "AdminAuthorizerInvokePermission",
      "AdminApiInvokePermission",
      "AdminApiFunction",
      "AdminHttpApi",
    ];
    const identityIds = ["AdminUserPool", "AdminUserPoolClient", "AdminGroup"];
    const apiIds = adminIds.filter((id) => !identityIds.includes(id));
    expect(resources.match(/Condition: DeployAdminIdentity/g)).toHaveLength(identityIds.length);
    expect(resources.match(/Condition: DeployAdminApi/g)).toHaveLength(apiIds.length);
    expect(outputs.match(/Condition: DeployAdminIdentity/g)).toHaveLength(2);
    expect(outputs.match(/Condition: DeployAdminApi/g)).toHaveLength(2);
    expect(template).toContain('IsDemo: !Equals [!Ref Environment, "demo"]');
    expect(template).toContain('IsAdminApiPhase: !Equals [!Ref AdminDeploymentPhase, "api"]');
    expect(resources).toContain("CodeUri: admin-dist/");
    expect(resources.match(/CodeUri: admin-dist\//g)).toHaveLength(2);
    expect(template.match(/^ +CodeUri: dist\/$/gm)).toHaveLength(2);
    expect(resources).toContain("Handler: handler.authorizer");
    expect(resources).toContain("Handler: handler.api");
    expect(resources).toContain("Timeout: 5");
    expect(resources).toContain("Timeout: 15");
    expect(resources).toContain("Runtime: nodejs24.x");
    expect(resources).toContain("arm64");
    expect(resources).not.toContain("secretsmanager");
    expect(resources).not.toContain("dynamodb:");
    expect(resources).not.toContain("LeadsTable");
    expect(resources).not.toContain("SmtpSecretArn");
    const production = renderContactTemplate(template, "prod");
    expect(production.match(/Type: AWS::Serverless::HttpApi/g)).toHaveLength(1);
    for (const id of adminIds) expect(production).not.toContain(id);
    expect(production).not.toContain("IsDemo");
    expect(production).not.toContain("AdminDeploymentPhase");
    expect(production).not.toContain("DeployAdminIdentity");
    expect(production).not.toContain("DeployAdminApi");
    expect(production).not.toContain("admin-dist/");
    expect(production).not.toContain("SourceAccount");
    expect(production).not.toContain("DeletionProtection");
    expect(production).not.toContain("DeletionPolicy");
    expect(production).not.toContain("UpdateReplacePolicy");
    expect(production).toContain("Timeout: 30");
    expect(production).toContain("TableName: occasionfun-co-uk-prod-leads");
    const demo = renderContactTemplate(template, "demo");
    expect(demo).toBe(template);
    expect(demo).toContain("AdminUserPool:");
    expect(demo).toContain("DeletionProtection: !If [IsAdminApiPhase, ACTIVE, INACTIVE]");
  });

  it("keeps phase 1 to Cognito and turns deletion protection on only in phase 2", () => {
    function block(logicalId: string): string {
      const start = template.indexOf(`  ${logicalId}:`);
      const next = template.slice(start + 1).search(/\n {2}[A-Za-z]/);
      return template.slice(start, start + 1 + next);
    }
    for (const logicalId of ["AdminUserPool", "AdminUserPoolClient", "AdminGroup"]) {
      const resource = block(logicalId);
      expect(resource).toContain("Condition: DeployAdminIdentity");
      expect(resource).toContain("DeletionPolicy: Delete");
      expect(resource).toContain("UpdateReplacePolicy: Retain");
      expect(resource).not.toContain("DeletionPolicy: Retain");
    }
    const pool = block("AdminUserPool");
    expect(pool).toContain("DeletionProtection: !If [IsAdminApiPhase, ACTIVE, INACTIVE]");
    for (const logicalId of [
      "AdminAuthorizerFunction",
      "AdminApiFunction",
      "AdminHttpApi",
      "AdminAuthorizerRole",
      "AdminApiRole",
    ]) {
      const resource = block(logicalId);
      expect(resource).toContain("Condition: DeployAdminApi");
      expect(resource).not.toContain("UpdateReplacePolicy:");
      expect(resource).not.toContain("DeletionProtection:");
    }
    expect(template).toContain("Default: none");
    expect(template).toContain('IsAdminIdentityPhase: !Equals [!Ref AdminDeploymentPhase, "identity"]');
    expect(template).toContain("DeployAdminIdentity: !And");
    expect(template).not.toMatch(/Condition: IsDemo/);
  });
});
