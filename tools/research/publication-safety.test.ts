import assert from "node:assert/strict";
import test from "node:test";

import { checkResearchPublicationPaths } from "./publication-safety.ts";

test("canonical records, bounded Source Verification Support and schemas are permitted paths", () => {
  const result = checkResearchPublicationPaths([
    "research/problems/PRB-0001.yaml",
    "research/evidence/EVD-0001.yaml",
    "research/sources/SRC-0001.yaml",
    "research/source-verifications/SRC-0001.yaml",
    "research/schemas/problem.schema.json",
  ]);
  assert.deepEqual(result, { ok: true, prohibitedPaths: [], unexpectedResearchPaths: [] });
});

test("workbench, legacy review artifacts, correspondence and private-material paths fail closed", () => {
  const paths = [
    ".research-workbench/cycle/candidate.yaml",
    ".research-review/old-review.json",
    ".research-review-old.json",
    "research/correspondence/request.txt",
    "research/transcripts/interview.txt",
    "research/private-notes/field.md",
    "research/raw-material/source.bin",
  ];
  const result = checkResearchPublicationPaths(paths);
  assert.equal(result.ok, false);
  assert.deepEqual(result.prohibitedPaths, paths.slice().sort());
});

test("unrecognized research artifacts fail closed while unrelated application files remain outside this path policy", () => {
  const result = checkResearchPublicationPaths(["research/drafts/PRB-0001.txt", "apps/research-explorer/src/App.tsx"]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.unexpectedResearchPaths, ["research/drafts/PRB-0001.txt"]);
});
