import assert from "node:assert/strict";
import test from "node:test";

import { SourceVerificationError, type SourceVerification, type SourceVerificationSet } from "../core/source-verifications.ts";
import type { CorpusIndex, ParsedRecord, RecordFields, RecordSchema } from "../core/types.ts";
import type { CandidateDelta, CandidateRecord } from "../integration/candidate-delta.ts";
import { detectLanguageSignals } from "../language/signals.ts";
import { buildProspectiveCorpusIndex } from "../integration/prospective-validation.ts";
import { sha256Hex } from "./fingerprint.ts";
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
function corpus(sourceFields: RecordFields = {}): CorpusIndex {
  const sources = ["SRC-A", "SRC-B", "SRC-C", "SRC-UNRELATED"].map((id) => ({ source_id: id, name: `Fonte ${id}`, ...sourceFields }));
  const byPrefix = new Map([
    ["SRC-", family(SOURCE_SCHEMA, sources)],
    ["EVD-", family(EVIDENCE_SCHEMA, [
      evidence("EVD-A", ["SRC-A"], "Muitas reclamações de moradores registadas."),
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
    sourceVerifications: { bySourceId: new Map(), issues: [] },
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

// ---------------------------------------------------------------------------
// Source Verification Support

/** Public, non-correspondence Sources whose reuse is unknown: eligible for support. */
const ELIGIBLE = { resource_type: "document", access: { level: "public" }, licensing: { reuse: "unknown" } };

function verification(sourceId: string, statements: string[]): SourceVerification {
  return {
    source_id: sourceId,
    retrieval: { retrieved_at: "2026-08-25", content_sha256: "ab".repeat(32), media_type: "application/pdf" },
    verified_claims: statements.map((statement, i) => ({ locator: `p. ${i + 1}`, statement })),
  };
}

function supportSet(entries: SourceVerification[], issues: SourceVerificationSet["issues"] = []): SourceVerificationSet {
  return { bySourceId: new Map(entries.map((entry) => [entry.source_id, entry])), issues };
}

test("a package without applicable support serializes byte-for-byte without a support field", () => {
  // Golden fingerprint of this fixture's reviewer input, which carries no support.
  const pkg = buildReviewerInputPackage(source());
  assert.equal("sourceVerificationContext" in pkg, false);
  assert.equal(sha256Hex(pkg), "085826a0f985475fc0afc0709d17b7db614022a45b6076510df4ba4a27bcf2db");
  // Support for Sources the package does not reach leaves it unchanged too.
  const unrelated = buildReviewerInputPackage(source({ index: corpus(), sourceVerifications: supportSet([verification("SRC-UNRELATED", ["Sem relação."]), verification("SRC-B", ["Fonte da versão substituída."])]) }));
  assert.equal(serializeReviewerInput(unrelated), serializeReviewerInput(pkg));
});

/** Support for every SRC in the fixture corpus, so only the selection rule decides what reaches the reviewer. */
const ALL_SUPPORT = supportSet([
  verification("SRC-UNRELATED", ["Sem relação."]),
  verification("SRC-C", ["Primeira afirmação no ficheiro.", "Segunda afirmação no ficheiro."]),
  verification("SRC-B", ["SRC-B só é alcançado pela versão canónica substituída de EVD-B."]),
  verification("SRC-A", ["SRC-A só é alcançado pela EVD-A inalterada."]),
]);

test("a PRB plus a changed EVD receives support only for the changed EVD's Sources, sorted by SRC ID with claims in file order", () => {
  const { candidates: [changedEvd, problem], deltas } = candidates();
  // The changed EVD-B now names two Sources; PRB-NEW still links the unchanged EVD-A (Source SRC-A).
  const twoSources = { ...changedEvd, fields: evidence("EVD-B", ["SRC-C", "SRC-B"], "Versão candidata.") };
  const input = source({ index: corpus(ELIGIBLE), candidates: [twoSources, problem], deltas });
  const without = buildReviewerInputPackage(input);
  const pkg = buildReviewerInputPackage({ ...input, sourceVerifications: ALL_SUPPORT });
  assert.deepEqual(pkg.sourceVerificationContext?.map((entry) => entry.source_id), ["SRC-B", "SRC-C"]);
  assert.deepEqual(pkg.sourceVerificationContext?.[1].verified_claims.map((claim) => claim.statement), ["Primeira afirmação no ficheiro.", "Segunda afirmação no ficheiro."]);
  // Support is review context: it never widens the evidence graph or adds records.
  assert.deepEqual(pkg.evidenceContext, without.evidenceContext);
  assert.deepEqual(pkg.candidates, without.candidates);
  assert.ok(pkg.evidenceContext.some((record) => record.id === "SRC-A"), "SRC-A is in the package through the unchanged EVD-A");
  const json = serializeReviewerInput(pkg);
  for (const text of ["Sem relação.", "SRC-A só é alcançado"]) assert.equal(json.includes(text), false, `${text} must not reach the reviewer`);
});

test("a PRB-only change receives no support, even for the Sources of the unchanged EVD it links", () => {
  const { candidates: [, problem], deltas: [, problemDelta] } = candidates();
  const input = source({ index: corpus(ELIGIBLE), candidates: [problem], deltas: [problemDelta], sourceVerifications: ALL_SUPPORT });
  const pkg = buildReviewerInputPackage(input);
  assert.deepEqual(pkg.evidenceContext.map((record) => record.id), ["EVD-A", "EVD-B", "SRC-A", "SRC-B"]);
  assert.equal("sourceVerificationContext" in pkg, false);
  // Support that is not applicable cannot fail the review either.
  const invalid = supportSet([], [{ file: "source-verifications/SRC-A.yaml", sourceId: "SRC-A", errors: ["verified_claims must be a list of 1-8 claims"] }]);
  assert.equal("sourceVerificationContext" in buildReviewerInputPackage({ ...input, sourceVerifications: invalid }), false);
});

test("an EVD candidate observed as NO_CHANGE does not make its Sources' support eligible", () => {
  const { candidates: [changedEvd, problem], deltas: [evdDelta, problemDelta] } = candidates();
  const input = source({ index: corpus(ELIGIBLE), candidates: [changedEvd, problem], deltas: [{ ...evdDelta, action: "NO_CHANGE" }, problemDelta], sourceVerifications: ALL_SUPPORT });
  assert.equal("sourceVerificationContext" in buildReviewerInputPackage(input), false);
});

test("an SRC-only change receives no support, and its eligibility is then not consulted", () => {
  const candidate = { recordFamily: "SRC-", fields: { source_id: "SRC-UNRELATED", name: "Fonte atualizada", ...ELIGIBLE } };
  const input = source({
    index: corpus(ELIGIBLE),
    candidates: [candidate],
    deltas: [{ recordFamily: "SRC-", id: "SRC-UNRELATED", action: "UPDATE" }],
    sourceVerifications: supportSet([verification("SRC-UNRELATED", ["Afirmação verificada da fonte."])]),
  });
  assert.equal("sourceVerificationContext" in buildReviewerInputPackage(input), false);
  const restricted = { ...candidate, fields: { ...candidate.fields, access: { level: "restricted" } } };
  assert.equal("sourceVerificationContext" in buildReviewerInputPackage({ ...input, candidates: [restricted] }), false);
});

test("support for a changed EVD's Source is judged against that Source's eligibility in the reviewed state", () => {
  const { candidates: [changedEvd], deltas: [evdDelta] } = candidates();
  const sourceCandidate = { recordFamily: "SRC-", fields: { source_id: "SRC-C", name: "Fonte C", ...ELIGIBLE } };
  const input = source({
    index: corpus(ELIGIBLE),
    candidates: [changedEvd, sourceCandidate],
    deltas: [evdDelta, { recordFamily: "SRC-", id: "SRC-C", action: "UPDATE" }],
    sourceVerifications: ALL_SUPPORT,
  });
  assert.deepEqual(buildReviewerInputPackage(input).sourceVerificationContext?.map((entry) => entry.source_id), ["SRC-C"]);
  const restricted = { ...sourceCandidate, fields: { ...sourceCandidate.fields, access: { level: "restricted" } } };
  assert.throws(() => buildReviewerInputPackage({ ...input, candidates: [changedEvd, restricted] }), SourceVerificationError);
});

test("invalid applicable support fails closed instead of being silently dropped", () => {
  const invalid = supportSet([], [{ file: "source-verifications/SRC-C.yaml", sourceId: "SRC-C", errors: ["verified_claims must be a list of 1-8 claims"] }]);
  assert.throws(() => buildReviewerInputPackage(source({ index: corpus(ELIGIBLE), sourceVerifications: invalid })), /SRC-C\.yaml: verified_claims must be a list of 1-8 claims/);
});

test("the reviewer-input fingerprint is bound to the applicable support content", () => {
  const fingerprint = (statement: string) => sha256Hex(buildReviewerInputPackage(source({ index: corpus(ELIGIBLE), sourceVerifications: supportSet([verification("SRC-C", [statement])]) })));
  assert.equal(fingerprint("A fonte regista reclamações."), fingerprint("A fonte regista reclamações."));
  assert.notEqual(fingerprint("A fonte regista reclamações."), fingerprint("A fonte regista reclamações em 2025."));
  assert.notEqual(fingerprint("A fonte regista reclamações."), sha256Hex(buildReviewerInputPackage(source({ index: corpus(ELIGIBLE) }))));
});
