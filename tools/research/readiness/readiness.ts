/**
 * Pure readiness logic for the canonical SRC/EVD/PRB research corpus.
 *
 * Built on the shared TC-01 loading/indexing layer (core/corpus.ts) instead
 * of independently loading/parsing/indexing YAML — this module consumes an
 * already-built CorpusIndex and performs no filesystem or YAML access of
 * its own.
 *
 * Evaluates the explicitly authored PRB.decision_basis and returns
 * structured, deterministic results for two independent questions
 * (docs/investigationstrategy.md §6, "Decision basis and Eligibility"):
 *
 *   1. Eligibility     — READY_FOR_PROMOTION_GATE | REVIEW_REQUIRED
 *   2. Corroboration   — READY_FOR_CORROBORATION_GATE | REVIEW_REQUIRED
 *
 * This checks only that an explicit basis is present, structurally
 * well-formed, and internally consistent — never whether the problem is
 * real, whether evidence is sufficient, whether sources are independent,
 * causality, prevalence, civic importance, or whether promotion/
 * corroboration should be approved. Those remain human judgement recorded
 * on PRB-* (docs/investigationstrategy.md §7, "Corroboration and
 * validation"; AGENTS.md "Human-owned decisions"). No process/console/
 * exit-code handling here; see cli.ts for the CLI wrapper.
 *
 * Every PRB is evaluated the same way regardless of its current
 * validation_status/evidence_status: a PRB with no decision_basis is
 * always REVIEW_REQUIRED / NO_DECISION_BASIS for both questions, never
 * READY. There is no "not applicable" state — decision_basis is optional
 * to author, but once this engine is asked to evaluate a PRB, "no explicit
 * basis on record" is itself the review-required finding, not an
 * exemption from the question.
 */
import type { CorpusIndex, RecordFields } from "../core/types.ts";

// ---- stable reason codes ----------------------------------------------------

/** Discriminated reason codes for Eligibility/Corroboration findings. Stable identifiers — do not rename without a disclosed migration. */
export type ReasonCode =
  | "NO_DECISION_BASIS"
  | "MISSING_ELIGIBILITY_BASIS"
  | "MISSING_AFFECTED_POPULATION"
  | "MISSING_MANIFESTATION"
  | "MISSING_CONSEQUENCE"
  | "MISSING_CURRENTNESS"
  | "MISSING_CONTRADICTION_SEARCH"
  | "CONTRADICTION_SEARCH_NOT_PERFORMED"
  | "MISSING_SCOPE"
  | "MISSING_SCOPE_BOUNDED"
  | "BOUNDED_SCOPE_WITHOUT_LIMITATIONS"
  | "UNKNOWN_EVIDENCE_REFERENCE"
  | "EVIDENCE_NOT_LINKED_TO_PRB"
  | "MISSING_MANIFESTATION_EVIDENCE"
  | "MISSING_CONSEQUENCE_EVIDENCE"
  | "MISSING_OVERLAP_CHECK_ELIGIBILITY"
  | "OVERLAP_CHECK_NOT_PERFORMED"
  | "MISSING_CONTRACT_VERSION"
  | "MISSING_CORROBORATION_BASIS"
  | "MISSING_CORROBORATION_STATEMENT"
  | "STALE_CORROBORATION_STATEMENT"
  | "MISSING_SUPPORTING_EVIDENCE"
  | "UNKNOWN_BOUNDARY_EVIDENCE_REFERENCE"
  | "BOUNDARY_EVIDENCE_NOT_LINKED_TO_PRB"
  | "MISSING_INDEPENDENCE_ASSESSMENT"
  | "UNKNOWN_RELATED_PROBLEM_REFERENCE"
  | "LINEAGE_REQUIREMENT_NOT_STRUCTURALLY_AVAILABLE"
  | "CONTRADICTION_EVIDENCE_STRUCTURALLY_INCONSISTENT"
  | "MISSING_CURRENTNESS_CORROBORATION"
  | "MISSING_CONTRADICTION_SEARCH_CORROBORATION"
  | "CONTRADICTION_SEARCH_NOT_PERFORMED_CORROBORATION";

/** Preserves the legacy REASON.* string constants as a value/type pair for callers that prefer the object form. */
export const REASON: { [K in ReasonCode]: K } = {
  NO_DECISION_BASIS: "NO_DECISION_BASIS",
  MISSING_ELIGIBILITY_BASIS: "MISSING_ELIGIBILITY_BASIS",
  MISSING_AFFECTED_POPULATION: "MISSING_AFFECTED_POPULATION",
  MISSING_MANIFESTATION: "MISSING_MANIFESTATION",
  MISSING_CONSEQUENCE: "MISSING_CONSEQUENCE",
  MISSING_CURRENTNESS: "MISSING_CURRENTNESS",
  MISSING_CONTRADICTION_SEARCH: "MISSING_CONTRADICTION_SEARCH",
  CONTRADICTION_SEARCH_NOT_PERFORMED: "CONTRADICTION_SEARCH_NOT_PERFORMED",
  MISSING_SCOPE: "MISSING_SCOPE",
  MISSING_SCOPE_BOUNDED: "MISSING_SCOPE_BOUNDED",
  BOUNDED_SCOPE_WITHOUT_LIMITATIONS: "BOUNDED_SCOPE_WITHOUT_LIMITATIONS",
  UNKNOWN_EVIDENCE_REFERENCE: "UNKNOWN_EVIDENCE_REFERENCE",
  EVIDENCE_NOT_LINKED_TO_PRB: "EVIDENCE_NOT_LINKED_TO_PRB",
  MISSING_MANIFESTATION_EVIDENCE: "MISSING_MANIFESTATION_EVIDENCE",
  MISSING_CONSEQUENCE_EVIDENCE: "MISSING_CONSEQUENCE_EVIDENCE",
  MISSING_OVERLAP_CHECK_ELIGIBILITY: "MISSING_OVERLAP_CHECK_ELIGIBILITY",
  OVERLAP_CHECK_NOT_PERFORMED: "OVERLAP_CHECK_NOT_PERFORMED",
  MISSING_CONTRACT_VERSION: "MISSING_CONTRACT_VERSION",
  MISSING_CORROBORATION_BASIS: "MISSING_CORROBORATION_BASIS",
  MISSING_CORROBORATION_STATEMENT: "MISSING_CORROBORATION_STATEMENT",
  STALE_CORROBORATION_STATEMENT: "STALE_CORROBORATION_STATEMENT",
  MISSING_SUPPORTING_EVIDENCE: "MISSING_SUPPORTING_EVIDENCE",
  UNKNOWN_BOUNDARY_EVIDENCE_REFERENCE: "UNKNOWN_BOUNDARY_EVIDENCE_REFERENCE",
  BOUNDARY_EVIDENCE_NOT_LINKED_TO_PRB: "BOUNDARY_EVIDENCE_NOT_LINKED_TO_PRB",
  MISSING_INDEPENDENCE_ASSESSMENT: "MISSING_INDEPENDENCE_ASSESSMENT",
  UNKNOWN_RELATED_PROBLEM_REFERENCE: "UNKNOWN_RELATED_PROBLEM_REFERENCE",
  LINEAGE_REQUIREMENT_NOT_STRUCTURALLY_AVAILABLE: "LINEAGE_REQUIREMENT_NOT_STRUCTURALLY_AVAILABLE",
  CONTRADICTION_EVIDENCE_STRUCTURALLY_INCONSISTENT: "CONTRADICTION_EVIDENCE_STRUCTURALLY_INCONSISTENT",
  MISSING_CURRENTNESS_CORROBORATION: "MISSING_CURRENTNESS_CORROBORATION",
  MISSING_CONTRADICTION_SEARCH_CORROBORATION: "MISSING_CONTRADICTION_SEARCH_CORROBORATION",
  CONTRADICTION_SEARCH_NOT_PERFORMED_CORROBORATION: "CONTRADICTION_SEARCH_NOT_PERFORMED_CORROBORATION",
};

/** One structural/authored finding backing a REVIEW_REQUIRED result. */
export interface ReadinessFinding {
  code: ReasonCode;
  field?: string;
  detail?: string;
}

/** Discriminated result state for the Eligibility question. */
export type EligibilityResult = "READY_FOR_PROMOTION_GATE" | "REVIEW_REQUIRED";
/** Discriminated result state for the Corroboration question. */
export type CorroborationResult = "READY_FOR_CORROBORATION_GATE" | "REVIEW_REQUIRED";

export const READY = {
  ELIGIBILITY: "READY_FOR_PROMOTION_GATE",
  CORROBORATION: "READY_FOR_CORROBORATION_GATE",
} as const;
export const REVIEW_REQUIRED = "REVIEW_REQUIRED" as const;

export interface EligibilityReadiness {
  result: EligibilityResult;
  reasons: ReadinessFinding[];
}

export interface CorroborationReadiness {
  result: CorroborationResult;
  reasons: ReadinessFinding[];
}

/** Combined Eligibility + Corroboration readiness for one PRB-*. */
export interface ReadinessReport {
  problem_id: string;
  eligibility: EligibilityReadiness;
  corroboration: CorroborationReadiness;
}

// ---- helpers -----------------------------------------------------------------

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function asList(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function byId(index: CorpusIndex, prefix: string): ReadonlyMap<string, RecordFields> {
  const recordIndex = index.byPrefix.get(prefix);
  const map = new Map<string, RecordFields>();
  if (!recordIndex) return map;
  for (const [id, record] of recordIndex.byId) {
    map.set(id, record.fields);
  }
  return map;
}

/**
 * Evidence is "linked to the target PRB" when its ID appears in that PRB's
 * own `evidence` list — the one existing, already-validated PRB<->EVD link.
 * optional/lazily-populated and so cannot be relied on as a completeness
 * signal.
 */
function checkEvidenceRefs(
  fieldPath: string,
  evdIds: unknown,
  evidenceById: ReadonlyMap<string, RecordFields>,
  prbEvidence: ReadonlySet<string>,
  unknownCode: ReasonCode,
  unlinkedCode: ReasonCode,
  findings: ReadinessFinding[]
): void {
  for (const evdId of asList(evdIds)) {
    if (!isNonEmptyString(evdId)) continue;
    if (!evidenceById.has(evdId)) {
      findings.push({ code: unknownCode, field: fieldPath, detail: `${evdId} does not exist` });
      continue;
    }
    if (!prbEvidence.has(evdId)) {
      findings.push({
        code: unlinkedCode,
        field: fieldPath,
        detail: `${evdId} exists but is not linked to the problem (not present in its evidence list)`,
      });
    }
  }
}

// ---- eligibility --------------------------------------------------------------

export function evaluateEligibility(prbId: string, index: CorpusIndex): EligibilityReadiness {
  const problemsById = byId(index, "PRB-");
  const evidenceById = byId(index, "EVD-");
  const prb = problemsById.get(prbId)!;
  const db = prb.decision_basis as Record<string, unknown> | undefined | null;
  const findings: ReadinessFinding[] = [];

  if (db === undefined || db === null) {
    findings.push({ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" });
    return { result: REVIEW_REQUIRED, reasons: findings };
  }

  const prbEvidence = new Set(asList(prb.evidence).map((entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Record<string, unknown>).evidence_id : undefined).filter(isNonEmptyString) as string[]);

  if (!isNonEmptyString(db.contract_version)) {
    findings.push({ code: "MISSING_CONTRACT_VERSION", field: "decision_basis.contract_version" });
  }

  if (!isNonEmptyString(db.eligibility_basis)) {
    findings.push({ code: "MISSING_ELIGIBILITY_BASIS", field: "decision_basis.eligibility_basis" });
  }

  if (asList(prb.affected_populations).filter(isNonEmptyString).length === 0) {
    findings.push({ code: "MISSING_AFFECTED_POPULATION", field: "affected_populations" });
  }

  const manifestation = db.manifestation as Record<string, unknown> | undefined;
  if (!manifestation || !isNonEmptyString(manifestation.kind) || !isNonEmptyString(manifestation.summary)) {
    findings.push({ code: "MISSING_MANIFESTATION", field: "decision_basis.manifestation" });
  } else {
    checkEvidenceRefs(
      "decision_basis.manifestation.evidence",
      manifestation.evidence,
      evidenceById,
      prbEvidence,
      "UNKNOWN_EVIDENCE_REFERENCE",
      "EVIDENCE_NOT_LINKED_TO_PRB",
      findings
    );
    if (asList(manifestation.evidence).filter(isNonEmptyString).length === 0) {
      findings.push({
        code: "MISSING_MANIFESTATION_EVIDENCE",
        field: "decision_basis.manifestation.evidence",
        detail: "no non-empty EVD-* reference cited",
      });
    }
  }

  const consequence = db.consequence as Record<string, unknown> | undefined;
  if (!consequence || !isNonEmptyString(consequence.summary)) {
    findings.push({ code: "MISSING_CONSEQUENCE", field: "decision_basis.consequence.summary" });
  } else {
    checkEvidenceRefs(
      "decision_basis.consequence.evidence",
      consequence.evidence,
      evidenceById,
      prbEvidence,
      "UNKNOWN_EVIDENCE_REFERENCE",
      "EVIDENCE_NOT_LINKED_TO_PRB",
      findings
    );
    if (asList(consequence.evidence).filter(isNonEmptyString).length === 0) {
      findings.push({
        code: "MISSING_CONSEQUENCE_EVIDENCE",
        field: "decision_basis.consequence.evidence",
        detail: "no non-empty EVD-* reference cited",
      });
    }
  }

  const currentness = db.currentness as Record<string, unknown> | undefined;
  if (!currentness || !isNonEmptyString(currentness.assessment)) {
    findings.push({ code: "MISSING_CURRENTNESS", field: "decision_basis.currentness.assessment" });
  } else {
    checkEvidenceRefs(
      "decision_basis.currentness.evidence",
      currentness.evidence,
      evidenceById,
      prbEvidence,
      "UNKNOWN_EVIDENCE_REFERENCE",
      "EVIDENCE_NOT_LINKED_TO_PRB",
      findings
    );
  }

  const contradictionSearch = db.contradiction_search as Record<string, unknown> | undefined;
  if (
    !contradictionSearch ||
    (contradictionSearch.performed !== true && contradictionSearch.performed !== false) ||
    !isNonEmptyString(contradictionSearch.summary)
  ) {
    findings.push({
      code: "MISSING_CONTRADICTION_SEARCH",
      field: "decision_basis.contradiction_search",
      detail: "performed (boolean) and summary must both be explicitly authored",
    });
  } else {
    checkEvidenceRefs(
      "decision_basis.contradiction_search.evidence",
      contradictionSearch.evidence,
      evidenceById,
      prbEvidence,
      "UNKNOWN_EVIDENCE_REFERENCE",
      "EVIDENCE_NOT_LINKED_TO_PRB",
      findings
    );
    checkContradictionEvidenceConsistency(contradictionSearch, findings);
    if (contradictionSearch.performed === false) {
      findings.push({
        code: "CONTRADICTION_SEARCH_NOT_PERFORMED",
        field: "decision_basis.contradiction_search.performed",
        detail: "explicitly recorded as not performed; not ready for the promotion gate",
      });
    }
  }

  const overlapCheck = db.overlap_check as Record<string, unknown> | undefined;
  if (!overlapCheck || (overlapCheck.performed !== true && overlapCheck.performed !== false)) {
    findings.push({
      code: "MISSING_OVERLAP_CHECK_ELIGIBILITY",
      field: "decision_basis.overlap_check",
      detail: "performed (boolean) must be explicitly authored",
    });
  } else {
    for (const relatedId of asList(overlapCheck.related_problems)) {
      if (!isNonEmptyString(relatedId)) continue;
      if (!problemsById.has(relatedId)) {
        findings.push({
          code: "UNKNOWN_RELATED_PROBLEM_REFERENCE",
          field: "decision_basis.overlap_check.related_problems",
          detail: `${relatedId} does not exist`,
        });
      }
    }
    if (overlapCheck.performed === false) {
      findings.push({
        code: "OVERLAP_CHECK_NOT_PERFORMED",
        field: "decision_basis.overlap_check.performed",
        detail: "explicitly recorded as not performed; not ready for the promotion gate",
      });
    }
  }

  return {
    result: findings.length === 0 ? READY.ELIGIBILITY : REVIEW_REQUIRED,
    reasons: findings,
  };
}

/**
 * scope.bounded is an explicit human-authored boolean — never inferred from
 * the wording of geography/population/temporal, from boundary_evidence, or
 * from contradiction_search. Its absence is itself REVIEW_REQUIRED (not a
 * default-false reading); when bounded is explicitly true, limitations
 * must be authored. This gates Corroboration only
 * (docs/investigationstrategy.md §6) — Eligibility does not require scope
 * at all.
 */
function checkScopeAndBoundedness(db: Record<string, unknown>, findings: ReadinessFinding[]): void {
  const scope = db.scope as Record<string, unknown> | undefined;
  if (!scope || !isNonEmptyString(scope.geography) || !isNonEmptyString(scope.population) || !isNonEmptyString(scope.temporal)) {
    findings.push({
      code: "MISSING_SCOPE",
      field: "decision_basis.scope",
      detail: "geography, population, and temporal must all be explicitly authored",
    });
    return;
  }
  if (scope.bounded !== true && scope.bounded !== false) {
    findings.push({
      code: "MISSING_SCOPE_BOUNDED",
      field: "decision_basis.scope.bounded",
      detail: "scope.bounded must be explicitly authored as true or false",
    });
    return;
  }
  if (scope.bounded === true && !isNonEmptyString(db.limitations)) {
    findings.push({
      code: "BOUNDED_SCOPE_WITHOUT_LIMITATIONS",
      field: "decision_basis.limitations",
      detail: "scope.bounded is true but decision_basis.limitations is not authored",
    });
  }
}

/**
 * Structural (not semantic) consistency check: if contradiction_search.
 * performed is false, no contradiction/current-state evidence should be
 * cited (nothing to cite for a search that was not performed). If
 * performed is true, cited evidence IDs must resolve (already checked by
 * checkEvidenceRefs) — this only catches the performed=false vs.
 * non-empty evidence-list mismatch, a structural contradiction in the
 * record itself.
 */
function checkContradictionEvidenceConsistency(
  contradictionSearch: Record<string, unknown>,
  findings: ReadinessFinding[]
): void {
  if (
    contradictionSearch.performed === false &&
    asList(contradictionSearch.evidence).filter(isNonEmptyString).length > 0
  ) {
    findings.push({
      code: "CONTRADICTION_EVIDENCE_STRUCTURALLY_INCONSISTENT",
      field: "decision_basis.contradiction_search",
      detail: "performed=false but evidence is non-empty",
    });
  }
}

// ---- corroboration --------------------------------------------------------------

export function evaluateCorroboration(prbId: string, index: CorpusIndex): CorroborationReadiness {
  const problemsById = byId(index, "PRB-");
  const evidenceById = byId(index, "EVD-");
  const prb = problemsById.get(prbId)!;
  const db = prb.decision_basis as Record<string, unknown> | undefined | null;
  const findings: ReadinessFinding[] = [];

  if (db === undefined || db === null) {
    findings.push({ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" });
    return { result: REVIEW_REQUIRED, reasons: findings };
  }

  const prbEvidence = new Set(asList(prb.evidence).map((entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Record<string, unknown>).evidence_id : undefined).filter(isNonEmptyString) as string[]);

  if (!isNonEmptyString(db.contract_version)) {
    findings.push({ code: "MISSING_CONTRACT_VERSION", field: "decision_basis.contract_version" });
  }

  if (!isNonEmptyString(db.corroboration_basis)) {
    findings.push({ code: "MISSING_CORROBORATION_BASIS", field: "decision_basis.corroboration_basis" });
  }

  const currentness = db.currentness as Record<string, unknown> | undefined;
  if (!currentness || !isNonEmptyString(currentness.assessment)) {
    findings.push({ code: "MISSING_CURRENTNESS_CORROBORATION", field: "decision_basis.currentness.assessment" });
  } else {
    checkEvidenceRefs(
      "decision_basis.currentness.evidence",
      currentness.evidence,
      evidenceById,
      prbEvidence,
      "UNKNOWN_EVIDENCE_REFERENCE",
      "EVIDENCE_NOT_LINKED_TO_PRB",
      findings
    );
  }

  const contradictionSearch = db.contradiction_search as Record<string, unknown> | undefined;
  if (
    !contradictionSearch ||
    (contradictionSearch.performed !== true && contradictionSearch.performed !== false) ||
    !isNonEmptyString(contradictionSearch.summary)
  ) {
    findings.push({
      code: "MISSING_CONTRADICTION_SEARCH_CORROBORATION",
      field: "decision_basis.contradiction_search",
      detail: "performed (boolean) and summary must both be explicitly authored",
    });
  } else {
    checkEvidenceRefs(
      "decision_basis.contradiction_search.evidence",
      contradictionSearch.evidence,
      evidenceById,
      prbEvidence,
      "UNKNOWN_EVIDENCE_REFERENCE",
      "EVIDENCE_NOT_LINKED_TO_PRB",
      findings
    );
    checkContradictionEvidenceConsistency(contradictionSearch, findings);
    if (contradictionSearch.performed === false) {
      findings.push({
        code: "CONTRADICTION_SEARCH_NOT_PERFORMED_CORROBORATION",
        field: "decision_basis.contradiction_search.performed",
        detail: "explicitly recorded as not performed; not ready for the corroboration gate",
      });
    }
  }

  if (!isNonEmptyString(db.corroboration_statement)) {
    findings.push({ code: "MISSING_CORROBORATION_STATEMENT", field: "decision_basis.corroboration_statement" });
  } else if (db.corroboration_statement !== prb.problem_statement) {
    findings.push({
      code: "STALE_CORROBORATION_STATEMENT",
      field: "decision_basis.corroboration_statement",
      detail: "does not match the current PRB.problem_statement snapshot",
    });
  }

  const supportingEvidence = asList(db.supporting_evidence).filter(isNonEmptyString) as string[];
  if (supportingEvidence.length === 0) {
    findings.push({ code: "MISSING_SUPPORTING_EVIDENCE", field: "decision_basis.supporting_evidence" });
  } else {
    checkEvidenceRefs(
      "decision_basis.supporting_evidence",
      db.supporting_evidence,
      evidenceById,
      prbEvidence,
      "UNKNOWN_EVIDENCE_REFERENCE",
      "EVIDENCE_NOT_LINKED_TO_PRB",
      findings
    );
  }

  checkEvidenceRefs(
    "decision_basis.boundary_evidence",
    db.boundary_evidence,
    evidenceById,
    prbEvidence,
    "UNKNOWN_BOUNDARY_EVIDENCE_REFERENCE",
    "BOUNDARY_EVIDENCE_NOT_LINKED_TO_PRB",
    findings
  );

  if (!isNonEmptyString(db.independence_assessment)) {
    findings.push({ code: "MISSING_INDEPENDENCE_ASSESSMENT", field: "decision_basis.independence_assessment" });
  } else {
    checkLineageStructurallyAvailable(supportingEvidence, evidenceById, findings);
  }

  checkScopeAndBoundedness(db, findings);

  return {
    result: findings.length === 0 ? READY.CORROBORATION : REVIEW_REQUIRED,
    reasons: findings,
  };
}

/**
 * "Lineage information required by the authored corroboration basis is
 * structurally available" — when a researcher has explicitly authored
 * independence_assessment, this checks only that lineage data is
 * structurally inspectable for the cited supporting evidence: every valid,
 * PRB-linked supporting_evidence ID must resolve to an EVD-* record that
 * exists (already true by this point) and, when it carries an analysis
 * record, that lineage_id is either absent (UNASSESSED —
 * explicitly allowed) or a non-empty string — never a malformed/empty-
 * string placeholder that would silently break lineage-based counting.
 * This never infers or asserts independence itself.
 */
function checkLineageStructurallyAvailable(
  supportingEvidenceIds: string[],
  evidenceById: ReadonlyMap<string, RecordFields>,
  findings: ReadinessFinding[]
): void {
  for (const evdId of supportingEvidenceIds) {
    const evd = evidenceById.get(evdId);
    if (!evd) continue; // already reported as UNKNOWN_EVIDENCE_REFERENCE
    const lineageId = evd.lineage_id;
    if (lineageId !== undefined && lineageId !== null && !isNonEmptyString(lineageId)) {
      findings.push({
        code: "LINEAGE_REQUIREMENT_NOT_STRUCTURALLY_AVAILABLE",
        field: "decision_basis.supporting_evidence",
        detail: `${evdId}.lineage_id is present but empty/whitespace-only`,
      });
    }
  }
}

// ---- entry point --------------------------------------------------------------

/**
 * Evaluates one PRB-* record's Eligibility and Corroboration readiness
 * from an already-loaded CorpusIndex, or null if prbId does not resolve to
 * a canonical record in the given index. Callers are responsible for
 * validating the corpus first (see ../validation/validate.ts); this
 * function performs no validation of its own and assumes referential
 * integrity already holds (consistent with computeProblemAnalysis in
 * ../analysis/analyze.ts).
 */
export function evaluateProblem(prbId: string, index: CorpusIndex): ReadinessReport | null {
  const problemsById = byId(index, "PRB-");
  if (!problemsById.has(prbId)) return null;
  return {
    problem_id: prbId,
    eligibility: evaluateEligibility(prbId, index),
    corroboration: evaluateCorroboration(prbId, index),
  };
}

/** Evaluates readiness for every PRB-* record in the corpus, sorted by problem_id. */
export function evaluateCorpus(index: CorpusIndex): ReadinessReport[] {
  const problemsById = byId(index, "PRB-");
  return [...problemsById.keys()].sort().map((prbId) => evaluateProblem(prbId, index)!);
}
