import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { AiInvocationRequest, AiInvocationResult, AiInvoker } from "../ai/invoker.ts";
import { buildReducedReviewerInputPackage } from "../review/reduced-reviewer-input.ts";
import { buildReviewerInputPackage } from "../review/reviewer-input.ts";
import type { IndependentReviewResult, ReviewFinding } from "../review/types.ts";
import {
  applyInverseReplacements,
  BENCHMARK_CASES,
  benchmarkMatrix,
  classifyRun,
  profileInput,
  runReviewer,
  syntheticReverseImpactSource,
  type ProfileInput,
  type RunRecord,
} from "./review-profile-equivalence.ts";

class ScriptedInvoker implements AiInvoker {
  readonly prompts: string[] = [];
  private readonly results: AiInvocationResult[];
  constructor(results: AiInvocationResult[]) {
    this.results = [...results];
  }
  invoke(request: AiInvocationRequest): AiInvocationResult {
    this.prompts.push(request.input);
    const next = this.results.shift();
    if (!next) throw new Error("unexpected extra reviewer call");
    return next;
  }
}

function ready(profile: "REFERENCE" | "REDUCED"): Extract<ProfileInput, { status: "READY" }> {
  const input = profileInput(profile, syntheticReverseImpactSource());
  assert.equal(input.status, "READY");
  return input as Extract<ProfileInput, { status: "READY" }>;
}

function concur(signalIds: string[]): IndependentReviewResult {
  return {
    schemaVersion: "2",
    outcome: "CONCUR",
    rationale: "Revisão sintética.",
    findings: [],
    signalDispositions: signalIds.map((signalId) => ({ signalId, disposition: "NOT_APPLICABLE", reason: "Falso positivo.", evidenceReferences: [], relatedFindingIds: [] })),
  };
}

const finding = (overrides: Partial<ReviewFinding>): ReviewFinding => ({
  findingId: "CLEC-FND-0001",
  recordId: "PRB-A",
  field: "problem_statement",
  claim: "Residentes de Évora relatam atrasos na recolha de resíduos.",
  dimension: "explicit_scope",
  kind: "CLEC_VIOLATION",
  severity: "BLOCKING",
  reason: "EVD-A now documents only Malagueira.",
  evidenceReferences: ["EVD-A"],
  correctionDirection: "Narrow the scope to the linked Evidence.",
  relatedSignalIds: [],
  ...overrides,
});

const review = (outcome: IndependentReviewResult["outcome"], findings: ReviewFinding[]): IndependentReviewResult => ({ schemaVersion: "2", outcome, rationale: "r", findings, signalDispositions: [] });

const SYNTHETIC = BENCHMARK_CASES.find((c) => c.caseId === "SYNTHETIC-REVERSE-IMPACT")!;
const CONTROL = BENCHMARK_CASES.find((c) => c.expectation === "CONCUR")!;

test("the synthetic reverse-impact case leaves an unchanged PRB whose only supporting EVD was narrowed, in both profiles", () => {
  const source = syntheticReverseImpactSource();
  assert.deepEqual(source.deltas, [{ recordFamily: "EVD-", id: "EVD-A", action: "UPDATE" }]);

  const reference = buildReviewerInputPackage(source).impactedSubjects ?? [];
  assert.deepEqual(reference.map((s) => s.id), ["PRB-A"]);
  assert.deepEqual(reference[0].linkedEvidenceBoundary.filter((b) => b.changed).map((b) => b.evidenceId), ["EVD-A"]);

  const reduced = buildReducedReviewerInputPackage(source).impactedSubjects ?? [];
  assert.deepEqual(reduced.map((s) => [s.id, s.changedEvidenceIds]), [["PRB-A", ["EVD-A"]]]);
  const supporting = reduced[0].evidenceLinks.filter((link) => link.references.some((ref) => (ref.relationship?.effects as string[] | undefined)?.includes("SUPPORTS")));
  assert.deepEqual(supporting.map((link) => link.evidenceId), ["EVD-A"]);
});

test("both profiles frame one source as distinct, reproducible reviewer inputs", () => {
  const reference = ready("REFERENCE");
  const reduced = ready("REDUCED");
  assert.equal(ready("REFERENCE").inputFingerprint, reference.inputFingerprint);
  assert.equal(ready("REDUCED").promptSha256, reduced.promptSha256);
  assert.notEqual(reference.inputFingerprint, reduced.inputFingerprint);
  assert.match(reduced.prompt, /profile "REDUCED"/);
  assert.doesNotMatch(reference.prompt, /profile "REDUCED"/);
});

test("inverse replacements restore exact text and refuse an ambiguous or missing anchor", () => {
  assert.equal(applyInverseReplacements("a novo b novo", [["novo", "antigo", 2]]), "a antigo b antigo");
  assert.throws(() => applyInverseReplacements("a novo b novo", [["novo", "antigo", 1]]), /expected 1 occurrence/);
  assert.throws(() => applyInverseReplacements("a b", [["novo", "antigo", 1]]), /found 0/);
});

test("a valid review is never retried and is validated against its own profile's package", () => {
  for (const profile of ["REFERENCE", "REDUCED"] as const) {
    const input = ready(profile);
    const signals = (JSON.parse(input.prompt.split("REVIEW INPUT (immutable, JSON):\n")[1].split("\n")[0]) as { signals: { signalId: string }[] }).signals.map((s) => s.signalId);
    const invoker = new ScriptedInvoker([{ status: "OK", stdout: JSON.stringify(concur(signals)) }]);
    const result = runReviewer(invoker, input);
    assert.equal(result.status, "VALID", profile);
    assert.equal(invoker.prompts.length, 1);
    assert.equal(invoker.prompts[0], input.prompt);
  }
});

test("a structurally invalid response gets exactly one technical retry on the same frozen prompt", () => {
  const input = ready("REDUCED");
  const signals = buildReducedReviewerInputPackage(syntheticReverseImpactSource()).signals.map((s) => s.signalId);
  const retried = new ScriptedInvoker([{ status: "OK", stdout: "not json" }, { status: "OK", stdout: JSON.stringify(concur(signals)) }]);
  const ok = runReviewer(retried, input);
  assert.equal(ok.status, "VALID");
  assert.equal(ok.status === "VALID" && ok.technicalCalls, 2);
  assert.ok(retried.prompts[1].startsWith(input.prompt));
  assert.match(retried.prompts[1], /STRUCTURAL RETRY/);

  const failing = new ScriptedInvoker([{ status: "OK", stdout: "{}" }, { status: "OK", stdout: "{}" }]);
  const failed = runReviewer(failing, input);
  assert.equal(failed.status === "FAILED" && failed.failedCheck, "INDEPENDENT_REVIEW_OUTPUT_INVALID");

  const timedOut = new ScriptedInvoker([{ status: "TIMEOUT", message: "slow" }]);
  assert.equal(runReviewer(timedOut, input).status, "FAILED");
  assert.equal(timedOut.prompts.length, 1);
});

test("an expected defect is detected only by a matching BLOCKING finding", () => {
  const detected = classifyRun(SYNTHETIC, review("DISAGREEMENT_FOUND", [finding({})]));
  assert.deepEqual(detected.detections, [{ defectId: "SYN-D1", detected: true, findingIds: ["CLEC-FND-0001"], advisoryFindingIds: [] }]);
  assert.equal(detected.falseBlocker, null);

  const advisory = classifyRun(SYNTHETIC, review("CONCUR", [finding({ severity: "ADVISORY" })]));
  assert.equal(advisory.detections[0].detected, false);
  assert.deepEqual(advisory.detections[0].advisoryFindingIds, ["CLEC-FND-0001"]);

  const elsewhere = classifyRun(SYNTHETIC, review("DISAGREEMENT_FOUND", [finding({ reason: "Tom avaliativo.", correctionDirection: "Neutralizar.", claim: "Atrasos" })]));
  assert.equal(elsewhere.detections[0].detected, false);
  assert.deepEqual(elsewhere.unexpectedBlockingFindingIds, ["CLEC-FND-0001"]);
});

test("any non-CONCUR outcome on the control case is a false blocker", () => {
  assert.equal(classifyRun(CONTROL, review("CONCUR", [])).falseBlocker, false);
  assert.equal(classifyRun(CONTROL, review("INSUFFICIENT_EVIDENCE", [finding({ recordId: "PRB-0010", kind: "INSUFFICIENT_EVIDENCE" })])).falseBlocker, true);
});

test("a failed run counts as a structural failure and misses every expected defect", () => {
  const base = { origin: SYNTHETIC.origin, inputFingerprint: "x", promptSha256: "y" };
  const records: RunRecord[] = [
    { ...base, caseId: SYNTHETIC.caseId, profile: "REDUCED", run: 1, invocation: { status: "VALID", technicalCalls: 1, firstCallErrors: [] }, review: review("DISAGREEMENT_FOUND", [finding({})]) },
    { ...base, caseId: SYNTHETIC.caseId, profile: "REDUCED", run: 2, invocation: { status: "FAILED", technicalCalls: 2, failedCheck: "INDEPENDENT_REVIEW_OUTPUT_INVALID", message: "invalid twice" }, review: null },
  ];
  const row = benchmarkMatrix(records).find((r) => r.caseId === SYNTHETIC.caseId && r.profile === "REDUCED")!;
  assert.deepEqual(row, { caseId: SYNTHETIC.caseId, profile: "REDUCED", runs: 2, reviewerInvocations: 3, validRuns: 1, expectedDefectDetections: 1, misses: 1, falseBlockers: 0, structuralFailures: 1 });
});

test("the benchmark never touches lifecycle state or direct review attestation transport", () => {
  const source = readFileSync(new URL("./review-profile-equivalence.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.ok(imports.length > 0);
  for (const path of imports) assert.doesNotMatch(path, /review-lifecycle|research\/cli|independent-review-invocation/);
  assert.doesNotMatch(source, /reviewLifecycleDirFor|REVIEW_ATTESTATION_PATH|"\.research-review-attestation/);
});
