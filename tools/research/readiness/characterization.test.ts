/**
 * Characterization tests for the typed readiness engine (readiness.ts)
 * against the canonical research/ corpus, per TC-04.
 *
 * These freeze the readiness contract previously implemented by
 * tools/evaluate-research-decisions.js (now removed): every expected
 * value below was captured by running the legacy evaluator's
 * loadCorpus/evaluateProblem against the exact canonical corpus exercised
 * here, before the legacy file was deleted (see parity.test.ts, which
 * demonstrated byte-for-byte report equality against the legacy
 * evaluator prior to its removal). This file is the durable regression
 * guard for that contract going forward — it does not import or depend
 * on the legacy implementation.
 *
 * Run with Node's built-in test runner: node --test tools/research (recursively)
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { evaluateCorpus, evaluateProblem, READY, REVIEW_REQUIRED } from "./readiness.ts";
import { loadCorpusIndex } from "../core/corpus.ts";
import type { ReadinessReport } from "./readiness.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REAL_RESEARCH_ROOT = join(__dirname, "..", "..", "..", "research");

// Captured from the legacy tools/evaluate-research-decisions.js evaluator
// against the canonical research/ corpus (PRB-0001 .. PRB-0010) prior to
// its removal in this change. See the "canonical corpus" parity test for
// the exact comparison that produced this snapshot.
const CANONICAL_EXPECTED: Record<string, { eligibility: ReadinessReport["eligibility"]; corroboration: ReadinessReport["corroboration"] }> = {
  "PRB-0001": {
    eligibility: { result: READY.ELIGIBILITY, reasons: [] },
    corroboration: { result: READY.CORROBORATION, reasons: [] },
  },
  "PRB-0002": {
    eligibility: {
      result: REVIEW_REQUIRED,
      reasons: [{ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" }],
    },
    corroboration: {
      result: REVIEW_REQUIRED,
      reasons: [{ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" }],
    },
  },
  "PRB-0003": {
    eligibility: {
      result: REVIEW_REQUIRED,
      reasons: [{ code: "MISSING_CONSEQUENCE", field: "decision_basis.consequence.summary" }],
    },
    corroboration: { result: READY.CORROBORATION, reasons: [] },
  },
  "PRB-0004": {
    eligibility: {
      result: REVIEW_REQUIRED,
      reasons: [{ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" }],
    },
    corroboration: {
      result: REVIEW_REQUIRED,
      reasons: [{ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" }],
    },
  },
  "PRB-0005": {
    eligibility: {
      result: REVIEW_REQUIRED,
      reasons: [{ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" }],
    },
    corroboration: {
      result: REVIEW_REQUIRED,
      reasons: [{ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" }],
    },
  },
  "PRB-0006": {
    eligibility: { result: READY.ELIGIBILITY, reasons: [] },
    corroboration: { result: READY.CORROBORATION, reasons: [] },
  },
  "PRB-0007": {
    eligibility: {
      result: REVIEW_REQUIRED,
      reasons: [{ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" }],
    },
    corroboration: {
      result: REVIEW_REQUIRED,
      reasons: [{ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" }],
    },
  },
  "PRB-0008": {
    eligibility: {
      result: REVIEW_REQUIRED,
      reasons: [{ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" }],
    },
    corroboration: {
      result: REVIEW_REQUIRED,
      reasons: [{ code: "NO_DECISION_BASIS", detail: "PRB.decision_basis is absent" }],
    },
  },
  "PRB-0009": {
    eligibility: { result: READY.ELIGIBILITY, reasons: [] },
    corroboration: { result: READY.CORROBORATION, reasons: [] },
  },
  "PRB-0010": {
    eligibility: { result: READY.ELIGIBILITY, reasons: [] },
    corroboration: {
      result: REVIEW_REQUIRED,
      reasons: [
        {
          code: "MISSING_SCOPE",
          field: "decision_basis.scope",
          detail: "geography, population, and temporal must all be explicitly authored",
        },
      ],
    },
  },
};

describe("characterization: canonical corpus", () => {
  test("problem IDs match the frozen canonical-corpus snapshot", () => {
    const index = loadCorpusIndex(REAL_RESEARCH_ROOT);
    const reports = evaluateCorpus(index);
    assert.deepEqual(
      reports.map((r) => r.problem_id),
      Object.keys(CANONICAL_EXPECTED)
    );
  });

  test("every canonical PRB's Eligibility/Corroboration readiness matches the frozen snapshot", () => {
    const index = loadCorpusIndex(REAL_RESEARCH_ROOT);
    for (const [prbId, expected] of Object.entries(CANONICAL_EXPECTED)) {
      const report = evaluateProblem(prbId, index);
      assert.ok(report, `${prbId} should resolve`);
      assert.deepEqual(report!.eligibility, expected.eligibility, `${prbId}.eligibility`);
      assert.deepEqual(report!.corroboration, expected.corroboration, `${prbId}.corroboration`);
    }
  });

  test("evaluateProblem returns null for an unknown PRB id", () => {
    const index = loadCorpusIndex(REAL_RESEARCH_ROOT);
    assert.strictEqual(evaluateProblem("PRB-9999", index), null);
  });
});
