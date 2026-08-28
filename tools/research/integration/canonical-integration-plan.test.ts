import assert from "node:assert/strict";
import test from "node:test";

import {
  parseRecordYaml,
  prepareCanonicalIntegrationPlan,
  prepareCanonicalIntegrationReview,
  stringifyRecordYaml,
  type CandidateRecord,
  type CorpusIndex,
  type ParsedRecord,
  type RecordFields,
  type RecordIndex,
  type RecordSchema,
} from "../index.ts";
import { loadCorpusIndex } from "../core/corpus.ts";

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

function record(schema: RecordSchema, fields: RecordFields, file?: string): ParsedRecord {
  const id = valueAt(fields, schema.idField);
  return { file: file ?? `${schema.directory}/${id}.yaml`, fields };
}

function valueAt(fields: RecordFields, idField: string): unknown {
  return idField.split(".").reduce<unknown>((current, part) => (
    current !== null && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)[part]
      : undefined
  ), fields);
}

function recordIndex(schema: RecordSchema, fieldsList: RecordFields[], files: string[] = []): RecordIndex {
  const records = fieldsList.map((fields, index) => record(schema, fields, files[index]));
  return {
    schema,
    records,
    byId: new Map(records.map((parsed) => [valueAt(parsed.fields, schema.idField) as string, parsed])),
  };
}

function index(records: RecordFields[] = [], files: string[] = [], schema = SOURCE_SCHEMA): CorpusIndex {
  const sources = recordIndex(schema, records, files);
  return { researchRoot: "/synthetic", byPrefix: new Map([[schema.prefix, sources]]), totalRecords: records.length };
}

function candidate(id: string, name?: string): CandidateRecord {
  return { recordFamily: "SRC-", fields: source(id, name) };
}

function review(canonical: CorpusIndex, candidates: CandidateRecord[]) {
  return prepareCanonicalIntegrationReview(SHA, canonical, candidates);
}

test("CREATE writes deterministic YAML to the schema-declared target", () => {
  const canonical = index();
  const plan = prepareCanonicalIntegrationPlan(canonical, review(canonical, [candidate("SRC-CREATE", "Created")]));

  assert.deepEqual(plan.operations, [{
    recordFamily: "SRC-",
    id: "SRC-CREATE",
    action: "CREATE",
    targetFile: "sources/SRC-CREATE.yaml",
    yaml: "source_id: SRC-CREATE\nname: Created\n",
  }]);
});

test("UPDATE preserves the actual existing canonical file path", () => {
  const canonical = index([source("SRC-UPDATE", "Canonical")], ["sources/imported/legacy-source.yaml"]);
  const plan = prepareCanonicalIntegrationPlan(canonical, review(canonical, [candidate("SRC-UPDATE", "Updated")]));

  assert.equal(plan.operations[0]?.action, "UPDATE");
  assert.equal("targetFile" in plan.operations[0]! && plan.operations[0].targetFile, "sources/imported/legacy-source.yaml");
  assert.equal("yaml" in plan.operations[0]! && plan.operations[0].yaml, "source_id: SRC-UPDATE\nname: Updated\n");
});

test("NO_CHANGE has no prospective write content", () => {
  const canonical = index([source("SRC-SAME")]);
  const plan = prepareCanonicalIntegrationPlan(canonical, review(canonical, [candidate("SRC-SAME")]));

  assert.deepEqual(plan.operations, [{ recordFamily: "SRC-", id: "SRC-SAME", action: "NO_CHANGE" }]);
  assert.equal("targetFile" in plan.operations[0]!, false);
  assert.equal("yaml" in plan.operations[0]!, false);
});

test("mixed operations are deterministic regardless of candidate input order", () => {
  const canonical = index([source("SRC-UPDATE", "Canonical"), source("SRC-SAME")]);
  const candidates = [candidate("SRC-CREATE"), candidate("SRC-UPDATE", "Updated"), candidate("SRC-SAME")];

  const forward = prepareCanonicalIntegrationPlan(canonical, review(canonical, candidates));
  const reverse = prepareCanonicalIntegrationPlan(canonical, review(canonical, [...candidates].reverse()));

  assert.deepEqual(forward, reverse);
  assert.deepEqual(forward.operations.map((operation) => operation.action), ["CREATE", "NO_CHANGE", "UPDATE"]);
});

test("YAML serialization is deterministic, ends in one newline, and round-trips", () => {
  const fields = { source_id: "SRC-YAML", name: "Line one: value", nested: { list: ["one", true, null] } };
  const first = stringifyRecordYaml(fields);
  const second = stringifyRecordYaml(fields);

  assert.equal(first, second);
  assert.match(first, /[^\n]\n$/);
  assert.equal(first.endsWith("\n\n"), false);
  assert.deepEqual(parseRecordYaml(first), fields);
});

test("REVIEW_REQUIRED cannot produce a plan", () => {
  const canonical = index();
  const notReady = review(canonical, [{ recordFamily: "SRC-", fields: { source_id: "SRC-INVALID" } }]);

  assert.equal(notReady.readiness, "REVIEW_REQUIRED");
  assert.throws(() => prepareCanonicalIntegrationPlan(canonical, notReady), /READY_FOR_INTEGRATION_GATE/);
});

test("a review whose mutated candidates change its delta fails explicitly", () => {
  const canonical = index([source("SRC-EXISTING")]);
  const prepared = review(canonical, [candidate("SRC-NEW")]);
  (prepared.candidates[0].fields as Record<string, unknown>).source_id = "SRC-EXISTING";

  assert.throws(() => prepareCanonicalIntegrationPlan(canonical, prepared), /deltas no longer match/i);
});

test("a nested schema idField determines the CREATE target", () => {
  const schema: RecordSchema = {
    prefix: "ALT-",
    directory: "alternatives",
    idField: "identity.canonical_id",
    requiredFields: ["identity", "identity.canonical_id", "name"],
    allowedFields: ["identity", "identity.canonical_id", "name"],
    fieldTypes: { identity: ["object"], "identity.canonical_id": ["string"], name: ["string"] },
  };
  const canonical = index([], [], schema);
  const candidates: CandidateRecord[] = [{
    recordFamily: "ALT-",
    fields: { identity: { canonical_id: "ALT-NEW" }, name: "Alternative" },
  }];

  const plan = prepareCanonicalIntegrationPlan(canonical, review(canonical, candidates));
  assert.deepEqual(plan.operations.map((operation) => (
    "targetFile" in operation ? operation.targetFile : undefined
  )), ["alternatives/ALT-NEW.yaml"]);
});

test("the plan is detached and leaves review, canonical, and candidate inputs unchanged", () => {
  const canonical = index([source("SRC-UPDATE", "Canonical")]);
  const candidates = [candidate("SRC-UPDATE", "Updated")];
  const prepared = review(canonical, candidates);
  const canonicalBefore = structuredClone(canonical);
  const candidatesBefore = structuredClone(candidates);
  const reviewBefore = structuredClone(prepared);

  const plan = prepareCanonicalIntegrationPlan(canonical, prepared);
  (plan.operations[0] as { yaml?: string }).yaml = "changed";
  plan.deltas[0].id = "changed";

  assert.deepEqual(canonical, canonicalBefore);
  assert.deepEqual(candidates, candidatesBefore);
  assert.deepEqual(prepared, reviewBefore);
});

test("an UPDATE target that escapes its schema directory is rejected", () => {
  const updateIndex = index([source("SRC-UPDATE", "Canonical")], ["../outside.yaml"]);
  const updateReview = review(updateIndex, [candidate("SRC-UPDATE", "Updated")]);
  assert.throws(() => prepareCanonicalIntegrationPlan(updateIndex, updateReview), /escapes schema directory/);
});

test("a reviewed PRB history UPDATE is serialized unchanged into its existing canonical target", () => {
  const canonical = loadCorpusIndex(`${process.cwd()}/research`);
  const fields = structuredClone(canonical.byPrefix.get("PRB-")!.byId.get("PRB-0001")!.fields) as RecordFields;
  fields.history = [{
    date: "2026-08-28",
    summary: "Entrada de histórico para o plano de integração.",
    evidence: ["EVD-000001"],
  }];
  const candidate: CandidateRecord = { recordFamily: "PRB-", fields };
  const prepared = prepareCanonicalIntegrationReview(SHA, canonical, [candidate]);
  const plan = prepareCanonicalIntegrationPlan(canonical, prepared);
  const operation = plan.operations[0]!;

  assert.equal(prepared.readiness, "READY_FOR_INTEGRATION_GATE");
  assert.deepEqual(plan.deltas, [{ recordFamily: "PRB-", id: "PRB-0001", action: "UPDATE" }]);
  assert.equal(operation.action, "UPDATE");
  assert.equal("targetFile" in operation && operation.targetFile, "problems/PRB-0001.yaml");
  assert.deepEqual("yaml" in operation && parseRecordYaml(operation.yaml), fields);
  assert.deepEqual("yaml" in operation && (parseRecordYaml(operation.yaml).history), fields.history);
});
