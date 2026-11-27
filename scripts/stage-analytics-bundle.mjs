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
  measureDirectory = path.join(root, "infra/contact-api/analytics-measure-dist"),
  reportDirectory = path.join(root, "infra/contact-api/analytics-report-dist"),
  contactDirectory = path.join(root, "infra/contact-api/dist"),
  adminDirectory = path.join(root, "infra/contact-api/admin-dist"),
} = {}) {
  const target = path.resolve(targetDirectory);
  const reserved = [measureDirectory, reportDirectory, contactDirectory, adminDirectory].map((directory) =>
    path.resolve(directory),
  );
  for (const other of reserved) {
    if (target === other || target.startsWith(`${other}${path.sep}`) || other.startsWith(`${target}${path.sep}`)) {
      throw new Error("The analytics bundle directory must not overlap the measurement, contact, or admin bundle.");
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

/**
 * Copy the aggregate measurement bundle beside the contact template.
 * This directory is separate from analytics-dist, so the collect bundle is left in place.
 */
export function stageMeasureBundle({
  source = path.join(root, "infra/analytics/dist/measure.js"),
  targetDirectory = path.join(root, "infra/contact-api/analytics-measure-dist"),
  collectDirectory = path.join(root, "infra/contact-api/analytics-dist"),
  reportDirectory = path.join(root, "infra/contact-api/analytics-report-dist"),
  contactDirectory = path.join(root, "infra/contact-api/dist"),
  adminDirectory = path.join(root, "infra/contact-api/admin-dist"),
} = {}) {
  const target = path.resolve(targetDirectory);
  const reserved = [collectDirectory, reportDirectory, contactDirectory, adminDirectory].map((directory) =>
    path.resolve(directory),
  );
  for (const other of reserved) {
    if (target === other || target.startsWith(`${other}${path.sep}`) || other.startsWith(`${target}${path.sep}`)) {
      throw new Error("The measurement bundle directory must not overlap the collect, contact, or admin bundle.");
    }
  }
  if (!statSync(source, { throwIfNoEntry: false })?.isFile()) {
    throw new Error("The measurement bundle is missing. Build infra/analytics first.");
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const destination = path.join(target, "measure.js");
  copyFileSync(source, destination);
  const staged = readFileSync(destination);
  if (staged.length === 0) throw new Error("The staged measurement bundle is empty.");
  return destination;
}

/**
 * Copy the aggregate report bundle beside the contact template.
 * This directory is separate from the collect and measurement bundles.
 */
export function stageReportBundle({
  source = path.join(root, "infra/analytics/dist/report.js"),
  targetDirectory = path.join(root, "infra/contact-api/analytics-report-dist"),
  collectDirectory = path.join(root, "infra/contact-api/analytics-dist"),
  measureDirectory = path.join(root, "infra/contact-api/analytics-measure-dist"),
  contactDirectory = path.join(root, "infra/contact-api/dist"),
  adminDirectory = path.join(root, "infra/contact-api/admin-dist"),
} = {}) {
  const target = path.resolve(targetDirectory);
  const reserved = [collectDirectory, measureDirectory, contactDirectory, adminDirectory].map((directory) =>
    path.resolve(directory),
  );
  for (const other of reserved) {
    if (target === other || target.startsWith(`${other}${path.sep}`) || other.startsWith(`${target}${path.sep}`)) {
      throw new Error("The report bundle directory must not overlap the collect, measurement, contact, or admin bundle.");
    }
  }
  if (!statSync(source, { throwIfNoEntry: false })?.isFile()) {
    throw new Error("The report bundle is missing. Build infra/analytics first.");
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const destination = path.join(target, "report.js");
  copyFileSync(source, destination);
  const staged = readFileSync(destination);
  if (staged.length === 0) throw new Error("The staged report bundle is empty.");
  return destination;
}

if (process.argv[1]?.endsWith("stage-analytics-bundle.mjs")) {
  stageAnalyticsBundle();
  stageMeasureBundle();
  stageReportBundle();
}
