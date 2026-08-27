import assert from "node:assert/strict";
import test from "node:test";
import { loadCorpusIndex } from "../core/corpus.ts";
import { evaluateCorpus, evaluateEligibility, evaluateProblem, evaluateCorroboration, READY, REASON } from "./readiness.ts";

const root = `${process.cwd()}/research`;

function prb(index: ReturnType<typeof loadCorpusIndex>, id = "PRB-0001"): Record<string, any> {
  return index.byPrefix.get("PRB-")!.byId.get(id)!.fields as Record<string, any>;
}

function codes(result: { reasons: Array<{ code: string }> }): string[] {
  return result.reasons.map((reason) => reason.code);
}

test("readiness preserves human-owned corroboration and validation decisions", () => {
  const index = loadCorpusIndex(root);
  const reports = evaluateCorpus(index);
  assert.equal(reports.length, 10);
  const report = evaluateProblem("PRB-0001", index)!;
  assert.equal(typeof report.eligibility.result, "string");
  assert.equal(typeof report.corroboration.result, "string");
  assert.equal(evaluateProblem("PRB-9999", index), null);
});

test("eligibility reports each missing decision-basis component deterministically", () => {
  for (const [field, expected] of [
    ["eligibility_basis", REASON.MISSING_ELIGIBILITY_BASIS],
    ["manifestation", REASON.MISSING_MANIFESTATION],
    ["consequence", REASON.MISSING_CONSEQUENCE],
    ["currentness", REASON.MISSING_CURRENTNESS],
    ["overlap_check", REASON.MISSING_OVERLAP_CHECK_ELIGIBILITY],
  ] as const) {
    const index = loadCorpusIndex(root);
    delete prb(index).decision_basis[field];
    assert.ok(codes(evaluateEligibility("PRB-0001", index)).includes(expected), field);
  }
});

test("eligibility keeps unknown and unlinked evidence as structural review findings", () => {
  const unknown = loadCorpusIndex(root);
  prb(unknown).decision_basis.manifestation.evidence = ["EVD-999999"];
  assert.ok(codes(evaluateEligibility("PRB-0001", unknown)).includes(REASON.UNKNOWN_EVIDENCE_REFERENCE));

  const unlinked = loadCorpusIndex(root);
  const relationshipIds = new Set(prb(unlinked).evidence.map((entry: { evidence_id: string }) => entry.evidence_id));
  const other = unlinked.byPrefix.get("EVD-")!.records
    .map(({ fields }) => fields.evidence_id as string)
    .find((id) => !relationshipIds.has(id))!;
  prb(unlinked).decision_basis.manifestation.evidence = [other];
  assert.ok(codes(evaluateEligibility("PRB-0001", unlinked)).includes(REASON.EVIDENCE_NOT_LINKED_TO_PRB));
});

test("eligibility does not infer readiness from corpus, source, lineage, or relationship counts", () => {
  const index = loadCorpusIndex(root);
  const original = evaluateEligibility("PRB-0001", index);
  const changed = loadCorpusIndex(root);
  const target = prb(changed);
  target.evidence = [...target.evidence, ...target.evidence, ...target.evidence];
  for (const record of changed.byPrefix.get("EVD-")!.records) record.fields.lineage_id = "same-lineage";
  for (const record of changed.byPrefix.get("EVD-")!.records) {
    (record.fields.provenance as Record<string, unknown>).sources = ["SRC-0001", "SRC-0002"];
  }
  assert.deepEqual(evaluateEligibility("PRB-0001", changed), original);
});

test("a complete explicitly authored decision basis is ready only through its recorded fields", () => {
  const index = loadCorpusIndex(root);
  const result = evaluateEligibility("PRB-0001", index);
  assert.equal(result.result, READY.ELIGIBILITY);
  assert.deepEqual(result.reasons, []);
});

test("corroboration detects absent/false contradiction search and support-boundary problems", () => {
  const absent = loadCorpusIndex(root);
  delete prb(absent).decision_basis.contradiction_search;
  assert.ok(codes(evaluateCorroboration("PRB-0001", absent)).includes(REASON.MISSING_CONTRADICTION_SEARCH_CORROBORATION));

  const falseSearch = loadCorpusIndex(root);
  prb(falseSearch).decision_basis.contradiction_search = { performed: false, summary: "Não executada.", evidence: ["EVD-000001"] };
  assert.ok(codes(evaluateCorroboration("PRB-0001", falseSearch)).includes(REASON.CONTRADICTION_SEARCH_NOT_PERFORMED_CORROBORATION));
  assert.ok(codes(evaluateCorroboration("PRB-0001", falseSearch)).includes(REASON.CONTRADICTION_EVIDENCE_STRUCTURALLY_INCONSISTENT));

  const support = loadCorpusIndex(root);
  prb(support).decision_basis.supporting_evidence = [];
  assert.ok(codes(evaluateCorroboration("PRB-0001", support)).includes(REASON.MISSING_SUPPORTING_EVIDENCE));

  const boundary = loadCorpusIndex(root);
  prb(boundary).decision_basis.boundary_evidence = ["EVD-999999"];
  assert.ok(codes(evaluateCorroboration("PRB-0001", boundary)).includes(REASON.UNKNOWN_BOUNDARY_EVIDENCE_REFERENCE));
});

test("corroboration requires explicit scope, limits, independence and a current statement", () => {
  for (const [mutate, expected] of [
    [(db: Record<string, any>) => delete db.scope, REASON.MISSING_SCOPE],
    [(db: Record<string, any>) => delete db.scope.bounded, REASON.MISSING_SCOPE_BOUNDED],
    [(db: Record<string, any>) => { db.scope.bounded = true; delete db.limitations; }, REASON.BOUNDED_SCOPE_WITHOUT_LIMITATIONS],
    [(db: Record<string, any>) => delete db.independence_assessment, REASON.MISSING_INDEPENDENCE_ASSESSMENT],
    [(db: Record<string, any>) => { db.corroboration_statement = "desatualizada"; }, REASON.STALE_CORROBORATION_STATEMENT],
  ] as const) {
    const index = loadCorpusIndex(root);
    mutate(prb(index).decision_basis);
    assert.ok(codes(evaluateCorroboration("PRB-0001", index)).includes(expected));
  }
  const related = loadCorpusIndex(root);
  prb(related).decision_basis.overlap_check.related_problems = ["PRB-9999"];
  assert.ok(codes(evaluateEligibility("PRB-0001", related)).includes(REASON.UNKNOWN_RELATED_PROBLEM_REFERENCE));
});
