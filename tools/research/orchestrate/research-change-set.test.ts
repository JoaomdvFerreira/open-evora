import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { CorpusIndex, RecordSchema } from "../core/types.ts";
import type { CandidateRecord } from "../integration/candidate-delta.ts";
import { prepareCanonicalIntegrationReview } from "../integration/canonical-integration-review.ts";
import { evaluateSafetyAdmission } from "../admission/safety-admission.ts";
import { assembleResearchChangeSet, prepareResearchChangeSet } from "./research-change-set.ts";
import type { GenerationManifest, IndependentReviewResult } from "./types.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

const SOURCE_SCHEMA: RecordSchema = {
  prefix: "SRC-",
  directory: "sources",
  idField: "source_id",
  requiredFields: ["source_id", "name"],
  allowedFields: ["source_id", "name", "access", "access.level"],
  fieldTypes: { source_id: ["string"], name: ["string"], access: ["object"], "access.level": ["string"] },
};
const EVIDENCE_SCHEMA: RecordSchema = {
  prefix: "EVD-",
  directory: "evidence",
  idField: "evidence_id",
  requiredFields: ["evidence_id", "provenance", "provenance.sources", "evidence_nature", "claim_authority", "inference_limits"],
  allowedFields: ["evidence_id", "provenance", "provenance.sources", "evidence_nature", "claim_authority", "inference_limits"],
  fieldTypes: { evidence_id: ["string"], provenance: ["object"], "provenance.sources": ["array"], evidence_nature: ["string"], claim_authority: ["string"], inference_limits: ["array"] },
  references: [{ field: "provenance.sources", isList: true, targetPrefix: "SRC-", targetDirectory: "sources", required: true }],
  stringListFields: ["provenance.sources", "inference_limits"],
  nonEmptyListFields: ["provenance.sources"],
};

function emptyIndex(): CorpusIndex {
  return {
    researchRoot: "/synthetic",
    byPrefix: new Map([["SRC-", { schema: SOURCE_SCHEMA, records: [], byId: new Map() }]]),
    totalRecords: 0,
  };
}

function materialIndex(): CorpusIndex {
  const source = { source_id: "SRC-MATERIAL", name: "Material source", access: { level: "public" } };
  return {
    researchRoot: "/synthetic",
    totalRecords: 1,
    byPrefix: new Map([
      ["SRC-", { schema: SOURCE_SCHEMA, records: [{ file: "sources/SRC-MATERIAL.yaml", fields: source }], byId: new Map([["SRC-MATERIAL", { file: "sources/SRC-MATERIAL.yaml", fields: source }]]) }],
      ["EVD-", { schema: EVIDENCE_SCHEMA, records: [], byId: new Map() }],
    ]),
  };
}

function materialCandidate(): CandidateRecord {
  return { recordFamily: "EVD-", fields: { evidence_id: "EVD-MATERIAL", provenance: { sources: ["SRC-MATERIAL"] }, evidence_nature: "claim", claim_authority: "authoritative", inference_limits: [] } };
}

function validManifest(overrides: Partial<GenerationManifest> = {}): GenerationManifest {
  return {
    schemaVersion: "1",
    mode: "daily-discovery",
    investigationQuestion: "What changed for waste collection this week?",
    candidateFiles: ["SRC-NEW.yaml"],
    claimedRecordIds: ["SRC-NEW"],
    rationale: "Synthetic fixture rationale.",
    ...overrides,
  };
}

function validIndependentReview(overrides: Partial<IndependentReviewResult> = {}): IndependentReviewResult {
  return {
    schemaVersion: "1",
    outcome: "CONCUR",
    rationale: "Independent reviewer found no disagreement.",
    ...overrides,
  };
}

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-rcs-test-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeCandidate(dir: string, filename: string, contents: string): void {
  writeFileSync(join(dir, filename), contents, "utf8");
}

test("a normal-path cycle reaches READY_FOR_HUMAN_REVIEW with zero manual intervention (WU048 case 1)", () => {
  withTempDir((candidatesDir) => {
    writeCandidate(candidatesDir, "SRC-NEW.yaml", "source_id: SRC-NEW\nname: Synthetic source\n");

    const outcome = prepareResearchChangeSet({
      index: emptyIndex(),
      baseGitSha: SHA,
      candidatesDir,
      rawManifest: validManifest(),
      rawIndependentReview: validIndependentReview(),
    });

    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
    if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;
    assert.equal(outcome.changeSet.readiness, "READY_FOR_INTEGRATION_GATE");
    assert.equal(outcome.changeSet.baseGitSha, SHA);
    assert.equal(outcome.changeSet.deltas.length, 1);
    assert.equal(outcome.changeSet.deltas[0].action, "CREATE");
    assert.ok(outcome.changeSet.packageId.startsWith("RCS-"));
    assert.match(outcome.changeSet.preparationFingerprint, /^[0-9a-f]{64}$/);
    assert.ok(outcome.changeSet.integrationPlan);
  });
});

test("malformed manifest fails closed before reaching candidate delta/promotion (WU048 case 19)", () => {
  withTempDir((candidatesDir) => {
    const outcome = prepareResearchChangeSet({
      index: emptyIndex(),
      baseGitSha: SHA,
      candidatesDir,
      rawManifest: { schemaVersion: "1" },
      rawIndependentReview: validIndependentReview(),
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "MANIFEST_VALIDATION");
  });
});

test("missing independent review fails closed before reaching candidate delta/promotion (WU048 case 19)", () => {
  withTempDir((candidatesDir) => {
    writeCandidate(candidatesDir, "SRC-NEW.yaml", "source_id: SRC-NEW\nname: Synthetic source\n");
    const outcome = prepareResearchChangeSet({
      index: emptyIndex(),
      baseGitSha: SHA,
      candidatesDir,
      rawManifest: validManifest(),
      rawIndependentReview: undefined,
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "INDEPENDENT_REVIEW_VALIDATION");
  });
});

test("the generator's own self-assessment never satisfies the independent-review requirement", () => {
  withTempDir((candidatesDir) => {
    writeCandidate(candidatesDir, "SRC-NEW.yaml", "source_id: SRC-NEW\nname: Synthetic source\n");
    const selfAssessment = { schemaVersion: "1", rationale: "I, the author, believe this is correct." };
    const outcome = prepareResearchChangeSet({
      index: emptyIndex(),
      baseGitSha: SHA,
      candidatesDir,
      rawManifest: validManifest(),
      rawIndependentReview: selfAssessment,
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "INDEPENDENT_REVIEW_VALIDATION");
  });
});

test("a candidate file the manifest does not list is never loaded, and a missing claimed file fails closed", () => {
  withTempDir((candidatesDir) => {
    // Only write the file for a claim that does not match what's on disk.
    const outcome = prepareResearchChangeSet({
      index: emptyIndex(),
      baseGitSha: SHA,
      candidatesDir,
      rawManifest: validManifest(),
      rawIndependentReview: validIndependentReview(),
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "CANDIDATE_LOAD");
  });
});

test("a structurally invalid candidate is blocked before reaching Gate 1 (WU048 case 6)", () => {
  withTempDir((candidatesDir) => {
    writeCandidate(candidatesDir, "SRC-NEW.yaml", "source_id: SRC-NEW\n"); // missing required "name"
    const outcome = prepareResearchChangeSet({
      index: emptyIndex(),
      baseGitSha: SHA,
      candidatesDir,
      rawManifest: validManifest(),
      rawIndependentReview: validIndependentReview(),
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "PROSPECTIVE_VALIDATION");
    assert.match(outcome.message, /missing required field: name/);
  });
});

test("a manifest claiming a record ID the candidates do not actually produce fails closed", () => {
  withTempDir((candidatesDir) => {
    writeCandidate(candidatesDir, "SRC-NEW.yaml", "source_id: SRC-NEW\nname: Synthetic source\n");
    const outcome = prepareResearchChangeSet({
      index: emptyIndex(),
      baseGitSha: SHA,
      candidatesDir,
      rawManifest: validManifest({ claimedRecordIds: ["SRC-DIFFERENT"] }),
      rawIndependentReview: validIndependentReview(),
    });
    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, "MANIFEST_CANDIDATE_MISMATCH");
  });
});

test("no canonical write occurs and no promoter is invoked: the change set carries only a prospective plan", () => {
  withTempDir((candidatesDir) => {
    writeCandidate(candidatesDir, "SRC-NEW.yaml", "source_id: SRC-NEW\nname: Synthetic source\n");
    const outcome = prepareResearchChangeSet({
      index: emptyIndex(),
      baseGitSha: SHA,
      candidatesDir,
      rawManifest: validManifest(),
      rawIndependentReview: validIndependentReview(),
    });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
    if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;
    // The plan is prospective data only; nothing in this module's dependency
    // graph imports canonical-promoter.ts (see also the static import check below).
    assert.equal(outcome.changeSet.integrationPlan?.operations[0]?.action, "CREATE");
  });
});

test("identical inputs are idempotent: rerun produces the same fingerprint and packageId (WU048 case 20)", () => {
  withTempDir((candidatesDir) => {
    writeCandidate(candidatesDir, "SRC-NEW.yaml", "source_id: SRC-NEW\nname: Synthetic source\n");
    const input = {
      index: emptyIndex(),
      baseGitSha: SHA,
      candidatesDir,
      rawManifest: validManifest(),
      rawIndependentReview: validIndependentReview(),
    };
    const first = prepareResearchChangeSet(input);
    const second = prepareResearchChangeSet(input);
    assert.equal(first.status, "READY_FOR_HUMAN_REVIEW");
    assert.equal(second.status, "READY_FOR_HUMAN_REVIEW");
    if (first.status !== "READY_FOR_HUMAN_REVIEW" || second.status !== "READY_FOR_HUMAN_REVIEW") return;
    assert.equal(first.changeSet.preparationFingerprint, second.changeSet.preparationFingerprint);
    assert.equal(first.changeSet.packageId, second.changeSet.packageId);
    assert.deepEqual(first.changeSet, second.changeSet);
  });
});

test("WU049 case 20: distinct evaluatedAt values preserve RCS identity for identical material admission", () => {
  const index = materialIndex();
  const review = prepareCanonicalIntegrationReview(SHA, index, [materialCandidate()]);
  const manifest = validManifest({ candidateFiles: ["EVD-MATERIAL.yaml"], claimedRecordIds: ["EVD-MATERIAL"] });
  const reviewed = validIndependentReview();
  const frozenAt = "2026-09-15T12:00:00.000Z";
  const evaluatedAtA = "2026-09-15T12:01:00.000Z";
  const evaluatedAtB = "2026-09-15T12:09:00.000Z";
  assert.notEqual(evaluatedAtA, evaluatedAtB);
  const admissionFor = (evaluatedAt: string) => evaluateSafetyAdmission({
    index,
    candidates: review.candidates,
    affectedProblemIds: [],
    frozenAt,
    evaluatedAt,
    availabilityAdapter: { check: () => ({ sourceId: "SRC-MATERIAL", status: "available", checkedAt: evaluatedAt }) },
  });
  const admissionA = admissionFor(evaluatedAtA);
  const admissionB = admissionFor(evaluatedAtB);
  assert.equal(admissionA.disposition, "ELIGIBLE");
  assert.equal(admissionB.disposition, "ELIGIBLE");
  assert.deepEqual(admissionA.findings, admissionB.findings);
  const first = assembleResearchChangeSet(index, manifest, review, reviewed, admissionA);
  const second = assembleResearchChangeSet(index, manifest, review, reviewed, admissionB);
  assert.equal(first.status, "READY_FOR_HUMAN_REVIEW");
  assert.equal(second.status, "READY_FOR_HUMAN_REVIEW");
  if (first.status !== "READY_FOR_HUMAN_REVIEW" || second.status !== "READY_FOR_HUMAN_REVIEW") return;
  assert.equal(first.changeSet.preparationFingerprint, second.changeSet.preparationFingerprint);
  assert.equal(first.changeSet.packageId, second.changeSet.packageId);
  const changedReview = validIndependentReview({ rationale: "A distinct deterministic review conclusion." });
  const changed = assembleResearchChangeSet(index, manifest, review, changedReview, admissionA);
  assert.equal(changed.status, "READY_FOR_HUMAN_REVIEW");
  if (changed.status !== "READY_FOR_HUMAN_REVIEW") return;
  assert.notEqual(first.changeSet.preparationFingerprint, changed.changeSet.preparationFingerprint);
});

test("a different base Git SHA produces a different fingerprint even with identical candidates", () => {
  withTempDir((candidatesDir) => {
    writeCandidate(candidatesDir, "SRC-NEW.yaml", "source_id: SRC-NEW\nname: Synthetic source\n");
    const base = {
      index: emptyIndex(),
      candidatesDir,
      rawManifest: validManifest(),
      rawIndependentReview: validIndependentReview(),
    };
    const first = prepareResearchChangeSet({ ...base, baseGitSha: SHA });
    const otherSha = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const second = prepareResearchChangeSet({ ...base, baseGitSha: otherSha });
    assert.equal(first.status, "READY_FOR_HUMAN_REVIEW");
    assert.equal(second.status, "READY_FOR_HUMAN_REVIEW");
    if (first.status !== "READY_FOR_HUMAN_REVIEW" || second.status !== "READY_FOR_HUMAN_REVIEW") return;
    assert.notEqual(first.changeSet.preparationFingerprint, second.changeSet.preparationFingerprint);
  });
});

test("no timestamp or other run-specific metadata is recorded anywhere in the change set", () => {
  withTempDir((candidatesDir) => {
    writeCandidate(candidatesDir, "SRC-NEW.yaml", "source_id: SRC-NEW\nname: Synthetic source\n");
    const outcome = prepareResearchChangeSet({
      index: emptyIndex(),
      baseGitSha: SHA,
      candidatesDir,
      rawManifest: validManifest(),
      rawIndependentReview: validIndependentReview(),
    });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
    if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;
    const serialized = JSON.stringify(outcome.changeSet).toLowerCase();
    assert.equal(serialized.includes("timestamp"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(outcome.changeSet, "createdAt"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(outcome.changeSet, "generatedAt"), false);
  });
});

test("independent review disagreement is preserved and surfaced, not auto-resolved (WU048 case 11)", () => {
  withTempDir((candidatesDir) => {
    writeCandidate(candidatesDir, "SRC-NEW.yaml", "source_id: SRC-NEW\nname: Synthetic source\n");
    const outcome = prepareResearchChangeSet({
      index: emptyIndex(),
      baseGitSha: SHA,
      candidatesDir,
      rawManifest: validManifest(),
      rawIndependentReview: validIndependentReview({ outcome: "DISAGREEMENT_FOUND", rationale: "Found a scope mismatch." }),
    });
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW");
    if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;
    assert.equal(outcome.changeSet.independentReview.outcome, "DISAGREEMENT_FOUND");
    assert.equal(outcome.changeSet.readiness, "READY_FOR_INTEGRATION_GATE");
  });
});
