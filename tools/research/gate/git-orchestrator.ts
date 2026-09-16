/**
 * Post-approval Git/PR orchestration (docs/design/
 * m013-launch-automation-contract.md §12, OD-E). Executes the bounded
 * deterministic sequence branch -> commit -> push -> PR creation -> CI
 * observation, terminating at exactly READY_FOR_OWNER_MERGE. Never merges,
 * never enables auto-merge, never bypasses branch protection.
 *
 * Uses standard Git and the GitHub CLI (`gh`) — no redundant abstraction is
 * introduced. Every mutating step first checks for compatible existing
 * state (a branch/commit/PR already produced by a prior partial run for
 * this exact packageId) and resumes safely rather than creating duplicates;
 * an incompatible existing state is reported as an explicit failure, never
 * silently reinterpreted.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface GitOrchestratorInput {
  repoRoot: string;
  packageId: string;
  baseGitSha: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  /** Base branch the PR targets (normally "main"). */
  baseBranch: string;
  /**
   * Process environment to use for every git/gh invocation. Defaults to the
   * current process's environment; tests override this (PATH + fake-gh
   * state) to exercise this module against a fake `gh` rather than the real
   * GitHub CLI/API.
   */
  env?: NodeJS.ProcessEnv;
}

export type GitOrchestratorOutcome =
  | { status: "READY_FOR_OWNER_MERGE"; branch: string; commitSha: string; prUrl: string; prNumber: number; ciStatus: string }
  | { status: "FAILED"; failedStage: string; message: string };

/**
 * Windows-safe argument quoting for `cmd.exe /d /s /c` (the same escaping
 * cmd.exe's own argument parser expects: double any embedded `"`, then wrap
 * the whole argument in `"..."` whenever it contains a space, quote, caret,
 * or is empty). Used only by the Windows branch of run() below, and only
 * because `spawnSync` cannot invoke a `.cmd`/`.bat` PATH executable (e.g.
 * this module's own tests substitute a fake `gh.cmd`) without going through
 * a shell — `shell: true` with an args array is avoided here because Node
 * only concatenates args unescaped in that mode, which both breaks
 * multi-word arguments (commit messages, PR bodies) and is a real
 * shell-injection risk for attacker-adjacent content; this explicit
 * per-argument quoting keeps the array-args safety property spawnSync
 * normally provides. `^` is included alongside `\s`/`"` because it is
 * cmd.exe's own escape metacharacter — an unquoted Git revision expression
 * such as `HEAD^{commit}` (used by the R1 branch-compatibility check below)
 * is silently mangled by cmd.exe's parser otherwise, observed directly as
 * `git rev-parse` failing with no stderr output at all.
 */
function quoteForWindowsCmd(arg: string): string {
  if (arg === "") return '""';
  if (!/[\s"^]/.test(arg)) return arg;
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

function run(repoRoot: string, command: string, args: string[], env: NodeJS.ProcessEnv): { ok: boolean; stdout: string; stderr: string } {
  const result = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", buildWindowsCmdLine(command, args)], { cwd: repoRoot, encoding: "utf8", env, windowsVerbatimArguments: true })
    : spawnSync(command, args, { cwd: repoRoot, encoding: "utf8", env });
  if (result.error) return { ok: false, stdout: "", stderr: result.error.message };
  return { ok: result.status === 0, stdout: (result.stdout ?? "").trim(), stderr: (result.stderr ?? "").trim() };
}

/** Deterministic, bounded branch name derived from the package identity — stable across retries of the same package. */
export function branchNameForPackage(packageId: string): string {
  const slug = packageId.toLowerCase().replace(/^rcs-/, "");
  return `research/gate-${slug}`;
}

function branchExists(repoRoot: string, branch: string, env: NodeJS.ProcessEnv): boolean {
  return run(repoRoot, "git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], env).ok;
}

function remoteBranchExists(repoRoot: string, branch: string, env: NodeJS.ProcessEnv): boolean {
  const result = run(repoRoot, "git", ["ls-remote", "--exit-code", "--heads", "origin", branch], env);
  return result.ok && result.stdout.trim() !== "";
}

/** Resolves the Git tree object a ref/commit points at, or null if the ref/commit cannot be resolved. */
function treeOf(repoRoot: string, commitish: string, env: NodeJS.ProcessEnv): string | null {
  const result = run(repoRoot, "git", ["rev-parse", "--verify", "--quiet", `${commitish}^{tree}`], env);
  return result.ok ? result.stdout : null;
}

/** Resolves a ref/commit to its full commit SHA, or null if it cannot be resolved. */
function commitOf(repoRoot: string, commitish: string, env: NodeJS.ProcessEnv): string | null {
  const result = run(repoRoot, "git", ["rev-parse", "--verify", "--quiet", `${commitish}^{commit}`], env);
  return result.ok ? result.stdout : null;
}

/**
 * Resolves a ref/commit's sole parent commit SHA, or null if it has zero or
 * more than one parent, or cannot be resolved. Uses `git rev-list --parents
 * -n 1 <commitish>` (one line: "<commit> [parent1] [parent2...]") rather
 * than the `<rev>^@` revision syntax — `rev-parse --verify` on `^@` exits
 * non-zero on at least one real Git version even though it prints the
 * correct parent SHA to stdout, which would make this helper unreliable;
 * `rev-list --parents` is the command Git documents for parent enumeration
 * and exits 0 reliably, including for a root commit (zero parents).
 */
function soleParentOf(repoRoot: string, commitish: string, env: NodeJS.ProcessEnv): string | null {
  const result = run(repoRoot, "git", ["rev-list", "--parents", "-n", "1", commitish], env);
  if (!result.ok || result.stdout === "") return null;
  const fields = result.stdout.split(/\s+/).filter((field) => field !== "");
  // fields[0] is the commit itself; the rest are its parents, in order.
  const parents = fields.slice(1);
  return parents.length === 1 ? parents[0]! : null;
}

/**
 * The Git tree object the current index would produce if committed right
 * now, without mutating the index or working tree (`git write-tree` reads
 * the index as-is and only writes a new tree object into the object
 * database; it performs no checkout and touches no ref). Called from
 * `runPostApprovalGitSequence` while the repository is still on the base
 * branch at `baseGitSha`, with the index already holding exactly the
 * approved staged changes (guaranteed by the LOW-3 publication guard, which
 * `promote.ts` runs immediately before this function) — so this is exactly
 * the publication result WU046 is about to commit for this package.
 */
function currentIndexTree(repoRoot: string, env: NodeJS.ProcessEnv): string | null {
  const result = run(repoRoot, "git", ["write-tree"], env);
  return result.ok ? result.stdout : null;
}

/**
 * R1 remediation (independent-review FAIL finding, re-review of the prior
 * MEDIUM fix): ancestry of `baseGitSha` alone proves only that a branch
 * *descends* from the approved base — it does not prove the branch carries
 * *only* the exact approved publication result. A branch that is a genuine
 * descendant of `baseGitSha` but also carries an unrelated extra commit (or
 * a modification to an approved path with unapproved content, a missing
 * approved change, an unexpected deletion, etc.) would pass ancestry and
 * then have that unapproved content silently carried into the resulting PR.
 *
 * This derives compatibility from the exact state WU046 is about to
 * publish (no second, parallel approval-identity/fingerprint system is
 * introduced) using Git's own tree comparison rather than manual file-diffing:
 * `expectedPublicationTree` is the tree the COMMIT stage below would produce
 * for this exact approved run (the current index's tree, per
 * `currentIndexTree` above). A branch is compatible iff its tip is in
 * exactly one of the two shapes the COMMIT stage can ever produce:
 *
 *  - State A (branch created, not yet committed): the branch tip IS
 *    `baseGitSha` — same commit, so trivially the same tree as `baseGitSha`.
 *  - State B (a prior run's publication commit already exists): the branch
 *    tip has `baseGitSha` as its *sole* parent (i.e. exactly one commit
 *    ahead of the approved base — no room for an extra/unrelated commit
 *    between them), AND the branch tip's tree is byte-for-byte identical
 *    (via Git's own tree-object equality, which is content-addressed and
 *    therefore inherently content-sensitive rather than path-only) to
 *    `expectedPublicationTree`.
 *
 * Any other shape — disjoint history, a stale/wrong base, an extra commit
 * before or after the publication commit, a publication commit whose tree
 * differs in any way (extra file, missing file, wrong content on an
 * approved path, unexpected deletion/rename) — is incompatible and fails
 * closed here, before the branch is ever checked out or built upon. This is
 * the narrowest history shape actually produced by this module: the COMMIT
 * stage below makes at most one commit per invocation, so no wider shape is
 * ever legitimate.
 */
function isBranchCompatible(repoRoot: string, branch: string, baseGitSha: string, expectedPublicationTree: string | null, env: NodeJS.ProcessEnv): boolean {
  const ref = `refs/heads/${branch}`;
  const branchCommit = commitOf(repoRoot, ref, env);
  const baseCommit = commitOf(repoRoot, baseGitSha, env);
  if (!branchCommit || !baseCommit) return false;

  // State A: branch created but no publication commit made yet.
  if (branchCommit === baseCommit) return true;

  // State B: exactly one commit ahead of the approved base, with a tree
  // identical to the exact approved publication result.
  if (!expectedPublicationTree) return false;
  const soleParent = soleParentOf(repoRoot, ref, env);
  if (soleParent !== baseCommit) return false;
  const branchTree = treeOf(repoRoot, ref, env);
  return branchTree !== null && branchTree === expectedPublicationTree;
}

interface ExistingPr {
  number: number;
  url: string;
  headRefName: string;
  baseRefName: string;
}

function findExistingPr(repoRoot: string, branch: string, env: NodeJS.ProcessEnv): ExistingPr[] {
  const result = run(repoRoot, "gh", ["pr", "list", "--head", branch, "--json", "number,url,headRefName,baseRefName"], env);
  if (!result.ok || result.stdout === "") return [];
  try {
    const parsed = JSON.parse(result.stdout);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ExistingPr =>
        item !== null &&
        typeof item === "object" &&
        typeof item.number === "number" &&
        typeof item.url === "string" &&
        typeof item.headRefName === "string" &&
        typeof item.baseRefName === "string"
    );
  } catch {
    return [];
  }
}

/**
 * R2 remediation (independent-review MEDIUM finding): a PR matching the
 * expected head branch is not itself proof it is safe to reuse — it must
 * also target the expected base branch. This resolves the existing-PR
 * lookup to exactly one of three outcomes:
 *  - "NONE": no PR exists for this head branch; the caller should create one;
 *  - "COMPATIBLE": exactly one PR targets the expected base branch and is
 *    safe to resume onto;
 *  - "INCOMPATIBLE": at least one PR exists for this head branch, but none
 *    matches the expected base branch (wrong base) or more than one
 *    candidate is ambiguous (malformed/unexpected `gh` output shape) — in
 *    either case this must fail explicitly rather than silently reuse a
 *    mismatched PR or create a duplicate one alongside it.
 */
type ExistingPrLookup =
  | { status: "NONE" }
  | { status: "COMPATIBLE"; pr: ExistingPr }
  | { status: "INCOMPATIBLE"; candidates: ExistingPr[] };

function resolveExistingPr(repoRoot: string, branch: string, baseBranch: string, env: NodeJS.ProcessEnv): ExistingPrLookup {
  const candidates = findExistingPr(repoRoot, branch, env);
  if (candidates.length === 0) return { status: "NONE" };
  const compatible = candidates.filter((pr) => pr.baseRefName === baseBranch);
  if (compatible.length === 1 && candidates.length === 1) {
    return { status: "COMPATIBLE", pr: compatible[0]! };
  }
  return { status: "INCOMPATIBLE", candidates };
}

function currentCommitSha(repoRoot: string, env: NodeJS.ProcessEnv): string | null {
  const result = run(repoRoot, "git", ["rev-parse", "HEAD"], env);
  return result.ok ? result.stdout : null;
}

function observeCiStatus(repoRoot: string, prNumber: number, env: NodeJS.ProcessEnv): string {
  const result = run(repoRoot, "gh", ["pr", "checks", String(prNumber), "--json", "state"], env);
  if (!result.ok) return "UNKNOWN";
  try {
    const checks = JSON.parse(result.stdout) as Array<{ state: string }>;
    if (checks.length === 0) return "PENDING";
    if (checks.some((c) => c.state === "FAILURE" || c.state === "ERROR")) return "FAILING";
    if (checks.every((c) => c.state === "SUCCESS")) return "PASSING";
    return "PENDING";
  } catch {
    return "UNKNOWN";
  }
}

/**
 * Runs the complete post-approval Git/PR sequence for one approved package.
 * Idempotent/retry-safe: re-invoking against a repository already holding a
 * compatible branch/commit/PR for this exact packageId resumes rather than
 * duplicating; an incompatible state fails explicitly.
 *
 * This function assumes the caller has already: run the LOW-3 publication
 * guard against the exact set of paths the approved plan wrote, and
 * confirmed research:check/explorer:build pass locally. It performs no
 * canonical write itself — the canonical files must already be written and
 * validated on disk when this function is called.
 */
export function runPostApprovalGitSequence(input: GitOrchestratorInput): GitOrchestratorOutcome {
  const branch = branchNameForPackage(input.packageId);
  const env = input.env ?? process.env;

  // Stage the approved working-tree changes now, while still on the base
  // branch, before any branch decision is made. This is the same `git add
  // -A` the COMMIT stage below always performs — staging it early (rather
  // than after the branch switch) makes `currentIndexTree` below an
  // accurate preview of the tree this run's COMMIT stage will produce (an
  // index that still only holds tracked content, with approved-but-
  // untracked files never staged, would understate that tree and make the
  // R1 compatibility comparison below meaningless). Staging is index-only
  // and non-destructive; Git carries staged-but-uncommitted changes across
  // a subsequent `checkout`/`checkout -b` as long as the target branch has
  // no conflicting committed content, which is exactly the resume case
  // this function needs to support.
  const preStageAdd = run(input.repoRoot, "git", ["add", "-A"], env);
  if (!preStageAdd.ok) return { status: "FAILED", failedStage: "COMMIT", message: preStageAdd.stderr || "git add failed" };

  // --- BRANCH -----------------------------------------------------------
  if (!branchExists(input.repoRoot, branch, env)) {
    const create = run(input.repoRoot, "git", ["checkout", "-b", branch], env);
    if (!create.ok) return { status: "FAILED", failedStage: "BRANCH", message: create.stderr || "failed to create branch" };
  } else {
    // R1: an existing branch with this deterministic name is not itself
    // proof it is safe to resume onto, and ancestry of baseGitSha alone is
    // not sufficient either — it does not rule out unrelated extra commits
    // riding along. Captured here, while still on the base branch, is the
    // exact tree this run's COMMIT stage below would produce (the current,
    // now-fully-staged index's tree; the LOW-3 publication guard has
    // already verified the working tree holds exactly the approved
    // changes). isBranchCompatible then requires the existing branch tip to
    // be either exactly baseGitSha, or exactly one commit ahead of it with
    // that identical tree — before the branch is ever checked out or built
    // upon.
    const expectedPublicationTree = currentIndexTree(input.repoRoot, env);
    if (!isBranchCompatible(input.repoRoot, branch, input.baseGitSha, expectedPublicationTree, env)) {
      return {
        status: "FAILED",
        failedStage: "BRANCH",
        message:
          `existing branch "${branch}" is not compatible with this run: it is not exactly the approved ` +
          `baseGitSha ${input.baseGitSha}, nor exactly one commit ahead of it with a tree identical to the ` +
          "approved publication result. Refusing to resume onto unrelated/stale/divergent branch history. " +
          "No destructive reset or force-push was attempted.",
      };
    }
    const checkout = run(input.repoRoot, "git", ["checkout", branch], env);
    if (!checkout.ok) return { status: "FAILED", failedStage: "BRANCH", message: checkout.stderr || "failed to check out existing branch" };
  }

  // --- COMMIT -------------------------------------------------------------
  // Re-stage: on the create/checkout-b path, the initial staging above
  // already carried onto the new branch, so this is a no-op; on the
  // existing-compatible-branch path, checking out a branch whose tip
  // already differs from the base (State B) can otherwise leave the
  // pre-staged changes conflicting with what's already committed there, so
  // re-running `add -A` here reconciles the index against the branch that
  // is now actually checked out.
  const add = run(input.repoRoot, "git", ["add", "-A"], env);
  if (!add.ok) return { status: "FAILED", failedStage: "COMMIT", message: add.stderr || "git add failed" };

  const statusAfterAdd = run(input.repoRoot, "git", ["status", "--porcelain"], env);
  const hasStagedChanges = statusAfterAdd.ok && statusAfterAdd.stdout !== "";
  if (hasStagedChanges) {
    const commit = run(input.repoRoot, "git", ["commit", "-m", input.commitMessage], env);
    if (!commit.ok) return { status: "FAILED", failedStage: "COMMIT", message: commit.stderr || "git commit failed" };
  }
  // If there are no staged changes, this branch already holds the exact
  // approved commit from a prior partial run — resume rather than fail.

  const commitSha = currentCommitSha(input.repoRoot, env);
  if (!commitSha) return { status: "FAILED", failedStage: "COMMIT", message: "could not resolve HEAD after commit" };

  // --- PUSH -----------------------------------------------------------------
  if (!remoteBranchExists(input.repoRoot, branch, env)) {
    const push = run(input.repoRoot, "git", ["push", "--set-upstream", "origin", branch], env);
    if (!push.ok) return { status: "FAILED", failedStage: "PUSH", message: push.stderr || "git push failed" };
  } else {
    // Branch already exists on the remote (prior partial run). Push again
    // only if local HEAD has diverged from what is already published;
    // a plain push is safe here because this branch is exclusively owned
    // by this one package's orchestration (branchNameForPackage is
    // deterministic per packageId) and is never force-pushed.
    const push = run(input.repoRoot, "git", ["push", "origin", branch], env);
    if (!push.ok) return { status: "FAILED", failedStage: "PUSH", message: push.stderr || "git push failed" };
  }

  // --- PR CREATION (or resume an existing compatible PR) ----------------
  // R2: an existing PR matching the head branch is not itself proof it is
  // safe to reuse — it must also target the expected base branch. A head
  // match with the wrong base fails explicitly rather than being silently
  // reused or retargeted, and is never masked by creating a second,
  // duplicate PR alongside it.
  const existingLookup = resolveExistingPr(input.repoRoot, branch, input.baseBranch, env);
  if (existingLookup.status === "INCOMPATIBLE") {
    const describe = existingLookup.candidates
      .map((c) => `#${c.number} (base=${c.baseRefName}, url=${c.url})`)
      .join(", ");
    return {
      status: "FAILED",
      failedStage: "PR_CREATE",
      message:
        `existing PR(s) for head branch "${branch}" do not unambiguously match the expected base ` +
        `branch "${input.baseBranch}": ${describe}. Refusing to reuse a mismatched PR, retarget it, ` +
        "or create a duplicate. Resolve the conflicting PR manually before retrying.",
    };
  }

  let pr: ExistingPr;
  if (existingLookup.status === "COMPATIBLE") {
    pr = existingLookup.pr;
  } else {
    // The PR body is written to a temp file and passed via --body-file
    // rather than --body: a multi-line body passed as a literal command-
    // line argument is fundamentally unreliable on Windows — cmd.exe/the
    // Win32 CRT's argv tokenizer splits an argument on an embedded raw
    // newline even inside quotes, silently truncating it and shifting
    // every argument after it (observed directly: --head's value was lost
    // entirely, and gh received no --head at all). A body-file has no such
    // limitation on any platform and is exactly what gh's own --body-file
    // flag exists for.
    const bodyFileDir = mkdtempSync(join(tmpdir(), "open-evora-gate-pr-body-"));
    const bodyFilePath = join(bodyFileDir, "body.md");
    try {
      writeFileSync(bodyFilePath, input.prBody, "utf8");
      const create = run(input.repoRoot, "gh", [
        "pr", "create",
        "--title", input.prTitle,
        "--body-file", bodyFilePath,
        "--base", input.baseBranch,
        "--head", branch,
      ], env);
      if (!create.ok) return { status: "FAILED", failedStage: "PR_CREATE", message: create.stderr || "gh pr create failed" };
    } finally {
      rmSync(bodyFileDir, { recursive: true, force: true });
    }
    const afterCreate = resolveExistingPr(input.repoRoot, branch, input.baseBranch, env);
    if (afterCreate.status !== "COMPATIBLE") {
      return { status: "FAILED", failedStage: "PR_CREATE", message: "PR creation reported success but no compatible PR could be found for this branch/base" };
    }
    pr = afterCreate.pr;
  }

  // --- CI OBSERVATION (best-effort; a pending/unknown status is not itself a failure) --
  const ciStatus = observeCiStatus(input.repoRoot, pr.number, env);
  if (ciStatus === "FAILING") {
    return { status: "FAILED", failedStage: "CI", message: `CI checks are failing for PR #${pr.number} (${pr.url})` };
  }

  return {
    status: "READY_FOR_OWNER_MERGE",
    branch,
    commitSha,
    prUrl: pr.url,
    prNumber: pr.number,
    ciStatus,
  };
}
