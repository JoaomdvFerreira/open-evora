import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import type { CorpusIndex, RecordSchema } from "../core/types.ts";
import type { AiInvocationRequest, AiInvocationResult, AiInvoker } from "./ai-invoker.ts";
import { resumePreGateHold, resumeRevalidationHold, runResearchCycle } from "./run-cycle.ts";
import {
  candidateSetsEquivalent,
  revalidateFrozenCycleAtNewBase,
  verifyNoResearchDrift,
  verifyOldBaseIsAncestor,
} from "./revalidate-frozen-cycle.ts";
import type { CandidateRecord } from "../integration/candidate-delta.ts";
import type { ResearchTrigger } from "./types.ts";
import { createInferenceLimitResolutionChecker, writeInferenceLimitResolution } from "../admission/inference-limit-resolution.ts";
import { precheckRepositoryState } from "../gate/repository-state.ts";
import { gitFixture } from "../gate/test-fixtures.ts";

const OLD_SHA = "0123456789abcdef0123456789abcdef01234567";

/**
 * These tests use real subdirectories under this repo's own gitignored
 * `.research-workbench/` (rather than an OS tmpdir) because
 * assertWorkbenchBoundary() requires a path Git itself reports as ignored —
 * matching workbench-boundary.test.ts's own convention. Under the full
 * multi-suite test run, Windows can hold a transient lock (EPERM/EBUSY) on a
 * just-written file in one of these directories long enough that even a
 * generous rmSync retry budget is exhausted — this is real-time-scanner/
 * concurrent-process contention on the removal of already-unused scratch
 * files, never a sign that the module under test left something open (every
 * write in run-cycle.ts/revalidate-frozen-cycle.ts is a synchronous,
 * immediately-closed writeFileSync). Failing to *delete* test scratch after
 * assertions have already run is not a correctness problem: swallow it here
 * rather than failing the test, and rely on each test's own pre-run
 * cleanupCycleDir() call (also best-effort) to sweep any leftovers before
 * its next use.
 */
function cleanupCycleDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  } catch {
    // Best-effort scratch cleanup only — see doc comment above.
  }
}

const SOURCE_SCHEMA: RecordSchema = {
  prefix: "SRC-",
  directory: "sources",
  idField: "source_id",
  requiredFields: ["source_id", "name"],
  allowedFields: ["source_id", "publisher", "name", "resource_type", "identity", "identity.snapshot_reference", "scope", "scope.geography", "scope.geography.level", "scope.domains", "access", "access.level", "access.availability", "access.machine_readable", "acquisition", "acquisition.method", "canonical_reference", "licensing", "licensing.status", "licensing.reuse", "licensing.attribution", "temporal", "temporal.last_checked_at", "caveats"],
  fieldTypes: { source_id: ["string"], publisher: ["string"], name: ["string"], resource_type: ["string"], identity: ["object"], "identity.snapshot_reference": ["string"], scope: ["object"], "scope.geography": ["object"], "scope.geography.level": ["string"], "scope.domains": ["array"], access: ["object"], "access.level": ["string"], "access.availability": ["string"], "access.machine_readable": ["boolean", "string"], acquisition: ["object"], "acquisition.method": ["string"], canonical_reference: ["string"], licensing: ["object"], "licensing.status": ["string"], "licensing.reuse": ["string"], "licensing.attribution": ["string", "null"], temporal: ["object"], "temporal.last_checked_at": ["string"], caveats: ["array"] },
};
const EVIDENCE_SCHEMA: RecordSchema = { prefix: "EVD-", directory: "evidence", idField: "evidence_id", requiredFields: ["evidence_id", "provenance", "provenance.sources", "evidence_nature", "claim_authority", "inference_limits"], allowedFields: ["evidence_id", "provenance", "provenance.sources", "evidence_nature", "claim_authority", "inference_limits"], fieldTypes: { evidence_id: ["string"], provenance: ["object"], "provenance.sources": ["array"], evidence_nature: ["string"], claim_authority: ["string"], inference_limits: ["array"] }, references: [{ field: "provenance.sources", isList: true, targetPrefix: "SRC-", targetDirectory: "sources", required: true }], stringListFields: ["provenance.sources", "inference_limits"], nonEmptyListFields: ["provenance.sources"] };

function emptyIndex(): CorpusIndex {
  return {
    researchRoot: "/synthetic",
    byPrefix: new Map([["SRC-", { schema: SOURCE_SCHEMA, records: [], byId: new Map() }]]),
    totalRecords: 0,
  };
}

function admissionIndex(level: "public" | "private"): CorpusIndex {
  const source = { source_id: "SRC-MATERIAL", name: "Synthetic material", access: { level } };
  return { researchRoot: "/synthetic", totalRecords: 1, byPrefix: new Map([
    ["SRC-", { schema: SOURCE_SCHEMA, records: [{ file: "sources/SRC-MATERIAL.yaml", fields: source }], byId: new Map([["SRC-MATERIAL", { file: "sources/SRC-MATERIAL.yaml", fields: source }]]) }],
    ["EVD-", { schema: EVIDENCE_SCHEMA, records: [], byId: new Map() }],
  ]) };
}

async function withTempDir(fn: (dir: string) => void | Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-revalidate-test-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A single shared invoker used for both roles, exactly as the CLI's single-executable configuration does. */
class SharedInvoker implements AiInvoker {
  public calls: AiInvocationRequest[] = [];
  private readonly primaryStdout: unknown;
  private readonly reviewerStdout: unknown;
  constructor(primaryStdout: unknown, reviewerStdout: unknown) {
    this.primaryStdout = primaryStdout;
    this.reviewerStdout = reviewerStdout;
  }
  invoke(request: AiInvocationRequest): AiInvocationResult {
    this.calls.push(request);
    return { status: "OK", stdout: JSON.stringify(request.role === "PRIMARY_AUTHOR" ? this.primaryStdout : this.reviewerStdout) };
  }
}

/** Fails the test immediately if ever invoked — used to prove PRIMARY_AUTHOR unreachability. */
class UnreachableInvoker implements AiInvoker {
  invoke(): AiInvocationResult {
    throw new Error("UnreachableInvoker was invoked: PRIMARY_AUTHOR must be structurally unreachable on the revalidation path");
  }
}

/** Counts invocations by role without ever failing (used where reviewer calls are expected but primary must stay zero). */
class RoleCountingInvoker implements AiInvoker {
  public primaryCalls = 0;
  public reviewerCalls = 0;
  private readonly stdout: unknown;
  constructor(stdout: unknown) {
    this.stdout = stdout;
  }
  invoke(request: AiInvocationRequest): AiInvocationResult {
    if (request.role === "PRIMARY_AUTHOR") this.primaryCalls += 1;
    else this.reviewerCalls += 1;
    return { status: "OK", stdout: JSON.stringify(this.stdout) };
  }
}

const TRIGGER: ResearchTrigger = { mode: "daily-discovery", request: "What changed for waste collection this week?" };
const VALID_ENVELOPE = {
  schemaVersion: "1",
  manifest: { schemaVersion: "1", mode: "daily-discovery", investigationQuestion: TRIGGER.request, candidateFiles: ["SRC-NEW.yaml"], claimedRecordIds: ["SRC-NEW"], rationale: "r" },
  candidateFiles: [{ path: "SRC-NEW.yaml", yaml: "source_id: SRC-NEW\nname: Synthetic source\n" }],
};
const VALID_REVIEW = { schemaVersion: "1", outcome: "CONCUR", rationale: "No disagreement found." };

/**
 * Builds a genuinely-assembled, internally-consistent source cycle at
 * `baseGitSha` via the real normal path, so its RCS/manifest/candidates are
 * exactly what production would freeze. `baseGitSha` must equal whatever
 * `oldBaseGitSha` a test later passes to revalidateFrozenCycleAtNewBase()
 * (the source RCS's own baseGitSha is bound to the caller-supplied old base)
 * — defaults to OLD_SHA for tests that only exercise the pure Git helpers
 * directly.
 */
async function buildFrozenSourceCycle(sourceCycleDir: string, index: CorpusIndex = emptyIndex(), baseGitSha: string = OLD_SHA): Promise<void> {
  const shared = new SharedInvoker(VALID_ENVELOPE, VALID_REVIEW);
  const outcome = await runResearchCycle({
    trigger: TRIGGER,
    index,
    baseGitSha,
    cycleDir: sourceCycleDir,
    primaryInvoker: shared,
    reviewerInvoker: shared,
  });
  assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW", outcome.status === "FAILED" ? outcome.message : "");
  writeFileSync(join(sourceCycleDir, "research-change-set.json"), `${JSON.stringify((outcome as { changeSet: unknown }).changeSet, null, 2)}\n`, "utf8");
}

/** A real, throwaway Git repository (distinct from this repo) used only to exercise verifyOldBaseIsAncestor()/verifyNoResearchDrift() and the full revalidation flow against controllable commit history. */
function initSyntheticRepo(dir: string): void {
  mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "--quiet"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
}

function commit(dir: string, message: string): string {
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "--quiet", "-m", message], { cwd: dir });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
}

// --- verifyOldBaseIsAncestor / verifyNoResearchDrift (pure Git helpers) ---

test("verifyOldBaseIsAncestor: accepts a genuine ancestor", async () => {
  await withTempDir(async (dir) => {
    initSyntheticRepo(dir);
    writeFileSync(join(dir, "a.txt"), "1", "utf8");
    const c1 = commit(dir, "c1");
    writeFileSync(join(dir, "a.txt"), "2", "utf8");
    const c2 = commit(dir, "c2");
    assert.deepEqual(verifyOldBaseIsAncestor(c1, c2, dir), { ok: true });
  });
});

test("verifyOldBaseIsAncestor: rejects a non-ancestor (diverged history)", async () => {
  await withTempDir(async (dir) => {
    initSyntheticRepo(dir);
    writeFileSync(join(dir, "a.txt"), "1", "utf8");
    const base = commit(dir, "base");
    writeFileSync(join(dir, "a.txt"), "2", "utf8");
    const branchA = commit(dir, "branch a");
    execFileSync("git", ["checkout", "--quiet", base], { cwd: dir });
    writeFileSync(join(dir, "b.txt"), "3", "utf8");
    commit(dir, "branch b");
    const result = verifyOldBaseIsAncestor(branchA, execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim(), dir);
    assert.equal(result.ok, false);
  });
});

test("verifyNoResearchDrift: reports no drift when research/ is untouched between bases", async () => {
  await withTempDir(async (dir) => {
    initSyntheticRepo(dir);
    mkdirSync(join(dir, "research"), { recursive: true });
    writeFileSync(join(dir, "research", "r.yaml"), "x: 1\n", "utf8");
    writeFileSync(join(dir, "tools.txt"), "1", "utf8");
    const c1 = commit(dir, "c1");
    writeFileSync(join(dir, "tools.txt"), "2", "utf8");
    const c2 = commit(dir, "c2 (non-research change only)");
    assert.deepEqual(verifyNoResearchDrift(c1, c2, dir), { drifted: false });
  });
});

test("verifyNoResearchDrift: reports drift when research/ changed between bases", async () => {
  await withTempDir(async (dir) => {
    initSyntheticRepo(dir);
    mkdirSync(join(dir, "research"), { recursive: true });
    writeFileSync(join(dir, "research", "r.yaml"), "x: 1\n", "utf8");
    const c1 = commit(dir, "c1");
    writeFileSync(join(dir, "research", "r.yaml"), "x: 2\n", "utf8");
    const c2 = commit(dir, "c2 (research change)");
    const result = verifyNoResearchDrift(c1, c2, dir);
    assert.equal(result.drifted, true);
    if (!result.drifted) return;
    assert.deepEqual(result.files, ["research/r.yaml"]);
  });
});

// --- candidateSetsEquivalent (order-insensitive, content-exact multiset comparison) ---

function src(id: string, extra: Record<string, unknown> = {}): CandidateRecord {
  return { recordFamily: "SRC-", fields: { source_id: id, name: `Synthetic ${id}`, ...extra } };
}
function evd(id: string, extra: Record<string, unknown> = {}): CandidateRecord {
  return { recordFamily: "EVD-", fields: { evidence_id: id, ...extra } };
}
function prb(id: string, extra: Record<string, unknown> = {}): CandidateRecord {
  return { recordFamily: "PRB-", fields: { problem_id: id, ...extra } };
}

test("candidateSetsEquivalent: same exact records, manifest order != RCS deterministic order => MATCH (no false-positive drift)", () => {
  const manifestOrder = [src("SRC-A"), src("SRC-B"), evd("EVD-A")];
  const rcsDeterministicOrder = [evd("EVD-A"), src("SRC-A"), src("SRC-B")];
  assert.equal(candidateSetsEquivalent(manifestOrder, rcsDeterministicOrder), true);
});

test("candidateSetsEquivalent: same candidates in arbitrary permutation => accepted", () => {
  const a = [src("SRC-A"), src("SRC-B"), src("SRC-C"), evd("EVD-A")];
  const permuted = [evd("EVD-A"), src("SRC-C"), src("SRC-A"), src("SRC-B")];
  assert.equal(candidateSetsEquivalent(a, permuted), true);
  // Reflexive/identity case too.
  assert.equal(candidateSetsEquivalent(a, a), true);
});

test("candidateSetsEquivalent: one candidate field changed => FAIL", () => {
  const a = [src("SRC-A"), evd("EVD-A")];
  const b = [src("SRC-A", { publisher: "Changed publisher" }), evd("EVD-A")];
  assert.equal(candidateSetsEquivalent(a, b), false);
});

test("candidateSetsEquivalent: recordFamily change alone => FAIL", () => {
  const a = [{ recordFamily: "SRC-", fields: { source_id: "X", name: "n" } }];
  const b = [{ recordFamily: "EVD-", fields: { source_id: "X", name: "n" } }];
  assert.equal(candidateSetsEquivalent(a, b), false);
});

test("candidateSetsEquivalent: ID change alone => FAIL", () => {
  const a = [src("SRC-A")];
  const b = [src("SRC-B")];
  assert.equal(candidateSetsEquivalent(a, b), false);
});

test("candidateSetsEquivalent: missing candidate => FAIL", () => {
  const a = [src("SRC-A"), src("SRC-B")];
  const b = [src("SRC-A")];
  assert.equal(candidateSetsEquivalent(a, b), false);
});

test("candidateSetsEquivalent: extra candidate => FAIL", () => {
  const a = [src("SRC-A")];
  const b = [src("SRC-A"), src("SRC-B")];
  assert.equal(candidateSetsEquivalent(a, b), false);
});

test("candidateSetsEquivalent: duplicate candidate replacing a distinct candidate => FAIL (multiplicity preserved)", () => {
  // Same count, same-looking set at a glance, but B duplicates SRC-A instead
  // of also carrying the distinct SRC-B the left side has.
  const a = [src("SRC-A"), src("SRC-B")];
  const b = [src("SRC-A"), src("SRC-A")];
  assert.equal(candidateSetsEquivalent(a, b), false);
});

test("candidateSetsEquivalent: real PRB-0005-shaped ordering (SRC,SRC,SRC,EVD,EVD,PRB manifest order vs EVD,EVD,PRB,SRC,SRC,SRC RCS order) => MATCH", () => {
  const manifestOrder = [src("SRC-1"), src("SRC-2"), src("SRC-3"), evd("EVD-1"), evd("EVD-2"), prb("PRB-0005")];
  const rcsOrder = [evd("EVD-1"), evd("EVD-2"), prb("PRB-0005"), src("SRC-1"), src("SRC-2"), src("SRC-3")];
  assert.equal(candidateSetsEquivalent(manifestOrder, rcsOrder), true);
});

// --- revalidateFrozenCycleAtNewBase (full sequence) ---

test("non-research-only base drift: exact frozen candidates reused, PRIMARY_AUTHOR invocation count = 0, new base identity used", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    const oldBase = commit(repoDir, "c1");
    writeFileSync(join(repoDir, "unrelated-tool.txt"), "drift", "utf8");
    const newBase = commit(repoDir, "c2 (non-research file only)");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-non-research-drift");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-non-research-drift");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    try {
      await buildFrozenSourceCycle(sourceCycleDir, emptyIndex(), oldBase);

      const reviewer = new RoleCountingInvoker(VALID_REVIEW);
      const outcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: oldBase,
        newBaseGitSha: newBase,
        index: emptyIndex(),
        reviewerInvoker: reviewer,
        repoRoot: repoDir,
      });

      assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW", outcome.status === "FAILED" ? outcome.message : "");
      if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;
      assert.equal(reviewer.primaryCalls, 0);
      assert.equal(reviewer.reviewerCalls, 1);
      assert.equal(outcome.changeSet.baseGitSha, newBase);
      assert.deepEqual(
        outcome.changeSet.candidates.map((c) => c.fields.source_id),
        ["SRC-NEW"]
      );
      assert.equal(existsSync(join(targetCycleDir, "manifest.json")), false, "target cycle must not materialize a re-authored manifest");
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});

test("research/** changed between bases: fails closed before any AI reviewer invocation or canonical write", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    const oldBase = commit(repoDir, "c1");
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 2\n", "utf8");
    const newBase = commit(repoDir, "c2 (research drift)");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-research-drift");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-research-drift");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    try {
      await buildFrozenSourceCycle(sourceCycleDir, emptyIndex(), oldBase);

      const outcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: oldBase,
        newBaseGitSha: newBase,
        index: emptyIndex(),
        reviewerInvoker: new UnreachableInvoker(),
        repoRoot: repoDir,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedCheck, "CANONICAL_RESEARCH_DRIFTED");
      assert.equal(existsSync(join(targetCycleDir, "research-change-set.json")), false);
      assert.equal(existsSync(join(targetCycleDir, "manifest.json")), false);
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});

test("candidate drift from the source frozen set fails closed", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    const oldBase = commit(repoDir, "c1");
    writeFileSync(join(repoDir, "unrelated-tool.txt"), "drift", "utf8");
    const newBase = commit(repoDir, "c2");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-candidate-drift");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-candidate-drift");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    try {
      await buildFrozenSourceCycle(sourceCycleDir, emptyIndex(), oldBase);
      // Tamper with the frozen candidate file after freeze, without touching research-change-set.json.
      writeFileSync(join(sourceCycleDir, "candidates", "SRC-NEW.yaml"), "source_id: SRC-NEW\nname: Tampered after freeze\n", "utf8");

      const outcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: oldBase,
        newBaseGitSha: newBase,
        index: emptyIndex(),
        reviewerInvoker: new UnreachableInvoker(),
        repoRoot: repoDir,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedCheck, "SOURCE_CANDIDATE_DRIFT");
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});

test("manifest drift from the source frozen set fails closed", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    const oldBase = commit(repoDir, "c1");
    writeFileSync(join(repoDir, "unrelated-tool.txt"), "drift", "utf8");
    const newBase = commit(repoDir, "c2");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-manifest-drift");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-manifest-drift");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    try {
      await buildFrozenSourceCycle(sourceCycleDir, emptyIndex(), oldBase);
      const manifestPath = join(sourceCycleDir, "manifest.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.rationale = "TAMPERED_RATIONALE_AFTER_FREEZE";
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

      const outcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: oldBase,
        newBaseGitSha: newBase,
        index: emptyIndex(),
        reviewerInvoker: new UnreachableInvoker(),
        repoRoot: repoDir,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedCheck, "SOURCE_CYCLE_INVALID");
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});

test("old base not an ancestor of new base fails closed before any drift/reviewer work", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    const base = commit(repoDir, "base");
    writeFileSync(join(repoDir, "a.txt"), "a", "utf8");
    const branchA = commit(repoDir, "branch a");
    execFileSync("git", ["checkout", "--quiet", base], { cwd: repoDir });
    writeFileSync(join(repoDir, "b.txt"), "b", "utf8");
    const branchB = commit(repoDir, "branch b");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-non-ancestor");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-non-ancestor");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    try {
      await buildFrozenSourceCycle(sourceCycleDir, emptyIndex(), branchA);

      const outcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: branchA,
        newBaseGitSha: branchB,
        index: emptyIndex(),
        reviewerInvoker: new UnreachableInvoker(),
        repoRoot: repoDir,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedCheck, "BASE_NOT_ANCESTOR");
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});

test("inference-limit resolution recorded at the old base/cycle is not accepted at the new base/cycle", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    const oldBase = commit(repoDir, "c1");
    writeFileSync(join(repoDir, "unrelated-tool.txt"), "drift", "utf8");
    const newBase = commit(repoDir, "c2");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-inference-limits");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-inference-limits");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    try {
      const corpus = admissionIndex("public");
      const envelopeWithLimits = {
        schemaVersion: "1",
        manifest: { schemaVersion: "1", mode: "daily-discovery", investigationQuestion: TRIGGER.request, candidateFiles: ["EVD-NEW.yaml"], claimedRecordIds: ["EVD-NEW"], rationale: "r" },
        candidateFiles: [{ path: "EVD-NEW.yaml", yaml: "evidence_id: EVD-NEW\nprovenance:\n  sources:\n    - SRC-MATERIAL\nevidence_nature: claim\nclaim_authority: authoritative\ninference_limits:\n  - a bounded inference limit\n" }],
      };
      const shared = new SharedInvoker(envelopeWithLimits, VALID_REVIEW);
      const buildOutcome = await runResearchCycle({
        trigger: { mode: "daily-discovery", request: TRIGGER.request },
        index: corpus,
        baseGitSha: oldBase,
        cycleDir: sourceCycleDir,
        primaryInvoker: shared,
        reviewerInvoker: shared,
        availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
        now: () => new Date("2026-09-15T12:00:00.000Z"),
      });
      assert.equal(buildOutcome.status, "PRE_GATE_SAFETY_HOLD", buildOutcome.status);

      // Record the OLD-cycle resolution and resume it to READY, exactly as
      // an operator would via hold-cli.ts's own record-resolution + resume
      // actions, so the source cycle this test revalidates has a genuinely
      // structurally-valid, previously-reviewed research-change-set.json
      // (required by this module's own requirement 3).
      writeInferenceLimitResolution(
        sourceCycleDir,
        { baseGitSha: oldBase, subjectId: "EVD-NEW", candidateFields: { evidence_id: "EVD-NEW", provenance: { sources: ["SRC-MATERIAL"] }, evidence_nature: "claim", claim_authority: "authoritative", inference_limits: ["a bounded inference limit"] }, inferenceLimits: ["a bounded inference limit"] },
        "owner",
        "reviewed and accepted"
      );
      const resumeReviewer = new RoleCountingInvoker(VALID_REVIEW);
      const resumeOutcome = await resumePreGateHold({
        index: corpus,
        baseGitSha: oldBase,
        trigger: { mode: "daily-discovery", request: TRIGGER.request },
        cycleDir: sourceCycleDir,
        reviewerInvoker: resumeReviewer,
        availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
        inferenceLimitResolutionChecker: createInferenceLimitResolutionChecker(sourceCycleDir),
        now: () => new Date("2026-09-15T12:00:00.000Z"),
      });
      assert.equal(resumeOutcome.status, "READY_FOR_HUMAN_REVIEW", resumeOutcome.status === "FAILED" ? resumeOutcome.message : "");
      writeFileSync(join(sourceCycleDir, "research-change-set.json"), `${JSON.stringify((resumeOutcome as { changeSet: unknown }).changeSet, null, 2)}\n`, "utf8");

      // Requirement 10: revalidating at the NEW base with a checker bound to
      // the NEW target cycle directory must NOT see the OLD cycle's
      // resolution — the finding must reappear as a fresh HOLD, never
      // silently reused across bases/cycles.
      const revalidateOutcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: oldBase,
        newBaseGitSha: newBase,
        index: corpus,
        reviewerInvoker: new UnreachableInvoker(),
        availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
        inferenceLimitResolutionChecker: createInferenceLimitResolutionChecker(targetCycleDir),
        now: () => new Date("2026-09-15T12:00:00.000Z"),
        repoRoot: repoDir,
      });
      assert.equal(revalidateOutcome.status, "PRE_GATE_SAFETY_HOLD", revalidateOutcome.status === "FAILED" ? revalidateOutcome.message : "");
      if (revalidateOutcome.status !== "PRE_GATE_SAFETY_HOLD") return;
      assert.equal(
        revalidateOutcome.admission.findings.some((f) => f.code === "CLAIM_INFERENCE_LIMITS_PRESENT"),
        true,
        "the inference-limit finding must reappear at the new base/target cycle, never silently carried over"
      );
      assert.equal(existsSync(join(targetCycleDir, "hold-freeze.json")), true, "a fresh frozen HOLD must be written in the target cycle");
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});

test("fresh reviewer occurs only after admission becomes ELIGIBLE at the new base", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    const oldBase = commit(repoDir, "c1");
    writeFileSync(join(repoDir, "unrelated-tool.txt"), "drift", "utf8");
    const newBase = commit(repoDir, "c2");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-hold-then-eligible");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-hold-then-eligible");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    try {
      // Source cycle is frozen with a PRIVATE material source, which always HOLDs (never resolvable).
      const privateCorpus = admissionIndex("private");
      const claimEnvelope = {
        schemaVersion: "1",
        manifest: { schemaVersion: "1", mode: "daily-discovery", investigationQuestion: TRIGGER.request, candidateFiles: ["EVD-NEW.yaml"], claimedRecordIds: ["EVD-NEW"], rationale: "r" },
        candidateFiles: [{ path: "EVD-NEW.yaml", yaml: "evidence_id: EVD-NEW\nprovenance:\n  sources:\n    - SRC-MATERIAL\nevidence_nature: claim\nclaim_authority: authoritative\ninference_limits: []\n" }],
      };
      const buildShared = new SharedInvoker(claimEnvelope, VALID_REVIEW);
      const buildOutcome = await runResearchCycle({
        trigger: TRIGGER,
        index: privateCorpus,
        baseGitSha: oldBase,
        cycleDir: sourceCycleDir,
        primaryInvoker: buildShared,
        reviewerInvoker: buildShared,
        availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
        now: () => new Date("2026-09-15T12:00:00.000Z"),
      });
      assert.equal(buildOutcome.status, "PRE_GATE_SAFETY_HOLD");
      assert.equal(existsSync(join(sourceCycleDir, "research-change-set.json")), false);

      // A PRE_GATE_SAFETY_HOLD source cycle has no research-change-set.json,
      // so the revalidation path's own structural-source check must itself
      // fail closed (SOURCE_CYCLE_INVALID) rather than ever reaching the
      // reviewer — proving no reviewer call happens on a non-ELIGIBLE source.
      const holdReviewer = new RoleCountingInvoker(VALID_REVIEW);
      const holdOutcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: oldBase,
        newBaseGitSha: newBase,
        index: privateCorpus,
        reviewerInvoker: holdReviewer,
        repoRoot: repoDir,
      });
      assert.equal(holdOutcome.status, "FAILED");
      if (holdOutcome.status === "FAILED") assert.equal(holdOutcome.failedCheck, "SOURCE_CYCLE_INVALID");
      assert.equal(holdReviewer.reviewerCalls, 0);
      cleanupCycleDir(targetCycleDir);

      // Now freeze a genuinely ELIGIBLE source cycle (public source) and confirm the reviewer IS invoked once at the new base.
      cleanupCycleDir(sourceCycleDir);
      const publicCorpus = admissionIndex("public");
      const eligibleShared = new SharedInvoker(claimEnvelope, VALID_REVIEW);
      const eligibleBuild = await runResearchCycle({
        trigger: TRIGGER,
        index: publicCorpus,
        baseGitSha: oldBase,
        cycleDir: sourceCycleDir,
        primaryInvoker: eligibleShared,
        reviewerInvoker: eligibleShared,
        availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
        now: () => new Date("2026-09-15T12:00:00.000Z"),
      });
      assert.equal(eligibleBuild.status, "READY_FOR_HUMAN_REVIEW", eligibleBuild.status === "FAILED" ? eligibleBuild.message : "");
      writeFileSync(join(sourceCycleDir, "research-change-set.json"), `${JSON.stringify((eligibleBuild as { changeSet: unknown }).changeSet, null, 2)}\n`, "utf8");

      const eligibleReviewer = new RoleCountingInvoker(VALID_REVIEW);
      const eligibleOutcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: oldBase,
        newBaseGitSha: newBase,
        index: publicCorpus,
        reviewerInvoker: eligibleReviewer,
        availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
        now: () => new Date("2026-09-15T12:00:00.000Z"),
        repoRoot: repoDir,
      });
      assert.equal(eligibleOutcome.status, "READY_FOR_HUMAN_REVIEW", eligibleOutcome.status === "FAILED" ? eligibleOutcome.message : "");
      assert.equal(eligibleReviewer.primaryCalls, 0);
      assert.equal(eligibleReviewer.reviewerCalls, 1);
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});

test("no canonical research/** write occurs on a successful revalidation", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    const oldBase = commit(repoDir, "c1");
    writeFileSync(join(repoDir, "unrelated-tool.txt"), "drift", "utf8");
    const newBase = commit(repoDir, "c2");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-no-canonical-write");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-no-canonical-write");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    const researchRootBefore = readFileSync(join(repoDir, "research", "r.yaml"), "utf8");
    try {
      await buildFrozenSourceCycle(sourceCycleDir, emptyIndex(), oldBase);
      const outcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: oldBase,
        newBaseGitSha: newBase,
        index: emptyIndex(),
        reviewerInvoker: new RoleCountingInvoker(VALID_REVIEW),
        repoRoot: repoDir,
      });
      assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW", outcome.status === "FAILED" ? outcome.message : "");
      // The synthetic repo's own research/ content (used only to exercise
      // ancestry/drift) is untouched by this module.
      assert.equal(readFileSync(join(repoDir, "research", "r.yaml"), "utf8"), researchRootBefore);
      // The synthetic repo's own canonical research/ tree has no uncommitted
      // changes after the run: revalidateFrozenCycleAtNewBase() never writes
      // canonical research anywhere, including this fixture repo.
      const status = execFileSync("git", ["status", "--porcelain", "--", "research/"], { cwd: repoDir, encoding: "utf8" }).trim();
      assert.equal(status, "");
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});

test("target must be a new cycle directory: refuses an already-populated target", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    const oldBase = commit(repoDir, "c1");
    writeFileSync(join(repoDir, "unrelated-tool.txt"), "drift", "utf8");
    const newBase = commit(repoDir, "c2");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-target-not-new");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-target-not-new");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    try {
      await buildFrozenSourceCycle(sourceCycleDir, emptyIndex(), oldBase);
      // Pre-populate the target with pre-existing cycle artifacts.
      mkdirSync(targetCycleDir, { recursive: true });
      writeFileSync(join(targetCycleDir, "manifest.json"), "{}", "utf8");

      const outcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: oldBase,
        newBaseGitSha: newBase,
        index: emptyIndex(),
        reviewerInvoker: new UnreachableInvoker(),
        repoRoot: repoDir,
      });
      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedCheck, "TARGET_NOT_NEW");
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});

// --- target must truly be new/empty ---------------------------------------

test("target with only a pre-existing resolution artifact is refused as not new", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    const oldBase = commit(repoDir, "c1");
    writeFileSync(join(repoDir, "unrelated-tool.txt"), "drift", "utf8");
    const newBase = commit(repoDir, "c2");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-target-stray-resolution");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-target-stray-resolution");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    try {
      await buildFrozenSourceCycle(sourceCycleDir, emptyIndex(), oldBase);
      // The target contains neither manifest.json nor research-change-set.json
      // (the only two paths a narrower "is this new" check might inspect) —
      // only a stray resolutions/ directory left over from some unrelated
      // prior use of this target path. The check must still refuse it.
      mkdirSync(join(targetCycleDir, "resolutions"), { recursive: true });
      writeFileSync(join(targetCycleDir, "resolutions", "EVD-OLD.json"), "{}", "utf8");

      const outcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: oldBase,
        newBaseGitSha: newBase,
        index: emptyIndex(),
        reviewerInvoker: new UnreachableInvoker(),
        repoRoot: repoDir,
      });
      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedCheck, "TARGET_NOT_NEW");
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});

// --- old base bound to source RCS -----------------------------------------

test("ADVERSARIAL: a caller-asserted oldBaseGitSha that the source cycle was never actually frozen against fails closed, even when it is genuinely an ancestor of the new base and research/** never drifted", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    // A = source RCS base (the source cycle is genuinely frozen against A).
    const a = commit(repoDir, "A (source RCS base)");
    // A -> B changes research/**.
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 2\n", "utf8");
    const b = commit(repoDir, "B (research/** change)");
    // B -> C only non-research.
    writeFileSync(join(repoDir, "unrelated-tool.txt"), "drift", "utf8");
    const c = commit(repoDir, "C (non-research change only)");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-old-base-binding");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-old-base-binding");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    try {
      // The source cycle's own frozen research-change-set.json genuinely
      // carries baseGitSha = A.
      await buildFrozenSourceCycle(sourceCycleDir, emptyIndex(), a);

      // The caller attempts oldBase = B: B is an ancestor of C, and
      // research/** did not change between B and C — so without the finding
      // 2 fix, ancestry/drift checks alone would let this through even
      // though the source cycle was never actually frozen against B, only
      // against A (B itself is where research/** drifted).
      const outcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: b,
        newBaseGitSha: c,
        index: emptyIndex(),
        reviewerInvoker: new UnreachableInvoker(),
        repoRoot: repoDir,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedCheck, "SOURCE_CYCLE_INVALID");
      assert.match(outcome.message, /does not match the source cycle's own frozen baseGitSha/);
      assert.equal(existsSync(join(targetCycleDir, "research-change-set.json")), false);
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});

// --- clean working tree before loading new-base corpus --------------------
//
// revalidate-cli.ts enforces this via precheckRepositoryState() (the same
// repository-state helper applyCanonicalIntegrationPlan() itself uses)
// before ever loading the canonical corpus — see revalidate-cli.ts's own
// module doc. precheckRepositoryState()'s own dirty-tree behavior already
// has dedicated coverage in gate/repository-state.test.ts; this test proves
// the specific scenario the task calls out (HEAD already equals the new
// base, but research/** has an uncommitted local edit) fails closed through
// the exact call revalidate-cli.ts makes, before any corpus load or
// revalidation/reviewer work could occur.

test("ADVERSARIAL: HEAD equals the new base but research/** has an uncommitted edit — repository-state precheck fails closed before corpus load", () => {
  const fixture = gitFixture();
  try {
    const head = fixture.head();
    writeFileSync(join(fixture.research, "sources", "SRC-DIRTY.yaml"), "source_id: SRC-DIRTY\nname: Dirty uncommitted edit\n", "utf8");

    // This is exactly the call revalidate-cli.ts makes (researchRoot, newBaseGitSha)
    // before it ever calls loadCorpusIndex()/revalidateFrozenCycleAtNewBase().
    const result = precheckRepositoryState(fixture.research, head);

    assert.equal(result.ok, false, "a dirty research/** tree must fail closed even though HEAD already equals the new base");
  } finally {
    fixture.cleanup();
  }
});

// --- revalidation HOLD resolvable/resumable through a supported operator path ---

test("a CLAIM_INFERENCE_LIMITS_PRESENT HOLD produced by revalidation is exact-bound resolved by owner, resumed without PRIMARY_AUTHOR, freshly availability-rechecked, and reaches a fresh INDEPENDENT_REVIEWER only once ELIGIBLE, with the same frozen candidates preserved", async () => {
  await withTempDir(async (repoDir) => {
    initSyntheticRepo(repoDir);
    mkdirSync(join(repoDir, "research"), { recursive: true });
    writeFileSync(join(repoDir, "research", "r.yaml"), "x: 1\n", "utf8");
    const oldBase = commit(repoDir, "c1");
    writeFileSync(join(repoDir, "unrelated-tool.txt"), "drift", "utf8");
    const newBase = commit(repoDir, "c2");

    const sourceCycleDir = resolve(process.cwd(), ".research-workbench", "test-source-cycle-resume-revalidation");
    const targetCycleDir = resolve(process.cwd(), ".research-workbench", "test-target-cycle-resume-revalidation");
    cleanupCycleDir(sourceCycleDir);
    cleanupCycleDir(targetCycleDir);
    try {
      const corpus = admissionIndex("public");
      const envelopeWithLimits = {
        schemaVersion: "1",
        manifest: { schemaVersion: "1", mode: "daily-discovery", investigationQuestion: TRIGGER.request, candidateFiles: ["EVD-NEW.yaml"], claimedRecordIds: ["EVD-NEW"], rationale: "r" },
        candidateFiles: [{ path: "EVD-NEW.yaml", yaml: "evidence_id: EVD-NEW\nprovenance:\n  sources:\n    - SRC-MATERIAL\nevidence_nature: claim\nclaim_authority: authoritative\ninference_limits:\n  - a bounded inference limit\n" }],
      };
      const shared = new SharedInvoker(envelopeWithLimits, VALID_REVIEW);
      const buildOutcome = await runResearchCycle({
        trigger: { mode: "daily-discovery", request: TRIGGER.request },
        index: corpus,
        baseGitSha: oldBase,
        cycleDir: sourceCycleDir,
        primaryInvoker: shared,
        reviewerInvoker: shared,
        availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
        now: () => new Date("2026-09-15T12:00:00.000Z"),
      });
      assert.equal(buildOutcome.status, "PRE_GATE_SAFETY_HOLD");
      writeInferenceLimitResolution(
        sourceCycleDir,
        { baseGitSha: oldBase, subjectId: "EVD-NEW", candidateFields: { evidence_id: "EVD-NEW", provenance: { sources: ["SRC-MATERIAL"] }, evidence_nature: "claim", claim_authority: "authoritative", inference_limits: ["a bounded inference limit"] }, inferenceLimits: ["a bounded inference limit"] },
        "owner",
        "reviewed and accepted"
      );
      const sourceResumeReviewer = new RoleCountingInvoker(VALID_REVIEW);
      const sourceResumeOutcome = await resumePreGateHold({
        index: corpus,
        baseGitSha: oldBase,
        trigger: { mode: "daily-discovery", request: TRIGGER.request },
        cycleDir: sourceCycleDir,
        reviewerInvoker: sourceResumeReviewer,
        availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
        inferenceLimitResolutionChecker: createInferenceLimitResolutionChecker(sourceCycleDir),
        now: () => new Date("2026-09-15T12:00:00.000Z"),
      });
      assert.equal(sourceResumeOutcome.status, "READY_FOR_HUMAN_REVIEW", sourceResumeOutcome.status === "FAILED" ? sourceResumeOutcome.message : "");
      writeFileSync(join(sourceCycleDir, "research-change-set.json"), `${JSON.stringify((sourceResumeOutcome as { changeSet: unknown }).changeSet, null, 2)}\n`, "utf8");

      // --- Revalidation run 1 at the NEW base, still an unresolved claim: PRE_GATE_SAFETY_HOLD, never a second incompatible freeze protocol ---
      const holdRunReviewer = new UnreachableInvoker();
      const revalidateOutcome = await revalidateFrozenCycleAtNewBase({
        sourceCycleDir,
        targetCycleDir,
        oldBaseGitSha: oldBase,
        newBaseGitSha: newBase,
        index: corpus,
        reviewerInvoker: holdRunReviewer,
        availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:10:00.000Z" }) },
        inferenceLimitResolutionChecker: createInferenceLimitResolutionChecker(targetCycleDir),
        now: () => new Date("2026-09-15T12:10:00.000Z"),
        repoRoot: repoDir,
      });
      assert.equal(revalidateOutcome.status, "PRE_GATE_SAFETY_HOLD", revalidateOutcome.status === "FAILED" ? revalidateOutcome.message : "");

      // (a)/(e): the HOLD's binding record is the SAME on-disk shape
      // run-cycle.ts's own normal-path HOLD uses (hold-freeze.json), keyed to
      // a BASE_REVALIDATION identity — not a second, incompatible freeze
      // shape — and manifest.json/candidates are byte-for-byte copies of the
      // already-frozen source content (no re-authoring), materialized only
      // because a genuine HOLD needs the same on-disk shape a normal-path
      // HOLD has in order to be resumable through the shared mechanism.
      assert.equal(existsSync(join(targetCycleDir, "hold-freeze.json")), true);
      assert.equal(existsSync(join(targetCycleDir, "manifest.json")), true, "a genuine HOLD materializes the already-frozen manifest so resume can reload it, exactly like a normal-path HOLD");
      assert.equal(
        readFileSync(join(targetCycleDir, "candidates", "EVD-NEW.yaml"), "utf8"),
        readFileSync(join(sourceCycleDir, "candidates", "EVD-NEW.yaml"), "utf8"),
        "the materialized candidate file is a byte-for-byte copy of the frozen source content, never re-authored"
      );
      const freezeRecord = JSON.parse(readFileSync(join(targetCycleDir, "hold-freeze.json"), "utf8"));
      assert.equal(freezeRecord.identity.kind, "BASE_REVALIDATION");
      assert.equal(freezeRecord.identity.sourceCycleDir, sourceCycleDir);
      assert.equal(freezeRecord.identity.oldBaseGitSha, oldBase);
      assert.equal(freezeRecord.baseGitSha, newBase);

      // (b): resumed without PRIMARY_AUTHOR, through hold-cli.ts's
      // resume-revalidation action (resumeRevalidationHold()) — the exact
      // same shared mechanism resumePreGateHold() uses. Still unresolved at
      // this point: must stay HOLD, never invoke the reviewer.
      const stillHoldReviewer = new UnreachableInvoker();
      const stillHoldOutcome = await resumeRevalidationHold({
        index: corpus,
        baseGitSha: newBase,
        sourceCycleDir,
        oldBaseGitSha: oldBase,
        cycleDir: targetCycleDir,
        reviewerInvoker: stillHoldReviewer,
        availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:20:00.000Z" }) },
        inferenceLimitResolutionChecker: createInferenceLimitResolutionChecker(targetCycleDir),
        now: () => new Date("2026-09-15T12:20:00.000Z"),
      });
      assert.equal(stillHoldOutcome.status, "PRE_GATE_SAFETY_HOLD", stillHoldOutcome.status === "FAILED" ? stillHoldOutcome.message : "");

      // (a): now record the exact-bound resolution against the TARGET cycle
      // (owner action — hold-cli.ts's existing record-resolution action).
      writeInferenceLimitResolution(
        targetCycleDir,
        { baseGitSha: newBase, subjectId: "EVD-NEW", candidateFields: { evidence_id: "EVD-NEW", provenance: { sources: ["SRC-MATERIAL"] }, evidence_nature: "claim", claim_authority: "authoritative", inference_limits: ["a bounded inference limit"] }, inferenceLimits: ["a bounded inference limit"] },
        "owner",
        "reviewed and accepted at the new base"
      );

      // (c)/(d): fresh availability rechecked, and a fresh INDEPENDENT_REVIEWER
      // invoked only now that admission is ELIGIBLE.
      const freshReviewer = new RoleCountingInvoker(VALID_REVIEW);
      const resumedOutcome = await resumeRevalidationHold({
        index: corpus,
        baseGitSha: newBase,
        sourceCycleDir,
        oldBaseGitSha: oldBase,
        cycleDir: targetCycleDir,
        reviewerInvoker: freshReviewer,
        availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:30:00.000Z" }) },
        inferenceLimitResolutionChecker: createInferenceLimitResolutionChecker(targetCycleDir),
        now: () => new Date("2026-09-15T12:30:00.000Z"),
      });
      assert.equal(resumedOutcome.status, "READY_FOR_HUMAN_REVIEW", resumedOutcome.status === "FAILED" ? resumedOutcome.message : "");
      assert.equal(freshReviewer.primaryCalls, 0, "PRIMARY_AUTHOR must remain unreachable through the resume path");
      assert.equal(freshReviewer.reviewerCalls, 1, "a fresh INDEPENDENT_REVIEWER must be invoked exactly once, only after ELIGIBLE");
      if (resumedOutcome.status !== "READY_FOR_HUMAN_REVIEW") return;

      // (e): the same frozen candidates are preserved end-to-end (never
      // re-derived/re-authored across the whole HOLD -> resume sequence).
      assert.deepEqual(
        resumedOutcome.changeSet.candidates.map((candidate) => candidate.fields.evidence_id),
        ["EVD-NEW"]
      );
      assert.equal(resumedOutcome.changeSet.baseGitSha, newBase);
    } finally {
      cleanupCycleDir(sourceCycleDir);
      cleanupCycleDir(targetCycleDir);
    }
  });
});
