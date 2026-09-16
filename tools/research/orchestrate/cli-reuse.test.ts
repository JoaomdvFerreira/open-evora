/**
 * CLI-level tests for the idempotent-reuse decision (WU045-B01
 * independent-review remediation, finding 1). The defect this remediates
 * lived in cli.ts itself — tests against runResearchCycle() alone cannot
 * exercise it, since that function never reads a pre-existing
 * research-change-set.json. These tests call tryReuseExistingChangeSet()
 * (exported from cli.ts) directly against real files on disk.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { CorpusIndex, RecordSchema } from "../core/types.ts";
import type { AiInvocationRequest, AiInvocationResult, AiInvoker } from "./ai-invoker.ts";
import { tryReuseExistingChangeSet } from "./cli.ts";
import { runResearchCycle } from "./run-cycle.ts";
import type { ResearchTrigger } from "./types.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

const SOURCE_SCHEMA: RecordSchema = {
  prefix: "SRC-",
  directory: "sources",
  idField: "source_id",
  requiredFields: ["source_id", "name"],
  allowedFields: ["source_id", "name"],
  fieldTypes: { source_id: ["string"], name: ["string"] },
};

function emptyIndex(): CorpusIndex {
  return {
    researchRoot: "/synthetic",
    byPrefix: new Map([["SRC-", { schema: SOURCE_SCHEMA, records: [], byId: new Map() }]]),
    totalRecords: 0,
  };
}

async function withTempDir(fn: (dir: string) => void | Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-cli-reuse-test-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const TRIGGER: ResearchTrigger = {
  mode: "daily-discovery",
  request: "What changed for waste collection this week?",
};

const VALID_ENVELOPE = {
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
};

const VALID_REVIEW = { schemaVersion: "1", outcome: "CONCUR", rationale: "No disagreement found." };

class FixedInvoker implements AiInvoker {
  private readonly stdout: unknown;
  constructor(stdout: unknown) {
    this.stdout = stdout;
  }
  invoke(_request: AiInvocationRequest): AiInvocationResult {
    return { status: "OK", stdout: JSON.stringify(this.stdout) };
  }
}

/** Produces a real, genuinely valid research-change-set.json at outputPath via the real assembly path. */
async function produceGenuineChangeSet(cycleDir: string, outputPath: string): Promise<void> {
  const outcome = await runResearchCycle({
    trigger: TRIGGER,
    index: emptyIndex(),
    baseGitSha: SHA,
    cycleDir,
    primaryInvoker: new FixedInvoker(VALID_ENVELOPE),
    reviewerInvoker: new FixedInvoker(VALID_REVIEW),
  });
  assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
  if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;
  writeFileSync(outputPath, `${JSON.stringify(outcome.changeSet, null, 2)}\n`, "utf8");
}

const IDENTITY = { baseGitSha: SHA, mode: "daily-discovery" as const, targetProblemId: undefined, request: TRIGGER.request };

test("case 1: matching trigger + invalid independentReview.outcome never reaches REUSABLE", async () => {
  await withTempDir(async (cycleDir) => {
    const outputPath = join(cycleDir, "research-change-set.json");
    await produceGenuineChangeSet(cycleDir, outputPath);
    const genuine = JSON.parse(readFileSync(outputPath, "utf8"));
    genuine.independentReview.outcome = "FAKE_NEVER_VALIDATED";
    writeFileSync(outputPath, JSON.stringify(genuine, null, 2), "utf8");

    const result = tryReuseExistingChangeSet(outputPath, IDENTITY);
    assert.equal(result.status, "NOT_REUSABLE");
  });
});

test("case 2: matching trigger + missing independentReview never reaches REUSABLE", async () => {
  await withTempDir(async (cycleDir) => {
    const outputPath = join(cycleDir, "research-change-set.json");
    await produceGenuineChangeSet(cycleDir, outputPath);
    const genuine = JSON.parse(readFileSync(outputPath, "utf8"));
    delete genuine.independentReview;
    writeFileSync(outputPath, JSON.stringify(genuine, null, 2), "utf8");

    const result = tryReuseExistingChangeSet(outputPath, IDENTITY);
    assert.equal(result.status, "NOT_REUSABLE");
  });
});

test("case 3: matching trigger + missing candidates never reaches REUSABLE", async () => {
  await withTempDir(async (cycleDir) => {
    const outputPath = join(cycleDir, "research-change-set.json");
    await produceGenuineChangeSet(cycleDir, outputPath);
    const genuine = JSON.parse(readFileSync(outputPath, "utf8"));
    genuine.candidates = [];
    writeFileSync(outputPath, JSON.stringify(genuine, null, 2), "utf8");

    const result = tryReuseExistingChangeSet(outputPath, IDENTITY);
    assert.equal(result.status, "NOT_REUSABLE");
  });
});

test("case 4: matching trigger + malformed RCS (hand-fabricated, no real fields) never reaches REUSABLE", async () => {
  await withTempDir(async (cycleDir) => {
    const outputPath = join(cycleDir, "research-change-set.json");
    writeFileSync(
      outputPath,
      JSON.stringify({
        baseGitSha: SHA,
        manifest: { mode: "daily-discovery", investigationQuestion: "What changed for waste collection this week?" },
        packageId: "CORRUPTED",
      }),
      "utf8"
    );

    const result = tryReuseExistingChangeSet(outputPath, IDENTITY);
    assert.equal(result.status, "NOT_REUSABLE");
  });
});

test("case 4b: malformed RCS reuse fails closed without throwing (regression: prior version crashed after printing success)", async () => {
  await withTempDir(async (cycleDir) => {
    const outputPath = join(cycleDir, "research-change-set.json");
    writeFileSync(outputPath, JSON.stringify({ baseGitSha: SHA, manifest: { mode: "daily-discovery" } }), "utf8");
    // Must not throw.
    const result = tryReuseExistingChangeSet(outputPath, IDENTITY);
    assert.equal(result.status, "NOT_REUSABLE");
  });
});

test("case 4c: non-JSON garbage on disk never reaches REUSABLE and never throws", async () => {
  await withTempDir(async (cycleDir) => {
    const outputPath = join(cycleDir, "research-change-set.json");
    writeFileSync(outputPath, "not json at all {{{", "utf8");
    const result = tryReuseExistingChangeSet(outputPath, IDENTITY);
    assert.equal(result.status, "NOT_REUSABLE");
    if (result.status !== "NOT_REUSABLE") return;
    assert.match(result.reason, /not valid JSON/);
  });
});

test("case 5: mismatching cycle identity never reaches REUSABLE, even for an otherwise genuine package", async () => {
  await withTempDir(async (cycleDir) => {
    const outputPath = join(cycleDir, "research-change-set.json");
    await produceGenuineChangeSet(cycleDir, outputPath);

    const mismatchedIdentity = { ...IDENTITY, request: "A completely different research question" };
    const result = tryReuseExistingChangeSet(outputPath, mismatchedIdentity);
    assert.equal(result.status, "NOT_REUSABLE");
    if (result.status !== "NOT_REUSABLE") return;
    assert.match(result.reason, /does not match the current trigger\/base identity/);
  });
});

test("case 5b: mismatching baseGitSha never reaches REUSABLE", async () => {
  await withTempDir(async (cycleDir) => {
    const outputPath = join(cycleDir, "research-change-set.json");
    await produceGenuineChangeSet(cycleDir, outputPath);

    const mismatchedIdentity = { ...IDENTITY, baseGitSha: "abcdefabcdefabcdefabcdefabcdefabcdefabcd" };
    const result = tryReuseExistingChangeSet(outputPath, mismatchedIdentity);
    assert.equal(result.status, "NOT_REUSABLE");
  });
});

test("case 6: a genuinely completed identical cycle IS safely reused without any further AI invocation", async () => {
  await withTempDir(async (cycleDir) => {
    const outputPath = join(cycleDir, "research-change-set.json");
    await produceGenuineChangeSet(cycleDir, outputPath);

    // tryReuseExistingChangeSet takes no AiInvoker at all — its signature
    // structurally guarantees no AI call can occur during reuse evaluation.
    const result = tryReuseExistingChangeSet(outputPath, IDENTITY);
    assert.equal(result.status, "REUSABLE");
    if (result.status !== "REUSABLE") return;
    assert.equal(result.changeSet.independentReview.outcome, "CONCUR");
    assert.equal(result.changeSet.candidates.length, 1);
    assert.ok(result.changeSet.packageId.startsWith("RCS-"));
  });
});

test("a tampered but structurally-plausible fingerprint mismatch is detected and rejected", async () => {
  await withTempDir(async (cycleDir) => {
    const outputPath = join(cycleDir, "research-change-set.json");
    await produceGenuineChangeSet(cycleDir, outputPath);
    const genuine = JSON.parse(readFileSync(outputPath, "utf8"));
    // Tamper with content but leave the (now-stale) fingerprint/packageId
    // untouched, simulating a hand edit that didn't recompute the hash.
    genuine.candidates[0].fields.name = "Tampered content";
    writeFileSync(outputPath, JSON.stringify(genuine, null, 2), "utf8");

    const result = tryReuseExistingChangeSet(outputPath, IDENTITY);
    assert.equal(result.status, "NOT_REUSABLE");
    if (result.status !== "NOT_REUSABLE") return;
    assert.match(result.reason, /fingerprint/);
  });
});

test("no cycle directory / no existing package is a normal NOT_REUSABLE, not an error", async () => {
  await withTempDir(async (cycleDir) => {
    const outputPath = join(cycleDir, "research-change-set.json");
    const result = tryReuseExistingChangeSet(outputPath, IDENTITY);
    assert.equal(result.status, "NOT_REUSABLE");
  });
});
