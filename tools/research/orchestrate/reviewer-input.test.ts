import assert from "node:assert/strict";
import test from "node:test";

import { buildReviewerInput } from "./reviewer-input.ts";
import type { GenerationManifest } from "./types.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

function manifest(overrides: Partial<GenerationManifest> = {}): GenerationManifest {
  return {
    schemaVersion: "1",
    mode: "daily-discovery",
    investigationQuestion: "What changed for waste collection this week?",
    candidateFiles: ["SRC-NEW.yaml"],
    claimedRecordIds: ["SRC-NEW"],
    rationale: "SECRET_GENERATOR_SCRATCH_REASONING_MUST_NOT_LEAK",
    ...overrides,
  };
}

test("the reviewer input never includes the primary author's free-form rationale", () => {
  const json = buildReviewerInput({
    baseGitSha: SHA,
    manifest: manifest(),
    candidates: [],
    deltas: [],
    validation: { errors: [], totalRecords: 0 },
    readiness: "READY_FOR_INTEGRATION_GATE",
  });
  assert.equal(json.includes("SECRET_GENERATOR_SCRATCH_REASONING_MUST_NOT_LEAK"), false);
  assert.equal(json.includes("rationale"), false);
});

test("the reviewer input includes only the allow-listed fields", () => {
  const json = buildReviewerInput({
    baseGitSha: SHA,
    manifest: manifest({ mode: "problem-refresh", targetProblemId: "PRB-0001" }),
    candidates: [],
    deltas: [],
    validation: { errors: [], totalRecords: 0 },
    readiness: "READY_FOR_INTEGRATION_GATE",
  });
  const parsed = JSON.parse(json);
  assert.deepEqual(Object.keys(parsed).sort(), [
    "baseGitSha",
    "candidates",
    "deltas",
    "investigationQuestion",
    "mode",
    "readiness",
    "schemaVersion",
    "targetProblemId",
    "validation",
  ]);
});

test("targetProblemId is omitted for daily-discovery, never present as undefined/null", () => {
  const json = buildReviewerInput({
    baseGitSha: SHA,
    manifest: manifest(),
    candidates: [],
    deltas: [],
    validation: { errors: [], totalRecords: 0 },
    readiness: "READY_FOR_INTEGRATION_GATE",
  });
  assert.equal(json.includes("targetProblemId"), false);
});

test("the reviewer input is deterministic canonical JSON: identical logical input yields identical bytes", () => {
  const args = {
    baseGitSha: SHA,
    manifest: manifest(),
    candidates: [],
    deltas: [],
    validation: { errors: [], totalRecords: 0 },
    readiness: "READY_FOR_INTEGRATION_GATE" as const,
  };
  assert.equal(buildReviewerInput(args), buildReviewerInput(args));
});
