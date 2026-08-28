import assert from "node:assert/strict";
import test from "node:test";
import { loadCorpusIndex } from "../core/corpus.ts";
import { validateCorpusIndex } from "./validate.ts";

const root = `${process.cwd()}/research`;

function errorsAfter(mutate: (index: ReturnType<typeof loadCorpusIndex>) => void): string {
  const index = loadCorpusIndex(root);
  mutate(index);
  return validateCorpusIndex(index).errors.join("\n");
}

function evd(index: ReturnType<typeof loadCorpusIndex>, id = "EVD-000001"): Record<string, any> {
  return index.byPrefix.get("EVD-")!.byId.get(id)!.fields as Record<string, any>;
}

function prb(index: ReturnType<typeof loadCorpusIndex>, id = "PRB-0001"): Record<string, any> {
  return index.byPrefix.get("PRB-")!.byId.get(id)!.fields as Record<string, any>;
}

test("PRB evidence relationships reject duplicate IDs, duplicate effects and unlinked nested evidence", () => {
  const index = loadCorpusIndex(root);
  const prb = index.byPrefix.get("PRB-")!.byId.get("PRB-0001")!.fields;
  const relationships = prb.evidence as Array<Record<string, unknown>>;
  relationships.push({ ...relationships[0] });
  relationships[0].effects = ["SUPPORTS", "SUPPORTS"];
  const decisionBasis = prb.decision_basis as Record<string, unknown>;
  decisionBasis.currentness = { ...(decisionBasis.currentness as Record<string, unknown>), evidence: ["EVD-000148"] };
  const errors = validateCorpusIndex(index).errors.join("\n");
  assert.match(errors, /duplicate PRB evidence relationship/);
  assert.match(errors, /contains duplicate value "SUPPORTS"/);
  assert.match(errors, /not linked in PRB\.evidence/);
});

test("EVD vNext required fields, enums, types, patterns, conditionals and temporal exclusivity are enforced", () => {
  const required = errorsAfter((index) => delete evd(index).provenance);
  assert.match(required, /missing required field: provenance\.sources/);

  const enumError = errorsAfter((index) => { evd(index).evidence_nature = "verdict"; });
  assert.match(enumError, /evidence_nature.*invalid value/);

  const typeError = errorsAfter((index) => { evd(index).claim_authority = true; });
  assert.match(typeError, /claim_authority.*type "boolean"/);

  const patternError = errorsAfter((index) => { evd(index).provenance.extracted_at = "2026"; });
  assert.match(patternError, /provenance\.extracted_at.*does not match required pattern/);

  const conditional = errorsAfter((index) => { delete evd(index).scope.geography.area; });
  assert.match(conditional, /scope\.geography\.area.*is required when/);

  const exclusive = errorsAfter((index) => { evd(index).scope.temporal = { as_of: "2026", status: "unknown" }; });
  assert.match(exclusive, /scope\.temporal.*must author exactly one/);

  const legacy = errorsAfter((index) => { evd(index).analysis = { contribution: "SUPPORTS" }; });
  assert.match(legacy, /field "analysis" is not an allowed field/);
});

test("EVD provenance accepts multiple valid sources and rejects empty, dangling and wrong-type references", () => {
  const valid = loadCorpusIndex(root);
  evd(valid).provenance.sources = ["SRC-0002", "SRC-0003"];
  assert.deepEqual(validateCorpusIndex(valid).errors, []);

  assert.match(errorsAfter((index) => { evd(index).provenance.sources = [""]; }), /provenance\.sources.*empty reference entry/);
  assert.match(errorsAfter((index) => { evd(index).provenance.sources = ["SRC-999999"]; }), /non-existent SRC-\* record "SRC-999999"/);
  assert.match(errorsAfter((index) => { evd(index).provenance.sources = ["EVD-000001"]; }), /non-existent SRC-\* record "EVD-000001"/);
});

test("IDs, filenames, duplicate IDs and PRB relationship shape failures are rejected", () => {
  assert.match(errorsAfter((index) => { evd(index).evidence_id = "BAD-000001"; }), /does not start with expected prefix/);
  assert.match(errorsAfter((index) => { evd(index).evidence_id = "EVD-000002"; }), /filename.*does not match record ID/);

  const duplicate = errorsAfter((index) => {
    evd(index, "EVD-000002").evidence_id = "EVD-000001";
  });
  assert.match(duplicate, /duplicate ID "EVD-000001"/);

  const relationships = errorsAfter((index) => {
    const relation = prb(index).evidence[0];
    relation.effects = [];
    relation.research_roles = ["bad-role", "bad-role"];
  });
  assert.match(relationships, /missing required non-empty field: evidence\[0\]\.effects/);
  assert.match(relationships, /research_roles.*invalid value/);
});

test("nested PRB references must resolve and belong to the PRB relationship set", () => {
  const unknown = errorsAfter((index) => {
    prb(index).decision_basis.manifestation.evidence = ["EVD-999999"];
  });
  assert.match(unknown, /non-existent EVD-\* record "EVD-999999"/);

  const unlinked = errorsAfter((index) => {
    const linked = new Set(prb(index).evidence.map((relation: { evidence_id: string }) => relation.evidence_id));
    const other = index.byPrefix.get("EVD-")!.records
      .map(({ fields }) => fields.evidence_id as string)
      .find((id) => !linked.has(id))!;
    prb(index).investigation = { path: { initial_signal: { summary: "Teste.", evidence: [other] } } };
  });
  assert.match(unlinked, /investigation\.path\.initial_signal.*not linked in PRB\.evidence/);
});

test("canonical PRBs and optional PRB structures remain valid", () => {
  const canonical = loadCorpusIndex(root);
  assert.ok(canonical.byPrefix.get("PRB-")!.records.length > 0);
  assert.deepEqual(validateCorpusIndex(canonical).errors, []);

  const optional = loadCorpusIndex(root);
  const record = prb(optional, "PRB-0006");
  delete record.causal_reading;
  delete record.investigation;
  assert.deepEqual(validateCorpusIndex(optional).errors, []);
});

test("PRB contract rejects unknown fields and wrong declared container types", () => {
  const topLevel = errorsAfter((index) => { prb(index).unapproved = true; });
  assert.match(topLevel, /field "unapproved" is not an allowed field/);

  const nested = errorsAfter((index) => {
    prb(index).decision_basis.manifestation.unapproved = "no";
  });
  assert.match(nested, /field "decision_basis\.manifestation\.unapproved" is not an allowed field/);

  const types = errorsAfter((index) => {
    prb(index).geography = [];
    prb(index).decision_basis = "not an object";
    prb(index).evidence = {};
  });
  assert.match(types, /field "geography" has type "array"/);
  assert.match(types, /field "decision_basis" has type "string"/);
  assert.match(types, /field "evidence" has type "object"/);
});

test("PRB lifecycle dates are required full ISO dates", () => {
  const missingCreated = errorsAfter((index) => { delete prb(index).created_at; });
  assert.match(missingCreated, /missing required field: created_at/);

  const missingUpdated = errorsAfter((index) => { delete prb(index).updated_at; });
  assert.match(missingUpdated, /missing required field: updated_at/);

  const partial = errorsAfter((index) => {
    prb(index).created_at = "2026-08";
    prb(index).updated_at = "2026";
  });
  assert.match(partial, /created_at.*does not match required pattern/);
  assert.match(partial, /updated_at.*does not match required pattern/);
});

test("PRB authored relationship, investigation and decision-basis structures are closed", () => {
  const relationships = errorsAfter((index) => {
    const relation = prb(index).evidence[0];
    relation.extra = true;
    relation.effects = { value: "SUPPORTS" };
  });
  assert.match(relationships, /field "evidence\[0\]\.extra" is not an allowed field/);
  assert.match(relationships, /missing required non-empty field: evidence\[0\]\.effects/);

  const investigation = errorsAfter((index) => {
    prb(index).investigation.open_questions = [{ question: "Questão", evidence: [42], invented: true }];
  });
  assert.match(investigation, /field "investigation\.open_questions\[0\]\.invented" is not an allowed field/);
  assert.match(investigation, /field "investigation\.open_questions\[0\]\.evidence\[0\]" must be a string/);

  const investigationContainers = errorsAfter((index) => {
    prb(index).investigation.open_questions = [
      { question: "Questão escalar", evidence: "EVD-000001" },
      { question: "Questão objecto", evidence: { evidence_id: "EVD-000001" } },
    ];
  });
  assert.match(investigationContainers, /field "investigation\.open_questions\[0\]\.evidence" must be an array/);
  assert.match(investigationContainers, /field "investigation\.open_questions\[1\]\.evidence" must be an array/);

  const decisionBasis = errorsAfter((index) => {
    prb(index).decision_basis.manifestation = { summary: "Forma inválida", evidence: [42], invented: true };
  });
  assert.match(decisionBasis, /field "decision_basis\.manifestation\.invented" is not an allowed field/);
  assert.match(decisionBasis, /field "decision_basis\.manifestation\.evidence\[0\]" must be a string/);
});
