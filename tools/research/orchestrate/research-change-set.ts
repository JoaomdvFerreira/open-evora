/**
 * Assembles the Research Change Set (OD-C, Option 3 — JSON source of
 * truth; contract §11). This module
 * sequences and structurally validates; it never performs discovery,
 * extraction, or candidate authoring itself, and it never writes canonical
 * research. Every deterministic primitive it calls is imported from its
 * existing home under tools/research/{integration,validation}/ (§6) —
 * this module introduces no second delta/validation/readiness
 * implementation.
 *
 * WU045 stops at producing this JSON artifact. The generated human-readable
 * Markdown view and the formal approval/contentHash binding protocol are
 * WU046's responsibility (§12) and are deliberately not implemented here.
 */
import { classifyCandidateDelta } from "../integration/candidate-delta.ts";
import { prepareCanonicalIntegrationReview, type CanonicalIntegrationReview } from "../integration/canonical-integration-review.ts";
import { prepareCanonicalIntegrationPlan } from "../integration/canonical-integration-plan.ts";
import type { CorpusIndex } from "../core/types.ts";
import { sha256Hex } from "./fingerprint.ts";
import { loadCandidates } from "./candidate-loader.ts";
import { validateManifest, asValidatedManifest } from "./manifest.ts";
import { validateIndependentReview, asValidatedIndependentReview } from "./independent-review.ts";
import type { GenerationManifest, IndependentReviewResult, PreparationOutcome, ResearchChangeSet } from "./types.ts";
import { evaluateSafetyAdmission, type SafetyAdmission } from "../admission/safety-admission.ts";

export interface PrepareResearchChangeSetInput {
  index: CorpusIndex;
  baseGitSha: string;
  candidatesDir: string;
  rawManifest: unknown;
  rawIndependentReview: unknown;
}

function failed(failedCheck: string, message: string): PreparationOutcome {
  return { status: "FAILED", failedCheck, message };
}

function preparationFingerprintOf(
  manifest: GenerationManifest,
  changeSet: Omit<ResearchChangeSet, "packageId" | "preparationFingerprint">
): string {
  const deterministicAdmission = {
    disposition: changeSet.safetyAdmission.disposition,
    findings: changeSet.safetyAdmission.findings.map(({ code, subjectId, severity, summary, evidenceReferences }) => ({ code, subjectId, severity, summary, evidenceReferences })),
  };
  return sha256Hex({
    baseGitSha: changeSet.baseGitSha,
    manifest,
    candidates: changeSet.candidates,
    deltas: changeSet.deltas,
    validation: changeSet.validation,
    readiness: changeSet.readiness,
    independentReview: changeSet.independentReview,
    integrationPlan: changeSet.integrationPlan,
    safetyAdmission: deterministicAdmission,
  });
}

/**
 * Assembles the final Research Change Set from already-validated,
 * already-computed pieces: a validated manifest, a `CanonicalIntegrationReview`
 * (candidates/deltas/validation/readiness) already confirmed
 * READY_FOR_INTEGRATION_GATE, and a validated independent-review result.
 *
 * This is the single assembly point both prepareResearchChangeSet() (the
 * pre-file-based/legacy path, which derives `review` itself from disk) and
 * run-cycle.ts's AI-driven normal path call — the latter passes the exact
 * same `review` object it already built to freeze the reviewer's input
 * (WU045-B01 independent-review remediation, finding 3: "reviewer snapshot
 * must equal the final package snapshot"). Because both callers assemble
 * through this one function from a `review` value they hold in memory,
 * there is no second, independent re-derivation step that could silently
 * diverge from what the reviewer actually evaluated — the final package is
 * provably built from the same candidates/deltas/validation/readiness the
 * reviewer was given, not a value recomputed afterward.
 *
 * `packageId` and `preparationFingerprint` are derived entirely from
 * `baseGitSha` plus the validated manifest/candidate/review content — no
 * timestamp or other run-specific metadata is included or recorded
 * anywhere in the package, so an identical rerun against identical inputs
 * is deterministically identical (§11 idempotency contract, §14 case 20).
 */
export function assembleResearchChangeSet(
  index: CorpusIndex,
  manifest: GenerationManifest,
  review: CanonicalIntegrationReview,
  independentReview: IndependentReviewResult,
  safetyAdmission: SafetyAdmission = evaluateSafetyAdmission({ index, candidates: review.candidates, affectedProblemIds: review.deltas.filter((d) => d.recordFamily === "PRB-").map((d) => d.id), frozenAt: new Date().toISOString(), evaluatedAt: new Date().toISOString() })
): PreparationOutcome {
  if (safetyAdmission.disposition === "HOLD") return failed("PRE_GATE_SAFETY_ADMISSION", "pre-Gate safety admission returned HOLD");
  const claimedIds = new Set(manifest.claimedRecordIds);
  const actualIds = new Set(review.deltas.map((delta) => delta.id));
  const missingClaims = manifest.claimedRecordIds.filter((id) => !actualIds.has(id));
  const undeclaredIds = review.deltas.map((delta) => delta.id).filter((id) => !claimedIds.has(id));
  if (missingClaims.length > 0 || undeclaredIds.length > 0) {
    return failed(
      "MANIFEST_CANDIDATE_MISMATCH",
      `claimed record IDs do not match candidate content (missing: [${missingClaims.join(", ")}], undeclared: [${undeclaredIds.join(", ")}])`
    );
  }

  if (review.validation.errors.length > 0) {
    return failed("PROSPECTIVE_VALIDATION", review.validation.errors.join("; "));
  }
  if (review.readiness !== "READY_FOR_INTEGRATION_GATE") {
    return failed("READINESS", "canonical integration review did not reach READY_FOR_INTEGRATION_GATE");
  }

  let integrationPlan;
  try {
    integrationPlan = prepareCanonicalIntegrationPlan(index, review);
  } catch (error) {
    return failed("INTEGRATION_PLAN", (error as Error).message);
  }

  const changeSetCore: Omit<ResearchChangeSet, "packageId" | "preparationFingerprint"> = {
    schemaVersion: "1",
    baseGitSha: review.baseGitSha,
    manifest,
    candidates: review.candidates,
    deltas: review.deltas,
    validation: review.validation,
    readiness: review.readiness,
    independentReview,
    integrationPlan,
    // Runtime timestamp stays in the Hold Report only; Human Gate/RCS identity
    // carries the deterministic decision content, not execution metadata.
    safetyAdmission: { ...safetyAdmission, evaluatedAt: "" },
  };

  const preparationFingerprint = preparationFingerprintOf(manifest, changeSetCore);
  const packageId = `RCS-${preparationFingerprint.slice(0, 16)}`;

  const changeSet: ResearchChangeSet = { ...changeSetCore, packageId, preparationFingerprint };
  return { status: "READY_FOR_HUMAN_REVIEW", changeSet };
}

/**
 * Runs the complete WU045 normal-path sequence for one cycle: structural
 * manifest/independent-review validation, candidate loading, and the
 * existing candidate-delta -> prospective-validation -> canonical-
 * integration-review -> canonical-integration-plan chain (§6, §11). Fails
 * closed at the first structural problem, reporting exactly which check
 * failed (§11) rather than producing a partial "looks ready" package.
 *
 * This is the pre-file-based path: it derives `review` itself by loading
 * candidates from `candidatesDir`. run-cycle.ts's AI-driven normal path
 * does not call this function — it calls assembleResearchChangeSet()
 * directly with the `review` object it already computed, so the value the
 * reviewer saw and the value in the final package are provably the same
 * object (finding 3). This function remains for direct/pre-file-based use
 * and by this module's own tests.
 */
export function prepareResearchChangeSet(input: PrepareResearchChangeSetInput): PreparationOutcome {
  const manifestValidation = validateManifest(input.rawManifest);
  if (manifestValidation.errors.length > 0) {
    return failed("MANIFEST_VALIDATION", manifestValidation.errors.join("; "));
  }
  const manifest = asValidatedManifest(input.rawManifest);

  const reviewValidation = validateIndependentReview(input.rawIndependentReview);
  if (reviewValidation.errors.length > 0) {
    return failed("INDEPENDENT_REVIEW_VALIDATION", reviewValidation.errors.join("; "));
  }
  const independentReview = asValidatedIndependentReview(input.rawIndependentReview);

  const loadResult = loadCandidates(input.index, input.candidatesDir, manifest.candidateFiles);
  if (loadResult.failures.length > 0) {
    return failed(
      "CANDIDATE_LOAD",
      loadResult.failures.map((failure) => `${failure.file}: ${failure.message}`).join("; ")
    );
  }

  // classifyCandidateDelta() is re-run inside prepareCanonicalIntegrationReview()
  // below; this call exists only to surface a CANDIDATE_DELTA-specific failure
  // reason before that point, matching the prior behaviour of this function.
  try {
    loadResult.candidates.forEach((candidate) => classifyCandidateDelta(input.index, candidate));
  } catch (error) {
    return failed("CANDIDATE_DELTA", (error as Error).message);
  }

  let review;
  try {
    review = prepareCanonicalIntegrationReview(input.baseGitSha, input.index, loadResult.candidates);
  } catch (error) {
    return failed("PROSPECTIVE_VALIDATION", (error as Error).message);
  }

  // The manifest/claimed-ID cross-check now lives in assembleResearchChangeSet()
  // (shared with run-cycle.ts's AI-driven path) so both callers enforce it
  // identically — see that function's doc.
  return assembleResearchChangeSet(input.index, manifest, review, independentReview);
}
