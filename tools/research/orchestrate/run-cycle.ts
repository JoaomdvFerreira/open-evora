/**
 * WU045-B01 remediation: drives the normal path from an accepted
 * RESEARCH_TRIGGER through both required OD-B AI invocations to
 * READY_FOR_HUMAN_REVIEW, with zero normal-path human handoffs
 * (docs/design/m013-launch-automation-contract.md §4, §5, §11).
 *
 * Sequence (contract §4):
 *   RESEARCH_TRIGGER
 *   -> PRIMARY AI INVOCATION (role PRIMARY_AUTHOR)
 *   -> validate structured authoring result
 *   -> materialize noncanonical candidate/manifest artifacts into the
 *      gitignored workbench
 *   -> deterministic candidate/delta/validation/readiness/review-plan
 *      preparation (research-change-set.ts, reusing §6 primitives)
 *   -> freeze the immutable reviewer input (reviewer-input.ts)
 *   -> FRESH INDEPENDENT REVIEW AI INVOCATION (role INDEPENDENT_REVIEWER,
 *      a brand-new process — see ai-invoker.ts)
 *   -> validate the independent-review result
 *   -> assemble the WU045 Research Change Set
 *   -> READY_FOR_HUMAN_REVIEW
 *
 * No failure branch below ever reaches READY_FOR_HUMAN_REVIEW (contract §9).
 * This module never calls applyCanonicalIntegrationPlan() and never writes
 * under research/ — see research-change-set.ts, which this module composes
 * with but does not modify.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { CandidateRecord } from "../integration/candidate-delta.ts";
import type { CorpusIndex } from "../core/types.ts";
import { prepareCanonicalIntegrationReview } from "../integration/canonical-integration-review.ts";
import type { AiInvoker } from "./ai-invoker.ts";
import { asValidatedAuthoringEnvelope, validateAuthoringEnvelope } from "./authoring-envelope.ts";
import { loadCandidates } from "./candidate-loader.ts";
import { asValidatedIndependentReview, validateIndependentReview } from "./independent-review.ts";
import { sha256Hex } from "./fingerprint.ts";
import { asValidatedManifest, validateManifest } from "./manifest.ts";
import { resolveContainedPath } from "./path-containment.ts";
import { buildPrimaryAuthoringPrompt } from "./primary-prompt.ts";
import { assembleResearchChangeSet } from "./research-change-set.ts";
import { buildReviewerInput } from "./reviewer-input.ts";
import { buildReviewerPrompt } from "./reviewer-prompt.ts";
import type { GenerationManifest, PreparationOutcome, ResearchTrigger } from "./types.ts";
import { deriveMaterialNonPrivateSources, evaluateSafetyAdmission, type InferenceLimitResolutionChecker, type SourceAvailabilityAdapter } from "../admission/safety-admission.ts";
import { writeSafetyHoldReport } from "../admission/hold-report.ts";

export interface RunResearchCycleInput {
  trigger: ResearchTrigger;
  index: CorpusIndex;
  baseGitSha: string;
  /** Gitignored cycle directory (already boundary-checked by the caller). */
  cycleDir: string;
  primaryInvoker: AiInvoker;
  reviewerInvoker: AiInvoker;
  /**
   * Narrow, injectable read-only same-Source availability boundary. Takes
   * precedence over `resolveAvailabilityAdapter` below when both are
   * supplied (tests use this synchronous form directly).
   */
  availabilityAdapter?: SourceAvailabilityAdapter;
  /**
   * Async factory invoked once, immediately before admission, with exactly
   * the material non-private Source set this cycle's frozen candidates
   * produce (see safety-admission.ts's deriveMaterialNonPrivateSources()).
   * Lets the normal CLI path perform real, live availability requests
   * (necessarily asynchronous) without duplicating material-Source
   * derivation or invoking AI twice. Ignored when `availabilityAdapter` is
   * supplied directly.
   */
  resolveAvailabilityAdapter?: (materialSources: ReadonlyMap<string, Record<string, unknown>>) => Promise<SourceAvailabilityAdapter>;
  /** Only ever consulted for CLAIM_INFERENCE_LIMITS_PRESENT; absent = always blocking. */
  inferenceLimitResolutionChecker?: InferenceLimitResolutionChecker;
  /** Injectable clock for deterministic tests; admission evidence is runtime-only. */
  now?: () => Date;
}

function failed(failedCheck: string, message: string): PreparationOutcome {
  return { status: "FAILED", failedCheck, message };
}

function parseJsonStdout(stdout: string, failedCheck: string): { value: unknown } | { failure: PreparationOutcome } {
  try {
    return { value: JSON.parse(stdout) };
  } catch (error) {
    return { failure: failed(failedCheck, `stdout was not valid JSON: ${(error as Error).message}`) };
  }
}

/**
 * Materializes the validated primary-authoring envelope into the cycle
 * directory: manifest.json plus every candidate YAML file, written by the
 * orchestrator itself (never by the AI process, which only ever returns
 * structured text on stdout — contract §5 "Preferred pattern").
 *
 * `file.path` is untrusted AI-authored input (WU045-B01 independent-review
 * remediation, finding 2). `authoring-envelope.ts`'s structural validation
 * has already rejected traversal/absolute/rooted shapes before this
 * function runs, but that alone is not sufficient (a symlink placed inside
 * `candidatesDir` could still point outside it) — every target is
 * additionally resolved through resolveContainedPath() immediately before
 * the write, and the write is refused (not silently skipped) if containment
 * fails, so a bypass of the structural layer cannot still reach the
 * filesystem.
 */
function materializeAuthoringEnvelope(
  cycleDir: string,
  envelope: ReturnType<typeof asValidatedAuthoringEnvelope>
): { ok: true } | { ok: false; message: string } {
  const candidatesDir = join(cycleDir, "candidates");
  mkdirSync(candidatesDir, { recursive: true });
  writeFileSync(join(cycleDir, "manifest.json"), `${JSON.stringify(envelope.manifest, null, 2)}\n`, "utf8");
  for (const file of envelope.candidateFiles) {
    const containment = resolveContainedPath(candidatesDir, file.path);
    if (!containment.ok) {
      return { ok: false, message: `refusing to write candidate file: ${containment.reason}` };
    }
    const target = containment.absolutePath;
    mkdirSync(dirname(target), { recursive: true });
    // Re-check containment after directory creation: creating the parent
    // could itself have changed what realpathSync() resolves to only if a
    // symlink was substituted concurrently, which resolveContainedPath()'s
    // caller-side single-process model does not allow — this second check
    // is defense in depth, not a response to a known live gap.
    const postMkdirContainment = resolveContainedPath(candidatesDir, file.path);
    if (!postMkdirContainment.ok) {
      return { ok: false, message: `refusing to write candidate file: ${postMkdirContainment.reason}` };
    }
    writeFileSync(postMkdirContainment.absolutePath, file.yaml, "utf8");
  }
  return { ok: true };
}

/**
 * Deterministic binding fingerprint over exactly the frozen material a
 * pre-Gate HOLD must be resumed against: the manifest and the candidates
 * loaded from it (in the same order loadCandidates() returns them). Reuses
 * the project's one canonical-serialization/SHA-256 convention
 * (fingerprint.ts) rather than introducing a second hashing rule. F3
 * (resumable pre-Gate HOLD): this is what ties a resume attempt to the exact
 * frozen candidates a prior HOLD evaluated, so a resume can never silently
 * operate against edited/replaced/stale on-disk content.
 */
export function frozenCandidateFingerprint(manifest: GenerationManifest, candidates: readonly CandidateRecord[]): string {
  return sha256Hex({ manifest, candidates });
}

/**
 * Everything from "already have a validated manifest + loaded candidates"
 * through final RCS assembly, shared identically by the normal AI-driven
 * path (runResearchCycle(), after its own PRIMARY_AUTHOR invocation and
 * materialization) and the F3 resume path (resumePreGateHold(), which loads
 * the exact frozen manifest/candidates from a prior HOLD instead of
 * invoking PRIMARY_AUTHOR again). Extracting this as one shared function is
 * what guarantees resume can never diverge from the normal path's
 * prospective-validation/availability/admission/reviewer/assembly logic —
 * there is no second, parallel implementation of any of those steps.
 */
/**
 * Exported (beyond this module's own two callers) so a bounded, distinct
 * orchestration path can re-verify and re-run the exact same prospective-
 * validation -> freeze -> availability -> admission -> reviewer -> assembly
 * sequence against frozen candidates it did not itself derive — see
 * revalidate-frozen-cycle.ts. That module still never invokes
 * PRIMARY_AUTHOR: it reaches this function the same way resumePreGateHold()
 * does, by loading an already-frozen manifest/candidates from disk.
 */
export async function continueFromFrozenCandidates(
  cycleDir: string,
  baseGitSha: string,
  index: CorpusIndex,
  manifest: GenerationManifest,
  candidates: readonly CandidateRecord[],
  reviewerInvoker: AiInvoker,
  availabilityAdapter: SourceAvailabilityAdapter | undefined,
  resolveAvailabilityAdapter: ((materialSources: ReadonlyMap<string, Record<string, unknown>>) => Promise<SourceAvailabilityAdapter>) | undefined,
  inferenceLimitResolutionChecker: InferenceLimitResolutionChecker | undefined,
  now: (() => Date) | undefined
): Promise<PreparationOutcome> {
  // Reuse the existing deterministic review-preparation primitive (§6)
  // directly, purely to obtain the candidates/deltas/validation/readiness
  // the reviewer input requires before any independent-review result
  // exists. This performs no canonical write and duplicates no logic —
  // it is the same primitive prepareResearchChangeSet() calls internally.
  // If the candidate set is structurally invalid, the final
  // prepareResearchChangeSet() call below independently fails closed on
  // the same input with the same failedCheck; this step only ever gates
  // whether the reviewer is invoked at all.
  let review;
  try {
    review = prepareCanonicalIntegrationReview(baseGitSha, index, candidates);
  } catch (error) {
    return failed("PROSPECTIVE_VALIDATION", (error as Error).message);
  }
  if (review.validation.errors.length > 0) {
    return failed("PROSPECTIVE_VALIDATION", review.validation.errors.join("; "));
  }
  if (review.readiness !== "READY_FOR_INTEGRATION_GATE") {
    return failed("READINESS", "canonical integration review did not reach READY_FOR_INTEGRATION_GATE");
  }

  // --- CANDIDATE FREEZE -> MATERIAL SOURCE REVALIDATION -> SAFETY ADMISSION --
  // No reviewer, RCS, or Human Gate package can be reached on HOLD.
  const frozenAt = (now?.() ?? new Date()).toISOString();
  const affectedProblemIds = [
    ...new Set([
      ...review.deltas.filter((delta) => delta.recordFamily === "PRB-").map((delta) => delta.id),
      ...(manifest.mode === "problem-refresh" && manifest.targetProblemId ? [manifest.targetProblemId] : []),
    ]),
  ].sort();

  // Real availability requests happen here, strictly after freeze, so
  // `checkedAt` can never precede `frozenAt`. The resolved adapter only ever
  // covers the exact material non-private Source set the frozen candidates
  // produce (deriveMaterialNonPrivateSources() — the same derivation
  // evaluateSafetyAdmission() uses internally), never a broader or narrower
  // set computed a second way. A resume always reaches this same real
  // (never cached/reused) availability check.
  let resolvedAvailabilityAdapter = availabilityAdapter;
  if (!resolvedAvailabilityAdapter && resolveAvailabilityAdapter) {
    const materialSources = deriveMaterialNonPrivateSources({ index, candidates: review.candidates, affectedProblemIds, frozenAt, evaluatedAt: frozenAt });
    resolvedAvailabilityAdapter = await resolveAvailabilityAdapter(materialSources);
  }

  const evaluatedAt = (now?.() ?? new Date()).toISOString();
  const admission = evaluateSafetyAdmission({ index, candidates: review.candidates, affectedProblemIds, frozenAt, evaluatedAt, baseGitSha, availabilityAdapter: resolvedAvailabilityAdapter, inferenceLimitResolutionChecker });
  if (admission.disposition === "HOLD") {
    return { status: "PRE_GATE_SAFETY_HOLD", admission, holdReportPath: writeSafetyHoldReport(cycleDir, baseGitSha, admission) };
  }

  // --- FREEZE THE IMMUTABLE REVIEWER INPUT -----------------------------------
  const reviewerInputJson = buildReviewerInput({
    baseGitSha,
    manifest,
    candidates: review.candidates,
    deltas: review.deltas,
    validation: review.validation,
    readiness: review.readiness,
  });

  // --- FRESH INDEPENDENT REVIEW AI INVOCATION --------------------------------
  // Invoked only now that admission is provably ELIGIBLE (never on a
  // resume that is still HOLD), and always a brand-new invocation — never
  // the same invoker/process used for PRIMARY_AUTHOR.
  const reviewerPrompt = buildReviewerPrompt(reviewerInputJson);
  const reviewerResult = reviewerInvoker.invoke({ role: "INDEPENDENT_REVIEWER", input: reviewerPrompt });

  if (reviewerResult.status === "TIMEOUT") {
    return failed("INDEPENDENT_REVIEW_TIMEOUT", reviewerResult.message);
  }
  if (reviewerResult.status === "INVOCATION_FAILED") {
    return failed("INDEPENDENT_REVIEW_INVOCATION_FAILED", reviewerResult.message);
  }

  const reviewerParsed = parseJsonStdout(reviewerResult.stdout, "INDEPENDENT_REVIEW_OUTPUT_INVALID");
  if ("failure" in reviewerParsed) return reviewerParsed.failure;

  const reviewValidation = validateIndependentReview(reviewerParsed.value);
  if (reviewValidation.errors.length > 0) {
    return failed("INDEPENDENT_REVIEW_OUTPUT_INVALID", reviewValidation.errors.join("; "));
  }
  const independentReview = asValidatedIndependentReview(reviewerParsed.value);

  // Persist the real independent-review result so a rerun (WU048 case 20)
  // observes the same on-disk artifact this run actually produced.
  writeFileSync(join(cycleDir, "independent-review.json"), `${JSON.stringify(independentReview, null, 2)}\n`, "utf8");

  // --- ASSEMBLE THE FINAL RESEARCH CHANGE SET --------------------------------
  // Assembles directly from the exact `review` object computed above (the
  // same one buildReviewerInput() used to freeze the reviewer's input) and
  // the real, freshly-invoked independent-review result — never by
  // re-reading candidate files from disk and re-deriving a second,
  // potentially-divergent snapshot (WU045-B01 independent-review
  // remediation, finding 3). This is the only call whose output is ever
  // returned as READY_FOR_HUMAN_REVIEW.
  return assembleResearchChangeSet(index, manifest, review, independentReview, admission);
}

/**
 * Runs the complete WU045 normal-path sequence for one cycle, including
 * both required OD-B AI invocations. Fails closed at the first problem,
 * reporting exactly which check failed — matching
 * prepareResearchChangeSet()'s existing fail-closed convention, which this
 * function delegates to for every deterministic step downstream of the two
 * AI invocations it adds.
 */
export async function runResearchCycle(input: RunResearchCycleInput): Promise<PreparationOutcome> {
  // --- PRIMARY AI INVOCATION -------------------------------------------------
  const primaryPrompt = buildPrimaryAuthoringPrompt(input.trigger);
  const primaryResult = input.primaryInvoker.invoke({ role: "PRIMARY_AUTHOR", input: primaryPrompt });

  if (primaryResult.status === "TIMEOUT") {
    return failed("PRIMARY_AI_TIMEOUT", primaryResult.message);
  }
  if (primaryResult.status === "INVOCATION_FAILED") {
    return failed("PRIMARY_AI_INVOCATION_FAILED", primaryResult.message);
  }

  const primaryParsed = parseJsonStdout(primaryResult.stdout, "PRIMARY_AI_OUTPUT_INVALID");
  if ("failure" in primaryParsed) return primaryParsed.failure;

  const envelopeValidation = validateAuthoringEnvelope(primaryParsed.value);
  if (envelopeValidation.errors.length > 0) {
    return failed("PRIMARY_AI_OUTPUT_INVALID", envelopeValidation.errors.join("; "));
  }
  const envelope = asValidatedAuthoringEnvelope(primaryParsed.value);

  // --- MATERIALIZE INTO THE GITIGNORED WORKBENCH -----------------------------
  const materialization = materializeAuthoringEnvelope(input.cycleDir, envelope);
  if (!materialization.ok) {
    return failed("PRIMARY_AI_OUTPUT_INVALID", materialization.message);
  }

  // --- DETERMINISTIC CANDIDATE LOAD (needed to freeze reviewer input) -------
  const candidatesDir = join(input.cycleDir, "candidates");
  const loadResult = loadCandidates(input.index, candidatesDir, envelope.manifest.candidateFiles);
  if (loadResult.failures.length > 0) {
    return failed(
      "CANDIDATE_LOAD",
      loadResult.failures.map((failure) => `${failure.file}: ${failure.message}`).join("; ")
    );
  }

  const outcome = await continueFromFrozenCandidates(
    input.cycleDir,
    input.baseGitSha,
    input.index,
    envelope.manifest,
    loadResult.candidates,
    input.reviewerInvoker,
    input.availabilityAdapter,
    input.resolveAvailabilityAdapter,
    input.inferenceLimitResolutionChecker,
    input.now
  );

  // F3 (resumable pre-Gate HOLD): a HOLD from the normal path is only ever
  // resumable if the exact frozen manifest/candidates it evaluated are
  // independently recoverable and re-verifiable later — write the binding
  // record now, from the same in-memory manifest/candidates just evaluated,
  // never re-derived. Never written on any other outcome: a resume must
  // only ever exist for a genuine, freshly-observed HOLD.
  if (outcome.status === "PRE_GATE_SAFETY_HOLD") {
    writeHoldFreeze(input.cycleDir, {
      schemaVersion: "1",
      baseGitSha: input.baseGitSha,
      identity: { kind: "TRIGGER", trigger: input.trigger },
      candidateFingerprint: frozenCandidateFingerprint(envelope.manifest, loadResult.candidates),
    });
  }

  return outcome;
}

export function cycleArtifactsExist(cycleDir: string): boolean {
  return existsSync(join(cycleDir, "manifest.json"));
}

// --- F3: resumable pre-Gate HOLD ------------------------------------------

/**
 * Identifies a HOLD's origin as the normal AI-driven path — resume must
 * reproduce the same accepted trigger.
 */
export interface TriggerHoldIdentity {
  kind: "TRIGGER";
  trigger: ResearchTrigger;
}

/**
 * Identifies a HOLD's origin as the bounded frozen-cycle base-revalidation
 * path (see revalidate-frozen-cycle.ts) — resume must reproduce the exact
 * source cycle and base-transition identity that HOLD was frozen against,
 * never a trigger (this path never has one).
 */
export interface BaseRevalidationHoldIdentity {
  kind: "BASE_REVALIDATION";
  sourceCycleDir: string;
  oldBaseGitSha: string;
}

export type HoldIdentity = TriggerHoldIdentity | BaseRevalidationHoldIdentity;

/**
 * The on-disk binding record a pre-Gate HOLD leaves behind, verified before
 * any resume. One shape, one resume mechanism, for both HOLD origins
 * (normal-path trigger and base revalidation) — see `identity` — so a HOLD
 * produced by either path is resumable through the same hold-cli.ts
 * `resume` operator action rather than maintaining a second, incompatible
 * freeze/resume protocol.
 */
export interface HoldFreezeRecord {
  schemaVersion: "1";
  baseGitSha: string;
  identity: HoldIdentity;
  /** frozenCandidateFingerprint() over the exact manifest/candidates this HOLD evaluated. */
  candidateFingerprint: string;
}

function holdFreezePath(cycleDir: string): string {
  return join(cycleDir, "hold-freeze.json");
}

/**
 * Exported so a bounded, distinct orchestration path that reaches a fresh
 * HOLD via continueFromFrozenCandidates() (see revalidate-frozen-cycle.ts)
 * can write the exact same binding-record shape this module's own callers
 * use, keyed to its own `BaseRevalidationHoldIdentity` — rather than
 * maintaining a second, incompatible freeze record shape/writer.
 */
export function writeHoldFreeze(cycleDir: string, record: HoldFreezeRecord): void {
  writeFileSync(holdFreezePath(cycleDir), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

function triggersMatch(a: ResearchTrigger, b: ResearchTrigger): boolean {
  return a.mode === b.mode && a.targetProblemId === b.targetProblemId && a.request === b.request;
}

function identitiesMatch(a: HoldIdentity, b: HoldIdentity): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "TRIGGER" && b.kind === "TRIGGER") return triggersMatch(a.trigger, b.trigger);
  if (a.kind === "BASE_REVALIDATION" && b.kind === "BASE_REVALIDATION") {
    return a.sourceCycleDir === b.sourceCycleDir && a.oldBaseGitSha === b.oldBaseGitSha;
  }
  return false;
}

export type HoldFreezeCheckResult =
  | { ok: true; record: HoldFreezeRecord }
  | { ok: false; reason: string };

function isValidHoldIdentityShape(value: unknown): value is HoldIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const identity = value as Record<string, unknown>;
  if (identity.kind === "TRIGGER") {
    return !!identity.trigger && typeof identity.trigger === "object";
  }
  if (identity.kind === "BASE_REVALIDATION") {
    return typeof identity.sourceCycleDir === "string" && typeof identity.oldBaseGitSha === "string";
  }
  return false;
}

/**
 * Structural check for the pre-PR#127 v1 on-disk shape: schemaVersion "1"
 * with a flat `trigger` field and no `identity` (every unresolved HOLD
 * produced by the released normal path before this remediation). Distinct
 * from `isValidHoldIdentityShape()`, which checks the current in-memory
 * `HoldIdentity` shape — this checks the legacy on-disk field name.
 */
function isValidLegacyTriggerShape(value: unknown): value is ResearchTrigger {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Reads and validates the hold-freeze binding record at `cycleDir`, if any,
 * and verifies it matches `baseGitSha`/`identity` exactly. Never throws: a
 * missing file, malformed JSON, structurally invalid record, or
 * base-SHA/identity mismatch are all reported as a resume-blocking reason
 * (fail closed) rather than crashing or silently resuming against the wrong
 * identity.
 *
 * Backward compatibility (PR #127 remediation, compatibility finding): a
 * pre-PR#127 v1 record on disk never has `identity` — it has a flat
 * `trigger` field instead (the normal path's only HOLD origin before the
 * bounded base-revalidation path existed). Every such HOLD left unresolved
 * by the currently released normal path must remain resumable after this
 * change merges. When `record.identity` is absent/invalid, schemaVersion is
 * "1", and a structurally valid legacy `trigger` is present, that trigger is
 * normalized in memory to `{ kind: "TRIGGER", trigger }` and checked exactly
 * as a native `identity` would be. The on-disk file is never rewritten by
 * this read — only resume's own re-freeze (on a still-HOLD outcome) ever
 * upgrades it to the new shape. A record with neither a valid `identity` nor
 * a valid legacy `trigger` remains fail-closed.
 */
export function readHoldFreeze(cycleDir: string, baseGitSha: string, identity: HoldIdentity): HoldFreezeCheckResult {
  const file = holdFreezePath(cycleDir);
  if (!existsSync(file)) {
    return { ok: false, reason: "no pre-Gate HOLD binding record present at this cycle directory (hold-freeze.json)" };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return { ok: false, reason: `hold-freeze.json is not valid JSON: ${(error as Error).message}` };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "hold-freeze.json is structurally invalid" };
  }
  const record = raw as Record<string, unknown>;
  if (
    record.schemaVersion !== "1" ||
    typeof record.baseGitSha !== "string" ||
    typeof record.candidateFingerprint !== "string"
  ) {
    return { ok: false, reason: "hold-freeze.json is structurally invalid" };
  }
  let recordIdentity: HoldIdentity;
  if (isValidHoldIdentityShape(record.identity)) {
    recordIdentity = record.identity;
  } else if (record.identity === undefined && isValidLegacyTriggerShape(record.trigger)) {
    recordIdentity = { kind: "TRIGGER", trigger: record.trigger };
  } else {
    return { ok: false, reason: "hold-freeze.json is structurally invalid" };
  }
  if (record.baseGitSha !== baseGitSha) {
    return { ok: false, reason: "hold-freeze.json base Git SHA does not match the resume request" };
  }
  if (!identitiesMatch(recordIdentity, identity)) {
    return { ok: false, reason: "hold-freeze.json identity does not match the resume request" };
  }
  return { ok: true, record: { ...record, identity: recordIdentity } as unknown as HoldFreezeRecord };
}

export interface ResumeHoldByIdentityInput {
  index: CorpusIndex;
  baseGitSha: string;
  identity: HoldIdentity;
  /** Gitignored cycle directory of the exact prior HOLD (already boundary-checked by the caller). */
  cycleDir: string;
  /** A brand-new invocation target — never the invoker used for the original PRIMARY_AUTHOR call. */
  reviewerInvoker: AiInvoker;
  availabilityAdapter?: SourceAvailabilityAdapter;
  resolveAvailabilityAdapter?: (materialSources: ReadonlyMap<string, Record<string, unknown>>) => Promise<SourceAvailabilityAdapter>;
  inferenceLimitResolutionChecker?: InferenceLimitResolutionChecker;
  now?: () => Date;
}

/**
 * F3 (independent-review remediation), generalized to also cover the bounded
 * frozen-cycle base-revalidation path (PR #127 remediation, finding 1):
 * resumes an existing pre-Gate HOLD — of either origin identified by
 * `identity` — without ever re-invoking PRIMARY_AUTHOR. Reuses the exact
 * frozen manifest/candidates the original run materialized to `cycleDir` —
 * it does not accept a manifest/candidates value from the caller and does
 * not regenerate anything — reruns prospective validation, performs fresh
 * Source availability checks, and re-evaluates admission with the current
 * inferenceLimitResolutionChecker (so a resolution recorded since the HOLD
 * takes effect). A fresh INDEPENDENT_REVIEWER invocation happens only if
 * admission is now ELIGIBLE.
 *
 * This is the one shared resume mechanism for both HOLD origins — the normal
 * AI-driven path (`resumePreGateHold()`, `identity.kind === "TRIGGER"`) and
 * the base-revalidation path (`resumeRevalidationHold()`,
 * `identity.kind === "BASE_REVALIDATION"`) — rather than a second,
 * incompatible freeze/resume protocol for the latter.
 *
 * Fails closed (returns a FAILED PreparationOutcome, never throws, never
 * proceeds) if:
 *   - no hold-freeze.json binding record exists for this cycle directory;
 *   - it exists but its baseGitSha/identity do not match this resume request;
 *   - manifest.json is missing/invalid, or any candidate file is
 *     missing/unreadable/malformed;
 *   - the freshly-reloaded manifest+candidates do not reproduce the exact
 *     candidateFingerprint the original HOLD bound (i.e. cycleDir's
 *     manifest/candidates were edited, replaced, or are otherwise stale
 *     since the HOLD was recorded — tamper/staleness detection beyond a
 *     mere re-read).
 *
 * No other blocking finding becomes overridable through this path: the same
 * evaluateSafetyAdmission() call the normal path uses runs unchanged, and
 * only ever a resolved CLAIM_INFERENCE_LIMITS_PRESENT (or a Source that is
 * now genuinely available) can turn a resumed HOLD into ELIGIBLE.
 */
export async function resumeHoldByIdentity(input: ResumeHoldByIdentityInput): Promise<PreparationOutcome> {
  const freeze = readHoldFreeze(input.cycleDir, input.baseGitSha, input.identity);
  if (!freeze.ok) {
    return failed("HOLD_RESUME_IDENTITY_MISMATCH", freeze.reason);
  }

  const manifestPath = join(input.cycleDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return failed("HOLD_RESUME_MANIFEST_MISSING", `no manifest.json at ${input.cycleDir}`);
  }
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return failed("HOLD_RESUME_MANIFEST_INVALID", `manifest.json is not valid JSON: ${(error as Error).message}`);
  }
  const manifestValidation = validateManifest(rawManifest);
  if (manifestValidation.errors.length > 0) {
    return failed("HOLD_RESUME_MANIFEST_INVALID", manifestValidation.errors.join("; "));
  }
  const manifest = asValidatedManifest(rawManifest);

  // Never re-invokes PRIMARY_AUTHOR: candidates are reloaded exclusively
  // from the exact files the original run already materialized.
  const candidatesDir = join(input.cycleDir, "candidates");
  const loadResult = loadCandidates(input.index, candidatesDir, manifest.candidateFiles);
  if (loadResult.failures.length > 0) {
    return failed(
      "HOLD_RESUME_CANDIDATE_LOAD",
      loadResult.failures.map((failure) => `${failure.file}: ${failure.message}`).join("; ")
    );
  }

  // Tamper/staleness detection: the reloaded manifest+candidates must
  // reproduce exactly the fingerprint the original HOLD bound. Any edit,
  // replacement, or drift since the HOLD was recorded fails closed here,
  // before prospective validation or admission ever runs again.
  const currentFingerprint = frozenCandidateFingerprint(manifest, loadResult.candidates);
  if (currentFingerprint !== freeze.record.candidateFingerprint) {
    return failed(
      "HOLD_RESUME_CANDIDATE_MISMATCH",
      "the manifest/candidates on disk no longer match the exact frozen content this HOLD was recorded against"
    );
  }

  const outcome = await continueFromFrozenCandidates(
    input.cycleDir,
    input.baseGitSha,
    input.index,
    manifest,
    loadResult.candidates,
    input.reviewerInvoker,
    input.availabilityAdapter,
    input.resolveAvailabilityAdapter,
    input.inferenceLimitResolutionChecker,
    input.now
  );

  // A resume that is still HOLD refreshes the binding record (same
  // fingerprint, same identity) so a further resume attempt remains
  // possible; it never invokes PRIMARY_AUTHOR and never invokes the
  // reviewer, matching the normal path's own "no reviewer on HOLD" rule.
  if (outcome.status === "PRE_GATE_SAFETY_HOLD") {
    writeHoldFreeze(input.cycleDir, freeze.record);
  }

  return outcome;
}

export interface ResumePreGateHoldInput {
  index: CorpusIndex;
  baseGitSha: string;
  trigger: ResearchTrigger;
  cycleDir: string;
  reviewerInvoker: AiInvoker;
  availabilityAdapter?: SourceAvailabilityAdapter;
  resolveAvailabilityAdapter?: (materialSources: ReadonlyMap<string, Record<string, unknown>>) => Promise<SourceAvailabilityAdapter>;
  inferenceLimitResolutionChecker?: InferenceLimitResolutionChecker;
  now?: () => Date;
}

/** Resumes a normal-path (trigger-originated) pre-Gate HOLD. Thin wrapper over resumeHoldByIdentity(). */
export async function resumePreGateHold(input: ResumePreGateHoldInput): Promise<PreparationOutcome> {
  const { trigger, ...rest } = input;
  return resumeHoldByIdentity({ ...rest, identity: { kind: "TRIGGER", trigger } });
}

export interface ResumeRevalidationHoldInput {
  index: CorpusIndex;
  baseGitSha: string;
  sourceCycleDir: string;
  oldBaseGitSha: string;
  cycleDir: string;
  reviewerInvoker: AiInvoker;
  availabilityAdapter?: SourceAvailabilityAdapter;
  resolveAvailabilityAdapter?: (materialSources: ReadonlyMap<string, Record<string, unknown>>) => Promise<SourceAvailabilityAdapter>;
  inferenceLimitResolutionChecker?: InferenceLimitResolutionChecker;
  now?: () => Date;
}

/**
 * PR #127 remediation (finding 1): resumes a base-revalidation-originated
 * pre-Gate HOLD (see revalidate-frozen-cycle.ts) through the exact same
 * mechanism `resumePreGateHold()` uses for the normal path — thin wrapper
 * over resumeHoldByIdentity(). `sourceCycleDir`/`oldBaseGitSha` must match
 * exactly what `revalidateFrozenCycleAtNewBase()` bound this HOLD to.
 */
export async function resumeRevalidationHold(input: ResumeRevalidationHoldInput): Promise<PreparationOutcome> {
  const { sourceCycleDir, oldBaseGitSha, ...rest } = input;
  return resumeHoldByIdentity({ ...rest, identity: { kind: "BASE_REVALIDATION", sourceCycleDir, oldBaseGitSha } });
}
