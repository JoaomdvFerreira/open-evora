#!/usr/bin/env node
/**
 * IPE-02 — deterministic decision verifier
 * (docs/discovery/investigation-promotion-engine.md).
 *
 * Evaluates the explicitly authored PRB.decision_basis and returns structured,
 * deterministic results for two independent questions:
 *
 *   1. PRB Eligibility     — READY_FOR_PROMOTION_GATE | REVIEW_REQUIRED
 *   2. Corroboration       — READY_FOR_CORROBORATION_GATE | REVIEW_REQUIRED
 *
 * This checks only that an explicit basis is present, structurally well-formed, and
 * internally consistent — never whether the problem is real, whether evidence is
 * sufficient, whether sources are independent, causality, prevalence, civic importance,
 * or whether promotion/corroboration should be approved. Those remain human judgement
 * recorded in PRB-* / ASM-* (see docs/discovery/investigation-promotion-engine.md §4.4).
 *
 * Every PRB is evaluated the same way regardless of its current validation_status/
 * evidence_status: a PRB with no decision_basis is always REVIEW_REQUIRED /
 * NO_DECISION_BASIS for both questions, never READY. There is no "not applicable"
 * state — decision_basis is optional to author (IPE-01 §3), but once IPE-02 is asked
 * to evaluate a PRB, "no explicit basis on record" is itself the review-required
 * finding, not an exemption from the question.
 *
 * Usage:
 *   node tools/evaluate-research-decisions.js --problem PRB-XXXX
 *   node tools/evaluate-research-decisions.js --all
 *   (optional: --dir <researchRoot> to point at a fixture tree instead of research/)
 *   (optional: --json for machine-readable output)
 *
 * Exit code 0 = report produced; 1 = corpus fails validation or usage error.
 */

const path = require("path");
const { validateResearchTree } = require("./validate-research.js");

// ---- stable reason codes ----------------------------------------------------

const REASON = {
  NO_DECISION_BASIS: "NO_DECISION_BASIS",
  MISSING_ELIGIBILITY_BASIS: "MISSING_ELIGIBILITY_BASIS",
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
  MISSING_REQUIRED_ASM: "MISSING_REQUIRED_ASM",
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

const READY = {
  ELIGIBILITY: "READY_FOR_PROMOTION_GATE",
  CORROBORATION: "READY_FOR_CORROBORATION_GATE",
};
const REVIEW_REQUIRED = "REVIEW_REQUIRED";

// ---- helpers -----------------------------------------------------------------

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

function asList(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Evidence is "linked to the target PRB" when its ID appears in that PRB's own
 * `evidence` list — the one existing, already-validated PRB<->EVD link. This does not
 * rely on EVD.analysis.related_problems, which stays optional/lazily-populated
 * (docs/discovery/d3-execution-protocol.md §4) and so cannot be relied on as a
 * completeness signal.
 */
function checkEvidenceRefs(fieldPath, evdIds, corpus, prbId, unknownCode, unlinkedCode, findings) {
  const prbEvidence = new Set(asList(corpus.problemsById.get(prbId).record.evidence));
  for (const evdId of asList(evdIds)) {
    if (!isNonEmptyString(evdId)) continue;
    if (!corpus.evidenceById.has(evdId)) {
      findings.push({ code: unknownCode, field: fieldPath, detail: `${evdId} does not exist` });
      continue;
    }
    if (!prbEvidence.has(evdId)) {
      findings.push({
        code: unlinkedCode,
        field: fieldPath,
        detail: `${evdId} exists but is not linked to ${prbId} (not present in ${prbId}.evidence)`,
      });
    }
  }
}

// ---- eligibility --------------------------------------------------------------

function evaluateEligibility(prbId, corpus) {
  const prb = corpus.problemsById.get(prbId).record;
  const db = prb.decision_basis;
  const findings = [];

  if (db === undefined || db === null) {
    findings.push({ code: REASON.NO_DECISION_BASIS, detail: "PRB.decision_basis is absent" });
    return { result: REVIEW_REQUIRED, reasons: findings };
  }

  if (!isNonEmptyString(db.contract_version)) {
    findings.push({ code: REASON.MISSING_CONTRACT_VERSION, field: "decision_basis.contract_version" });
  }

  if (!isNonEmptyString(db.eligibility_basis)) {
    findings.push({ code: REASON.MISSING_ELIGIBILITY_BASIS, field: "decision_basis.eligibility_basis" });
  }

  const manifestation = db.manifestation;
  if (!manifestation || !isNonEmptyString(manifestation.kind) || !isNonEmptyString(manifestation.summary)) {
    findings.push({ code: REASON.MISSING_MANIFESTATION, field: "decision_basis.manifestation" });
  } else {
    checkEvidenceRefs(
      "decision_basis.manifestation.evidence",
      manifestation.evidence,
      corpus,
      prbId,
      REASON.UNKNOWN_EVIDENCE_REFERENCE,
      REASON.EVIDENCE_NOT_LINKED_TO_PRB,
      findings
    );
    if (asList(manifestation.evidence).filter(isNonEmptyString).length === 0) {
      findings.push({
        code: REASON.MISSING_MANIFESTATION_EVIDENCE,
        field: "decision_basis.manifestation.evidence",
        detail: "no non-empty EVD-* reference cited",
      });
    }
  }

  const consequence = db.consequence;
  if (!consequence || !isNonEmptyString(consequence.summary)) {
    findings.push({ code: REASON.MISSING_CONSEQUENCE, field: "decision_basis.consequence.summary" });
  } else {
    checkEvidenceRefs(
      "decision_basis.consequence.evidence",
      consequence.evidence,
      corpus,
      prbId,
      REASON.UNKNOWN_EVIDENCE_REFERENCE,
      REASON.EVIDENCE_NOT_LINKED_TO_PRB,
      findings
    );
    if (asList(consequence.evidence).filter(isNonEmptyString).length === 0) {
      findings.push({
        code: REASON.MISSING_CONSEQUENCE_EVIDENCE,
        field: "decision_basis.consequence.evidence",
        detail: "no non-empty EVD-* reference cited",
      });
    }
  }

  const currentness = db.currentness;
  if (!currentness || !isNonEmptyString(currentness.assessment)) {
    findings.push({ code: REASON.MISSING_CURRENTNESS, field: "decision_basis.currentness.assessment" });
  } else {
    checkEvidenceRefs(
      "decision_basis.currentness.evidence",
      currentness.evidence,
      corpus,
      prbId,
      REASON.UNKNOWN_EVIDENCE_REFERENCE,
      REASON.EVIDENCE_NOT_LINKED_TO_PRB,
      findings
    );
  }

  const contradictionSearch = db.contradiction_search;
  if (
    !contradictionSearch ||
    (contradictionSearch.performed !== true && contradictionSearch.performed !== false) ||
    !isNonEmptyString(contradictionSearch.summary)
  ) {
    findings.push({
      code: REASON.MISSING_CONTRADICTION_SEARCH,
      field: "decision_basis.contradiction_search",
      detail: "performed (boolean) and summary must both be explicitly authored",
    });
  } else {
    checkEvidenceRefs(
      "decision_basis.contradiction_search.evidence",
      contradictionSearch.evidence,
      corpus,
      prbId,
      REASON.UNKNOWN_EVIDENCE_REFERENCE,
      REASON.EVIDENCE_NOT_LINKED_TO_PRB,
      findings
    );
    checkContradictionEvidenceConsistency(contradictionSearch, corpus, prbId, findings);
    if (contradictionSearch.performed === false) {
      findings.push({
        code: REASON.CONTRADICTION_SEARCH_NOT_PERFORMED,
        field: "decision_basis.contradiction_search.performed",
        detail: "explicitly recorded as not performed; not ready for the promotion gate",
      });
    }
  }

  const overlapCheck = db.overlap_check;
  if (!overlapCheck || (overlapCheck.performed !== true && overlapCheck.performed !== false)) {
    findings.push({
      code: REASON.MISSING_OVERLAP_CHECK_ELIGIBILITY,
      field: "decision_basis.overlap_check",
      detail: "performed (boolean) must be explicitly authored",
    });
  } else {
    for (const relatedId of asList(overlapCheck.related_problems)) {
      if (!isNonEmptyString(relatedId)) continue;
      if (!corpus.problemsById.has(relatedId)) {
        findings.push({
          code: REASON.UNKNOWN_RELATED_PROBLEM_REFERENCE,
          field: "decision_basis.overlap_check.related_problems",
          detail: `${relatedId} does not exist`,
        });
      }
    }
    if (overlapCheck.performed === false) {
      findings.push({
        code: REASON.OVERLAP_CHECK_NOT_PERFORMED,
        field: "decision_basis.overlap_check.performed",
        detail: "explicitly recorded as not performed; not ready for the promotion gate",
      });
    }
  }

  checkRequiredAsmDependency(prbId, corpus, findings);

  return {
    result: findings.length === 0 ? READY.ELIGIBILITY : REVIEW_REQUIRED,
    reasons: findings,
  };
}

/**
 * scope.bounded is an explicit human-authored boolean (IPE-02 contract clarification,
 * docs/discovery/investigation-promotion-engine.md §10) — never inferred from the
 * wording of geography/population/temporal, from boundary_evidence, or from
 * contradiction_search. Its absence is itself REVIEW_REQUIRED (not a default-false
 * reading); when bounded is explicitly true, limitations must be authored. This gates
 * Corroboration only (§10) — Eligibility does not require scope at all.
 */
function checkScopeAndBoundedness(db, findings) {
  const scope = db.scope;
  if (!scope || !isNonEmptyString(scope.geography) || !isNonEmptyString(scope.population) || !isNonEmptyString(scope.temporal)) {
    findings.push({
      code: REASON.MISSING_SCOPE,
      field: "decision_basis.scope",
      detail: "geography, population, and temporal must all be explicitly authored",
    });
    return;
  }
  if (scope.bounded !== true && scope.bounded !== false) {
    findings.push({
      code: REASON.MISSING_SCOPE_BOUNDED,
      field: "decision_basis.scope.bounded",
      detail: "scope.bounded must be explicitly authored as true or false",
    });
    return;
  }
  if (scope.bounded === true && !isNonEmptyString(db.limitations)) {
    findings.push({
      code: REASON.BOUNDED_SCOPE_WITHOUT_LIMITATIONS,
      field: "decision_basis.limitations",
      detail: "scope.bounded is true but decision_basis.limitations is not authored",
    });
  }
}

/**
 * Structural (not semantic) consistency check: if contradiction_search.performed is
 * false, no contradiction/current-state evidence should be cited (nothing to cite for a
 * search that was not performed). If performed is true, cited evidence IDs must resolve
 * (already checked by checkEvidenceRefs) — this only catches the performed=false vs.
 * non-empty evidence-list mismatch, a structural contradiction in the record itself.
 */
function checkContradictionEvidenceConsistency(contradictionSearch, corpus, prbId, findings) {
  if (
    contradictionSearch.performed === false &&
    asList(contradictionSearch.evidence).filter(isNonEmptyString).length > 0
  ) {
    findings.push({
      code: REASON.CONTRADICTION_EVIDENCE_STRUCTURALLY_INCONSISTENT,
      field: "decision_basis.contradiction_search",
      detail: "performed=false but evidence is non-empty",
    });
  }
}

/**
 * IPE-01 §9 leaves required ASM/reference dependencies as an open design question; this
 * verifier's minimal interpretation of "relevant ASM/reference dependencies required by
 * the contract" is: a PRB whose decision_basis asserts validated/partially_validated
 * eligibility must have at least one ASM-* record on file (docs/models/assessment-model.md
 * — "One active ASM-* is intended per canonical active PRB-*"). This does not require the
 * ASM's assessment_status, triage, or any gate value — those remain human judgement.
 */
function checkRequiredAsmDependency(prbId, corpus, findings) {
  const asmRecords = corpus.assessmentsByProblem.get(prbId) || [];
  if (asmRecords.length === 0) {
    findings.push({
      code: REASON.MISSING_REQUIRED_ASM,
      field: "assessments",
      detail: `no ASM-* record references ${prbId}`,
    });
  }
}

// ---- corroboration --------------------------------------------------------------

function evaluateCorroboration(prbId, corpus) {
  const prb = corpus.problemsById.get(prbId).record;
  const db = prb.decision_basis;
  const findings = [];

  if (db === undefined || db === null) {
    findings.push({ code: REASON.NO_DECISION_BASIS, detail: "PRB.decision_basis is absent" });
    return { result: REVIEW_REQUIRED, reasons: findings };
  }

  if (!isNonEmptyString(db.contract_version)) {
    findings.push({ code: REASON.MISSING_CONTRACT_VERSION, field: "decision_basis.contract_version" });
  }

  if (!isNonEmptyString(db.corroboration_basis)) {
    findings.push({ code: REASON.MISSING_CORROBORATION_BASIS, field: "decision_basis.corroboration_basis" });
  }

  const currentness = db.currentness;
  if (!currentness || !isNonEmptyString(currentness.assessment)) {
    findings.push({ code: REASON.MISSING_CURRENTNESS_CORROBORATION, field: "decision_basis.currentness.assessment" });
  } else {
    checkEvidenceRefs(
      "decision_basis.currentness.evidence",
      currentness.evidence,
      corpus,
      prbId,
      REASON.UNKNOWN_EVIDENCE_REFERENCE,
      REASON.EVIDENCE_NOT_LINKED_TO_PRB,
      findings
    );
  }

  const contradictionSearch = db.contradiction_search;
  if (
    !contradictionSearch ||
    (contradictionSearch.performed !== true && contradictionSearch.performed !== false) ||
    !isNonEmptyString(contradictionSearch.summary)
  ) {
    findings.push({
      code: REASON.MISSING_CONTRADICTION_SEARCH_CORROBORATION,
      field: "decision_basis.contradiction_search",
      detail: "performed (boolean) and summary must both be explicitly authored",
    });
  } else {
    checkEvidenceRefs(
      "decision_basis.contradiction_search.evidence",
      contradictionSearch.evidence,
      corpus,
      prbId,
      REASON.UNKNOWN_EVIDENCE_REFERENCE,
      REASON.EVIDENCE_NOT_LINKED_TO_PRB,
      findings
    );
    checkContradictionEvidenceConsistency(contradictionSearch, corpus, prbId, findings);
    if (contradictionSearch.performed === false) {
      findings.push({
        code: REASON.CONTRADICTION_SEARCH_NOT_PERFORMED_CORROBORATION,
        field: "decision_basis.contradiction_search.performed",
        detail: "explicitly recorded as not performed; not ready for the corroboration gate",
      });
    }
  }

  if (!isNonEmptyString(db.corroboration_statement)) {
    findings.push({ code: REASON.MISSING_CORROBORATION_STATEMENT, field: "decision_basis.corroboration_statement" });
  } else if (db.corroboration_statement !== prb.problem_statement) {
    findings.push({
      code: REASON.STALE_CORROBORATION_STATEMENT,
      field: "decision_basis.corroboration_statement",
      detail: "does not match the current PRB.problem_statement snapshot",
    });
  }

  const supportingEvidence = asList(db.supporting_evidence).filter(isNonEmptyString);
  if (supportingEvidence.length === 0) {
    findings.push({ code: REASON.MISSING_SUPPORTING_EVIDENCE, field: "decision_basis.supporting_evidence" });
  } else {
    checkEvidenceRefs(
      "decision_basis.supporting_evidence",
      db.supporting_evidence,
      corpus,
      prbId,
      REASON.UNKNOWN_EVIDENCE_REFERENCE,
      REASON.EVIDENCE_NOT_LINKED_TO_PRB,
      findings
    );
  }

  checkEvidenceRefs(
    "decision_basis.boundary_evidence",
    db.boundary_evidence,
    corpus,
    prbId,
    REASON.UNKNOWN_BOUNDARY_EVIDENCE_REFERENCE,
    REASON.BOUNDARY_EVIDENCE_NOT_LINKED_TO_PRB,
    findings
  );

  if (!isNonEmptyString(db.independence_assessment)) {
    findings.push({ code: REASON.MISSING_INDEPENDENCE_ASSESSMENT, field: "decision_basis.independence_assessment" });
  } else {
    checkLineageStructurallyAvailable(supportingEvidence, corpus, findings);
  }

  checkScopeAndBoundedness(db, findings);

  checkRequiredAsmDependency(prbId, corpus, findings);

  return {
    result: findings.length === 0 ? READY.CORROBORATION : REVIEW_REQUIRED,
    reasons: findings,
  };
}

/**
 * "Lineage information required by the authored corroboration basis is structurally
 * available" — when a researcher has explicitly authored independence_assessment, this
 * checks only that lineage data is structurally inspectable for the cited supporting
 * evidence: every valid, PRB-linked supporting_evidence ID must resolve to an EVD-* record
 * that exists (already true by this point) and, when it carries an analysis block, that
 * analysis.lineage_id is either absent (UNASSESSED — explicitly allowed,
 * docs/discovery/d3-execution-protocol.md §4.2) or a non-empty string — never a
 * malformed/empty-string placeholder that would silently break lineage-based counting.
 * This never infers or asserts independence itself.
 */
function checkLineageStructurallyAvailable(supportingEvidenceIds, corpus, findings) {
  for (const evdId of supportingEvidenceIds) {
    const evdEntry = corpus.evidenceById.get(evdId);
    if (!evdEntry) continue; // already reported as UNKNOWN_EVIDENCE_REFERENCE
    const analysis = evdEntry.record.analysis;
    if (!analysis) continue;
    const lineageId = analysis.lineage_id;
    if (lineageId !== undefined && lineageId !== null && !isNonEmptyString(lineageId)) {
      findings.push({
        code: REASON.LINEAGE_REQUIREMENT_NOT_STRUCTURALLY_AVAILABLE,
        field: "decision_basis.supporting_evidence",
        detail: `${evdId}.analysis.lineage_id is present but empty/whitespace-only`,
      });
    }
  }
}

// ---- corpus loading (shared with analyze-research.js conventions) --------------

function loadCorpus(researchRoot) {
  const { errors, totalRecords, parsedByDir } = validateResearchTree(researchRoot);
  if (errors.length > 0) {
    console.error(
      `Cannot evaluate: research corpus fails validation (${errors.length} problem(s)). Run node tools/validate-research.js for details.`
    );
    process.exitCode = 1;
    return null;
  }

  const problems = (parsedByDir.get("PRB-") || { parsed: [] }).parsed;
  const evidence = (parsedByDir.get("EVD-") || { parsed: [] }).parsed;
  const assessments = (parsedByDir.get("ASM-") || { parsed: [] }).parsed;

  const problemsById = new Map(problems.map((p) => [p.record.problem_id, p]));
  const evidenceById = new Map(evidence.map((e) => [e.record.evidence_id, e]));
  const assessmentsByProblem = new Map();
  for (const a of assessments) {
    const pid = a.record.problem;
    if (!assessmentsByProblem.has(pid)) assessmentsByProblem.set(pid, []);
    assessmentsByProblem.get(pid).push(a);
  }

  return { totalRecords, problems, evidence, assessments, problemsById, evidenceById, assessmentsByProblem };
}

function evaluateProblem(prbId, corpus) {
  if (!corpus.problemsById.has(prbId)) return null;
  return {
    problem_id: prbId,
    eligibility: evaluateEligibility(prbId, corpus),
    corroboration: evaluateCorroboration(prbId, corpus),
  };
}

// ---- output -----------------------------------------------------------------

function formatReasons(reasons) {
  return reasons
    .map((r) => (r.field ? `${r.code} [${r.field}]${r.detail ? ` — ${r.detail}` : ""}` : `${r.code}${r.detail ? ` — ${r.detail}` : ""}`))
    .join("; ");
}

function printReport(report) {
  console.log(report.problem_id);
  const elig = report.eligibility;
  const corr = report.corroboration;
  console.log(`  eligibility:    ${elig.result}`);
  if (elig.reasons.length > 0) console.log(`    ${formatReasons(elig.reasons)}`);
  console.log(`  corroboration:  ${corr.result}`);
  if (corr.reasons.length > 0) console.log(`    ${formatReasons(corr.reasons)}`);
}

function main() {
  const args = process.argv.slice(2);
  const dirFlagIdx = args.indexOf("--dir");
  const researchRoot =
    dirFlagIdx !== -1 && args[dirFlagIdx + 1]
      ? path.resolve(args[dirFlagIdx + 1])
      : path.resolve(__dirname, "..", "research");

  const problemFlagIdx = args.indexOf("--problem");
  const hasAll = args.includes("--all");
  const hasProblem = problemFlagIdx !== -1;
  const asJson = args.includes("--json");

  if (!hasAll && !hasProblem) {
    console.error(
      "Usage: node tools/evaluate-research-decisions.js --problem <PRB-ID> | --all [--dir <researchRoot>] [--json]"
    );
    process.exitCode = 1;
    return;
  }

  const corpus = loadCorpus(researchRoot);
  if (!corpus) return;

  let reports;
  if (hasAll) {
    reports = [...corpus.problemsById.keys()].sort().map((prbId) => evaluateProblem(prbId, corpus));
  } else {
    const prbId = args[problemFlagIdx + 1];
    const report = evaluateProblem(prbId, corpus);
    if (!report) {
      console.error(`Unknown problem: "${prbId}" does not resolve to a canonical PRB-* record.`);
      process.exitCode = 1;
      return;
    }
    reports = [report];
  }

  if (asJson) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    for (const report of reports) {
      printReport(report);
      console.log("");
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  REASON,
  READY,
  REVIEW_REQUIRED,
  loadCorpus,
  evaluateProblem,
  evaluateEligibility,
  evaluateCorroboration,
};
