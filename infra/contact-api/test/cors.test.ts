import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const template = readFileSync(path.join(packageRoot, "template.yaml"), "utf8");
const handlerSource = readFileSync(path.join(packageRoot, "src/handler.ts"), "utf8");
const enquirySource = readFileSync(
  path.join(packageRoot, "src/process-enquiry.ts"),
  "utf8",
);

function allowedOriginsParameter(): string {
  const match = template.match(/  AllowedOrigins:[\s\S]*?\nConditions:/);
  if (!match) throw new Error("AllowedOrigins parameter was not found");
  return match[0];
}

function corsBlock(): string {
  const match = template.match(/CorsConfiguration:[\s\S]*?DefaultRouteSettings:/);
  if (!match) throw new Error("CorsConfiguration block was not found");
  return match[0];
}

describe("contact API CORS", () => {
  it("takes exact https origins from the deployment instead of a shared default", () => {
    const parameter = allowedOriginsParameter();
    expect(parameter).not.toMatch(/Default:/);
    expect(parameter).toContain('AllowedPattern: "^https://[A-Za-z0-9.-]+$"');
    expect(parameter).not.toContain("https://occasionfun.co.uk");
    expect(parameter).not.toContain("amplifyapp.com");
    expect(template).not.toContain("*");
  });

  it("lets API Gateway answer preflight for POST, OPTIONS, and content-type", () => {
    const cors = corsBlock();
    expect(cors).toContain("AllowOrigins: !Ref AllowedOrigins");
    expect(cors).toContain("- content-type");
    expect(cors).toContain("- POST");
    expect(cors).toContain("- OPTIONS");
    expect(template).toContain("Method: POST");
  });

  it("does not add a second CORS header in the Lambda response", () => {
    expect(handlerSource).not.toMatch(/access-control-allow-origin/i);
    expect(enquirySource).not.toMatch(/access-control-allow-origin/i);
  });
});
