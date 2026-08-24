/**
 * Behavioural-parity tests between the legacy tools/validate-research.js
 * validator and the new typed validator (validate.ts), per TC-02: the new
 * validator must preserve the currently implemented validation contract,
 * not just "similar" behaviour.
 *
 * Compares error sets (sorted, since ordering is an implementation detail
 * of iteration order, not part of the contract) and totalRecords on both
 * the real canonical corpus and a set of fixture corpora exercising
 * malformed records, duplicate IDs, invalid references, and the ASM-*
 * critical_unknowns special case.
 *
 * Run with Node's built-in test runner: node --test tools/research (recursively)
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { validateResearchRoot } from "./validate.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);
const { validateResearchTree } = require("../../validate-research.js") as {
  validateResearchTree: (researchRoot: string) => { errors: string[]; totalRecords: number };
};

const REAL_RESEARCH_ROOT = join(__dirname, "..", "..", "..", "research");
const REAL_SCHEMAS_DIR = join(REAL_RESEARCH_ROOT, "schemas");
const DIRS = ["sources", "evidence", "problems", "assessments", "schemas"];

function makeFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "evora-tc02-parity-"));
  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  for (const f of readdirSync(REAL_SCHEMAS_DIR)) {
    writeFileSync(join(root, "schemas", f), readFileSync(join(REAL_SCHEMAS_DIR, f), "utf8"));
  }
  return root;
}

function write(root: string, dir: string, filename: string, content: string): void {
  writeFileSync(join(root, dir, filename), content, "utf8");
}

// Legacy relative-path formatting is platform-native (path.relative, "\\"
// on Windows); the new loader deliberately normalizes to forward slashes
// (corpus.ts). Normalize both sides before comparing so the parity check
// asserts on error content, not on an intentional, disclosed formatting
// improvement.
function normalizeSlashes(s: string): string {
  return s.split("\\").join("/");
}

function assertParity(root: string): void {
  const legacy = validateResearchTree(root);
  const next = validateResearchRoot(root);
  assert.deepEqual(
    [...legacy.errors].map(normalizeSlashes).sort(),
    [...next.errors].map(normalizeSlashes).sort()
  );
  assert.equal(legacy.totalRecords, next.totalRecords);
}

const VALID_SRC = `
source_id: SRC-9001
publisher: "Fixture Publisher"
name: "Fixture Source"
scope:
  geography: "Évora"
  domains: [example]
source_type: web
access:
  public: true
  machine_readable: false
authority: unknown
licensing:
  status: unknown
freshness:
  last_checked: "2026-08-11"
  status: CURRENT
`;

const VALID_EVD = `
evidence_id: EVD-900101
type: observation
source:
  publisher: "Fixture Publisher"
  title: "Fixture Source"
  source_id: SRC-9001
  retrieved_at: "2026-08-11"
geography:
  level: municipality
population: [example-population]
domain: [example]
observation:
  summary: "Fixture observation."
evidence_nature: claim
strength: anecdotal
personal_data:
  present: false
  retained: false
`;

const VALID_PRB = `
problem_id: PRB-9001
title: "Fixture problem"
domain: [example]
geography:
  level: municipality
affected_populations: [residents]
problem_statement: "Fixture statement for validator testing."
evidence: [EVD-900101]
evidence_status: discovered
validation_status: unvalidated
digital_tractability: not_assessed
existing_solutions: not_assessed
status: OPEN
`;

const VALID_ASM = `
assessment_id: ASM-9001
problem: PRB-9001
as_of: "2026-08-11"
phase: D3
assessment_status: CURRENT
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
triage: DEEPEN
`;

describe("legacy vs new validator: canonical corpus", () => {
  test("identical errors and totalRecords on research/", () => {
    assertParity(REAL_RESEARCH_ROOT);
  });
});

describe("legacy vs new validator: fixture corpora", () => {
  let root: string;
  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("valid corpus", () => {
    root = makeFixtureRoot();
    write(root, "sources", "SRC-9001.yaml", VALID_SRC);
    write(root, "evidence", "EVD-900101.yaml", VALID_EVD);
    write(root, "problems", "PRB-9001.yaml", VALID_PRB);
    write(root, "assessments", "ASM-9001.yaml", VALID_ASM);
    assertParity(root);
  });

  test("malformed YAML", () => {
    root = makeFixtureRoot();
    write(root, "sources", "SRC-9001.yaml", VALID_SRC);
    write(root, "problems", "PRB-BAD.yaml", "problem_id: PRB-9001\n  bad_indent: true\n");
    const legacy = validateResearchTree(root);
    const next = validateResearchRoot(root);
    // Error message text for a YAML parse failure comes from each parser's
    // own internals and is expected to differ; presence/location parity is
    // what's asserted (both flag PRB-BAD.yaml as malformed, same record count).
    assert.ok(legacy.errors.some((e) => normalizeSlashes(e).includes("problems/PRB-BAD.yaml") && e.includes("malformed YAML")));
    assert.ok(next.errors.some((e) => normalizeSlashes(e).includes("problems/PRB-BAD.yaml") && e.includes("malformed YAML")));
    assert.equal(legacy.totalRecords, next.totalRecords);
  });

  test("missing required field", () => {
    root = makeFixtureRoot();
    write(root, "sources", "SRC-9001.yaml", VALID_SRC.replace('publisher: "Fixture Publisher"\n', ""));
    assertParity(root);
  });

  test("invalid enum value", () => {
    root = makeFixtureRoot();
    write(root, "sources", "SRC-9001.yaml", VALID_SRC.replace("source_type: web", "source_type: bogus"));
    assertParity(root);
  });

  test("non-boolean declared boolean field", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", VALID_PRB + 'decision_basis:\n  scope:\n    bounded: "yes"\n');
    assertParity(root);
  });

  test("ID prefix mismatch", () => {
    root = makeFixtureRoot();
    write(root, "sources", "SRC-9001.yaml", VALID_SRC.replace("SRC-9001", "XYZ-9001"));
    assertParity(root);
  });

  test("filename/ID mismatch", () => {
    root = makeFixtureRoot();
    write(root, "sources", "SRC-WRONGNAME.yaml", VALID_SRC);
    assertParity(root);
  });

  test("duplicate IDs", () => {
    root = makeFixtureRoot();
    write(root, "sources", "SRC-9001.yaml", VALID_SRC);
    write(root, "sources", "SRC-9001-dup.yaml", VALID_SRC);
    assertParity(root);
  });

  test("broken cross-reference", () => {
    root = makeFixtureRoot();
    write(root, "sources", "SRC-9001.yaml", VALID_SRC);
    write(root, "evidence", "EVD-900101.yaml", VALID_EVD);
    write(root, "problems", "PRB-9001.yaml", VALID_PRB.replace("EVD-900101", "EVD-999999"));
    assertParity(root);
  });

  test("required reference field left empty", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", VALID_PRB);
    write(root, "assessments", "ASM-9001.yaml", VALID_ASM.replace("problem: PRB-9001", "problem:"));
    assertParity(root);
  });

  test("critical_unknowns not a keyed map", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", VALID_PRB);
    write(root, "assessments", "ASM-9001.yaml", VALID_ASM + "critical_unknowns: [not, a, map]\n");
    assertParity(root);
  });

  test("critical_unknowns entry missing required subfields", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", VALID_PRB);
    write(
      root,
      "assessments",
      "ASM-9001.yaml",
      VALID_ASM + "critical_unknowns:\n  U1:\n    decision_impact: BOGUS\n"
    );
    assertParity(root);
  });

  test("well-formed critical_unknowns entry", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", VALID_PRB);
    write(
      root,
      "assessments",
      "ASM-9001.yaml",
      VALID_ASM +
        "critical_unknowns:\n  U1:\n    question: \"Is this resolved?\"\n    decision_impact: HIGH\n    target_phase: D4\n    best_next_evidence: [interview]\n"
    );
    assertParity(root);
  });

  test("multiple simultaneous problems across record types", () => {
    root = makeFixtureRoot();
    write(root, "sources", "SRC-9001.yaml", VALID_SRC.replace("source_type: web", "source_type: bogus"));
    write(root, "evidence", "EVD-900101.yaml", VALID_EVD);
    write(root, "problems", "PRB-9001.yaml", VALID_PRB.replace("EVD-900101", "EVD-999999"));
    write(root, "assessments", "ASM-9001.yaml", VALID_ASM.replace("problem: PRB-9001", "problem: PRB-9999"));
    assertParity(root);
  });
});
