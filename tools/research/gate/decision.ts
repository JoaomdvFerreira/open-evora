/**
 * Human decision submission for the Human Gate: the HIGH-2
 * approval/content-hash binding protocol and the OD-D invalid decision-state
 * combinations table.
 *
 * Implements the complete HIGH-2 flow's submission half (steps 7-12): on
 * decision submission, re-read the JSON source of truth from disk,
 * revalidate it, deterministically reserialize it, recompute contentHash,
 * compare against the hash of the package actually shown to the owner, and
 * fail closed on any mismatch. An approval can never be reused to authorize
 * a different package/base-SHA/integration-plan than the one it was bound
 * to at render time.
 *
 * This module makes no promotion decision itself and performs no
 * canonical/Git write — it only validates and records the human decision.
 */
import { readFileSync } from "node:fs";

import { computeContentHash } from "./content-hash.ts";
import { validateHumanGatePackage, asValidatedHumanGatePackage } from "./package-validator.ts";
import type {
  CanonicalAcceptanceDecision,
  DecisionSubmissionOutcome,
  HumanGateDecisionInput,
  HumanGateDecisionRecord,
  PublicExplorerPublicationDecision,
} from "./types.ts";

/**
 * OD-D's invalid decision-state combinations table: no public APPROVE may be
 * recorded while canonicalAcceptance is HOLD_MORE_RESEARCH or REJECT.
 */
export function isValidDecisionCombination(
  canonicalAcceptance: CanonicalAcceptanceDecision,
  publicExplorerPublication: PublicExplorerPublicationDecision
): boolean {
  if (publicExplorerPublication !== "APPROVE") return true;
  return canonicalAcceptance === "APPROVE";
}

export function describeInvalidCombination(
  canonicalAcceptance: CanonicalAcceptanceDecision,
  publicExplorerPublication: PublicExplorerPublicationDecision
): string {
  return (
    `invalid OD-D decision combination: canonicalAcceptance=${canonicalAcceptance}, ` +
    `publicExplorerPublication=${publicExplorerPublication}. Public-publication APPROVE is not ` +
    "actionable until canonicalAcceptance = APPROVE."
  );
}

/**
 * Submits a human decision against the package JSON currently on disk at
 * `packagePath`. Implements HIGH-2 steps 7-12 exactly:
 *   7. re-read the JSON source of truth from disk;
 *   8. revalidate it;
 *   9. recompute the full contentHash;
 *   10. compare the recomputed hash against the hash of the package that
 *       was shown for review (`input.contentHash`, captured at render
 *       time);
 *   11. on mismatch: abort, invalidate the review session (by never
 *       producing a decision record) — the caller must regenerate the
 *       review package and require a new decision;
 *   12. on match: persist a decision record.
 *
 * Also enforces OD-D's invalid-combination table before persisting. This
 * function never writes the decision record itself — see decision-record.ts
 * — it only validates and, on success, returns the exact record to persist.
 */
const VALID_CANONICAL_ACCEPTANCE: readonly CanonicalAcceptanceDecision[] = ["APPROVE", "REJECT", "HOLD_MORE_RESEARCH"];
const VALID_PUBLICATION: readonly PublicExplorerPublicationDecision[] = ["APPROVE", "REJECT", "HOLD"];

export function submitHumanGateDecision(packagePath: string, input: HumanGateDecisionInput): DecisionSubmissionOutcome {
  if (typeof input.actor !== "string" || input.actor.trim() === "") {
    return { status: "ABORTED_INVALID_PACKAGE", message: "decision actor must be a non-empty string" };
  }
  if (!VALID_CANONICAL_ACCEPTANCE.includes(input.canonicalAcceptance)) {
    return { status: "REJECTED_INVALID_COMBINATION", message: `invalid canonicalAcceptance value: ${JSON.stringify(input.canonicalAcceptance)}` };
  }
  if (!VALID_PUBLICATION.includes(input.publicExplorerPublication)) {
    return { status: "REJECTED_INVALID_COMBINATION", message: `invalid publicExplorerPublication value: ${JSON.stringify(input.publicExplorerPublication)}` };
  }
  if (!isValidDecisionCombination(input.canonicalAcceptance, input.publicExplorerPublication)) {
    return {
      status: "REJECTED_INVALID_COMBINATION",
      message: describeInvalidCombination(input.canonicalAcceptance, input.publicExplorerPublication),
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(packagePath, "utf8"));
  } catch (error) {
    return { status: "ABORTED_INVALID_PACKAGE", message: `package could not be read/parsed: ${(error as Error).message}` };
  }

  const validation = validateHumanGatePackage(raw);
  if (validation.errors.length > 0) {
    return { status: "ABORTED_INVALID_PACKAGE", message: `package failed revalidation: ${validation.errors.join("; ")}` };
  }
  const pkg = asValidatedHumanGatePackage(raw);

  if (pkg.packageId !== input.packageId) {
    return {
      status: "ABORTED_CONTENT_MISMATCH",
      message: `on-disk package.packageId (${pkg.packageId}) does not match the decision's packageId (${input.packageId})`,
    };
  }
  if (pkg.baseGitSha !== input.baseGitSha) {
    return {
      status: "ABORTED_CONTENT_MISMATCH",
      message: `on-disk package.baseGitSha (${pkg.baseGitSha}) does not match the decision's baseGitSha (${input.baseGitSha})`,
    };
  }

  const recomputedContentHash = computeContentHash(pkg);
  if (recomputedContentHash !== input.contentHash) {
    return {
      status: "ABORTED_CONTENT_MISMATCH",
      message:
        "recomputed contentHash does not match the hash of the package shown for review " +
        `(shown: ${input.contentHash}, recomputed: ${recomputedContentHash}). The review session is invalidated; ` +
        "a regenerated review package and a new human decision are required.",
    };
  }

  const record: HumanGateDecisionRecord = {
    schemaVersion: "1",
    packageId: pkg.packageId,
    contentHash: recomputedContentHash,
    baseGitSha: pkg.baseGitSha,
    actor: input.actor,
    timestamp: new Date().toISOString(),
    canonicalAcceptance: input.canonicalAcceptance,
    publicExplorerPublication: input.publicExplorerPublication,
  };

  return { status: "RECORDED", record };
}
