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
 *     orchestrated cycles). On CONCUR it writes the full review artifact
 *     .research-review/<reviewSha256>.json, to be committed with the
 *     records, and prints a short summary plus the compact PR receipt.
 *     Never commits, pushes or opens a pull request.
 *   check --event-path <github-event.json>
 *   check --base <sha> --head <sha> --body-file <file>
 *     Verifies a pull request's receipt and the review artifact it
 *     references (read from the head commit) against the review input
 *     rebuilt from Git. Never invokes a reviewer. With --event-path the
 *     base is the merge base of the event's base and head; the PR body is read from the event file, never from
 *     shell arguments.
 *   summary (--event-path <github-event.json> | --base <sha> --head <sha> --body-file <file>) --output <file>
 *     Runs exactly the check verification and writes only the short PT-PT
 *     review summary (summary.ts) to <file>, for the trusted pull-request
 *     comment publisher. Never invokes a reviewer and never prints or writes
 *     the review itself. Prints one line: `SUMMARY: <status>`.
 *
 * Exit code 0 = PASS / receipt produced; 1 = any failure (fail closed).
 * summary exit codes: 0 = VERIFIED, 3 = NOT_APPLICABLE, 4 = INVALID (each
 * with its summary written); 1 = usage or output failure (nothing written).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { LocalCommandAiInvoker, loadLocalCommandAiInvokerConfigFromEnv } from "../ai/invoker.ts";
import { assertWorkbenchBoundary } from "../core/workbench-boundary.ts";
import { laneBContextFreeBlock, prepareLaneBReview, verifyLaneBPullRequest, type LaneBVerification } from "./receipt.ts";
import {
  describeSourceVerificationNotSeparate,
  pullRequestBase,
  resolveCommit,
  resolveLaneBReviewUnit,
  reviewArtifactsAtCommit,
  type LaneBReviewUnit,
} from "./review-unit.ts";
import { laneBReviewSummary, renderInvalidSummary, type ReviewSummary, type ReviewSummaryStatus } from "./summary.ts";

const USAGE = [
  "Usage:",
  "  node tools/research/lane-b/cli.ts prepare --base <ref> [--workbench <dir>]",
  "  node tools/research/lane-b/cli.ts check --event-path <github-event.json>",
  "  node tools/research/lane-b/cli.ts check --base <sha> --head <sha> --body-file <file>",
  "  node tools/research/lane-b/cli.ts summary --event-path <github-event.json> --output <file>",
  "  node tools/research/lane-b/cli.ts summary --base <sha> --head <sha> --body-file <file> --output <file>",
].join("\n");

/** Stable `summary` exit codes, so the publisher never parses free-form output. */
export const SUMMARY_EXIT_CODES: Readonly<Record<ReviewSummaryStatus, number>> = { VERIFIED: 0, NOT_APPLICABLE: 3, INVALID: 4 };

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

  const outcome = prepareLaneBReview(unit, new LocalCommandAiInvoker(aiConfig), workbenchDir, repoRoot);
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
  console.log("CONCUR");
  console.log(`Base: ${unit.baseGitSha}`);
  console.log(`Records: ${unit.changedRecords.map((record) => record.id).join(", ")}`);
  console.log(`Review: ${outcome.receipt.reviewSha256}`);
  console.log(`Artifact: ${outcome.artifactPath}\n`);
  console.log(`Commit ${outcome.artifactPath} with the records and paste the block below into the PR's "## Research semantic review" section (also written to ${join(workbenchDir, "pr-receipt.md")}).`);
  console.log("Any later change to these records requires a new review and receipt. CONCUR is not an approval.\n");
  console.log(outcome.receiptBlock);
}

type PullRequestInput = { baseGitSha: string; headSha: string; body: string | null };

/**
 * The pull request to verify, from a GitHub event file or explicit
 * arguments. With --event-path the base is the merge base of the event's
 * base and head. Returns a failure code instead when the input is unusable.
 */
function pullRequestInput(repoRoot: string, flag: (name: string) => string | undefined): PullRequestInput | { failedCheck: string; message: string } {
  const eventPath = flag("--event-path");
  if (eventPath) {
    const event = JSON.parse(readFileSync(eventPath, "utf8")) as { pull_request?: { base?: { sha?: unknown }; head?: { sha?: unknown }; body?: unknown } };
    const pr = event.pull_request;
    if (!pr || typeof pr.base?.sha !== "string" || typeof pr.head?.sha !== "string") {
      return { failedCheck: "NOT_A_PULL_REQUEST_EVENT", message: "the event file has no pull_request base/head SHA" };
    }
    return { baseGitSha: pullRequestBase(repoRoot, pr.base.sha, pr.head.sha), headSha: pr.head.sha, body: typeof pr.body === "string" ? pr.body : null };
  }
  const base = flag("--base");
  const head = flag("--head");
  const bodyFile = flag("--body-file");
  if (!base || !head || !bodyFile) return { failedCheck: "USAGE", message: USAGE };
  return { baseGitSha: base, headSha: head, body: readFileSync(bodyFile, "utf8") };
}

/** The one verification `check` and `summary` share: review unit rebuilt from Git, artifacts read from the head commit. */
function verifyPullRequest(repoRoot: string, { baseGitSha, headSha, body }: PullRequestInput): { unit: LaneBReviewUnit; verification: LaneBVerification } {
  const unit = resolveLaneBReviewUnit({ repoRoot, baseGitSha, head: { kind: "commit", sha: headSha } });
  return { unit, verification: verifyLaneBPullRequest(unit, body, reviewArtifactsAtCommit(repoRoot, baseGitSha, headSha)) };
}

function check(repoRoot: string, flag: (name: string) => string | undefined): void {
  const input = pullRequestInput(repoRoot, flag);
  if ("failedCheck" in input) return failed(input.failedCheck, input.message);
  const { verification } = verifyPullRequest(repoRoot, input);
  if (verification.ok) {
    console.log(`PASS: ${verification.summary}`);
    return;
  }
  failed(verification.failedCheck, verification.errors.join("\n  "));
}

/**
 * Writes only the PT-PT summary of the check's own verification. Any
 * reconstruction error becomes the INVALID summary with a stable code; its
 * detail stays in the check's output, never in the summary.
 */
function summary(repoRoot: string, flag: (name: string) => string | undefined): void {
  const output = flag("--output");
  if (!output || (!flag("--event-path") && !(flag("--base") && flag("--head") && flag("--body-file")))) return failed("USAGE", USAGE);
  let result: ReviewSummary;
  try {
    const input = pullRequestInput(repoRoot, flag);
    if ("failedCheck" in input) {
      result = { status: "INVALID", markdown: renderInvalidSummary(input.failedCheck) };
    } else {
      const { unit, verification } = verifyPullRequest(repoRoot, input);
      result = laneBReviewSummary(unit, verification);
    }
  } catch {
    result = { status: "INVALID", markdown: renderInvalidSummary("LANE_B_RECONSTRUCTION_FAILED") };
  }
  writeFileSync(output, result.markdown, "utf8");
  console.log(`SUMMARY: ${result.status}`);
  process.exitCode = SUMMARY_EXIT_CODES[result.status];
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
    else if (command === "summary") summary(repoRoot, flag);
    else failed("USAGE", USAGE);
  } catch (error) {
    failed("LANE_B_RECONSTRUCTION_FAILED", (error as Error).message);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
