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
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { CorpusIndex } from "../core/types.ts";
import { prepareCanonicalIntegrationReview } from "../integration/canonical-integration-review.ts";
import type { AiInvoker } from "./ai-invoker.ts";
import { asValidatedAuthoringEnvelope, validateAuthoringEnvelope } from "./authoring-envelope.ts";
import { loadCandidates } from "./candidate-loader.ts";
import { asValidatedIndependentReview, validateIndependentReview } from "./independent-review.ts";
import { resolveContainedPath } from "./path-containment.ts";
import { buildPrimaryAuthoringPrompt } from "./primary-prompt.ts";
import { assembleResearchChangeSet } from "./research-change-set.ts";
import { buildReviewerInput } from "./reviewer-input.ts";
import { buildReviewerPrompt } from "./reviewer-prompt.ts";
import type { PreparationOutcome, ResearchTrigger } from "./types.ts";

export interface RunResearchCycleInput {
  trigger: ResearchTrigger;
  index: CorpusIndex;
  baseGitSha: string;
  /** Gitignored cycle directory (already boundary-checked by the caller). */
  cycleDir: string;
  primaryInvoker: AiInvoker;
  reviewerInvoker: AiInvoker;
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
 * Runs the complete WU045 normal-path sequence for one cycle, including
 * both required OD-B AI invocations. Fails closed at the first problem,
 * reporting exactly which check failed — matching
 * prepareResearchChangeSet()'s existing fail-closed convention, which this
 * function delegates to for every deterministic step downstream of the two
 * AI invocations it adds.
 */
export function runResearchCycle(input: RunResearchCycleInput): PreparationOutcome {
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

  // --- DETERMINISTIC CANDIDATE LOAD + REVIEW PREP (needed to freeze reviewer input) -
  const candidatesDir = join(input.cycleDir, "candidates");
  const loadResult = loadCandidates(input.index, candidatesDir, envelope.manifest.candidateFiles);
  if (loadResult.failures.length > 0) {
    return failed(
      "CANDIDATE_LOAD",
      loadResult.failures.map((failure) => `${failure.file}: ${failure.message}`).join("; ")
    );
  }

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
    review = prepareCanonicalIntegrationReview(input.baseGitSha, input.index, loadResult.candidates);
  } catch (error) {
    return failed("PROSPECTIVE_VALIDATION", (error as Error).message);
  }
  if (review.validation.errors.length > 0) {
    return failed("PROSPECTIVE_VALIDATION", review.validation.errors.join("; "));
  }
  if (review.readiness !== "READY_FOR_INTEGRATION_GATE") {
    return failed("READINESS", "canonical integration review did not reach READY_FOR_INTEGRATION_GATE");
  }

  // --- FREEZE THE IMMUTABLE REVIEWER INPUT -----------------------------------
  const reviewerInputJson = buildReviewerInput({
    baseGitSha: input.baseGitSha,
    manifest: envelope.manifest,
    candidates: review.candidates,
    deltas: review.deltas,
    validation: review.validation,
    readiness: review.readiness,
  });

  // --- FRESH INDEPENDENT REVIEW AI INVOCATION --------------------------------
  const reviewerPrompt = buildReviewerPrompt(reviewerInputJson);
  const reviewerResult = input.reviewerInvoker.invoke({ role: "INDEPENDENT_REVIEWER", input: reviewerPrompt });

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
  writeFileSync(join(input.cycleDir, "independent-review.json"), `${JSON.stringify(independentReview, null, 2)}\n`, "utf8");

  // --- ASSEMBLE THE FINAL RESEARCH CHANGE SET --------------------------------
  // Assembles directly from the exact `review` object computed above (the
  // same one buildReviewerInput() used to freeze the reviewer's input) and
  // the real, freshly-invoked independent-review result — never by
  // re-reading candidate files from disk and re-deriving a second,
  // potentially-divergent snapshot (WU045-B01 independent-review
  // remediation, finding 3). This is the only call whose output is ever
  // returned as READY_FOR_HUMAN_REVIEW.
  return assembleResearchChangeSet(input.index, envelope.manifest, review, independentReview);
}

export function cycleArtifactsExist(cycleDir: string): boolean {
  return existsSync(join(cycleDir, "manifest.json"));
}
