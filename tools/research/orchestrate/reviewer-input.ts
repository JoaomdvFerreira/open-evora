/**
 * Builds the immutable, bounded input handed to the INDEPENDENT_REVIEWER AI
 * invocation (WU045-B01 remediation; contract §9 OD-B strengthened point 6,
 * §6 "Independent review contract"). This module is the sole place the
 * reviewer's input is assembled — it is constructed exclusively from
 * already-validated, already-written artifacts (the manifest, the
 * materialized candidate YAML, and the deterministic
 * validation/readiness/delta results), never from the primary invocation's
 * process object, stdout transcript, or any other live reference to that
 * invocation. Because the reviewer invocation is a brand-new child process
 * (ai-invoker.ts) that only ever receives the string this module returns,
 * there is no code path by which generator conversational history, scratch
 * reasoning, or free-form rationale beyond `manifest.rationale` itself can
 * reach the reviewer.
 */
import type { CandidateDelta, CandidateRecord } from "../integration/candidate-delta.ts";
import type { CanonicalIntegrationReadiness } from "../integration/canonical-integration-review.ts";
import type { ValidationResult } from "../validation/validate.ts";
import { canonicalJsonStringify } from "./fingerprint.ts";
import type { GenerationManifest } from "./types.ts";

export interface ReviewerInputSource {
  baseGitSha: string;
  manifest: GenerationManifest;
  candidates: CandidateRecord[];
  deltas: CandidateDelta[];
  validation: ValidationResult;
  readiness: CanonicalIntegrationReadiness;
}

/**
 * The exact allow-listed shape delivered to the reviewer over stdin. Every
 * field here is either a deterministic tooling output or content the
 * primary pass produced that has already been written to disk and
 * re-validated — never a live conversational artifact. Field names are
 * deliberately explicit and enumerated (not "spread the manifest") so an
 * accidental future manifest field can never silently smuggle
 * generator-only context into the reviewer's input.
 */
export interface ReviewerInputPackage {
  schemaVersion: "1";
  baseGitSha: string;
  investigationQuestion: string;
  mode: string;
  targetProblemId?: string;
  candidates: CandidateRecord[];
  deltas: CandidateDelta[];
  validation: ValidationResult;
  readiness: CanonicalIntegrationReadiness;
}

/**
 * Freezes the reviewer input as a canonical JSON string (stable key
 * ordering, no insignificant whitespace — same serialization discipline as
 * fingerprint.ts) ready to deliver over stdin. Deliberately omits
 * `manifest.rationale`: the primary author's free-form justification is not
 * on the allow-list (contract §6 "must NOT receive... primary free-form
 * rationale outside the immutable package") — the reviewer evaluates the
 * candidates and deterministic results directly, not the author's stated
 * reasoning for them.
 */
export function buildReviewerInput(source: ReviewerInputSource): string {
  const pkg: ReviewerInputPackage = {
    schemaVersion: "1",
    baseGitSha: source.baseGitSha,
    investigationQuestion: source.manifest.investigationQuestion,
    mode: source.manifest.mode,
    ...(source.manifest.targetProblemId !== undefined ? { targetProblemId: source.manifest.targetProblemId } : {}),
    candidates: source.candidates,
    deltas: source.deltas,
    validation: source.validation,
    readiness: source.readiness,
  };
  return canonicalJsonStringify(pkg);
}
