import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stageAdminBundle } from "../scripts/stage-admin-bundle.mjs";

describe("admin bundle staging", () => {
  it("copies the admin handler without replacing the contact bundle", () => {
    const root = mkdtempSync(path.join(tmpdir(), "occasionfun-admin-bundle-"));
    const sourceDirectory = path.join(root, "admin-dist");
    const targetDirectory = path.join(root, "contact", "admin-dist");
    const contactDirectory = path.join(root, "contact", "dist");
    mkdirSync(sourceDirectory, { recursive: true });
    mkdirSync(contactDirectory, { recursive: true });
    writeFileSync(path.join(sourceDirectory, "handler.js"), "exports.authorizer = exports.api = function () {};\n");
    writeFileSync(path.join(contactDirectory, "handler.js"), "exports.handler = exports.retryHandler = function () {};\n");
    const contactBefore = readFileSync(path.join(contactDirectory, "handler.js"), "utf8");

    const destination = stageAdminBundle({
      source: path.join(sourceDirectory, "handler.js"),
      targetDirectory,
      contactDirectory,
    });

    expect(destination).toBe(path.join(targetDirectory, "handler.js"));
    expect(readFileSync(destination, "utf8")).toContain("exports.authorizer");
    expect(readFileSync(path.join(contactDirectory, "handler.js"), "utf8")).toBe(contactBefore);
    expect(() =>
      stageAdminBundle({
        source: path.join(sourceDirectory, "handler.js"),
        targetDirectory: contactDirectory,
        contactDirectory,
      }),
    ).toThrow(/must not overlap/);
  });
});
