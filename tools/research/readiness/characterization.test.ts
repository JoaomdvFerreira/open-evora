import assert from "node:assert/strict";
import test from "node:test";
import { loadCorpusIndex } from "../core/corpus.ts";

test("readiness characterization keeps all canonical record families available", () => {
  const index = loadCorpusIndex(`${process.cwd()}/research`);
  assert.deepEqual([...index.byPrefix.keys()].sort(), ["EVD-", "PRB-", "SRC-"]);
  assert.equal(index.totalRecords, 243);
});
