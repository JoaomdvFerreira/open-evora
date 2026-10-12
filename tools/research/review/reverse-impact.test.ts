import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { SourceVerification, SourceVerificationSet } from "../core/source-verifications.ts";
import type { CorpusIndex, ParsedRecord, RecordFields, RecordSchema } from "../core/types.ts";
import type { CandidateDelta, CandidateRecord } from "../integration/candidate-delta.ts";
import { buildProspectiveCorpusIndex } from "../integration/prospective-validation.ts";
import { SIGNAL_CODE } from "../language/signals.ts";
import { validateIndependentReview } from "./independent-review.ts";
import { deriveReverseEvidenceImpacts, LINKED_EVIDENCE_BOUNDARY_FIELDS, problemEvidenceReferenceIds } from "./reverse-impact.ts";
import { buildReviewerInputPackage, reviewSubjectCount, serializeReviewerInput, type ReviewerInputPackage, type ReviewerInputSource } from "./reviewer-input.ts";
import { buildReviewerPrompt } from "./reviewer-prompt.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

const SOURCE_SCHEMA: RecordSchema = { prefix: "SRC-", directory: "sources", idField: "source_id" };
const EVIDENCE_SCHEMA: RecordSchema = {
  prefix: "EVD-",
  directory: "evidence",
  idField: "evidence_id",
  references: [{ field: "provenance.sources", isList: true, targetPrefix: "SRC-", targetDirectory: "sources", required: true }],
};
/** The repository's actual PRB schema: reverse impact must follow every EVD reference it declares. */
const PROBLEM_SCHEMA: RecordSchema = JSON.parse(readFileSync(new URL("../../../research/schemas/problem.schema.json", import.meta.url), "utf8"));

const ELIGIBLE = { resource_type: "document", access: { level: "public" }, licensing: { reuse: "unknown" } };

function family(schema: RecordSchema, records: RecordFields[]) {
  const parsed: ParsedRecord[] = records.map((fields) => ({ file: `${schema.directory}/${fields[schema.idField]}.yaml`, fields }));
  return { schema, records: parsed, byId: new Map(parsed.map((r) => [r.fields[schema.idField] as string, r])) };
}

function evidence(id: string, summary: string, scope: RecordFields, source = `SRC-${id.slice(4)}`): RecordFields {
  return {
    evidence_id: id,
    domain: ["residuos"],
    provenance: { sources: [source], captured_at: "2026-01-10" },
    observation: { summary, kind: "reported_experience" },
    scope,
    inference_limits: ["Não mede a frequência dos atrasos."],
    evidence_nature: "reported_experience",
    claim_authority: "non_authoritative",
    validation: { status: "validated", reviewed_by: "owner" },
  };
}

const BROAD = evidence("EVD-A", "Residentes de Évora relatam atrasos na recolha de resíduos em 2025.", { geography: "Évora", population: "residentes", temporal: { as_of: "2025" } });
const NARROW = evidence("EVD-A", "Moradores da Malagueira relatam atrasos na recolha de resíduos em 2025.", { geography: "Malagueira", population: "moradores", temporal: { as_of: "2025" } });

function problem(id: string, statement: string, evidenceIds: string[], extra: RecordFields = {}): RecordFields {
  return { problem_id: id, title: "Atrasos na recolha de resíduos", problem_statement: statement, evidence: evidenceIds.map((evidence_id) => ({ evidence_id })), ...extra };
}

const PRB_A = problem("PRB-A", "Residentes de Évora relatam atrasos na recolha de resíduos.", ["EVD-A"]);

function corpus(evidenceRecords: RecordFields[], problems: RecordFields[]): CorpusIndex {
  const sourceIds = [...new Set(evidenceRecords.flatMap((e) => (e.provenance as { sources: string[] }).sources)), "SRC-UNRELATED"];
  const byPrefix = new Map([
    ["SRC-", family(SOURCE_SCHEMA, sourceIds.map((id) => ({ source_id: id, name: `Fonte ${id}`, ...ELIGIBLE })))],
    ["EVD-", family(EVIDENCE_SCHEMA, evidenceRecords)],
    ["PRB-", family(PROBLEM_SCHEMA, problems)],
  ]);
  return { researchRoot: "/synthetic", byPrefix, totalRecords: sourceIds.length + evidenceRecords.length + problems.length };
}

const UNRELATED_EVD = evidence("EVD-UNRELATED", "Sem relação.", { geography: "Portugal" });

function change(index: CorpusIndex, changes: { candidate: CandidateRecord; action: CandidateDelta["action"] }[], overrides: Partial<ReviewerInputSource> = {}): ReviewerInputSource {
  const sorted = [...changes].sort((a, b) => {
    const key = (c: typeof a) => `${c.candidate.recordFamily}\u0000${(c.candidate.fields.problem_id ?? c.candidate.fields.evidence_id ?? c.candidate.fields.source_id) as string}`;
    return key(a) < key(b) ? -1 : 1;
  });
  return {
    baseGitSha: SHA,
    manifest: { investigationQuestion: "Revisão direta.", mode: "direct-change" },
    index,
    candidates: sorted.map((c) => c.candidate),
    deltas: sorted.map((c) => ({ recordFamily: c.candidate.recordFamily, id: (c.candidate.fields.problem_id ?? c.candidate.fields.evidence_id ?? c.candidate.fields.source_id) as string, action: c.action })),
    validation: { errors: [], totalRecords: index.totalRecords },
    readiness: "READY_FOR_REVIEW",
    sourceVerifications: { bySourceId: new Map(), issues: [] },
    ...overrides,
  };
}

const evd = (fields: RecordFields) => ({ candidate: { recordFamily: "EVD-", fields }, action: "UPDATE" as const });
const prb = (fields: RecordFields, action: CandidateDelta["action"] = "UPDATE") => ({ candidate: { recordFamily: "PRB-", fields }, action });

/** Base: broad EVD-A supports unchanged PRB-A. Change: EVD-A narrows. PRB-A is not modified. */
function narrowScopeChange(overrides: Partial<ReviewerInputSource> = {}): ReviewerInputPackage {
  return buildReviewerInputPackage(change(corpus([BROAD, UNRELATED_EVD], [PRB_A, problem("PRB-OTHER", "Outro problema.", ["EVD-UNRELATED"])]), [evd(NARROW)], overrides));
}

type Review = { schemaVersion: "2"; outcome: string; rationale: string; findings: Record<string, unknown>[]; signalDispositions: Record<string, unknown>[] };

function notApplicable(pkg: ReviewerInputPackage): Review {
  return {
    schemaVersion: "2",
    outcome: "CONCUR",
    rationale: "Revisão sintética.",
    findings: [],
    signalDispositions: pkg.signals.map(({ signalId }) => ({ signalId, disposition: "NOT_APPLICABLE", reason: "Falso positivo.", evidenceReferences: [], relatedFindingIds: [] })),
  };
}

function violationOn(pkg: ReviewerInputPackage, recordId: string): Review {
  const review = notApplicable(pkg);
  const signal = pkg.signals.find(({ signal }) => signal.subjectId === recordId && signal.code === SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE);
  review.findings = [{
    findingId: "CLEC-FND-0001",
    recordId,
    field: "problem_statement",
    claim: "Residentes de Évora",
    dimension: "explicit_scope",
    kind: "CLEC_VIOLATION",
    severity: "BLOCKING",
    reason: "A EVD-A revista limita-se à Malagueira; o problema afirma todo o concelho.",
    evidenceReferences: ["EVD-A"],
    correctionDirection: "Restringir o âmbito do problema ao âmbito da evidência ligada.",
    relatedSignalIds: signal ? [signal.signalId] : [],
  }];
  if (signal) {
    const disposition = review.signalDispositions.find((d) => d.signalId === signal.signalId)!;
    Object.assign(disposition, { disposition: "VIOLATION", evidenceReferences: ["EVD-A"], relatedFindingIds: ["CLEC-FND-0001"] });
  }
  review.outcome = "DISAGREEMENT_FOUND";
  return review;
}

// ---------------------------------------------------------------------------
// Durable reverse-impact behavior.

test("a narrowed EVD makes the unchanged PRB reviewable against its complete evidence boundary", () => {
  const pkg = narrowScopeChange();
  // 1. EVD-A is the only changed candidate.
  assert.deepEqual(pkg.deltas.map((d) => [d.id, d.action]), [["EVD-A", "UPDATE"]]);
  // 2-3. PRB-A is discovered and becomes a review subject, without becoming a candidate.
  assert.deepEqual(pkg.impactedSubjects?.map((s) => s.id), ["PRB-A"]);
  const subject = pkg.impactedSubjects![0];
  assert.deepEqual(subject.fields, PRB_A);
  assert.equal(pkg.candidates.some((c) => c.fields.problem_id === "PRB-A"), false);
  // 4-5. Complete linked-EVD boundary, with the changed EVD marked and projected from its candidate version.
  assert.deepEqual(subject.changedEvidenceIds, ["EVD-A"]);
  assert.deepEqual(subject.linkedEvidenceBoundary.map((b) => [b.evidenceId, b.changed]), [["EVD-A", true]]);
  assert.equal((subject.linkedEvidenceBoundary[0].fields.observation as RecordFields).summary, NARROW.observation && (NARROW.observation as RecordFields).summary);
  // 6. FZ-01 scope signals run on the unchanged PRB against the prospective (narrowed) EVD.
  const codes = pkg.signals.filter(({ signal }) => signal.subjectId === "PRB-A").map(({ signal }) => signal.code);
  assert.ok(codes.includes(SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE), codes.join());
  assert.ok(codes.includes(SIGNAL_CODE.PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE), codes.join());
  // 7. A blocking CLEC_VIOLATION against PRB-A validates.
  assert.deepEqual(validateIndependentReview(violationOn(pkg, "PRB-A"), pkg).errors, []);
  // 8. CONCUR that omits a required disposition still fails.
  const concur = notApplicable(pkg);
  concur.signalDispositions = concur.signalDispositions.filter((d) => pkg.signals.find((s) => s.signalId === d.signalId)!.signal.subjectId !== "PRB-A");
  assert.match(validateIndependentReview(concur, pkg).errors.join("\n"), /has no disposition/);
});

test("the same narrowing produces no impact signal when the base EVD is unchanged", () => {
  const base = buildReviewerInputPackage(change(corpus([BROAD], [PRB_A]), [prb(PRB_A)]));
  assert.equal(base.signals.some(({ signal }) => signal.code === SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE), false);
});

test("a SUPPORTED scope disposition on an impacted PRB still needs a linked EVD carrying the term", () => {
  const pkg = narrowScopeChange();
  const review = notApplicable(pkg);
  const signal = pkg.signals.find(({ signal }) => signal.subjectId === "PRB-A" && signal.code === SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE)!;
  Object.assign(review.signalDispositions.find((d) => d.signalId === signal.signalId)!, { disposition: "SUPPORTED", evidenceReferences: ["EVD-A"] });
  assert.match(validateIndependentReview(review, pkg).errors.join("\n"), /cites no EVD linked by PRB-A/);
});

// ---------------------------------------------------------------------------
// Boundary completeness

const EVD_B = evidence("EVD-B", "Residentes de Évora reclamam da recolha de resíduos em 2025.", { geography: "Évora", population: "residentes" });
const EVD_C = evidence("EVD-C", "Registo municipal de pedidos de recolha.", { geography: "Évora" });

test("a PRB linking three EVDs receives all three when only one changes, and another may still support it", () => {
  const prbA = problem("PRB-A", "Residentes de Évora relatam atrasos na recolha de resíduos.", ["EVD-C", "EVD-A", "EVD-B"]);
  const pkg = buildReviewerInputPackage(change(corpus([BROAD, EVD_B, EVD_C], [prbA]), [evd(NARROW)]));
  const subject = pkg.impactedSubjects![0];
  assert.deepEqual(subject.linkedEvidenceBoundary.map((b) => [b.evidenceId, b.changed]), [["EVD-A", true], ["EVD-B", false], ["EVD-C", false]]);
  // EVD-B still carries "Évora" and "residentes": no deterministic violation is declared for the narrowing.
  assert.equal(pkg.signals.some(({ signal }) => signal.subjectId === "PRB-A" && signal.code === SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE), false);
  // Unchanged boundary EVDs are citable, and a CONCUR citing EVD-B validates.
  const review = notApplicable(pkg);
  for (const d of review.signalDispositions) d.evidenceReferences = ["EVD-B"];
  assert.deepEqual(validateIndependentReview(review, pkg).errors, []);
});

test("one changed EVD impacts every PRB referencing it; an unrelated PRB is not included", () => {
  const pkg = buildReviewerInputPackage(change(corpus([BROAD, UNRELATED_EVD], [
    problem("PRB-B", "Atrasos relatados.", ["EVD-A"]),
    PRB_A,
    problem("PRB-OTHER", "Outro problema.", ["EVD-UNRELATED"]),
  ]), [evd(NARROW)]));
  assert.deepEqual(pkg.impactedSubjects?.map((s) => s.id), ["PRB-A", "PRB-B"]);
  assert.equal(serializeReviewerInput(pkg).includes("PRB-OTHER"), false);
  assert.equal(reviewSubjectCount(pkg), 3);
});

test("two changed EVDs impacting one PRB yield one subject with both marked", () => {
  const prbA = problem("PRB-A", "Atrasos relatados.", ["EVD-B", "EVD-A", "EVD-C"]);
  const pkg = buildReviewerInputPackage(change(corpus([BROAD, EVD_B, EVD_C], [prbA]), [evd(NARROW), evd({ ...EVD_B, observation: { summary: "Revista." } })]));
  assert.equal(pkg.impactedSubjects?.length, 1);
  assert.deepEqual(pkg.impactedSubjects![0].changedEvidenceIds, ["EVD-A", "EVD-B"]);
  assert.deepEqual(pkg.impactedSubjects![0].linkedEvidenceBoundary.map((b) => [b.evidenceId, b.changed]), [["EVD-A", true], ["EVD-B", true], ["EVD-C", false]]);
});

test("reverse impact follows the prospective PRB: a removed reference is no impact edge", () => {
  const index = corpus([BROAD, EVD_B], [problem("PRB-A", "Atrasos relatados.", ["EVD-A", "EVD-B"])]);
  const pkg = buildReviewerInputPackage(change(index, [evd(NARROW), prb(problem("PRB-A", "Atrasos relatados.", ["EVD-B"]))]));
  assert.equal("impactedSubjects" in pkg, false);
  const prospective = buildProspectiveCorpusIndex(index, pkg.candidates);
  assert.deepEqual(deriveReverseEvidenceImpacts(prospective, pkg.deltas), []);
  // A changed PRB that still links the changed EVD is impacted but reviewed once, as its candidate.
  const kept = buildReviewerInputPackage(change(index, [evd(NARROW), prb(problem("PRB-A", "Atrasos.", ["EVD-A", "EVD-B"]))]));
  assert.equal("impactedSubjects" in kept, false);
  assert.deepEqual(deriveReverseEvidenceImpacts(buildProspectiveCorpusIndex(index, kept.candidates), kept.deltas).map((i) => [i.problemId, i.problemChanged]), [["PRB-A", true]]);
  assert.equal(reviewSubjectCount(kept), 2);
});

test("SRC-only and PRB-only changes produce no reverse impact and no impact prompt material", () => {
  const index = corpus([BROAD], [PRB_A]);
  for (const pkg of [
    buildReviewerInputPackage(change(index, [{ candidate: { recordFamily: "SRC-", fields: { source_id: "SRC-A", name: "Renomeada", ...ELIGIBLE } }, action: "UPDATE" }])),
    buildReviewerInputPackage(change(index, [prb({ ...PRB_A, title: "Outro título" })])),
  ]) {
    assert.equal("impactedSubjects" in pkg, false);
    assert.equal(serializeReviewerInput(pkg).includes("impactedSubjects"), false);
    assert.equal(buildReviewerPrompt(serializeReviewerInput(pkg)).includes("Reverse-impact review subjects"), false);
  }
  assert.match(buildReviewerPrompt(serializeReviewerInput(narrowScopeChange())), /Reverse-impact review subjects/);
});

// ---------------------------------------------------------------------------
// Actual schema reference coverage

test("every EVD reference the PRB schema declares is followed, and nothing else", () => {
  const declared = (PROBLEM_SCHEMA.references ?? []).filter((r) => r.targetPrefix === "EVD-").map((r) => r.field);
  assert.deepEqual(declared, [
    "evidence",
    "decision_basis.manifestation.evidence",
    "decision_basis.consequence.evidence",
    "decision_basis.currentness.evidence",
    "decision_basis.contradiction_search.evidence",
    "decision_basis.supporting_evidence",
    "decision_basis.boundary_evidence",
  ]);
  const fields: RecordFields = {
    problem_id: "PRB-A",
    evidence: [{ evidence_id: "EVD-0001" }],
    decision_basis: {
      manifestation: { evidence: ["EVD-0002"] },
      consequence: { evidence: ["EVD-0003"] },
      currentness: { evidence: ["EVD-0004"] },
      contradiction_search: { evidence: ["EVD-0005"] },
      supporting_evidence: ["EVD-0006"],
      boundary_evidence: ["EVD-0007"],
      overlap_check: { related_problems: ["PRB-0099"] },
    },
    investigation: {
      open_questions: [{ question: "?", evidence: ["EVD-0008"] }, { question: "?" }],
      path: { initial_signal: { evidence: ["EVD-0009"] }, development: { evidence: ["EVD-0010"] }, delimitation: { evidence: ["EVD-0011"] } },
    },
  };
  const ids = problemEvidenceReferenceIds({ schema: PROBLEM_SCHEMA, records: [], byId: new Map() }, fields);
  assert.deepEqual(ids, Array.from({ length: 11 }, (_, i) => `EVD-${String(i + 1).padStart(4, "0")}`));

  // Each location on its own is a reverse-impact edge.
  for (const id of ids) {
    const evidenceRecords = ids.map((e) => evidence(e, "Resumo.", {}));
    const pkg = buildReviewerInputPackage(change(corpus(evidenceRecords, [fields]), [evd(evidence(id, "Resumo revisto.", {}))]));
    assert.deepEqual(pkg.impactedSubjects?.map((s) => [s.id, s.changedEvidenceIds]), [["PRB-A", [id]]], id);
  }
});

test("a schema-declared EVD reference added later is covered without code change", () => {
  const schema: RecordSchema = { ...PROBLEM_SCHEMA, references: [...(PROBLEM_SCHEMA.references ?? []), { field: "future.evidence", isList: true, targetPrefix: "EVD-", targetDirectory: "evidence" }] };
  assert.deepEqual(problemEvidenceReferenceIds({ schema, records: [], byId: new Map() }, { future: { evidence: ["EVD-0042"] } }), ["EVD-0042"]);
});

// ---------------------------------------------------------------------------
// Context-growth guard: the impact boundary is bounded from birth

test("impacted-PRB context adds no SRC, no Source Verification Support and no unrelated record", () => {
  const sourceVerifications: SourceVerificationSet = {
    bySourceId: new Map<string, SourceVerification>(["SRC-A", "SRC-B"].map((id) => [id, {
      source_id: id,
      retrieval: { retrieved_at: "2026-08-25", content_sha256: "ab".repeat(32), media_type: "application/pdf" },
      verified_claims: [{ locator: "p. 1", statement: `Afirmação verificada de ${id}.` }],
    }])),
    issues: [],
  };
  const prbA = problem("PRB-A", "Residentes de Évora relatam atrasos.", ["EVD-A", "EVD-B"]);
  const pkg = buildReviewerInputPackage(change(corpus([BROAD, EVD_B, UNRELATED_EVD], [prbA, problem("PRB-OTHER", "Outro.", ["EVD-UNRELATED"])]), [evd(NARROW)], { sourceVerifications }));

  // Complete authored PRB, every linked EVD exactly once, approved fields only.
  const subject = pkg.impactedSubjects![0];
  assert.deepEqual(subject.fields, prbA);
  assert.deepEqual(subject.linkedEvidenceBoundary.map((b) => b.evidenceId), ["EVD-A", "EVD-B"]);
  for (const boundary of subject.linkedEvidenceBoundary) {
    assert.deepEqual(Object.keys(boundary).sort(), ["changed", "evidenceId", "fields"]);
    assert.deepEqual(Object.keys(boundary.fields).sort(), ["claim_authority", "evidence_nature", "inference_limits", "observation", "scope"]);
    assert.deepEqual(Object.keys(boundary.fields.observation as RecordFields), ["summary"]);
  }
  assert.deepEqual(LINKED_EVIDENCE_BOUNDARY_FIELDS, ["observation.summary", "scope", "inference_limits", "evidence_nature", "claim_authority"]);
  const boundaryJson = JSON.stringify(pkg.impactedSubjects);
  for (const excluded of ["SRC-", "provenance", "validation", "domain", "reported_experience\",\"summary"]) assert.equal(boundaryJson.includes(excluded), false, excluded);

  // The changed EVD keeps its existing Source-fidelity context; the unchanged EVD-B's Source is never added.
  assert.deepEqual(pkg.evidenceContext.map((r) => r.id), ["SRC-A"]);
  assert.deepEqual(pkg.sourceVerificationContext?.map((s) => s.source_id), ["SRC-A"]);
  const json = serializeReviewerInput(pkg);
  for (const excluded of ["SRC-B", "SRC-UNRELATED", "EVD-UNRELATED", "PRB-OTHER"]) assert.equal(json.includes(excluded), false, excluded);
  // The unchanged boundary EVD is not promoted into evidenceContext either.
  assert.equal(pkg.evidenceContext.some((r) => r.id === "EVD-B"), false);
});

// ---------------------------------------------------------------------------
// Findings boundary

test("findings may target the impacted PRB, never an unrelated unchanged PRB", () => {
  const pkg = narrowScopeChange();
  assert.deepEqual(validateIndependentReview(violationOn(pkg, "PRB-A"), pkg).errors, []);

  const forged = violationOn(pkg, "PRB-A");
  Object.assign(forged.findings[0], { recordId: "PRB-OTHER", claim: "Outro problema", relatedSignalIds: [] });
  forged.signalDispositions = notApplicable(pkg).signalDispositions;
  assert.match(validateIndependentReview(forged, pkg).errors.join("\n"), /recordId must name a candidate record, got "PRB-OTHER"/);

  const misquoted = violationOn(pkg, "PRB-A");
  misquoted.findings[0].claim = "Moradores de todo o Alentejo";
  assert.match(validateIndependentReview(misquoted, pkg).errors.join("\n"), /does not occur verbatim in PRB-A problem_statement/);
});

test("reverse-impact packages are deterministic", () => {
  assert.equal(serializeReviewerInput(narrowScopeChange()), serializeReviewerInput(narrowScopeChange()));
});
