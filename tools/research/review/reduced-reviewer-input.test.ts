import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadCorpusIndex } from "../core/corpus.ts";
import { sha256Hex } from "../core/fingerprint.ts";
import type { RecordFields } from "../core/types.ts";
import { CONTEXT_FREE_BLOCKING_CODES, SIGNAL_CODE } from "../language/signals.ts";
import { validateIndependentReview, validateReducedIndependentReview } from "./independent-review.ts";
import {
  buildReducedReviewerInputPackage,
  changedPaths,
  deriveReducedSignals,
  REDUCED_SOURCE_CONTEXT_FIELDS,
  ReducedReviewContextFreeBlockError,
  serializeReducedReviewerInput,
  type ReducedReviewerInputPackage,
} from "./reduced-reviewer-input.ts";
import {
  change,
  corpus,
  evd,
  evidence,
  EVD_A_BROAD,
  EVD_A_NARROW,
  EVD_B,
  EVD_C,
  EVD_UNRELATED,
  narrowingChange,
  PRB_A,
  PRB_UNRELATED,
  prb,
  problem,
  source,
  src,
} from "./reduced-test-fixtures.ts";
import { problemEvidenceReferenceIds, problemEvidenceReferences } from "./reverse-impact.ts";
import { buildReviewerInputPackage, serializeReviewerInput } from "./reviewer-input.ts";
import { buildReducedReviewerPrompt, buildReviewerPrompt, buildReviewerStructuralRetryPrompt } from "./reviewer-prompt.ts";

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");

type Review = { schemaVersion: "2"; outcome: string; rationale: string; findings: Record<string, unknown>[]; signalDispositions: Record<string, unknown>[] };

function notApplicable(pkg: ReducedReviewerInputPackage): Review {
  return {
    schemaVersion: "2",
    outcome: "CONCUR",
    rationale: "Revisão sintética.",
    findings: [],
    signalDispositions: pkg.signals.map(({ signalId }) => ({ signalId, disposition: "NOT_APPLICABLE", reason: "Falso positivo.", evidenceReferences: [], relatedFindingIds: [] })),
  };
}

function finding(recordId: string, field: string, claim: string, evidenceReferences: string[], relatedSignalIds: string[] = []): Record<string, unknown> {
  return {
    findingId: "CLEC-FND-0001",
    recordId,
    field,
    claim,
    dimension: "explicit_scope",
    kind: "CLEC_VIOLATION",
    severity: "BLOCKING",
    reason: "A evidência ligada não sustenta esta formulação.",
    evidenceReferences,
    correctionDirection: "Restringir a formulação ao âmbito da evidência ligada.",
    relatedSignalIds,
  };
}

/** PRB-A linking only EVD-A (plus boundary EVD-C): narrowing EVD-A leaves its municipal wording unsupported. */
const PRB_A_ONLY = problem("PRB-A", PRB_A.problem_statement as string, [{ evidence_id: "EVD-A", effects: ["SUPPORTS"] }], {
  decision_basis: { boundary_evidence: ["EVD-C"] },
});

function broadToNarrow(extra: Parameters<typeof change>[1] = []) {
  return change(corpus({ problems: [PRB_A_ONLY, PRB_UNRELATED] }), [evd(EVD_A_NARROW), ...extra]);
}

// ---------------------------------------------------------------------------
// Reference profile: byte-identical, still the default

test("the REFERENCE profile is byte-identical: input, fingerprint, prompt, retry prompt, signal IDs, evidence context and support", () => {
  // Golden values recorded on the CRR-02 base before any CRR-03 change; never update them here.
  const golden = [
    {
      source: narrowingChange(),
      input: "6a8dc9920bcc39f002fe284813fd8b3d1a2f0d4b5c4626d04e75ff1faba326f8",
      prompt: "32b5a1b36a1e4a5844a8324587cd63efeaa23d86ea4b7a070a1a4226aff7db93",
      retry: "f02f1be5d2e5adc4fff009ae3f3398541b03049baddf4d740faad1a35f429c65",
      signals: ["CLEC-SIG-0001:GENERIC_POPULATION:PRB-A", "CLEC-SIG-0002:GENERIC_POPULATION:PRB-A"],
      context: ["SRC-A"],
      support: ["SRC-A"],
    },
    {
      source: change(corpus(), [prb({ ...PRB_A, title: "Atrasos frequentes na recolha" })]),
      input: "9f18fca1f36337180c179c6ac875b77bf38e09093b93a3dd17325d4ec83af840",
      prompt: "a59f6d25718ed4926e3d8a706f246b20ddf6eb1128568add69f2ad764c1dde57",
      retry: "ad75df7443477a1c20a79a3df459b94e7f098baad947580e0a5403ae95df7f12",
      signals: ["CLEC-SIG-0001:VAGUE_FREQUENCY:PRB-A", "CLEC-SIG-0002:GENERIC_POPULATION:PRB-A", "CLEC-SIG-0003:GENERIC_POPULATION:PRB-A"],
      context: ["EVD-A", "EVD-B", "EVD-C", "SRC-A", "SRC-B", "SRC-C"],
      support: [],
    },
    {
      source: change(corpus(), [src(source("SRC-A", { caveats: ["Outra ressalva."] }))]),
      input: "f6293c9599d33c7795af66296de93f1cb7acf29e1fa05e4b5ebc5c10643ac3fd",
      prompt: "6a4cf86572aa3d821532238322b3a1553f1282d6fe9b1525b94b2a5f998ddce6",
      retry: "7050bbab35b3dad2c570fb8e232f13a274a5d3419313f9773e11441f1727ac54",
      signals: [],
      context: [],
      support: [],
    },
  ];
  for (const expected of golden) {
    const pkg = buildReviewerInputPackage(expected.source);
    const json = serializeReviewerInput(pkg);
    const prompt = buildReviewerPrompt(json);
    assert.equal(pkg.schemaVersion, "2");
    assert.equal(sha(json), expected.input);
    assert.equal(sha256Hex(pkg), expected.input);
    assert.equal(sha(prompt), expected.prompt);
    assert.equal(sha(buildReviewerStructuralRetryPrompt(prompt, ["e1"])), expected.retry);
    assert.deepEqual(pkg.signals.map(({ signalId, signal }) => `${signalId}:${signal.code}:${signal.subjectId}`), expected.signals);
    assert.deepEqual(pkg.evidenceContext.map((record) => record.id), expected.context);
    assert.deepEqual((pkg.sourceVerificationContext ?? []).map((entry) => entry.source_id), expected.support);
    assert.doesNotMatch(prompt, /REDUCED/);
  }
});

test("no operational route builds, prompts or validates the reduced profile", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [join(dir, entry.name)] : []));
  const operational = ["orchestrate", "gate"].flatMap((dir) => files(join(root, dir)));
  operational.push(join(root, "review", "cli.ts"));
  assert.ok(operational.length > 0);
  for (const file of [...operational, join(root, "review", "independent-review-invocation.ts"), join(root, "review", "review-lifecycle.ts")]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /reduced-reviewer-input|Reduced(?:Reviewer|IndependentReview)/, file);
  }
});

// ---------------------------------------------------------------------------
// Identity and determinism

test("the reduced package has its own schema/profile identity and is deterministic", () => {
  const pkg = buildReducedReviewerInputPackage(narrowingChange());
  assert.equal(pkg.schemaVersion, "3");
  assert.equal(pkg.profile, "REDUCED");
  assert.ok(Object.isFrozen(pkg) && Object.isFrozen(pkg.candidates[0].fields));
  const again = buildReducedReviewerInputPackage(narrowingChange());
  assert.equal(serializeReducedReviewerInput(pkg), serializeReducedReviewerInput(again));
  assert.equal(sha256Hex(pkg), sha256Hex(again));
  assert.equal(sha256Hex(pkg), sha(serializeReducedReviewerInput(pkg)));
  // Object key order of the inputs never changes the package.
  const reordered = Object.fromEntries(Object.entries(EVD_A_NARROW).reverse());
  assert.equal(serializeReducedReviewerInput(buildReducedReviewerInputPackage(change(corpus(), [evd(reordered)]))), serializeReducedReviewerInput(pkg));
  assert.doesNotMatch(serializeReducedReviewerInput(pkg), /"validation"|"readiness"|"deltas"|"evidenceContext"/);
});

// ---------------------------------------------------------------------------
// Changed paths

test("changed paths: scalar, nested scalar, list item, insertion, removal, key order and CREATE", () => {
  const base = { a: "x", b: { c: "y", d: ["p", "q"] }, e: [{ f: 1 }] };
  assert.deepEqual(changedPaths(base, { ...base, a: "z" }), ["a"]);
  assert.deepEqual(changedPaths(base, { ...base, b: { ...base.b, c: "w" } }), ["b.c"]);
  assert.deepEqual(changedPaths(base, { ...base, b: { ...base.b, d: ["p", "r"] } }), ["b.d[1]"]);
  assert.deepEqual(changedPaths(base, { ...base, b: { ...base.b, d: ["p", "q", "s"] } }), ["b.d[2]"]);
  assert.deepEqual(changedPaths(base, { ...base, b: { ...base.b, d: ["o", "p", "q"] } }), ["b.d[0]", "b.d[1]", "b.d[2]"]);
  assert.deepEqual(changedPaths(base, { ...base, b: { ...base.b, d: ["p"] } }), ["b.d[1]"]);
  assert.deepEqual(changedPaths(base, { ...base, e: [{ f: 2 }] }), ["e[0].f"]);
  assert.deepEqual(changedPaths(base, { e: base.e, b: { d: base.b.d, c: "y" }, a: "x" }), []);
  assert.deepEqual(changedPaths(base, { ...base, g: "novo" }), ["g"]);
  // No semantic normalization: whitespace and case are changes.
  assert.deepEqual(changedPaths(base, { ...base, a: "x " }), ["a"]);
  assert.deepEqual(changedPaths(base, { ...base, a: "X" }), ["a"]);

  const narrowed = buildReducedReviewerInputPackage(narrowingChange()).candidates[0];
  assert.equal(narrowed.action, "UPDATE");
  assert.deepEqual(narrowed.changedPaths, ["observation.summary", "scope.geography.area", "scope.geography.level", "scope.populations[0]"]);
  assert.deepEqual(narrowed.fields, EVD_A_NARROW);

  const created = buildReducedReviewerInputPackage(change(corpus(), [evd(evidence("EVD-N", "Nova observação.", { geography: { level: "city" } }, ["SRC-A"]), "CREATE")])).candidates[0];
  assert.equal(created.action, "CREATE");
  assert.equal("changedPaths" in created, false);
});

// ---------------------------------------------------------------------------
// Family-specific context

test("a changed EVD: complete candidate, allow-listed own Source, base-only support, reverse-impacted PRBs with every linked boundary", () => {
  const pkg = buildReducedReviewerInputPackage(narrowingChange());
  const reference = buildReviewerInputPackage(narrowingChange());

  assert.deepEqual(pkg.candidates.map((c) => c.id), ["EVD-A"]);
  assert.equal("evidenceLinks" in pkg.candidates[0], false);
  // Only the changed EVD's own Source, with exactly the allow-listed fields.
  assert.deepEqual(pkg.sourceContext.map((s) => s.sourceId), ["SRC-A"]);
  assert.deepEqual(pkg.sourceContext[0].fields, {
    source_id: "SRC-A",
    publisher: "Entidade SRC-A",
    creators: ["Autor SRC-A"],
    name: "Relatório SRC-A",
    resource_type: "document",
    identity: { version: "v1" },
    canonical_reference: "https://example.test/SRC-A",
    scope: { geography: { level: "municipality", area: "Évora" }, temporal: { start: "2024", end: "2025" } },
    access: { level: "public" },
    licensing: { reuse: "unknown" },
    temporal: { published_at: "2025-03" },
    caveats: ["Amostra reduzida."],
  });
  const json = serializeReducedReviewerInput(pkg);
  const sourceJson = JSON.stringify(pkg.sourceContext);
  for (const absent of ["domains", "machine_readable", "acquisition", "Licença desconhecida", "last_checked_at", "update_frequency"]) assert.doesNotMatch(sourceJson, new RegExp(absent));
  for (const absent of ["SRC-B", "SRC-C", "SRC-U"]) assert.doesNotMatch(json, new RegExp(absent));
  for (const allowed of REDUCED_SOURCE_CONTEXT_FIELDS) assert.ok(!allowed.includes("content") && !allowed.includes("body"));
  // Support: exactly the reference selection (SRC-B's support is reached only through an impacted PRB).
  assert.deepEqual(pkg.sourceVerificationContext, reference.sourceVerificationContext);

  // Reverse impact: PRB-A, never PRB-U, with all three linked boundaries and no workflow state.
  assert.deepEqual(pkg.impactedSubjects?.map((s) => s.id), ["PRB-A"]);
  const subject = pkg.impactedSubjects![0];
  assert.deepEqual(subject.changedEvidenceIds, ["EVD-A"]);
  assert.deepEqual(subject.linkedEvidenceBoundary.map((b) => [b.evidenceId, b.changed]), [["EVD-A", true], ["EVD-B", false], ["EVD-C", false]]);
  assert.deepEqual(subject.linkedEvidenceBoundary, reference.impactedSubjects![0].linkedEvidenceBoundary);
  assert.equal(subject.linkedEvidenceBoundary[0].fields.observation && (subject.linkedEvidenceBoundary[0].fields.observation as RecordFields).summary, EVD_A_NARROW.observation && (EVD_A_NARROW.observation as RecordFields).summary);
  assert.doesNotMatch(JSON.stringify(subject), /"status"|validation_status|evidence_status|created_at|digital_tractability/);
});

test("an impacted PRB keeps every authored text field verbatim under its canonical path, and its structured scope", () => {
  const subject = buildReducedReviewerInputPackage(narrowingChange()).impactedSubjects![0];
  assert.deepEqual(subject.authoredText, [
    { field: "title", text: "Atrasos na recolha de resíduos" },
    { field: "geography.area", text: "Évora" },
    { field: "affected_populations[0]", text: "residentes" },
    { field: "problem_statement", text: "Residentes de Évora relatam atrasos na recolha de resíduos." },
    { field: "investigation.open_questions[0].question", text: "A frequência contratual é cumprida?" },
    { field: "investigation.path.initial_signal.summary", text: "Relatos de residentes sobre atrasos." },
    { field: "decision_basis.contradiction_search.summary", text: "Procurou-se contradição no contrato." },
    { field: "decision_basis.scope.geography", text: "Évora" },
    { field: "decision_basis.scope.population", text: "residentes" },
    { field: "decision_basis.scope.temporal", text: "2025" },
  ]);
  assert.deepEqual(subject.structuredScope, [{ field: "geography.level", value: "municipality" }, { field: "decision_basis.scope.bounded", value: true }]);
});

test("EVD reference roles are preserved: support, boundary, contradiction search, investigation, with evidence[] effects", () => {
  const links = buildReducedReviewerInputPackage(narrowingChange()).impactedSubjects![0].evidenceLinks;
  assert.deepEqual(links, [
    {
      evidenceId: "EVD-A",
      references: [
        { field: "evidence[0].evidence_id", role: "EVIDENCE_RELATIONSHIP", relationship: { effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] } },
        { field: "decision_basis.supporting_evidence[0]", role: "SUPPORTING_EVIDENCE" },
        { field: "investigation.path.initial_signal.evidence[0]", role: "INVESTIGATION_PATH" },
      ],
    },
    {
      evidenceId: "EVD-B",
      references: [
        { field: "evidence[1].evidence_id", role: "EVIDENCE_RELATIONSHIP", relationship: { effects: ["SUPPORTS", "BOUNDS"], research_roles: ["LOCAL_OBSERVATION"] } },
        { field: "decision_basis.supporting_evidence[1]", role: "SUPPORTING_EVIDENCE" },
      ],
    },
    {
      evidenceId: "EVD-C",
      references: [
        { field: "decision_basis.contradiction_search.evidence[0]", role: "CONTRADICTION_SEARCH" },
        { field: "decision_basis.boundary_evidence[0]", role: "BOUNDARY_EVIDENCE" },
        { field: "investigation.open_questions[0].evidence[0]", role: "OPEN_QUESTION" },
      ],
    },
  ]);
});

test("a PRB-only change gets its linked boundaries and roles, but no Source, no support and no impacted subject", () => {
  const pkg = buildReducedReviewerInputPackage(change(corpus(), [prb({ ...PRB_A, title: "Atrasos frequentes na recolha" })]));
  const candidate = pkg.candidates[0];
  assert.deepEqual(candidate.changedPaths, ["title"]);
  assert.deepEqual(candidate.fields, { ...PRB_A, title: "Atrasos frequentes na recolha" });
  assert.deepEqual(candidate.linkedEvidenceBoundary?.map((b) => [b.evidenceId, b.changed]), [["EVD-A", false], ["EVD-B", false], ["EVD-C", false]]);
  assert.deepEqual(candidate.evidenceLinks?.map((l) => l.evidenceId), ["EVD-A", "EVD-B", "EVD-C"]);
  assert.deepEqual(pkg.sourceContext, []);
  assert.equal("sourceVerificationContext" in pkg, false);
  assert.equal("impactedSubjects" in pkg, false);
  assert.doesNotMatch(serializeReducedReviewerInput(pkg), /SRC-/);
  // Only the changed title's signal is mandatory; the unchanged population wording is not.
  assert.deepEqual(pkg.signals.map((g) => [g.code, g.field]), [[SIGNAL_CODE.VAGUE_FREQUENCY, "title"]]);
});

test("an SRC-only change carries the complete SRC and no PRB, EVD or other Source context", () => {
  const changed = source("SRC-A", { caveats: ["Outra ressalva."] });
  const pkg = buildReducedReviewerInputPackage(change(corpus(), [src(changed)]));
  assert.deepEqual(pkg.candidates.map((c) => [c.id, c.changedPaths]), [["SRC-A", ["caveats[0]"]]]);
  assert.deepEqual(pkg.candidates[0].fields, changed);
  assert.deepEqual(pkg.sourceContext, []);
  assert.equal("impactedSubjects" in pkg, false);
  assert.doesNotMatch(serializeReducedReviewerInput(pkg), /PRB-|EVD-/);
});

test("an EVD no PRB links has no impacted subject", () => {
  const pkg = buildReducedReviewerInputPackage(change(corpus(), [evd(evidence("EVD-N", "Nova observação.", { geography: { level: "city" } }, ["SRC-A"]), "CREATE")]));
  assert.equal("impactedSubjects" in pkg, false);
  assert.deepEqual(pkg.sourceContext.map((s) => s.sourceId), ["SRC-A"]);
});

test("reference occurrences cover exactly the EVD IDs reverse impact derives, for every canonical PRB", () => {
  const index = loadCorpusIndex(resolve(dirname(fileURLToPath(import.meta.url)), "../../../research"));
  const problems = index.byPrefix.get("PRB-")!;
  assert.ok(problems.records.length > 0);
  for (const record of problems.records) {
    const ids = [...new Set(problemEvidenceReferences(problems, record.fields).map((r) => r.evidenceId))].sort();
    assert.deepEqual(ids, problemEvidenceReferenceIds(problems, record.fields), record.file);
  }
});

// ---------------------------------------------------------------------------
// Required semantic regressions

test("A. broad→narrow: the unchanged PRB is a subject with its scope groups, and a blocking finding against it validates", () => {
  const pkg = buildReducedReviewerInputPackage(broadToNarrow());
  const subject = pkg.impactedSubjects![0];
  assert.equal(subject.id, "PRB-A");
  assert.deepEqual(subject.linkedEvidenceBoundary.map((b) => [b.evidenceId, b.changed]), [["EVD-A", true], ["EVD-C", false]]);
  // Only FZ-01 scope/layer groups are mandatory for an unchanged impacted PRB: no GENERIC_POPULATION.
  const codes = new Set(pkg.signals.map((g) => g.code));
  assert.ok(codes.has(SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE));
  assert.ok(codes.has(SIGNAL_CODE.PRB_GEOGRAPHY_BROADER_THAN_EVIDENCE));
  assert.ok(!codes.has(SIGNAL_CODE.GENERIC_POPULATION));
  assert.ok(buildReviewerInputPackage(broadToNarrow()).signals.some(({ signal }) => signal.code === SIGNAL_CODE.GENERIC_POPULATION));

  const geographic = pkg.signals.find((g) => g.code === SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE && g.field === "problem_statement")!;
  const review = notApplicable(pkg);
  review.outcome = "DISAGREEMENT_FOUND";
  review.findings = [finding("PRB-A", "problem_statement", "Residentes de Évora", ["EVD-A"], [geographic.signalId])];
  review.signalDispositions = review.signalDispositions.map((d) =>
    d.signalId === geographic.signalId ? { ...d, disposition: "VIOLATION", reason: "A EVD-A revista limita-se à Malagueira.", evidenceReferences: ["EVD-A"], relatedFindingIds: ["CLEC-FND-0001"] } : d
  );
  assert.deepEqual(validateReducedIndependentReview(review, pkg).errors, []);
  // A CONCUR that omits one group's disposition fails.
  const missing = notApplicable(pkg);
  missing.signalDispositions.pop();
  assert.ok(validateReducedIndependentReview(missing, pkg).errors.some((e) => /has no disposition/.test(e)));
});

test("B. another linked EVD still supporting the wording stays in the package, and tooling declares nothing", () => {
  const pkg = buildReducedReviewerInputPackage(narrowingChange());
  const boundary = pkg.impactedSubjects![0].linkedEvidenceBoundary.find((b) => b.evidenceId === "EVD-B")!;
  assert.equal(boundary.changed, false);
  assert.deepEqual(boundary.fields.scope, EVD_B.scope);
  // EVD-B carries "Évora" and "residentes": no scope signal, so no deterministic violation.
  assert.deepEqual(pkg.signals, []);
  assert.deepEqual(validateReducedIndependentReview(notApplicable(pkg), pkg).errors, []);
});

test("C. a PRB→EVD mismatch with no lexical signal is still exposed, and a blocking finding against it validates", () => {
  const before = evidence("EVD-A", "Residentes de Évora relatam atrasos na recolha de resíduos orgânicos em 2025.", EVD_A_BROAD.scope as RecordFields, ["SRC-A"]);
  const after = evidence("EVD-A", "Residentes de Évora relatam atrasos na recolha de vidro em 2025.", EVD_A_BROAD.scope as RecordFields, ["SRC-A"]);
  const organic = problem("PRB-O", "Há atrasos na recolha de resíduos orgânicos em Évora.", [{ evidence_id: "EVD-A", effects: ["SUPPORTS"] }]);
  const source = change(corpus({ evidence: [before, EVD_B, EVD_C, EVD_UNRELATED], problems: [organic, PRB_UNRELATED] }), [evd(after)]);
  const pkg = buildReducedReviewerInputPackage(source);
  assert.deepEqual(pkg.signals, []);
  const subject = pkg.impactedSubjects![0];
  assert.ok(subject.authoredText.some((t) => t.field === "problem_statement" && t.text === "Há atrasos na recolha de resíduos orgânicos em Évora."));
  assert.equal((subject.linkedEvidenceBoundary[0].fields.observation as RecordFields).summary, "Residentes de Évora relatam atrasos na recolha de vidro em 2025.");

  const review = notApplicable(pkg);
  review.outcome = "DISAGREEMENT_FOUND";
  review.findings = [{ ...finding("PRB-O", "problem_statement", "resíduos orgânicos", ["EVD-A"]), dimension: "evidence_fidelity" }];
  assert.deepEqual(validateReducedIndependentReview(review, pkg).errors, []);
  // The claim must still be verbatim in that exact authored field.
  review.findings = [finding("PRB-O", "problem_statement", "resíduos de vidro", ["EVD-A"])];
  assert.ok(validateReducedIndependentReview(review, pkg).errors.some((e) => /does not occur verbatim/.test(e)));
  review.findings = [finding("PRB-O", "status", "OPEN", ["EVD-A"])];
  assert.ok(validateReducedIndependentReview(review, pkg).errors.some((e) => /is not an authored text field/.test(e)));
});

test("D. an impacted PRB can never cite SRC, Source context, support, an unlinked EVD or inference_limits as support", () => {
  const pkg = buildReducedReviewerInputPackage(broadToNarrow());
  const geographic = pkg.signals.find((g) => g.code === SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE)!;
  const supported = (evidenceReferences: string[]) => {
    const review = notApplicable(pkg);
    review.signalDispositions = review.signalDispositions.map((d) => (d.signalId === geographic.signalId ? { ...d, disposition: "SUPPORTED", evidenceReferences } : d));
    return validateReducedIndependentReview(review, pkg).errors;
  };
  // SRC-A is in the package (Source context and support of the changed EVD), but not available to PRB-A.
  assert.ok(pkg.sourceContext.some((s) => s.sourceId === "SRC-A") && pkg.sourceVerificationContext?.some((s) => s.source_id === "SRC-A"));
  assert.ok(supported(["SRC-A"]).some((e) => /not a record available to review subject "PRB-A"/.test(e)));
  assert.ok(supported(["SRC-A"]).some((e) => /cites no EVD linked by PRB-A/.test(e)));
  // EVD-C is linked only as boundary Evidence, and carries the term only where the predicate reads it as not supporting.
  assert.ok(supported(["EVD-C"]).some((e) => /cites no EVD linked by PRB-A/.test(e)));
  assert.ok(supported(["EVD-U"]).some((e) => /not a record available/.test(e)));
  // A finding on the impacted PRB cannot cite the changed EVD's Source either.
  const review = notApplicable(pkg);
  review.outcome = "DISAGREEMENT_FOUND";
  review.findings = [finding("PRB-A", "problem_statement", "Évora", ["SRC-A"])];
  assert.ok(validateReducedIndependentReview(review, pkg).errors.some((e) => /not a record available to review subject "PRB-A"/.test(e)));

  // A term present only in a linked EVD's inference_limits never supports it.
  const limitsOnly = evidence("EVD-A", "Moradores da Malagueira relatam atrasos.", { geography: { level: "local_area", area: "Malagueira" } }, ["SRC-A"], { inference_limits: ["Não abrange Évora."] });
  const limited = buildReducedReviewerInputPackage(change(corpus({ problems: [PRB_A_ONLY, PRB_UNRELATED] }), [evd(limitsOnly)]));
  const evora = limited.signals.find((g) => g.code === SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE && g.occurrences.some((o) => o.match === "Évora"))!;
  const limitedReview = notApplicable(limited);
  limitedReview.signalDispositions = limitedReview.signalDispositions.map((d) => (d.signalId === evora.signalId ? { ...d, disposition: "SUPPORTED", evidenceReferences: ["EVD-A"] } : d));
  assert.ok(validateReducedIndependentReview(limitedReview, limited).errors.some((e) => /cites no EVD linked by PRB-A/.test(e)));
});

test("E. an unrelated unchanged PRB is never reviewable", () => {
  const pkg = buildReducedReviewerInputPackage(broadToNarrow());
  const review = notApplicable(pkg);
  review.outcome = "DISAGREEMENT_FOUND";
  review.findings = [finding("PRB-U", "problem_statement", "Outro problema", ["EVD-U"])];
  const errors = validateReducedIndependentReview(review, pkg).errors;
  assert.ok(errors.some((e) => /recordId must name a candidate record, got "PRB-U"/.test(e)));
  assert.ok(errors.some((e) => /not a record available to review subject "PRB-U"/.test(e)));
});

// ---------------------------------------------------------------------------
// Signal relevance

test("a changed PRB that a changed EVD also reaches keeps its changed-field signals and every scope signal, once each", () => {
  const changedPrb = { ...PRB_A_ONLY, title: "Atrasos frequentes na recolha" };
  const derivation = deriveReducedSignals(broadToNarrow([prb(changedPrb)]));
  const pkg = buildReducedReviewerInputPackage(broadToNarrow([prb(changedPrb)]));
  assert.equal("impactedSubjects" in pkg, false);
  const fields = pkg.signals.map((g) => `${g.code}:${g.field}`);
  assert.ok(fields.includes("VAGUE_FREQUENCY:title"));
  assert.ok(fields.includes("PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE:problem_statement"));
  assert.ok(fields.includes("PRB_GEOGRAPHY_BROADER_THAN_EVIDENCE:geography.level"));
  assert.ok(!fields.some((f) => f.startsWith("GENERIC_POPULATION")));
  const occurrences = pkg.signals.flatMap((g) => g.occurrences.map((o) => o.occurrenceId));
  assert.equal(new Set(occurrences).size, occurrences.length);
  assert.equal(occurrences.length, derivation.mandatory.length);
});

test("a signal context made newly applicable stays mandatory although its own field is unchanged", () => {
  const factual = evidence("EVD-A", "Há atrasos na recolha de resíduos.", EVD_A_BROAD.scope as RecordFields, ["SRC-A"], { evidence_nature: "fact" });
  const reported = { ...factual, evidence_nature: "reported-experience" };
  const pkg = buildReducedReviewerInputPackage(change(corpus({ evidence: [factual, EVD_B, EVD_C, EVD_UNRELATED] }), [evd(reported)]));
  assert.deepEqual(pkg.candidates[0].changedPaths, ["evidence_nature"]);
  assert.deepEqual(pkg.signals.map((g) => [g.code, g.subjectId, g.field]), [[SIGNAL_CODE.EVD_ATTRIBUTION_ABSENT, "EVD-A", "observation.summary"]]);
});

test("every signal of a CREATE candidate is mandatory", () => {
  const created = problem("PRB-N", "Muitos residentes referem atrasos frequentes.", [{ evidence_id: "EVD-B", effects: ["SUPPORTS"] }]);
  const source = change(corpus(), [prb(created, "CREATE")]);
  const { detected, mandatory } = deriveReducedSignals(source);
  assert.ok(detected.length > 0);
  assert.deepEqual(mandatory, detected);
});

// ---------------------------------------------------------------------------
// Grouping

test("signals group by record, field, code and folded wording, keeping every exact occurrence in order", () => {
  const g = problem("PRB-G", "Frequentes atrasos e falhas frequentes; recorrentes queixas.", [{ evidence_id: "EVD-B", effects: ["SUPPORTS"] }], {
    title: "Atrasos frequentes",
    investigation: { open_questions: [{ question: "Os atrasos são frequentes?", evidence: ["EVD-B", "EVD-C"] }] },
  });
  const h = problem("PRB-H", "Atrasos frequentes.", [{ evidence_id: "EVD-B", effects: ["SUPPORTS"] }]);
  const source = change(corpus(), [prb(g, "CREATE"), prb(h, "CREATE")]);
  const pkg = buildReducedReviewerInputPackage(source);
  const frequency = pkg.signals.filter((group) => group.code === SIGNAL_CODE.VAGUE_FREQUENCY);
  assert.deepEqual(
    frequency.map((group) => [group.subjectId, group.field, group.occurrences.map((o) => o.match)]),
    [
      ["PRB-G", "title", ["frequentes"]],
      ["PRB-G", "problem_statement", ["Frequentes", "frequentes"]],
      ["PRB-G", "problem_statement", ["recorrentes"]],
      ["PRB-G", "investigation.open_questions[0].question", ["frequentes"]],
      ["PRB-H", "problem_statement", ["frequentes"]],
    ]
  );
  // Exact excerpts, matches and evidence references survive, with traceable occurrence identities.
  const { detected } = deriveReducedSignals(source);
  const byOccurrence = new Map(detected.map(({ signalId, signal }) => [signalId.replace("CLEC-SIG-", "CLEC-OCC-"), signal]));
  for (const group of pkg.signals) {
    for (const occurrence of group.occurrences) {
      const signal = byOccurrence.get(occurrence.occurrenceId)!;
      assert.deepEqual([signal.subjectId, signal.field, signal.code], [group.subjectId, group.field, group.code]);
      assert.equal(occurrence.excerpt, signal.excerpt);
      assert.equal(occurrence.match, signal.match);
      assert.deepEqual(occurrence.evidenceReferences, signal.evidenceReferences);
    }
  }
  assert.deepEqual(frequency[3].occurrences[0].evidenceReferences, ["EVD-B", "EVD-C"]);
  // Group IDs are sequential in first-occurrence order and reproducible.
  assert.deepEqual(pkg.signals.map((group) => group.signalId), pkg.signals.map((_, i) => `CLEC-SIG-${String(i + 1).padStart(4, "0")}`));
  const firsts = pkg.signals.map((group) => group.occurrences[0].occurrenceId);
  assert.deepEqual(firsts, [...firsts].sort());
  assert.equal(serializeReducedReviewerInput(buildReducedReviewerInputPackage(source)), serializeReducedReviewerInput(pkg));
  assert.equal(pkg.signals.reduce((n, group) => n + group.occurrences.length, 0), detected.length);
});

test("one disposition per group: missing, duplicate and unknown group dispositions fail", () => {
  const g = problem("PRB-G", "Frequentes atrasos e falhas frequentes.", [{ evidence_id: "EVD-B", effects: ["SUPPORTS"] }]);
  const pkg = buildReducedReviewerInputPackage(change(corpus(), [prb(g, "CREATE")]));
  const valid = notApplicable(pkg);
  assert.deepEqual(validateReducedIndependentReview(valid, pkg).errors, []);
  assert.ok(pkg.signals.some((group) => group.occurrences.length > 1));

  const missing = notApplicable(pkg);
  missing.signalDispositions.shift();
  assert.ok(validateReducedIndependentReview(missing, pkg).errors.some((e) => /has no disposition/.test(e)));
  const duplicate = notApplicable(pkg);
  duplicate.signalDispositions.push({ ...duplicate.signalDispositions[0] });
  assert.ok(validateReducedIndependentReview(duplicate, pkg).errors.some((e) => /more than one disposition/.test(e)));
  const unknown = notApplicable(pkg);
  unknown.signalDispositions.push({ ...unknown.signalDispositions[0], signalId: "CLEC-SIG-9999" });
  assert.ok(validateReducedIndependentReview(unknown, pkg).errors.some((e) => /CLEC-SIG-9999 is not a signal in the review input/.test(e)));
  // Occurrence IDs are not dispositionable units.
  const occurrence = notApplicable(pkg);
  occurrence.signalDispositions[0] = { ...occurrence.signalDispositions[0], signalId: pkg.signals[0].occurrences[0].occurrenceId };
  assert.ok(validateReducedIndependentReview(occurrence, pkg).errors.length > 0);
});

test("finding↔group linkage stays bidirectional, subject-bound and outcome-consistent", () => {
  const pkg = buildReducedReviewerInputPackage(broadToNarrow());
  const group = pkg.signals.find((g) => g.code === SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE)!;
  const review = notApplicable(pkg);
  review.outcome = "DISAGREEMENT_FOUND";
  review.findings = [finding("PRB-A", "problem_statement", "Évora", ["EVD-A"], [group.signalId])];
  // The group's disposition does not link back: rejected.
  assert.ok(validateReducedIndependentReview(review, pkg).errors.some((e) => /does not link the finding/.test(e)));
  // A wrong outcome is rejected.
  review.outcome = "CONCUR";
  review.findings = [finding("PRB-A", "problem_statement", "Évora", ["EVD-A"])];
  assert.ok(validateReducedIndependentReview(review, pkg).errors.some((e) => /inconsistent/.test(e)));
  // An advisory evidence gap is rejected.
  review.outcome = "INSUFFICIENT_EVIDENCE";
  review.findings = [{ ...finding("PRB-A", "problem_statement", "Évora", ["EVD-A"]), kind: "INSUFFICIENT_EVIDENCE", severity: "ADVISORY" }];
  assert.ok(validateReducedIndependentReview(review, pkg).errors.some((e) => /must be BLOCKING/.test(e)));
});

test("reference validation is unchanged: a reduced review never validates against the reference package by accident of shape", () => {
  const reference = buildReviewerInputPackage(narrowingChange());
  const review = { schemaVersion: "2", outcome: "CONCUR", rationale: "r", findings: [], signalDispositions: reference.signals.map(({ signalId }) => ({ signalId, disposition: "NOT_APPLICABLE", reason: "r", evidenceReferences: [], relatedFindingIds: [] })) };
  assert.deepEqual(validateIndependentReview(review, reference).errors, []);
  // The reduced package for the same change has no group for those incidental signals, so the same review fails there.
  const reduced = buildReducedReviewerInputPackage(narrowingChange());
  assert.ok(validateReducedIndependentReview(review, reduced).errors.some((e) => /is not a signal in the review input/.test(e)));
});

// ---------------------------------------------------------------------------
// Context-free blockers use full detection

test("a context-free blocker in an unchanged field of a changed EVD or SRC still fails before any reduced package exists", () => {
  const leaky = evidence("EVD-A", "Residentes de Évora relatam atrasos.", EVD_A_BROAD.scope as RecordFields, ["SRC-A"], { inference_limits: ["Ver PRB-0001."] });
  const evdSource = change(corpus({ evidence: [leaky, EVD_B, EVD_C, EVD_UNRELATED] }), [evd({ ...leaky, observation: { summary: "Residentes de Évora relatam atrasos em 2025." } })]);
  const { detected, mandatory } = deriveReducedSignals(evdSource);
  assert.ok(detected.some(({ signal }) => signal.code === SIGNAL_CODE.PRB_ID_IN_EVD_TEXT));
  assert.ok(!mandatory.some(({ signal }) => CONTEXT_FREE_BLOCKING_CODES.has(signal.code)));
  assert.throws(() => buildReducedReviewerInputPackage(evdSource), (error: unknown) => error instanceof ReducedReviewContextFreeBlockError && error.blockers.length === 1 && /PRB_ID_IN_EVD_TEXT EVD-A inference_limits\[0\]/.test(error.message));

  const leakySource = source("SRC-A", { caveats: ["Relacionada com EVD-000001."] });
  const srcSource = change(corpus({ sources: [leakySource, source("SRC-B"), source("SRC-C"), source("SRC-U")] }), [src({ ...leakySource, name: "Relatório revisto" })]);
  assert.ok(!deriveReducedSignals(srcSource).mandatory.some(({ signal }) => CONTEXT_FREE_BLOCKING_CODES.has(signal.code)));
  assert.throws(() => buildReducedReviewerInputPackage(srcSource), (error: unknown) => error instanceof ReducedReviewContextFreeBlockError && /SRC_RECORD_ID_IN_TEXT SRC-A caveats\[0\]/.test(error.message));
});

// ---------------------------------------------------------------------------
// Prompt

test("the reduced prompt states the reduced contract and derives eligibility from the reduced package only", () => {
  const pkg = buildReducedReviewerInputPackage(narrowingChange());
  const json = serializeReducedReviewerInput(pkg);
  const prompt = buildReducedReviewerPrompt(json);
  assert.ok(prompt.includes(`REVIEW INPUT (immutable, JSON):\n${json}\n`));
  for (const required of [
    "complete canonical candidate value",
    "never limit review",
    "unchanged PRBs",
    "Judge each impacted PRB against all of its linked EVD boundaries",
    "A reference is not positive support for every PRB claim",
    "never widen it and never support PRB wording",
    "one or more exact \"occurrences\"",
    "exactly one disposition per group",
    "the absence of a signal never prevents a finding",
  ]) assert.ok(prompt.includes(required), required);
  assert.match(prompt, /SOURCE VERIFICATION ELIGIBILITY[^\n]*\n- SRC-A: SOURCE_VERIFICATION_ELIGIBLE\n\n/);
  assert.equal(buildReducedReviewerPrompt(json), prompt);
  assert.ok(buildReviewerStructuralRetryPrompt(prompt, ["e"]).startsWith(prompt));
});
