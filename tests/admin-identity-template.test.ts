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

function marked(begin: string, end: string): string {
  const start = template.indexOf(begin);
  const stop = template.indexOf(end);
  if (start === -1 || stop < start) throw new Error(`${begin} was not found`);
  return template.slice(start, stop);
}

const adminResources = marked("BEGIN DEMO ADMIN RESOURCES", "END DEMO ADMIN RESOURCES");

describe("demo admin identity template", () => {
  it("keeps the shared environment parameter and creates Cognito only for demo", () => {
    expect(template).toMatch(/AllowedValues:\r?\n\s+- demo\r?\n\s+- prod/);
    expect(template).toContain('IsDemo: !Equals [!Ref Environment, "demo"]');
    expect(template).toContain("Default: none");
    expect(adminResources.match(/Condition: DeployAdminIdentity/g)).toHaveLength(3);
    const demoAdminApiResources = [
      "AdminAuthorizerLogGroup",
      "AdminApiLogGroup",
      "AdminAuthorizerRole",
      "AdminApiRole",
      "AdminAuthorizerFunction",
      "AdminAuthorizerInvokePermission",
      "AdminApiInvokePermission",
      "AdminEnquiryListInvokePermission",
      "AdminEnquirySummaryInvokePermission",
      "AdminEnquiryReadInvokePermission",
      "AdminEnquiryReviewInvokePermission",
      "AdminApiFunction",
      "AdminHttpApi",
    ];
    const aggregateReportResources = [
      "AnalyticsReportLogGroup",
      "AnalyticsReportRole",
      "AnalyticsReportFunction",
      "AnalyticsReportFunctionGetSummaryPermission",
    ];
    expect(adminResources.match(/Condition: DeployAdminApi/g)).toHaveLength(
      demoAdminApiResources.length + aggregateReportResources.length,
    );
    for (const logicalId of [...demoAdminApiResources, ...aggregateReportResources]) {
      expect(adminResources, logicalId).toMatch(
        new RegExp(`^  ${logicalId}:\\r?\\n    Type: .+\\r?\\n    Condition: DeployAdminApi`, "m"),
      );
    }
    expect(template).toContain("UserPoolName: occasionfun-co-uk-demo-users");
    expect(template).toContain("UserPoolTier: ESSENTIALS");
    expect(template).toContain("ClientName: occasionfun-co-uk-demo-admin-web");
    expect(template).not.toContain("AWS::Cognito::UserPoolDomain");
    expect(template).not.toContain("ManagedLoginVersion");
    expect(template).toContain("GroupName: admin");
    expect(template).toContain('Assert: !Equals [!Ref "AWS::Region", "eu-west-2"]');
  });

  it("uses the approved token lifetimes and a public client", () => {
    expect(adminResources).toContain("AccessTokenValidity: 15");
    expect(adminResources).toContain("IdTokenValidity: 15");
    expect(adminResources).toContain("RefreshTokenValidity: 12");
    expect(adminResources).toContain("AccessToken: minutes");
    expect(adminResources).toContain("RefreshToken: hours");
    expect(adminResources).toContain("Feature: ENABLED");
    expect(adminResources).toContain("RetryGracePeriodSeconds: 0");
    expect(adminResources).toContain("AllowedOAuthFlowsUserPoolClient: false");
    expect(adminResources).not.toContain("AllowedOAuthFlows:");
    expect(adminResources).not.toContain("CallbackURLs:");
    expect(adminResources).not.toContain("LogoutURLs:");
    expect(adminResources).not.toContain("AllowedOAuthScopes:");
    expect(adminResources).not.toContain("SupportedIdentityProviders:");
    expect(adminResources).toMatch(/ExplicitAuthFlows:\r?\n\s+- ALLOW_USER_SRP_AUTH\r?\n/);
    expect(adminResources).not.toMatch(/^\s+- ALLOW_REFRESH_TOKEN_AUTH\s*$/m);
    expect(adminResources).not.toMatch(/^\s+- ALLOW_USER_AUTH\s*$/m);
    expect(adminResources).not.toMatch(/^\s+- ALLOW_USER_PASSWORD_AUTH\s*$/m);
    expect(adminResources).not.toMatch(/^\s+- ALLOW_ADMIN_USER_PASSWORD_AUTH\s*$/m);
    expect(adminResources).not.toMatch(/^\s+- ALLOW_CUSTOM_AUTH\s*$/m);
    expect(adminResources).toContain("MinimumLength: 8");
    expect(adminResources).toContain("RequireUppercase: true");
    expect(adminResources).toContain("RequireLowercase: true");
    expect(adminResources).toContain("RequireNumbers: true");
    expect(adminResources).toContain("RequireSymbols: true");
    expect(adminResources).toContain('MfaConfiguration: "OFF"');
    expect(adminResources).not.toContain('MfaConfiguration: "ON"');
    expect(adminResources).not.toContain("EnabledMfas:");
    expect(adminResources).not.toContain("SOFTWARE_TOKEN_MFA");
    expect(adminResources).not.toMatch(/^\s+- (SMS_MFA|EMAIL_OTP)\s*$/m);
    expect(adminResources).not.toContain("SMS_MFA");
    expect(adminResources).not.toContain("EMAIL_OTP");
    expect(adminResources).not.toContain("SmsConfiguration");
    expect(adminResources).toContain("DeletionProtection: !If [IsAdminApiPhase, ACTIVE, INACTIVE]");
    expect(adminResources).toContain("DeletionPolicy: Delete");
    expect(adminResources).toContain("UpdateReplacePolicy: Retain");
    expect(adminResources).not.toContain("DeletionPolicy: Retain");
    expect(adminResources).toContain("GenerateSecret: false");
    expect(adminResources).toContain("AllowAdminCreateUserOnly: false");
    expect(adminResources).not.toContain("LambdaConfig");
  });

  it("does not include contact resources, secrets, or grant functions", () => {
    expect(adminResources).not.toContain("occasionfun-co-uk-contact");
    expect(adminResources).not.toContain("occasionfun-co-uk-prod");
    expect(adminResources).not.toContain("secretsmanager");
    expect(adminResources).toContain("dynamodb:Query");
    expect(adminResources).toContain("dynamodb:GetItem");
    expect(adminResources).toContain("dynamodb:UpdateItem");
    expect(adminResources).toContain("index/notification-due");
    expect(adminResources).toContain("LEADS_TABLE_NAME: !Ref LeadsTable");
    expect(adminResources).not.toContain("dynamodb:Scan");
    expect(adminResources).not.toContain("dynamodb:PutItem");
    expect(adminResources).not.toContain("dynamodb:DeleteItem");
    expect(adminResources).not.toContain("AWS::DynamoDB::Table");
    expect(adminResources).not.toContain("AdminAddUserToGroup");
    expect(adminResources).not.toContain("occasionfun.co.uk");
    expect(adminResources).not.toContain("occasionfun-cloudformation-production");
    expect(adminResources).not.toContain("cognito-idp:");
    expect(adminResources).not.toContain("https://occasionfun.co.uk");
    expect(adminResources).not.toContain("https://www.occasionfun.co.uk");
    expect(adminResources).not.toContain("k20xd6a2pd");
  });

  it("protects the health route with the demo Lambda authoriser", () => {
    expect(adminResources).toContain("FunctionName: occasionfun-co-uk-demo-admin-authorizer");
    expect(adminResources).toContain("FunctionName: occasionfun-co-uk-demo-admin-api");
    expect(adminResources.match(/Runtime: nodejs22\.x/g)).toEqual(["Runtime: nodejs22.x"]);
    expect(adminResources).toMatch(
      /FunctionName: occasionfun-co-uk-demo-admin-authorizer[\s\S]*?Runtime: nodejs22\.x/,
    );
    expect(adminResources).toMatch(
      /FunctionName: occasionfun-co-uk-demo-admin-api[\s\S]*?Runtime: nodejs24\.x/,
    );
    expect(adminResources).toContain("arm64");
    expect(adminResources).toContain("payloadFormatVersion: \"2.0\"");
    expect(adminResources).toContain("authorizerPayloadFormatVersion: \"2.0\"");
    expect(adminResources).toContain("enableSimpleResponses: true");
    expect(adminResources).toContain("authorizerResultTtlInSeconds: 0");
    expect(adminResources).not.toContain("identitySource:");
    expect(adminResources).not.toMatch(/^\s+Headers:/m);
    expect(adminResources).not.toContain("$request.header");
    expect(adminResources).toContain("ThrottlingBurstLimit: 20");
    expect(adminResources).toContain("ThrottlingRateLimit: 10");
    expect(adminResources).toContain("https://demo.d2oib89bmco9su.amplifyapp.com");
    expect(adminResources).toContain("https://d2oib89bmco9su.amplifyapp.com");
    expect(adminResources).toContain("logs:CreateLogStream");
    expect(adminResources).toContain("logs:PutLogEvents");
    expect(adminResources).not.toContain("logs:CreateLogGroup");
    expect(template).toContain("AdminApiBaseUrl:");
    expect(adminResources).not.toContain("Authorizer: NONE");
  });
});
