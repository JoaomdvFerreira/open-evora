import assert from "node:assert/strict";
import test from "node:test";

import type { CorpusIndex, ParsedRecord, RecordFields, RecordSchema } from "../core/types.ts";
import type { CandidateDelta, CandidateRecord } from "../integration/candidate-delta.ts";
import { detectLanguageSignals } from "../language/signals.ts";
import { buildProspectiveCorpusIndex } from "../integration/prospective-validation.ts";
import { buildReviewerInputPackage, serializeReviewerInput, type ReviewerInputSource } from "./reviewer-input.ts";
import type { GenerationManifest } from "./types.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

const SOURCE_SCHEMA: RecordSchema = { prefix: "SRC-", directory: "sources", idField: "source_id" };
const EVIDENCE_SCHEMA: RecordSchema = {
  prefix: "EVD-",
  directory: "evidence",
  idField: "evidence_id",
  references: [{ field: "provenance.sources", isList: true, targetPrefix: "SRC-", targetDirectory: "sources", required: true }],
};
const PROBLEM_SCHEMA: RecordSchema = {
  prefix: "PRB-",
  directory: "problems",
  idField: "problem_id",
  references: [
    { field: "evidence", isList: true, itemField: "evidence_id", targetPrefix: "EVD-", targetDirectory: "evidence" },
    { field: "decision_basis.overlap_check.related_problems", isList: true, targetPrefix: "PRB-", targetDirectory: "problems" },
  ],
};

function manifest(overrides: Partial<GenerationManifest> = {}): GenerationManifest {
  return {
    schemaVersion: "1",
    mode: "daily-discovery",
    investigationQuestion: "What changed for waste collection this week?",
    candidateFiles: ["PRB-NEW.yaml", "EVD-B.yaml"],
    claimedRecordIds: ["PRB-NEW", "EVD-B"],
    rationale: "SECRET_GENERATOR_SCRATCH_REASONING_MUST_NOT_LEAK",
    ...overrides,
  };
}

function family(schema: RecordSchema, records: RecordFields[]) {
  const parsed: ParsedRecord[] = records.map((fields) => ({ file: `${schema.directory}/${fields[schema.idField]}.yaml`, fields }));
  return { schema, records: parsed, byId: new Map(parsed.map((r) => [r.fields[schema.idField] as string, r])) };
}

function evidence(id: string, sources: string[], summary: string): RecordFields {
  return { evidence_id: id, provenance: { sources }, observation: { summary }, evidence_nature: "measurement", inference_limits: [] };
}

/** Canonical corpus with dependencies the candidates need and records they do not. */
function corpus(): CorpusIndex {
  const sources = ["SRC-A", "SRC-B", "SRC-C", "SRC-UNRELATED"].map((id) => ({ source_id: id, name: `Fonte ${id}` }));
  const byPrefix = new Map([
    ["SRC-", family(SOURCE_SCHEMA, sources)],
    ["EVD-", family(EVIDENCE_SCHEMA, [
      evidence("EVD-A", ["SRC-A"], "Muitas reclamações registadas."),
      evidence("EVD-B", ["SRC-B"], "Versão canónica."),
      evidence("EVD-UNRELATED", ["SRC-UNRELATED"], "Sem relação."),
    ])],
    ["PRB-", family(PROBLEM_SCHEMA, [{ problem_id: "PRB-OTHER", problem_statement: "Outro problema." }])],
  ]);
  return { researchRoot: "/synthetic", byPrefix, totalRecords: 8 };
}

function candidates(): { candidates: CandidateRecord[]; deltas: CandidateDelta[] } {
  return {
    // Delta order (family, then ID), as CanonicalIntegrationReview provides.
    candidates: [
      { recordFamily: "EVD-", fields: evidence("EVD-B", ["SRC-C"], "Versão candidata.") },
      {
        recordFamily: "PRB-",
        fields: {
          problem_id: "PRB-NEW",
          problem_statement: "Muitos moradores relatam atrasos.",
          evidence: [{ evidence_id: "EVD-A" }, { evidence_id: "EVD-B" }],
          decision_basis: { overlap_check: { related_problems: ["PRB-OTHER"] } },
        },
      },
    ],
    deltas: [
      { recordFamily: "EVD-", id: "EVD-B", action: "UPDATE" },
      { recordFamily: "PRB-", id: "PRB-NEW", action: "CREATE" },
    ],
  };
}

function source(overrides: Partial<ReviewerInputSource> = {}): ReviewerInputSource {
  return {
    baseGitSha: SHA,
    manifest: manifest(),
    index: corpus(),
    ...candidates(),
    validation: { errors: [], totalRecords: 9 },
    readiness: "READY_FOR_INTEGRATION_GATE",
    ...overrides,
  };
}

test("the evidence context follows each candidate's PRB -> EVD -> SRC chain through the prospective corpus", () => {
  const pkg = buildReviewerInputPackage(source());
  assert.deepEqual(pkg.evidenceContext.map((r) => r.id), ["EVD-A", "SRC-A", "SRC-C"]);
  assert.deepEqual(pkg.evidenceContext.find((r) => r.id === "EVD-A")?.fields, corpus().byPrefix.get("EVD-")?.byId.get("EVD-A")?.fields);
});

test("unrelated corpus records and related problems are never included", () => {
  const json = serializeReviewerInput(buildReviewerInputPackage(source()));
  for (const id of ["SRC-UNRELATED", "EVD-UNRELATED", "SRC-B", "Outro problema."]) {
    assert.equal(json.includes(id), false, `${id} must not reach the reviewer`);
  }
});

test("a candidate replacement wins over its canonical version and is not duplicated in the context", () => {
  const pkg = buildReviewerInputPackage(source());
  assert.equal(pkg.evidenceContext.some((r) => r.id === "EVD-B"), false);
  assert.deepEqual(pkg.candidates[0].fields.provenance, { sources: ["SRC-C"] });
  const json = serializeReviewerInput(pkg);
  assert.equal(json.includes("Versão canónica."), false);
  assert.equal(json.includes("Versão candidata."), true);
});

test("signals are the unchanged candidate-scoped signals of the prospective corpus, under stable package IDs", () => {
  const input = source();
  const pkg = buildReviewerInputPackage(input);
  const expected = detectLanguageSignals(buildProspectiveCorpusIndex(input.index, input.candidates), { subjectIds: new Set(["PRB-NEW", "EVD-B"]) });
  assert.ok(expected.length > 0);
  assert.deepEqual(pkg.signals.map((s) => s.signal), expected);
  assert.deepEqual(pkg.signals.map((s) => s.signalId), expected.map((_, i) => `CLEC-SIG-${String(i + 1).padStart(4, "0")}`));
  // The canonical, non-candidate EVD-A also contains "Muitas" but is context, not a subject.
  assert.equal(pkg.signals.some((s) => s.signal.subjectId === "EVD-A"), false);
  assert.ok(pkg.signals.some((s) => s.signal.subjectId === "PRB-NEW" && s.signal.code === "VAGUE_QUANTITY"));
});

test("identical frozen input yields an identical package and identical bytes", () => {
  assert.equal(serializeReviewerInput(buildReviewerInputPackage(source())), serializeReviewerInput(buildReviewerInputPackage(source())));
});

test("the package is deeply immutable and detached from its inputs", () => {
  const input = source();
  const pkg = buildReviewerInputPackage(input);
  assert.ok(Object.isFrozen(pkg) && Object.isFrozen(pkg.candidates[0].fields) && Object.isFrozen(pkg.evidenceContext[0].fields) && Object.isFrozen(pkg.signals[0].signal));
  assert.equal(Object.isFrozen(input.candidates[0].fields), false);
  assert.notEqual(pkg.candidates[0].fields, input.candidates[0].fields);
});

test("the reviewer input never includes the primary author's free-form rationale", () => {
  const json = serializeReviewerInput(buildReviewerInputPackage(source()));
  assert.equal(json.includes("SECRET_GENERATOR_SCRATCH_REASONING_MUST_NOT_LEAK"), false);
  assert.equal(json.includes("rationale"), false);
});

test("the reviewer input includes only the allow-listed fields", () => {
  const pkg = buildReviewerInputPackage(source({ manifest: manifest({ mode: "problem-refresh", targetProblemId: "PRB-0001" }) }));
  assert.deepEqual(Object.keys(JSON.parse(serializeReviewerInput(pkg))).sort(), [
    "baseGitSha",
    "candidates",
    "deltas",
    "evidenceContext",
    "investigationQuestion",
    "mode",
    "readiness",
    "schemaVersion",
    "signals",
    "targetProblemId",
    "validation",
  ]);
});

test("targetProblemId is omitted for daily-discovery, never present as undefined/null", () => {
  assert.equal(serializeReviewerInput(buildReviewerInputPackage(source())).includes("targetProblemId"), false);
});
