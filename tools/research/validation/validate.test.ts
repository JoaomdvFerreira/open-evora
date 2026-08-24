/**
 * Focused tests for the TC-02 typed validator (validate.ts), covering
 * schema validation, malformed records, duplicate IDs, invalid references,
 * and the ASM-* critical_unknowns special case. Preserves the legacy
 * tools/validate-research.js rule set; see validate.parity.test.ts for
 * direct legacy-vs-new comparisons on the canonical corpus.
 *
 * Run with Node's built-in test runner: node --test tools/research (recursively)
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { loadCorpusIndex } from "../core/corpus.ts";
import { validateCorpusIndex, validateResearchRoot } from "./validate.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REAL_RESEARCH_ROOT = join(__dirname, "..", "..", "..", "research");
const REAL_SCHEMAS_DIR = join(REAL_RESEARCH_ROOT, "schemas");
const DIRS = ["sources", "evidence", "problems", "assessments", "schemas"];

function makeFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "evora-tc02-"));
  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  for (const f of readdirSync(REAL_SCHEMAS_DIR)) {
    writeFileSync(join(root, "schemas", f), readFileSync(join(REAL_SCHEMAS_DIR, f), "utf8"));
  }
  return root;
}

function write(root: string, dir: string, filename: string, content: string): void {
  writeFileSync(join(root, dir, filename), content, "utf8");
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

function baseFixture(): string {
  const root = makeFixtureRoot();
  write(root, "sources", "SRC-9001.yaml", VALID_SRC);
  write(root, "evidence", "EVD-900101.yaml", VALID_EVD);
  write(root, "problems", "PRB-9001.yaml", VALID_PRB);
  write(root, "assessments", "ASM-9001.yaml", VALID_ASM);
  return root;
}

describe("validateResearchRoot: valid corpus", () => {
  let root: string;
  before(() => {
    root = baseFixture();
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("a fully valid fixture corpus reports zero errors", () => {
    const result = validateResearchRoot(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.totalRecords, 4);
  });
});

describe("validateResearchRoot: malformed YAML", () => {
  test("a malformed record file is reported without aborting validation of the rest", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "sources", "SRC-9001.yaml", VALID_SRC);
      write(root, "problems", "PRB-BAD.yaml", "problem_id: PRB-9001\n  bad_indent: true\n");
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes("PRB-BAD.yaml") && e.includes("malformed YAML")));
      // The SRC record still gets validated despite the PRB parse failure.
      assert.equal(result.totalRecords, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("validateResearchRoot: missing/invalid fields", () => {
  test("missing required field is reported", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "sources", "SRC-9001.yaml", VALID_SRC.replace('publisher: "Fixture Publisher"\n', ""));
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes("missing required field: publisher")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("invalid enum value is reported", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "sources", "SRC-9001.yaml", VALID_SRC.replace("source_type: web", "source_type: bogus"));
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) => e.includes('field "source_type" has invalid value "bogus"'))
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("non-boolean value in a declared boolean field is reported", () => {
    const root = makeFixtureRoot();
    try {
      write(
        root,
        "problems",
        "PRB-9001.yaml",
        VALID_PRB + `decision_basis:\n  scope:\n    bounded: "yes"\n`
      );
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) => e.includes('field "decision_basis.scope.bounded" must be a boolean'))
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ID not matching declared prefix is reported", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "sources", "SRC-9001.yaml", VALID_SRC.replace("SRC-9001", "XYZ-9001"));
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('does not start with expected prefix "SRC-"')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("filename not matching record ID is reported", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "sources", "SRC-WRONGNAME.yaml", VALID_SRC);
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('filename "SRC-WRONGNAME" does not match record ID "SRC-9001"')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("validateResearchRoot: duplicate IDs", () => {
  test("two files declaring the same ID are both reported", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "sources", "SRC-9001.yaml", VALID_SRC);
      // Second file with a different filename but the same source_id.
      write(root, "sources", "SRC-9001-dup.yaml", VALID_SRC);
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('duplicate ID "SRC-9001"')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("validateResearchRoot: cross-reference integrity", () => {
  test("a reference to a non-existent record is reported", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "sources", "SRC-9001.yaml", VALID_SRC);
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD);
      write(root, "problems", "PRB-9001.yaml", VALID_PRB.replace("EVD-900101", "EVD-999999"));
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) => e.includes('references non-existent EVD-* record "EVD-999999"'))
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a required reference field left empty is reported", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", VALID_PRB);
      write(root, "assessments", "ASM-9001.yaml", VALID_ASM.replace("problem: PRB-9001", "problem:"));
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes("missing required reference field: problem")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a valid reference produces no cross-reference error", () => {
    const root = baseFixture();
    try {
      const result = validateResearchRoot(root);
      assert.ok(!result.errors.some((e) => e.includes("references non-existent")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("validateResearchRoot: ASM-* critical_unknowns special case", () => {
  test("absent critical_unknowns is valid", () => {
    const root = baseFixture();
    try {
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("critical_unknowns not a keyed map is reported", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", VALID_PRB);
      write(root, "assessments", "ASM-9001.yaml", VALID_ASM + "critical_unknowns: [not, a, map]\n");
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) => e.includes('field "critical_unknowns" must be a keyed map'))
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a critical_unknowns entry missing question/decision_impact/target_phase is reported", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", VALID_PRB);
      write(
        root,
        "assessments",
        "ASM-9001.yaml",
        VALID_ASM + "critical_unknowns:\n  U1:\n    decision_impact: BOGUS\n"
      );
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "critical_unknowns.U1.question" is required')));
      assert.ok(
        result.errors.some((e) => e.includes('field "critical_unknowns.U1.decision_impact" has invalid value "BOGUS"'))
      );
      assert.ok(result.errors.some((e) => e.includes('field "critical_unknowns.U1.target_phase" is required')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a well-formed critical_unknowns entry is valid", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "sources", "SRC-9001.yaml", VALID_SRC);
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD);
      write(root, "problems", "PRB-9001.yaml", VALID_PRB);
      write(
        root,
        "assessments",
        "ASM-9001.yaml",
        VALID_ASM +
          "critical_unknowns:\n  U1:\n    question: \"Is this resolved?\"\n    decision_impact: HIGH\n    target_phase: D4\n    best_next_evidence: [interview]\n"
      );
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("best_next_evidence must be a list of strings", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", VALID_PRB);
      write(
        root,
        "assessments",
        "ASM-9001.yaml",
        VALID_ASM +
          'critical_unknowns:\n  U1:\n    question: "Q"\n    decision_impact: LOW\n    target_phase: D4\n    best_next_evidence: "not-a-list"\n'
      );
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) => e.includes('field "critical_unknowns.U1.best_next_evidence" must be a list'))
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("validateCorpusIndex: works directly on a pre-loaded CorpusIndex", () => {
  test("matches validateResearchRoot's result for the same corpus", () => {
    const root = baseFixture();
    try {
      const index = loadCorpusIndex(root);
      const viaIndex = validateCorpusIndex(index);
      const viaRoot = validateResearchRoot(root);
      assert.deepEqual(viaIndex, viaRoot);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("validateResearchRoot: real canonical corpus", () => {
  test("the current research/ corpus validates with zero errors", () => {
    const result = validateResearchRoot(REAL_RESEARCH_ROOT);
    assert.deepEqual(result.errors, []);
  });
});
