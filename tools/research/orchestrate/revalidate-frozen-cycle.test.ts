import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import type { CorpusIndex, RecordSchema } from "../core/types.ts";
import type { AiInvocationRequest, AiInvocationResult, AiInvoker } from "./ai-invoker.ts";
import { resumePreGateHold, runResearchCycle } from "./run-cycle.ts";
import {
  revalidateFrozenCycleAtNewBase,
  verifyNoResearchDrift,
  verifyOldBaseIsAncestor,
} from "./revalidate-frozen-cycle.ts";
import type { ResearchTrigger } from "./types.ts";
import { createInferenceLimitResolutionChecker, writeInferenceLimitResolution } from "../admission/inference-limit-resolution.ts";

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

/** Builds a genuinely-assembled, internally-consistent source cycle at OLD_SHA via the real normal path, so its RCS/manifest/candidates are exactly what production would freeze. */
async function buildFrozenSourceCycle(sourceCycleDir: string, index: CorpusIndex = emptyIndex()): Promise<void> {
  const shared = new SharedInvoker(VALID_ENVELOPE, VALID_REVIEW);
  const outcome = await runResearchCycle({
    trigger: TRIGGER,
    index,
    baseGitSha: OLD_SHA,
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
      await buildFrozenSourceCycle(sourceCycleDir);

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
      await buildFrozenSourceCycle(sourceCycleDir);

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
      await buildFrozenSourceCycle(sourceCycleDir);
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
      await buildFrozenSourceCycle(sourceCycleDir);
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
      await buildFrozenSourceCycle(sourceCycleDir);

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
      await buildFrozenSourceCycle(sourceCycleDir);
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
      // This repository's own canonical research/ tree has no uncommitted
      // changes after the run: revalidateFrozenCycleAtNewBase() never writes
      // canonical research anywhere, including this real repo.
      const status = execFileSync("git", ["status", "--porcelain", "--", "research/"], { cwd: process.cwd(), encoding: "utf8" }).trim();
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
      await buildFrozenSourceCycle(sourceCycleDir);
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
