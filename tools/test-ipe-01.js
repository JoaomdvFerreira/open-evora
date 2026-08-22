#!/usr/bin/env node
/**
 * Focused tests for IPE-01 (Investigation & Promotion Engine v0 contract foundation):
 * the optional PRB.decision_basis structure and the validator's empty-reference-entry
 * hardening (docs/discovery/investigation-promotion-engine.md).
 *
 * Zero-dependency: uses only Node's built-in assert/fs/os/path, matching
 * tools/validate-research.js's no-external-dependency convention. Fixtures are
 * generated into a temporary directory per test and discarded — nothing here
 * touches or backfills the canonical research/ corpus.
 *
 * Usage: node tools/test-ipe-01.js
 * Exit code 0 = all tests passed, 1 = at least one failure.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { validateResearchTree } = require("./validate-research.js");

const REAL_SCHEMAS_DIR = path.resolve(__dirname, "..", "research", "schemas");
const DIRS = ["sources", "evidence", "problems", "hypotheses", "assessments", "schemas"];

function makeFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evora-ipe01-"));
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

function minimalEvd(id = "EVD-900101") {
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
`;
}

function minimalPrb({
  id = "PRB-9001",
  evidence = "[EVD-900101]",
  decisionBasis = "",
} = {}) {
  return `
problem_id: ${id}
title: "Fixture problem"
domain: [example]
geography:
  level: municipality
affected_populations: [residents]
problem_statement: "Fixture statement for validator testing."
evidence: ${evidence}
evidence_status: discovered
validation_status: unvalidated
digital_tractability: not_assessed
existing_solutions: not_assessed
status: OPEN
${decisionBasis}
`;
}

const VALID_DECISION_BASIS = `
decision_basis:
  contract_version: "0.1"
  eligibility_basis: "Fixture eligibility reasoning."
  corroboration_basis: "Fixture corroboration reasoning."
  manifestation:
    kind: "access failure"
    summary: "Fixture manifestation."
    evidence: [EVD-900101]
  consequence:
    summary: "Fixture consequence."
    evidence: [EVD-900101]
  currentness:
    assessment: "Fixture currentness call."
    evidence: [EVD-900101]
  contradiction_search:
    performed: true
    summary: "No contradicting evidence found."
    evidence: []
  overlap_check:
    performed: true
    summary: "No overlap found."
    related_problems: []
  corroboration_statement: "Fixture corroboration snapshot."
  supporting_evidence: [EVD-900101]
  boundary_evidence: []
  independence_assessment: "Fixture independence judgement."
  scope:
    geography: "Fixture area"
    population: "residents"
    temporal: "2026"
    bounded: false
  limitations: "Fixture limitations."
`;

// ---- test runner -----------------------------------------------------------

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function errorsContain(errors, substring) {
  return errors.some((e) => e.includes(substring));
}

// ---- decision_basis presence/absence ---------------------------------------

test("PRB with no decision_basis remains valid (optional field)", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", minimalPrb());
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("PRB with a fully populated valid decision_basis passes", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis: VALID_DECISION_BASIS }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("decision_basis with a minimal empty-ish shape (only contract_version) passes", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

// ---- decision_basis reference validation -----------------------------------

test("decision_basis.manifestation.evidence referencing a non-existent EVD is rejected", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  manifestation:
    evidence: [EVD-999999]
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.ok(
      errorsContain(errors, 'field "decision_basis.manifestation.evidence" references non-existent EVD-* record "EVD-999999"'),
      errors.join("\n")
    );
  } finally {
    cleanup(root);
  }
});

test("decision_basis.supporting_evidence referencing a non-existent EVD is rejected", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  supporting_evidence: [EVD-999999]
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.ok(
      errorsContain(errors, 'field "decision_basis.supporting_evidence" references non-existent EVD-* record "EVD-999999"'),
      errors.join("\n")
    );
  } finally {
    cleanup(root);
  }
});

test("decision_basis.overlap_check.related_problems referencing a non-existent PRB is rejected", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  overlap_check:
    related_problems: [PRB-9999]
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.ok(
      errorsContain(errors, 'field "decision_basis.overlap_check.related_problems" references non-existent PRB-* record "PRB-9999"'),
      errors.join("\n")
    );
  } finally {
    cleanup(root);
  }
});

test("decision_basis reference fields accept an empty list", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  manifestation:
    evidence: []
  supporting_evidence: []
  boundary_evidence: []
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

// ---- decision_basis.scope.bounded (IPE-02 contract clarification) ----------

test("decision_basis.scope.bounded=true passes schema/type validation (integration path)", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  scope:
    geography: "Fixture area (limited to one parish)"
    population: "residents"
    temporal: "2026"
    bounded: true
  limitations: "Only one parish was surveyed; not generalized further."
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("decision_basis.scope.bounded with a non-boolean value is rejected (integration path)", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  scope:
    geography: "Fixture area"
    population: "residents"
    temporal: "2026"
    bounded: "yes"
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.ok(
      errorsContain(errors, 'field "decision_basis.scope.bounded" must be a boolean'),
      errors.join("\n")
    );
  } finally {
    cleanup(root);
  }
});

// ---- decision_basis.contradiction_search.performed / overlap_check.performed
// (IPE-02 contract fix: both are schema-declared booleanFields) -------------

test("decision_basis.contradiction_search.performed=true passes schema/type validation", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  contradiction_search:
    performed: true
    summary: "No contradicting evidence found."
    evidence: []
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("decision_basis.contradiction_search.performed=false passes schema/type validation", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  contradiction_search:
    performed: false
    summary: "Not performed."
    evidence: []
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("decision_basis.contradiction_search.performed with a non-boolean value is rejected", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  contradiction_search:
    performed: "yes"
    summary: "Fixture."
    evidence: []
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.ok(
      errorsContain(errors, 'field "decision_basis.contradiction_search.performed" must be a boolean'),
      errors.join("\n")
    );
  } finally {
    cleanup(root);
  }
});

test("decision_basis.overlap_check.performed=true passes schema/type validation", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  overlap_check:
    performed: true
    summary: "No overlap found."
    related_problems: []
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("decision_basis.overlap_check.performed=false passes schema/type validation", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  overlap_check:
    performed: false
    summary: "Not performed."
    related_problems: []
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("decision_basis.overlap_check.performed with a non-boolean value is rejected", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  overlap_check:
    performed: "yes"
    summary: "Fixture."
    related_problems: []
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.ok(
      errorsContain(errors, 'field "decision_basis.overlap_check.performed" must be a boolean'),
      errors.join("\n")
    );
  } finally {
    cleanup(root);
  }
});

// ---- empty-reference-entry hardening ---------------------------------------

test("an empty string inside PRB.evidence is now a validation error", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ evidence: "[EVD-900101, \"\"]" }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.ok(
      errorsContain(errors, 'field "evidence" contains an empty reference entry'),
      errors.join("\n")
    );
  } finally {
    cleanup(root);
  }
});

test("multiple empty entries in a reference list are each reported", () => {
  const root = makeFixtureRoot();
  try {
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      minimalPrb({ evidence: "[EVD-900101, \"\", \"\", \"\"]" })
    );
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    const count = errors.filter((e) => e.includes('field "evidence" contains an empty reference entry')).length;
    assert.strictEqual(count, 3, errors.join("\n"));
  } finally {
    cleanup(root);
  }
});

test("a whitespace-only entry in a reference list is also rejected", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ evidence: '[EVD-900101, "   "]' }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.ok(
      errorsContain(errors, 'field "evidence" contains an empty reference entry'),
      errors.join("\n")
    );
  } finally {
    cleanup(root);
  }
});

test("an empty reference list ([]) is still valid — no empty-entry error", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ evidence: "[]" }));
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
});

test("empty entries in decision_basis.manifestation.evidence are also rejected", () => {
  const root = makeFixtureRoot();
  try {
    const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  manifestation:
    evidence: [EVD-900101, ""]
`;
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const { errors } = validateResearchTree(root);
    assert.ok(
      errorsContain(errors, 'field "decision_basis.manifestation.evidence" contains an empty reference entry'),
      errors.join("\n")
    );
  } finally {
    cleanup(root);
  }
});

test("a non-list single reference field (e.g. HYP.problem) is unaffected by list-only hardening", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", minimalPrb());
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    write(
      root,
      "hypotheses",
      "HYP-9001.yaml",
      `
hypothesis_id: HYP-9001
problem: PRB-9001
hypothesis: "Fixture hypothesis."
mechanism: "Fixture mechanism."
expected_outcome: "Fixture expected outcome."
validation:
  status: untested
`
    );
    const { errors } = validateResearchTree(root);
    assert.deepStrictEqual(errors, []);
  } finally {
    cleanup(root);
  }
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
      console.log(`    ${e.message}`);
    }
  }
  console.log("");
  console.log(`${passed}/${tests.length} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
