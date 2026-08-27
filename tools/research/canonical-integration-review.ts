/**
 * Read-only preparation of a candidate set for the human Gate 1 canonical
 * integration decision. This module reports structural readiness only; it
 * never approves, applies, or otherwise changes canonical research.
 */
import { classifyCandidateDelta, type CandidateDelta, type CandidateRecord } from "./candidate-delta.ts";
import type { CorpusIndex, RecordFields } from "./core/types.ts";
import { validateCandidateSet, type CandidateSetValidationResult } from "./prospective-validation.ts";
import type { ValidationResult } from "./validation/validate.ts";

/** Structural outcome for a prepared Gate 1 review unit, never a human decision. */
export type CanonicalIntegrationReadiness = "READY_FOR_INTEGRATION_GATE" | "REVIEW_REQUIRED";

/**
 * Detached, deterministic material for one human Gate 1 review.
 *
 * `readiness` says only whether prospective structural validation reported
 * errors. It does not express approval, research truth, corroboration,
 * validation, publication safety, or acceptance by Open Évora.
 */
export interface CanonicalIntegrationReview {
  /** Caller-supplied, unverified full Git commit SHA for the canonical base. */
  baseGitSha: string;
  /** Candidate records in the same deterministic target order as `deltas`. */
  candidates: CandidateRecord[];
  /** Read-only comparison of each candidate with the supplied canonical index. */
  deltas: CandidateDelta[];
  /** Structural result from validating the complete prospective candidate set. */
  validation: ValidationResult;
  /** Structural readiness for human Gate 1 review only. */
  readiness: CanonicalIntegrationReadiness;
}

const FULL_GIT_SHA = /^[0-9a-fA-F]{40}$/;

function candidateTarget(delta: Pick<CandidateDelta, "recordFamily" | "id">): string {
  return `${delta.recordFamily}\u0000${delta.id}`;
}

function detachedCandidate(candidate: CandidateRecord): CandidateRecord {
  return {
    recordFamily: candidate.recordFamily,
    fields: structuredClone(candidate.fields) as RecordFields,
  };
}

function candidatesInDeltaOrder(
  index: CorpusIndex,
  candidates: readonly CandidateRecord[],
  result: CandidateSetValidationResult
): CandidateRecord[] {
  const candidatesByTarget = new Map<string, CandidateRecord>();
  for (const candidate of candidates) {
    const delta = classifyCandidateDelta(index, candidate);
    candidatesByTarget.set(candidateTarget(delta), candidate);
  }

  return result.deltas.map((delta) => {
    const candidate = candidatesByTarget.get(candidateTarget(delta));
    // validateCandidateSet() has already rejected duplicate or unusable targets.
    if (!candidate) throw new Error(`candidate set has no candidate for ${delta.recordFamily}${delta.id}`);
    return detachedCandidate(candidate);
  });
}

/**
 * Prepares a detached review unit bound to a caller-supplied canonical Git
 * base. The SHA is format-checked only: this function never invokes Git or
 * verifies that the commit exists, is current, or is HEAD.
 */
export function prepareCanonicalIntegrationReview(
  baseGitSha: string,
  index: CorpusIndex,
  candidates: readonly CandidateRecord[]
): CanonicalIntegrationReview {
  if (typeof baseGitSha !== "string" || !FULL_GIT_SHA.test(baseGitSha)) {
    throw new Error("base Git SHA must be a full 40-character hexadecimal SHA");
  }

  const result = validateCandidateSet(index, candidates);
  return {
    baseGitSha,
    candidates: candidatesInDeltaOrder(index, candidates, result),
    deltas: result.deltas,
    validation: result.validation,
    readiness: result.validation.errors.length === 0 ? "READY_FOR_INTEGRATION_GATE" : "REVIEW_REQUIRED",
  };
}
