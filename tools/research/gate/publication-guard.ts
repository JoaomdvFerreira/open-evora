/**
 * LOW-3 deterministic publication guard (independent-review finding LOW-3).
 * Enforced at the Git-publication boundary itself, immediately
 * before commit/push/PR — not via .gitignore, a pre-commit hook, or
 * developer discipline (those remain additional, not a replacement).
 *
 * Inspects the exact set of paths that would be published (staged +
 * modified + untracked, relative to the repository root) and compares them
 * against the exact approved CanonicalIntegrationPlan operation set plus any
 * explicitly permitted orchestration metadata. Any unexpected path — most
 * importantly any path under `.research-workbench/**` or an equivalent
 * gitignored candidate/RCS location — fails closed before any commit/push/
 * PR occurs.
 */
import { spawnSync } from "node:child_process";

import type { CanonicalIntegrationPlan } from "../integration/canonical-integration-plan.ts";

export interface PublicationGuardResult {
  ok: boolean;
  /** Paths that were about to be published but are not in the approved set. */
  unexpectedPaths: string[];
  /** Every path this guard inspected, for audit/test purposes. */
  inspectedPaths: string[];
}

const WORKBENCH_PREFIXES = [".research-workbench/"];

/**
 * R3 remediation (independent-review LOW finding): the prior implementation
 * parsed the default, human-oriented `git status --porcelain` format, which
 * quotes/C-escapes any path containing a literal `"`, backslash, or other
 * "unusual" byte (per Git's `core.quotePath`/`quote_c_style` behavior) — a
 * fragile decode this module was not correctly reversing. Rather than
 * implementing that decoding correctly (a second fragile parser replacing
 * the first), this uses Git's own documented machine-readable alternative:
 * `--porcelain=v1 -z`. With `-z`, Git guarantees paths are NEVER quoted or
 * escaped, and NUL (`\0`) — a byte that cannot appear in a Git path — is
 * used as the field terminator instead of the arrow-delimited/quoted text
 * format. Renames/copies are emitted as two consecutive NUL-terminated
 * fields (new path, then old path) rather than one "orig -> new" text field,
 * removing the ambiguity of a literal " -> " substring inside a real
 * filename entirely. This eliminates the quoted-path decode problem at the
 * source instead of re-solving it with custom unescaping logic.
 */
function runGitPorcelainStatus(repoRoot: string): string[] {
  const result = spawnSync("git", ["-C", repoRoot, "status", "--porcelain=v1", "-z", "--untracked-files=all"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(`git status failed: ${(result.stderr || result.error?.message || "unknown Git error").trim()}`);
  }
  const rawFields = result.stdout.split("\0");
  // split("\0") on a NUL-terminated stream leaves one trailing empty field;
  // drop it rather than treating it as a (would-be empty) path.
  if (rawFields.length > 0 && rawFields[rawFields.length - 1] === "") rawFields.pop();

  const paths: string[] = [];
  for (let i = 0; i < rawFields.length; i++) {
    const record = rawFields[i]!;
    // Each record's first 3 bytes are "XY " (two status characters plus a
    // single space) exactly as in the text format; -z changes only path
    // encoding/termination, not the fixed-width status prefix.
    const statusCode = record.slice(0, 2);
    const path = record.slice(3);
    paths.push(path);
    // A rename/copy status ("R" or "C" in either status column) is followed
    // by one additional NUL-terminated field holding the origin path — with
    // -z there is no " -> " delimiter to search for, so this is driven
    // entirely by the status code, which cannot be confused with path text.
    if (statusCode.includes("R") || statusCode.includes("C")) {
      i++;
      const originPath = rawFields[i];
      if (originPath !== undefined) paths.push(originPath);
    }
  }
  return paths;
}

/**
 * The exact byte-literal set of paths the approved plan is allowed to
 * publish, expressed relative to the repository root. `plan.operations[].
 * targetFile` is itself relative to the research root (exactly as
 * canonical-promoter.ts resolves it: `resolve(researchRoot, ...targetFile.
 * split("/"))`) — this guard runs `git status` from the repository root, so
 * each approved target is prefixed with `researchRootRelativeToRepo` to
 * land in the same coordinate space as what Git reports.
 */
function approvedPathsFromPlan(plan: CanonicalIntegrationPlan, researchRootRelativeToRepo: string): Set<string> {
  const prefix = researchRootRelativeToRepo.replace(/\/+$/, "");
  const paths = new Set<string>();
  for (const operation of plan.operations) {
    if (operation.action === "CREATE" || operation.action === "UPDATE") {
      paths.add(prefix ? `${prefix}/${operation.targetFile}` : operation.targetFile);
    }
  }
  return paths;
}

function isWorkbenchPath(path: string): boolean {
  return WORKBENCH_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix));
}

/**
 * Asserts that every currently staged/modified/untracked path in the
 * repository is exactly one the approved plan is allowed to publish (or an
 * explicitly permitted orchestration metadata path — none are permitted by
 * default; callers must pass `additionalAllowedPaths` explicitly and
 * narrowly if the orchestration sequence itself needs one). Never throws on
 * a guard failure — returns `{ ok: false }` so callers fail the publication
 * sequence closed rather than crashing past this check.
 */
export function checkPublicationGuard(
  repoRoot: string,
  plan: CanonicalIntegrationPlan,
  additionalAllowedPaths: readonly string[] = [],
  researchRootRelativeToRepo: string = "research"
): PublicationGuardResult {
  const inspectedPaths = runGitPorcelainStatus(repoRoot);
  const approved = approvedPathsFromPlan(plan, researchRootRelativeToRepo);
  const allowed = new Set(additionalAllowedPaths);

  const unexpectedPaths = inspectedPaths.filter((path) => {
    if (isWorkbenchPath(path)) return true;
    if (approved.has(path)) return false;
    if (allowed.has(path)) return false;
    return true;
  });

  return { ok: unexpectedPaths.length === 0, unexpectedPaths, inspectedPaths };
}

/** Throws with a clear, actionable message if the publication guard fails. Callers that want fail-closed control flow should prefer checkPublicationGuard() and branch on `.ok`. */
export function assertPublicationGuard(
  repoRoot: string,
  plan: CanonicalIntegrationPlan,
  additionalAllowedPaths: readonly string[] = [],
  researchRootRelativeToRepo: string = "research"
): void {
  const result = checkPublicationGuard(repoRoot, plan, additionalAllowedPaths, researchRootRelativeToRepo);
  if (!result.ok) {
    throw new Error(
      "LOW-3 publication guard failed: unexpected staged/tracked/untracked path(s) outside the approved " +
      `CanonicalIntegrationPlan operation set: ${result.unexpectedPaths.join(", ")}. Publication aborted before any commit/push/PR.`
    );
  }
}
