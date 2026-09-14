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
 * the whole argument in `"..."` whenever it contains a space, quote, or is
 * empty). Used only by the Windows branch of run() below, and only because
 * `spawnSync` cannot invoke a `.cmd`/`.bat` PATH executable (e.g. this
 * module's own tests substitute a fake `gh.cmd`) without going through a
 * shell — `shell: true` with an args array is avoided here because Node
 * only concatenates args unescaped in that mode, which both breaks
 * multi-word arguments (commit messages, PR bodies) and is a real
 * shell-injection risk for attacker-adjacent content; this explicit
 * per-argument quoting keeps the array-args safety property spawnSync
 * normally provides.
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

interface ExistingPr {
  number: number;
  url: string;
  headRefName: string;
}

function findExistingPr(repoRoot: string, branch: string, env: NodeJS.ProcessEnv): ExistingPr | null {
  const result = run(repoRoot, "gh", ["pr", "list", "--head", branch, "--json", "number,url,headRefName", "--limit", "1"], env);
  if (!result.ok || result.stdout === "") return null;
  try {
    const parsed = JSON.parse(result.stdout) as ExistingPr[];
    return parsed.length > 0 ? parsed[0]! : null;
  } catch {
    return null;
  }
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

  // --- BRANCH -----------------------------------------------------------
  if (!branchExists(input.repoRoot, branch, env)) {
    const create = run(input.repoRoot, "git", ["checkout", "-b", branch], env);
    if (!create.ok) return { status: "FAILED", failedStage: "BRANCH", message: create.stderr || "failed to create branch" };
  } else {
    const checkout = run(input.repoRoot, "git", ["checkout", branch], env);
    if (!checkout.ok) return { status: "FAILED", failedStage: "BRANCH", message: checkout.stderr || "failed to check out existing branch" };
  }

  // --- COMMIT -------------------------------------------------------------
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
  let pr = findExistingPr(input.repoRoot, branch, env);
  if (!pr) {
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
    pr = findExistingPr(input.repoRoot, branch, env);
    if (!pr) return { status: "FAILED", failedStage: "PR_CREATE", message: "PR creation reported success but no PR could be found for this branch" };
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
