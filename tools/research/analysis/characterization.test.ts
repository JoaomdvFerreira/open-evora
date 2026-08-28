import assert from "node:assert/strict";
import test from "node:test";
import { loadCorpusIndex } from "../core/corpus.ts";

test("vNext characterization retains bounded EVD and PRB relationship coverage", () => {
  const index = loadCorpusIndex(`${process.cwd()}/research`);
  const evds = index.byPrefix.get("EVD-")!.records;
  const prbs = index.byPrefix.get("PRB-")!.records;
  assert.ok(evds.every(({ fields }) => "observation" in fields && "scope" in fields && "provenance" in fields && "inference_limits" in fields));
  assert.equal(prbs.flatMap(({ fields }) => fields.evidence as unknown[]).length, 102);
});
