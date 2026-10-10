import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { CorpusIndex, RecordIndex, RecordSchema } from "../core/types.ts";
import type { CandidateRecord } from "../integration/candidate-delta.ts";
import type { AiInvocationRequest, AiInvocationResult, AiInvoker } from "./ai-invoker.ts";
import { invokeIndependentReview } from "./independent-review-invocation.ts";
import { candidateFieldsById, validateIndependentReview, validateIndependentReviewStructure } from "./independent-review.ts";
import { buildReviewerInputPackage, reviewSourceEligibility, serializeReviewerInput, type ReviewerInputPackage } from "./reviewer-input.ts";
import { buildReviewerPrompt } from "./reviewer-prompt.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

const SOURCE_SCHEMA: RecordSchema = { prefix: "SRC-", directory: "sources", idField: "source_id" };
const EVIDENCE_SCHEMA: RecordSchema = {
  prefix: "EVD-",
  directory: "evidence",
  idField: "evidence_id",
  references: [{ field: "provenance.sources", isList: true, targetPrefix: "SRC-", targetDirectory: "sources", required: true }],
};

const SUMMARY = "O relatório indica que muitas comunicações diziam respeito a horários.";

/**
 * A Source-dependent EVD candidate: its observation carries a quantity term
 * whose fidelity depends on Source content, while the referenced SRC record
 * holds only provenance metadata.
 */
function sourceDependentPackage(): ReviewerInputPackage {
  const source = { source_id: "SRC-0001", name: "Relatório anual", publisher: "Entidade pública" };
  const index: CorpusIndex = {
    researchRoot: "/synthetic",
    totalRecords: 1,
    byPrefix: new Map([
      ["SRC-", { schema: SOURCE_SCHEMA, records: [{ file: "sources/SRC-0001.yaml", fields: source }], byId: new Map([["SRC-0001", { file: "sources/SRC-0001.yaml", fields: source }]]) }],
      ["EVD-", { schema: EVIDENCE_SCHEMA, records: [], byId: new Map() }],
    ]),
  };
  const candidate = {
    recordFamily: "EVD-",
    fields: {
      evidence_id: "EVD-NEW",
      provenance: { sources: ["SRC-0001"] },
      observation: { summary: SUMMARY },
      evidence_nature: "measurement",
      claim_authority: "authoritative",
      inference_limits: ["As comunicações não estabelecem prevalência."],
    },
  };
  return buildReviewerInputPackage({
    baseGitSha: SHA,
    manifest: { schemaVersion: "1", mode: "daily-discovery", investigationQuestion: "q", candidateFiles: ["EVD-NEW.yaml"], claimedRecordIds: ["EVD-NEW"], rationale: "r" },
    index,
    candidates: [candidate],
    deltas: [{ recordFamily: "EVD-", id: "EVD-NEW", action: "CREATE" }],
    validation: { errors: [], totalRecords: 2 },
    readiness: "READY_FOR_INTEGRATION_GATE",
    sourceVerifications: { bySourceId: new Map(), issues: [] },
  });
}

const PKG = sourceDependentPackage();
const SIGNAL_ID = "CLEC-SIG-0001";

type Review = Record<string, unknown> & { findings: Record<string, unknown>[]; signalDispositions: Record<string, unknown>[] };

function gapFinding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    findingId: "CLEC-FND-0001",
    recordId: "EVD-NEW",
    field: "observation.summary",
    claim: "muitas comunicações",
    dimension: "supported_quantity",
    kind: "INSUFFICIENT_EVIDENCE",
    severity: "BLOCKING",
    reason: "SRC-0001 records provenance only; the package cannot show whether the Source supports 'muitas'.",
    evidenceReferences: ["SRC-0001"],
    correctionDirection: "Confirm the quantity against the Source and keep the Source's own figure or wording.",
    relatedSignalIds: [SIGNAL_ID],
    ...overrides,
  };
}

function violationFinding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return gapFinding({
    findingId: "CLEC-FND-0002",
    claim: "diziam respeito a horários",
    dimension: "explicit_scope",
    kind: "CLEC_VIOLATION",
    reason: "The inference limits bound the communications, but the summary states the topic without that bound.",
    evidenceReferences: ["EVD-NEW"],
    correctionDirection: "State the period and population the communications cover.",
    relatedSignalIds: [],
    ...overrides,
  });
}

function disposition(value: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    signalId: SIGNAL_ID,
    disposition: value,
    reason: "Reviewed against the supplied evidence context.",
    evidenceReferences: ["SRC-0001"],
    relatedFindingIds: [],
    ...overrides,
  };
}

/** The correct review for the Source-dependent case: the signal is relevant but cannot be decided. */
function insufficientReview(): Review {
  return {
    schemaVersion: "2",
    outcome: "INSUFFICIENT_EVIDENCE",
    rationale: "The quantity term depends on Source content the package does not contain.",
    findings: [gapFinding()],
    signalDispositions: [disposition("INSUFFICIENT_EVIDENCE", { relatedFindingIds: ["CLEC-FND-0001"] })],
  };
}

function errorsOf(review: unknown): string {
  return validateIndependentReview(review, PKG).errors.join("\n");
}

class RecordingReviewer implements AiInvoker {
  readonly calls: AiInvocationRequest[] = [];
  private readonly responses: AiInvocationResult[];
  constructor(responses: AiInvocationResult[]) { this.responses = responses; }
  invoke(request: AiInvocationRequest): AiInvocationResult {
    this.calls.push(request);
    const response = this.responses.shift();
    assert.ok(response, "unexpected reviewer invocation");
    return response;
  }
}

function withReviewWorkbench(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-independent-review-test-"));
  try { run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

const output = (value: unknown): AiInvocationResult => ({ status: "OK", stdout: JSON.stringify(value) });
const validConcur = (): Review => ({ ...insufficientReview(), outcome: "CONCUR", findings: [], signalDispositions: [disposition("SUPPORTED")] });
const emptyFindingReferences = (): Review => ({ ...insufficientReview(), findings: [gapFinding({ evidenceReferences: [] })] });

test("a valid review of any outcome is accepted after one invocation", () => {
  const disagreement: Review = {
    ...insufficientReview(), outcome: "DISAGREEMENT_FOUND",
    findings: [violationFinding({ relatedSignalIds: [SIGNAL_ID] })],
    signalDispositions: [disposition("VIOLATION", { relatedFindingIds: ["CLEC-FND-0002"] })],
  };
  for (const review of [validConcur(), disagreement, insufficientReview()]) {
    withReviewWorkbench((dir) => {
      const invoker = new RecordingReviewer([output(review)]);
      const result = invokeIndependentReview(invoker, PKG, dir);
      assert.equal(result.status, "VALID");
      if (result.status === "VALID") assert.deepEqual(result.review, review);
      assert.equal(invoker.calls.length, 1);
      assert.equal(invoker.calls[0].role, "INDEPENDENT_REVIEWER");
      assert.equal(existsSync(join(dir, "independent-review-attempt-2.stdout.txt")), false);
    });
  }
});

test("a finding with no evidence reference gets one fresh structural retry over unchanged input", () => {
  withReviewWorkbench((dir) => {
    const first = emptyFindingReferences();
    const invoker = new RecordingReviewer([output(first), output(validConcur())]);
    const result = invokeIndependentReview(invoker, PKG, dir);
    assert.equal(result.status, "VALID");
    if (result.status === "VALID") assert.equal(result.review.outcome, "CONCUR");
    assert.equal(invoker.calls.length, 2);
    const original = invoker.calls[0].input;
    const retry = invoker.calls[1].input;
    assert.ok(retry.startsWith(`${original}\n`), "the original contract and immutable reviewer input remain byte-identical");
    const feedback = retry.slice(original.length);
    assert.match(feedback, /findings\[0\]\.evidenceReferences must name at least one record/);
    assert.match(feedback, /complete replacement JSON review object/);
    assert.equal(feedback.includes(JSON.stringify(first)), false, "the first review is not returned as new semantic context");
    assert.equal(readFileSync(join(dir, "independent-review-attempt-1.stdout.txt"), "utf8"), JSON.stringify(first));
    assert.match(readFileSync(join(dir, "independent-review-attempt-1.errors.txt"), "utf8"), /evidenceReferences must name at least one record/);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "independent-review-attempt-2.stdout.txt"), "utf8")), validConcur());
    assert.equal(existsSync(join(dir, "independent-review-attempt-2.errors.txt")), false);
  });
});

test("two structurally invalid reviews fail closed after exactly two invocations", () => {
  withReviewWorkbench((dir) => {
    const invoker = new RecordingReviewer([output(emptyFindingReferences()), output(emptyFindingReferences())]);
    const result = invokeIndependentReview(invoker, PKG, dir);
    assert.equal(result.status, "FAILED");
    if (result.status === "FAILED") {
      assert.equal(result.failedCheck, "INDEPENDENT_REVIEW_OUTPUT_INVALID");
      assert.match(result.message, /evidenceReferences must name at least one record/);
    }
    assert.equal(invoker.calls.length, 2);
    assert.match(readFileSync(join(dir, "independent-review-attempt-2.errors.txt"), "utf8"), /evidenceReferences must name at least one record/);
    assert.equal(existsSync(join(dir, "independent-review.json")), false);
  });
});

test("timeout, invocation failure, and non-JSON stdout do not trigger a structural retry", () => {
  const failures: AiInvocationResult[] = [
    { status: "TIMEOUT", message: "timed out" },
    { status: "INVOCATION_FAILED", message: "process failed" },
    { status: "OK", stdout: "not JSON" },
  ];
  for (const failure of failures) withReviewWorkbench((dir) => {
    const invoker = new RecordingReviewer([failure]);
    const result = invokeIndependentReview(invoker, PKG, dir);
    assert.equal(result.status, "FAILED");
    assert.equal(invoker.calls.length, 1);
    assert.equal(existsSync(join(dir, "independent-review.json")), false);
    assert.equal(existsSync(join(dir, "independent-review-attempt-2.stdout.txt")), false);
  });
});

test("the Source-dependent EVD fixture yields one quantity signal referencing only the metadata SRC", () => {
  assert.equal(PKG.signals.length, 1);
  assert.equal(PKG.signals[0].signalId, SIGNAL_ID);
  assert.equal(PKG.signals[0].signal.code, "VAGUE_QUANTITY");
  assert.deepEqual(PKG.signals[0].signal.evidenceReferences, ["SRC-0001"]);
  assert.deepEqual(PKG.evidenceContext.map((r) => r.id), ["SRC-0001"]);
});

test("a Source-dependent signal dispositioned INSUFFICIENT_EVIDENCE with a linked evidence-gap finding is accepted", () => {
  assert.deepEqual(validateIndependentReview(insufficientReview(), PKG).errors, []);
});

test("valid CONCUR and DISAGREEMENT_FOUND structured reviews are accepted", () => {
  const concur = { ...insufficientReview(), outcome: "CONCUR", findings: [], signalDispositions: [disposition("SUPPORTED")] };
  assert.deepEqual(validateIndependentReview(concur, PKG).errors, []);

  const disagreement = {
    ...insufficientReview(),
    outcome: "DISAGREEMENT_FOUND",
    findings: [violationFinding({ relatedSignalIds: [SIGNAL_ID] })],
    signalDispositions: [disposition("VIOLATION", { relatedFindingIds: ["CLEC-FND-0002"] })],
  };
  assert.deepEqual(validateIndependentReview(disagreement, PKG).errors, []);
});

test("SUPPORTED cannot coexist with an evidence-gap finding on the same signal, nor cite no evidence", () => {
  const linkedGap = insufficientReview();
  linkedGap.signalDispositions = [disposition("SUPPORTED", { relatedFindingIds: ["CLEC-FND-0001"] })];
  assert.match(errorsOf(linkedGap), /SUPPORTED and must not link findings/);

  const gapStillListsSignal = insufficientReview();
  gapStillListsSignal.signalDispositions = [disposition("SUPPORTED")];
  assert.match(errorsOf(gapStillListsSignal), /does not link the finding/);

  const noEvidence = { ...insufficientReview(), outcome: "CONCUR", findings: [], signalDispositions: [disposition("SUPPORTED", { evidenceReferences: [] })] };
  assert.match(errorsOf(noEvidence), /SUPPORTED but names no evidence/);
});

test("NOT_APPLICABLE linked to an evidence-gap finding is rejected as inconsistent", () => {
  const review = insufficientReview();
  review.signalDispositions = [disposition("NOT_APPLICABLE", { relatedFindingIds: ["CLEC-FND-0001"] })];
  assert.match(errorsOf(review), /NOT_APPLICABLE and must not link findings/);
});

test("an INSUFFICIENT_EVIDENCE disposition without a matching evidence-gap finding is rejected", () => {
  const unlinked = insufficientReview();
  unlinked.findings = [gapFinding({ relatedSignalIds: [] })];
  unlinked.signalDispositions = [disposition("INSUFFICIENT_EVIDENCE")];
  assert.match(errorsOf(unlinked), /INSUFFICIENT_EVIDENCE but links no INSUFFICIENT_EVIDENCE finding/);

  const wrongKind = insufficientReview();
  wrongKind.findings = [violationFinding({ relatedSignalIds: [SIGNAL_ID], severity: "ADVISORY" })];
  wrongKind.signalDispositions = [disposition("INSUFFICIENT_EVIDENCE", { relatedFindingIds: ["CLEC-FND-0002"] })];
  assert.match(errorsOf(wrongKind), /INSUFFICIENT_EVIDENCE but links no INSUFFICIENT_EVIDENCE finding/);
});

test("an evidence gap without a blocking violation requires the INSUFFICIENT_EVIDENCE outcome", () => {
  for (const outcome of ["CONCUR", "DISAGREEMENT_FOUND"]) {
    assert.match(errorsOf({ ...insufficientReview(), outcome }), /require INSUFFICIENT_EVIDENCE/);
  }
  const advisoryGap = insufficientReview();
  advisoryGap.findings = [gapFinding({ severity: "ADVISORY" })];
  assert.match(errorsOf(advisoryGap), /must be BLOCKING for an INSUFFICIENT_EVIDENCE finding/);
});

test("a blocking violation alongside an evidence gap requires DISAGREEMENT_FOUND and keeps the gap", () => {
  const review = insufficientReview();
  review.findings.push(violationFinding());
  assert.match(errorsOf(review), /require DISAGREEMENT_FOUND/);
  assert.deepEqual(validateIndependentReview({ ...review, outcome: "DISAGREEMENT_FOUND" }, PKG).errors, []);
});

test("CONCUR is rejected with any INSUFFICIENT_EVIDENCE or VIOLATION disposition or any blocking violation", () => {
  assert.match(errorsOf({ ...insufficientReview(), outcome: "CONCUR" }), /CONCUR is inconsistent/);

  const violation = {
    ...insufficientReview(),
    outcome: "CONCUR",
    findings: [violationFinding({ relatedSignalIds: [SIGNAL_ID], severity: "ADVISORY" })],
    signalDispositions: [disposition("VIOLATION", { relatedFindingIds: ["CLEC-FND-0002"] })],
  };
  assert.match(errorsOf(violation), /require DISAGREEMENT_FOUND/);

  const blocking = { ...insufficientReview(), outcome: "CONCUR", findings: [violationFinding()], signalDispositions: [disposition("SUPPORTED")] };
  assert.match(errorsOf(blocking), /require DISAGREEMENT_FOUND/);

  const advisoryOnly = { ...blocking, findings: [violationFinding({ severity: "ADVISORY" })] };
  assert.deepEqual(validateIndependentReview(advisoryOnly, PKG).errors, []);
});

test("a VIOLATION disposition must link a CLEC_VIOLATION finding", () => {
  const review = { ...insufficientReview(), outcome: "DISAGREEMENT_FOUND", signalDispositions: [disposition("VIOLATION", { relatedFindingIds: ["CLEC-FND-0001"] })] };
  assert.match(errorsOf(review), /VIOLATION but links no CLEC_VIOLATION finding/);
});

test("every supplied signal needs exactly one disposition, and unknown signals are rejected", () => {
  assert.match(errorsOf({ ...insufficientReview(), findings: [gapFinding({ relatedSignalIds: [] })], signalDispositions: [] }), /signal CLEC-SIG-0001 has no disposition/);

  const duplicate = insufficientReview();
  duplicate.signalDispositions.push(disposition("INSUFFICIENT_EVIDENCE", { relatedFindingIds: ["CLEC-FND-0001"] }));
  assert.match(errorsOf(duplicate), /more than one disposition for CLEC-SIG-0001/);

  const unknown = insufficientReview();
  unknown.signalDispositions.push(disposition("NOT_APPLICABLE", { signalId: "CLEC-SIG-0002" }));
  assert.match(errorsOf(unknown), /CLEC-SIG-0002 is not a signal in the review input/);

  const unknownFromFinding = insufficientReview();
  unknownFromFinding.findings = [gapFinding({ relatedSignalIds: [SIGNAL_ID, "CLEC-SIG-0009"] })];
  assert.match(errorsOf(unknownFromFinding), /references unknown signal CLEC-SIG-0009/);
});

test("unknown fields at any level of the result are rejected", () => {
  assert.match(errorsOf({ ...insufficientReview(), confidence: 0.9 }), /independentReview has unknown field "confidence"/);
  const finding = insufficientReview();
  finding.findings = [gapFinding({ score: 3 })];
  assert.match(errorsOf(finding), /findings\[0\] has unknown field "score"/);
  const disp = insufficientReview();
  disp.signalDispositions = [disposition("INSUFFICIENT_EVIDENCE", { relatedFindingIds: ["CLEC-FND-0001"], rewrite: "x" })];
  assert.match(errorsOf(disp), /signalDispositions\[0\] has unknown field "rewrite"/);
});

test("malformed or duplicate finding IDs and unknown finding references are rejected", () => {
  const malformed = insufficientReview();
  malformed.findings = [gapFinding({ findingId: "F1" })];
  assert.match(errorsOf(malformed), /findingId must match/);

  const duplicate = insufficientReview();
  duplicate.findings.push(gapFinding({ relatedSignalIds: [] }));
  assert.match(errorsOf(duplicate), /duplicate findingId CLEC-FND-0001/);

  const unknownRef = insufficientReview();
  unknownRef.signalDispositions = [disposition("INSUFFICIENT_EVIDENCE", { relatedFindingIds: ["CLEC-FND-0001", "CLEC-FND-0042"] })];
  assert.match(errorsOf(unknownRef), /references unknown finding CLEC-FND-0042/);
});

test("finding claims must quote an authored text field of a candidate verbatim", () => {
  const paraphrase = insufficientReview();
  paraphrase.findings = [gapFinding({ claim: "várias comunicações" })];
  assert.match(errorsOf(paraphrase), /claim does not occur verbatim in EVD-NEW observation.summary/);

  const missingField = insufficientReview();
  missingField.findings = [gapFinding({ field: "observation.details" })];
  assert.match(errorsOf(missingField), /is not an authored text field of EVD-NEW/);

  const indexed = insufficientReview();
  indexed.findings = [gapFinding({ field: "inference_limits[0]", claim: "não estabelecem prevalência" })];
  assert.deepEqual(validateIndependentReview(indexed, PKG).errors, []);

  const contextRecord = insufficientReview();
  contextRecord.findings = [gapFinding({ recordId: "SRC-0001", field: "name", claim: "Relatório" })];
  assert.match(errorsOf(contextRecord), /recordId must name a candidate record/);
});

test("evidence references must exist in the supplied review context", () => {
  const review = insufficientReview();
  review.findings = [gapFinding({ evidenceReferences: ["SRC-0001", "SRC-9999"] })];
  assert.match(errorsOf(review), /references "SRC-9999", which is not a record in the review input/);

  const disp = insufficientReview();
  disp.signalDispositions = [disposition("INSUFFICIENT_EVIDENCE", { relatedFindingIds: ["CLEC-FND-0001"], evidenceReferences: ["EVD-000001"] })];
  assert.match(errorsOf(disp), /references "EVD-000001"/);

  assert.match(errorsOf({ ...insufficientReview(), findings: [gapFinding({ evidenceReferences: [] })] }), /must name at least one record/);
});

test("a v1 independent-review result is rejected", () => {
  const errors = errorsOf({ schemaVersion: "1", outcome: "CONCUR", rationale: "No disagreement found." });
  assert.match(errors, /schemaVersion must be exactly "2"/);
  assert.match(errors, /findings must be an array/);
  assert.match(errors, /signal CLEC-SIG-0001 has no disposition/);
});

test("a missing or non-object independent review fails closed", () => {
  assert.match(errorsOf(undefined), /is required and must not be absent/);
  assert.match(errorsOf(null), /is required and must not be absent/);
  assert.deepEqual(validateIndependentReview("CONCUR", PKG).errors, ["independent review result must be an object"]);
  assert.match(errorsOf({ ...insufficientReview(), outcome: "LOOKS_FINE" }), /outcome must be one of/);
  assert.match(errorsOf({ ...insufficientReview(), rationale: "" }), /rationale must be a non-empty string/);
});

test("the corpus-independent layer checks shape, linkage and claims against candidates without the reviewer package", () => {
  const candidates = candidateFieldsById(PKG.candidates, PKG.deltas);
  assert.deepEqual(validateIndependentReviewStructure(insufficientReview(), candidates).errors, []);

  const paraphrase = insufficientReview();
  paraphrase.findings = [gapFinding({ claim: "várias comunicações" })];
  assert.match(validateIndependentReviewStructure(paraphrase, candidates).errors.join("\n"), /does not occur verbatim/);
  assert.match(validateIndependentReviewStructure({ ...insufficientReview(), outcome: "CONCUR" }, candidates).errors.join("\n"), /CONCUR is inconsistent/);
  assert.match(validateIndependentReviewStructure({ schemaVersion: "1", outcome: "CONCUR", rationale: "r" }, candidates).errors.join("\n"), /schemaVersion must be exactly "2"/);
});

const FROZEN_INPUT = '{"frozen":"REVIEW_INPUT_SENTINEL"}';
const REVIEWER_PROMPT = buildReviewerPrompt(FROZEN_INPUT);

test("the reviewer prompt does not require candidates to be free of unresolved contradiction", () => {
  assert.doesNotMatch(REVIEWER_PROMPT, /free of unresolved contradiction/i);
});

test("the reviewer prompt permits a faithfully preserved, bounded unresolved contradiction", () => {
  assert.match(REVIEWER_PROMPT, /faithfully preserved, bounded unresolved contradiction is legitimate/);
  assert.match(REVIEWER_PROMPT, /on its own it is not grounds for\sDISAGREEMENT_FOUND or INSUFFICIENT_EVIDENCE/);
});

test("the reviewer prompt assesses support, inference limits, faithful contradiction and unsupported certainty", () => {
  assert.match(REVIEWER_PROMPT, /claims are adequately supported/);
  assert.match(REVIEWER_PROMPT, /inference limits are respected/);
  assert.match(REVIEWER_PROMPT, /contradictions and boundaries are represented faithfully/);
  assert.match(REVIEWER_PROMPT, /unresolved contradiction is explicitly bounded where relevant/);
  assert.match(REVIEWER_PROMPT, /no unsupported certainty/);
});

test("the reviewer prompt assesses the CLEC core rule and all ten dimensions against the evidence", () => {
  assert.ok(REVIEWER_PROMPT.includes("Never make a statement stronger, broader, more certain or more causal in order to make it simpler."));
  const dimensions = ["Clarity", "Specificity", "Explicit scope", "Supported quantity", "Attribution", "Supported causality", "Temporal precision", "Visible uncertainty", "Neutral wording", "Evidence fidelity"];
  dimensions.forEach((dimension, index) => {
    assert.ok(REVIEWER_PROMPT.includes(`${index + 1}. ${dimension} —`), `reviewer must assess CLEC dimension ${dimension}`);
  });
  assert.match(REVIEWER_PROMPT, /Reading the text in isolation is not semantic review/);
});

test("the reviewer prompt makes Source→EVD fidelity and translation/paraphrase strengthening explicit", () => {
  assert.match(REVIEWER_PROMPT, /Source→EVD fidelity/);
  assert.match(REVIEWER_PROMPT, /no translation or paraphrase strengthens, broadens or resolves the Source/);
  assert.match(REVIEWER_PROMPT, /no simplification changes evidential meaning/);
});

test("the reviewer prompt treats lexical terms as contextual signals, not banned words", () => {
  assert.match(REVIEWER_PROMPT, /"vários", "zonas-chave", "significativo"/);
  assert.match(REVIEWER_PROMPT, /signals to examine, not banned words and not automatic violations/);
  assert.match(REVIEWER_PROMPT, /evidence and its context decide/);
});

test("the reviewer prompt requires the structured v2 result with exactly the validated top-level keys", () => {
  const resultContract = REVIEWER_PROMPT.slice(REVIEWER_PROMPT.indexOf("Respond with a single JSON object"));
  const topLevelKeys = [...resultContract.matchAll(/^ {2}"(\w+)":/gm)].map((match) => match[1]);
  assert.deepEqual(topLevelKeys, ["schemaVersion", "outcome", "rationale", "findings", "signalDispositions"]);
  assert.match(REVIEWER_PROMPT, /matching exactly this shape \(schemaVersion "2"\), with no other fields/);
  assert.match(REVIEWER_PROMPT, /"outcome": "CONCUR" \| "DISAGREEMENT_FOUND" \| "INSUFFICIENT_EVIDENCE"/);
  assert.match(REVIEWER_PROMPT, /"kind": "CLEC_VIOLATION" \| "INSUFFICIENT_EVIDENCE"/);
  assert.match(REVIEWER_PROMPT, /"disposition": "SUPPORTED" \| "VIOLATION" \| "NOT_APPLICABLE" \| "INSUFFICIENT_EVIDENCE"/);
  assert.ok(REVIEWER_PROMPT.includes(`REVIEW INPUT (immutable, JSON):\n${FROZEN_INPUT}\n`));
  assert.ok(REVIEWER_PROMPT.endsWith("Do not emit anything on stdout other than this JSON object."));
});

test("the reviewer prompt requires nonempty finding references and a complete output self-check", () => {
  assert.match(REVIEWER_PROMPT, /Every finding must have at least one evidenceReferences entry; evidenceReferences: \[\] is invalid/);
  assert.match(REVIEWER_PROMPT, /Every cited record ID must exist in the immutable review input/);
  assert.match(REVIEWER_PROMPT, /another EVD or SRC, cite the relevant EVD or SRC record/);
  assert.match(REVIEWER_PROMPT, /candidate recordId itself may be cited/);
  assert.match(REVIEWER_PROMPT, /For an evidence-gap finding, cite the record whose supplied context is insufficient/);
  assert.match(REVIEWER_PROMPT, /Before emitting stdout, self-check the complete JSON/);
});

test("the reviewer prompt makes signal dispositions, evidence gaps and unsignalled findings explicit without rewriting records", () => {
  assert.match(REVIEWER_PROMPT, /Give every entry of the input "signals" exactly one disposition/);
  assert.match(REVIEWER_PROMPT, /never an automatic violation and never a pass/);
  assert.match(REVIEWER_PROMPT, /Never use it for missing evidence/);
  assert.match(REVIEWER_PROMPT, /Never call it a VIOLATION merely because evidence is unavailable/);
  assert.match(REVIEWER_PROMPT, /Never SUPPORTED by assumption/);
  assert.match(REVIEWER_PROMPT, /even where no signal flagged them/);
  assert.match(REVIEWER_PROMPT, /SRC records hold provenance and metadata, not the Source's content/);
  assert.match(REVIEWER_PROMPT, /never guess, and never fill the gap from outside the package/);
  assert.match(REVIEWER_PROMPT, /Judge from the supplied evidence and context, not from wording alone/);
  assert.match(REVIEWER_PROMPT, /Do not rewrite canonical records/);
});

test("the reviewer prompt bounds Source Verification Support to its explicit verified claims, never treating silence as absence", () => {
  for (const rule of [
    "\"sourceVerificationContext\"",
    "It is not Source text, not a quotation and not an EVD.",
    "Use it only for the bounded factual claims it explicitly contains.",
    "It does not establish completeness: silence is not absence, and a fact it does not state stays UNKNOWN, never NO.",
    "Never infer beyond it.",
    "When candidate Source-derived wording exceeds both the canonical SRC metadata and the supplied verified claims, report INSUFFICIENT_EVIDENCE.",
    "Do not judge the authenticity of the support",
    "do not CLEC-review its statements",
    "cite the associated SRC-* ID in evidenceReferences",
  ]) {
    assert.ok(REVIEWER_PROMPT.includes(rule), rule);
  }
});

// ---------------------------------------------------------------------------
// Review boundaries for Evidence with support-ineligible provenance

const PROBLEM_SCHEMA: RecordSchema = {
  prefix: "PRB-",
  directory: "problems",
  idField: "problem_id",
  references: [{ field: "evidence", isList: true, targetPrefix: "EVD-", targetDirectory: "evidence", required: true }],
};

const PRIVATE_SENTINEL = "PRIVATE_CORRESPONDENCE_SENTINEL";
const CORRESPONDENCE = { source_id: "SRC-CORR", resource_type: "correspondence", access: { level: "private" }, licensing: { reuse: "unknown" }, acquisition: { notes: PRIVATE_SENTINEL } };
const PUBLIC_SOURCE = { source_id: "SRC-PUB", resource_type: "document", access: { level: "public" }, licensing: { reuse: "unknown" } };

function evidence(id: string, sourceId: string, summary = "A entidade indicou um horário de funcionamento."): Record<string, unknown> {
  return {
    evidence_id: id,
    provenance: { sources: [sourceId] },
    observation: { summary },
    evidence_nature: "reported_claim",
    claim_authority: "operator",
    inference_limits: ["Não estabelece o horário efetivamente praticado."],
  };
}

function recordIndex(schema: RecordSchema, records: Record<string, unknown>[]): RecordIndex {
  const items = records.map((fields) => ({ file: `${schema.directory}/${fields[schema.idField]}.yaml`, fields }));
  return { schema, records: items, byId: new Map(items.map((item) => [item.fields[schema.idField] as string, item])) };
}

function boundaryPackage(candidate: CandidateRecord, id: string): ReviewerInputPackage {
  return buildReviewerInputPackage({
    baseGitSha: SHA,
    manifest: { mode: "direct-pull-request", investigationQuestion: "q" },
    index: {
      researchRoot: "/synthetic",
      totalRecords: 4,
      byPrefix: new Map([
        ["SRC-", recordIndex(SOURCE_SCHEMA, [CORRESPONDENCE, PUBLIC_SOURCE])],
        ["EVD-", recordIndex(EVIDENCE_SCHEMA, [evidence("EVD-BASE", "SRC-CORR"), evidence("EVD-PUB", "SRC-PUB")])],
        ["PRB-", recordIndex(PROBLEM_SCHEMA, [])],
      ]),
    },
    candidates: [candidate],
    deltas: [{ recordFamily: candidate.recordFamily, id, action: "CREATE" }],
    validation: { errors: [], totalRecords: 5 },
    readiness: "READY_FOR_INTEGRATION_GATE",
    sourceVerifications: { bySourceId: new Map(), issues: [] },
  });
}

/** A PRB candidate relying on unchanged base Evidence: one correspondence-backed, one public-backed, neither with support. */
const PRB_PKG = boundaryPackage({ recordFamily: "PRB-", fields: { problem_id: "PRB-NEW", summary: "A entidade indicou um horário.", evidence: ["EVD-BASE", "EVD-PUB"] } }, "PRB-NEW");
/** A changed EVD candidate whose only Source is correspondence. */
const CHANGED_EVD_PKG = boundaryPackage({ recordFamily: "EVD-", fields: evidence("EVD-CHANGED", "SRC-CORR", "A entidade respondeu por escrito sobre o serviço.") }, "EVD-CHANGED");

function promptOf(pkg: ReviewerInputPackage): string {
  return buildReviewerPrompt(serializeReviewerInput(pkg));
}

function eligibilitySection(prompt: string): string {
  const start = prompt.indexOf("SOURCE VERIFICATION ELIGIBILITY (");
  return prompt.slice(start, prompt.indexOf("\n\n", start));
}

test("unchanged correspondence-backed Evidence is classified support-ineligible and becomes the PRB review boundary", () => {
  assert.deepEqual(PRB_PKG.evidenceContext.map((record) => record.id), ["EVD-BASE", "EVD-PUB", "SRC-CORR", "SRC-PUB"]);
  assert.equal("sourceVerificationContext" in PRB_PKG, false);
  const prompt = promptOf(PRB_PKG);
  assert.ok(eligibilitySection(prompt).includes("- SRC-CORR: SOURCE_VERIFICATION_INELIGIBLE (NON_PUBLIC, CORRESPONDENCE)"));
  for (const rule of [
    "An EVD in \"evidenceContext\" is existing canonical Evidence already admitted into the base and unchanged by this package: it is the bounded review artifact for PRB synthesis.",
    "Compare PRB wording against that EVD's observation, scope, inference_limits and authority/nature metadata",
    "Source-body re-verification is not available for a SOURCE_VERIFICATION_INELIGIBLE Source",
    "For an unchanged evidenceContext EVD, the absence of that Source's body or support is therefore not itself an evidentiary defect and never on its own grounds for INSUFFICIENT_EVIDENCE: judge the PRB against the canonical EVD.",
    "except as the review boundaries below provide for unchanged Evidence with support-ineligible provenance",
  ]) {
    assert.ok(prompt.includes(rule), rule);
  }
});

test("support-ineligible provenance never relaxes PRB→EVD fidelity or makes correspondence stronger", () => {
  const prompt = promptOf(PRB_PKG);
  for (const rule of [
    "This does not make the EVD, its Source or correspondence true, verified or stronger, and it never relaxes PRB→EVD fidelity.",
    "Do not infer beyond the EVD",
    "exceeds the EVD's observation, drops or weakens an inference limit, broadens place, population or period, increases certainty or causality, or misstates attribution remains a CLEC defect",
    "a PRB claim the EVD itself does not support remains INSUFFICIENT_EVIDENCE or a violation on the EVD's own terms",
    "synthesis never broader, stronger or more causal than its EVD and their inference_limits",
  ]) {
    assert.ok(prompt.includes(rule), rule);
  }
  assert.doesNotMatch(prompt, /correspondence[^.]*\b(is|are) (true|verified|trusted)\b/i);
});

test("a changed EVD backed by support-ineligible provenance still requires Source fidelity and may fail closed", () => {
  assert.deepEqual(CHANGED_EVD_PKG.candidates.map((candidate) => candidate.fields.evidence_id), ["EVD-CHANGED"]);
  const prompt = promptOf(CHANGED_EVD_PKG);
  assert.ok(eligibilitySection(prompt).includes("- SRC-CORR: SOURCE_VERIFICATION_INELIGIBLE (NON_PUBLIC, CORRESPONDENCE)"));
  assert.ok(prompt.includes("Source→EVD fidelity remains mandatory for it whatever its Sources' eligibility: where judging it needs Source content the package does not contain, report INSUFFICIENT_EVIDENCE."));
  // The exemption is scoped to unchanged evidence-context Evidence, never to a candidate.
  assert.ok(prompt.includes("For an unchanged evidenceContext EVD, the absence"));
  assert.doesNotMatch(prompt, /candidate[^.]*not itself an evidentiary defect/);

  // A fail-closed review of that changed EVD remains a valid structured result.
  const signalIds = CHANGED_EVD_PKG.signals.map((signal) => signal.signalId);
  const review = {
    schemaVersion: "2",
    outcome: "INSUFFICIENT_EVIDENCE",
    rationale: "Fidelity of the changed EVD to its correspondence Source cannot be judged from the package.",
    findings: [gapFinding({ recordId: "EVD-CHANGED", claim: "respondeu por escrito", dimension: "evidence_fidelity", evidenceReferences: ["SRC-CORR"], relatedSignalIds: signalIds })],
    signalDispositions: signalIds.map((signalId) => disposition("INSUFFICIENT_EVIDENCE", { signalId, evidenceReferences: ["SRC-CORR"], relatedFindingIds: ["CLEC-FND-0001"] })),
  };
  assert.deepEqual(validateIndependentReview(review, CHANGED_EVD_PKG).errors, []);
});

test("a public Source without support stays eligible, so missing Source content is still an evidence gap", () => {
  const prompt = promptOf(PRB_PKG);
  assert.ok(eligibilitySection(prompt).includes("- SRC-PUB: SOURCE_VERIFICATION_ELIGIBLE"));
  assert.ok(prompt.includes("For a SOURCE_VERIFICATION_ELIGIBLE Source, Source Verification Support is the governed path to Source content; where a judgement needs Source content that neither the SRC metadata nor its support supplies, report INSUFFICIENT_EVIDENCE."));
  assert.deepEqual(reviewSourceEligibility(PRB_PKG), [
    { sourceId: "SRC-CORR", ineligibility: ["NON_PUBLIC", "CORRESPONDENCE"] },
    { sourceId: "SRC-PUB", ineligibility: [] },
  ]);
});

test("the eligibility section is derived from the frozen input without changing it and carries only SRC IDs and reason categories", () => {
  const json = serializeReviewerInput(PRB_PKG);
  const prompt = buildReviewerPrompt(json);
  assert.ok(prompt.includes(`REVIEW INPUT (immutable, JSON):\n${json}\n`));
  assert.equal(buildReviewerPrompt(json), prompt);
  assert.doesNotMatch(json, /SOURCE_VERIFICATION_(IN)?ELIGIBLE|ineligibility/);
  const section = eligibilitySection(prompt).split("\n");
  assert.equal(section.length, 3);
  for (const line of section.slice(1)) {
    assert.match(line, /^- SRC-[A-Z]+: SOURCE_VERIFICATION_(ELIGIBLE|INELIGIBLE \((NON_PUBLIC|CORRESPONDENCE|REUSE_PROHIBITED)(, (NON_PUBLIC|CORRESPONDENCE|REUSE_PROHIBITED))*\))$/);
  }
  assert.equal(section.join("\n").includes(PRIVATE_SENTINEL), false);
  assert.ok(eligibilitySection(REVIEWER_PROMPT).endsWith("- (no SRC records in the review input)"));
});
