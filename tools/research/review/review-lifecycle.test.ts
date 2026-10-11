import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { AiInvocationRequest, AiInvocationResult, AiInvoker } from "../ai/invoker.ts";
import { loadSourceVerifications } from "../core/source-verifications.ts";
import { semanticCandidates, semanticReview, semanticReviewCorpus, SHA_A, SHA_B, type SemanticReviewScenario } from "../gate/test-fixtures.ts";
import {
  checkSemanticAttempt,
  declareOwnerReady,
  readReviewLifecycleState,
  REVIEW_LIFECYCLE_CHECK,
  reviewSubject,
  runOwnerDeclaredReview,
  TOOLING_RUNTIME_FAILURE,
} from "./review-lifecycle.ts";
import { buildReviewerInputPackage, serializeReviewerInput, type ReviewerInputPackage } from "./reviewer-input.ts";

const ORIGINAL = "Muitos moradores relatam atrasos frequentes.";
const CORRECTED = "Muitos moradores relatam atrasos.";

/** The semantic scenario's frozen reviewer input, with the PRB statement, base or target set varied. */
function reviewerInput(options: { statement?: string; baseGitSha?: string; widen?: boolean } = {}): ReviewerInputPackage {
  const index = semanticReviewCorpus();
  const { candidates, deltas } = semanticCandidates();
  candidates.find((candidate) => candidate.recordFamily === "PRB-")!.fields.problem_statement = options.statement ?? ORIGINAL;
  if (options.widen) {
    candidates.push({ recordFamily: "SRC-", fields: { source_id: "SRC-NEW", name: "Fonte nova" } });
    deltas.push({ recordFamily: "SRC-", id: "SRC-NEW", action: "CREATE" });
  }
  return buildReviewerInputPackage({
    baseGitSha: options.baseGitSha ?? SHA_A,
    manifest: { mode: "daily-discovery", investigationQuestion: "q" },
    index,
    candidates,
    deltas,
    validation: { errors: [], totalRecords: index.totalRecords },
    readiness: "READY_FOR_INTEGRATION_GATE",
    sourceVerifications: loadSourceVerifications(index),
  });
}

/** Replays scripted stdout values and records every reviewer call. */
class ScriptedReviewer implements AiInvoker {
  readonly calls: AiInvocationRequest[] = [];
  private readonly stdouts: string[];
  constructor(...stdouts: string[]) {
    this.stdouts = stdouts;
  }
  invoke(request: AiInvocationRequest): AiInvocationResult {
    this.calls.push(request);
    const stdout = this.stdouts.shift();
    assert.ok(stdout !== undefined, "unexpected reviewer invocation");
    return { status: "OK", stdout };
  }
}

const reviewOf = (input: ReviewerInputPackage, scenario: SemanticReviewScenario): string => JSON.stringify(semanticReview(input, scenario));
/** Valid JSON that fails context-aware validation: no signal is dispositioned. */
const undispositioned = (input: ReviewerInputPackage): string => JSON.stringify({ ...semanticReview(input, "CONCUR"), signalDispositions: [] });

function withStore(run: (lifecycleDir: string, workbench: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-review-lifecycle-test-"));
  try {
    run(join(dir, "lifecycle"), dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function declare(lifecycleDir: string, input: ReviewerInputPackage, newLifecycle = false) {
  return declareOwnerReady(lifecycleDir, reviewSubject(input), { newLifecycle });
}

/** Runs one owner-declared attempt that must produce a valid review. */
function reviewed(lifecycleDir: string, workbench: string, input: ReviewerInputPackage, scenario: SemanticReviewScenario) {
  const reviewer = new ScriptedReviewer(reviewOf(input, scenario));
  const run = runOwnerDeclaredReview(lifecycleDir, reviewer, input, workbench);
  assert.equal(run.status, "REVIEWED", run.status === "REVIEWED" ? "" : `${run.failedCheck}: ${run.message}`);
  assert.equal(reviewer.calls.length, 1, "a valid review, whatever its outcome, is never retried");
  if (run.status !== "REVIEWED") throw new Error("unreachable");
  return run;
}

function assertRejectedBeforeInvocation(lifecycleDir: string, workbench: string, input: ReviewerInputPackage, failedCheck: string): void {
  const reviewer = new ScriptedReviewer();
  const run = runOwnerDeclaredReview(lifecycleDir, reviewer, input, workbench);
  assert.equal(run.status, "REJECTED");
  if (run.status === "REJECTED") assert.equal(run.failedCheck, failedCheck, run.message);
  assert.equal(reviewer.calls.length, 0);
}

test("a semantic review never starts before the owner declares the exact content ready", () => {
  withStore((lifecycleDir, workbench) => {
    assertRejectedBeforeInvocation(lifecycleDir, workbench, reviewerInput(), REVIEW_LIFECYCLE_CHECK.NOT_DECLARED_READY);
    assert.deepEqual(declare(lifecycleDir, reviewerInput()), { ok: true, semanticAttempt: 1 });
    assert.equal(reviewed(lifecycleDir, workbench, reviewerInput(), "CONCUR").semanticAttempt, 1);
  });
});

test("a readiness declaration binds the exact reviewer input and goes stale when the content changes", () => {
  withStore((lifecycleDir, workbench) => {
    const declaredInput = reviewerInput();
    assert.equal(declare(lifecycleDir, declaredInput).ok, true);
    const { reviewerInputFingerprint } = reviewSubject(declaredInput);
    const stored = JSON.parse(readFileSync(join(lifecycleDir, "review-lifecycle.json"), "utf8"));
    assert.equal(stored.lifecycles[0].declaredReviewerInputFingerprint, reviewerInputFingerprint);
    assert.doesNotMatch(JSON.stringify(stored), /\d{4}-\d{2}-\d{2}T/, "no timestamp or run-specific value is stored");

    // Edited after the declaration: the same scope, a different reviewer input.
    assertRejectedBeforeInvocation(lifecycleDir, workbench, reviewerInput({ statement: CORRECTED }), REVIEW_LIFECYCLE_CHECK.READINESS_STALE);
    // Declaring the current content replaces the stale declaration.
    assert.deepEqual(declare(lifecycleDir, reviewerInput({ statement: CORRECTED })), { ok: true, semanticAttempt: 1 });
    assertRejectedBeforeInvocation(lifecycleDir, workbench, declaredInput, REVIEW_LIFECYCLE_CHECK.READINESS_STALE);
  });
});

test("a CONCUR attempt 1 succeeds, consumes the declaration, and the same content is never reviewed again", () => {
  withStore((lifecycleDir, workbench) => {
    declare(lifecycleDir, reviewerInput());
    const run = reviewed(lifecycleDir, workbench, reviewerInput(), "CONCUR");
    assert.deepEqual([run.semanticAttempt, run.result, run.review.outcome], [1, "CONCUR", "CONCUR"]);
    assertRejectedBeforeInvocation(lifecycleDir, workbench, reviewerInput(), REVIEW_LIFECYCLE_CHECK.NOT_DECLARED_READY);
    const again = declare(lifecycleDir, reviewerInput());
    assert.equal(!again.ok && again.failedCheck, REVIEW_LIFECYCLE_CHECK.ALREADY_CONCUR);
  });
});

for (const scenario of ["DISAGREEMENT_FOUND", "INSUFFICIENT_EVIDENCE"] as const) {
  test(`a valid ${scenario} attempt 1 permits exactly one bounded correction, run as attempt 2`, () => {
    withStore((lifecycleDir, workbench) => {
      declare(lifecycleDir, reviewerInput());
      const first = reviewed(lifecycleDir, workbench, reviewerInput(), scenario);
      assert.deepEqual([first.semanticAttempt, first.result], [1, "CORRECTION_PERMITTED"]);

      // No automatic rerun: the attempt consumed the declaration.
      assertRejectedBeforeInvocation(lifecycleDir, workbench, reviewerInput(), REVIEW_LIFECYCLE_CHECK.NOT_DECLARED_READY);
      // Unchanged material cannot be rerun as attempt 2.
      const unchanged = declare(lifecycleDir, reviewerInput());
      assert.equal(!unchanged.ok && unchanged.failedCheck, REVIEW_LIFECYCLE_CHECK.CORRECTION_UNCHANGED);
      // A wider target set or another base is not a bounded correction.
      for (const outOfBounds of [reviewerInput({ statement: CORRECTED, widen: true }), reviewerInput({ statement: CORRECTED, baseGitSha: SHA_B })]) {
        const declared = declare(lifecycleDir, outOfBounds);
        assert.equal(!declared.ok && declared.failedCheck, REVIEW_LIFECYCLE_CHECK.CORRECTION_OUT_OF_BOUNDS);
        assertRejectedBeforeInvocation(lifecycleDir, workbench, outOfBounds, REVIEW_LIFECYCLE_CHECK.CORRECTION_OUT_OF_BOUNDS);
      }
      // Ending the lifecycle is not a way around the bounded correction of the same scope.
      const escape = declare(lifecycleDir, reviewerInput({ statement: CORRECTED }), true);
      assert.equal(!escape.ok && escape.failedCheck, REVIEW_LIFECYCLE_CHECK.NEW_LIFECYCLE_NOT_PERMITTED);

      const corrected = reviewerInput({ statement: CORRECTED });
      assert.deepEqual(declare(lifecycleDir, corrected), { ok: true, semanticAttempt: 2 });
      const second = reviewed(lifecycleDir, workbench, corrected, "CONCUR");
      assert.deepEqual([second.semanticAttempt, second.result], [2, "CONCUR"]);
    });
  });
}

test("a non-CONCUR attempt 2 returns the lifecycle to the owner, and a third attempt is refused before the reviewer runs", () => {
  for (const scenario of ["DISAGREEMENT_FOUND", "INSUFFICIENT_EVIDENCE"] as const) {
    withStore((lifecycleDir, workbench) => {
      declare(lifecycleDir, reviewerInput());
      reviewed(lifecycleDir, workbench, reviewerInput(), "DISAGREEMENT_FOUND");
      const corrected = reviewerInput({ statement: CORRECTED });
      declare(lifecycleDir, corrected);
      const second = reviewed(lifecycleDir, workbench, corrected, scenario);
      assert.deepEqual([second.semanticAttempt, second.result], [2, "OWNER_ESCALATION"]);

      const third = reviewerInput({ statement: "Muitos moradores relatam atrasos na recolha." });
      const declared = declare(lifecycleDir, third);
      assert.equal(!declared.ok && declared.failedCheck, REVIEW_LIFECYCLE_CHECK.OWNER_ESCALATION);
      for (const input of [third, corrected, reviewerInput()]) assertRejectedBeforeInvocation(lifecycleDir, workbench, input, REVIEW_LIFECYCLE_CHECK.OWNER_ESCALATION);
    });
  }
});

test("the owner may end an escalated lifecycle explicitly, but never to re-review content that already had a valid non-CONCUR", () => {
  withStore((lifecycleDir, workbench) => {
    declare(lifecycleDir, reviewerInput());
    reviewed(lifecycleDir, workbench, reviewerInput(), "DISAGREEMENT_FOUND");
    const corrected = reviewerInput({ statement: CORRECTED });
    declare(lifecycleDir, corrected);
    reviewed(lifecycleDir, workbench, corrected, "INSUFFICIENT_EVIDENCE");

    for (const judged of [reviewerInput(), corrected]) {
      const declared = declare(lifecycleDir, judged, true);
      assert.equal(!declared.ok && declared.failedCheck, REVIEW_LIFECYCLE_CHECK.CORRECTION_UNCHANGED);
    }
    const rewritten = reviewerInput({ statement: "Muitos moradores relatam atrasos na recolha." });
    assert.deepEqual(declare(lifecycleDir, rewritten, true), { ok: true, semanticAttempt: 1 });
    assert.equal(reviewed(lifecycleDir, workbench, rewritten, "CONCUR").semanticAttempt, 1);
  });
});

test("a correction that widens the target set is a new owner-declared lifecycle, never attempt 2", () => {
  withStore((lifecycleDir, workbench) => {
    declare(lifecycleDir, reviewerInput());
    reviewed(lifecycleDir, workbench, reviewerInput(), "DISAGREEMENT_FOUND");
    const widened = reviewerInput({ statement: CORRECTED, widen: true });
    assert.deepEqual(declare(lifecycleDir, widened, true), { ok: true, semanticAttempt: 1 });
    assert.equal(reviewed(lifecycleDir, workbench, widened, "DISAGREEMENT_FOUND").semanticAttempt, 1);
    // The ended lifecycle stays ended: its scope cannot be corrected or reviewed any more.
    assertRejectedBeforeInvocation(lifecycleDir, workbench, reviewerInput({ statement: CORRECTED }), REVIEW_LIFECYCLE_CHECK.CORRECTION_OUT_OF_BOUNDS);
  });
});

test("a structurally invalid response gets one technical retry against the identical frozen input, within the same semantic attempt", () => {
  for (const invalid of [(_input: ReviewerInputPackage) => "Reviewed: true", undispositioned]) {
    withStore((lifecycleDir, workbench) => {
      const input = reviewerInput();
      declare(lifecycleDir, input);
      const reviewer = new ScriptedReviewer(invalid(input), reviewOf(input, "DISAGREEMENT_FOUND"));
      const run = runOwnerDeclaredReview(lifecycleDir, reviewer, input, workbench);
      assert.equal(run.status, "REVIEWED");
      if (run.status === "REVIEWED") assert.deepEqual([run.semanticAttempt, run.result], [1, "CORRECTION_PERMITTED"]);
      assert.equal(reviewer.calls.length, 2);
      const frozen = (request: AiInvocationRequest) => request.input.split("REVIEW INPUT (immutable, JSON):\n")[1].split("\n")[0];
      assert.equal(frozen(reviewer.calls[0]), serializeReviewerInput(input));
      assert.equal(frozen(reviewer.calls[1]), frozen(reviewer.calls[0]));

      const state = readReviewLifecycleState(lifecycleDir);
      assert.ok(state.ok);
      if (state.ok) assert.deepEqual(state.state.lifecycles[0].attempts.map((a) => [a.semanticAttempt, a.technicalCalls]), [[1, 2]]);
    });
  }
});

test("two structurally invalid responses are a tooling/runtime failure that consumes no semantic attempt and never escalates", () => {
  withStore((lifecycleDir, workbench) => {
    const input = reviewerInput();
    declare(lifecycleDir, input);
    const broken = new ScriptedReviewer("not JSON", undispositioned(input));
    const failed = runOwnerDeclaredReview(lifecycleDir, broken, input, workbench);
    assert.equal(failed.status, TOOLING_RUNTIME_FAILURE);
    if (failed.status === TOOLING_RUNTIME_FAILURE) {
      assert.equal(failed.failedCheck, "INDEPENDENT_REVIEW_OUTPUT_INVALID");
      assert.equal(failed.semanticAttempt, 1);
    }
    assert.equal(broken.calls.length, 2);
    // The declaration stands and attempt 1 is still the next attempt.
    assert.deepEqual(checkSemanticAttempt(lifecycleDir, reviewSubject(input)), { ok: true, semanticAttempt: 1 });
    reviewed(lifecycleDir, workbench, input, "DISAGREEMENT_FOUND");

    // The same holds inside attempt 2: a tooling failure there is not the owner escalation.
    const corrected = reviewerInput({ statement: CORRECTED });
    declare(lifecycleDir, corrected);
    const brokenAgain = runOwnerDeclaredReview(lifecycleDir, new ScriptedReviewer("{", "{"), corrected, workbench);
    assert.equal(brokenAgain.status, TOOLING_RUNTIME_FAILURE);
    assert.deepEqual(checkSemanticAttempt(lifecycleDir, reviewSubject(corrected)), { ok: true, semanticAttempt: 2 });
    assert.deepEqual(reviewed(lifecycleDir, workbench, corrected, "CONCUR").semanticAttempt, 2);
  });
});

test("lifecycle state the transition rules could not have produced fails closed and is never reset", () => {
  withStore((lifecycleDir, workbench) => {
    const input = reviewerInput();
    declare(lifecycleDir, input);
    reviewed(lifecycleDir, workbench, input, "DISAGREEMENT_FOUND");
    const file = join(lifecycleDir, "review-lifecycle.json");
    const genuine = readFileSync(file, "utf8");
    const state = JSON.parse(genuine);
    // A caller cannot claim the next attempt is 1 again by rewriting the record.
    state.lifecycles[0].attempts[0].semanticAttempt = 2;
    writeFileSync(file, JSON.stringify(state), "utf8");
    assertRejectedBeforeInvocation(lifecycleDir, workbench, reviewerInput({ statement: CORRECTED }), REVIEW_LIFECYCLE_CHECK.STATE_INVALID);
    const declared = declare(lifecycleDir, reviewerInput({ statement: CORRECTED }));
    assert.equal(!declared.ok && declared.failedCheck, REVIEW_LIFECYCLE_CHECK.STATE_INVALID);
    assert.equal(readFileSync(file, "utf8"), JSON.stringify(state));
  });
});
