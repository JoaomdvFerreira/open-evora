/**
 * Pre-promotion repository-state re-verification. Delegates to
 * canonical-promoter.ts's own
 * `assertCanonicalRepositoryState` — the exact check
 * `applyCanonicalIntegrationPlan()` already performs internally — rather
 * than duplicating its Git/clean-tree/HEAD-match logic a second time. This
 * module adds no new validation semantics of its own; it exists only to
 * give promote.ts an explicit, named "verify before promotion" step that
 * reads clearly at the call site and fails the same way
 * applyCanonicalIntegrationPlan() itself would.
 */
import { assertCanonicalRepositoryState, CanonicalIntegrationPromotionError } from "../integration/canonical-promoter.ts";

export type RepositoryStatePrecheckResult =
  | { ok: true; head: string }
  | { ok: false; reason: string };

/**
 * Re-verifies that `baseGitSha` still equals current HEAD for the
 * repository rooted at `researchRoot`, and that the working tree is clean —
 * immediately before any promotion attempt. Never throws: any failure is
 * reported as `{ ok: false }` so callers can abort before canonical writes
 * are attempted rather than letting an uncaught exception decide control
 * flow.
 */
export function precheckRepositoryState(researchRoot: string, baseGitSha: string): RepositoryStatePrecheckResult {
  try {
    const state = assertCanonicalRepositoryState(researchRoot, baseGitSha);
    return { ok: true, head: state.head };
  } catch (error) {
    const message = error instanceof CanonicalIntegrationPromotionError ? error.message : (error as Error).message;
    return { ok: false, reason: message };
  }
}
