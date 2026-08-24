#!/usr/bin/env node
/**
 * Focused tests for the D3 analytical foundation (WU014 / WU-D3-01):
 * the optional EVD.analysis metadata contract and the ASM-* assessment
 * contract, and validator support for both. Analyzer coverage lives in
 * tools/research/analyze.test.ts and analyze.parity.test.ts.
 *
 * Zero-dependency: uses only Node's built-in assert/fs/os/path, matching
 * tools/validate-research.js's no-external-dependency convention. Fixtures are
 * generated into a temporary directory per test and discarded — nothing here
 * touches or backfills the canonical research/ corpus.
 *
 * Usage: node tools/test-analytical-foundation.js
 * Exit code 0 = all tests passed, 1 = at least one failure.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { validateResearchTree } = require("./validate-research.js");

const REAL_SCHEMAS_DIR = path.resolve(__dirname, "..", "research", "schemas");
const DIRS = ["sources", "evidence", "problems", "assessments", "schemas"];

function makeFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evora-wu014-"));
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

const MINIMAL_PRB = `
problem_id: PRB-9001
title: "Fixture problem"
domain: [example]
geography:
  level: municipality
affected_populations: [residents]
problem_statement: "Fixture statement for validator/analyzer testing."
evidence: [EVD-900101]
evidence_status: discovered
validation_status: unvalidated
digital_tractability: not_assessed
existing_solutions: not_assessed
status: OPEN
`;

function minimalEvd({ id = "EVD-900101", analysis = "", notes = "Fixture only." } = {}) {
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
notes: "${notes}"
${analysis}
`;
}

const VALID_ANALYSIS = `
analysis:
  related_problems: [PRB-9001]
  contribution: [CONFIRMS, REFINES]
  friction_types: [OPERATIONAL]
  public_signal_class: PS1
  lineage_id: "FIXTURE-LINEAGE-1"
  representativeness: UNKNOWN
  verification: REPORTED
  temporal_relevance: CURRENT
`;

function minimalAsm({
  id = "ASM-9001",
  problem = "PRB-9001",
  status = "CURRENT",
  triage = "DEEPEN",
  nextAction = "Do targeted journey research.",
  criticalUnknowns = "",
} = {}) {
  return `
assessment_id: ${id}
problem: ${problem}
as_of: "2026-08-11"
phase: D3
assessment_status: ${status}
evidence_confidence:
  overall: MEDIUM
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
journey_understanding: PARTIAL
causal_understanding: UNKNOWN
existing_solution_understanding: UNKNOWN
remaining_gap: UNKNOWN
digital_leverage: not_assessed
structure_action: KEEP
decision_gates:
  problem_real: PASS
  civic_importance: UNKNOWN
  journey_understood: UNKNOWN
  root_cause_understood: UNKNOWN
  remaining_gap_supported: UNKNOWN
  digital_causality: NOT_ASSESSED
  operability: NOT_ASSESSED
  testability: NOT_ASSESSED
triage: ${triage}
next_action: "${nextAction}"
notes: "Fixture."
${criticalUnknowns}
`;
}

const ONE_CRITICAL_UNKNOWN = `
critical_unknowns:
  U1:
    question: "What happens after a resident report?"
    decision_impact: HIGH
    target_phase: D3
    best_next_evidence:
      - "operational data"
`;

// ---- test runner -----------------------------------------------------------

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function errorsContain(errors, substring) {
  return errors.some((e) => e.includes(substring));
}

// ---- EVD.analysis tests -----------------------------------------------------

test("valid optional EVD.analysis block passes", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd({ analysis: VALID_ANALYSIS }));
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("invalid analysis.contribution enum value is rejected", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    const bad = minimalEvd({
      analysis: `
analysis:
  contribution: [NOT-A-REAL-CONTRIBUTION]
`,
    });
    write(root, "evidence", "EVD-900101.yaml", bad);
    const { errors } = validateResearchTree(root);
    assert.ok(errorsContain(errors, 'field "analysis.contribution"'), errors.join("\n"));
  } finally {
    cleanup(root);
  }
});

test("invalid analysis.friction_types enum value is rejected", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    const bad = minimalEvd({
      analysis: `
analysis:
  friction_types: [NOT-A-REAL-FRICTION-TYPE]
`,
    });
    write(root, "evidence", "EVD-900101.yaml", bad);
    const { errors } = validateResearchTree(root);
    assert.ok(errorsContain(errors, 'field "analysis.friction_types"'), errors.join("\n"));
  } finally {
    cleanup(root);
  }
});

test("invalid analysis.related_problems reference is rejected", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    const bad = minimalEvd({
      analysis: `
analysis:
  related_problems: [PRB-9999]
`,
    });
    write(root, "evidence", "EVD-900101.yaml", bad);
    const { errors } = validateResearchTree(root);
    assert.ok(errorsContain(errors, "non-existent PRB-* record"), errors.join("\n"));
  } finally {
    cleanup(root);
  }
});

test("EVD with no analysis block remains valid", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("EVD analysis block with no lineage_id remains valid", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    const evd = minimalEvd({
      analysis: `
analysis:
  contribution: [CONFIRMS]
`,
    });
    write(root, "evidence", "EVD-900101.yaml", evd);
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("EVD analysis.contribution accepts PLANNED-SOLUTION distinctly from EXISTING-SOLUTION", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    const evd = minimalEvd({
      analysis: `
analysis:
  contribution: [CONFIRMS, PLANNED-SOLUTION]
`,
    });
    write(root, "evidence", "EVD-900101.yaml", evd);
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("invalid PLANNED-SOLUTION spelling/value is rejected", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    const bad = minimalEvd({
      analysis: `
analysis:
  contribution: [PLANNED_SOLUTION]
`,
    });
    write(root, "evidence", "EVD-900101.yaml", bad);
    const { errors } = validateResearchTree(root);
    assert.ok(errorsContain(errors, 'field "analysis.contribution"'), errors.join("\n"));
  } finally {
    cleanup(root);
  }
});

// ---- ASM tests ---------------------------------------------------------------

test("valid minimal ASM-Lite passes", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    write(root, "assessments", "ASM-9001.yaml", minimalAsm());
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("ASM referencing a non-existent PRB is rejected", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    write(root, "assessments", "ASM-9001.yaml", minimalAsm({ problem: "PRB-9999" }));
    const { errors } = validateResearchTree(root);
    assert.ok(errorsContain(errors, "non-existent PRB-* record"), errors.join("\n"));
  } finally {
    cleanup(root);
  }
});

test("ASM with an invalid decision-gate enum is rejected", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const asm = minimalAsm().replace("problem_real: PASS", "problem_real: MAYBE");
    write(root, "assessments", "ASM-9001.yaml", asm);
    const { errors } = validateResearchTree(root);
    assert.ok(errorsContain(errors, 'field "decision_gates.problem_real"'), errors.join("\n"));
  } finally {
    cleanup(root);
  }
});

test("ASM decision_gates accepts PARTIAL alongside PASS/FAIL/UNKNOWN/NOT_ASSESSED", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const asm = minimalAsm().replace("problem_real: PASS", "problem_real: PARTIAL");
    write(root, "assessments", "ASM-9001.yaml", asm);
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("ASM with an invalid triage value is rejected", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    write(root, "assessments", "ASM-9001.yaml", minimalAsm({ triage: "SOMEDAY" }));
    const { errors } = validateResearchTree(root);
    assert.ok(errorsContain(errors, 'field "triage"'), errors.join("\n"));
  } finally {
    cleanup(root);
  }
});

test("ASM critical_unknowns with a missing question is rejected", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const badUnknown = `
critical_unknowns:
  U1:
    decision_impact: HIGH
    target_phase: D3
`;
    write(root, "assessments", "ASM-9001.yaml", minimalAsm({ criticalUnknowns: badUnknown }));
    const { errors } = validateResearchTree(root);
    assert.ok(errorsContain(errors, "critical_unknowns.U1.question"), errors.join("\n"));
  } finally {
    cleanup(root);
  }
});

test("ASM critical_unknowns with an invalid decision_impact is rejected", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const badUnknown = `
critical_unknowns:
  U1:
    question: "What happens after a resident report?"
    decision_impact: SUPER_HIGH
    target_phase: D3
`;
    write(root, "assessments", "ASM-9001.yaml", minimalAsm({ criticalUnknowns: badUnknown }));
    const { errors } = validateResearchTree(root);
    assert.ok(errorsContain(errors, "critical_unknowns.U1.decision_impact"), errors.join("\n"));
  } finally {
    cleanup(root);
  }
});

test("ASM with a valid critical_unknowns entry passes", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    write(root, "assessments", "ASM-9001.yaml", minimalAsm({ criticalUnknowns: ONE_CRITICAL_UNKNOWN }));
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("empty assessments directory is valid (zero ASM records)", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors, totalRecords } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(totalRecords, 2); // 1 PRB + 1 EVD, 0 ASM
  } finally {
    cleanup(root);
  }
});

// Analyzer coverage (previously here, against tools/analyze-research.js) has
// moved to tools/research/analyze.test.ts and analyze.parity.test.ts, which
// test the typed analyzer (tools/research/analyze.ts) built on the shared
// TC-01 CorpusIndex, including canonical-corpus characterization tests
// that froze the legacy analyzer's contract before its removal.

// ---- run ------------------------------------------------------------------

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
      console.log(`    ${e.message}`);
    }
  }
  console.log("");
  console.log(`${passed}/${tests.length} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
