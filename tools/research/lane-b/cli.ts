#!/usr/bin/env node
/**
 * CLI for Lane B (direct pull-request) independent semantic review. All
 * review logic lives in review-unit.ts and receipt.ts; this file owns only
 * argument parsing, AI-runtime configuration, console output and exit codes.
 *
 * Usage:
 *   ready --base <ref> [--new-lifecycle]
 *     The owner's declaration that the exact working-tree canonical record
 *     changes against the merge base of <ref> and HEAD are ready for semantic
 *     review. Binds to the fingerprint of that exact reviewer input in the
 *     shared review lifecycle (review/review-lifecycle.ts) and reports which
 *     semantic attempt it opens. Never invokes a reviewer. --new-lifecycle
 *     ends a lifecycle that escalated to the owner or whose correction needs
 *     a different base or record set.
 *   prepare --base <ref> [--workbench <dir>]
 *     Before any commit/push/PR of the change: runs the declared semantic
 *     attempt with a fresh INDEPENDENT_REVIEWER process (RESEARCH_AI_COMMAND,
 *     as for orchestrated cycles), refusing before invocation when the
 *     content was not declared ready, changed since, or has no attempt left.
 *     On CONCUR it writes the full review artifact
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
import { checkSemanticAttempt, declareOwnerReady, reviewLifecycleDirFor, reviewSubject } from "../review/review-lifecycle.ts";
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
  "  node tools/research/lane-b/cli.ts ready --base <ref> [--new-lifecycle]",
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

type ReviewRequiredUnit = Extract<LaneBReviewUnit, { status: "REVIEW_REQUIRED" }>;

/** The working-tree review unit `ready` and `prepare` share, or null after reporting why there is none. */
function workingTreeUnit(repoRoot: string, flag: (name: string) => string | undefined): ReviewRequiredUnit | null {
  const baseRef = flag("--base");
  if (!baseRef) {
    failed("USAGE", USAGE);
    return null;
  }
  const baseGitSha = pullRequestBase(repoRoot, resolveCommit(repoRoot, baseRef), resolveCommit(repoRoot, "HEAD"));
  const unit = resolveLaneBReviewUnit({ repoRoot, baseGitSha, head: { kind: "working-tree" } });
  if (unit.status === "NO_CANONICAL_CHANGE") {
    console.log(`NO_CANONICAL_CHANGE: no canonical PRB/EVD/SRC record changed against ${baseGitSha}. Use "N/A" in the PR's Research semantic review section.`);
    return null;
  }
  if (unit.status === "UNSUPPORTED_DELETION") {
    failed("UNSUPPORTED_CANONICAL_DELETION", `Lane B direct review does not support deleting or renaming canonical records: ${unit.paths.join(", ")}`);
    return null;
  }
  if (unit.status === "SOURCE_VERIFICATION_NOT_SEPARATE") {
    failed("SOURCE_VERIFICATION_NOT_SEPARATE", describeSourceVerificationNotSeparate(unit));
    return null;
  }
  // Deterministic, so reported even before the reviewer runtime is configured.
  const blocked = laneBContextFreeBlock(unit);
  if (blocked) {
    failed(blocked.failedCheck, blocked.message);
    return null;
  }
  return unit;
}

function ready(repoRoot: string, flag: (name: string) => string | undefined, args: readonly string[]): void {
  const unit = workingTreeUnit(repoRoot, flag);
  if (!unit) return;
  const lifecycle = reviewLifecycleDirFor(repoRoot);
  assertWorkbenchBoundary(lifecycle);
  const declared = declareOwnerReady(lifecycle, reviewSubject(unit.reviewerInput), { newLifecycle: args.includes("--new-lifecycle") });
  if (!declared.ok) return failed(declared.failedCheck, declared.message);
  console.log(`READY_DECLARED: semantic attempt ${declared.semanticAttempt} of 2`);
  console.log(`Base: ${unit.baseGitSha}`);
  console.log(`Records: ${unit.changedRecords.map((record) => record.id).join(", ")}`);
  console.log(`Reviewer input: ${unit.reviewerInputFingerprint}`);
  console.log("Run prepare with the same --base. Any change to these records before then makes this declaration stale.");
}

function prepare(repoRoot: string, flag: (name: string) => string | undefined): void {
  const unit = workingTreeUnit(repoRoot, flag);
  if (!unit) return;
  // The repository's review-lifecycle store, shared with Lane A. Refused
  // before the runtime is even needed: no declaration, stale content or no
  // attempt left.
  const lifecycle = reviewLifecycleDirFor(repoRoot);
  const permitted = checkSemanticAttempt(lifecycle, reviewSubject(unit.reviewerInput));
  if (!permitted.ok) return failed(permitted.failedCheck, permitted.message);

  const aiConfig = loadLocalCommandAiInvokerConfigFromEnv();
  if (!aiConfig) {
    return failed(
      "AI_RUNTIME_NOT_CONFIGURED",
      "RESEARCH_AI_COMMAND is not set. Lane B requires the operator-configured local command used for the INDEPENDENT_REVIEWER role; a self-review never counts."
    );
  }
  const workbenchDir = resolve(flag("--workbench") ?? defaultLaneBWorkbenchDir(repoRoot, unit));
  assertWorkbenchBoundary(workbenchDir);
  assertWorkbenchBoundary(lifecycle);

  const outcome = prepareLaneBReview(unit, new LocalCommandAiInvoker(aiConfig), workbenchDir, repoRoot, lifecycle);
  if (outcome.status === "REVIEW_REJECTED") return failed(outcome.failedCheck, outcome.message);
  if (outcome.status === "REVIEW_FAILED") {
    if (!outcome.classification) return failed(outcome.failedCheck, outcome.message);
    return failed(
      outcome.failedCheck,
      `${outcome.classification}: no valid review was produced (${outcome.message}). No semantic attempt was consumed and the declaration stands; investigate the reviewer runtime before running prepare again.`
    );
  }
  if (outcome.status === "NOT_CONCUR") {
    const review = outcome.independentReview;
    for (const finding of review.findings) {
      console.error(`${finding.findingId} ${finding.severity} ${finding.kind} ${finding.recordId} ${finding.field} [${finding.dimension}]: ${finding.reason}`);
      console.error(`  correction: ${finding.correctionDirection}`);
    }
    const reviewPath = join(workbenchDir, "independent-review.json");
    if (outcome.result === "OWNER_ESCALATION") {
      return failed(
        "REVIEW_OWNER_ESCALATION",
        `semantic attempt 2 outcome is ${review.outcome}; this review lifecycle returns to the owner and no further attempt runs. Review written to ${reviewPath}`
      );
    }
    return failed(
      "INDEPENDENT_REVIEW_NOT_CONCUR",
      `semantic attempt 1 outcome is ${review.outcome}; one bounded correction of the same records is permitted: correct them, run ready, then prepare again. Review written to ${reviewPath}`
    );
  }
  console.log(`CONCUR (semantic attempt ${outcome.semanticAttempt})`);
  console.log(`Base: ${unit.baseGitSha}`);
  console.log(`Records: ${unit.changedRecords.map((record) => record.id).join(", ")}`);
  console.log(`Review: ${outcome.receipt.reviewSha256}`);
  console.log(`Artifact: ${outcome.artifactPath}\n`);
  console.log(`Commit ${outcome.artifactPath} with the records and paste the block below into the PR's "## Research semantic review" section (also written to ${join(workbenchDir, "pr-receipt.md")}).`);
  console.log("Any later change to these records requires a new owner declaration, review and receipt. CONCUR is not an approval.\n");
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
    if (command === "ready") ready(repoRoot, flag, args);
    else if (command === "prepare") prepare(repoRoot, flag);
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
