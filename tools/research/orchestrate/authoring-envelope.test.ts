import assert from "node:assert/strict";
import test from "node:test";

import { validateAuthoringEnvelope } from "./authoring-envelope.ts";
import { buildPrimaryAuthoringPrompt } from "./primary-prompt.ts";

function validEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "1",
    manifest: {
      schemaVersion: "1",
      mode: "daily-discovery",
      investigationQuestion: "What changed for waste collection this week?",
      candidateFiles: ["SRC-NEW.yaml"],
      claimedRecordIds: ["SRC-NEW"],
      rationale: "Synthetic fixture rationale.",
    },
    candidateFiles: [{ path: "SRC-NEW.yaml", yaml: "source_id: SRC-NEW\nname: Synthetic source\n" }],
    ...overrides,
  };
}

test("a well-formed envelope passes with zero errors", () => {
  assert.deepEqual(validateAuthoringEnvelope(validEnvelope()).errors, []);
});

test("a non-object envelope fails closed", () => {
  assert.deepEqual(validateAuthoringEnvelope(null).errors, ["authoring envelope must be an object"]);
  assert.deepEqual(validateAuthoringEnvelope("nope").errors, ["authoring envelope must be an object"]);
});

test("wrong schemaVersion fails closed", () => {
  const { errors } = validateAuthoringEnvelope(validEnvelope({ schemaVersion: "2" }));
  assert.match(errors.join("\n"), /envelope\.schemaVersion must be exactly "1"/);
});

test("an invalid embedded manifest fails closed with manifest-prefixed errors", () => {
  const { errors } = validateAuthoringEnvelope(validEnvelope({ manifest: { schemaVersion: "1" } }));
  assert.ok(errors.some((e) => e.startsWith("manifest.")));
});

test("empty candidateFiles fails closed", () => {
  const { errors } = validateAuthoringEnvelope(validEnvelope({ candidateFiles: [] }));
  assert.match(errors.join("\n"), /candidateFiles must be a non-empty array/);
});

test("a candidateFiles entry missing yaml/path fails closed", () => {
  const { errors } = validateAuthoringEnvelope(validEnvelope({ candidateFiles: [{ path: "X.yaml" }] }));
  assert.match(errors.join("\n"), /candidateFiles\[0\]\.yaml must be a non-empty string/);
});

test("duplicate candidateFiles paths fail closed", () => {
  const envelope = validEnvelope({
    manifest: {
      schemaVersion: "1",
      mode: "daily-discovery",
      investigationQuestion: "Q",
      candidateFiles: ["A.yaml", "A.yaml"],
      claimedRecordIds: ["SRC-A", "SRC-B"],
      rationale: "R",
    },
    candidateFiles: [
      { path: "A.yaml", yaml: "source_id: SRC-A\n" },
      { path: "A.yaml", yaml: "source_id: SRC-B\n" },
    ],
  });
  const { errors } = validateAuthoringEnvelope(envelope);
  assert.match(errors.join("\n"), /paths must be unique/);
});

test("candidateFiles paths that don't match manifest.candidateFiles fail closed", () => {
  const envelope = validEnvelope({ candidateFiles: [{ path: "DIFFERENT.yaml", yaml: "source_id: SRC-NEW\n" }] });
  const { errors } = validateAuthoringEnvelope(envelope);
  assert.match(errors.join("\n"), /paths must exactly match manifest\.candidateFiles/);
});

// candidateFiles[].path is untrusted AI output and must be rejected
// structurally before any filesystem call, not merely checked for
// non-empty-string presence.
test("a ../escape candidateFiles[].path fails closed at the structural layer", () => {
  const envelope = validEnvelope({
    manifest: {
      schemaVersion: "1",
      mode: "daily-discovery",
      investigationQuestion: "Q",
      candidateFiles: ["../escape.yaml"],
      claimedRecordIds: ["SRC-X"],
      rationale: "R",
    },
    candidateFiles: [{ path: "../escape.yaml", yaml: "source_id: SRC-X\n" }],
  });
  const { errors } = validateAuthoringEnvelope(envelope);
  assert.match(errors.join("\n"), /bounded relative path/);
});

test("a deep multi-level traversal candidateFiles[].path fails closed", () => {
  const traversal = "../".repeat(10) + "outside.yaml";
  const envelope = validEnvelope({
    manifest: {
      schemaVersion: "1",
      mode: "daily-discovery",
      investigationQuestion: "Q",
      candidateFiles: [traversal],
      claimedRecordIds: ["SRC-X"],
      rationale: "R",
    },
    candidateFiles: [{ path: traversal, yaml: "source_id: SRC-X\n" }],
  });
  const { errors } = validateAuthoringEnvelope(envelope);
  assert.match(errors.join("\n"), /bounded relative path/);
});

test("an absolute candidateFiles[].path fails closed", () => {
  const envelope = validEnvelope({
    manifest: {
      schemaVersion: "1",
      mode: "daily-discovery",
      investigationQuestion: "Q",
      candidateFiles: ["/etc/passwd"],
      claimedRecordIds: ["SRC-X"],
      rationale: "R",
    },
    candidateFiles: [{ path: "/etc/passwd", yaml: "source_id: SRC-X\n" }],
  });
  const { errors } = validateAuthoringEnvelope(envelope);
  assert.match(errors.join("\n"), /bounded relative path/);
});

test("a Windows drive-qualified candidateFiles[].path fails closed", () => {
  const envelope = validEnvelope({
    manifest: {
      schemaVersion: "1",
      mode: "daily-discovery",
      investigationQuestion: "Q",
      candidateFiles: ["C:\\Windows\\system.ini"],
      claimedRecordIds: ["SRC-X"],
      rationale: "R",
    },
    candidateFiles: [{ path: "C:\\Windows\\system.ini", yaml: "source_id: SRC-X\n" }],
  });
  const { errors } = validateAuthoringEnvelope(envelope);
  assert.match(errors.join("\n"), /bounded relative path/);
});

test("a benign nested candidateFiles[].path is accepted", () => {
  const envelope = validEnvelope({
    manifest: {
      schemaVersion: "1",
      mode: "daily-discovery",
      investigationQuestion: "Q",
      candidateFiles: ["nested/SRC-NEW.yaml"],
      claimedRecordIds: ["SRC-NEW"],
      rationale: "R",
    },
    candidateFiles: [{ path: "nested/SRC-NEW.yaml", yaml: "source_id: SRC-NEW\n" }],
  });
  assert.deepEqual(validateAuthoringEnvelope(envelope).errors, []);
});

const PRIMARY_PROMPT = buildPrimaryAuthoringPrompt({ mode: "daily-discovery", request: "Synthetic request." });

test("the primary prompt distinguishes each open-question field by meaning", () => {
  assert.match(PRIMARY_PROMPT, /latest_result = current result\/knowledge for that question/);
  assert.match(PRIMARY_PROMPT, /why_open = why it remains unresolved/);
  assert.match(PRIMARY_PROMPT, /resolution_condition = evidential\/decision condition to resolve or reopen it/);
  assert.match(PRIMARY_PROMPT, /current_action = current investigation activity/);
  assert.match(PRIMARY_PROMPT, /WATCH carries no structured posture meaning/);
});

test("the primary prompt bounds causal strength, currentness and effects/roles independence", () => {
  assert.match(PRIMARY_PROMPT, /must not assert more causal strength than the linked Evidence and its inference_limits support/);
  assert.match(PRIMARY_PROMPT, /Do not infer or assert currentness from updated_at, Source\/Evidence dates, or absence of contradiction/);
  assert.match(PRIMARY_PROMPT, /effects and evidence\[\]\.research_roles are independent/);
  assert.match(PRIMARY_PROMPT, /never link Evidence merely to rescue unsupported wording/);
  assert.match(PRIMARY_PROMPT, /existing corpus wording is not a template/);
});

test("the primary prompt keeps optional fields optional and forbids invented fields", () => {
  assert.match(PRIMARY_PROMPT, /Do not invent fields\./);
  assert.match(PRIMARY_PROMPT, /omit them when not explicitly supported; do not invent values/);
});

test("the primary prompt still states the structured envelope contract the validator enforces", () => {
  for (const key of ["schemaVersion", "manifest", "mode", "targetProblemId", "investigationQuestion", "candidateFiles", "claimedRecordIds", "rationale", "path", "yaml"]) {
    assert.ok(PRIMARY_PROMPT.includes(`"${key}"`), `prompt must describe envelope key ${key}`);
  }
  assert.match(PRIMARY_PROMPT, /matching exactly this shape \(schemaVersion "1"\)/);
  assert.match(PRIMARY_PROMPT, /"mode": "daily-discovery" \| "problem-refresh"/);
  assert.match(PRIMARY_PROMPT, /Do not emit anything on stdout other than this JSON object\./);
  assert.ok(PRIMARY_PROMPT.trimEnd().endsWith("match one entry in manifest.candidateFiles."), "envelope contract must remain the final instruction");
});
