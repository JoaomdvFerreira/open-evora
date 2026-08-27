import assert from "node:assert/strict";
import test from "node:test";
import { loadCorpusIndex } from "../core/corpus.ts";
import { analyzeCorpus, computeProblemAnalysis } from "./analyze.ts";

test("analysis derives only explicit PRB evidence relationships", () => {
  const index = loadCorpusIndex(`${process.cwd()}/research`);
  const analysis = analyzeCorpus(index);
  assert.deepEqual(analysis.summary, { sourceCount: 107, evidenceCount: 126, problemCount: 10, totalRecords: 243 });
  assert.equal(computeProblemAnalysis(index, "PRB-0001")?.linkedEvdCount, 9);
  assert.equal(computeProblemAnalysis(index, "PRB-9999"), null);
});
