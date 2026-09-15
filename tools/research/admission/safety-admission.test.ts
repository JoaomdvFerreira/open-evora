import assert from "node:assert/strict";
import test from "node:test";
import type { CorpusIndex, RecordSchema } from "../core/types.ts";
import { evaluateSafetyAdmission, type SourceAvailabilityAdapter } from "./safety-admission.ts";

const schema: RecordSchema = { prefix: "SRC-", directory: "sources", idField: "source_id" };
const evidenceSchema: RecordSchema = { prefix: "EVD-", directory: "evidence", idField: "evidence_id" };
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
