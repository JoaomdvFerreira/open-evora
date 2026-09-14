import assert from "node:assert/strict";
import test from "node:test";

import { validateAuthoringEnvelope } from "./authoring-envelope.ts";

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

// WU045-B01 independent-review remediation, finding 2: candidateFiles[].path
// is untrusted AI output and must be rejected structurally before any
// filesystem call, not merely checked for non-empty-string presence.
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
