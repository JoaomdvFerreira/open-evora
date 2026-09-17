import assert from "node:assert/strict";
import test from "node:test";
import type { CorpusIndex, RecordSchema } from "../core/types.ts";
import { deriveMaterialNonPrivateSources, evaluateSafetyAdmission, type InferenceLimitResolutionChecker, type SourceAvailabilityAdapter } from "./safety-admission.ts";

const schema: RecordSchema = { prefix: "SRC-", directory: "sources", idField: "source_id" };
const evidenceSchema: RecordSchema = { prefix: "EVD-", directory: "evidence", idField: "evidence_id" };
const problemSchema: RecordSchema = { prefix: "PRB-", directory: "problems", idField: "problem_id" };
function index(source: Record<string, unknown>): CorpusIndex { return { researchRoot: "/synthetic", totalRecords: 1, byPrefix: new Map([["SRC-", { schema, records: [{ file: "sources/SRC-1.yaml", fields: source }], byId: new Map([["SRC-1", { file: "sources/SRC-1.yaml", fields: source }]]) }], ["EVD-", { schema: evidenceSchema, records: [], byId: new Map() }]]) }; }
const source = { source_id: "SRC-1", access: { level: "public" } };
const claim = (overrides: Record<string, unknown> = {}) => ({ recordFamily: "EVD-", fields: { evidence_id: "EVD-1", provenance: { sources: ["SRC-1"] }, evidence_nature: "claim", claim_authority: "authoritative", inference_limits: [], ...overrides } });
const time = "2026-09-15T12:00:00.000Z";
function evaluate(candidate = claim(), adapter?: SourceAvailabilityAdapter) { return evaluateSafetyAdmission({ index: index(source), candidates: [candidate], affectedProblemIds: [], frozenAt: time, evaluatedAt: time, availabilityAdapter: adapter ?? { check: () => ({ sourceId: "SRC-1", status: "available", checkedAt: time }) } }); }

test("authoritative claim with explicit empty limits and fresh available Source is eligible", () => assert.equal(evaluate().disposition, "ELIGIBLE"));
test("claim authority and inference limits fail closed without reading their text", () => {
  const result = evaluate(claim({ claim_authority: "unknown", inference_limits: ["text never interpreted"] }));
  assert.deepEqual(result.findings.map((f) => f.code), ["CLAIM_AUTHORITY_UNKNOWN", "CLAIM_INFERENCE_LIMITS_PRESENT"]);
  assert.equal(result.disposition, "HOLD");
});
test("missing, stale, unavailable and unverifiable availability evidence hold", () => {
  const noAdapter = evaluateSafetyAdmission({ index: index(source), candidates: [claim()], affectedProblemIds: [], frozenAt: time, evaluatedAt: time });
  assert.equal(noAdapter.findings[0]?.code, "SOURCE_REVALIDATION_MISSING");
  assert.equal(evaluate(claim(), { check: () => ({ sourceId: "SRC-1", status: "available", checkedAt: "2026-09-15T11:49:59.000Z" }) }).findings[0]?.code, "SOURCE_REVALIDATION_STALE");
  assert.equal(evaluate(claim(), { check: () => ({ sourceId: "SRC-1", status: "unavailable", checkedAt: time }) }).findings[0]?.code, "SOURCE_UNAVAILABLE");
  assert.equal(evaluate(claim(), { check: () => ({ sourceId: "SRC-1", status: "timeout", checkedAt: time }) }).findings[0]?.code, "SOURCE_AVAILABILITY_UNVERIFIABLE");
});
test("private Sources hold before the adapter can be invoked", () => {
  let calls = 0;
  const result = evaluateSafetyAdmission({ index: index({ source_id: "SRC-1", access: { level: "private" } }), candidates: [claim()], affectedProblemIds: [], frozenAt: time, evaluatedAt: time, availabilityAdapter: { check: () => { calls++; return { sourceId: "SRC-1", status: "available", checkedAt: time }; } } });
  assert.equal(result.findings[0]?.code, "PRIVATE_SOURCE"); assert.equal(calls, 0);
});

test("availability time boundaries require checkedAt from freeze through evaluation and within ten minutes", () => {
  const cases: Array<[string, string, string]> = [["2026-09-15T12:00:00.000Z", "2026-09-15T12:00:00.000Z", "ELIGIBLE"], ["2026-09-15T12:10:00.000Z", "2026-09-15T12:10:00.000Z", "ELIGIBLE"], ["2026-09-15T12:00:00.000Z", "2026-09-15T12:10:00.000Z", "ELIGIBLE"], ["2026-09-15T12:00:00.000Z", "2026-09-15T12:10:00.001Z", "HOLD"], ["2026-09-15T11:59:59.999Z", "2026-09-15T12:00:00.000Z", "HOLD"], ["2026-09-15T12:00:00.001Z", "2026-09-15T12:00:00.000Z", "HOLD"]];
  for (const [checkedAt, evaluatedAt, expected] of cases) {
    const result = evaluateSafetyAdmission({ index: index(source), candidates: [claim()], affectedProblemIds: [], frozenAt: time, evaluatedAt, availabilityAdapter: { check: () => ({ sourceId: "SRC-1", status: "available", checkedAt }) } });
    assert.equal(result.disposition, expected);
  }
});

test("adapter throws fail closed with a safe fixed finding", () => {
  const result = evaluateSafetyAdmission({ index: index(source), candidates: [claim()], affectedProblemIds: [], frozenAt: time, evaluatedAt: time, availabilityAdapter: { check: () => { throw new Error("https://private.invalid/?token=secret"); } } });
  assert.deepEqual(result.findings.map((finding) => [finding.code, finding.summary]), [["SOURCE_AVAILABILITY_UNVERIFIABLE", "Material Source availability could not be verified."]]);
});

test("canonical PRB evidence effects become non-blocking structured contradiction findings with context", () => {
  const problem = { problem_id: "PRB-1", evidence: [{ evidence_id: "EVD-1", effects: ["CONTRADICTS"], research_roles: ["LOCAL_OBSERVATION"] }], decision_basis: { contradiction_search: { summary: "The contradiction concerns scope." } } };
  const base = index(source);
  const rich: CorpusIndex = { ...base, byPrefix: new Map([...base.byPrefix, ["PRB-", { schema: problemSchema, records: [{ file: "problems/PRB-1.yaml", fields: problem }], byId: new Map([["PRB-1", { file: "problems/PRB-1.yaml", fields: problem }]]) }]]) };
  const result = evaluateSafetyAdmission({ index: rich, candidates: [claim()], affectedProblemIds: ["PRB-1"], frozenAt: time, evaluatedAt: time, availabilityAdapter: { check: () => ({ sourceId: "SRC-1", status: "available", checkedAt: time }) } });
  assert.equal(result.disposition, "ELIGIBLE");
  assert.deepEqual(result.findings, [{ code: "CONTRADICTION_VISIBLE", subjectId: "EVD-1", severity: "info", summary: "The contradiction concerns scope.", evidenceReferences: ["PRB-1", "EVD-1"] }]);
});

test("findings deduplicate by code and subject and sort independent of input order", () => {
  const candidates = [claim({ evidence_id: "EVD-B", claim_authority: "unknown", inference_limits: ["x"] }), claim({ evidence_id: "EVD-A", claim_authority: "unknown", inference_limits: ["x"] })];
  const result = evaluateSafetyAdmission({ index: index(source), candidates: [...candidates, candidates[0]!], affectedProblemIds: [], frozenAt: time, evaluatedAt: time, availabilityAdapter: { check: () => ({ sourceId: "SRC-1", status: "available", checkedAt: time }) } });
  assert.deepEqual(result.findings.map((finding) => `${finding.code}:${finding.subjectId}`), ["CLAIM_AUTHORITY_UNKNOWN:EVD-A", "CLAIM_AUTHORITY_UNKNOWN:EVD-B", "CLAIM_INFERENCE_LIMITS_PRESENT:EVD-A", "CLAIM_INFERENCE_LIMITS_PRESENT:EVD-B"]);
});

test("candidate affected PRB decision basis makes only its referenced Source material", () => {
  const material = { source_id: "SRC-MATERIAL", access: { level: "public" } };
  const unrelated = { source_id: "SRC-UNRELATED", access: { level: "public" } };
  const evidence = { evidence_id: "EVD-BASIS", provenance: { sources: ["SRC-MATERIAL"] }, evidence_nature: "observation", inference_limits: [] };
  const corpus: CorpusIndex = { researchRoot: "/synthetic", totalRecords: 3, byPrefix: new Map([
    ["SRC-", { schema, records: [{ file: "sources/SRC-MATERIAL.yaml", fields: material }, { file: "sources/SRC-UNRELATED.yaml", fields: unrelated }], byId: new Map([["SRC-MATERIAL", { file: "sources/SRC-MATERIAL.yaml", fields: material }], ["SRC-UNRELATED", { file: "sources/SRC-UNRELATED.yaml", fields: unrelated }]]) }],
    ["EVD-", { schema: evidenceSchema, records: [{ file: "evidence/EVD-BASIS.yaml", fields: evidence }], byId: new Map([["EVD-BASIS", { file: "evidence/EVD-BASIS.yaml", fields: evidence }]]) }],
    ["PRB-", { schema: problemSchema, records: [], byId: new Map() }],
  ]) };
  const candidateProblem = { recordFamily: "PRB-", fields: { problem_id: "PRB-CANDIDATE", decision_basis: { supporting_evidence: ["EVD-BASIS"] } } };
  const checked: string[] = [];
  const result = evaluateSafetyAdmission({ index: corpus, candidates: [candidateProblem], affectedProblemIds: ["PRB-CANDIDATE"], frozenAt: time, evaluatedAt: time, availabilityAdapter: { check: (id) => { checked.push(id); return { sourceId: id, status: "available", checkedAt: time }; } } });
  assert.equal(result.disposition, "ELIGIBLE");
  assert.deepEqual(checked, ["SRC-MATERIAL"]);
});

test("candidate EVD provenance resolves a candidate Source exactly once and excludes unrelated Sources", () => {
  const canonical = { source_id: "SRC-CANONICAL", access: { level: "public" } };
  const candidateSource = { recordFamily: "SRC-", fields: { source_id: "SRC-CANDIDATE", access: { level: "public" } } };
  const candidateEvidence = { recordFamily: "EVD-", fields: { evidence_id: "EVD-CANDIDATE", provenance: { sources: ["SRC-CANDIDATE", "SRC-CANDIDATE"] }, evidence_nature: "observation", inference_limits: [] } };
  const checked: string[] = [];
  const result = evaluateSafetyAdmission({ index: index(canonical), candidates: [candidateEvidence, candidateSource], affectedProblemIds: [], frozenAt: time, evaluatedAt: time, availabilityAdapter: { check: (id) => { checked.push(id); return { sourceId: id, status: "available", checkedAt: time }; } } });
  assert.equal(result.disposition, "ELIGIBLE");
  assert.deepEqual(checked, ["SRC-CANDIDATE"]);
});

test("candidate EVD provenance resolves a canonical Source and excludes unrelated candidate Sources", () => {
  const canonical = { source_id: "SRC-1", access: { level: "public" } };
  const unrelatedCandidateSource = { recordFamily: "SRC-", fields: { source_id: "SRC-UNRELATED-CANDIDATE", access: { level: "public" } } };
  const candidateEvidence = { recordFamily: "EVD-", fields: { evidence_id: "EVD-CANDIDATE", provenance: { sources: ["SRC-1"] }, evidence_nature: "observation", inference_limits: [] } };
  const checked: string[] = [];
  const result = evaluateSafetyAdmission({ index: index(canonical), candidates: [unrelatedCandidateSource, candidateEvidence], affectedProblemIds: [], frozenAt: time, evaluatedAt: time, availabilityAdapter: { check: (id) => { checked.push(id); return { sourceId: id, status: "available", checkedAt: time }; } } });
  assert.equal(result.disposition, "ELIGIBLE");
  assert.deepEqual(checked, ["SRC-1"]);
});

// --- CLAIM_INFERENCE_LIMITS_PRESENT pre-Gate human resolution -------------

const SHA = "0123456789abcdef0123456789abcdef01234567";
const alwaysResolved: InferenceLimitResolutionChecker = { isResolved: () => true };
const neverResolved: InferenceLimitResolutionChecker = { isResolved: () => false };

test("an unresolved CLAIM_INFERENCE_LIMITS_PRESENT still HOLDs (no checker supplied)", () => {
  const result = evaluate(claim({ inference_limits: ["a limit"] }));
  assert.deepEqual(result.findings.map((f) => f.code), ["CLAIM_INFERENCE_LIMITS_PRESENT"]);
  assert.equal(result.disposition, "HOLD");
});

test("an unresolved CLAIM_INFERENCE_LIMITS_PRESENT still HOLDs even with a checker that reports false", () => {
  const result = evaluateSafetyAdmission({ index: index(source), candidates: [claim({ inference_limits: ["a limit"] })], affectedProblemIds: [], frozenAt: time, evaluatedAt: time, baseGitSha: SHA, availabilityAdapter: { check: () => ({ sourceId: "SRC-1", status: "available", checkedAt: time }) }, inferenceLimitResolutionChecker: neverResolved });
  assert.equal(result.disposition, "HOLD");
  assert.deepEqual(result.findings.map((f) => f.code), ["CLAIM_INFERENCE_LIMITS_PRESENT"]);
});

test("a matching resolution clears CLAIM_INFERENCE_LIMITS_PRESENT and admission becomes eligible when no other blocker remains", () => {
  const result = evaluateSafetyAdmission({ index: index(source), candidates: [claim({ inference_limits: ["a limit"] })], affectedProblemIds: [], frozenAt: time, evaluatedAt: time, baseGitSha: SHA, availabilityAdapter: { check: () => ({ sourceId: "SRC-1", status: "available", checkedAt: time }) }, inferenceLimitResolutionChecker: alwaysResolved });
  assert.equal(result.disposition, "ELIGIBLE");
  assert.deepEqual(result.findings, []);
});

test("a resolution never suppresses any other blocking finding (only CLAIM_INFERENCE_LIMITS_PRESENT is overridable)", () => {
  const result = evaluateSafetyAdmission({ index: index(source), candidates: [claim({ claim_authority: "unknown", inference_limits: ["a limit"] })], affectedProblemIds: [], frozenAt: time, evaluatedAt: time, baseGitSha: SHA, availabilityAdapter: { check: () => ({ sourceId: "SRC-1", status: "available", checkedAt: time }) }, inferenceLimitResolutionChecker: alwaysResolved });
  assert.equal(result.disposition, "HOLD");
  assert.deepEqual(result.findings.map((f) => f.code), ["CLAIM_AUTHORITY_UNKNOWN"]);
});

test("a resolution never suppresses SOURCE_UNAVAILABLE or any Source finding", () => {
  const result = evaluateSafetyAdmission({ index: index(source), candidates: [claim({ inference_limits: ["a limit"] })], affectedProblemIds: [], frozenAt: time, evaluatedAt: time, baseGitSha: SHA, availabilityAdapter: { check: () => ({ sourceId: "SRC-1", status: "unavailable", checkedAt: time }) }, inferenceLimitResolutionChecker: alwaysResolved });
  assert.equal(result.disposition, "HOLD");
  assert.deepEqual(result.findings.map((f) => f.code), ["SOURCE_UNAVAILABLE"]);
});

test("no baseGitSha means the resolution checker is never consulted (fails closed)", () => {
  const result = evaluateSafetyAdmission({ index: index(source), candidates: [claim({ inference_limits: ["a limit"] })], affectedProblemIds: [], frozenAt: time, evaluatedAt: time, availabilityAdapter: { check: () => ({ sourceId: "SRC-1", status: "available", checkedAt: time }) }, inferenceLimitResolutionChecker: alwaysResolved });
  assert.equal(result.disposition, "HOLD");
  assert.deepEqual(result.findings.map((f) => f.code), ["CLAIM_INFERENCE_LIMITS_PRESENT"]);
});

test("deriveMaterialNonPrivateSources excludes private Sources and matches the evaluator's own material-Source set", () => {
  const privateSource = { source_id: "SRC-PRIVATE", access: { level: "private" } };
  const evidence = { evidence_id: "EVD-BASIS", provenance: { sources: ["SRC-1", "SRC-PRIVATE"] }, evidence_nature: "observation", inference_limits: [] };
  const corpus: CorpusIndex = { researchRoot: "/synthetic", totalRecords: 3, byPrefix: new Map([
    ["SRC-", { schema, records: [{ file: "sources/SRC-1.yaml", fields: source }, { file: "sources/SRC-PRIVATE.yaml", fields: privateSource }], byId: new Map([["SRC-1", { file: "sources/SRC-1.yaml", fields: source }], ["SRC-PRIVATE", { file: "sources/SRC-PRIVATE.yaml", fields: privateSource }]]) }],
    ["EVD-", { schema: evidenceSchema, records: [{ file: "evidence/EVD-BASIS.yaml", fields: evidence }], byId: new Map([["EVD-BASIS", { file: "evidence/EVD-BASIS.yaml", fields: evidence }]]) }],
  ]) };
  const materialSources = deriveMaterialNonPrivateSources({ index: corpus, candidates: [{ recordFamily: "EVD-", fields: evidence }], affectedProblemIds: [], frozenAt: time, evaluatedAt: time });
  assert.deepEqual([...materialSources.keys()], ["SRC-1"]);
});
