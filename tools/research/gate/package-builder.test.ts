import assert from "node:assert/strict";
import test from "node:test";

import {
  gitFixture,
  loadIndexFor,
  SHA_A,
  semanticHumanGatePackage,
  semanticCandidates,
  semanticResearchChangeSet,
  semanticReview,
  semanticReviewCorpus,
  semanticReviewerInput,
  syntheticHumanGatePackage,
  syntheticResearchChangeSet,
} from "./test-fixtures.ts";
import { buildHumanGatePackage } from "./package-builder.ts";
import { validateHumanGatePackage } from "./package-validator.ts";
import { canonicalJsonStringify } from "../orchestrate/fingerprint.ts";
import { validateIndependentReview } from "../orchestrate/independent-review.ts";
import { buildReviewerInputPackage } from "../orchestrate/reviewer-input.ts";

test("the Gate stores exactly the reviewer signals and bounded evidence context buildReviewerInputPackage() reconstructs", () => {
  const index = semanticReviewCorpus();
  const reviewerInput = semanticReviewerInput(index, SHA_A);
  const pkg = semanticHumanGatePackage("CONCUR");

  assert.deepEqual(pkg.reviewSignals, reviewerInput.signals);
  assert.deepEqual(pkg.reviewEvidenceContext, reviewerInput.evidenceContext);
  // Candidate-scoped signals under stable IDs; the canonical EVD-A also says "Muitas" but is context only.
  assert.deepEqual(pkg.reviewSignals.map((s) => [s.signalId, s.signal.subjectId]), [["CLEC-SIG-0001", "PRB-NEW"], ["CLEC-SIG-0002", "PRB-NEW"], ["CLEC-SIG-0003", "EVD-B"]]);
  // PRB -> EVD -> SRC chain through the prospective corpus; the candidate EVD-B (now citing SRC-C) wins.
  assert.deepEqual(pkg.reviewEvidenceContext.map((r) => r.id), ["EVD-A", "SRC-A", "SRC-C"]);
  const json = canonicalJsonStringify(pkg);
  for (const excluded of ["SRC-UNRELATED", "EVD-UNRELATED", "SRC-B", "Outro problema.", "Versão canónica."]) {
    assert.equal(json.includes(excluded), false, `${excluded} must not enter the Gate package`);
  }
  assert.deepEqual(validateHumanGatePackage(JSON.parse(JSON.stringify(pkg))).errors, []);
});

test("the Gate review projection equals the Research Change Set's review exactly", () => {
  for (const scenario of ["CONCUR", "DISAGREEMENT_FOUND", "INSUFFICIENT_EVIDENCE"] as const) {
    const pkg = semanticHumanGatePackage(scenario);
    assert.deepEqual(pkg.independentReview, pkg.researchChangeSet.independentReview);
    assert.equal(pkg.independentReview.outcome, scenario);
  }
});

test("package assembly fails closed when the review no longer validates against the reconstructed reviewer context", () => {
  const index = semanticReviewCorpus();
  const review = semanticReview(semanticReviewerInput(index, SHA_A), "CONCUR");
  const cases = {
    "missing disposition": { ...review, signalDispositions: review.signalDispositions.slice(0, -1) },
    "evidence outside the context": {
      ...review,
      signalDispositions: review.signalDispositions.map((d, i) => (i === 0 ? { ...d, evidenceReferences: ["EVD-UNRELATED"] } : d)),
    },
  };
  for (const [name, stale] of Object.entries(cases)) {
    const built = buildHumanGatePackage(index, semanticResearchChangeSet(index, SHA_A, stale));
    assert.equal(built.pkg, undefined, name);
    assert.ok(built.errors.some((e) => e.startsWith("independent review does not validate against the reconstructed reviewer context")), name);
  }
});

test("package assembly rejects a change set carrying a context-free CLEC blocker even when its review is a valid CONCUR", () => {
  const index = semanticReviewCorpus();
  const records = semanticCandidates();
  records.candidates[0].fields = { ...records.candidates[0].fields, inference_limits: ["Não é impacto em PRB-0005."] };
  const draft = syntheticResearchChangeSet(index, SHA_A, "PRB-NEW", { records });
  const reviewerInput = buildReviewerInputPackage({ ...draft, index });
  assert.ok(reviewerInput.signals.some((s) => s.signal.code === "PRB_ID_IN_EVD_TEXT"));

  // A hand-built review dispositioning every signal, the blocker included, as SUPPORTED or NOT_APPLICABLE.
  const review = semanticReview(reviewerInput, "CONCUR");
  assert.deepEqual(validateIndependentReview(review, reviewerInput).errors, []);
  const built = buildHumanGatePackage(index, syntheticResearchChangeSet(index, SHA_A, "PRB-NEW", { records, independentReview: review }));
  assert.equal(built.pkg, undefined);
  assert.equal(built.errors.length, 1);
  assert.match(built.errors[0], /^CLEC_CONTEXT_FREE_BLOCK: /);
  assert.match(built.errors[0], /CLEC-SIG-\d{4} PRB_ID_IN_EVD_TEXT EVD-B inference_limits\[0\]: "PRB-0005"/);
});

test("the package validator rejects semantic-review material that diverges from its RCS authority or stored context", () => {
  const pkg = semanticHumanGatePackage("DISAGREEMENT_FOUND");
  const concur = semanticHumanGatePackage("CONCUR");
  const errorsOf = (value: unknown) => validateHumanGatePackage(JSON.parse(JSON.stringify(value))).errors;

  assert.ok(errorsOf({ ...pkg, independentReview: concur.independentReview }).includes("package.independentReview must equal package.researchChangeSet.independentReview exactly"));
  assert.ok(errorsOf({ ...pkg, candidates: [...pkg.candidates].reverse() }).includes("package.candidates must equal package.researchChangeSet.candidates exactly"));
  assert.ok(errorsOf({ ...pkg, reviewSignals: pkg.reviewSignals.slice(0, -1) }).some((e) => e.includes("is not a signal in the review input")));
  assert.ok(errorsOf({ ...pkg, reviewEvidenceContext: pkg.reviewEvidenceContext.filter((r) => r.id !== "EVD-A") }).some((e) => e.includes("\"EVD-A\", which is not a record in the review input")));
  assert.ok(errorsOf({ ...pkg, reviewEvidenceContext: [...pkg.reviewEvidenceContext, { recordFamily: "PRB-", id: "PRB-OTHER", fields: {} }] }).some((e) => e.includes("recordFamily must be one of EVD-, SRC-")));
  assert.ok(errorsOf({ ...pkg, reviewSignals: pkg.reviewSignals.map((s, i) => (i === 0 ? { ...s, signal: { ...s.signal, dimension: "clarity" } } : s)) }).some((e) => e.includes("signal.dimension must be supported_quantity")));
});

test("a Human Gate package v1 no longer validates", () => {
  const pkg = semanticHumanGatePackage("CONCUR");
  const { reviewEvidenceContext: _context, reviewSignals: _signals, ...v1Shape } = pkg;
  for (const v1 of [{ ...pkg, schemaVersion: "1" }, { ...v1Shape, schemaVersion: "1" }]) {
    const { errors } = validateHumanGatePackage(v1);
    assert.ok(errors.includes('package.schemaVersion must be exactly "2", got "1"'));
  }
  assert.ok(validateHumanGatePackage({ ...v1Shape }).errors.includes("package.reviewSignals must be an array"));
});

test("a valid RCS assembles into a Human Gate package exposing every contractually required element", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());

    assert.equal(pkg.schemaVersion, "2");
    assert.ok(pkg.packageId.startsWith("RCS-"));
    assert.equal(pkg.baseGitSha, fixture.head());
    assert.ok(pkg.investigationQuestion.length > 0);
    assert.equal(pkg.candidates.length, 1);
    assert.equal(pkg.deltas.length, 1);
    assert.deepEqual(pkg.prospectiveValidation.errors, []);
    assert.equal(pkg.independentReview.outcome, "CONCUR");
    assert.ok(pkg.integrationPlan);
    assert.ok(Array.isArray(pkg.affectedProblemReadiness));
    assert.ok(Array.isArray(pkg.affectedProblemIds));
    assert.ok(Array.isArray(pkg.expectedPublicEffect) && pkg.expectedPublicEffect.length > 0);
    assert.ok(Array.isArray(pkg.risksAndUncertainties));
    assert.ok(pkg.nonAuthoritativeRecommendation.startsWith("[NON-AUTHORITATIVE"));

    // The package must itself pass its own structural validator.
    assert.deepEqual(validateHumanGatePackage(pkg).errors, []);
  } finally {
    fixture.cleanup();
  }
});

test("the recommendation field is visually/structurally distinguished from a decision (never presented as one)", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());
    assert.match(pkg.nonAuthoritativeRecommendation, /^\[NON-AUTHORITATIVE — DOES NOT CONSTITUTE APPROVAL\]/);
  } finally {
    fixture.cleanup();
  }
});

test("problem-refresh mode includes the target PRB in affectedProblemIds even with no PRB delta", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const changeSet = syntheticResearchChangeSet(index, fixture.head(), "SRC-NEW", {
      manifest: { mode: "problem-refresh", targetProblemId: "PRB-0001" },
    });
    const built = buildHumanGatePackage(index, changeSet);
    assert.deepEqual(built.errors, []);
    assert.ok(built.pkg);
    assert.ok(built.pkg!.affectedProblemIds.includes("PRB-0001"));
  } finally {
    fixture.cleanup();
  }
});

test("readiness.ts is invoked read-only: building a package performs no canonical/public write", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const changeSet = syntheticResearchChangeSet(index, fixture.head());
    buildHumanGatePackage(index, changeSet);
    // The canonical SRC-NEW.yaml must not exist on disk — building a
    // package never writes canonical research, only the readiness
    // machinery's existing evaluateProblem() is invoked, read-only.
    const reloaded = loadIndexFor(fixture.research);
    assert.equal(reloaded.totalRecords, index.totalRecords);
  } finally {
    fixture.cleanup();
  }
});

test("independent-review DISAGREEMENT_FOUND is surfaced as a risk rather than silently dropped", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const changeSet = syntheticResearchChangeSet(index, fixture.head(), "SRC-NEW", {
      independentReview: {
        outcome: "DISAGREEMENT_FOUND",
        rationale: "Synthetic disagreement for test coverage.",
        findings: [{
          findingId: "CLEC-FND-0001",
          recordId: "SRC-NEW",
          field: "name",
          claim: "Created",
          dimension: "evidence_fidelity",
          kind: "CLEC_VIOLATION",
          severity: "BLOCKING",
          reason: "Synthetic disagreement for test coverage.",
          evidenceReferences: ["SRC-NEW"],
          correctionDirection: "Record the Source name as published.",
          relatedSignalIds: [],
        }],
      },
    });
    const built = buildHumanGatePackage(index, changeSet);
    assert.deepEqual(built.errors, []);
    assert.ok(built.pkg);
    assert.ok(built.pkg!.risksAndUncertainties.some((r) => r.includes("DISAGREEMENT_FOUND")));
  } finally {
    fixture.cleanup();
  }
});
