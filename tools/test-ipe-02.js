#!/usr/bin/env node
/**
 * Focused tests for IPE-02 (deterministic decision verifier,
 * tools/evaluate-research-decisions.js): PRB Eligibility and Corroboration structural
 * checks over an explicitly authored decision_basis.
 *
 * Zero-dependency: uses only Node's built-in assert/fs/os/path, matching
 * tools/validate-research.js's no-external-dependency convention. Fixtures are
 * generated into a temporary directory per test and discarded — nothing here touches
 * or backfills the canonical research/ corpus (no canonical PRB carries a
 * decision_basis, so every scenario needs synthetic fixture data).
 *
 * Usage: node tools/test-ipe-02.js
 * Exit code 0 = all tests passed, 1 = at least one failure.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  evaluateProblem,
  evaluateEligibility,
  evaluateCorroboration,
  loadCorpus,
  REASON,
  READY,
  REVIEW_REQUIRED,
} = require("./evaluate-research-decisions.js");

const REAL_SCHEMAS_DIR = path.resolve(__dirname, "..", "research", "schemas");
const DIRS = ["sources", "evidence", "problems", "hypotheses", "assessments", "schemas"];

function makeFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evora-ipe02-"));
  for (const d of DIRS) fs.mkdirSync(path.join(root, d), { recursive: true });
  for (const f of fs.readdirSync(REAL_SCHEMAS_DIR)) {
    fs.copyFileSync(path.join(REAL_SCHEMAS_DIR, f), path.join(root, "schemas", f));
  }
  return root;
}

function write(root, dir, filename, content) {
  fs.writeFileSync(path.join(root, dir, filename), content, "utf8");
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

function evd(id, { lineageId } = {}) {
  return `
evidence_id: ${id}
type: observation
source:
  publisher: "Fixture Publisher"
  title: "Fixture Source"
  source_reference: "https://example.invalid/fixture"
  published_at: null
  retrieved_at: "2026-08-11"
geography:
  level: municipality
  area: "Fixture area"
population: [example-population]
domain: [example]
observation:
  summary: "Fixture observation."
evidence_nature: claim
strength: anecdotal
personal_data:
  present: false
  retained: false
notes: "Fixture only."
${lineageId !== undefined ? `analysis:\n  lineage_id: "${lineageId}"\n` : ""}
`;
}

const PROBLEM_STATEMENT = "Fixture statement for verifier testing.";

function prb({
  id = "PRB-9001",
  evidenceIds = ["EVD-900101"],
  evidenceStatus = "discovered",
  validationStatus = "unvalidated",
  decisionBasis = "",
} = {}) {
  return `
problem_id: ${id}
title: "Fixture problem"
domain: [example]
geography:
  level: municipality
affected_populations: [residents]
problem_statement: "${PROBLEM_STATEMENT}"
evidence: [${evidenceIds.join(", ")}]
evidence_status: ${evidenceStatus}
validation_status: ${validationStatus}
digital_tractability: not_assessed
existing_solutions: not_assessed
status: OPEN
${decisionBasis}
`;
}

function asm(id, problemId) {
  return `
assessment_id: ${id}
problem: ${problemId}
as_of: "2026-08-11"
phase: D3
assessment_status: CURRENT
evidence_confidence:
  overall: UNKNOWN
  independence: UNKNOWN
  coherence: UNKNOWN
  adequacy: UNKNOWN
  relevance: UNKNOWN
  currentness: UNKNOWN
  contradiction_status: UNKNOWN
  stakeholder_validation: PENDING
civic_importance:
  reach: UNKNOWN
  frequency: UNKNOWN
  severity: UNKNOWN
  persistence: UNKNOWN
  equity: UNKNOWN
journey_understanding: UNKNOWN
causal_understanding: UNKNOWN
existing_solution_understanding: UNKNOWN
remaining_gap: UNKNOWN
digital_leverage: not_assessed
structure_action: KEEP
decision_gates:
  problem_real: UNKNOWN
  civic_importance: UNKNOWN
  journey_understood: UNKNOWN
  root_cause_understood: UNKNOWN
  remaining_gap_supported: UNKNOWN
  digital_causality: NOT_ASSESSED
  operability: NOT_ASSESSED
  testability: NOT_ASSESSED
triage: DEEPEN
next_action: "Fixture next action."
notes: ""
`;
}

function fullEligibilityBasis({
  includeManifestation = true,
  includeConsequence = true,
  includeScope = true,
  manifestationEvidence = "[EVD-900101]",
  bounded = false,
  includeBounded = true,
  limitations = "",
  contradictionPerformed = true,
  overlapPerformed = true,
  includeOverlapCheck = true,
} = {}) {
  return `
decision_basis:
  contract_version: "0.1"
  eligibility_basis: "Fixture eligibility reasoning."
${
  includeManifestation
    ? `  manifestation:
    kind: "access failure"
    summary: "Fixture manifestation."
    evidence: ${manifestationEvidence}
`
    : ""
}${
  includeConsequence
    ? `  consequence:
    summary: "Fixture consequence."
    evidence: [EVD-900101]
`
    : ""
}  currentness:
    assessment: "Fixture currentness call."
    evidence: [EVD-900101]
  contradiction_search:
    performed: ${contradictionPerformed}
    summary: "Contradiction/current-state search recorded."
    evidence: []
${
  includeOverlapCheck
    ? `  overlap_check:
    performed: ${overlapPerformed}
    summary: "Overlap/deduplication check recorded."
    related_problems: []
`
    : ""
}${
  includeScope
    ? `  scope:
    geography: "Fixture area"
    population: "residents"
    temporal: "2026"
${includeBounded ? `    bounded: ${bounded}\n` : ""}`
    : ""
}  limitations: "${limitations}"
`;
}

function fullCorroborationBasis({
  corroborationStatement = PROBLEM_STATEMENT,
  supportingEvidence = "[EVD-900101]",
  bounded = false,
  includeBounded = true,
  limitations = "",
  includeCorroborationBasis = true,
  includeScope = true,
  contradictionPerformed = true,
  overlapPerformed = true,
} = {}) {
  return `
decision_basis:
  contract_version: "0.1"
${includeCorroborationBasis ? `  corroboration_basis: "Fixture corroboration reasoning."\n` : ""}  overlap_check:
    performed: ${overlapPerformed}
    summary: "No overlap found."
    related_problems: []
  currentness:
    assessment: "Fixture currentness call."
    evidence: [EVD-900101]
  contradiction_search:
    performed: ${contradictionPerformed}
    summary: "Contradiction/current-state search recorded."
    evidence: []
  corroboration_statement: "${corroborationStatement}"
  supporting_evidence: ${supportingEvidence}
  boundary_evidence: []
  independence_assessment: "Fixture independence judgement."
${
  includeScope
    ? `  scope:
    geography: "Fixture area"
    population: "residents"
    temporal: "2026"
${includeBounded ? `    bounded: ${bounded}\n` : ""}`
    : ""
}  limitations: "${limitations}"
`;
}

function codesOf(reasons) {
  return reasons.map((r) => r.code);
}

function loadAndEvaluate(root, prbId) {
  const corpus = loadCorpus(root);
  assert.ok(corpus, "corpus failed to load/validate");
  return evaluateProblem(prbId, corpus);
}

// ---- test runner -----------------------------------------------------------

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ---- eligibility ------------------------------------------------------------

test("eligibility: unvalidated PRB with no decision_basis is still REVIEW_REQUIRED / NO_DECISION_BASIS (never READY)", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "unvalidated" }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.deepStrictEqual(codesOf(report.eligibility.reasons), [REASON.NO_DECISION_BASIS]);
  } finally {
    cleanup(root);
  }
});

test("eligibility: complete valid basis -> READY", () => {
  const root = makeFixtureRoot();
  try {
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis: fullEligibilityBasis() })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, READY.ELIGIBILITY, JSON.stringify(report.eligibility.reasons));
  } finally {
    cleanup(root);
  }
});

test("eligibility: no decision_basis at all -> REVIEW (NO_DECISION_BASIS)", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated" }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.NO_DECISION_BASIS));
  } finally {
    cleanup(root);
  }
});

test("eligibility: missing manifestation -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullEligibilityBasis({ includeManifestation: false });
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.MISSING_MANIFESTATION));
  } finally {
    cleanup(root);
  }
});

test("eligibility: missing consequence -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullEligibilityBasis({ includeConsequence: false });
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.MISSING_CONSEQUENCE));
  } finally {
    cleanup(root);
  }
});

// A decision_basis.*.evidence field referencing a non-existent EVD-* is already a
// schema-declared reference (research/schemas/problem.schema.json) enforced by
// validate-research.js's cross-reference check, so it is caught before the corpus ever
// reaches IPE-02 (loadCorpus refuses to proceed on a validation error). IPE-02 still
// carries its own redundant existence check as defense-in-depth; the two tests below
// exercise each layer directly.

test("eligibility: unknown EVD reference is caught by validate-research.js before IPE-02 runs", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullEligibilityBasis({ manifestationEvidence: "[EVD-999999]" });
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const corpus = loadCorpus(root);
    assert.strictEqual(corpus, null, "expected loadCorpus to refuse a corpus with a broken reference");
  } finally {
    cleanup(root);
  }
});

test("eligibility: IPE-02's own evidence-existence check flags an unknown EVD reference -> REVIEW", () => {
  // Directly exercises evaluateEligibility's redundant existence check against a
  // hand-built corpus, bypassing validate-research.js's cross-reference validation.
  const prbRecord = JSON.parse(
    JSON.stringify({
      problem_id: "PRB-9001",
      problem_statement: PROBLEM_STATEMENT,
      evidence: ["EVD-900101"],
      validation_status: "validated",
      decision_basis: {
        contract_version: "0.1",
        eligibility_basis: "Fixture eligibility reasoning.",
        manifestation: { kind: "access failure", summary: "Fixture manifestation.", evidence: ["EVD-999999"] },
        consequence: { summary: "Fixture consequence.", evidence: ["EVD-900101"] },
        currentness: { assessment: "Fixture currentness call.", evidence: [] },
        contradiction_search: { performed: true, summary: "None found.", evidence: [] },
        overlap_check: { performed: true, summary: "Checked.", related_problems: [] },
        scope: { geography: "Fixture area", population: "residents", temporal: "2026", bounded: false },
        limitations: "",
      },
    })
  );
  const corpus = {
    problemsById: new Map([["PRB-9001", { record: prbRecord }]]),
    evidenceById: new Map([["EVD-900101", { record: { evidence_id: "EVD-900101" } }]]),
    assessmentsByProblem: new Map([["PRB-9001", [{ record: { assessment_id: "ASM-9001" } }]]]),
  };
  const result = evaluateEligibility("PRB-9001", corpus);
  assert.strictEqual(result.result, REVIEW_REQUIRED);
  assert.ok(
    codesOf(result.reasons).includes(REASON.UNKNOWN_EVIDENCE_REFERENCE),
    JSON.stringify(result.reasons)
  );
});

test("eligibility: EVD exists but not linked to target PRB -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    // EVD-900102 exists in the corpus but is not in PRB-9001.evidence.
    const decisionBasis = fullEligibilityBasis({ manifestationEvidence: "[EVD-900102]" });
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "evidence", "EVD-900102.yaml", evd("EVD-900102"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.eligibility.reasons).includes(REASON.EVIDENCE_NOT_LINKED_TO_PRB),
      JSON.stringify(report.eligibility.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("eligibility: missing scope assessment -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullEligibilityBasis({ includeScope: false });
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.MISSING_SCOPE));
  } finally {
    cleanup(root);
  }
});

test("eligibility: bounded scope without limitations -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullEligibilityBasis({ bounded: true });
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.eligibility.reasons).includes(REASON.BOUNDED_SCOPE_WITHOUT_LIMITATIONS),
      JSON.stringify(report.eligibility.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("eligibility: bounded scope WITH limitations authored -> no BOUNDED_SCOPE finding", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullEligibilityBasis({
      bounded: true,
      limitations: "Only one parish was surveyed; not generalized further.",
    });
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.ok(
      !codesOf(report.eligibility.reasons).includes(REASON.BOUNDED_SCOPE_WITHOUT_LIMITATIONS),
      JSON.stringify(report.eligibility.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("eligibility: scope.bounded is never inferred from geography/population/temporal wording", () => {
  const root = makeFixtureRoot();
  try {
    // geography/population text contains "limited"/"partial" but scope.bounded is explicitly
    // false — must NOT trigger BOUNDED_SCOPE_WITHOUT_LIMITATIONS.
    const decisionBasis = fullEligibilityBasis().replace(
      'geography: "Fixture area"',
      'geography: "Fixture area (limited, partial coverage)"'
    );
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.ok(
      !codesOf(report.eligibility.reasons).includes(REASON.BOUNDED_SCOPE_WITHOUT_LIMITATIONS),
      JSON.stringify(report.eligibility.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("eligibility: missing required ASM -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis: fullEligibilityBasis() })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    // No ASM-* written.
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.MISSING_REQUIRED_ASM));
  } finally {
    cleanup(root);
  }
});

test("eligibility: contradiction_search.performed=false -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullEligibilityBasis({ contradictionPerformed: false });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.eligibility.reasons).includes(REASON.CONTRADICTION_SEARCH_NOT_PERFORMED),
      JSON.stringify(report.eligibility.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("eligibility: overlap_check missing -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullEligibilityBasis({ includeOverlapCheck: false });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.eligibility.reasons).includes(REASON.MISSING_OVERLAP_CHECK_ELIGIBILITY),
      JSON.stringify(report.eligibility.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("eligibility: overlap_check.performed=false -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullEligibilityBasis({ overlapPerformed: false });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.eligibility.reasons).includes(REASON.OVERLAP_CHECK_NOT_PERFORMED),
      JSON.stringify(report.eligibility.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("eligibility: manifestation evidence empty -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullEligibilityBasis({ manifestationEvidence: "[]" });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.eligibility.reasons).includes(REASON.MISSING_MANIFESTATION_EVIDENCE),
      JSON.stringify(report.eligibility.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("eligibility: consequence evidence empty -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const prbRecord = {
      problem_id: "PRB-9001",
      problem_statement: PROBLEM_STATEMENT,
      evidence: ["EVD-900101"],
      validation_status: "validated",
      decision_basis: {
        contract_version: "0.1",
        eligibility_basis: "Fixture eligibility reasoning.",
        manifestation: { kind: "access failure", summary: "Fixture manifestation.", evidence: ["EVD-900101"] },
        consequence: { summary: "Fixture consequence.", evidence: [] },
        currentness: { assessment: "Fixture currentness call.", evidence: [] },
        contradiction_search: { performed: true, summary: "None found.", evidence: [] },
        overlap_check: { performed: true, summary: "Checked.", related_problems: [] },
        scope: { geography: "Fixture area", population: "residents", temporal: "2026", bounded: false },
        limitations: "",
      },
    };
    const corpus = {
      problemsById: new Map([["PRB-9001", { record: prbRecord }]]),
      evidenceById: new Map([["EVD-900101", { record: { evidence_id: "EVD-900101" } }]]),
      assessmentsByProblem: new Map([["PRB-9001", [{ record: { assessment_id: "ASM-9001" } }]]]),
    };
    const result = evaluateEligibility("PRB-9001", corpus);
    assert.strictEqual(result.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(result.reasons).includes(REASON.MISSING_CONSEQUENCE_EVIDENCE),
      JSON.stringify(result.reasons)
    );
  } finally {
    // no fixture root used in this test
  }
});

test("eligibility: scope.bounded absent -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullEligibilityBasis({ includeBounded: false });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.eligibility.reasons).includes(REASON.MISSING_SCOPE_BOUNDED),
      JSON.stringify(report.eligibility.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("eligibility: complete valid basis with all new checks -> READY", () => {
  const root = makeFixtureRoot();
  try {
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis: fullEligibilityBasis() })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, READY.ELIGIBILITY, JSON.stringify(report.eligibility.reasons));
  } finally {
    cleanup(root);
  }
});

// ---- corroboration ------------------------------------------------------------

test("corroboration: discovered PRB with no decision_basis is still REVIEW_REQUIRED / NO_DECISION_BASIS (never READY)", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "discovered" }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.deepStrictEqual(codesOf(report.corroboration.reasons), [REASON.NO_DECISION_BASIS]);
  } finally {
    cleanup(root);
  }
});

test("corroboration: valid basis -> READY", () => {
  const root = makeFixtureRoot();
  try {
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ evidenceStatus: "corroborated", decisionBasis: fullCorroborationBasis() })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, READY.CORROBORATION, JSON.stringify(report.corroboration.reasons));
  } finally {
    cleanup(root);
  }
});

test("corroboration: stale corroboration_statement snapshot -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({
        evidenceStatus: "corroborated",
        decisionBasis: fullCorroborationBasis({ corroborationStatement: "A stale, no-longer-matching statement." }),
      })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.STALE_CORROBORATION_STATEMENT));
  } finally {
    cleanup(root);
  }
});

test("corroboration: currentness missing -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullCorroborationBasis().replace(
      /  currentness:\n    assessment: "Fixture currentness call\."\n    evidence: \[EVD-900101\]\n/,
      ""
    );
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.corroboration.reasons).includes(REASON.MISSING_CURRENTNESS_CORROBORATION),
      JSON.stringify(report.corroboration.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("corroboration: contradiction_search missing -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullCorroborationBasis().replace(
      /  contradiction_search:\n    performed: true\n    summary: "Contradiction\/current-state search recorded\."\n    evidence: \[\]\n/,
      ""
    );
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.corroboration.reasons).includes(REASON.MISSING_CONTRADICTION_SEARCH_CORROBORATION),
      JSON.stringify(report.corroboration.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("corroboration: contradiction_search.performed=false -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullCorroborationBasis({ contradictionPerformed: false });
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.corroboration.reasons).includes(REASON.CONTRADICTION_SEARCH_NOT_PERFORMED_CORROBORATION),
      JSON.stringify(report.corroboration.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("corroboration: overlap_check.performed=false -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullCorroborationBasis({ overlapPerformed: false });
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.corroboration.reasons).includes(REASON.OVERLAP_CHECK_NOT_PERFORMED),
      JSON.stringify(report.corroboration.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("corroboration: scope.bounded absent -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullCorroborationBasis({ includeBounded: false });
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.corroboration.reasons).includes(REASON.MISSING_SCOPE_BOUNDED),
      JSON.stringify(report.corroboration.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("corroboration: bounded=true + no limitations -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullCorroborationBasis({ bounded: true });
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.corroboration.reasons).includes(REASON.BOUNDED_SCOPE_WITHOUT_LIMITATIONS),
      JSON.stringify(report.corroboration.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("corroboration: invalid/missing lineage requirement -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ evidenceStatus: "corroborated", decisionBasis: fullCorroborationBasis() })
    );
    // lineage_id present but empty/whitespace-only — structurally broken, not "UNASSESSED".
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101", { lineageId: "   " }));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.corroboration.reasons).includes(REASON.LINEAGE_REQUIREMENT_NOT_STRUCTURALLY_AVAILABLE),
      JSON.stringify(report.corroboration.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("corroboration: lineage_id absent entirely (UNASSESSED) is structurally fine", () => {
  const root = makeFixtureRoot();
  try {
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ evidenceStatus: "corroborated", decisionBasis: fullCorroborationBasis() })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.ok(
      !codesOf(report.corroboration.reasons).includes(REASON.LINEAGE_REQUIREMENT_NOT_STRUCTURALLY_AVAILABLE),
      JSON.stringify(report.corroboration.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("corroboration: missing scope assessment -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullCorroborationBasis({ includeScope: false });
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ evidenceStatus: "corroborated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.MISSING_SCOPE));
  } finally {
    cleanup(root);
  }
});

test("corroboration: bounded scope without limitations -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullCorroborationBasis({ bounded: true });
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ evidenceStatus: "corroborated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(
      codesOf(report.corroboration.reasons).includes(REASON.BOUNDED_SCOPE_WITHOUT_LIMITATIONS),
      JSON.stringify(report.corroboration.reasons)
    );
  } finally {
    cleanup(root);
  }
});

test("corroboration: missing required ASM -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ evidenceStatus: "corroborated", decisionBasis: fullCorroborationBasis() })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    // No ASM-* written.
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.MISSING_REQUIRED_ASM));
  } finally {
    cleanup(root);
  }
});

test("corroboration: unknown EVD in supporting_evidence is caught by validate-research.js before IPE-02 runs", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullCorroborationBasis({ supportingEvidence: "[EVD-999999]" });
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ evidenceStatus: "corroborated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const corpus = loadCorpus(root);
    assert.strictEqual(corpus, null, "expected loadCorpus to refuse a corpus with a broken reference");
  } finally {
    cleanup(root);
  }
});

test("corroboration: IPE-02's own evidence-existence check flags an unknown EVD reference -> REVIEW", () => {
  const prbRecord = {
    problem_id: "PRB-9001",
    problem_statement: PROBLEM_STATEMENT,
    evidence: ["EVD-900101"],
    evidence_status: "corroborated",
    decision_basis: {
      contract_version: "0.1",
      corroboration_basis: "Fixture corroboration reasoning.",
      overlap_check: { performed: true, summary: "None found.", related_problems: [] },
      corroboration_statement: PROBLEM_STATEMENT,
      supporting_evidence: ["EVD-999999"],
      boundary_evidence: [],
      independence_assessment: "Fixture independence judgement.",
      scope: { geography: "Fixture area", population: "residents", temporal: "2026" },
      limitations: "",
    },
  };
  const corpus = {
    problemsById: new Map([["PRB-9001", { record: prbRecord }]]),
    evidenceById: new Map([["EVD-900101", { record: { evidence_id: "EVD-900101" } }]]),
    assessmentsByProblem: new Map([["PRB-9001", [{ record: { assessment_id: "ASM-9001" } }]]]),
  };
  const result = evaluateCorroboration("PRB-9001", corpus);
  assert.strictEqual(result.result, REVIEW_REQUIRED);
  assert.ok(
    codesOf(result.reasons).includes(REASON.UNKNOWN_EVIDENCE_REFERENCE),
    JSON.stringify(result.reasons)
  );
});

test("corroboration: missing corroboration_basis -> REVIEW", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = fullCorroborationBasis({ includeCorroborationBasis: false });
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ evidenceStatus: "corroborated", decisionBasis })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "assessments", "ASM-9001.yaml", asm("ASM-9001", "PRB-9001"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.MISSING_CORROBORATION_BASIS));
  } finally {
    cleanup(root);
  }
});

test("corroboration: unknown PRB in overlap_check.related_problems -> REVIEW", () => {
  const prbRecord = {
    problem_id: "PRB-9001",
    problem_statement: PROBLEM_STATEMENT,
    evidence: ["EVD-900101"],
    evidence_status: "corroborated",
    decision_basis: {
      contract_version: "0.1",
      corroboration_basis: "Fixture corroboration reasoning.",
      overlap_check: { performed: true, summary: "Checked.", related_problems: ["PRB-9999"] },
      corroboration_statement: PROBLEM_STATEMENT,
      supporting_evidence: ["EVD-900101"],
      boundary_evidence: [],
      independence_assessment: "Fixture independence judgement.",
      scope: { geography: "Fixture area", population: "residents", temporal: "2026", bounded: false },
      limitations: "",
    },
  };
  const corpus = {
    problemsById: new Map([["PRB-9001", { record: prbRecord }]]),
    evidenceById: new Map([["EVD-900101", { record: { evidence_id: "EVD-900101" } }]]),
    assessmentsByProblem: new Map([["PRB-9001", [{ record: { assessment_id: "ASM-9001" } }]]]),
  };
  const result = evaluateCorroboration("PRB-9001", corpus);
  assert.strictEqual(result.result, REVIEW_REQUIRED);
  assert.ok(
    codesOf(result.reasons).includes(REASON.UNKNOWN_RELATED_PROBLEM_REFERENCE),
    JSON.stringify(result.reasons)
  );
});

// ---- run --------------------------------------------------------------------

function main() {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      fn();
      passed++;
      console.log(`  ok - ${name}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL - ${name}`);
      console.log(`    ${e.stack || e.message}`);
    }
  }
  console.log("");
  console.log(`${passed}/${tests.length} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
