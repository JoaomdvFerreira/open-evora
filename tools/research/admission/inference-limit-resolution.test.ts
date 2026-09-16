/**
 * WU053 remediation regression coverage: the local, workbench-only
 * pre-Gate human-resolution mechanism scoped exclusively to
 * CLAIM_INFERENCE_LIMITS_PRESENT.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createInferenceLimitResolutionChecker,
  readInferenceLimitResolution,
  writeInferenceLimitResolution,
  type InferenceLimitResolutionSubject,
} from "./inference-limit-resolution.ts";

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-inference-limit-resolution-test-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SHA = "0123456789abcdef0123456789abcdef01234567";
const OTHER_SHA = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";

function subject(overrides: Partial<InferenceLimitResolutionSubject> = {}): InferenceLimitResolutionSubject {
  return {
    baseGitSha: SHA,
    subjectId: "EVD-1",
    candidateFields: { evidence_id: "EVD-1", claim_authority: "authoritative" },
    inferenceLimits: ["limit one", "limit two"],
    ...overrides,
  };
}

test("no resolution file present is reported as not resolved", () => {
  withTempDir((cycleDir) => {
    const result = readInferenceLimitResolution(cycleDir, subject());
    assert.equal(result.resolved, false);
  });
});

test("an exact-match resolution round-trips as resolved", () => {
  withTempDir((cycleDir) => {
    writeInferenceLimitResolution(cycleDir, subject(), "owner@example.invalid", "Reviewed and accepted.");
    const result = readInferenceLimitResolution(cycleDir, subject());
    assert.equal(result.resolved, true);
  });
});

test("the resolution checker reports isResolved(true) only for an exact-match subject", () => {
  withTempDir((cycleDir) => {
    writeInferenceLimitResolution(cycleDir, subject(), "owner@example.invalid", "Reviewed and accepted.");
    const checker = createInferenceLimitResolutionChecker(cycleDir);
    assert.equal(checker.isResolved(SHA, "EVD-1", { evidence_id: "EVD-1", claim_authority: "authoritative" }, ["limit one", "limit two"]), true);
  });
});

test("a changed base Git SHA invalidates the resolution (fails closed)", () => {
  withTempDir((cycleDir) => {
    writeInferenceLimitResolution(cycleDir, subject(), "owner@example.invalid", "Reviewed and accepted.");
    const result = readInferenceLimitResolution(cycleDir, subject({ baseGitSha: OTHER_SHA }));
    assert.equal(result.resolved, false);
  });
});

test("changed candidate content invalidates the resolution (fails closed)", () => {
  withTempDir((cycleDir) => {
    writeInferenceLimitResolution(cycleDir, subject(), "owner@example.invalid", "Reviewed and accepted.");
    const result = readInferenceLimitResolution(cycleDir, subject({ candidateFields: { evidence_id: "EVD-1", claim_authority: "non_authoritative" } }));
    assert.equal(result.resolved, false);
  });
});

test("changed inference_limits invalidates the resolution (fails closed)", () => {
  withTempDir((cycleDir) => {
    writeInferenceLimitResolution(cycleDir, subject(), "owner@example.invalid", "Reviewed and accepted.");
    const result = readInferenceLimitResolution(cycleDir, subject({ inferenceLimits: ["limit one", "a materially different third limit"] }));
    assert.equal(result.resolved, false);
  });
});

test("a different subject id invalidates the resolution (fails closed)", () => {
  withTempDir((cycleDir) => {
    writeInferenceLimitResolution(cycleDir, subject(), "owner@example.invalid", "Reviewed and accepted.");
    const result = readInferenceLimitResolution(cycleDir, subject({ subjectId: "EVD-2" }));
    assert.equal(result.resolved, false);
  });
});

test("a structurally invalid on-disk record fails closed without throwing", () => {
  withTempDir((cycleDir) => {
    const dir = join(cycleDir, "resolutions");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "EVD-1.inference-limits-resolution.json"), JSON.stringify({ not: "a real record" }), "utf8");
    const result = readInferenceLimitResolution(cycleDir, subject());
    assert.equal(result.resolved, false);
  });
});

test("malformed JSON on disk fails closed without throwing", () => {
  withTempDir((cycleDir) => {
    const dir = join(cycleDir, "resolutions");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "EVD-1.inference-limits-resolution.json"), "not json {{{", "utf8");
    const result = readInferenceLimitResolution(cycleDir, subject());
    assert.equal(result.resolved, false);
  });
});

test("a resolution for a different code cannot be forged into acceptance (schema check rejects it)", () => {
  withTempDir((cycleDir) => {
    const dir = join(cycleDir, "resolutions");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "EVD-1.inference-limits-resolution.json"),
      JSON.stringify({ schemaVersion: "1", code: "SOURCE_UNAVAILABLE", fingerprint: "x".repeat(64), resolvedAt: "now", resolvedBy: "x", note: "x" }),
      "utf8"
    );
    const result = readInferenceLimitResolution(cycleDir, subject());
    assert.equal(result.resolved, false);
  });
});
