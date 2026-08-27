import assert from "node:assert/strict";
import test from "node:test";
import { loadCorpusIndex } from "../core/corpus.ts";
import { analyzeCorpus, computeProblemAnalysis } from "./analyze.ts";

test("analysis derives only explicit PRB evidence relationships", () => {
  const index = loadCorpusIndex(`${process.cwd()}/research`);
  const analysis = analyzeCorpus(index);
  assert.deepEqual(analysis.summary, {
    sourceCount: index.byPrefix.get("SRC-")!.records.length,
    evidenceCount: index.byPrefix.get("EVD-")!.records.length,
    problemCount: index.byPrefix.get("PRB-")!.records.length,
    totalRecords: index.totalRecords,
  });
  const prb = index.byPrefix.get("PRB-")!.records[0].fields as { problem_id: string; evidence: unknown[] };
  assert.equal(computeProblemAnalysis(index, prb.problem_id)?.linkedEvdCount, prb.evidence.length);
  assert.equal(computeProblemAnalysis(index, "PRB-NOT-FOUND"), null);
});
