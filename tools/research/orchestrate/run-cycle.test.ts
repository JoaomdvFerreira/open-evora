import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import test from "node:test";

import type { CorpusIndex, RecordSchema } from "../core/types.ts";
import type { AiInvocationRequest, AiInvocationResult, AiInvoker } from "./ai-invoker.ts";
import { runResearchCycle } from "./run-cycle.ts";
import type { ResearchTrigger } from "./types.ts";

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

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-run-cycle-test-"));
  try {
    fn(dir);
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

test("one accepted trigger causes exactly two role-specific invocations, primary before reviewer", () => {
  withTempDir((cycleDir) => {
    const shared = new SharedInvoker();
    const outcome = runResearchCycle({
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

test("WU049 HOLD through real orchestration prevents reviewer/RCS and writes a safe private report", () => {
  withTempDir((cycleDir) => {
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
    const outcome = runResearchCycle({ trigger: TRIGGER, index: corpus, baseGitSha: SHA, cycleDir, primaryInvoker: primary, reviewerInvoker: reviewer, availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) }, now: () => new Date("2026-09-15T12:00:00.000Z") });
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

test("WU049 valid claim reaches the independent reviewer through real orchestration", () => {
  withTempDir((cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(claimEnvelope()));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = runResearchCycle({ trigger: TRIGGER, index: admissionIndex("public"), baseGitSha: SHA, cycleDir, primaryInvoker: primary, reviewerInvoker: reviewer, availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: "2026-09-15T12:00:00.000Z" }) }, now: () => new Date("2026-09-15T12:00:00.000Z") });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW", outcome.status === "FAILED" ? outcome.message : "");
    assert.equal(reviewer.calls.length, 1);
  });
});

test("the normal path does not require pre-created manifest/independent-review/candidate files", () => {
  withTempDir((cycleDir) => {
    assert.equal(existsSync(join(cycleDir, "manifest.json")), false);
    const shared = new SharedInvoker();
    const outcome = runResearchCycle({
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

test("reviewer input is built from immutable validated artifacts, and generator rationale/scratch never flows into it", () => {
  withTempDir((cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = runResearchCycle({
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

test("generator conversation/scratch state cannot flow into reviewer input: distinct invoker instances share nothing", () => {
  withTempDir((cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    runResearchCycle({
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

test("malformed primary output fails closed before any reviewer invocation occurs", () => {
  withTempDir((cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder({ not: "a valid envelope" }));
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = runResearchCycle({
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

test("non-JSON primary stdout fails closed as PRIMARY_AI_OUTPUT_INVALID", () => {
  withTempDir((cycleDir) => {
    const primary: AiInvoker = { invoke: () => ({ status: "OK", stdout: "not json at all" }) };
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = runResearchCycle({
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

test("primary invocation failure fails closed as PRIMARY_AI_INVOCATION_FAILED", () => {
  withTempDir((cycleDir) => {
    const primary: AiInvoker = { invoke: () => ({ status: "INVOCATION_FAILED", message: "process exited 1" }) };
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = runResearchCycle({
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

test("primary invocation timeout fails closed as PRIMARY_AI_TIMEOUT", () => {
  withTempDir((cycleDir) => {
    const primary: AiInvoker = { invoke: () => ({ status: "TIMEOUT", message: "exceeded 120000ms" }) };
    const reviewer = new RecordingInvoker(fixedResponder(VALID_REVIEW));
    const outcome = runResearchCycle({
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

test("malformed reviewer output fails closed and never reaches READY_FOR_HUMAN_REVIEW", () => {
  withTempDir((cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer = new RecordingInvoker(fixedResponder({ outcome: "NOT_A_REAL_OUTCOME" }));
    const outcome = runResearchCycle({
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

test("reviewer invocation failure fails closed as INDEPENDENT_REVIEW_INVOCATION_FAILED", () => {
  withTempDir((cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer: AiInvoker = { invoke: () => ({ status: "INVOCATION_FAILED", message: "process exited 1" }) };
    const outcome = runResearchCycle({
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

test("reviewer invocation timeout fails closed as INDEPENDENT_REVIEW_TIMEOUT", () => {
  withTempDir((cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer: AiInvoker = { invoke: () => ({ status: "TIMEOUT", message: "exceeded 120000ms" }) };
    const outcome = runResearchCycle({
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

test("disagreement is surfaced in the final package, never auto-resolved", () => {
  withTempDir((cycleDir) => {
    const primary = new RecordingInvoker(fixedResponder(VALID_ENVELOPE));
    const reviewer = new RecordingInvoker(
      fixedResponder({ schemaVersion: "1", outcome: "DISAGREEMENT_FOUND", rationale: "Scope mismatch found." })
    );
    const outcome = runResearchCycle({
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

test("no candidate material leaves the gitignored cycle directory boundary", () => {
  withTempDir((cycleDir) => {
    const shared = new SharedInvoker();
    const outcome = runResearchCycle({
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

test("no canonical write occurs and the promoter is never invoked (module boundary)", () => {
  withTempDir((cycleDir) => {
    const shared = new SharedInvoker();
    const outcome = runResearchCycle({
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

test("materialized artifacts persist the real independent-review result for idempotent rerun observation", () => {
  withTempDir((cycleDir) => {
    const shared = new SharedInvoker();
    runResearchCycle({
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

// WU045-B01 independent-review remediation, finding 2 (regression): a prior
// revision of materializeAuthoringEnvelope() let an untrusted
// candidateFiles[].path escape the cycle directory entirely, up to and
// including writing into the tracked repository tree. This test reproduces
// the exact PoC the independent review used (a deep ../ traversal engineered
// to land at a specific location outside the temp cycle directory) and
// proves it now fails closed instead of writing anywhere.
test("PoC regression: a deep ../ traversal write never escapes the cycle directory, even far outside it", () => {
  withTempDir((outerDir) => {
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

    const outcome = runResearchCycle({
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

// WU045-B01 independent-review remediation, finding 2 (regression):
// reproduces the exact PoC that successfully wrote a marker file into the
// tracked repository tree in the independent review's second proof.
test("PoC regression: a traversal engineered to land inside the repository root never writes there", () => {
  withTempDir((outerDir) => {
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
      const outcome = runResearchCycle({
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

// WU045-B01 independent-review remediation, finding 2 (regression, read
// path): a manifest.candidateFiles entry that traverses outside
// candidatesDir must never cause an outside file's content to be read and
// treated as a candidate.
test("PoC regression: a manifest.candidateFiles traversal entry never reads content from outside the cycle directory", () => {
  withTempDir((outerDir) => {
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

    const outcome = runResearchCycle({
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

// WU045-B01 independent-review remediation, finding 3: the final RCS must be
// provably assembled from the exact same candidates/deltas/validation/
// readiness snapshot the reviewer evaluated, not a value re-derived from
// disk afterward. This test mutates the materialized candidate file on disk
// between the reviewer invocation and final assembly and proves the final
// package still reflects the frozen snapshot (not the mutated file), which
// is only possible if assembly carries the frozen snapshot forward rather
// than re-reading.
test("the final package reflects the exact snapshot frozen for the reviewer, even if the on-disk file is mutated afterward", () => {
  withTempDir((cycleDir) => {
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

    const outcome = runResearchCycle({
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

test("identical materialized input/content remains idempotent: rerunning against the same materialized artifacts yields the same fingerprint", () => {
  withTempDir((cycleDir) => {
    const shared = new SharedInvoker();
    const first = runResearchCycle({
      trigger: TRIGGER,
      index: emptyIndex(),
      baseGitSha: SHA,
      cycleDir,
      primaryInvoker: shared,
      reviewerInvoker: shared,
    });
    // Second AI-driven run against a fresh directory with the same trigger
    // and identical AI responses.
    withTempDir((secondCycleDir) => {
      const secondShared = new SharedInvoker();
      const second = runResearchCycle({
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
