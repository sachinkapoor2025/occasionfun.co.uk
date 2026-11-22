import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Copy the admin Lambda bundle into the contact template directory.
 * The contact bundle in infra/contact-api/dist is not read or replaced.
 */
export function stageAdminBundle({
  source = path.join(root, "infra/admin/dist/handler.js"),
  targetDirectory = path.join(root, "infra/contact-api/admin-dist"),
  contactDirectory = path.join(root, "infra/contact-api/dist"),
} = {}) {
  const target = path.resolve(targetDirectory);
  const contact = path.resolve(contactDirectory);
  if (target === contact || target.startsWith(`${contact}${path.sep}`) || contact.startsWith(`${target}${path.sep}`)) {
    throw new Error("The admin bundle directory must not overlap the contact dist directory.");
  }
  if (!statSync(source, { throwIfNoEntry: false })?.isFile()) {
    throw new Error("The admin bundle is missing. Build infra/admin first.");
  }
  const contactHandler = path.join(contact, "handler.js");
  const contactBefore = statSync(contactHandler, { throwIfNoEntry: false });
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const destination = path.join(target, "handler.js");
  copyFileSync(source, destination);
  const staged = readFileSync(destination);
  if (staged.length === 0) throw new Error("The staged admin bundle is empty.");
  const contactAfter = statSync(contactHandler, { throwIfNoEntry: false });
  if (Boolean(contactBefore) !== Boolean(contactAfter)) {
    throw new Error("Staging the admin bundle changed the contact dist directory.");
  }
  if (contactBefore && contactAfter && contactBefore.mtimeMs !== contactAfter.mtimeMs) {
    throw new Error("Staging the admin bundle changed the contact bundle.");
  }
  return destination;
}

const invokedDirectly = process.argv[1]?.endsWith("stage-admin-bundle.mjs");
if (invokedDirectly) {
  console.log(stageAdminBundle());
}
