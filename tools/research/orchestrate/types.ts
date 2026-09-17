/**
 * Structural types for the automated research preparation boundary. These
 * describe the
 * OD-B structured AI output contract and the OD-C Research Change Set (RCS)
 * assembly — never a semantic research judgement and never a canonical
 * record type. This module owns exactly the structural shape below; the human
 * Gate 1 decision, the RCS Markdown rendering, and the approval/contentHash
 * binding protocol remain the Human Gate's responsibility.
 */
import type { CandidateDelta, CandidateRecord } from "../integration/candidate-delta.ts";
import type { CanonicalIntegrationReadiness } from "../integration/canonical-integration-review.ts";
import type { CanonicalIntegrationPlan } from "../integration/canonical-integration-plan.ts";
import type { ValidationResult } from "../validation/validate.ts";
import type { SafetyAdmission } from "../admission/safety-admission.ts";

/** Which prompt/mode a cycle was triggered under (orchestration entry point). */
export type ResearchMode = "daily-discovery" | "problem-refresh";

/**
 * The accepted normal-path trigger input (WU045-B01 remediation: the normal
 * path must start from the trigger). An operator supplies this
 * once per cycle; the trigger decision itself is outside the normal-path
 * handoff count — everything from here to
 * READY_FOR_HUMAN_REVIEW is orchestrated with zero further human handoffs.
 */
export interface ResearchTrigger {
  mode: ResearchMode;
  /** Required when mode = "problem-refresh"; must be absent for "daily-discovery". */
  targetProblemId?: string;
  /** The bounded research question/URL/request that frames this cycle. */
  request: string;
}

/**
 * The per-cycle manifest an AI-assisted authoring pass must produce before
 * its candidates are considered structurally ready (OD-B point (a)).
 * Deterministic tooling validates only shape/presence here — never the
 * substantive adequacy of the investigation question or rationale.
 */
export interface GenerationManifest {
  schemaVersion: "1";
  mode: ResearchMode;
  /** Required for mode = "problem-refresh"; must be absent/undefined for "daily-discovery". */
  targetProblemId?: string;
  investigationQuestion: string;
  /** Candidate file paths, relative to the cycle's candidates/ directory. */
  candidateFiles: string[];
  /** Canonical record IDs the authoring pass claims to have produced, one per candidateFiles entry. */
  claimedRecordIds: string[];
  rationale: string;
}

/** The only structurally valid independent-review outcomes (OD-B five-point minimum bar). */
export type IndependentReviewOutcome = "CONCUR" | "DISAGREEMENT_FOUND" | "INSUFFICIENT_EVIDENCE";

/**
 * The distinct, structurally-required independent-review result (OD-B).
 * Produced by a separate invocation/role that consumes the
 * immutable candidate/RCS input without power to revise it — a schema
 * shape only; this module never verifies that a separate invocation
 * actually occurred, which is an orchestration-process requirement
 * enforced by the CLI (see cli.ts), not a structural property of the
 * output object itself.
 */
export interface IndependentReviewResult {
  schemaVersion: "1";
  outcome: IndependentReviewOutcome;
  rationale: string;
}

/**
 * The non-canonical, local, gitignored Research Change Set (OD-C, Option 3
 * — JSON source of truth). This is the exact structural artifact WU045
 * hands to WU046's Human Gate; it is never itself an approval, and it
 * carries no canonical record semantics. `packageId`/`preparationFingerprint`
 * support WU045's own idempotency guarantee — this is
 * distinct from, and never a substitute for, WU046's separate
 * approval/contentHash binding protocol.
 */
export interface ResearchChangeSet {
  schemaVersion: "1";
  packageId: string;
  baseGitSha: string;
  manifest: GenerationManifest;
  candidates: CandidateRecord[];
  deltas: CandidateDelta[];
  validation: ValidationResult;
  readiness: CanonicalIntegrationReadiness;
  independentReview: IndependentReviewResult;
  integrationPlan: CanonicalIntegrationPlan | null;
  /** WU049's single pre-Gate admission result; informational findings are projected to Human Gate. */
  safetyAdmission: SafetyAdmission;
  /**
   * Deterministic fingerprint over every field above except `packageId`
   * itself and this field. Identical logical inputs always yield the same
   * fingerprint. Intentionally
   * excludes any run timestamp: this module records no timestamp field at
   * all, so there is no non-hashed metadata to document.
   */
  preparationFingerprint: string;
}

/** Terminal outcome of one WU045 orchestration run. Never a Gate 1 decision. */
export type PreparationOutcome =
  | { status: "READY_FOR_HUMAN_REVIEW"; changeSet: ResearchChangeSet }
  | { status: "PRE_GATE_SAFETY_HOLD"; admission: import("../admission/safety-admission.ts").SafetyAdmission; holdReportPath: string }
  | { status: "FAILED"; failedCheck: string; message: string };

/**
 * One candidate record as returned inside the primary-authoring envelope
 * (WU045-B01 remediation). `path` is the relative candidate filename the
 * manifest's `candidateFiles` entry must match; `yaml` is the complete
 * candidate record content, materialized verbatim into the gitignored
 * workbench by the orchestrator — the AI process itself never writes to
 * the filesystem.
 */
export interface AuthoredCandidateFile {
  path: string;
  yaml: string;
}

/**
 * The complete structured envelope the PRIMARY_AUTHOR AI invocation must
 * emit on stdout (WU045-B01 remediation). Contains everything WU045 needs
 * to materialize the manifest and every
 * candidate file the existing deterministic chain requires — the AI
 * process never writes files directly; the orchestrator does, from this
 * validated envelope alone.
 */
export interface PrimaryAuthoringEnvelope {
  schemaVersion: "1";
  manifest: GenerationManifest;
  candidateFiles: AuthoredCandidateFile[];
}
