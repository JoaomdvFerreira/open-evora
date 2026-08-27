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
