/**
 * Post-approval orchestration. The
 * single, deterministic path from a valid, bound human
 * APPROVE through canonical promotion, validation/build, the LOW-3
 * publication guard, and Git/PR orchestration, terminating at exactly
 * READY_FOR_OWNER_MERGE. This module is the one place these steps are
 * sequenced; it introduces no second canonical-write path and calls every
 * existing deterministic primitive (readiness/validation/promoter) exactly
 * as it exists today.
 *
 * Hard invariants enforced here (never elsewhere reachable):
 *  - the promoter (applyCanonicalIntegrationPlan) is unreachable before a
 *    valid, bound human APPROVE (assertDecisionRecordBinding + HIGH-2
 *    rehash both re-run here, not merely trusted from a prior step);
 *  - REJECT / HOLD_MORE_RESEARCH paths return before any canonical write;
 *  - the OD-D "APPROVE canonical, HOLD/REJECT publication" private-hold
 *    sequence never promotes/commits/pushes/opens a PR until a later,
 *    separate publicExplorerPublication=APPROVE decision is recorded;
 *  - no failure path ever returns READY_FOR_OWNER_MERGE;
 *  - no code path here merges, auto-merges, or bypasses branch protection.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { applyCanonicalIntegrationPlan, CanonicalIntegrationPromotionError } from "../integration/canonical-promoter.ts";
import type { CanonicalIntegrationPlan } from "../integration/canonical-integration-plan.ts";
import { computeContentHash } from "./content-hash.ts";
import { assertDecisionRecordBinding, loadDecisionRecord } from "./decision-record.ts";
import { checkPublicationGuard } from "./publication-guard.ts";
import { precheckRepositoryState } from "./repository-state.ts";
import { runPostApprovalGitSequence } from "./git-orchestrator.ts";
import { validateHumanGatePackage, asValidatedHumanGatePackage } from "./package-validator.ts";
import type { HumanGateDecisionRecord, HumanGatePackage, PostApprovalOutcome } from "./types.ts";

export interface RunPostApprovalPathInput {
  /** Absolute path to the repository root (containing research/, .git, etc.). */
  repoRoot: string;
  /** Absolute path to research/ under repoRoot. */
  researchRoot: string;
  /** Absolute path to the gitignored cycle directory holding the package + decision record. */
  cycleDir: string;
  /** Absolute path to the Human Gate package JSON file (the exact one shown to the owner). */
  packagePath: string;
  /** Base branch the PR targets. */
  baseBranch: string;
  /**
   * Process environment for every shell/git/gh command this path runs.
   * Defaults to the current process's environment. Tests override this to
   * exercise the real code path against a fake `gh` and a synthetic
   * repository rather than the real GitHub CLI/API or the real repo.
   */
  env?: NodeJS.ProcessEnv;
  /**
   * Overrides for the two post-promotion validation/build commands
   * (normally `npm run research:check` / `npm run explorer:build`).
   * Production code must never set this — it exists solely so tests can
   * substitute a fast, deterministic stand-in without weakening what the
   * real post-approval path actually runs in production (where this is
   * always left undefined and the real npm scripts run).
   */
  postPromotionCommandsForTestingOnly?: { researchCheck: [string, string[]]; explorerBuild: [string, string[]] };
}

function failed(failedStage: string, message: string): PostApprovalOutcome {
  return { status: "FAILED", failedStage, message };
}

/**
 * Windows-safe argument quoting for `cmd.exe /d /s /c` — see
 * git-orchestrator.ts's identical helper doc for why `shell: true` with an
 * args array is avoided (it only concatenates args unescaped in that mode,
 * breaking any path/argument containing a space, such as `process.execPath`
 * on a "Program Files" install, and is a real shell-injection risk for
 * attacker-adjacent content).
 */
function quoteForWindowsCmd(arg: string): string {
  if (arg === "") return '""';
  if (!/[\s"]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

/**
 * Joins an already-quoted command + args into the single command-line
 * string `cmd.exe /c` expects, applying cmd.exe's own well-known quirk: if
 * the first token of the line starts with `"`, the entire line must be
 * wrapped in one additional pair of quotes, or cmd.exe misparses the first
 * (quoted, space-containing) token as multiple words. This is the same
 * workaround Node's own child_process module applies internally for
 * `shell: true` on Windows.
 */
function buildWindowsCmdLine(command: string, args: string[]): string {
  const quotedCommand = quoteForWindowsCmd(command);
  const line = [quotedCommand, ...args.map(quoteForWindowsCmd)].join(" ");
  return quotedCommand.startsWith('"') ? `"${line}"` : line;
}

function runCommand(cwd: string, command: string, args: string[], env: NodeJS.ProcessEnv): { ok: boolean; output: string } {
  const result = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", buildWindowsCmdLine(command, args)], { cwd, encoding: "utf8", env, windowsVerbatimArguments: true })
    : spawnSync(command, args, { cwd, encoding: "utf8", env });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { ok: !result.error && result.status === 0, output };
}

/**
 * Re-validates the package and decision record exactly as HIGH-2 requires
 * at decision-submission time, but re-run here immediately before
 * promotion so that no time-of-check/time-of-use gap exists between
 * decision submission and promotion. Returns the validated package plus a
 * confirmed-bound decision record, or an explicit failure.
 */
function revalidateBoundApproval(input: RunPostApprovalPathInput): { pkg: HumanGatePackage; record: HumanGateDecisionRecord } | { error: PostApprovalOutcome } {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(input.packagePath, "utf8"));
  } catch (error) {
    return { error: failed("HIGH2_REVALIDATION", `package could not be read/parsed: ${(error as Error).message}`) };
  }
  const validation = validateHumanGatePackage(raw);
  if (validation.errors.length > 0) {
    return { error: failed("HIGH2_REVALIDATION", `package failed revalidation: ${validation.errors.join("; ")}`) };
  }
  const pkg = asValidatedHumanGatePackage(raw);
  const contentHash = computeContentHash(pkg);

  const decisionLoad = loadDecisionRecord(input.cycleDir);
  if (decisionLoad.status === "ABSENT") {
    return { error: failed("HIGH2_REVALIDATION", "no decision record found for this cycle directory") };
  }
  if (decisionLoad.status === "INVALID") {
    return { error: failed("HIGH2_REVALIDATION", `decision record failed validation: ${decisionLoad.errors.join("; ")}`) };
  }
  const record = decisionLoad.record;

  const binding = assertDecisionRecordBinding(record, { packageId: pkg.packageId, contentHash, baseGitSha: pkg.baseGitSha });
  if (!binding.ok) {
    return { error: failed("HIGH2_REVALIDATION", binding.reason) };
  }

  return { pkg, record };
}

/**
 * Runs the complete WU046 post-approval path for one cycle. Must be called
 * only after a human decision has already been recorded (decision.ts /
 * decision-record.ts) — this function re-verifies that binding itself
 * (never merely trusts a caller's claim that approval occurred) before any
 * canonical write.
 */
export function runPostApprovalPath(input: RunPostApprovalPathInput): PostApprovalOutcome {
  const env = input.env ?? process.env;
  const revalidated = revalidateBoundApproval(input);
  if ("error" in revalidated) return revalidated.error;
  const { pkg, record } = revalidated;

  // --- OD-D: REJECT / HOLD_MORE_RESEARCH must never promote ---------------
  if (record.canonicalAcceptance !== "APPROVE") {
    return failed("NOT_APPROVED", `canonicalAcceptance=${record.canonicalAcceptance}; no canonical write, no Git publication.`);
  }

  // --- OD-D: APPROVE canonical + HOLD/REJECT publication => private hold --
  if (record.publicExplorerPublication !== "APPROVE") {
    return {
      status: "PRIVATE_HOLD",
      message:
        `canonicalAcceptance=APPROVE but publicExplorerPublication=${record.publicExplorerPublication}. ` +
        "Per OD-D's binding exceptional-sequence rule, the approved package is preserved privately in its " +
        "existing gitignored location and is not promoted, committed, pushed, or opened as a PR. Waiting for " +
        "an explicit, separate publicExplorerPublication=APPROVE decision before the promoter -> Git -> PR " +
        "sequence may run.",
    };
  }

  if (!pkg.integrationPlan) {
    return failed("NO_INTEGRATION_PLAN", "approved package carries no integrationPlan; canonical promotion is not available.");
  }
  const plan: CanonicalIntegrationPlan = pkg.integrationPlan;

  // --- E: pre-promotion repository-state re-verification -------------------
  const precheck = precheckRepositoryState(input.researchRoot, pkg.baseGitSha);
  if (!precheck.ok) {
    return failed("REPOSITORY_STATE_PRECHECK", precheck.reason);
  }

  // --- F: canonical promotion via the existing promoter, unmodified --------
  try {
    applyCanonicalIntegrationPlan(input.researchRoot, plan);
  } catch (error) {
    const message = error instanceof CanonicalIntegrationPromotionError ? error.message : (error as Error).message;
    return failed("CANONICAL_PROMOTION", message);
  }

  // --- G: post-promotion validation/build -----------------------------------
  const [researchCheckCmd, researchCheckArgs] = input.postPromotionCommandsForTestingOnly?.researchCheck ?? ["npm", ["run", "research:check"]];
  const researchCheck = runCommand(input.repoRoot, researchCheckCmd, researchCheckArgs, env);
  if (!researchCheck.ok) {
    return failed("POST_PROMOTION_VALIDATION", `research:check failed after promotion:\n${researchCheck.output}`);
  }
  const [explorerBuildCmd, explorerBuildArgs] = input.postPromotionCommandsForTestingOnly?.explorerBuild ?? ["npm", ["run", "explorer:build"]];
  const explorerBuild = runCommand(input.repoRoot, explorerBuildCmd, explorerBuildArgs, env);
  if (!explorerBuild.ok) {
    return failed("POST_PROMOTION_BUILD", `explorer:build failed after promotion:\n${explorerBuild.output}`);
  }

  // --- H: LOW-3 deterministic publication guard -----------------------------
  const guard = checkPublicationGuard(input.repoRoot, plan);
  if (!guard.ok) {
    return failed(
      "PUBLICATION_GUARD",
      `unexpected staged/tracked/untracked path(s) outside the approved plan: ${guard.unexpectedPaths.join(", ")}`
    );
  }

  // --- I: Git / PR orchestration, terminating at READY_FOR_OWNER_MERGE -----
  const gitOutcome = runPostApprovalGitSequence({
    repoRoot: input.repoRoot,
    packageId: pkg.packageId,
    baseGitSha: pkg.baseGitSha,
    commitMessage: `research(${pkg.packageId}): canonical integration via WU046 Human Gate approval`,
    prTitle: `Research: ${pkg.investigationQuestion.slice(0, 72)}`,
    prBody: buildPrBody(pkg, record),
    baseBranch: input.baseBranch,
    env,
  });

  if (gitOutcome.status === "FAILED") {
    return failed(gitOutcome.failedStage, gitOutcome.message);
  }

  // --- J: explicit terminal boundary — never merge, never auto-merge -------
  return {
    status: "READY_FOR_OWNER_MERGE",
    prUrl: gitOutcome.prUrl,
    branch: gitOutcome.branch,
    commitSha: gitOutcome.commitSha,
  };
}

function buildPrBody(pkg: HumanGatePackage, record: HumanGateDecisionRecord): string {
  return [
    `Package: \`${pkg.packageId}\``,
    `Base SHA: \`${pkg.baseGitSha}\``,
    `Approved by: ${record.actor} at ${record.timestamp}`,
    "",
    `## Investigation question`,
    pkg.investigationQuestion,
    "",
    "This PR was produced by WU046's deterministic post-approval automation after an explicit, bound human " +
    "APPROVE decision. It has not been merged automatically — owner review and merge remain required.",
  ].join("\n");
}
