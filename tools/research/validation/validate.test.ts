/**
 * Focused tests for the typed validator (validate.ts), covering schema
 * validation, malformed records, duplicate IDs, invalid references, the
 * optional EVD.analysis contract, and the PRB.decision_basis optional
 * structure (including its reference fields and the empty-reference-entry
 * hardening). Preserves the full validation rule set of the retired
 * tools/validate-research.js, which this module and its behavioural-parity
 * testing (TC-02) fully superseded; the durable coverage previously split
 * across tools/test-analytical-foundation.js and tools/test-ipe-01.js has
 * been migrated in below rather than kept as separate legacy oracles.
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
const DIRS = ["sources", "evidence", "problems", "schemas"];

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
resource_type: webpage
scope:
  geography:
    level: municipality
    area: "Évora"
  domains: [example]
access:
  level: public
  availability: available
  machine_readable: false
acquisition:
  method: public_web
licensing:
  status: unknown
  reuse: unknown
temporal:
  last_checked_at: "2026-08-11"
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
solution_landscape_status: not_assessed
status: OPEN
`;

function baseFixture(): string {
  const root = makeFixtureRoot();
  write(root, "sources", "SRC-9001.yaml", VALID_SRC);
  write(root, "evidence", "EVD-900101.yaml", VALID_EVD);
  write(root, "problems", "PRB-9001.yaml", VALID_PRB);
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
    assert.equal(result.totalRecords, 3);
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
      write(root, "sources", "SRC-9001.yaml", VALID_SRC.replace('name: "Fixture Source"\n', ""));
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes("missing required field: name")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("invalid enum value is reported", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "sources", "SRC-9001.yaml", VALID_SRC.replace("resource_type: webpage", "resource_type: bogus"));
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) => e.includes('field "resource_type" has invalid value "bogus"'))
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

// ---- EVD.analysis contract tests -------------------------------------------
// Migrated from the retired tools/test-analytical-foundation.js (D3
// analytical foundation, WU014/WU-D3-01): the optional EVD.analysis metadata
// contract. Generic enum/reference/boolean mechanics are already covered
// above; these exercise the specific analysis.* fields and enum members that
// mechanism validates.

function minimalPrbForAnalysis(): string {
  return `
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
solution_landscape_status: not_assessed
status: OPEN
`;
}

function minimalEvdForAnalysis({ id = "EVD-900101", analysis = "" }: { id?: string; analysis?: string } = {}): string {
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
${analysis}
`;
}

const VALID_ANALYSIS_BLOCK = `
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

describe("validateResearchRoot: EVD.analysis optional contract", () => {
  test("valid optional EVD.analysis block passes", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbForAnalysis());
      write(root, "evidence", "EVD-900101.yaml", minimalEvdForAnalysis({ analysis: VALID_ANALYSIS_BLOCK }));
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("invalid analysis.contribution enum value is rejected", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbForAnalysis());
      write(
        root,
        "evidence",
        "EVD-900101.yaml",
        minimalEvdForAnalysis({ analysis: "\nanalysis:\n  contribution: [NOT-A-REAL-CONTRIBUTION]\n" })
      );
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "analysis.contribution"')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("invalid analysis.friction_types enum value is rejected", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbForAnalysis());
      write(
        root,
        "evidence",
        "EVD-900101.yaml",
        minimalEvdForAnalysis({ analysis: "\nanalysis:\n  friction_types: [NOT-A-REAL-FRICTION-TYPE]\n" })
      );
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "analysis.friction_types"')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("invalid analysis.related_problems reference is rejected", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbForAnalysis());
      write(
        root,
        "evidence",
        "EVD-900101.yaml",
        minimalEvdForAnalysis({ analysis: "\nanalysis:\n  related_problems: [PRB-9999]\n" })
      );
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes("non-existent PRB-* record")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("EVD with no analysis block remains valid", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbForAnalysis());
      write(root, "evidence", "EVD-900101.yaml", minimalEvdForAnalysis());
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("EVD analysis block with no lineage_id remains valid", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbForAnalysis());
      write(
        root,
        "evidence",
        "EVD-900101.yaml",
        minimalEvdForAnalysis({ analysis: "\nanalysis:\n  contribution: [CONFIRMS]\n" })
      );
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("analysis.contribution accepts PLANNED-SOLUTION distinctly from EXISTING-SOLUTION", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbForAnalysis());
      write(
        root,
        "evidence",
        "EVD-900101.yaml",
        minimalEvdForAnalysis({ analysis: "\nanalysis:\n  contribution: [CONFIRMS, PLANNED-SOLUTION]\n" })
      );
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("invalid PLANNED-SOLUTION spelling/value is rejected", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbForAnalysis());
      write(
        root,
        "evidence",
        "EVD-900101.yaml",
        minimalEvdForAnalysis({ analysis: "\nanalysis:\n  contribution: [PLANNED_SOLUTION]\n" })
      );
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "analysis.contribution"')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---- decision_basis contract tests ------------------------------------------
// Migrated from the retired tools/test-ipe-01.js (IPE-01 contract foundation):
// the optional PRB.decision_basis structure, its reference fields, and the
// empty-reference-entry hardening (docs/investigationstrategy.md §6).
// decision_basis.scope.bounded's boolean-field validation is already covered
// above (see "non-boolean value in a declared boolean field is reported");
// these cover decision_basis's other reference/boolean fields plus the
// empty-reference-entry rule generally.

function minimalPrbWithDecisionBasis({
  evidence = "[EVD-900101]",
  decisionBasis = "",
}: { evidence?: string; decisionBasis?: string } = {}): string {
  return `
problem_id: PRB-9001
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
solution_landscape_status: not_assessed
status: OPEN
${decisionBasis}
`;
}

describe("validateResearchRoot: PRB.decision_basis optional contract", () => {
  test("PRB with no decision_basis remains valid (optional field)", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbWithDecisionBasis());
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD.replace("  source_id: SRC-9001\n", ""));
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("decision_basis.manifestation.evidence referencing a non-existent EVD is rejected", () => {
    const root = makeFixtureRoot();
    try {
      const decisionBasis = `
decision_basis:
  contract_version: "0.1"
  manifestation:
    evidence: [EVD-999999]
`;
      write(root, "problems", "PRB-9001.yaml", minimalPrbWithDecisionBasis({ decisionBasis }));
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD.replace("  source_id: SRC-9001\n", ""));
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) =>
          e.includes('field "decision_basis.manifestation.evidence" references non-existent EVD-* record "EVD-999999"')
        )
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
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
      write(root, "problems", "PRB-9001.yaml", minimalPrbWithDecisionBasis({ decisionBasis }));
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD.replace("  source_id: SRC-9001\n", ""));
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) =>
          e.includes('field "decision_basis.supporting_evidence" references non-existent EVD-* record "EVD-999999"')
        )
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
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
      write(root, "problems", "PRB-9001.yaml", minimalPrbWithDecisionBasis({ decisionBasis }));
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD.replace("  source_id: SRC-9001\n", ""));
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) =>
          e.includes('field "decision_basis.overlap_check.related_problems" references non-existent PRB-* record "PRB-9999"')
        )
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
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
      write(root, "problems", "PRB-9001.yaml", minimalPrbWithDecisionBasis({ decisionBasis }));
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD.replace("  source_id: SRC-9001\n", ""));
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
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
      write(root, "problems", "PRB-9001.yaml", minimalPrbWithDecisionBasis({ decisionBasis }));
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD.replace("  source_id: SRC-9001\n", ""));
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) => e.includes('field "decision_basis.contradiction_search.performed" must be a boolean'))
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
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
      write(root, "problems", "PRB-9001.yaml", minimalPrbWithDecisionBasis({ decisionBasis }));
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD.replace("  source_id: SRC-9001\n", ""));
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) => e.includes('field "decision_basis.overlap_check.performed" must be a boolean'))
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("validateResearchRoot: empty-reference-entry hardening", () => {
  test("an empty string inside PRB.evidence is a validation error", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbWithDecisionBasis({ evidence: '[EVD-900101, ""]' }));
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD.replace("  source_id: SRC-9001\n", ""));
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "evidence" contains an empty reference entry')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("multiple empty entries in a reference list are each reported", () => {
    const root = makeFixtureRoot();
    try {
      write(
        root,
        "problems",
        "PRB-9001.yaml",
        minimalPrbWithDecisionBasis({ evidence: '[EVD-900101, "", "", ""]' })
      );
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD.replace("  source_id: SRC-9001\n", ""));
      const result = validateResearchRoot(root);
      const count = result.errors.filter((e) => e.includes('field "evidence" contains an empty reference entry')).length;
      assert.equal(count, 3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a whitespace-only entry in a reference list is also rejected", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbWithDecisionBasis({ evidence: '[EVD-900101, "   "]' }));
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD.replace("  source_id: SRC-9001\n", ""));
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "evidence" contains an empty reference entry')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an empty reference list ([]) is still valid — no empty-entry error", () => {
    const root = makeFixtureRoot();
    try {
      write(root, "problems", "PRB-9001.yaml", minimalPrbWithDecisionBasis({ evidence: "[]" }));
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
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
      write(root, "problems", "PRB-9001.yaml", minimalPrbWithDecisionBasis({ decisionBasis }));
      write(root, "evidence", "EVD-900101.yaml", VALID_EVD.replace("  source_id: SRC-9001\n", ""));
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) =>
          e.includes('field "decision_basis.manifestation.evidence" contains an empty reference entry')
        )
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
