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
const DIRS = ["sources", "evidence", "problems", "schemas"];

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
solution_landscape_status: not_assessed
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

describe("analyzeCorpus / computeProblemAnalysis", () => {
  let root: string;
  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("unknown problem id returns null", () => {
    root = makeFixtureRoot();
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const index = loadCorpusIndex(root);
    assert.strictEqual(computeProblemAnalysis(index, "PRB-0000"), null);
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
    const index = loadCorpusIndex(root);
    const result = analyzeCorpus(index);
    assert.strictEqual(result.summary.problemCount, 1);
    assert.strictEqual(result.summary.evidenceCount, 1);
    assert.strictEqual(result.summary.sourceCount, 0);
    assert.deepStrictEqual(result.problemIds, ["PRB-9001"]);
  });
});

describe("computeGaps", () => {
  let root: string;
  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("reports only explicit structural/metadata gaps, not fully-covered problems", () => {
    root = makeFixtureRoot();
    // PRB-9001: fully covered — its one linked EVD has an analysis block. No gap.
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd({ analysis: VALID_ANALYSIS }));

    // PRB-9002: untouched — no EVD analysis. Should appear in gaps.
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

    assert.ok(
      result.gaps.some((g) => g === "PRB-9002: 1/1 linked EVD missing analytical metadata (analysis block absent)")
    );
  });

  test("non-active (non-OPEN) problems are excluded from the lineage gap check", () => {
    root = makeFixtureRoot();
    const rejectedPrb = MINIMAL_PRB.replace("status: OPEN", "status: REJECTED");
    write(root, "problems", "PRB-9001.yaml", rejectedPrb);
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const index = loadCorpusIndex(root);
    const gaps = computeGaps(index, analyzeCorpus(index).problems);
    assert.deepStrictEqual(gaps, []);
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
