/**
 * Structural types for the Human Gate & Post-Approval Orchestration
 * boundary (contract §12). The Human Gate package is a structured JSON
 * source of truth (OD-C, Option 3) assembled from WU045's Research Change
 * Set plus a readiness-machinery invocation, a rendered Markdown view, and
 * an owner decision bound to the exact package/content-hash/base-SHA by the
 * HIGH-2 protocol (content-hash.ts, decision.ts). None of these types
 * themselves constitute a canonical record type or an approval.
 */
import type { CandidateDelta, CandidateRecord } from "../integration/candidate-delta.ts";
import type { CanonicalIntegrationPlan } from "../integration/canonical-integration-plan.ts";
import type { ReadinessReport } from "../readiness/readiness.ts";
import type { ValidationResult } from "../validation/validate.ts";
import type { GenerationManifest, IndependentReviewResult, ResearchChangeSet } from "../orchestrate/types.ts";
import type { SafetyAdmission } from "../admission/safety-admission.ts";

/**
 * The Human Gate package (OD-C Option 3): one coherent, inspectable JSON
 * object exposing every element WU046's canonical scope names. This is the
 * exact object HIGH-2's contentHash is computed over and the exact object
 * the Markdown view is rendered from — never a separately re-derived copy
 * of either.
 */
export interface HumanGatePackage {
  schemaVersion: "1";
  /** Stable identity for this Human Gate package, derived from the underlying RCS packageId. */
  packageId: string;
  /** Exact canonical Git base SHA this package is bound to (copied from the RCS). */
  baseGitSha: string;
  /** The WU045 Research Change Set this package presents for review, verbatim. */
  researchChangeSet: ResearchChangeSet;
  /** Convenience projection of researchChangeSet.manifest.investigationQuestion for renderers. */
  investigationQuestion: string;
  /** Convenience projection of researchChangeSet.candidates. */
  candidates: CandidateRecord[];
  /** Convenience projection of researchChangeSet.deltas (CREATE/UPDATE/NO_CHANGE). */
  deltas: CandidateDelta[];
  /** Convenience projection of researchChangeSet.validation (prospective validation result). */
  prospectiveValidation: ValidationResult;
  /** Convenience projection of researchChangeSet.independentReview. */
  independentReview: IndependentReviewResult;
  /** Convenience projection of researchChangeSet.integrationPlan. */
  integrationPlan: CanonicalIntegrationPlan | null;
  /** Convenience projection of researchChangeSet.manifest. */
  manifest: GenerationManifest;
  /** Structured WU049 admission output, projected without recomputing policy. */
  safetyAdmission: SafetyAdmission;
  /**
   * Structured readiness results (readiness.ts, evaluateEligibility()/
   * evaluateCorroboration()) for every PRB-* affected by this package's
   * deltas, obtained via the WU046 readiness scope transfer (EVT-301). This
   * is pre-Gate analysis only: readiness.ts is invoked read-only, no
   * canonical/public write occurs, and no readiness rule/ReasonCode is
   * reimplemented or altered.
   */
  affectedProblemReadiness: ReadinessReport[];
  /** IDs of every PRB-* record affected (created, updated, or referenced) by this package's deltas. */
  affectedProblemIds: string[];
  /** Non-authoritative summary of expected Explorer/public effect. Never a decision. */
  expectedPublicEffect: string[];
  /** Non-authoritative list of risks/unresolved uncertainties surfaced for the owner. */
  risksAndUncertainties: string[];
  /**
   * A clearly non-authoritative recommendation. AI output can never
   * constitute approval (contract §12) — this field is structurally and
   * visually distinguished from the human decision itself by every
   * consumer (markdown-view.ts, decision.ts) and is never read as if it
   * were one.
   */
  nonAuthoritativeRecommendation: string;
}

/** Deterministic content-hash identity for a Human Gate package (HIGH-2, §12). */
export interface HumanGatePackageIdentity {
  packageId: string;
  schemaVersion: "1";
  baseGitSha: string;
  contentHash: string;
}

/** OD-D's two independently-recorded decision dimensions. */
export type CanonicalAcceptanceDecision = "APPROVE" | "REJECT" | "HOLD_MORE_RESEARCH";
export type PublicExplorerPublicationDecision = "APPROVE" | "REJECT" | "HOLD";

/**
 * Raw decision input as submitted by a human actor, before HIGH-2
 * revalidation/rehashing. `packageId`/`contentHash`/`baseGitSha` must match
 * the package identity actually rendered for review (decision.ts enforces
 * this; this type only describes shape).
 */
export interface HumanGateDecisionInput {
  packageId: string;
  contentHash: string;
  baseGitSha: string;
  actor: string;
  canonicalAcceptance: CanonicalAcceptanceDecision;
  publicExplorerPublication: PublicExplorerPublicationDecision;
}

/**
 * The persisted Human Gate decision record (contract §12/D; EVT-301). JSON
 * source of truth, stored in the same gitignored cycle directory as the RCS
 * it decides, outside canonical/public research/**. Bound to every field
 * HIGH-2/OD-D require; never transferable across packages.
 */
export interface HumanGateDecisionRecord {
  schemaVersion: "1";
  packageId: string;
  contentHash: string;
  baseGitSha: string;
  actor: string;
  /** ISO-8601 timestamp of decision submission. */
  timestamp: string;
  canonicalAcceptance: CanonicalAcceptanceDecision;
  publicExplorerPublication: PublicExplorerPublicationDecision;
}

/** Terminal outcome of a decision-submission attempt. Never itself an approval. */
export type DecisionSubmissionOutcome =
  | { status: "RECORDED"; record: HumanGateDecisionRecord }
  | { status: "REJECTED_INVALID_COMBINATION"; message: string }
  | { status: "ABORTED_CONTENT_MISMATCH"; message: string }
  | { status: "ABORTED_INVALID_PACKAGE"; message: string };

/** Terminal state WU046 automation must reach on the approved path, and only there. */
export type PostApprovalOutcome =
  | { status: "READY_FOR_OWNER_MERGE"; prUrl: string; branch: string; commitSha: string }
  | { status: "PRIVATE_HOLD"; message: string }
  | { status: "FAILED"; failedStage: string; message: string };
