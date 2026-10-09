#!/usr/bin/env node
/**
 * CLI for Lane B (direct pull-request) independent semantic review. All
 * review logic lives in review-unit.ts and receipt.ts; this file owns only
 * argument parsing, AI-runtime configuration, console output and exit codes.
 *
 * Usage:
 *   prepare --base <ref> [--workbench <dir>]
 *     Before any commit/push/PR of the change: reviews the working-tree
 *     canonical record changes against the merge base of <ref> and HEAD with
 *     a fresh INDEPENDENT_REVIEWER process (RESEARCH_AI_COMMAND, as for
 *     orchestrated cycles) and prints the PR receipt on CONCUR. Never
 *     commits, pushes or opens a pull request.
 *   check --event-path <github-event.json>
 *   check --base <sha> --head <sha> --body-file <file>
 *     Verifies a pull request's receipt against the review input rebuilt
 *     from Git. With --event-path the base is the merge base of the event's
 *     base and head; the PR body is read from the event file, never from
 *     shell arguments.
 *
 * Exit code 0 = PASS / receipt produced; 1 = any failure (fail closed).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { LocalCommandAiInvoker, loadLocalCommandAiInvokerConfigFromEnv } from "../orchestrate/ai-invoker.ts";
import { assertWorkbenchBoundary } from "../orchestrate/workbench-boundary.ts";
import { laneBContextFreeBlock, prepareLaneBReview, verifyLaneBPullRequest } from "./receipt.ts";
import { describeSourceVerificationNotSeparate, pullRequestBase, resolveCommit, resolveLaneBReviewUnit, type LaneBReviewUnit } from "./review-unit.ts";

const USAGE = [
  "Usage:",
  "  node tools/research/lane-b/cli.ts prepare --base <ref> [--workbench <dir>]",
  "  node tools/research/lane-b/cli.ts check --event-path <github-event.json>",
  "  node tools/research/lane-b/cli.ts check --base <sha> --head <sha> --body-file <file>",
].join("\n");

function failed(code: string, message: string): void {
  console.error(`FAILED [${code}]: ${message}`);
  process.exitCode = 1;
}

/** Default local workbench location for one review unit; always under the gitignored .research-workbench/. */
export function defaultLaneBWorkbenchDir(repoRoot: string, unit: Extract<LaneBReviewUnit, { status: "REVIEW_REQUIRED" }>): string {
  return join(repoRoot, ".research-workbench", "lane-b", `${unit.baseGitSha.slice(0, 12)}-${unit.reviewerInputFingerprint.slice(0, 12)}`);
}

function prepare(repoRoot: string, flag: (name: string) => string | undefined): void {
  const baseRef = flag("--base");
  if (!baseRef) return failed("USAGE", USAGE);
  const baseGitSha = pullRequestBase(repoRoot, resolveCommit(repoRoot, baseRef), resolveCommit(repoRoot, "HEAD"));
  const unit = resolveLaneBReviewUnit({ repoRoot, baseGitSha, head: { kind: "working-tree" } });
  if (unit.status === "NO_CANONICAL_CHANGE") {
    console.log(`NO_CANONICAL_CHANGE: no canonical PRB/EVD/SRC record changed against ${baseGitSha}. Use "N/A" in the PR's Research semantic review section.`);
    return;
  }
  if (unit.status === "UNSUPPORTED_DELETION") {
    return failed("UNSUPPORTED_CANONICAL_DELETION", `Lane B direct review does not support deleting or renaming canonical records: ${unit.paths.join(", ")}`);
  }
  if (unit.status === "SOURCE_VERIFICATION_NOT_SEPARATE") return failed("SOURCE_VERIFICATION_NOT_SEPARATE", describeSourceVerificationNotSeparate(unit));
  // Deterministic, so reported even before the reviewer runtime is configured.
  const blocked = laneBContextFreeBlock(unit);
  if (blocked) return failed(blocked.failedCheck, blocked.message);

  const aiConfig = loadLocalCommandAiInvokerConfigFromEnv();
  if (!aiConfig) {
    return failed(
      "AI_RUNTIME_NOT_CONFIGURED",
      "RESEARCH_AI_COMMAND is not set. Lane B requires the operator-configured local command used for the INDEPENDENT_REVIEWER role; a self-review never counts."
    );
  }
  const workbenchDir = resolve(flag("--workbench") ?? defaultLaneBWorkbenchDir(repoRoot, unit));
  assertWorkbenchBoundary(workbenchDir);

  const outcome = prepareLaneBReview(unit, new LocalCommandAiInvoker(aiConfig), workbenchDir);
  if (outcome.status === "REVIEW_FAILED") return failed(outcome.failedCheck, outcome.message);
  if (outcome.status === "NOT_CONCUR") {
    const review = outcome.independentReview;
    for (const finding of review.findings) {
      console.error(`${finding.findingId} ${finding.severity} ${finding.kind} ${finding.recordId} ${finding.field} [${finding.dimension}]: ${finding.reason}`);
      console.error(`  correction: ${finding.correctionDirection}`);
    }
    return failed(
      "INDEPENDENT_REVIEW_NOT_CONCUR",
      `independent review outcome is ${review.outcome}; correct the records and prepare again. Review written to ${join(workbenchDir, "independent-review.json")}`
    );
  }
  console.log(`CONCUR: base ${unit.baseGitSha}, records ${unit.changedRecords.map((record) => record.id).join(", ")}.`);
  console.log(`Paste the block below into the PR's "## Research semantic review" section (also written to ${join(workbenchDir, "pr-receipt.md")}).`);
  console.log("Any later change to these records requires a new review and receipt. CONCUR is not an approval.\n");
  console.log(outcome.receiptBlock);
}

function check(repoRoot: string, flag: (name: string) => string | undefined): void {
  let baseGitSha: string;
  let headSha: string;
  let body: string | null;
  const eventPath = flag("--event-path");
  if (eventPath) {
    const event = JSON.parse(readFileSync(eventPath, "utf8")) as { pull_request?: { base?: { sha?: unknown }; head?: { sha?: unknown }; body?: unknown } };
    const pr = event.pull_request;
    if (!pr || typeof pr.base?.sha !== "string" || typeof pr.head?.sha !== "string") {
      return failed("NOT_A_PULL_REQUEST_EVENT", "the event file has no pull_request base/head SHA");
    }
    headSha = pr.head.sha;
    baseGitSha = pullRequestBase(repoRoot, pr.base.sha, headSha);
    body = typeof pr.body === "string" ? pr.body : null;
  } else {
    const base = flag("--base");
    const head = flag("--head");
    const bodyFile = flag("--body-file");
    if (!base || !head || !bodyFile) return failed("USAGE", USAGE);
    baseGitSha = base;
    headSha = head;
    body = readFileSync(bodyFile, "utf8");
  }

  const unit = resolveLaneBReviewUnit({ repoRoot, baseGitSha, head: { kind: "commit", sha: headSha } });
  const verification = verifyLaneBPullRequest(unit, body);
  if (verification.ok) {
    console.log(`PASS: ${verification.summary}`);
    return;
  }
  failed(verification.failedCheck, verification.errors.join("\n  "));
}

function main(): void {
  const [command, ...args] = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const idx = args.indexOf(name);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  try {
    const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    if (command === "prepare") prepare(repoRoot, flag);
    else if (command === "check") check(repoRoot, flag);
    else failed("USAGE", USAGE);
  } catch (error) {
    failed("LANE_B_RECONSTRUCTION_FAILED", (error as Error).message);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
