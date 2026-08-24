/**
 * Focused tests for the typed readiness engine (readiness.ts): PRB
 * Eligibility and Corroboration structural checks over an explicitly
 * authored decision_basis. Migrated from tools/test-ipe-02.js (now
 * removed) onto the typed engine built on the shared TC-01 CorpusIndex.
 *
 * Fixtures are generated into a temporary directory per test and discarded
 * — nothing here touches or backfills the canonical research/ corpus (no
 * canonical PRB carries a decision_basis, so every scenario needs
 * synthetic fixture data).
 *
 * Run with Node's built-in test runner: node --test tools/research (recursively)
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  evaluateProblem,
  evaluateEligibility,
  evaluateCorroboration,
  REASON,
  READY,
  REVIEW_REQUIRED,
} from "./readiness.ts";
import { loadCorpusIndex } from "../core/corpus.ts";
import { validateCorpusIndex } from "../validation/validate.ts";
import type { CorpusIndex } from "../core/types.ts";
import type { ReadinessFinding } from "./readiness.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REAL_RESEARCH_ROOT = join(__dirname, "..", "..", "..", "research");
const REAL_SCHEMAS_DIR = join(REAL_RESEARCH_ROOT, "schemas");
const DIRS = ["sources", "evidence", "problems", "schemas"];

function makeFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "evora-readiness-"));
  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  for (const f of readdirSync(REAL_SCHEMAS_DIR)) {
    writeFileSync(join(root, "schemas", f), readFileSync(join(REAL_SCHEMAS_DIR, f), "utf8"));
  }
  return root;
}

function write(root: string, dir: string, filename: string, content: string): void {
  writeFileSync(join(root, dir, filename), content, "utf8");
}

function cleanup(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

function evd(id: string, { lineageId }: { lineageId?: string } = {}): string {
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
  affectedPopulations = "[residents]",
}: {
  id?: string;
  evidenceIds?: string[];
  evidenceStatus?: string;
  validationStatus?: string;
  decisionBasis?: string;
  affectedPopulations?: string;
} = {}): string {
  return `
problem_id: ${id}
title: "Fixture problem"
domain: [example]
geography:
  level: municipality
affected_populations: ${affectedPopulations}
problem_statement: "${PROBLEM_STATEMENT}"
evidence: [${evidenceIds.join(", ")}]
evidence_status: ${evidenceStatus}
validation_status: ${validationStatus}
digital_tractability: not_assessed
solution_landscape_status: not_assessed
status: OPEN
${decisionBasis}
`;
}

function fullEligibilityBasis({
  includeManifestation = true,
  includeConsequence = true,
  manifestationEvidence = "[EVD-900101]",
  limitations = "",
  contradictionPerformed = true,
  overlapPerformed = true,
  includeOverlapCheck = true,
  includeContractVersion = true,
}: {
  includeManifestation?: boolean;
  includeConsequence?: boolean;
  manifestationEvidence?: string;
  limitations?: string;
  contradictionPerformed?: boolean;
  overlapPerformed?: boolean;
  includeOverlapCheck?: boolean;
  includeContractVersion?: boolean;
} = {}): string {
  return `
decision_basis:
${includeContractVersion ? `  contract_version: "0.1"\n` : ""}  eligibility_basis: "Fixture eligibility reasoning."
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
  includeContractVersion = true,
}: {
  corroborationStatement?: string;
  supportingEvidence?: string;
  bounded?: boolean;
  includeBounded?: boolean;
  limitations?: string;
  includeCorroborationBasis?: boolean;
  includeScope?: boolean;
  contradictionPerformed?: boolean;
  includeContractVersion?: boolean;
} = {}): string {
  return `
decision_basis:
${includeContractVersion ? `  contract_version: "0.1"\n` : ""}${includeCorroborationBasis ? `  corroboration_basis: "Fixture corroboration reasoning."\n` : ""}  currentness:
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

function codesOf(reasons: ReadinessFinding[]): string[] {
  return reasons.map((r) => r.code);
}

function loadAndEvaluate(root: string, prbId: string) {
  const index = loadCorpusIndex(root);
  const { errors } = validateCorpusIndex(index);
  assert.deepEqual(errors, [], "corpus failed to validate");
  const report = evaluateProblem(prbId, index);
  assert.ok(report, "expected problem to resolve");
  return report!;
}

// ---- eligibility ------------------------------------------------------------

describe("eligibility", () => {
  let root: string;
  after(() => {
    if (root) cleanup(root);
  });

  test("unvalidated PRB with no decision_basis is still REVIEW_REQUIRED / NO_DECISION_BASIS (never READY)", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "unvalidated" }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.deepEqual(codesOf(report.eligibility.reasons), [REASON.NO_DECISION_BASIS]);
  });

  test("complete valid basis -> READY", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis: fullEligibilityBasis() }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, READY.ELIGIBILITY, JSON.stringify(report.eligibility.reasons));
  });

  test("complete valid basis with affected_populations -> READY", () => {
    root = makeFixtureRoot();
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis: fullEligibilityBasis(), affectedPopulations: "[residents, students]" })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, READY.ELIGIBILITY, JSON.stringify(report.eligibility.reasons));
  });

  test("affected_populations: [] -> REVIEW / MISSING_AFFECTED_POPULATION", () => {
    root = makeFixtureRoot();
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ validationStatus: "validated", decisionBasis: fullEligibilityBasis(), affectedPopulations: "[]" })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.MISSING_AFFECTED_POPULATION));
  });

  test("no decision_basis at all -> REVIEW (NO_DECISION_BASIS)", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated" }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.NO_DECISION_BASIS));
  });

  test("missing manifestation -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullEligibilityBasis({ includeManifestation: false });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.MISSING_MANIFESTATION));
  });

  test("missing consequence -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullEligibilityBasis({ includeConsequence: false });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.MISSING_CONSEQUENCE));
  });

  // A decision_basis.*.evidence field referencing a non-existent EVD-* is
  // already a schema-declared reference (research/schemas/problem.schema.json)
  // enforced by validate.ts's cross-reference check, so it is caught before
  // the corpus ever reaches the readiness engine. The engine still carries
  // its own redundant existence check as defense-in-depth; the two tests
  // below exercise each layer directly.

  test("unknown EVD reference is caught by validation before readiness runs", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullEligibilityBasis({ manifestationEvidence: "[EVD-999999]" });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const index = loadCorpusIndex(root);
    const { errors } = validateCorpusIndex(index);
    assert.ok(errors.length > 0, "expected validation to refuse a corpus with a broken reference");
  });

  test("readiness engine's own evidence-existence check flags an unknown EVD reference -> REVIEW", () => {
    // Directly exercises evaluateEligibility's redundant existence check
    // against a hand-built CorpusIndex, bypassing validate.ts.
    const index = buildManualIndex({
      problems: [
        {
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
        },
      ],
      evidence: [{ evidence_id: "EVD-900101" }],
    });
    const result = evaluateEligibility("PRB-9001", index);
    assert.strictEqual(result.result, REVIEW_REQUIRED);
    assert.ok(codesOf(result.reasons).includes(REASON.UNKNOWN_EVIDENCE_REFERENCE), JSON.stringify(result.reasons));
  });

  test("EVD exists but not linked to target PRB -> REVIEW", () => {
    root = makeFixtureRoot();
    // EVD-900102 exists in the corpus but is not in PRB-9001.evidence.
    const decisionBasis = fullEligibilityBasis({ manifestationEvidence: "[EVD-900102]" });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    write(root, "evidence", "EVD-900102.yaml", evd("EVD-900102"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.EVIDENCE_NOT_LINKED_TO_PRB), JSON.stringify(report.eligibility.reasons));
  });

  test("valid basis with no scope block at all -> READY (scope is a Corroboration-only concern)", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullEligibilityBasis({ includeManifestation: true });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, READY.ELIGIBILITY, JSON.stringify(report.eligibility.reasons));
    assert.ok(!codesOf(report.eligibility.reasons).includes(REASON.MISSING_SCOPE));
    assert.ok(!codesOf(report.eligibility.reasons).includes(REASON.MISSING_SCOPE_BOUNDED));
  });

  test("complete valid basis with no ASM-* records in the corpus -> READY (Eligibility has no Assessment dependency)", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis: fullEligibilityBasis() }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, READY.ELIGIBILITY, JSON.stringify(report.eligibility.reasons));
  });

  test("contradiction_search.performed=false -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullEligibilityBasis({ contradictionPerformed: false });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.CONTRADICTION_SEARCH_NOT_PERFORMED), JSON.stringify(report.eligibility.reasons));
  });

  test("overlap_check missing -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullEligibilityBasis({ includeOverlapCheck: false });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.MISSING_OVERLAP_CHECK_ELIGIBILITY), JSON.stringify(report.eligibility.reasons));
  });

  test("overlap_check.performed=false -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullEligibilityBasis({ overlapPerformed: false });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.OVERLAP_CHECK_NOT_PERFORMED), JSON.stringify(report.eligibility.reasons));
  });

  test("manifestation evidence empty -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullEligibilityBasis({ manifestationEvidence: "[]" });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.MISSING_MANIFESTATION_EVIDENCE), JSON.stringify(report.eligibility.reasons));
  });

  test("consequence evidence empty -> REVIEW", () => {
    const index = buildManualIndex({
      problems: [
        {
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
        },
      ],
      evidence: [{ evidence_id: "EVD-900101" }],
    });
    const result = evaluateEligibility("PRB-9001", index);
    assert.strictEqual(result.result, REVIEW_REQUIRED);
    assert.ok(codesOf(result.reasons).includes(REASON.MISSING_CONSEQUENCE_EVIDENCE), JSON.stringify(result.reasons));
  });

  test("missing contract_version -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullEligibilityBasis({ includeContractVersion: false });
    write(root, "problems", "PRB-9001.yaml", prb({ validationStatus: "validated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.eligibility.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.eligibility.reasons).includes(REASON.MISSING_CONTRACT_VERSION), JSON.stringify(report.eligibility.reasons));
  });

  test("unknown PRB in overlap_check.related_problems -> REVIEW (overlap/deduplication is an Eligibility concern)", () => {
    const index = buildManualIndex({
      problems: [
        {
          problem_id: "PRB-9001",
          problem_statement: PROBLEM_STATEMENT,
          evidence: ["EVD-900101"],
          validation_status: "validated",
          decision_basis: {
            contract_version: "0.1",
            eligibility_basis: "Fixture eligibility reasoning.",
            manifestation: { kind: "access failure", summary: "Fixture manifestation.", evidence: ["EVD-900101"] },
            consequence: { summary: "Fixture consequence.", evidence: ["EVD-900101"] },
            currentness: { assessment: "Fixture currentness call.", evidence: [] },
            contradiction_search: { performed: true, summary: "None found.", evidence: [] },
            overlap_check: { performed: true, summary: "Checked.", related_problems: ["PRB-9999"] },
            limitations: "",
          },
        },
      ],
      evidence: [{ evidence_id: "EVD-900101" }],
    });
    const result = evaluateEligibility("PRB-9001", index);
    assert.strictEqual(result.result, REVIEW_REQUIRED);
    assert.ok(codesOf(result.reasons).includes(REASON.UNKNOWN_RELATED_PROBLEM_REFERENCE), JSON.stringify(result.reasons));
  });
});

// ---- corroboration ------------------------------------------------------------

describe("corroboration", () => {
  let root: string;
  after(() => {
    if (root) cleanup(root);
  });

  test("discovered PRB with no decision_basis is still REVIEW_REQUIRED / NO_DECISION_BASIS (never READY)", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "discovered" }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.deepEqual(codesOf(report.corroboration.reasons), [REASON.NO_DECISION_BASIS]);
  });

  test("valid basis without overlap_check -> READY (overlap/deduplication is an Eligibility concern)", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis: fullCorroborationBasis() }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, READY.CORROBORATION, JSON.stringify(report.corroboration.reasons));
    assert.ok(!codesOf(report.corroboration.reasons).includes(REASON.OVERLAP_CHECK_NOT_PERFORMED));
  });

  test("stale corroboration_statement snapshot -> REVIEW", () => {
    root = makeFixtureRoot();
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      prb({ evidenceStatus: "corroborated", decisionBasis: fullCorroborationBasis({ corroborationStatement: "A stale, no-longer-matching statement." }) })
    );
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.STALE_CORROBORATION_STATEMENT));
  });

  test("currentness missing -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullCorroborationBasis().replace(
      /  currentness:\n    assessment: "Fixture currentness call\."\n    evidence: \[EVD-900101\]\n/,
      ""
    );
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.MISSING_CURRENTNESS_CORROBORATION), JSON.stringify(report.corroboration.reasons));
  });

  test("contradiction_search missing -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullCorroborationBasis().replace(
      /  contradiction_search:\n    performed: true\n    summary: "Contradiction\/current-state search recorded\."\n    evidence: \[\]\n/,
      ""
    );
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.MISSING_CONTRADICTION_SEARCH_CORROBORATION), JSON.stringify(report.corroboration.reasons));
  });

  test("contradiction_search.performed=false -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullCorroborationBasis({ contradictionPerformed: false });
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.CONTRADICTION_SEARCH_NOT_PERFORMED_CORROBORATION), JSON.stringify(report.corroboration.reasons));
  });

  test("missing contract_version -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullCorroborationBasis({ includeContractVersion: false });
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.MISSING_CONTRACT_VERSION), JSON.stringify(report.corroboration.reasons));
  });

  test("scope.bounded absent -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullCorroborationBasis({ includeBounded: false });
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.MISSING_SCOPE_BOUNDED), JSON.stringify(report.corroboration.reasons));
  });

  test("bounded=true + no limitations -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullCorroborationBasis({ bounded: true });
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.BOUNDED_SCOPE_WITHOUT_LIMITATIONS), JSON.stringify(report.corroboration.reasons));
  });

  test("invalid/missing lineage requirement -> REVIEW", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis: fullCorroborationBasis() }));
    // lineage_id present but empty/whitespace-only — structurally broken, not "UNASSESSED".
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101", { lineageId: "   " }));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.LINEAGE_REQUIREMENT_NOT_STRUCTURALLY_AVAILABLE), JSON.stringify(report.corroboration.reasons));
  });

  test("lineage_id absent entirely (UNASSESSED) is structurally fine", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis: fullCorroborationBasis() }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.ok(!codesOf(report.corroboration.reasons).includes(REASON.LINEAGE_REQUIREMENT_NOT_STRUCTURALLY_AVAILABLE), JSON.stringify(report.corroboration.reasons));
  });

  test("missing scope assessment -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullCorroborationBasis({ includeScope: false });
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.MISSING_SCOPE));
  });

  test("complete valid basis with no ASM-* records in the corpus -> READY (Corroboration has no Assessment dependency)", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis: fullCorroborationBasis() }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, READY.CORROBORATION, JSON.stringify(report.corroboration.reasons));
  });

  test("unknown EVD in supporting_evidence is caught by validation before readiness runs", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullCorroborationBasis({ supportingEvidence: "[EVD-999999]" });
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const index = loadCorpusIndex(root);
    const { errors } = validateCorpusIndex(index);
    assert.ok(errors.length > 0, "expected validation to refuse a corpus with a broken reference");
  });

  test("readiness engine's own evidence-existence check flags an unknown EVD reference -> REVIEW", () => {
    const index = buildManualIndex({
      problems: [
        {
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
        },
      ],
      evidence: [{ evidence_id: "EVD-900101" }],
    });
    const result = evaluateCorroboration("PRB-9001", index);
    assert.strictEqual(result.result, REVIEW_REQUIRED);
    assert.ok(codesOf(result.reasons).includes(REASON.UNKNOWN_EVIDENCE_REFERENCE), JSON.stringify(result.reasons));
  });

  test("missing corroboration_basis -> REVIEW", () => {
    root = makeFixtureRoot();
    const decisionBasis = fullCorroborationBasis({ includeCorroborationBasis: false });
    write(root, "problems", "PRB-9001.yaml", prb({ evidenceStatus: "corroborated", decisionBasis }));
    write(root, "evidence", "EVD-900101.yaml", evd("EVD-900101"));
    const report = loadAndEvaluate(root, "PRB-9001");
    assert.strictEqual(report.corroboration.result, REVIEW_REQUIRED);
    assert.ok(codesOf(report.corroboration.reasons).includes(REASON.MISSING_CORROBORATION_BASIS));
  });
});

// ---- manual CorpusIndex builder for tests that bypass validation --------------

/**
 * Builds a minimal, hand-crafted CorpusIndex (bypassing YAML/filesystem
 * loading entirely) for tests that must exercise the readiness engine's
 * own redundant existence checks directly, independent of upstream
 * validation. Mirrors the legacy test-ipe-02.js hand-built-corpus tests.
 */
function buildManualIndex({
  problems,
  evidence,
}: {
  problems: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
}): CorpusIndex {
  function toRecordIndex(records: Record<string, unknown>[], idField: string, prefix: string, directory: string) {
    const parsed = records.map((fields) => ({ file: `${directory}/${fields[idField]}.yaml`, fields }));
    const byId = new Map(parsed.map((r) => [r.fields[idField] as string, r]));
    return {
      schema: { prefix, directory, idField },
      records: parsed,
      byId,
    };
  }

  const byPrefix = new Map();
  byPrefix.set("PRB-", toRecordIndex(problems, "problem_id", "PRB-", "problems"));
  byPrefix.set("EVD-", toRecordIndex(evidence, "evidence_id", "EVD-", "evidence"));
  byPrefix.set("SRC-", toRecordIndex([], "source_id", "SRC-", "sources"));

  const totalRecords = problems.length + evidence.length;
  return { researchRoot: "<manual>", byPrefix, totalRecords } as CorpusIndex;
}
