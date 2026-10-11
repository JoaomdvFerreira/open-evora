/**
 * Structural types for the shared semantic review kernel: the structured
 * independent-review result contract, its findings and signal dispositions,
 * and the neutral review framing a reviewer input package carries. These are
 * consumed by every review route (the orchestrated cycle and Lane B) and
 * are never by themselves a Gate decision or a canonical record type.
 */
import type { ClecDimension } from "../language/signals.ts";

/**
 * The review framing a package carries: an orchestrated cycle's manifest
 * (Lane A, supplied structurally as its GenerationManifest), or a fixed,
 * author-independent framing for a direct pull-request change (Lane B).
 * Only these fields are ever read.
 */
export interface ReviewFraming {
  investigationQuestion: string;
  targetProblemId?: string;
  mode: string;
}

/** The only structurally valid independent-review outcomes (OD-B five-point minimum bar). */
export type IndependentReviewOutcome = "CONCUR" | "DISAGREEMENT_FOUND" | "INSUFFICIENT_EVIDENCE";

/** The two semantic finding kinds a structured independent review may report. */
export type ReviewFindingKind = "CLEC_VIOLATION" | "INSUFFICIENT_EVIDENCE";

/** Whether a finding blocks a CONCUR outcome. There is no score. */
export type ReviewFindingSeverity = "BLOCKING" | "ADVISORY";

/**
 * The semantic disposition of one deterministic CLEC signal
 * (docs/investigationstrategy.md §12). INSUFFICIENT_EVIDENCE marks a
 * semantically relevant signal whose supplied evidence/context cannot decide
 * support versus violation — never a substitute for VIOLATION or NOT_APPLICABLE.
 */
export type SignalDispositionValue = "SUPPORTED" | "VIOLATION" | "NOT_APPLICABLE" | "INSUFFICIENT_EVIDENCE";

/**
 * One explainable semantic finding about authored candidate text. `claim`
 * quotes the authored field verbatim; `correctionDirection` says what must
 * change, never replacement canonical prose.
 */
export interface ReviewFinding {
  findingId: string;
  recordId: string;
  /** Dotted field path of the candidate's authored text; list items are indexed, e.g. `inference_limits[1]`. */
  field: string;
  claim: string;
  dimension: ClecDimension;
  kind: ReviewFindingKind;
  severity: ReviewFindingSeverity;
  reason: string;
  /** Record IDs from the reviewer input the finding was judged against. */
  evidenceReferences: string[];
  correctionDirection: string;
  relatedSignalIds: string[];
}

/** The reviewer's single disposition for one supplied deterministic signal. */
export interface SignalDisposition {
  signalId: string;
  disposition: SignalDispositionValue;
  reason: string;
  /** Record IDs from the reviewer input the disposition relies on; required for SUPPORTED. */
  evidenceReferences: string[];
  relatedFindingIds: string[];
}

/**
 * The distinct, structurally-required independent-review result (OD-B).
 * Produced by a separate invocation/role that consumes the
 * immutable candidate/RCS input without power to revise it — a schema
 * shape only; this module never verifies that a separate invocation
 * actually occurred, which is an orchestration-process requirement
 * enforced by each review route, not a structural property of the
 * output object itself.
 */
export interface IndependentReviewResult {
  schemaVersion: "2";
  outcome: IndependentReviewOutcome;
  rationale: string;
  findings: ReviewFinding[];
  signalDispositions: SignalDisposition[];
}
