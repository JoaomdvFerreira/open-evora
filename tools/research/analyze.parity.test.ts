/**
 * Characterization tests for the typed analyzer (analyze.ts) against the
 * canonical research/ corpus and representative fixture corpora, per TC-03.
 *
 * These freeze the analysis contract previously implemented by
 * tools/analyze-research.js (now removed): every expected value below was
 * captured by running the legacy analyzer's loadCorpus/computeProblemReport
 * against the exact corpora exercised here, before the legacy file was
 * deleted. This file is the durable regression guard for that contract —
 * it does not import or depend on the legacy implementation.
 *
 * Run with Node's built-in test runner: node --test tools/research/*.test.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { analyzeCorpus, computeProblemAnalysis } from "./analyze.ts";
import { loadCorpusIndex } from "./corpus.ts";
import type { ProblemAnalysis } from "./analyze.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REAL_RESEARCH_ROOT = join(__dirname, "..", "..", "research");
const REAL_SCHEMAS_DIR = join(REAL_RESEARCH_ROOT, "schemas");
const DIRS = ["sources", "evidence", "problems", "assessments", "schemas"];

function makeFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "evora-tc03-char-"));
  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  for (const f of readdirSync(REAL_SCHEMAS_DIR)) {
    writeFileSync(join(root, "schemas", f), readFileSync(join(REAL_SCHEMAS_DIR, f), "utf8"));
  }
  return root;
}

function write(root: string, dir: string, filename: string, content: string): void {
  writeFileSync(join(root, dir, filename), content, "utf8");
}

function assertReportMatches(
  prbId: string,
  report: ProblemAnalysis,
  expected: {
    linkedEvdCount: number;
    evdWithAnalysisCount: number;
    knownLineageCount: number;
    missingLineageCount: number;
    contributionDistribution: Array<[string, number]>;
    frictionTypeDistribution: Array<[string, number]>;
    verificationDistribution: Array<[string, number]>;
    temporalRelevanceDistribution: Array<[string, number]>;
    representativenessDistribution: Array<[string, number]>;
    publicSignalClassDistribution: Array<[string, number]>;
    asmRecordCount: number;
    currentAsmId: string | null;
    currentAsmTriage: string | null;
  }
): void {
  assert.strictEqual(report.linkedEvdCount, expected.linkedEvdCount, `${prbId}.linkedEvdCount`);
  assert.strictEqual(report.evdWithAnalysisCount, expected.evdWithAnalysisCount, `${prbId}.evdWithAnalysisCount`);
  assert.strictEqual(report.knownLineageCount, expected.knownLineageCount, `${prbId}.knownLineageCount`);
  assert.strictEqual(report.missingLineageCount, expected.missingLineageCount, `${prbId}.missingLineageCount`);
  assert.deepEqual(report.contributionDistribution, expected.contributionDistribution, `${prbId}.contributionDistribution`);
  assert.deepEqual(report.frictionTypeDistribution, expected.frictionTypeDistribution, `${prbId}.frictionTypeDistribution`);
  assert.deepEqual(report.verificationDistribution, expected.verificationDistribution, `${prbId}.verificationDistribution`);
  assert.deepEqual(
    report.temporalRelevanceDistribution,
    expected.temporalRelevanceDistribution,
    `${prbId}.temporalRelevanceDistribution`
  );
  assert.deepEqual(
    report.representativenessDistribution,
    expected.representativenessDistribution,
    `${prbId}.representativenessDistribution`
  );
  assert.deepEqual(
    report.publicSignalClassDistribution,
    expected.publicSignalClassDistribution,
    `${prbId}.publicSignalClassDistribution`
  );
  assert.strictEqual(report.asmRecords.length, expected.asmRecordCount, `${prbId}.asmRecords.length`);
  assert.strictEqual(report.currentAsm ? (report.currentAsm.assessment_id as string) : null, expected.currentAsmId, `${prbId}.currentAsm.assessment_id`);
  assert.strictEqual(report.currentAsm ? (report.currentAsm.triage as string) : null, expected.currentAsmTriage, `${prbId}.currentAsm.triage`);
}

// Captured from the legacy tools/analyze-research.js analyzer against the
// canonical research/ corpus (10 PRB, 128 EVD, 98 SRC, 10 ASM, 246 total
// records) prior to its removal in this change.
const CANONICAL_EXPECTED: Record<string, Parameters<typeof assertReportMatches>[2]> = {
  "PRB-0001": {
    linkedEvdCount: 10,
    evdWithAnalysisCount: 10,
    knownLineageCount: 5,
    missingLineageCount: 1,
    contributionDistribution: [["CONFIRMS", 5], ["CURRENT-STATE-UPDATE", 2], ["EXISTING-SOLUTION", 1], ["REFINES", 6]],
    frictionTypeDistribution: [["INFORMATION", 2], ["OPERATIONAL", 7]],
    verificationDistribution: [["REPORTED", 2], ["UNKNOWN", 1], ["VERIFIED", 7]],
    temporalRelevanceDistribution: [["CURRENT", 7], ["HISTORICAL", 3]],
    representativenessDistribution: [["DESIGNED_REPRESENTATIVE", 5], ["UNKNOWN", 5]],
    publicSignalClassDistribution: [["PS3", 1]],
    asmRecordCount: 1,
    currentAsmId: "ASM-0001",
    currentAsmTriage: "DEEPEN",
  },
  "PRB-0002": {
    linkedEvdCount: 6,
    evdWithAnalysisCount: 6,
    knownLineageCount: 2,
    missingLineageCount: 3,
    contributionDistribution: [["CONFIRMS", 3], ["EXISTING-SOLUTION", 2], ["PLANNED-SOLUTION", 1], ["REFINES", 2]],
    frictionTypeDistribution: [["INFORMATION", 6], ["OPERATIONAL", 2]],
    verificationDistribution: [["REPORTED", 1], ["VERIFIED", 5]],
    temporalRelevanceDistribution: [["CURRENT", 4], ["HISTORICAL", 2]],
    representativenessDistribution: [["NOT_APPLICABLE", 3], ["UNKNOWN", 3]],
    publicSignalClassDistribution: [["PS3", 1]],
    asmRecordCount: 1,
    currentAsmId: "ASM-0002",
    currentAsmTriage: "DEEPEN",
  },
  "PRB-0003": {
    linkedEvdCount: 15,
    evdWithAnalysisCount: 14,
    knownLineageCount: 4,
    missingLineageCount: 5,
    contributionDistribution: [
      ["CONFIRMS", 7],
      ["CURRENT-STATE-UPDATE", 7],
      ["EXISTING-SOLUTION", 4],
      ["PLANNED-SOLUTION", 1],
      ["REFINES", 6],
    ],
    frictionTypeDistribution: [["COORDINATION", 1], ["INFORMATION", 1], ["PHYSICAL", 14]],
    verificationDistribution: [["REPORTED", 8], ["UNKNOWN", 4], ["VERIFIED", 2]],
    temporalRelevanceDistribution: [["CURRENT", 9], ["HISTORICAL", 4], ["UNKNOWN", 1]],
    representativenessDistribution: [["LIMITED", 6], ["NOT_APPLICABLE", 1], ["UNKNOWN", 7]],
    publicSignalClassDistribution: [],
    asmRecordCount: 1,
    currentAsmId: "ASM-0003",
    currentAsmTriage: "DEEPEN",
  },
  "PRB-0004": {
    linkedEvdCount: 6,
    evdWithAnalysisCount: 6,
    knownLineageCount: 2,
    missingLineageCount: 3,
    contributionDistribution: [
      ["CONFIRMS", 2],
      ["CURRENT-STATE-UPDATE", 1],
      ["EXISTING-SOLUTION", 1],
      ["PLANNED-SOLUTION", 1],
      ["REFINES", 2],
    ],
    frictionTypeDistribution: [["INFORMATION", 2], ["PHYSICAL", 5]],
    verificationDistribution: [["REPORTED", 1], ["UNKNOWN", 1], ["VERIFIED", 4]],
    temporalRelevanceDistribution: [["CURRENT", 1], ["HISTORICAL", 5]],
    representativenessDistribution: [
      ["DESIGNED_REPRESENTATIVE", 1],
      ["LIMITED", 1],
      ["NOT_APPLICABLE", 3],
      ["UNKNOWN", 1],
    ],
    publicSignalClassDistribution: [],
    asmRecordCount: 1,
    currentAsmId: "ASM-0004",
    currentAsmTriage: "DEEPEN",
  },
  "PRB-0005": {
    linkedEvdCount: 8,
    evdWithAnalysisCount: 8,
    knownLineageCount: 5,
    missingLineageCount: 1,
    contributionDistribution: [["CONFIRMS", 4], ["EXISTING-SOLUTION", 1], ["REFINES", 3]],
    frictionTypeDistribution: [["INFORMATION", 4], ["OPERATIONAL", 3], ["PHYSICAL", 3], ["REGULATORY", 1]],
    verificationDistribution: [["REPORTED", 2], ["UNKNOWN", 2], ["VERIFIED", 4]],
    temporalRelevanceDistribution: [["CURRENT", 4], ["HISTORICAL", 4]],
    representativenessDistribution: [
      ["DESIGNED_REPRESENTATIVE", 2],
      ["LIMITED", 3],
      ["NOT_APPLICABLE", 1],
      ["UNKNOWN", 2],
    ],
    publicSignalClassDistribution: [],
    asmRecordCount: 1,
    currentAsmId: "ASM-0005",
    currentAsmTriage: "DEEPEN",
  },
  "PRB-0006": {
    linkedEvdCount: 10,
    evdWithAnalysisCount: 10,
    knownLineageCount: 1,
    missingLineageCount: 7,
    contributionDistribution: [
      ["CONFIRMS", 2],
      ["CONTRADICTS", 1],
      ["CURRENT-STATE-UPDATE", 5],
      ["EXISTING-SOLUTION", 3],
      ["REFINES", 4],
    ],
    frictionTypeDistribution: [["INFORMATION", 2], ["OPERATIONAL", 2], ["OTHER", 7], ["TRANSACTION", 2]],
    verificationDistribution: [["REPORTED", 4], ["UNKNOWN", 3], ["VERIFIED", 3]],
    temporalRelevanceDistribution: [["CURRENT", 7], ["HISTORICAL", 3]],
    representativenessDistribution: [["NOT_APPLICABLE", 4], ["UNKNOWN", 6]],
    publicSignalClassDistribution: [],
    asmRecordCount: 1,
    currentAsmId: "ASM-0006",
    currentAsmTriage: "WATCH",
  },
  "PRB-0007": {
    linkedEvdCount: 9,
    evdWithAnalysisCount: 9,
    knownLineageCount: 2,
    missingLineageCount: 2,
    contributionDistribution: [
      ["CONFIRMS", 5],
      ["CURRENT-STATE-UPDATE", 1],
      ["EXISTING-SOLUTION", 3],
      ["PLANNED-SOLUTION", 1],
      ["REFINES", 3],
    ],
    frictionTypeDistribution: [["COORDINATION", 3], ["INFORMATION", 4], ["TRANSACTION", 2]],
    verificationDistribution: [["REPORTED", 4], ["VERIFIED", 5]],
    temporalRelevanceDistribution: [["CURRENT", 8], ["HISTORICAL", 1]],
    representativenessDistribution: [["LIMITED", 6], ["NOT_APPLICABLE", 3]],
    publicSignalClassDistribution: [],
    asmRecordCount: 1,
    currentAsmId: "ASM-0007",
    currentAsmTriage: "DEEPEN",
  },
  "PRB-0008": {
    linkedEvdCount: 11,
    evdWithAnalysisCount: 11,
    knownLineageCount: 2,
    missingLineageCount: 8,
    contributionDistribution: [
      ["CONFIRMS", 2],
      ["CURRENT-STATE-UPDATE", 1],
      ["EXISTING-SOLUTION", 5],
      ["REFINES", 6],
    ],
    frictionTypeDistribution: [["INFORMATION", 4], ["OTHER", 7]],
    verificationDistribution: [["UNKNOWN", 7], ["VERIFIED", 4]],
    temporalRelevanceDistribution: [["CURRENT", 6], ["HISTORICAL", 2], ["UNKNOWN", 3]],
    representativenessDistribution: [["LIMITED", 4], ["UNKNOWN", 7]],
    publicSignalClassDistribution: [],
    asmRecordCount: 1,
    currentAsmId: "ASM-0008",
    currentAsmTriage: "DEEPEN",
  },
  "PRB-0009": {
    linkedEvdCount: 15,
    evdWithAnalysisCount: 15,
    knownLineageCount: 6,
    missingLineageCount: 7,
    contributionDistribution: [
      ["CONFIRMS", 6],
      ["CURRENT-STATE-UPDATE", 3],
      ["EXISTING-SOLUTION", 1],
      ["REFINES", 7],
    ],
    frictionTypeDistribution: [["COORDINATION", 3], ["INFORMATION", 3], ["OPERATIONAL", 7], ["TRANSACTION", 3]],
    verificationDistribution: [["REPORTED", 11], ["VERIFIED", 4]],
    temporalRelevanceDistribution: [["CURRENT", 11], ["HISTORICAL", 2], ["UNKNOWN", 2]],
    representativenessDistribution: [["LIMITED", 4], ["NOT_APPLICABLE", 9], ["UNKNOWN", 2]],
    publicSignalClassDistribution: [["PS1", 2], ["PS2", 2]],
    asmRecordCount: 1,
    currentAsmId: "ASM-0009",
    currentAsmTriage: "WATCH",
  },
  "PRB-0010": {
    linkedEvdCount: 3,
    evdWithAnalysisCount: 3,
    knownLineageCount: 0,
    missingLineageCount: 3,
    contributionDistribution: [["CONFIRMS", 2], ["CURRENT-STATE-UPDATE", 2], ["REFINES", 1]],
    frictionTypeDistribution: [["PHYSICAL", 3]],
    verificationDistribution: [["REPORTED", 3]],
    temporalRelevanceDistribution: [["CURRENT", 2], ["HISTORICAL", 1]],
    representativenessDistribution: [["LIMITED", 1], ["UNKNOWN", 2]],
    publicSignalClassDistribution: [],
    asmRecordCount: 1,
    currentAsmId: "ASM-0010",
    currentAsmTriage: "WATCH",
  },
};

const CANONICAL_EXPECTED_GAPS = [
  "PRB-0003: 1/15 linked EVD missing analytical metadata (analysis block absent)",
  "ASM-0001: 3 decision gate(s) UNKNOWN/NOT_ASSESSED (digital_causality=NOT_ASSESSED, operability=NOT_ASSESSED, testability=NOT_ASSESSED)",
  "ASM-0001: 2 critical unknown(s) recorded",
  "ASM-0002: 3 decision gate(s) UNKNOWN/NOT_ASSESSED (digital_causality=NOT_ASSESSED, operability=NOT_ASSESSED, testability=NOT_ASSESSED)",
  "ASM-0002: 2 critical unknown(s) recorded",
  "ASM-0003: 1 decision gate(s) UNKNOWN/NOT_ASSESSED (operability=NOT_ASSESSED)",
  "ASM-0003: 1 critical unknown(s) recorded",
  "ASM-0004: 2 decision gate(s) UNKNOWN/NOT_ASSESSED (civic_importance=UNKNOWN, operability=NOT_ASSESSED)",
  "ASM-0004: 2 critical unknown(s) recorded",
  "ASM-0005: 1 decision gate(s) UNKNOWN/NOT_ASSESSED (operability=NOT_ASSESSED)",
  "ASM-0005: 3 critical unknown(s) recorded",
  "ASM-0006: 1 decision gate(s) UNKNOWN/NOT_ASSESSED (operability=NOT_ASSESSED)",
  "ASM-0006: 1 critical unknown(s) recorded",
  "ASM-0007: 3 decision gate(s) UNKNOWN/NOT_ASSESSED (digital_causality=NOT_ASSESSED, operability=NOT_ASSESSED, testability=NOT_ASSESSED)",
  "ASM-0007: 3 critical unknown(s) recorded",
  "ASM-0008: 2 decision gate(s) UNKNOWN/NOT_ASSESSED (digital_causality=NOT_ASSESSED, operability=NOT_ASSESSED)",
  "ASM-0008: 2 critical unknown(s) recorded",
  "ASM-0009: 2 decision gate(s) UNKNOWN/NOT_ASSESSED (operability=NOT_ASSESSED, testability=NOT_ASSESSED)",
  "ASM-0009: 3 critical unknown(s) recorded",
  "ASM-0010: 2 decision gate(s) UNKNOWN/NOT_ASSESSED (operability=NOT_ASSESSED, testability=NOT_ASSESSED)",
  "ASM-0010: 1 critical unknown(s) recorded",
];

describe("characterization: canonical corpus", () => {
  test("summary counts match the frozen canonical-corpus snapshot", () => {
    const index = loadCorpusIndex(REAL_RESEARCH_ROOT);
    const result = analyzeCorpus(index);
    assert.strictEqual(result.summary.sourceCount, 98);
    assert.strictEqual(result.summary.evidenceCount, 128);
    assert.strictEqual(result.summary.problemCount, 10);
    assert.strictEqual(result.summary.assessmentCount, 10);
    assert.strictEqual(result.summary.totalRecords, 246);
    assert.deepEqual(result.problemIds, Object.keys(CANONICAL_EXPECTED));
  });

  test("every canonical PRB's per-problem analysis matches the frozen snapshot", () => {
    const index = loadCorpusIndex(REAL_RESEARCH_ROOT);
    for (const [prbId, expected] of Object.entries(CANONICAL_EXPECTED)) {
      const report = computeProblemAnalysis(index, prbId);
      assert.ok(report, `${prbId} should resolve`);
      assertReportMatches(prbId, report!, expected);
    }
  });

  test("structural gaps match the frozen snapshot", () => {
    const index = loadCorpusIndex(REAL_RESEARCH_ROOT);
    const result = analyzeCorpus(index);
    assert.deepEqual(result.gaps, CANONICAL_EXPECTED_GAPS);
  });
});

const MINIMAL_PRB = `
problem_id: PRB-9001
title: "Fixture problem"
domain: [example]
geography:
  level: municipality
affected_populations: [residents]
problem_statement: "Fixture statement for analyzer characterization testing."
evidence: [EVD-900101]
evidence_status: discovered
validation_status: unvalidated
digital_tractability: not_assessed
existing_solutions: not_assessed
status: OPEN
`;

function minimalEvd({
  id = "EVD-900101",
  analysis = "",
}: { id?: string; analysis?: string } = {}): string {
  return `
evidence_id: ${id}
type: observation
source:
  publisher: "Fixture Publisher"
  title: "Fixture Source"
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
}: { id?: string; problem?: string; status?: string; triage?: string } = {}): string {
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
next_action: "Fixture next action."
notes: "Fixture."
`;
}

// These fixture cases mirror the corpus shapes previously used to
// demonstrate legacy-vs-new parity for TC-03 (zero-ASM, one CURRENT ASM,
// multiple ASM none CURRENT, mixed lineage, multi-problem coverage).
// Expected values are asserted directly rather than by importing the
// removed legacy module.
describe("characterization: fixture corpora", () => {
  let root: string;
  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("zero-ASM problem", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const index = loadCorpusIndex(root);
    const report = computeProblemAnalysis(index, "PRB-9001")!;
    assertReportMatches("PRB-9001", report, {
      linkedEvdCount: 1,
      evdWithAnalysisCount: 0,
      knownLineageCount: 0,
      missingLineageCount: 1,
      contributionDistribution: [],
      frictionTypeDistribution: [],
      verificationDistribution: [],
      temporalRelevanceDistribution: [],
      representativenessDistribution: [],
      publicSignalClassDistribution: [],
      asmRecordCount: 0,
      currentAsmId: null,
      currentAsmTriage: null,
    });
  });

  test("one CURRENT ASM with analysis metadata", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd({ analysis: VALID_ANALYSIS }));
    write(root, "assessments", "ASM-9001.yaml", minimalAsm());
    const index = loadCorpusIndex(root);
    const report = computeProblemAnalysis(index, "PRB-9001")!;
    assertReportMatches("PRB-9001", report, {
      linkedEvdCount: 1,
      evdWithAnalysisCount: 1,
      knownLineageCount: 1,
      missingLineageCount: 0,
      contributionDistribution: [["CONFIRMS", 1], ["REFINES", 1]],
      frictionTypeDistribution: [["OPERATIONAL", 1]],
      verificationDistribution: [["REPORTED", 1]],
      temporalRelevanceDistribution: [["CURRENT", 1]],
      representativenessDistribution: [["UNKNOWN", 1]],
      publicSignalClassDistribution: [["PS1", 1]],
      asmRecordCount: 1,
      currentAsmId: "ASM-9001",
      currentAsmTriage: "DEEPEN",
    });
  });

  test("multiple ASM records, none CURRENT", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    write(root, "assessments", "ASM-9001.yaml", minimalAsm({ status: "SUPERSEDED" }));
    write(root, "assessments", "ASM-9002.yaml", minimalAsm({ id: "ASM-9002", status: "ARCHIVED" }));
    const index = loadCorpusIndex(root);
    const report = computeProblemAnalysis(index, "PRB-9001")!;
    assert.strictEqual(report.asmRecords.length, 2);
    assert.strictEqual(report.currentAsm, null);
  });

  test("mixed lineage known/missing across multiple EVD", () => {
    root = makeFixtureRoot();
    const prbTwoEvd = MINIMAL_PRB.replace(
      "evidence: [EVD-900101]",
      "evidence: [EVD-900101, EVD-900102]"
    );
    write(root, "problems", "PRB-9001.yaml", prbTwoEvd);
    write(
      root,
      "evidence",
      "EVD-900101.yaml",
      minimalEvd({ id: "EVD-900101", analysis: "\nanalysis:\n  lineage_id: \"FIXTURE-LINEAGE-A\"\n" })
    );
    write(root, "evidence", "EVD-900102.yaml", minimalEvd({ id: "EVD-900102" }));
    const index = loadCorpusIndex(root);
    const report = computeProblemAnalysis(index, "PRB-9001")!;
    assert.strictEqual(report.linkedEvdCount, 2);
    assert.strictEqual(report.knownLineageCount, 1);
    assert.strictEqual(report.missingLineageCount, 1);
  });

  test("multiple problems with mixed coverage", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd({ analysis: VALID_ANALYSIS }));
    write(root, "assessments", "ASM-9001.yaml", minimalAsm({ triage: "PROCEED" }));

    const prb2 = MINIMAL_PRB.replace("PRB-9001", "PRB-9002")
      .replace("evidence: [EVD-900101]", "evidence: [EVD-900201]")
      .replace("status: OPEN", "status: REJECTED");
    write(root, "problems", "PRB-9002.yaml", prb2);
    write(root, "evidence", "EVD-900201.yaml", minimalEvd({ id: "EVD-900201" }));

    const index = loadCorpusIndex(root);
    const result = analyzeCorpus(index);
    assert.deepEqual(result.problemIds, ["PRB-9001", "PRB-9002"]);

    const report1 = result.problems.get("PRB-9001")!;
    assert.strictEqual(report1.currentAsm!.triage, "PROCEED");
    assert.strictEqual(report1.evdWithAnalysisCount, 1);

    const report2 = result.problems.get("PRB-9002")!;
    assert.strictEqual(report2.currentAsm, null);
    assert.strictEqual(report2.evdWithAnalysisCount, 0);
    // PRB-9002 is REJECTED (non-active), so it is excluded from --gaps checks.
    assert.deepEqual(
      result.gaps.filter((g) => g.includes("PRB-9002")),
      []
    );
  });
});
