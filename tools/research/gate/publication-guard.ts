/**
 * LOW-3 deterministic publication guard (docs/design/
 * m013-launch-automation-contract.md §12, independent-review finding
 * LOW-3). Enforced at the Git-publication boundary itself, immediately
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

function runGitPorcelainStatus(repoRoot: string): string[] {
  const result = spawnSync("git", ["-C", repoRoot, "status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(`git status failed: ${(result.stderr || result.error?.message || "unknown Git error").trim()}`);
  }
  return result.stdout
    .split("\n")
    .filter((line) => line.replace(/[\r\n]+$/, "").length > 0)
    .map((line) => {
      // Porcelain format is fixed-width: exactly 2 status characters, then
      // a single space, then the path — "XY path" or "XY orig -> path" for
      // renames. A leading space in "XY" (e.g. " M") is itself meaningful
      // (unstaged-modified) and must not be trimmed away before slicing,
      // or the fixed 3-character prefix offset would eat into the path.
      const withoutTrailingNewline = line.replace(/[\r\n]+$/, "");
      const withoutStatus = withoutTrailingNewline.slice(3);
      const arrowIndex = withoutStatus.indexOf(" -> ");
      const path = arrowIndex === -1 ? withoutStatus : withoutStatus.slice(arrowIndex + 4);
      // Strip surrounding quotes Git adds for paths with special characters.
      return path.startsWith('"') && path.endsWith('"') ? path.slice(1, -1) : path;
    });
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
