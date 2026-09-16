import assert from "node:assert/strict";
import test from "node:test";

import { validateManifest } from "./manifest.ts";

function validManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "1",
    mode: "daily-discovery",
    investigationQuestion: "What changed for waste collection this week?",
    candidateFiles: ["SRC-NEW.yaml"],
    claimedRecordIds: ["SRC-NEW"],
    rationale: "Synthetic fixture rationale.",
    ...overrides,
  };
}

test("a well-formed daily-discovery manifest passes with zero errors", () => {
  assert.deepEqual(validateManifest(validManifest()).errors, []);
});

test("a well-formed problem-refresh manifest requires targetProblemId", () => {
  const manifest = validManifest({ mode: "problem-refresh", targetProblemId: "PRB-0001" });
  assert.deepEqual(validateManifest(manifest).errors, []);
});

test("problem-refresh without targetProblemId fails closed", () => {
  const manifest = validManifest({ mode: "problem-refresh" });
  const { errors } = validateManifest(manifest);
  assert.equal(errors.length > 0, true);
  assert.match(errors.join("\n"), /targetProblemId/);
});

test("daily-discovery with a targetProblemId fails closed", () => {
  const manifest = validManifest({ targetProblemId: "PRB-0001" });
  const { errors } = validateManifest(manifest);
  assert.match(errors.join("\n"), /must be absent/);
});

test("a non-object manifest fails closed", () => {
  assert.deepEqual(validateManifest(null).errors, ["manifest must be an object"]);
  assert.deepEqual(validateManifest("not an object").errors, ["manifest must be an object"]);
  assert.deepEqual(validateManifest([1, 2]).errors, ["manifest must be an object"]);
});

test("an unknown mode fails closed", () => {
  const { errors } = validateManifest(validManifest({ mode: "unknown-mode" }));
  assert.match(errors.join("\n"), /manifest\.mode must be one of/);
});

test("missing investigationQuestion/rationale fail closed", () => {
  const { errors } = validateManifest(validManifest({ investigationQuestion: "", rationale: "   " }));
  assert.match(errors.join("\n"), /investigationQuestion must be a non-empty string/);
  assert.match(errors.join("\n"), /rationale must be a non-empty string/);
});

test("mismatched candidateFiles/claimedRecordIds lengths fail closed", () => {
  const { errors } = validateManifest(validManifest({ candidateFiles: ["A.yaml", "B.yaml"], claimedRecordIds: ["A"] }));
  assert.match(errors.join("\n"), /same length/);
});

test("empty candidateFiles/claimedRecordIds arrays fail closed", () => {
  const { errors } = validateManifest(validManifest({ candidateFiles: [], claimedRecordIds: [] }));
  assert.match(errors.join("\n"), /candidateFiles must be a non-empty array/);
  assert.match(errors.join("\n"), /claimedRecordIds must be a non-empty array/);
});

test("wrong schemaVersion fails closed", () => {
  const { errors } = validateManifest(validManifest({ schemaVersion: "2" }));
  assert.match(errors.join("\n"), /schemaVersion must be exactly "1"/);
});

// WU045-B01 independent-review remediation, finding 2: manifest.candidateFiles
// entries are untrusted AI output consumed directly by loadCandidates()'s
// filesystem read path, so they must be rejected structurally here too.
test("a ../escape entry in candidateFiles fails closed", () => {
  const { errors } = validateManifest(validManifest({ candidateFiles: ["../escape.yaml"] }));
  assert.match(errors.join("\n"), /bounded relative path/);
});

test("an absolute path entry in candidateFiles fails closed", () => {
  const { errors } = validateManifest(validManifest({ candidateFiles: ["/etc/passwd"] }));
  assert.match(errors.join("\n"), /bounded relative path/);
});

test("a benign nested candidateFiles entry is accepted", () => {
  assert.deepEqual(validateManifest(validManifest({ candidateFiles: ["nested/SRC-NEW.yaml"] })).errors, []);
});
