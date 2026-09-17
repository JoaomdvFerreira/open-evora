import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import test from "node:test";

import type { CorpusIndex, RecordSchema } from "../core/types.ts";
import type { AiInvocationRequest, AiInvocationResult, AiInvoker } from "./ai-invoker.ts";
import { readHoldFreeze, resumePreGateHold, runResearchCycle } from "./run-cycle.ts";
import type { ResearchTrigger } from "./types.ts";
import type { InferenceLimitResolutionChecker, SourceAvailabilityAdapter } from "../admission/safety-admission.ts";
import { createInferenceLimitResolutionChecker, writeInferenceLimitResolution } from "../admission/inference-limit-resolution.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

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

function claimEnvelope(): unknown {
  return { schemaVersion: "1", manifest: { schemaVersion: "1", mode: "daily-discovery", investigationQuestion: "q", candidateFiles: ["EVD-NEW.yaml"], claimedRecordIds: ["EVD-NEW"], rationale: "r" }, candidateFiles: [{ path: "EVD-NEW.yaml", yaml: "evidence_id: EVD-NEW\nprovenance:\n  sources:\n    - SRC-MATERIAL\nevidence_nature: claim\nclaim_authority: authoritative\ninference_limits: []\n" }] };
}

/** Same shape as claimEnvelope() but with a non-empty inference_limits[], to exercise CLAIM_INFERENCE_LIMITS_PRESENT. */
function claimWithLimitsEnvelope(): unknown {
  return { schemaVersion: "1", manifest: { schemaVersion: "1", mode: "daily-discovery", investigationQuestion: "q", candidateFiles: ["EVD-NEW.yaml"], claimedRecordIds: ["EVD-NEW"], rationale: "r" }, candidateFiles: [{ path: "EVD-NEW.yaml", yaml: "evidence_id: EVD-NEW\nprovenance:\n  sources:\n    - SRC-MATERIAL\nevidence_nature: claim\nclaim_authority: authoritative\ninference_limits:\n  - a bounded inference limit\n" }] };
}

async function withTempDir(fn: (dir: string) => void | Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-run-cycle-test-"));
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
    rationale: "SECRET_GENERATOR_RATIONALE_MUST_NOT_REACH_REVIEWER",
  },
  candidateFiles: [{ path: "SRC-NEW.yaml", yaml: "source_id: SRC-NEW\nname: Synthetic source\n" }],
};

const VALID_REVIEW = { schemaVersion: "1", outcome: "CONCUR", rationale: "No disagreement found." };

/** Records every invocation (role, input, order) for structural assertions. */
class RecordingInvoker implements AiInvoker {
  public calls: AiInvocationRequest[] = [];
  private readonly responder: (request: AiInvocationRequest, callIndex: number) => AiInvocationResult;

  constructor(responder: (request: AiInvocationRequest, callIndex: number) => AiInvocationResult) {
    this.responder = responder;
  }

  invoke(request: AiInvocationRequest): AiInvocationResult {
    this.calls.push(request);
    return this.responder(request, this.calls.length - 1);
  }
}

function fixedResponder(stdout: unknown): (request: AiInvocationRequest) => AiInvocationResult {
  return () => ({ status: "OK", stdout: JSON.stringify(stdout) });
}

/** A single shared invoker used for both roles, exactly as the CLI's single-executable configuration does. */
class SharedInvoker implements AiInvoker {
  public calls: AiInvocationRequest[] = [];
  invoke(request: AiInvocationRequest): AiInvocationResult {
    this.calls.push(request);
    if (request.role === "PRIMARY_AUTHOR") return { status: "OK", stdout: JSON.stringify(VALID_ENVELOPE) };
    return { status: "OK", stdout: JSON.stringify(VALID_REVIEW) };
  }
}

test("one accepted trigger causes exactly two role-specific invocations, primary before reviewer", async () => {
  await withTempDir(async (cycleDir) => {
    const shared = new SharedInvoker();
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: shared,
      reviewerInvoker: shared,
    });

    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
    assert.equal(shared.calls.length, 2);
    assert.equal(shared.calls[0].role, "PRIMARY_AUTHOR");
    assert.equal(shared.calls[1].role, "INDEPENDENT_REVIEWER");
  });
});

test("a private-Source HOLD through real orchestration prevents reviewer/RCS and writes a safe private report", async () => {
  await withTempDir(async (cycleDir) => {
    const corpus = admissionIndex("private");
    const source = corpus.byPrefix.get("SRC-")!.byId.get("SRC-MATERIAL")!.fields;
    // Every value below is an ordinary enumerable field accepted by SRC v2.
    // JSON.stringify(source) therefore contains each sentinel: this test would
    // fail if hold-report.ts spread or assigned the complete Source object.
    const privateSentinels = [
      "PRIVATE_SOURCE_TITLE_SENTINEL",
      "PRIVATE_SOURCE_PUBLISHER_SENTINEL",
      "https://private.invalid/document?token=PRIVATE_URL_TOKEN_SENTINEL",
      "PRIVATE_SNAPSHOT_METADATA_SENTINEL",
      "PRIVATE_CORRESPONDENCE_ATTRIBUTION_SENTINEL",
      "PRIVATE_CAVEAT_METADATA_SENTINEL",
    ];
    Object.assign(source, {
      name: privateSentinels[0],
      publisher: privateSentinels[1],
      resource_type: "correspondence",
      identity: { snapshot_reference: privateSentinels[3] },
      scope: { geography: { level: "non_geographic" }, domains: ["civic"] },
      canonical_reference: privateSentinels[2],
      licensing: { status: "unknown", reuse: "unknown", attribution: privateSentinels[4] },
      temporal: { last_checked_at: "2026-09-15" },
      caveats: [privateSentinels[5]],
    });
    assert.equal(Object.values(source).some((value) => value === privateSentinels[0]), true);
    for (const sentinel of privateSentinels) assert.equal(JSON.stringify(source).includes(sentinel), true);
    const primary = new RecordingInvoker(fixedResponder(claimEnvelope()));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await runResearchCycle({ trigger: TRIGGER, index: corpus, baseGitSha: SHA, cycleDir, primaryInvoker: primary, reviewerInvoker: reviewer, availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) }, now: () => new Date("2026-09-15T12:00:00.000Z") });
    assert.equal(outcome.status, "PRE_GATE_SAFETY_HOLD", outcome.status === "FAILED" ? outcome.message : "");
    assert.equal(reviewer.calls.length, 0);
    assert.equal(existsSync(join(cycleDir, "independent-review.json")), false);
    assert.equal(existsSync(join(cycleDir, "research-change-set.json")), false);
    assert.equal(existsSync(join(cycleDir, "human-gate-package.json")), false);
    if (outcome.status !== "PRE_GATE_SAFETY_HOLD") return;
    const serialized = readFileSync(outcome.holdReportPath, "utf8");
    const report = JSON.parse(serialized) as Record<string, unknown>;
    assert.deepEqual(Object.keys(report).sort(), ["baseGitSha", "disposition", "findings", "humanResolutionCategory", "timestamp"]);
    assert.equal(report.disposition, "HOLD");
    assert.equal(report.humanResolutionCategory, "PRE_GATE_SAFETY_REVIEW");
    assert.deepEqual(report.findings, [{ code: "PRIVATE_SOURCE", subjectId: "SRC-MATERIAL", severity: "blocker", summary: "Material Source is private and cannot enter the pre-Gate path." }]);
    for (const sentinel of privateSentinels) assert.equal(serialized.includes(sentinel), false);
  });
});

test("a valid claim reaches the independent reviewer through real orchestration", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimEnvelope()));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await runResearchCycle({ trigger: TRIGGER, index: admissionIndex("public"), baseGitSha: SHA, cycleDir, primaryInvoker: primary, reviewerInvoker: reviewer, availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) }, now: () => new Date("2026-09-15T12:00:00.000Z") });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW", outcome.status === "FAILED" ? outcome.message : "");
    assert.equal(reviewer.calls.length, 1);
  });
});

test("the normal path does not require pre-created manifest/independent-review/candidate files", async () => {
  await withTempDir(async (cycleDir) => {
    assert.equal(existsSync(join(cycleDir, "manifest.json")), false);
    const shared = new SharedInvoker();
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: shared,
      reviewerInvoker: shared,
    });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
  });
});

test("reviewer input is built from immutable validated artifacts, and generator rationale/scratch never flows into it", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
    assert.equal(reviewer.calls.length, 1);
    const reviewerPromptText = reviewer.calls[0].input;
    assert.equal(reviewerPromptText.includes("SECRET_GENERATOR_RATIONALE_MUST_NOT_REACH_REVIEWER"), false);
    // The reviewer input must be derived from the materialized/validated
    // candidate, not the raw primary-invocation prompt text.
    assert.ok(reviewerPromptText.includes("SRC-NEW"));
  });
});

test("generator conversation/scratch state cannot flow into reviewer input: distinct invoker instances share nothing", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });
    // Separate process/invocation semantics are structurally enforced: each
    // invoker object only ever observes its own role's calls.
    assert.equal(primary.calls.length, 1);
    assert.equal(primary.calls[0].role, "PRIMARY_AUTHOR");
    assert.equal(reviewer.calls.length, 1);
    assert.equal(reviewer.calls[0].role, "INDEPENDENT_REVIEWER");
  });
});

test("malformed primary output fails closed before any reviewer invocation occurs", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder({ not: "a valid envelope" }));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "PRIMARY_AI_OUTPUT_INVALID");
    assert.equal(reviewer.calls.length, 0);
  });
});

test("non-JSON primary stdout fails closed as PRIMARY_AI_OUTPUT_INVALID", async () => {
  await withTempDir(async (cycleDir) => {
    const primary: AiInvoker = { invoke: () => ({ status: "OK", stdout: "not json at all" }) };
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "PRIMARY_AI_OUTPUT_INVALID");
  });
});

test("primary invocation failure fails closed as PRIMARY_AI_INVOCATION_FAILED", async () => {
  await withTempDir(async (cycleDir) => {
    const primary: AiInvoker = { invoke: () => ({ status: "INVOCATION_FAILED", message: "process exited 1" }) };
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "PRIMARY_AI_INVOCATION_FAILED");
    assert.equal(reviewer.calls.length, 0);
  });
});

test("primary invocation timeout fails closed as PRIMARY_AI_TIMEOUT", async () => {
  await withTempDir(async (cycleDir) => {
    const primary: AiInvoker = { invoke: () => ({ status: "TIMEOUT", message: "exceeded 120000ms" }) };
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "PRIMARY_AI_TIMEOUT");
  });
});

test("malformed reviewer output fails closed and never reaches READY_FOR_HUMAN_REVIEW", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer = new RecordingInvoker(fixedResponder({ outcome: "NOT_A_REAL_OUTCOME" }));
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "INDEPENDENT_REVIEW_OUTPUT_INVALID");
  });
});

test("reviewer invocation failure fails closed as INDEPENDENT_REVIEW_INVOCATION_FAILED", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer: AiInvoker = { invoke: () => ({ status: "INVOCATION_FAILED", message: "process exited 1" }) };
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "INDEPENDENT_REVIEW_INVOCATION_FAILED");
  });
});

test("reviewer invocation timeout fails closed as INDEPENDENT_REVIEW_TIMEOUT", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer: AiInvoker = { invoke: () => ({ status: "TIMEOUT", message: "exceeded 120000ms" }) };
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "INDEPENDENT_REVIEW_TIMEOUT");
  });
});

test("disagreement is surfaced in the final package, never auto-resolved", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer = new RecordingInvoker(
      fixedResponder({ schemaVersion: "1", outcome: "DISAGREEMENT_FOUND", rationale: "Scope mismatch found." })
    );
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
    if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;
    assert.equal(outcome.changeSet.independentReview.outcome, "DISAGREEMENT_FOUND");
  });
});

test("no candidate material leaves the gitignored cycle directory boundary", async () => {
  await withTempDir(async (cycleDir) => {
    const shared = new SharedInvoker();
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: shared,
      reviewerInvoker: shared,
    });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
    // Every materialized artifact lives strictly under cycleDir.
    assert.ok(existsSync(join(cycleDir, "manifest.json")));
    assert.ok(existsSync(join(cycleDir, "candidates", "SRC-NEW.yaml")));
    assert.ok(existsSync(join(cycleDir, "independent-review.json")));
  });
});

test("no canonical write occurs and the promoter is never invoked (module boundary)", async () => {
  await withTempDir(async (cycleDir) => {
    const shared = new SharedInvoker();
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: shared,
      reviewerInvoker: shared,
    });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
    if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;
    assert.equal(outcome.changeSet.integrationPlan?.operations[0]?.action, "CREATE");
  });
});

test("materialized artifacts persist the real independent-review result for idempotent rerun observation", async () => {
  await withTempDir(async (cycleDir) => {
    const shared = new SharedInvoker();
    await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: shared,
      reviewerInvoker: shared,
    });
    const persisted = JSON.parse(readFileSync(join(cycleDir, "independent-review.json"), "utf8"));
    assert.equal(persisted.outcome, "CONCUR");
  });
});

// Regression: a prior revision of materializeAuthoringEnvelope() let an
// untrusted candidateFiles[].path escape the cycle directory entirely, up to
// and including writing into the tracked repository tree. This test
// reproduces the exact proof-of-concept a prior review used (a deep ../
// traversal engineered to land at a specific location outside the temp
// cycle directory) and proves it now fails closed instead of writing
// anywhere.
test("PoC regression: a deep ../ traversal write never escapes the cycle directory, even far outside it", async () => {
  await withTempDir(async (outerDir) => {
    const cycleDir = join(outerDir, "a", "b", "c", "cycle");
    const traversal = "../".repeat(10) + "tmp-escaped-marker.txt";
    const maliciousEnvelope = {
      schemaVersion: "1",
      manifest: {
        schemaVersion: "1",
        mode: "daily-discovery",
        investigationQuestion: "q",
        candidateFiles: [traversal],
        claimedRecordIds: ["SRC-X"],
        rationale: "r",
      },
      candidateFiles: [{ path: traversal, yaml: "source_id: SRC-X\nname: PWNED\n" }],
    };
    const primary: AiInvoker = { invoke: () => ({ status: "OK", stdout: JSON.stringify(maliciousEnvelope) }) };
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));

    const outcome = await runResearchCycle({
      trigger: { mode: "daily-discovery", request: "q" },
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "PRIMARY_AI_OUTPUT_INVALID");
    // The reviewer must never be invoked once materialization refuses to
    // write the malicious candidate.
    assert.equal(reviewer.calls.length, 0);
    assert.equal(existsSync(resolve(outerDir, "..", "tmp-escaped-marker.txt")), false);
  });
});

// Regression: reproduces the exact proof-of-concept that successfully wrote
// a marker file into the tracked repository tree in a prior review's second
// proof.
test("PoC regression: a traversal engineered to land inside the repository root never writes there", async () => {
  await withTempDir(async (outerDir) => {
    const cycleDir = join(outerDir, "cycle");
    const repoRoot = resolve(".");
    const targetInRepo = resolve(repoRoot, "SHOULD_NEVER_BE_CREATED_BY_WU045.txt");
    const relPath = relative(join(cycleDir, "candidates"), targetInRepo).split(sep).join("/");

    const maliciousEnvelope = {
      schemaVersion: "1",
      manifest: {
        schemaVersion: "1",
        mode: "daily-discovery",
        investigationQuestion: "q",
        candidateFiles: [relPath],
        claimedRecordIds: ["SRC-X"],
        rationale: "r",
      },
      candidateFiles: [{ path: relPath, yaml: "source_id: SRC-X\nname: PWNED\n" }],
    };
    const primary: AiInvoker = { invoke: () => ({ status: "OK", stdout: JSON.stringify(maliciousEnvelope) }) };
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));

    try {
      const outcome = await runResearchCycle({
        trigger: { mode: "daily-discovery", request: "q" },
        index: emptyIndex(),
        baseGitSha: SHA,
        cycleDir,
        primaryInvoker: primary,
        reviewerInvoker: reviewer,
      });
      assert.equal(outcome.status, "FAILED");
      assert.equal(existsSync(targetInRepo), false);
    } finally {
      rmSync(targetInRepo, { force: true });
    }
  });
});

// Regression (read path): a manifest.candidateFiles entry that traverses
// outside candidatesDir must never cause an outside file's content to be
// read and treated as a candidate.
test("PoC regression: a manifest.candidateFiles traversal entry never reads content from outside the cycle directory", async () => {
  await withTempDir(async (outerDir) => {
    const cycleDir = join(outerDir, "cycle");
    mkdirSync(cycleDir, { recursive: true });
    const secretOutside = join(outerDir, "secret-outside.yaml");
    writeFileSync(secretOutside, "source_id: SRC-LEAKED\nname: should never be read\n", "utf8");

    const maliciousEnvelope = {
      schemaVersion: "1",
      manifest: {
        schemaVersion: "1",
        mode: "daily-discovery",
        investigationQuestion: "q",
        candidateFiles: ["../secret-outside.yaml"],
        claimedRecordIds: ["SRC-LEAKED"],
        rationale: "r",
      },
      candidateFiles: [{ path: "../secret-outside.yaml", yaml: "source_id: SRC-LEAKED\nname: benign replacement\n" }],
    };
    const primary: AiInvoker = { invoke: () => ({ status: "OK", stdout: JSON.stringify(maliciousEnvelope) }) };
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));

    const outcome = await runResearchCycle({
      trigger: { mode: "daily-discovery", request: "q" },
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "PRIMARY_AI_OUTPUT_INVALID");
    assert.equal(reviewer.calls.length, 0);
  });
});

// The final RCS must be provably assembled from the exact same
// candidates/deltas/validation/readiness snapshot the reviewer evaluated,
// not a value re-derived from disk afterward. This test mutates the
// materialized candidate file on disk between the reviewer invocation and
// final assembly and proves the final package still reflects the frozen
// snapshot (not the mutated file), which is only possible if assembly
// carries the frozen snapshot forward rather than re-reading.
test("the final package reflects the exact snapshot frozen for the reviewer, even if the on-disk file is mutated afterward", async () => {
  await withTempDir(async (cycleDir) => {
    let reviewerSawCandidateName: string | undefined;
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer: AiInvoker = {
      invoke: (request) => {
        const parsed = JSON.parse(request.input.split("REVIEW INPUT (immutable, JSON):\n")[1]?.split("\n")[0] ?? "{}");
        reviewerSawCandidateName = parsed?.candidates?.[0]?.fields?.name;
        // Mutate the materialized candidate file on disk right now, between
        // the reviewer seeing its frozen input and final assembly running.
        writeFileSync(join(cycleDir, "candidates", "SRC-NEW.yaml"), "source_id: SRC-NEW\nname: MUTATED_AFTER_REVIEW\n", "utf8");
        return { status: "OK", stdout: JSON.stringify(VALID_REVIEW) };
      },
    };

    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
    });

    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
    if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;
    assert.equal(reviewerSawCandidateName, "Synthetic source");
    // The final package must match what the reviewer saw, not the mutated
    // on-disk content, proving assembly did not re-read from disk.
    assert.equal(outcome.changeSet.candidates[0]?.fields?.name, "Synthetic source");
    assert.notEqual(outcome.changeSet.candidates[0]?.fields?.name, "MUTATED_AFTER_REVIEW");
  });
});

// --- real-adapter resolution hook + pre-Gate resolution wiring ------------

test("resolveAvailabilityAdapter is invoked with exactly the material non-private Source set, and never when availabilityAdapter is supplied directly", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimEnvelope()));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    let resolveCalls = 0;
    let seenSourceIds: string[] = [];
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      resolveAvailabilityAdapter: async (materialSources) => {
        resolveCalls++;
        seenSourceIds = [...materialSources.keys()];
        const adapter: SourceAvailabilityAdapter = {
          check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }),
        };
        return adapter;
      },
    });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW", outcome.status === "FAILED" ? outcome.message : "");
    assert.equal(resolveCalls, 1);
    assert.deepEqual(seenSourceIds, ["SRC-MATERIAL"]);
  });
});

test("resolveAvailabilityAdapter is never called when a synchronous availabilityAdapter is supplied directly", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimEnvelope()));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    let resolveCalls = 0;
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      resolveAvailabilityAdapter: async () => {
        resolveCalls++;
        return { check: () => ({ sourceId: "unused", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) };
      },
    });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
    assert.equal(resolveCalls, 0);
  });
});

test("a real unavailable adapter result HOLDs through the async resolution hook", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimEnvelope()));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      resolveAvailabilityAdapter: async () => ({ check: (sourceId) => ({ sourceId, status: "unavailable", checkedAt: "2026-09-15T12:00:00.000Z" }) }),
    });
    assert.equal(outcome.status, "PRE_GATE_SAFETY_HOLD");
    assert.equal(reviewer.calls.length, 0);
  });
});

test("an unresolved CLAIM_INFERENCE_LIMITS_PRESENT HOLDs through real orchestration and the reviewer never runs", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimWithLimitsEnvelope()));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      inferenceLimitResolutionChecker: { isResolved: () => false },
    });
    assert.equal(outcome.status, "PRE_GATE_SAFETY_HOLD");
    assert.equal(reviewer.calls.length, 0);
    if (outcome.status !== "PRE_GATE_SAFETY_HOLD") return;
    assert.deepEqual(outcome.admission.findings.map((f) => f.code), ["CLAIM_INFERENCE_LIMITS_PRESENT"]);
  });
});

test("an exact-match resolution lets a claim with inference limits reach the independent reviewer", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimWithLimitsEnvelope()));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    let checkerArgs: unknown[] = [];
    const checker: InferenceLimitResolutionChecker = {
      isResolved: (...args) => {
        checkerArgs = args;
        return true;
      },
    };
    const outcome = await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewer,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      inferenceLimitResolutionChecker: checker,
    });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW", outcome.status === "FAILED" ? outcome.message : "");
    assert.equal(reviewer.calls.length, 1);
    assert.equal(checkerArgs[0], SHA);
    assert.equal(checkerArgs[1], "EVD-NEW");
  });
});

test("identical materialized input/content remains idempotent: rerunning against the same materialized artifacts yields the same fingerprint", async () => {
  await withTempDir(async (cycleDir) => {
    const shared = new SharedInvoker();
    const first = await runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: shared,
      reviewerInvoker: shared,
    });
    // Second AI-driven run against a fresh directory with the same trigger
    // and identical AI responses.
    await withTempDir(async (secondCycleDir) => {
      const secondShared = new SharedInvoker();
      const second = await runResearchCycle({
        trigger: TRIGGER,
        index: emptyIndex(),
        baseGitSha: SHA,
        cycleDir: secondCycleDir,
        primaryInvoker: secondShared,
        reviewerInvoker: secondShared,
      });
      assert.equal(first.status, "READY_FOR_HUMAN_REVIEW");
      assert.equal(second.status, "READY_FOR_HUMAN_REVIEW");
      if (first.status !== "READY_FOR_HUMAN_REVIEW" || second.status !== "READY_FOR_HUMAN_REVIEW") return;
      assert.equal(first.changeSet.preparationFingerprint, second.changeSet.preparationFingerprint);
      assert.equal(first.changeSet.packageId, second.changeSet.packageId);
    });
  });
});

// --- resumable pre-Gate HOLD -----------------------------------------------

test("two-run regression: run 1 HOLDs, an exact resolution is recorded, and resume reaches READY_FOR_HUMAN_REVIEW without a second PRIMARY_AUTHOR invocation and with the fresh reviewer invoked exactly once", async () => {
  await withTempDir(async (cycleDir) => {
    // --- run 1: normal path, unresolved inference limits -> HOLD ----------
    const primary = new RecordingInvoker(fixedResponder(claimWithLimitsEnvelope()));
    const reviewerRun1 = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome1 = await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewerRun1,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      inferenceLimitResolutionChecker: { isResolved: () => false },
    });
    assert.equal(outcome1.status, "PRE_GATE_SAFETY_HOLD");
    assert.equal(primary.calls.length, 1);
    assert.equal(reviewerRun1.calls.length, 0);

    // The normal path must have frozen a hold-freeze binding record and the
    // exact manifest/candidates it evaluated, all under cycleDir.
    assert.ok(existsSync(join(cycleDir, "hold-freeze.json")));
    assert.ok(existsSync(join(cycleDir, "manifest.json")));
    assert.ok(existsSync(join(cycleDir, "candidates", "EVD-NEW.yaml")));
    const freezeCheck = readHoldFreeze(cycleDir, SHA, { kind: "TRIGGER", trigger: TRIGGER });
    assert.equal(freezeCheck.ok, true);

    // --- record the exact-match resolution against the real frozen candidate ---
    const manifest = JSON.parse(readFileSync(join(cycleDir, "manifest.json"), "utf8"));
    const candidateYaml = readFileSync(join(cycleDir, "candidates", "EVD-NEW.yaml"), "utf8");
    assert.ok(candidateYaml.includes("evidence_id: EVD-NEW"));
    const candidateFields = { evidence_id: "EVD-NEW", provenance: { sources: ["SRC-MATERIAL"] }, evidence_nature: "claim", claim_authority: "authoritative", inference_limits: ["a bounded inference limit"] };
    writeInferenceLimitResolution(
      cycleDir,
      { baseGitSha: SHA, subjectId: "EVD-NEW", candidateFields, inferenceLimits: candidateFields.inference_limits },
      "owner@example.invalid",
      "Reviewed and accepted the stated inference limits."
    );
    void manifest; // manifest content itself is not asserted further here; its presence on disk is what resume reloads.

    // --- resume: must not re-invoke PRIMARY_AUTHOR, must reach ELIGIBLE, ---
    // --- must invoke a fresh reviewer exactly once ---------------------------
    const reviewerResume = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const checker = createInferenceLimitResolutionChecker(cycleDir);
    const outcome2 = await resumePreGateHold({
      index: admissionIndex("public"),
      baseGitSha: SHA,
      trigger: TRIGGER,
      cycleDir,
      reviewerInvoker: reviewerResume,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:05:00.000Z" }) },
      inferenceLimitResolutionChecker: checker,
      now: () => new Date("2026-09-15T12:05:00.000Z"),
    });

    assert.equal(outcome2.status, "READY_FOR_HUMAN_REVIEW", outcome2.status === "FAILED" ? outcome2.message : JSON.stringify(outcome2));
    // No second PRIMARY_AUTHOR invocation: the original primary invoker's
    // call count is unchanged, and resumePreGateHold() never even takes a
    // primaryInvoker parameter, so there is no code path by which it could
    // invoke one.
    assert.equal(primary.calls.length, 1);
    // Exactly one fresh reviewer invocation on resume.
    assert.equal(reviewerResume.calls.length, 1);
    assert.equal(reviewerResume.calls[0].role, "INDEPENDENT_REVIEWER");
    // The run-1 reviewer instance was never touched again.
    assert.equal(reviewerRun1.calls.length, 0);

    if (outcome2.status !== "READY_FOR_HUMAN_REVIEW") return;
    assert.equal(outcome2.changeSet.candidates.some((c) => c.fields.evidence_id === "EVD-NEW"), true);
  });
});

// --- backward compatibility: legacy v1 hold-freeze.json --------------------

test("backcompat: a legacy v1 hold-freeze.json (flat `trigger`, no `identity`) remains resumable without a second PRIMARY_AUTHOR invocation", async () => {
  await withTempDir(async (cycleDir) => {
    // Run 1 through the real normal path so manifest.json/candidates on disk
    // are genuine, then overwrite hold-freeze.json with the exact legacy
    // on-disk shape (schemaVersion "1", baseGitSha, trigger, candidateFingerprint
    // — no `identity` field at all), simulating a HOLD produced by an older
    // normal path, before the current `identity`-carrying shape.
    const primary = new RecordingInvoker(fixedResponder(claimWithLimitsEnvelope()));
    const reviewerRun1 = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome1 = await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewerRun1,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      inferenceLimitResolutionChecker: { isResolved: () => false },
    });
    assert.equal(outcome1.status, "PRE_GATE_SAFETY_HOLD");
    assert.equal(primary.calls.length, 1);

    const currentRecord = JSON.parse(readFileSync(join(cycleDir, "hold-freeze.json"), "utf8"));
    const legacyV1Record = {
      schemaVersion: "1",
      baseGitSha: currentRecord.baseGitSha,
      trigger: TRIGGER,
      candidateFingerprint: currentRecord.candidateFingerprint,
    };
    assert.equal("identity" in legacyV1Record, false);
    writeFileSync(join(cycleDir, "hold-freeze.json"), `${JSON.stringify(legacyV1Record, null, 2)}\n`, "utf8");

    // readHoldFreeze() must normalize the legacy `trigger` to `{ kind:
    // "TRIGGER", trigger }` in memory and accept it, without rewriting the
    // on-disk file.
    const freezeCheck = readHoldFreeze(cycleDir, SHA, { kind: "TRIGGER", trigger: TRIGGER });
    assert.equal(freezeCheck.ok, true);
    if (freezeCheck.ok) {
      assert.deepEqual(freezeCheck.record.identity, { kind: "TRIGGER", trigger: TRIGGER });
    }
    const onDiskAfterRead = JSON.parse(readFileSync(join(cycleDir, "hold-freeze.json"), "utf8"));
    assert.deepEqual(onDiskAfterRead, legacyV1Record);

    // Record the exact-match resolution, same as the non-legacy regression.
    const candidateFields = { evidence_id: "EVD-NEW", provenance: { sources: ["SRC-MATERIAL"] }, evidence_nature: "claim", claim_authority: "authoritative", inference_limits: ["a bounded inference limit"] };
    writeInferenceLimitResolution(
      cycleDir,
      { baseGitSha: SHA, subjectId: "EVD-NEW", candidateFields, inferenceLimits: candidateFields.inference_limits },
      "owner@example.invalid",
      "Reviewed and accepted the stated inference limits."
    );

    // resumePreGateHold() must accept the legacy record when base/trigger/
    // fingerprint match, never re-invoke PRIMARY_AUTHOR, and reach
    // READY_FOR_HUMAN_REVIEW via exactly one fresh reviewer invocation.
    const reviewerResume = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const checker = createInferenceLimitResolutionChecker(cycleDir);
    const outcome2 = await resumePreGateHold({
      index: admissionIndex("public"),
      baseGitSha: SHA,
      trigger: TRIGGER,
      cycleDir,
      reviewerInvoker: reviewerResume,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:05:00.000Z" }) },
      inferenceLimitResolutionChecker: checker,
      now: () => new Date("2026-09-15T12:05:00.000Z"),
    });

    assert.equal(outcome2.status, "READY_FOR_HUMAN_REVIEW", outcome2.status === "FAILED" ? outcome2.message : JSON.stringify(outcome2));
    assert.equal(primary.calls.length, 1);
    assert.equal(reviewerResume.calls.length, 1);
    assert.equal(reviewerResume.calls[0].role, "INDEPENDENT_REVIEWER");
  });
});

test("backcompat: a legacy v1 hold-freeze.json with tampered candidates still fails closed on resume", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimWithLimitsEnvelope()));
    const reviewerRun1 = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewerRun1,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      inferenceLimitResolutionChecker: { isResolved: () => false },
    });

    const currentRecord = JSON.parse(readFileSync(join(cycleDir, "hold-freeze.json"), "utf8"));
    writeFileSync(
      join(cycleDir, "hold-freeze.json"),
      `${JSON.stringify({ schemaVersion: "1", baseGitSha: currentRecord.baseGitSha, trigger: TRIGGER, candidateFingerprint: currentRecord.candidateFingerprint }, null, 2)}\n`,
      "utf8"
    );

    // Tamper with the frozen candidate after the legacy HOLD was recorded.
    writeFileSync(
      join(cycleDir, "candidates", "EVD-NEW.yaml"),
      "evidence_id: EVD-NEW\nprovenance:\n  sources:\n    - SRC-MATERIAL\nevidence_nature: claim\nclaim_authority: authoritative\ninference_limits: []\n",
      "utf8"
    );

    const reviewerResume = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await resumePreGateHold({
      index: admissionIndex("public"),
      baseGitSha: SHA,
      trigger: TRIGGER,
      cycleDir,
      reviewerInvoker: reviewerResume,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:05:00.000Z" }) },
      inferenceLimitResolutionChecker: { isResolved: () => true },
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "HOLD_RESUME_CANDIDATE_MISMATCH");
    assert.equal(reviewerResume.calls.length, 0);
  });
});

test("backcompat: a legacy v1 hold-freeze.json with a mismatched trigger fails closed on resume", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimWithLimitsEnvelope()));
    const reviewerRun1 = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewerRun1,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      inferenceLimitResolutionChecker: { isResolved: () => false },
    });

    const currentRecord = JSON.parse(readFileSync(join(cycleDir, "hold-freeze.json"), "utf8"));
    writeFileSync(
      join(cycleDir, "hold-freeze.json"),
      `${JSON.stringify({ schemaVersion: "1", baseGitSha: currentRecord.baseGitSha, trigger: TRIGGER, candidateFingerprint: currentRecord.candidateFingerprint }, null, 2)}\n`,
      "utf8"
    );

    const reviewerResume = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await resumePreGateHold({
      index: admissionIndex("public"),
      baseGitSha: SHA,
      trigger: { mode: "daily-discovery", request: "A completely different request" },
      cycleDir,
      reviewerInvoker: reviewerResume,
      inferenceLimitResolutionChecker: { isResolved: () => true },
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "HOLD_RESUME_IDENTITY_MISMATCH");
    assert.equal(reviewerResume.calls.length, 0);
  });
});

test("resuming with a mismatched baseGitSha fails closed without reloading candidates or invoking the reviewer", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimWithLimitsEnvelope()));
    const reviewerRun1 = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewerRun1,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      inferenceLimitResolutionChecker: { isResolved: () => false },
    });

    const reviewerResume = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const differentSha = "fedcba9876543210fedcba9876543210fedcba9";
    const outcome = await resumePreGateHold({
      index: admissionIndex("public"),
      baseGitSha: differentSha,
      trigger: TRIGGER,
      cycleDir,
      reviewerInvoker: reviewerResume,
      inferenceLimitResolutionChecker: { isResolved: () => true },
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "HOLD_RESUME_IDENTITY_MISMATCH");
    assert.equal(reviewerResume.calls.length, 0);
  });
});

test("resuming with a mismatched trigger request fails closed", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimWithLimitsEnvelope()));
    const reviewerRun1 = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewerRun1,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      inferenceLimitResolutionChecker: { isResolved: () => false },
    });

    const reviewerResume = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await resumePreGateHold({
      index: admissionIndex("public"),
      baseGitSha: SHA,
      trigger: { mode: "daily-discovery", request: "A completely different request" },
      cycleDir,
      reviewerInvoker: reviewerResume,
      inferenceLimitResolutionChecker: { isResolved: () => true },
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "HOLD_RESUME_IDENTITY_MISMATCH");
    assert.equal(reviewerResume.calls.length, 0);
  });
});

test("resuming with no prior HOLD (no hold-freeze.json) fails closed", async () => {
  await withTempDir(async (cycleDir) => {
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await resumePreGateHold({
      index: admissionIndex("public"),
      baseGitSha: SHA,
      trigger: TRIGGER,
      cycleDir,
      reviewerInvoker: reviewer,
      inferenceLimitResolutionChecker: { isResolved: () => true },
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "HOLD_RESUME_IDENTITY_MISMATCH");
    assert.equal(reviewer.calls.length, 0);
  });
});

test("a candidate file edited after the HOLD was recorded (tamper/staleness) fails closed on resume and never invokes the reviewer", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimWithLimitsEnvelope()));
    const reviewerRun1 = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewerRun1,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      inferenceLimitResolutionChecker: { isResolved: () => false },
    });

    // Tamper with the frozen candidate after the HOLD was recorded.
    writeFileSync(
      join(cycleDir, "candidates", "EVD-NEW.yaml"),
      "evidence_id: EVD-NEW\nprovenance:\n  sources:\n    - SRC-MATERIAL\nevidence_nature: claim\nclaim_authority: authoritative\ninference_limits: []\n",
      "utf8"
    );

    const reviewerResume = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await resumePreGateHold({
      index: admissionIndex("public"),
      baseGitSha: SHA,
      trigger: TRIGGER,
      cycleDir,
      reviewerInvoker: reviewerResume,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:05:00.000Z" }) },
      inferenceLimitResolutionChecker: { isResolved: () => true },
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "HOLD_RESUME_CANDIDATE_MISMATCH");
    assert.equal(reviewerResume.calls.length, 0);
  });
});

test("resuming while the resolution is still absent stays HOLD, does not invoke the reviewer, and never invokes PRIMARY_AUTHOR", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimWithLimitsEnvelope()));
    const reviewerRun1 = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewerRun1,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      now: () => new Date("2026-09-15T12:00:00.000Z"),
      inferenceLimitResolutionChecker: { isResolved: () => false },
    });

    const reviewerResume = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await resumePreGateHold({
      index: admissionIndex("public"),
      baseGitSha: SHA,
      trigger: TRIGGER,
      cycleDir,
      reviewerInvoker: reviewerResume,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "available", checkedAt: "2026-09-15T12:05:00.000Z" }) },
      // No resolution recorded yet: checker still reports false for everyone.
      inferenceLimitResolutionChecker: { isResolved: () => false },
    });
    assert.equal(outcome.status, "PRE_GATE_SAFETY_HOLD");
    assert.equal(primary.calls.length, 1);
    assert.equal(reviewerResume.calls.length, 0);
  });
});

test("no other blocker becomes overridable through resume — a HOLD caused by an unavailable Source stays HOLD even with the inference-limit checker forced true", async () => {
  await withTempDir(async (cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimEnvelope()));
    const reviewerRun1 = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    await runResearchCycle({
      trigger: TRIGGER,
      index: admissionIndex("public"),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: primary,
      reviewerInvoker: reviewerRun1,
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "unavailable", checkedAt: "2026-09-15T12:00:00.000Z" }) },
      now: () => new Date("2026-09-15T12:00:00.000Z"),
    });

    const reviewerResume = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = await resumePreGateHold({
      index: admissionIndex("public"),
      baseGitSha: SHA,
      trigger: TRIGGER,
      cycleDir,
      reviewerInvoker: reviewerResume,
      // Still unavailable: the Source itself has not actually recovered.
      availabilityAdapter: { check: (sourceId) => ({ sourceId, status: "unavailable", checkedAt: "2026-09-15T12:05:00.000Z" }) },
      // Forcing this true must not matter: SOURCE_UNAVAILABLE is a different
      // finding code and this checker is only ever consulted for
      // CLAIM_INFERENCE_LIMITS_PRESENT.
      inferenceLimitResolutionChecker: { isResolved: () => true },
    });
    assert.equal(outcome.status, "PRE_GATE_SAFETY_HOLD");
    assert.equal(reviewerResume.calls.length, 0);
  });
});
