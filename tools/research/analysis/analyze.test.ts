/**
 * Focused tests for the TC-03 typed analyzer (analyze.ts): per-problem
 * analysis outputs and structural-gap detection. Preserves the legacy
 * tools/analyze-research.js analytical contract; see analyze.parity.test.ts
 * for direct legacy-vs-new comparisons on the canonical corpus.
 *
 * Run with Node's built-in test runner: node --test tools/research (recursively)
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { analyzeCorpus, computeProblemAnalysis, computeGaps, tally } from "./analyze.ts";
import { loadCorpusIndex } from "../core/corpus.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REAL_RESEARCH_ROOT = join(__dirname, "..", "..", "..", "research");
const REAL_SCHEMAS_DIR = join(REAL_RESEARCH_ROOT, "schemas");
const DIRS = ["sources", "evidence", "problems", "assessments", "schemas"];

function makeFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "evora-tc03-"));
  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  for (const f of readdirSync(REAL_SCHEMAS_DIR)) {
    writeFileSync(join(root, "schemas", f), readFileSync(join(REAL_SCHEMAS_DIR, f), "utf8"));
  }
  return root;
}

function write(root: string, dir: string, filename: string, content: string): void {
  writeFileSync(join(root, dir, filename), content, "utf8");
}

const MINIMAL_PRB = `
problem_id: PRB-9001
title: "Fixture problem"
domain: [example]
geography:
  level: municipality
affected_populations: [residents]
problem_statement: "Fixture statement for analyzer testing."
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
  notes = "Fixture only.",
}: { id?: string; analysis?: string; notes?: string } = {}): string {
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
  gatesBlock = `decision_gates:
  problem_real: PASS
  civic_importance: UNKNOWN
  journey_understood: UNKNOWN
  root_cause_understood: UNKNOWN
  remaining_gap_supported: UNKNOWN
  digital_causality: NOT_ASSESSED
  operability: NOT_ASSESSED
  testability: NOT_ASSESSED`,
}: {
  id?: string;
  problem?: string;
  status?: string;
  triage?: string;
  nextAction?: string;
  criticalUnknowns?: string;
  gatesBlock?: string;
} = {}): string {
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
${gatesBlock}
triage: ${triage}
next_action: "${nextAction}"
notes: "Fixture."
${criticalUnknowns}
`;
}

describe("analyzeCorpus / computeProblemAnalysis", () => {
  let root: string;
  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("zero-ASM corpus works without throwing", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const index = loadCorpusIndex(root);
    const report = computeProblemAnalysis(index, "PRB-9001");
    assert.ok(report);
    assert.strictEqual(report!.asmRecords.length, 0);
    assert.strictEqual(report!.currentAsm, null);
  });

  test("unknown problem id returns null", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const index = loadCorpusIndex(root);
    assert.strictEqual(computeProblemAnalysis(index, "PRB-0000"), null);
  });

  test("one CURRENT ASM is picked up with correct gate/triage reporting", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    write(root, "assessments", "ASM-9001.yaml", minimalAsm({ triage: "PROCEED", nextAction: "Hand off to D4." }));
    const index = loadCorpusIndex(root);
    const report = computeProblemAnalysis(index, "PRB-9001")!;
    assert.ok(report.currentAsm);
    assert.strictEqual(report.currentAsm!.assessment_id, "ASM-9001");
    assert.strictEqual(report.currentAsm!.triage, "PROCEED");
    assert.strictEqual((report.currentAsm!.decision_gates as Record<string, unknown>).problem_real, "PASS");
  });

  test("known lineage count differs from missing-lineage count", () => {
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
      minimalEvd({
        id: "EVD-900101",
        analysis: `
analysis:
  lineage_id: "FIXTURE-LINEAGE-A"
`,
      })
    );
    write(root, "evidence", "EVD-900102.yaml", minimalEvd({ id: "EVD-900102" }));
    const index = loadCorpusIndex(root);
    const report = computeProblemAnalysis(index, "PRB-9001")!;
    assert.strictEqual(report.linkedEvdCount, 2);
    assert.strictEqual(report.knownLineageCount, 1);
    assert.strictEqual(report.missingLineageCount, 1);
  });

  test("does not infer contribution/friction from notes/prose", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    const evd = minimalEvd({
      notes: "This clearly CONFIRMS the problem and shows OPERATIONAL friction, but has no analysis block.",
    });
    write(root, "evidence", "EVD-900101.yaml", evd);
    const index = loadCorpusIndex(root);
    const report = computeProblemAnalysis(index, "PRB-9001")!;
    assert.strictEqual(report.evdWithAnalysisCount, 0);
    assert.deepStrictEqual(report.contributionDistribution, []);
    assert.deepStrictEqual(report.frictionTypeDistribution, []);
  });

  test("analysis field distributions are tallied and sorted", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd({ analysis: VALID_ANALYSIS }));
    const index = loadCorpusIndex(root);
    const report = computeProblemAnalysis(index, "PRB-9001")!;
    assert.deepStrictEqual(report.contributionDistribution, [
      ["CONFIRMS", 1],
      ["REFINES", 1],
    ]);
    assert.deepStrictEqual(report.frictionTypeDistribution, [["OPERATIONAL", 1]]);
    assert.deepStrictEqual(report.verificationDistribution, [["REPORTED", 1]]);
  });

  test("analyzeCorpus summary counts match corpus contents", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    write(root, "assessments", "ASM-9001.yaml", minimalAsm());
    const index = loadCorpusIndex(root);
    const result = analyzeCorpus(index);
    assert.strictEqual(result.summary.problemCount, 1);
    assert.strictEqual(result.summary.evidenceCount, 1);
    assert.strictEqual(result.summary.assessmentCount, 1);
    assert.strictEqual(result.summary.sourceCount, 0);
    assert.deepStrictEqual(result.problemIds, ["PRB-9001"]);
  });
});

describe("computeGaps", () => {
  let root: string;
  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("reports only explicit structural/metadata gaps, not fully-assessed problems", () => {
    root = makeFixtureRoot();
    // PRB-9001: fully covered — CURRENT ASM, all gates PASS, no critical
    // unknowns, and its one linked EVD has an analysis block. No gap.
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd({ analysis: VALID_ANALYSIS }));
    const fullyPassingAsm = minimalAsm({
      triage: "PROCEED",
      nextAction: "Hand off to D4.",
      gatesBlock: `decision_gates:
  problem_real: PASS
  civic_importance: PASS
  journey_understood: PASS
  root_cause_understood: PASS
  remaining_gap_supported: PASS
  digital_causality: PASS
  operability: PASS
  testability: PASS`,
    });
    write(root, "assessments", "ASM-9001.yaml", fullyPassingAsm);

    // PRB-9002: untouched — no ASM, no EVD analysis. Should appear in gaps.
    const prb2 = MINIMAL_PRB.replace("PRB-9001", "PRB-9002").replace(
      "evidence: [EVD-900101]",
      "evidence: [EVD-900201]"
    );
    write(root, "problems", "PRB-9002.yaml", prb2);
    write(root, "evidence", "EVD-900201.yaml", minimalEvd({ id: "EVD-900201" }));

    const index = loadCorpusIndex(root);
    const result = analyzeCorpus(index);

    const gapsAboutPrb1 = result.gaps.filter((g) => g.includes("PRB-9001"));
    assert.deepStrictEqual(gapsAboutPrb1, []);

    assert.ok(result.gaps.some((g) => g === "active PRB-9002 has no ASM record"));
    assert.ok(
      result.gaps.some((g) => g === "PRB-9002: 1/1 linked EVD missing analytical metadata (analysis block absent)")
    );
  });

  test("active problem with ASM but none CURRENT is a gap", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd({ analysis: VALID_ANALYSIS }));
    write(root, "assessments", "ASM-9001.yaml", minimalAsm({ status: "SUPERSEDED" }));
    const index = loadCorpusIndex(root);
    const gaps = computeGaps(index, analyzeCorpus(index).problems);
    assert.ok(gaps.includes("active PRB-9001 has ASM record(s) but none with assessment_status=CURRENT"));
  });

  test("non-active (non-OPEN) problems are excluded from ASM/lineage gap checks", () => {
    root = makeFixtureRoot();
    const rejectedPrb = MINIMAL_PRB.replace("status: OPEN", "status: REJECTED");
    write(root, "problems", "PRB-9001.yaml", rejectedPrb);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const index = loadCorpusIndex(root);
    const gaps = computeGaps(index, analyzeCorpus(index).problems);
    assert.deepStrictEqual(gaps, []);
  });

  test("decision gate UNKNOWN/NOT_ASSESSED and critical_unknowns are reported per ASM regardless of PRB status", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd({ analysis: VALID_ANALYSIS }));
    const asmWithUnknown = minimalAsm({
      criticalUnknowns: `
critical_unknowns:
  U1:
    question: "What happens after a resident report?"
    decision_impact: HIGH
    target_phase: D3
    best_next_evidence:
      - "operational data"
`,
    });
    write(root, "assessments", "ASM-9001.yaml", asmWithUnknown);
    const index = loadCorpusIndex(root);
    const gaps = computeGaps(index, analyzeCorpus(index).problems);
    assert.ok(gaps.some((g) => g.includes("decision gate(s) UNKNOWN/NOT_ASSESSED")));
    assert.ok(gaps.some((g) => g === "ASM-9001: 1 critical unknown(s) recorded"));
  });

  test("triage=DEEPEN without next_action is a gap", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd({ analysis: VALID_ANALYSIS }));
    write(root, "assessments", "ASM-9001.yaml", minimalAsm({ triage: "DEEPEN", nextAction: "" }));
    const index = loadCorpusIndex(root);
    const gaps = computeGaps(index, analyzeCorpus(index).problems);
    assert.ok(gaps.includes("ASM-9001: triage=DEEPEN without a usable next_action"));
  });
});

describe("tally", () => {
  test("sorts by value and ignores null/undefined", () => {
    assert.deepStrictEqual(tally(["b", "a", "b", null, undefined]), [
      ["a", 1],
      ["b", 2],
    ]);
  });

  test("empty input yields empty distribution", () => {
    assert.deepStrictEqual(tally([]), []);
  });
});
