import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Copy the analytics ingestion bundle into the contact template directory.
 * The contact bundle and the admin bundle are not read or replaced.
 */
export function stageAnalyticsBundle({
  source = path.join(root, "infra/analytics/dist/handler.js"),
  targetDirectory = path.join(root, "infra/contact-api/analytics-dist"),
  contactDirectory = path.join(root, "infra/contact-api/dist"),
  adminDirectory = path.join(root, "infra/contact-api/admin-dist"),
} = {}) {
  const target = path.resolve(targetDirectory);
  const contact = path.resolve(contactDirectory);
  const admin = path.resolve(adminDirectory);
  for (const other of [contact, admin]) {
    if (target === other || target.startsWith(`${other}${path.sep}`) || other.startsWith(`${target}${path.sep}`)) {
      throw new Error("The analytics bundle directory must not overlap the contact or admin bundle.");
    }
  }
  if (!statSync(source, { throwIfNoEntry: false })?.isFile()) {
    throw new Error("The analytics bundle is missing. Build infra/analytics first.");
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const destination = path.join(target, "handler.js");
  copyFileSync(source, destination);
  const staged = readFileSync(destination);
  if (staged.length === 0) throw new Error("The staged analytics bundle is empty.");
  return destination;
}

if (process.argv[1]?.endsWith("stage-analytics-bundle.mjs")) {
  stageAnalyticsBundle();
}
