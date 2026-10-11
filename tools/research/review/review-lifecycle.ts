/**
 * The owner-controlled semantic review lifecycle shared by Lane A and Lane B
 * (docs/investigationstrategy.md §12): the only route from a frozen
 * REFERENCE reviewer input to an INDEPENDENT_REVIEWER invocation.
 *
 * - The owner declares the exact reviewer input ready (declareOwnerReady());
 *   the declaration binds to that input's fingerprint and is stale as soon
 *   as the input changes.
 * - A lifecycle is one review scope: one base Git SHA and one candidate
 *   target set (recordFamily + id). It permits semantic attempt 1, then —
 *   only after a valid non-CONCUR — one bounded correction of the same scope
 *   with a different reviewer input, then semantic attempt 2. A non-CONCUR
 *   attempt 2 is terminal OWNER_ESCALATION: no further attempt is ever
 *   invoked in that lifecycle.
 * - The attempt number is derived from the recorded attempts, never taken
 *   from a caller. A tooling/runtime failure (including two structurally
 *   invalid reviewer outputs) records no attempt and keeps the declaration.
 * - One declaration is consumed by at most one execution: every state
 *   mutation holds the store's exclusive claim (an O_EXCL claim file). A
 *   declaration holds it across read/validate/write; a semantic attempt
 *   claims it before invoking the reviewer, revalidates under it before
 *   recording, and releases it however the attempt ends. A competing
 *   execution or declaration is rejected before any invocation or write; a claim left behind by a killed process fails closed until
 *   the owner removes it.
 *
 * State is local workbench material (gitignored), never canonical research
 * state and never a review artifact; nothing time- or run-specific is
 * stored in it.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { AiInvoker } from "../ai/invoker.ts";
import { sha256Hex } from "../core/fingerprint.ts";
import { invokeIndependentReview } from "./independent-review-invocation.ts";
import type { ReviewerInputPackage } from "./reviewer-input.ts";
import type { IndependentReviewOutcome, IndependentReviewResult } from "./types.ts";

/** Stable failure codes: each is reported before any reviewer invocation. */
export const REVIEW_LIFECYCLE_CHECK = {
  NOT_DECLARED_READY: "REVIEW_NOT_DECLARED_READY",
  READINESS_STALE: "REVIEW_READINESS_STALE",
  CORRECTION_UNCHANGED: "REVIEW_CORRECTION_UNCHANGED",
  CORRECTION_OUT_OF_BOUNDS: "REVIEW_CORRECTION_OUT_OF_BOUNDS",
  NEW_LIFECYCLE_NOT_PERMITTED: "REVIEW_NEW_LIFECYCLE_NOT_PERMITTED",
  OWNER_ESCALATION: "REVIEW_OWNER_ESCALATION",
  ALREADY_CONCUR: "REVIEW_ALREADY_CONCUR",
  ATTEMPT_IN_FLIGHT: "REVIEW_ATTEMPT_IN_FLIGHT",
  STATE_INVALID: "REVIEW_LIFECYCLE_STATE_INVALID",
} as const;

/** Classification of a reviewer call that produced no valid review; never an owner escalation. */
export const TOOLING_RUNTIME_FAILURE = "TOOLING_RUNTIME_FAILURE";

/** A repository's one lifecycle store, shared by both lanes, under its gitignored workbench. */
export function reviewLifecycleDirFor(repoRoot: string): string {
  return join(repoRoot, ".research-workbench", "review-lifecycle");
}

/** This repository's lifecycle store. */
export const REPOSITORY_REVIEW_LIFECYCLE_DIR = reviewLifecycleDirFor(resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", ".."));

const STATE_FILE = "review-lifecycle.json";
/** Exists exactly while one execution holds the store; created with O_EXCL. */
const CLAIM_FILE = "review-lifecycle.claim";

export interface ReviewTarget {
  recordFamily: string;
  id: string;
}

/** What a declaration and an attempt bind to, derived only from the frozen reviewer input. */
export interface ReviewSubject {
  baseGitSha: string;
  /** Sorted by recordFamily, then id. */
  targets: ReviewTarget[];
  reviewerInputFingerprint: string;
}

export type SemanticAttemptNumber = 1 | 2;

export interface SemanticAttemptRecord {
  semanticAttempt: SemanticAttemptNumber;
  reviewerInputFingerprint: string;
  outcome: IndependentReviewOutcome;
  reviewSha256: string;
  /** 2 when the valid review came from the one technical retry. */
  technicalCalls: 1 | 2;
}

export interface ReviewLifecycle {
  baseGitSha: string;
  targets: ReviewTarget[];
  /** The reviewer input the owner declared ready for the next attempt; consumed by a valid review. */
  declaredReviewerInputFingerprint: string | null;
  attempts: SemanticAttemptRecord[];
  /** Set only by an explicit owner `--new-lifecycle` declaration. */
  closedByOwner: boolean;
}

export interface ReviewLifecycleState {
  schemaVersion: "1";
  lifecycles: ReviewLifecycle[];
}

/** Derived, never stored: the status follows from the recorded attempts alone. */
export type ReviewLifecycleStatus = "OPEN" | "CONCUR" | "OWNER_ESCALATION" | "CLOSED_BY_OWNER";

export function lifecycleStatus(lifecycle: ReviewLifecycle): ReviewLifecycleStatus {
  const last = lifecycle.attempts.at(-1);
  if (last?.outcome === "CONCUR") return "CONCUR";
  if (lifecycle.closedByOwner) return "CLOSED_BY_OWNER";
  return lifecycle.attempts.length === 2 ? "OWNER_ESCALATION" : "OPEN";
}

function targetKey(target: ReviewTarget): string {
  return `${target.recordFamily}\u0000${target.id}`;
}

export function reviewSubject(reviewerInput: ReviewerInputPackage): ReviewSubject {
  const targets = [...new Map(reviewerInput.deltas.map(({ recordFamily, id }) => [targetKey({ recordFamily, id }), { recordFamily, id }])).values()];
  targets.sort((a, b) => (targetKey(a) < targetKey(b) ? -1 : targetKey(a) > targetKey(b) ? 1 : 0));
  return { baseGitSha: reviewerInput.baseGitSha, targets, reviewerInputFingerprint: sha256Hex(reviewerInput) };
}

function sameScope(lifecycle: ReviewLifecycle, subject: ReviewSubject): boolean {
  return lifecycle.baseGitSha === subject.baseGitSha && lifecycle.targets.map(targetKey).join("\n") === subject.targets.map(targetKey).join("\n");
}

function overlaps(lifecycle: ReviewLifecycle, subject: ReviewSubject): boolean {
  const keys = new Set(subject.targets.map(targetKey));
  return lifecycle.targets.some((target) => keys.has(targetKey(target)));
}

/** Lifecycles that still govern any of the subject's targets: open, or escalated to the owner. */
function governing(state: ReviewLifecycleState, subject: ReviewSubject): ReviewLifecycle[] {
  return state.lifecycles.filter((lifecycle) => {
    const status = lifecycleStatus(lifecycle);
    return (status === "OPEN" || status === "OWNER_ESCALATION") && overlaps(lifecycle, subject);
  });
}

function describeScope(lifecycle: Pick<ReviewLifecycle, "baseGitSha" | "targets">): string {
  return `base ${lifecycle.baseGitSha}, targets ${lifecycle.targets.map((target) => target.id).join(", ")}`;
}

// --- persistence ---------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const SHA256 = /^[0-9a-f]{64}$/;
const OUTCOMES: readonly string[] = ["CONCUR", "DISAGREEMENT_FOUND", "INSUFFICIENT_EVIDENCE"];

function isTarget(value: unknown): value is ReviewTarget {
  return isObject(value) && typeof value.recordFamily === "string" && typeof value.id === "string";
}

function isAttempt(value: unknown, position: number): value is SemanticAttemptRecord {
  return (
    isObject(value) &&
    value.semanticAttempt === position + 1 &&
    typeof value.reviewerInputFingerprint === "string" &&
    SHA256.test(value.reviewerInputFingerprint) &&
    OUTCOMES.includes(value.outcome as string) &&
    typeof value.reviewSha256 === "string" &&
    SHA256.test(value.reviewSha256) &&
    (value.technicalCalls === 1 || value.technicalCalls === 2)
  );
}

/** An attempt record only exists where the transition rules could have produced it. */
function isLifecycle(value: unknown): value is ReviewLifecycle {
  if (!isObject(value) || typeof value.baseGitSha !== "string" || !Array.isArray(value.targets) || !value.targets.every(isTarget)) return false;
  if (typeof value.closedByOwner !== "boolean") return false;
  const declared = value.declaredReviewerInputFingerprint;
  if (declared !== null && (typeof declared !== "string" || !SHA256.test(declared))) return false;
  const attempts = value.attempts;
  if (!Array.isArray(attempts) || attempts.length > 2 || !attempts.every(isAttempt)) return false;
  if (attempts.length === 2 && (attempts[0].outcome === "CONCUR" || attempts[0].reviewerInputFingerprint === attempts[1].reviewerInputFingerprint)) return false;
  const lifecycle = value as unknown as ReviewLifecycle;
  const status = lifecycleStatus(lifecycle);
  // closedByOwner is only ever set on an open or escalated lifecycle.
  if (lifecycle.closedByOwner && status === "CONCUR") return false;
  // An open lifecycle exists only from a declaration onwards.
  if (declared === null) return status !== "OPEN" || attempts.length > 0;
  // A pending declaration exists only where a next attempt may run, and never for content already reviewed.
  return status === "OPEN" && !attempts.some((attempt) => attempt.reviewerInputFingerprint === declared);
}

export function readReviewLifecycleState(lifecycleDir: string): { ok: true; state: ReviewLifecycleState } | { ok: false; message: string } {
  const file = join(lifecycleDir, STATE_FILE);
  if (!existsSync(file)) return { ok: true, state: { schemaVersion: "1", lifecycles: [] } };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return { ok: false, message: `${file} is not valid JSON: ${(error as Error).message}` };
  }
  if (!isObject(raw) || raw.schemaVersion !== "1" || !Array.isArray(raw.lifecycles) || !raw.lifecycles.every(isLifecycle)) {
    return { ok: false, message: `${file} is structurally invalid; it is never reset automatically` };
  }
  return { ok: true, state: raw as unknown as ReviewLifecycleState };
}

function writeReviewLifecycleState(lifecycleDir: string, state: ReviewLifecycleState): void {
  mkdirSync(lifecycleDir, { recursive: true });
  const file = join(lifecycleDir, STATE_FILE);
  writeFileSync(`${file}.tmp`, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(`${file}.tmp`, file);
}

// --- in-flight claim ---------------------------------------------------------

/**
 * Atomically claims the store for one execution; false when another execution
 * holds it. The claim is the mutex for every lifecycle state mutation: an
 * owner declaration holds it across its read/validate/write, a semantic
 * attempt across its check/invoke/record.
 */
function acquireClaim(lifecycleDir: string, holder: { operation: "DECLARE_READY" | "SEMANTIC_ATTEMPT"; reviewerInputFingerprint: string }): boolean {
  mkdirSync(lifecycleDir, { recursive: true });
  let fd: number;
  try {
    fd = openSync(join(lifecycleDir, CLAIM_FILE), "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
  try {
    writeFileSync(fd, `${JSON.stringify(holder)}\n`, "utf8");
  } finally {
    closeSync(fd);
  }
  return true;
}

function releaseClaim(lifecycleDir: string): void {
  rmSync(join(lifecycleDir, CLAIM_FILE), { force: true });
}

/**
 * Test-only seam for deterministic interleaving; never set by tooling.
 * `afterDeclarationRead` runs while a declaration holds the claim, between
 * reading and writing the state.
 */
export const reviewLifecycleTestHooks: { afterDeclarationRead?: () => void } = {};

const IN_FLIGHT_MESSAGE = `another execution holds the review lifecycle (${CLAIM_FILE}); if no review is running, the owner removes that file`;

// --- owner readiness -------------------------------------------------------

export type LifecycleRejection = { ok: false; failedCheck: string; message: string };

function reject(failedCheck: string, message: string): LifecycleRejection {
  return { ok: false, failedCheck, message };
}

export interface OwnerReadyOptions {
  /**
   * The owner ends the governing lifecycle and starts a new one. Permitted
   * only where a bounded correction is not available: the lifecycle escalated
   * to the owner, or the correction needs a different base or target set.
   */
  newLifecycle?: boolean;
}

/**
 * Records the owner's declaration that exactly `subject`'s reviewer input is
 * ready for its next semantic attempt, enforcing the transition rules. Never
 * invokes a reviewer.
 */
export function declareOwnerReady(
  lifecycleDir: string,
  subject: ReviewSubject,
  options: OwnerReadyOptions = {},
): { ok: true; semanticAttempt: SemanticAttemptNumber } | LifecycleRejection {
  // A declaration never changes under a running attempt, and no attempt is recorded under a declaration.
  if (!acquireClaim(lifecycleDir, { operation: "DECLARE_READY", reviewerInputFingerprint: subject.reviewerInputFingerprint })) {
    return reject(REVIEW_LIFECYCLE_CHECK.ATTEMPT_IN_FLIGHT, IN_FLIGHT_MESSAGE);
  }
  try {
    return declareUnderClaim(lifecycleDir, subject, options);
  } finally {
    releaseClaim(lifecycleDir);
  }
}

function declareUnderClaim(lifecycleDir: string, subject: ReviewSubject, options: OwnerReadyOptions): { ok: true; semanticAttempt: SemanticAttemptNumber } | LifecycleRejection {
  const read = readReviewLifecycleState(lifecycleDir);
  if (!read.ok) return reject(REVIEW_LIFECYCLE_CHECK.STATE_INVALID, read.message);
  reviewLifecycleTestHooks.afterDeclarationRead?.();
  const state = read.state;
  let active = governing(state, subject);

  if (options.newLifecycle) {
    const correctable = active.find((lifecycle) => lifecycleStatus(lifecycle) === "OPEN" && sameScope(lifecycle, subject));
    if (correctable) {
      return reject(
        REVIEW_LIFECYCLE_CHECK.NEW_LIFECYCLE_NOT_PERMITTED,
        `the open lifecycle for ${describeScope(correctable)} still permits its bounded correction; declare the corrected content without --new-lifecycle`,
      );
    }
    for (const lifecycle of active) {
      lifecycle.closedByOwner = true;
      lifecycle.declaredReviewerInputFingerprint = null;
    }
    active = [];
  }

  if (active.length > 0) {
    const lifecycle = active.find((candidate) => sameScope(candidate, subject));
    if (!lifecycle || active.length > 1) {
      return reject(
        REVIEW_LIFECYCLE_CHECK.CORRECTION_OUT_OF_BOUNDS,
        `a bounded correction keeps the reviewed base and target set (${active.map(describeScope).join("; ")}); this content has ${describeScope(subject)}. ` +
          "Widening the review is a new lifecycle: the owner must declare it with --new-lifecycle",
      );
    }
    if (lifecycleStatus(lifecycle) === "OWNER_ESCALATION") {
      return reject(
        REVIEW_LIFECYCLE_CHECK.OWNER_ESCALATION,
        `semantic attempts 1 and 2 for ${describeScope(lifecycle)} were both non-CONCUR; control is with the owner and no further attempt runs in this lifecycle`,
      );
    }
    if (lifecycle.attempts.some((attempt) => attempt.reviewerInputFingerprint === subject.reviewerInputFingerprint)) {
      return reject(
        REVIEW_LIFECYCLE_CHECK.CORRECTION_UNCHANGED,
        "this exact reviewer input already received a valid non-CONCUR review; semantic attempt 2 requires corrected content",
      );
    }
    lifecycle.declaredReviewerInputFingerprint = subject.reviewerInputFingerprint;
    writeReviewLifecycleState(lifecycleDir, state);
    return { ok: true, semanticAttempt: (lifecycle.attempts.length + 1) as SemanticAttemptNumber };
  }

  const reviewed = state.lifecycles.flatMap((lifecycle) => lifecycle.attempts).filter((attempt) => attempt.reviewerInputFingerprint === subject.reviewerInputFingerprint);
  if (reviewed.some((attempt) => attempt.outcome !== "CONCUR")) {
    return reject(REVIEW_LIFECYCLE_CHECK.CORRECTION_UNCHANGED, "this exact reviewer input already received a valid non-CONCUR review; it is never reviewed again unchanged");
  }
  if (reviewed.length > 0 && !options.newLifecycle) {
    return reject(REVIEW_LIFECYCLE_CHECK.ALREADY_CONCUR, "this exact reviewer input already received CONCUR; its review artifact and receipt remain valid");
  }
  state.lifecycles.push({ baseGitSha: subject.baseGitSha, targets: subject.targets, declaredReviewerInputFingerprint: subject.reviewerInputFingerprint, attempts: [], closedByOwner: false });
  writeReviewLifecycleState(lifecycleDir, state);
  return { ok: true, semanticAttempt: 1 };
}

/**
 * Whether `subject` may be reviewed now, and as which semantic attempt. Pure
 * over the stored state; the deterministic precondition for every reviewer
 * invocation.
 */
export function checkSemanticAttempt(
  lifecycleDir: string,
  subject: ReviewSubject,
): { ok: true; semanticAttempt: SemanticAttemptNumber } | LifecycleRejection {
  const read = readReviewLifecycleState(lifecycleDir);
  if (!read.ok) return reject(REVIEW_LIFECYCLE_CHECK.STATE_INVALID, read.message);
  const active = governing(read.state, subject);
  const lifecycle = active.find((candidate) => sameScope(candidate, subject));
  if (!lifecycle) {
    return active.length > 0
      ? reject(REVIEW_LIFECYCLE_CHECK.CORRECTION_OUT_OF_BOUNDS, `this content (${describeScope(subject)}) is outside the governing lifecycle (${active.map(describeScope).join("; ")})`)
      : reject(REVIEW_LIFECYCLE_CHECK.NOT_DECLARED_READY, "the owner has not declared this exact content ready for semantic review");
  }
  if (lifecycleStatus(lifecycle) === "OWNER_ESCALATION") {
    return reject(REVIEW_LIFECYCLE_CHECK.OWNER_ESCALATION, `semantic attempts 1 and 2 for ${describeScope(lifecycle)} were both non-CONCUR; no third attempt is invoked`);
  }
  if (lifecycle.declaredReviewerInputFingerprint === null) {
    return reject(
      REVIEW_LIFECYCLE_CHECK.NOT_DECLARED_READY,
      lifecycle.attempts.length === 0
        ? "the owner has not declared this exact content ready for semantic review"
        : "semantic attempt 1 was non-CONCUR; the owner must declare the corrected content ready before semantic attempt 2",
    );
  }
  if (lifecycle.declaredReviewerInputFingerprint !== subject.reviewerInputFingerprint) {
    return reject(REVIEW_LIFECYCLE_CHECK.READINESS_STALE, "the content changed after the owner declared it ready; declare the current content ready again");
  }
  return { ok: true, semanticAttempt: (lifecycle.attempts.length + 1) as SemanticAttemptNumber };
}

// --- one semantic attempt ---------------------------------------------------

/** Lifecycle position after a valid review. */
export type SemanticAttemptResult = "CONCUR" | "CORRECTION_PERMITTED" | "OWNER_ESCALATION";

export type OwnerDeclaredReview =
  | { status: "REJECTED"; failedCheck: string; message: string }
  | { status: typeof TOOLING_RUNTIME_FAILURE; semanticAttempt: SemanticAttemptNumber; failedCheck: string; message: string }
  | { status: "REVIEWED"; semanticAttempt: SemanticAttemptNumber; result: SemanticAttemptResult; review: IndependentReviewResult };

/**
 * Runs the one semantic attempt the lifecycle permits for `reviewerInput`:
 * rejected before invocation unless the owner declared exactly this input
 * ready and an attempt remains. A valid review — whatever its outcome — is
 * recorded as that attempt and consumes the declaration; a tooling/runtime
 * failure records nothing. The attempt runs under the store's claim, so a
 * competing execution is rejected before it invokes the reviewer.
 */
export function runOwnerDeclaredReview(lifecycleDir: string, invoker: AiInvoker, reviewerInput: ReviewerInputPackage, workbenchDir: string): OwnerDeclaredReview {
  const subject = reviewSubject(reviewerInput);
  const permitted = checkSemanticAttempt(lifecycleDir, subject);
  if (!permitted.ok) return { status: "REJECTED", failedCheck: permitted.failedCheck, message: permitted.message };
  if (!acquireClaim(lifecycleDir, { operation: "SEMANTIC_ATTEMPT", reviewerInputFingerprint: subject.reviewerInputFingerprint })) {
    return { status: "REJECTED", failedCheck: REVIEW_LIFECYCLE_CHECK.ATTEMPT_IN_FLIGHT, message: IN_FLIGHT_MESSAGE };
  }

  try {
    // Re-checked under the claim: what was read before claiming may already have been consumed.
    const claimed = checkSemanticAttempt(lifecycleDir, subject);
    if (!claimed.ok) return { status: "REJECTED", failedCheck: claimed.failedCheck, message: claimed.message };
    if (claimed.semanticAttempt !== permitted.semanticAttempt) return lifecycleChanged();

    const invocation = invokeIndependentReview(invoker, reviewerInput, workbenchDir);
    if (invocation.status === "FAILED") {
      return { status: TOOLING_RUNTIME_FAILURE, semanticAttempt: claimed.semanticAttempt, failedCheck: invocation.failedCheck, message: invocation.message };
    }

    // Recorded only while the same lifecycle, declaration and attempt are still authoritative.
    const read = readReviewLifecycleState(lifecycleDir);
    if (!read.ok) return { status: "REJECTED", failedCheck: REVIEW_LIFECYCLE_CHECK.STATE_INVALID, message: read.message };
    const lifecycle = governing(read.state, subject).find((candidate) => sameScope(candidate, subject));
    if (
      !lifecycle ||
      lifecycleStatus(lifecycle) !== "OPEN" ||
      lifecycle.declaredReviewerInputFingerprint !== subject.reviewerInputFingerprint ||
      lifecycle.attempts.length + 1 !== claimed.semanticAttempt
    ) {
      return lifecycleChanged();
    }
    lifecycle.attempts.push({
      semanticAttempt: claimed.semanticAttempt,
      reviewerInputFingerprint: subject.reviewerInputFingerprint,
      outcome: invocation.review.outcome,
      reviewSha256: sha256Hex(invocation.review),
      technicalCalls: invocation.technicalCalls,
    });
    lifecycle.declaredReviewerInputFingerprint = null;
    writeReviewLifecycleState(lifecycleDir, read.state);

    const status = lifecycleStatus(lifecycle);
    const result: SemanticAttemptResult = status === "CONCUR" ? "CONCUR" : status === "OWNER_ESCALATION" ? "OWNER_ESCALATION" : "CORRECTION_PERMITTED";
    return { status: "REVIEWED", semanticAttempt: claimed.semanticAttempt, result, review: invocation.review };
  } finally {
    releaseClaim(lifecycleDir);
  }
}

function lifecycleChanged(): OwnerDeclaredReview {
  return {
    status: "REJECTED",
    failedCheck: REVIEW_LIFECYCLE_CHECK.STATE_INVALID,
    message: "the governing lifecycle, declaration or attempt changed during the review; nothing was recorded",
  };
}
