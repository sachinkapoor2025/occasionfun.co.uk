/** Shared deployment targets. Workflows repeat these values; tests require them to match. */

export const AWS_ACCOUNT_ID = "796174527529";
export const AWS_REGION = "eu-west-2";

export const SMTP_SECRET_ARN =
  "arn:aws:secretsmanager:eu-west-2:796174527529:secret:occasionfun-co-uk/contact/smtp-32Px2G";

export const PROTECTED_LOGICAL_IDS = [
  "LeadsTable",
  "ContactFunction",
  "ContactRetryFunction",
  "ContactHttpApi",
  "ContactLogGroup",
  "ContactRetryLogGroup",
];

export const DEMO = {
  environment: "demo",
  stackName: "occasionfun-co-uk-contact",
  allowCreate: false,
  table: "occasionfun-co-uk-leads",
  contactFunction: "occasionfun-co-uk-contact",
  retryFunction: "occasionfun-co-uk-contact-retry",
  contactLogGroup: "/aws/lambda/occasionfun-co-uk-contact",
  retryLogGroup: "/aws/lambda/occasionfun-co-uk-contact-retry",
  apiId: "0e6zpkvbkj",
  endpoint: "https://0e6zpkvbkj.execute-api.eu-west-2.amazonaws.com/contact",
  siteUrl: "https://demo.d2oib89bmco9su.amplifyapp.com",
  amplifyAppId: "d2oib89bmco9su",
  amplifyBranch: "demo",
  origins: [
    "https://occasionfun.co.uk",
    "https://www.occasionfun.co.uk",
    "https://d2oib89bmco9su.amplifyapp.com",
    "https://demo.d2oib89bmco9su.amplifyapp.com",
  ],
};

export const PRODUCTION = {
  environment: "prod",
  stackName: "occasionfun-co-uk-prod-contact",
  allowCreate: true,
  table: "occasionfun-co-uk-prod-leads",
  contactFunction: "occasionfun-co-uk-prod-contact",
  retryFunction: "occasionfun-co-uk-prod-contact-retry",
  retryRuleName: "occasionfun-co-uk-prod-contact-retry",
  contactLogGroup: "/aws/lambda/occasionfun-co-uk-prod-contact",
  retryLogGroup: "/aws/lambda/occasionfun-co-uk-prod-contact-retry",
  siteUrl: "https://occasionfun.co.uk",
  origins: ["https://occasionfun.co.uk", "https://www.occasionfun.co.uk"],
};

export function originsValue(origins) {
  return origins.join(",");
}

export function targetFor(environment) {
  if (environment === "demo") return DEMO;
  if (environment === "prod") return PRODUCTION;
  return null;
}
