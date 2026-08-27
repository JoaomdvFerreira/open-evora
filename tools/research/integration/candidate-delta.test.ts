import assert from "node:assert/strict";
import test from "node:test";

import { classifyCandidateDelta, type CandidateRecord, type CorpusIndex, type RecordFields, type RecordSchema } from "../index.ts";

const SCHEMA: RecordSchema = {
  prefix: "TST-",
  directory: "things",
  idField: "identity.canonical_id",
};

function fields(id: string, summary = "unchanged"): RecordFields {
  return {
    content: { summary, details: { first: "one", second: "two" } },
    identity: { canonical_id: id },
    labels: ["one", "two"],
  };
}

function candidate(id: string, summary?: string): CandidateRecord {
  return { recordFamily: SCHEMA.prefix, fields: fields(id, summary) };
}

function indexWithCanonical(canonicalFields = fields("TST-0001")): CorpusIndex {
  const canonical = { file: "things/TST-0001.yaml", fields: canonicalFields };
  const recordIndex = {
    schema: SCHEMA,
    records: [canonical],
    byId: new Map([["TST-0001", canonical]]),
  };
  return { researchRoot: "/synthetic", byPrefix: new Map([[SCHEMA.prefix, recordIndex]]), totalRecords: 1 };
}

test("an absent schema-declared ID is classified as CREATE", () => {
  const result = classifyCandidateDelta(indexWithCanonical(), candidate("TST-0002"));
  assert.deepEqual(result, { recordFamily: "TST-", id: "TST-0002", action: "CREATE" });
});

test("the same ID and structurally identical parsed fields are classified as NO_CHANGE", () => {
  const result = classifyCandidateDelta(indexWithCanonical(), candidate("TST-0001"));
  assert.equal(result.action, "NO_CHANGE");
});

test("the same ID with a changed field is classified as UPDATE", () => {
  const result = classifyCandidateDelta(indexWithCanonical(), candidate("TST-0001", "changed"));
  assert.equal(result.action, "UPDATE");
});

test("object key ordering alone is classified as NO_CHANGE", () => {
  const reordered: RecordFields = {
    labels: ["one", "two"],
    identity: { canonical_id: "TST-0001" },
    content: { details: { second: "two", first: "one" }, summary: "unchanged" },
  };
  const result = classifyCandidateDelta(indexWithCanonical(), { recordFamily: "TST-", fields: reordered });
  assert.equal(result.action, "NO_CHANGE");
});

test("classification uses the schema-declared idField, including a nested custom field", () => {
  const customSchema: RecordSchema = { prefix: "ALT-", directory: "alternatives", idField: "key.value" };
  const canonical = { file: "alternatives/ALT-1.yaml", fields: { key: { value: "ALT-1" }, source_id: "not-the-id" } };
  const index: CorpusIndex = {
    researchRoot: "/synthetic",
    byPrefix: new Map([[customSchema.prefix, { schema: customSchema, records: [canonical], byId: new Map([["ALT-1", canonical]]) }]]),
    totalRecords: 1,
  };

  const result = classifyCandidateDelta(index, {
    recordFamily: "ALT-",
    fields: { key: { value: "ALT-1" }, source_id: "different-but-not-the-id" },
  });
  assert.equal(result.action, "UPDATE");
  assert.equal(result.id, "ALT-1");
});

test("invalid or unknown record-family input fails explicitly", () => {
  const index = indexWithCanonical();
  assert.throws(() => classifyCandidateDelta(index, { recordFamily: "", fields: fields("TST-0001") }), /record family/i);
  assert.throws(() => classifyCandidateDelta(index, { recordFamily: "UNKNOWN-", fields: fields("TST-0001") }), /unknown candidate record family/i);
  assert.throws(() => classifyCandidateDelta(index, { recordFamily: "TST-", fields: {} }), /canonical ID/i);
});

test("classification does not mutate canonical or candidate inputs", () => {
  const index = indexWithCanonical();
  const input = candidate("TST-0001");
  const canonicalBefore = structuredClone(index.byPrefix.get("TST-")!.records[0].fields);
  const candidateBefore = structuredClone(input.fields);

  classifyCandidateDelta(index, input);

  assert.deepEqual(index.byPrefix.get("TST-")!.records[0].fields, canonicalBefore);
  assert.deepEqual(input.fields, candidateBefore);
});
