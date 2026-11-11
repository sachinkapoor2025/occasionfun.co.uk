import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { AWS_REGION, DEMO } from "./deployment-targets.mjs";

/**
 * GitHub Actions is the publisher for the demo branch.
 * disable-auto-build waits until no other commit is running, sets
 * enableAutoBuild to false, and reads the branch back.
 * release then starts or adopts one RELEASE for the full GitHub SHA.
 * This file calls AWS only when the demo deployment workflow invokes it.
 * A job Amplify accepted before the setting was visible can still finish
 * later. If that job is visible and wins, the workflow fails.
 */

export const COMMIT_SHA = /^[0-9a-f]{40}$/;

export const NON_TERMINAL_STATUSES = new Set([
  "CREATED",
  "PENDING",
  "PROVISIONING",
  "RUNNING",
  "CANCELLING",
]);

const KNOWN_STATUSES = new Set([
  ...NON_TERMINAL_STATUSES,
  "SUCCEED",
  "FAILED",
  "CANCELLED",
]);

const QUIET_SUCCESSES = 2;
const POLL_MS = 15_000;
const MAX_POLLS = 80;

export function isExactCommit(reported, expected) {
  return (
    typeof expected === "string" &&
    COMMIT_SHA.test(expected) &&
    typeof reported === "string" &&
    reported === expected
  );
}

export function normalizeJob(summary = {}) {
  return {
    jobId: summary.jobId ?? "",
    commitId: summary.commitId ?? "",
    status: summary.status ?? "",
    startTime: summary.startTime ?? "",
    endTime: summary.endTime ?? "",
  };
}

export function inspectJobs(jobs) {
  if (!Array.isArray(jobs)) {
    return { ok: false, reason: "Amplify job list is unavailable." };
  }
  for (const job of jobs) {
    if (!job?.jobId || !KNOWN_STATUSES.has(job.status)) {
      return { ok: false, reason: "Amplify job status is unavailable." };
    }
    if (!isExactCommit(job.commitId, job.commitId)) {
      return { ok: false, reason: "Amplify job commit information is unavailable." };
    }
  }
  return { ok: true };
}

export function readJobPage(page, previousToken = "") {
  if (!page || !Array.isArray(page.jobSummaries)) {
    return { ok: false, reason: "Amplify job list is unavailable." };
  }
  const jobs = page.jobSummaries.map((summary) => normalizeJob(summary));
  const inspected = inspectJobs(jobs);
  if (!inspected.ok) return inspected;
  const nextToken = page.nextToken || page.NextToken || "";
  if (typeof nextToken !== "string") {
    return { ok: false, reason: "Amplify job list is unavailable." };
  }
  if (nextToken && nextToken === previousToken) {
    return { ok: false, reason: "Amplify job list pagination did not advance." };
  }
  return { ok: true, jobs, nextToken };
}

export function selectExistingJob(jobs, sha) {
  const inspected = inspectJobs(jobs);
  if (!inspected.ok) return { action: "fail", reason: inspected.reason };
  if (!isExactCommit(sha, sha)) {
    return { action: "fail", reason: "GitHub SHA must be a full 40-character commit id." };
  }
  const usable = jobs.filter(
    (job) => job.commitId === sha && job.status !== "FAILED" && job.status !== "CANCELLED",
  );
  if (usable.length === 0) return { action: "start", reason: "no-job-for-commit" };
  const running = usable.filter((job) => NON_TERMINAL_STATUSES.has(job.status));
  const succeeded = usable.filter((job) => job.status === "SUCCEED");
  const pool = running.length > 0 ? running : succeeded;
  if (pool.length === 0) {
    return { action: "wait", jobId: usable[0].jobId, reason: "existing-build" };
  }
  const chosen = [...pool].sort((left, right) =>
    String(right.startTime || right.endTime).localeCompare(String(left.startTime || left.endTime)),
  )[0];
  if (NON_TERMINAL_STATUSES.has(chosen.status)) {
    return { action: "wait", jobId: chosen.jobId, reason: "existing-build" };
  }
  return { action: "confirm", jobId: chosen.jobId, reason: "existing-success" };
}

export function deploymentIsFinal(jobs, sha) {
  const inspected = inspectJobs(jobs);
  if (!inspected.ok) return inspected;
  if (!isExactCommit(sha, sha)) {
    return { ok: false, reason: "GitHub SHA must be a full 40-character commit id." };
  }
  if (jobs.some((job) => job.status === "SUCCEED" && !job.endTime)) {
    return { ok: false, reason: "Amplify job completion time is unavailable." };
  }
  const otherActive = jobs.filter(
    (job) => job.commitId !== sha && NON_TERMINAL_STATUSES.has(job.status),
  );
  if (otherActive.length > 0) {
    return { ok: false, reason: "another-commit-is-still-running" };
  }
  const ownActive = jobs.filter(
    (job) => job.commitId === sha && NON_TERMINAL_STATUSES.has(job.status),
  );
  if (ownActive.length > 0) return { ok: false, reason: "commit-is-still-running" };
  const succeeded = jobs
    .filter((job) => job.status === "SUCCEED")
    .sort((left, right) => String(right.endTime).localeCompare(String(left.endTime)));
  const latest = succeeded[0];
  if (!latest || latest.commitId !== sha) {
    return {
      ok: false,
      reason: "latest-successful-job-is-a-different-commit",
      latestCommit: latest?.commitId ?? "",
    };
  }
  return { ok: true, jobId: latest.jobId };
}

export function planAutoBuildChange(branch, jobs, sha) {
  const inspected = inspectJobs(jobs);
  if (!inspected.ok) return { action: "fail", reason: inspected.reason };
  if (!isExactCommit(sha, sha)) {
    return { action: "fail", reason: "GitHub SHA must be a full 40-character commit id." };
  }
  if (!branch || branch.branchName !== DEMO.amplifyBranch) {
    return { action: "fail", reason: "Refusing to change an Amplify branch other than demo." };
  }
  if (typeof branch.enableAutoBuild !== "boolean") {
    return { action: "fail", reason: "Amplify enableAutoBuild is unavailable." };
  }
  const older = jobs.filter(
    (job) => job.commitId !== sha && NON_TERMINAL_STATUSES.has(job.status),
  );
  if (older.length > 0) {
    return { action: "wait", reason: "older-build-still-running", jobId: older[0].jobId };
  }
  if (branch.enableAutoBuild === false) return { action: "already-disabled" };
  return { action: "disable" };
}

export function verifyAutoBuildDisabled(branch) {
  if (!branch || branch.branchName !== DEMO.amplifyBranch || typeof branch.enableAutoBuild !== "boolean") {
    return { ok: false, reason: "Amplify branch configuration is unavailable." };
  }
  if (branch.enableAutoBuild !== false) {
    return { ok: false, reason: "Amplify auto-build is still enabled for the demo branch." };
  }
  return { ok: true };
}

export function planRelease(jobs, sha) {
  const inspected = inspectJobs(jobs);
  if (!inspected.ok) return { action: "fail", reason: inspected.reason };
  if (!isExactCommit(sha, sha)) {
    return { action: "fail", reason: "GitHub SHA must be a full 40-character commit id." };
  }
  const older = jobs.filter(
    (job) => job.commitId !== sha && NON_TERMINAL_STATUSES.has(job.status),
  );
  if (older.length > 0) {
    return { action: "wait", reason: "older-build-still-running", jobId: older[0].jobId };
  }
  const ownActive = jobs.filter(
    (job) => job.commitId === sha && NON_TERMINAL_STATUSES.has(job.status),
  );
  if (ownActive.length > 0) {
    return { action: "wait", reason: "existing-build", jobId: ownActive[0].jobId };
  }
  const ownSuccess = jobs.some((job) => job.commitId === sha && job.status === "SUCCEED");
  if (ownSuccess) {
    const final = deploymentIsFinal(jobs, sha);
    if (!final.ok) {
      return {
        action: "fail",
        reason:
          final.reason === "latest-successful-job-is-a-different-commit"
            ? "another-commit-became-the-latest-deployment"
            : final.reason,
      };
    }
    return { action: "confirm", jobId: final.jobId };
  }
  return { action: "start", reason: "no-job-for-commit" };
}

export function assertTrackedJob(job, sha) {
  if (!job?.jobId || !KNOWN_STATUSES.has(job.status)) {
    return { ok: false, reason: "Amplify job status is unavailable." };
  }
  if (!isExactCommit(job.commitId, sha)) {
    return { ok: false, reason: "Amplify job commit does not match this commit." };
  }
  return { ok: true };
}

function redact(text) {
  return String(text)
    .replace(/AKIA[0-9A-Z]{16}/g, "[redacted-key]")
    .replace(/aws_secret_access_key\s*[:=]\s*\S+/gi, "aws_secret_access_key=[redacted]");
}

function awsJson(args) {
  let output;
  try {
    output = execFileSync("aws", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    const stderr = redact(error?.stderr?.toString?.() ?? error?.message ?? "unknown error");
    throw new Error(`Amplify API call failed.\n${stderr.split("\n").slice(0, 8).join("\n")}`);
  }
  try {
    return JSON.parse(output);
  } catch {
    throw new Error("Amplify API returned invalid JSON.");
  }
}

function requireDemoContext() {
  const sha = process.env.GITHUB_SHA ?? "";
  if (!isExactCommit(sha, sha)) {
    throw new Error("GITHUB_SHA must be the full 40-character commit id.");
  }
  if (process.env.AMPLIFY_APP_ID !== DEMO.amplifyAppId) {
    throw new Error("Amplify app id must stay the existing demo app.");
  }
  if (process.env.AMPLIFY_BRANCH !== DEMO.amplifyBranch) {
    throw new Error("Amplify branch must stay demo.");
  }
  const region = process.env.AWS_REGION || AWS_REGION;
  if (region !== AWS_REGION) throw new Error("Amplify region must stay eu-west-2.");
  return { sha, appId: DEMO.amplifyAppId, branch: DEMO.amplifyBranch, region };
}

function listJobs(appId, branch, region) {
  const jobs = [];
  let token = "";
  do {
    const args = [
      "amplify",
      "list-jobs",
      "--app-id",
      appId,
      "--branch-name",
      branch,
      "--region",
      region,
      "--max-items",
      "100",
      "--output",
      "json",
    ];
    if (token) args.push("--starting-token", token);
    const page = readJobPage(awsJson(args), token);
    if (!page.ok) throw new Error(page.reason);
    jobs.push(...page.jobs);
    token = page.nextToken;
  } while (token);
  return jobs;
}

function getBranch(appId, branch, region) {
  const page = awsJson([
    "amplify",
    "get-branch",
    "--app-id",
    appId,
    "--branch-name",
    branch,
    "--region",
    region,
    "--output",
    "json",
  ]);
  if (!page.branch) throw new Error("Amplify branch configuration is unavailable.");
  return {
    branchName: page.branch.branchName ?? "",
    enableAutoBuild: page.branch.enableAutoBuild,
  };
}

function disableAutoBuild(appId, branch, region) {
  const page = awsJson([
    "amplify",
    "update-branch",
    "--app-id",
    appId,
    "--branch-name",
    branch,
    "--no-enable-auto-build",
    "--region",
    region,
    "--output",
    "json",
  ]);
  if (!page.branch) throw new Error("Amplify branch configuration is unavailable.");
  return {
    branchName: page.branch.branchName ?? "",
    enableAutoBuild: page.branch.enableAutoBuild,
  };
}

function getJob(appId, branch, region, jobId) {
  const page = awsJson([
    "amplify",
    "get-job",
    "--app-id",
    appId,
    "--branch-name",
    branch,
    "--job-id",
    jobId,
    "--region",
    region,
    "--output",
    "json",
  ]);
  if (!page.job?.summary) throw new Error("Amplify job status is unavailable.");
  return normalizeJob(page.job.summary);
}

function startRelease(appId, branch, region, sha) {
  const page = awsJson([
    "amplify",
    "start-job",
    "--app-id",
    appId,
    "--branch-name",
    branch,
    "--job-type",
    "RELEASE",
    "--commit-id",
    sha,
    "--job-reason",
    "GitHub Actions demo deployment",
    "--region",
    region,
    "--output",
    "json",
  ]);
  const summary = normalizeJob(page.jobSummary ?? {});
  const visible = assertTrackedJob(summary, sha);
  if (!visible.ok) throw new Error(visible.reason);
  console.log(`Started Amplify job ${summary.jobId} for this commit.`);
  return summary.jobId;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function disableAutoBuildPhase() {
  const { sha, appId, branch, region } = requireDemoContext();
  for (let poll = 0; poll < MAX_POLLS; poll += 1) {
    const jobs = listJobs(appId, branch, region);
    const current = getBranch(appId, branch, region);
    const plan = planAutoBuildChange(current, jobs, sha);
    if (plan.action === "fail") fail(plan.reason);
    if (plan.action === "wait") {
      console.log(`Waiting for Amplify job ${plan.jobId} before disabling auto-build.`);
      await sleep(POLL_MS);
      continue;
    }
    if (plan.action === "disable") {
      const updated = disableAutoBuild(appId, branch, region);
      if (updated.branchName !== branch || updated.enableAutoBuild !== false) {
        fail("Amplify did not confirm that demo auto-build is disabled.");
      }
    }
    const fresh = getBranch(appId, branch, region);
    const verified = verifyAutoBuildDisabled(fresh);
    if (!verified.ok) fail(verified.reason);
    const after = planAutoBuildChange(fresh, listJobs(appId, branch, region), sha);
    if (after.action === "wait") {
      fail(
        "An older Amplify build is still running. Demo auto-build is disabled and no release was started.",
      );
    }
    if (after.action !== "already-disabled") {
      fail(after.reason || "Amplify auto-build did not stay disabled.");
    }
    console.log("Amplify auto-build is disabled on the demo branch.");
    return;
  }
  fail("Timed out before demo auto-build could be disabled. No release was started.");
}

async function releasePhase() {
  const { sha, appId, branch, region } = requireDemoContext();
  const initial = verifyAutoBuildDisabled(getBranch(appId, branch, region));
  if (!initial.ok) fail(`${initial.reason} Refusing to start a release.`);
  let trackedId = "";
  let started = false;
  let quiet = 0;

  for (let poll = 0; poll < MAX_POLLS; poll += 1) {
    const verified = verifyAutoBuildDisabled(getBranch(appId, branch, region));
    if (!verified.ok) fail(verified.reason);
    if (trackedId) {
      const tracked = getJob(appId, branch, region, trackedId);
      const visible = assertTrackedJob(tracked, sha);
      if (!visible.ok) fail(visible.reason);
      console.log(`Amplify job ${trackedId} status=${tracked.status}`);
      if (NON_TERMINAL_STATUSES.has(tracked.status)) {
        quiet = 0;
        await sleep(POLL_MS);
        continue;
      }
      if (tracked.status !== "SUCCEED" || !tracked.endTime) {
        fail(
          tracked.status === "SUCCEED"
            ? "Amplify job completion time is unavailable."
            : `Amplify job ${trackedId} ended with ${tracked.status}.`,
        );
      }
      trackedId = "";
    }

    const plan = planRelease(listJobs(appId, branch, region), sha);
    if (plan.action === "fail") {
      fail(
        plan.reason === "another-commit-became-the-latest-deployment"
          ? "Another commit is the latest Amplify deployment. This release was not accepted."
          : plan.reason,
      );
    }
    if (plan.action === "wait") {
      quiet = 0;
      if (plan.reason === "existing-build") trackedId = plan.jobId;
      console.log(`Waiting for Amplify job ${plan.jobId}.`);
      await sleep(POLL_MS);
      continue;
    }
    if (plan.action === "start") {
      if (started) fail("Refusing to start another Amplify release.");
      trackedId = startRelease(appId, branch, region, sha);
      started = true;
      quiet = 0;
      await sleep(POLL_MS);
      continue;
    }
    quiet += 1;
    console.log(`Finality check ${quiet}/${QUIET_SUCCESSES} passed for this commit.`);
    if (quiet >= QUIET_SUCCESSES) {
      console.log("This commit is the latest successful Amplify deployment.");
      return;
    }
    await sleep(POLL_MS);
  }
  fail("Timed out before this commit was the latest Amplify deployment.");
}

const invokedDirectly = process.argv[1]?.endsWith("amplify-demo-release.mjs");
if (invokedDirectly) {
  const command = process.argv[2];
  const run =
    command === "disable-auto-build"
      ? disableAutoBuildPhase
      : command === "release"
        ? releasePhase
        : null;
  if (!run) {
    console.error("Usage: node scripts/amplify-demo-release.mjs disable-auto-build|release");
    process.exit(1);
  }
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : "Amplify release failed.");
    process.exit(1);
  });
}
