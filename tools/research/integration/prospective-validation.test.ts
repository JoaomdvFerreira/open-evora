import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProspectiveCorpusIndex,
  type CandidateRecord,
  type CorpusIndex,
  type ParsedRecord,
  type RecordFields,
  type RecordIndex,
  type RecordSchema,
  validateCandidateSet,
} from "../index.ts";
import { loadCorpusIndex } from "../core/corpus.ts";

const SOURCE_SCHEMA: RecordSchema = {
  prefix: "SRC-",
  directory: "sources",
  idField: "source_id",
  requiredFields: ["source_id", "name"],
  allowedFields: ["source_id", "name"],
  fieldTypes: { source_id: ["string"], name: ["string"] },
};

const EVIDENCE_SCHEMA: RecordSchema = {
  prefix: "EVD-",
  directory: "evidence",
  idField: "evidence_id",
  requiredFields: ["evidence_id", "provenance", "provenance.sources", "observation", "observation.summary"],
  allowedFields: ["evidence_id", "provenance", "provenance.sources", "observation", "observation.summary"],
  fieldTypes: {
    evidence_id: ["string"],
    provenance: ["object"],
    "provenance.sources": ["array"],
    observation: ["object"],
    "observation.summary": ["string"],
  },
  references: [{ field: "provenance.sources", isList: true, targetPrefix: "SRC-", targetDirectory: "sources", required: true }],
};

const PROBLEM_SCHEMA: RecordSchema = {
  prefix: "PRB-",
  directory: "problems",
  idField: "problem_id",
  requiredFields: ["problem_id", "title", "evidence"],
  allowedFields: ["problem_id", "title", "evidence"],
  fieldTypes: { problem_id: ["string"], title: ["string"], evidence: ["array"] },
  references: [{ field: "evidence", isList: true, itemField: "evidence_id", targetPrefix: "EVD-", targetDirectory: "evidence", required: true }],
};

function source(id: string, name = "Synthetic source"): RecordFields {
  return { source_id: id, name };
}

function evidence(id: string, sourceId: string): RecordFields {
  return {
    evidence_id: id,
    provenance: { sources: [sourceId] },
    observation: { summary: "Synthetic observation." },
  };
}

function problem(id: string, evidenceId: string): RecordFields {
  return {
    problem_id: id,
    title: "Synthetic problem",
    evidence: [{ evidence_id: evidenceId, effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] }],
  };
}

function record(schema: RecordSchema, fields: RecordFields): ParsedRecord {
  const id = schema.idField.split(".").reduce<unknown>((value, part) => (
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[part] : undefined
  ), fields);
  return { file: `${schema.directory}/${id}.yaml`, fields };
}

function recordIndex(schema: RecordSchema, fieldsList: RecordFields[]): RecordIndex {
  const records = fieldsList.map((fields) => record(schema, fields));
  const byId = new Map<string, ParsedRecord>();
  for (const parsed of records) {
    const id = schema.idField.split(".").reduce<unknown>((value, part) => (
      value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[part] : undefined
    ), parsed.fields);
    if (typeof id === "string" && !byId.has(id)) byId.set(id, parsed);
  }
  return { schema, records, byId };
}

function fixtureIndex(records: { sources?: RecordFields[]; evidence?: RecordFields[]; problems?: RecordFields[] } = {}): CorpusIndex {
  const byPrefix = new Map<string, RecordIndex>([
    ["SRC-", recordIndex(SOURCE_SCHEMA, records.sources ?? [])],
    ["EVD-", recordIndex(EVIDENCE_SCHEMA, records.evidence ?? [])],
    ["PRB-", recordIndex(PROBLEM_SCHEMA, records.problems ?? [])],
  ]);
  return {
    researchRoot: "/synthetic",
    byPrefix,
    totalRecords: [...byPrefix.values()].reduce((total, item) => total + item.records.length, 0),
  };
}

function candidate(recordFamily: string, fields: RecordFields): CandidateRecord {
  return { recordFamily, fields };
}

test("CREATE candidate validates in the prospective corpus", () => {
  const result = validateCandidateSet(fixtureIndex(), [candidate("SRC-", source("SRC-NEW"))]);
  assert.deepEqual(result.deltas, [{ recordFamily: "SRC-", id: "SRC-NEW", action: "CREATE" }]);
  assert.deepEqual(result.validation.errors, []);
  assert.equal(result.validation.totalRecords, 1);
});

test("UPDATE replaces canonical state only in the prospective view", () => {
  const canonical = fixtureIndex({ sources: [source("SRC-ONE", "Canonical source")] });
  const prospective = buildProspectiveCorpusIndex(canonical, [candidate("SRC-", source("SRC-ONE", "Updated source"))]);
  assert.equal(canonical.byPrefix.get("SRC-")!.records[0].fields.name, "Canonical source");
  assert.equal(prospective.byPrefix.get("SRC-")!.records[0].fields.name, "Updated source");
});

test("NO_CHANGE leaves a structurally equivalent prospective state", () => {
  const canonical = fixtureIndex({ sources: [source("SRC-ONE")] });
  const prospective = buildProspectiveCorpusIndex(canonical, [candidate("SRC-", source("SRC-ONE"))]);
  assert.deepEqual(prospective, canonical);
  assert.deepEqual(validateCandidateSet(canonical, [candidate("SRC-", source("SRC-ONE"))]).deltas, [
    { recordFamily: "SRC-", id: "SRC-ONE", action: "NO_CHANGE" },
  ]);
});

test("a new EVD may reference a new SRC from the same candidate set", () => {
  const result = validateCandidateSet(fixtureIndex(), [
    candidate("EVD-", evidence("EVD-NEW", "SRC-NEW")),
    candidate("SRC-", source("SRC-NEW")),
  ]);
  assert.deepEqual(result.validation.errors, []);
});

test("a new PRB may reference a new EVD from the same candidate set", () => {
  const result = validateCandidateSet(fixtureIndex(), [
    candidate("PRB-", problem("PRB-NEW", "EVD-NEW")),
    candidate("EVD-", evidence("EVD-NEW", "SRC-NEW")),
    candidate("SRC-", source("SRC-NEW")),
  ]);
  assert.deepEqual(result.validation.errors, []);
});

test("unresolved candidate references are rejected by the canonical validator", () => {
  const result = validateCandidateSet(fixtureIndex(), [candidate("EVD-", evidence("EVD-NEW", "SRC-MISSING"))]);
  assert.match(result.validation.errors.join("\n"), /references non-existent SRC-\* record "SRC-MISSING"/);
});

test("invalid candidate fields are rejected by the canonical validator", () => {
  const result = validateCandidateSet(fixtureIndex(), [candidate("EVD-", { evidence_id: "EVD-INVALID", provenance: { sources: [] } })]);
  assert.match(result.validation.errors.join("\n"), /missing required field: observation/);
});

test("ambiguous or unusable candidate targets fail explicitly", () => {
  const canonical = fixtureIndex({ sources: [source("SRC-ONE")] });
  assert.throws(
    () => validateCandidateSet(canonical, [candidate("SRC-", source("SRC-ONE", "One")), candidate("SRC-", source("SRC-ONE", "Two"))]),
    /more than one candidate targeting/i
  );
  assert.throws(() => validateCandidateSet(canonical, [candidate("UNKNOWN-", { unknown_id: "UNKNOWN-1" })]), /unknown candidate record family/i);
  assert.throws(() => validateCandidateSet(canonical, [candidate("SRC-", { name: "No ID" })]), /canonical ID/i);

  const noIdSchema: RecordSchema = { prefix: "BAD-", directory: "bad", idField: "" };
  const badIndex: CorpusIndex = {
    researchRoot: "/synthetic",
    byPrefix: new Map([["BAD-", recordIndex(noIdSchema, [])]]),
    totalRecords: 0,
  };
  assert.throws(() => validateCandidateSet(badIndex, [candidate("BAD-", { id: "BAD-1" })]), /usable idField/i);
});

test("candidate order does not change prospective validation or deltas", () => {
  const canonical = fixtureIndex();
  const candidates = [
    candidate("SRC-", source("SRC-NEW")),
    candidate("EVD-", evidence("EVD-NEW", "SRC-NEW")),
    candidate("PRB-", problem("PRB-NEW", "EVD-NEW")),
  ];
  const forward = validateCandidateSet(canonical, candidates);
  const reversed = validateCandidateSet(canonical, [...candidates].reverse());
  assert.deepEqual(reversed, forward);
});

test("prospective records and byId retain filename order independently of candidate order", () => {
  const canonical = fixtureIndex({ sources: [source("SRC-Z")] });
  const candidates = [
    candidate("SRC-", source("SRC-A")),
    candidate("SRC-", source("SRC-M")),
  ];
  const forward = buildProspectiveCorpusIndex(canonical, candidates).byPrefix.get("SRC-")!;
  const reversed = buildProspectiveCorpusIndex(canonical, [...candidates].reverse()).byPrefix.get("SRC-")!;
  const expectedFiles = ["sources/SRC-A.yaml", "sources/SRC-M.yaml", "sources/SRC-Z.yaml"];
  const expectedIds = ["SRC-A", "SRC-M", "SRC-Z"];

  assert.deepEqual(forward.records.map(({ file }) => file), expectedFiles);
  assert.deepEqual([...forward.byId.keys()], expectedIds);
  assert.deepEqual(reversed.records.map(({ file }) => file), expectedFiles);
  assert.deepEqual([...reversed.byId.keys()], expectedIds);
});

test("canonical and candidate inputs remain unchanged", () => {
  const canonical = fixtureIndex({ sources: [source("SRC-ONE")] });
  const candidates = [candidate("SRC-", source("SRC-ONE", "Updated source"))];
  const canonicalBefore = structuredClone(canonical);
  const candidatesBefore = structuredClone(candidates);

  validateCandidateSet(canonical, candidates);

  assert.deepEqual(canonical, canonicalBefore);
  assert.deepEqual(candidates, candidatesBefore);
});

test("schema-declared nested custom idField works in the prospective overlay", () => {
  const schema: RecordSchema = {
    prefix: "ALT-",
    directory: "alternatives",
    idField: "identity.canonical_id",
    requiredFields: ["identity.canonical_id", "value"],
    allowedFields: ["identity", "identity.canonical_id", "value"],
    fieldTypes: { identity: ["object"], "identity.canonical_id": ["string"], value: ["string"] },
  };
  const canonical: CorpusIndex = {
    researchRoot: "/synthetic",
    byPrefix: new Map([["ALT-", recordIndex(schema, [{ identity: { canonical_id: "ALT-ONE" }, value: "Canonical" }])]]),
    totalRecords: 1,
  };
  const result = validateCandidateSet(canonical, [candidate("ALT-", { identity: { canonical_id: "ALT-TWO" }, value: "Candidate" })]);
  assert.deepEqual(result.validation.errors, []);
  assert.deepEqual(result.deltas, [{ recordFamily: "ALT-", id: "ALT-TWO", action: "CREATE" }]);
});

test("history-bearing PRB UPDATEs use the canonical validator prospectively", () => {
  const canonical = loadCorpusIndex(`${process.cwd()}/research`);
  const original = canonical.byPrefix.get("PRB-")!.byId.get("PRB-0001")!.fields;
  const validFields = structuredClone(original) as RecordFields;
  validFields.history = [{
    date: "2026-08-28",
    summary: "Entrada de histórico para a validação prospetiva.",
    evidence: ["EVD-000001"],
  }];

  const valid = validateCandidateSet(canonical, [{ recordFamily: "PRB-", fields: validFields }]);
  assert.deepEqual(valid.validation.errors, []);
  assert.deepEqual(valid.deltas, [{ recordFamily: "PRB-", id: "PRB-0001", action: "UPDATE" }]);

  const invalidFields = structuredClone(validFields);
  (invalidFields.history as Array<Record<string, unknown>>)[0]!.date = "2026-02-30";
  const invalid = validateCandidateSet(canonical, [{ recordFamily: "PRB-", fields: invalidFields }]);
  assert.match(invalid.validation.errors.join("\n"), /history\[0\]\.date.*valid full YYYY-MM-DD date/);
});
