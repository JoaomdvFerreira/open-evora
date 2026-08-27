import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareCanonicalIntegrationReview,
  type CandidateRecord,
  type CorpusIndex,
  type ParsedRecord,
  type RecordFields,
  type RecordIndex,
  type RecordSchema,
} from "./index.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

const SOURCE_SCHEMA: RecordSchema = {
  prefix: "SRC-",
  directory: "sources",
  idField: "source_id",
  requiredFields: ["source_id", "name"],
  allowedFields: ["source_id", "name"],
  fieldTypes: { source_id: ["string"], name: ["string"] },
};

function source(id: string, name = "Synthetic source"): RecordFields {
  return { source_id: id, name };
}

function record(schema: RecordSchema, fields: RecordFields): ParsedRecord {
  return { file: `${schema.directory}/${fields.source_id}.yaml`, fields };
}

function index(records: RecordFields[] = []): CorpusIndex {
  const parsed = records.map((fields) => record(SOURCE_SCHEMA, fields));
  const sourceIndex: RecordIndex = {
    schema: SOURCE_SCHEMA,
    records: parsed,
    byId: new Map(parsed.map((item) => [item.fields.source_id as string, item])),
  };
  return { researchRoot: "/synthetic", byPrefix: new Map([["SRC-", sourceIndex]]), totalRecords: parsed.length };
}

function candidate(id: string, name?: string): CandidateRecord {
  return { recordFamily: "SRC-", fields: source(id, name) };
}

test("a clean candidate set is structurally ready and preserves its supplied base SHA", () => {
  const review = prepareCanonicalIntegrationReview(SHA, index(), [candidate("SRC-NEW")]);

  assert.equal(review.baseGitSha, SHA);
  assert.equal(review.readiness, "READY_FOR_INTEGRATION_GATE");
  assert.deepEqual(review.validation.errors, []);
});

test("validation errors require review without asserting a human decision", () => {
  const review = prepareCanonicalIntegrationReview(SHA, index(), [{ recordFamily: "SRC-", fields: { source_id: "SRC-INVALID" } }]);

  assert.equal(review.readiness, "REVIEW_REQUIRED");
  assert.match(review.validation.errors.join("\n"), /missing required field: name/);
});

test("only a full hexadecimal base Git SHA is accepted", () => {
  for (const malformed of ["0123456789abcdef", "g123456789abcdef0123456789abcdef01234567", `${SHA}0`]) {
    assert.throws(() => prepareCanonicalIntegrationReview(malformed, index(), []), /40-character hexadecimal SHA/);
  }
});

test("candidate records and deltas share deterministic target order", () => {
  const review = prepareCanonicalIntegrationReview(SHA, index(), [candidate("SRC-Z"), candidate("SRC-A"), candidate("SRC-M")]);

  assert.deepEqual(review.candidates.map((item) => item.fields.source_id), ["SRC-A", "SRC-M", "SRC-Z"]);
  assert.deepEqual(review.deltas.map((item) => item.id), ["SRC-A", "SRC-M", "SRC-Z"]);
});

test("review candidate fields are detached and inputs remain unchanged", () => {
  const canonical = index([source("SRC-ONE", "Canonical")]);
  const candidates = [candidate("SRC-ONE", "Candidate")];
  const canonicalBefore = structuredClone(canonical);
  const candidatesBefore = structuredClone(candidates);

  const review = prepareCanonicalIntegrationReview(SHA, canonical, candidates);
  (review.candidates[0].fields as Record<string, unknown>).name = "Changed review copy";

  assert.equal(candidates[0].fields.name, "Candidate");
  assert.equal(canonical.byPrefix.get("SRC-")!.records[0].fields.name, "Canonical");
  assert.deepEqual(canonical, canonicalBefore);
  assert.deepEqual(candidates, candidatesBefore);
});

test("duplicate candidate targets retain existing candidate-set failure behavior", () => {
  assert.throws(
    () => prepareCanonicalIntegrationReview(SHA, index(), [candidate("SRC-ONE", "First"), candidate("SRC-ONE", "Second")]),
    /more than one candidate targeting/i
  );
});

test("clean CREATE, UPDATE, and NO_CHANGE candidates are equally ready", () => {
  const canonical = index([source("SRC-UPDATE", "Canonical"), source("SRC-NO-CHANGE")]);
  const review = prepareCanonicalIntegrationReview(SHA, canonical, [
    candidate("SRC-CREATE"),
    candidate("SRC-UPDATE", "Changed"),
    candidate("SRC-NO-CHANGE"),
  ]);

  assert.equal(review.readiness, "READY_FOR_INTEGRATION_GATE");
  assert.deepEqual(review.deltas.map((item) => item.action), ["CREATE", "NO_CHANGE", "UPDATE"]);
});
