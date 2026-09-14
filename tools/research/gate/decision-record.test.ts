import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import test from "node:test";

import { withTempDir } from "./test-fixtures.ts";
import {
  assertDecisionRecordBinding,
  decisionRecordPath,
  loadDecisionRecord,
  validateDecisionRecord,
  writeDecisionRecord,
} from "./decision-record.ts";
import type { HumanGateDecisionRecord } from "./types.ts";

function validRecord(overrides: Partial<HumanGateDecisionRecord> = {}): HumanGateDecisionRecord {
  return {
    schemaVersion: "1",
    packageId: "RCS-0123456789abcdef",
    contentHash: "a".repeat(64),
    baseGitSha: "b".repeat(40),
    actor: "owner@example.invalid",
    timestamp: new Date().toISOString(),
    canonicalAcceptance: "APPROVE",
    publicExplorerPublication: "APPROVE",
    ...overrides,
  };
}

test("a decision record written to a cycle directory can be loaded back unchanged", () => {
  withTempDir((cycleDir) => {
    const record = validRecord();
    writeDecisionRecord(cycleDir, record);
    const loaded = loadDecisionRecord(cycleDir);
    assert.equal(loaded.status, "OK");
    if (loaded.status === "OK") assert.deepEqual(loaded.record, record);
  });
});

test("loadDecisionRecord reports ABSENT when no record file exists (supports resume/retry before first decision)", () => {
  withTempDir((cycleDir) => {
    const loaded = loadDecisionRecord(cycleDir);
    assert.equal(loaded.status, "ABSENT");
  });
});

test("loadDecisionRecord reports INVALID (never OK) for a malformed record file, fails closed", () => {
  withTempDir((cycleDir) => {
    writeFileSync(decisionRecordPath(cycleDir), "{ not json", "utf8");
    const loaded = loadDecisionRecord(cycleDir);
    assert.equal(loaded.status, "INVALID");
  });
});

test("loadDecisionRecord reports INVALID for a structurally malformed record object", () => {
  withTempDir((cycleDir) => {
    writeFileSync(decisionRecordPath(cycleDir), JSON.stringify({ schemaVersion: "1" }), "utf8");
    const loaded = loadDecisionRecord(cycleDir);
    assert.equal(loaded.status, "INVALID");
  });
});

test("validateDecisionRecord rejects a record whose OD-D combination is invalid, even if otherwise well-formed", () => {
  const record = validRecord({ canonicalAcceptance: "REJECT", publicExplorerPublication: "APPROVE" });
  const result = validateDecisionRecord(record);
  assert.ok(result.errors.length > 0);
});

test("assertDecisionRecordBinding succeeds only when packageId/contentHash/baseGitSha all match", () => {
  const record = validRecord();
  const binding = assertDecisionRecordBinding(record, {
    packageId: record.packageId,
    contentHash: record.contentHash,
    baseGitSha: record.baseGitSha,
  });
  assert.equal(binding.ok, true);
});

test("ADVERSARIAL: assertDecisionRecordBinding fails closed for a decision record bound to a different package", () => {
  const record = validRecord({ packageId: "RCS-deadbeefdeadbeef" });
  const binding = assertDecisionRecordBinding(record, {
    packageId: "RCS-0123456789abcdef",
    contentHash: record.contentHash,
    baseGitSha: record.baseGitSha,
  });
  assert.equal(binding.ok, false);
});

test("ADVERSARIAL: assertDecisionRecordBinding fails closed when contentHash differs", () => {
  const record = validRecord();
  const binding = assertDecisionRecordBinding(record, {
    packageId: record.packageId,
    contentHash: "f".repeat(64),
    baseGitSha: record.baseGitSha,
  });
  assert.equal(binding.ok, false);
});

test("ADVERSARIAL: assertDecisionRecordBinding fails closed when baseGitSha differs (stale base)", () => {
  const record = validRecord();
  const binding = assertDecisionRecordBinding(record, {
    packageId: record.packageId,
    contentHash: record.contentHash,
    baseGitSha: "1".repeat(40),
  });
  assert.equal(binding.ok, false);
});

test("a decision record for one package must never authorize another package's promotion (binding check catches cross-package reuse)", () => {
  withTempDir((cycleDirA) => {
    withTempDir((cycleDirB) => {
      const recordForA = validRecord({ packageId: "RCS-aaaaaaaaaaaaaaaa" });
      writeDecisionRecord(cycleDirA, recordForA);

      // Simulate an attacker/bug copying cycleDirA's decision record into
      // cycleDirB's directory, where a different package sits.
      writeDecisionRecord(cycleDirB, recordForA);
      const loadedFromB = loadDecisionRecord(cycleDirB);
      assert.equal(loadedFromB.status, "OK");
      if (loadedFromB.status !== "OK") return;

      const binding = assertDecisionRecordBinding(loadedFromB.record, {
        packageId: "RCS-bbbbbbbbbbbbbbbb",
        contentHash: "c".repeat(64),
        baseGitSha: "d".repeat(40),
      });
      assert.equal(binding.ok, false);
    });
  });
});
