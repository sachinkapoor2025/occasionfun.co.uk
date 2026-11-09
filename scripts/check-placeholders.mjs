import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const companyPath = resolve("src/config/company.ts");
const source = readFileSync(companyPath, "utf8");
const matches = [...source.matchAll(/^\s*([A-Za-z0-9_]+):\s*"(\[INSERT [^\"]+\])"/gm)];

const fail = process.env.FAIL_ON_PLACEHOLDERS === "true";

if (matches.length === 0) {
  console.log("No unresolved [INSERT ...] placeholders found in company config.");
  process.exit(0);
}

console.log("Unresolved company placeholders:");
for (const match of matches) {
  console.log(` - ${match[1]}: ${match[2]}`);
}

if (fail) {
  console.error(
    "\nFAIL_ON_PLACEHOLDERS=true — replace placeholders before production launch.",
  );
  process.exit(1);
}

console.warn(
  "\nWarning only. Set FAIL_ON_PLACEHOLDERS=true to block production builds.",
);
process.exit(0);
