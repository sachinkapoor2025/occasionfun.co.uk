import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

function conditionalNames(): Array<[string, string]> {
  return [...template.matchAll(/: !If\r?\n\s*- IsProduction\r?\n\s*- (.+)\r?\n\s*- (.+)/g)].map(
    (match) => [match[1], match[2]],
  );
}

describe("contact API environments", () => {
  it("defaults Environment to demo and allows only demo or prod", () => {
    const parameter = parameterBlock("Environment");
    expect(parameter).toMatch(/Default:\s*demo\b/);
    expect(parameter).toContain("- demo");
    expect(parameter).toContain("- prod");
    expect(template).toContain('IsProduction: !Equals [!Ref Environment, "prod"]');
  });

  it("keeps the existing demo physical names on the non-production branch", () => {
    expect(conditionalNames()).toEqual([
      [prodNames.table, demoNames.table],
      [prodNames.contactLogGroup, demoNames.contactLogGroup],
      [prodNames.retryLogGroup, demoNames.retryLogGroup],
      [prodNames.contactFunction, demoNames.contactFunction],
      [prodNames.retryFunction, demoNames.retryFunction],
    ]);
  });

  it("points both functions at the table created by the same stack", () => {
    expect(template.match(/LEADS_TABLE_NAME: !Ref LeadsTable/g)).toHaveLength(2);
    expect(template.match(/!GetAtt LeadsTable\.Arn/g)).toHaveLength(2);
    expect(template).toContain("${LeadsTable.Arn}/index/notification-due");
    expect(template).not.toMatch(/arn:aws:dynamodb:/);
    expect(template).not.toContain(`TableName: ${demoNames.table}`);
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

    const [prod, demo] = conditionalNames().reduce<[Set<string>, Set<string>]>(
      (sets, [prodName, demoName]) => {
        sets[0].add(prodName);
        sets[1].add(demoName);
        return sets;
      },
      [new Set<string>(), new Set<string>()],
    );
    expect([...demo].filter((name) => prod.has(name))).toEqual([]);
    expect(template.match(/SMTP_FROM: enquiries@occasionfun.co.uk/g)).toHaveLength(2);
    expect(
      template.match(
        /SMTP_TO: dgv@mydgv.com,priya.yadav@mydgv.com,nitin.bhatt@mydgv.com,prashant@occasionfun.co.uk/g,
      ),
    ).toHaveLength(2);
  });

  it("requires a separate explicit origin list for each deployment", () => {
    const origins = parameterBlock("AllowedOrigins");
    expect(origins).not.toMatch(/Default:/);
    expect(origins).toContain('AllowedPattern: "^https://[A-Za-z0-9.-]+$"');
    expect(origins).not.toContain("https://occasionfun.co.uk");
    expect(origins).not.toContain("amplifyapp.com");
    expect(template).not.toContain("*");
    expect(template).toContain("AllowOrigins: !Ref AllowedOrigins");
  });

  it("creates the API Gateway and retry schedule inside the stack", () => {
    expect(template).not.toContain("0e6zpkvbkj");
    expect(template.match(/Type: AWS::Serverless::HttpApi/g)).toHaveLength(1);
    expect(template).toContain("ApiId: !Ref ContactHttpApi");
    expect(template.match(/Type: Schedule/g)).toHaveLength(1);
    expect(template).toContain("Schedule: rate(5 minutes)");
    expect(template).not.toMatch(/Name:\s*occasionfun-co-uk/);
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
});
