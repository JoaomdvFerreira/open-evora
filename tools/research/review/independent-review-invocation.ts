/**
 * Shared provider-neutral reviewer invocation for orchestration and direct
 * semantic review. A structurally invalid
 * response — stdout that is not JSON, or JSON failing validateIndependentReview()
 * — gets exactly one technical retry built from the same frozen prompt plus
 * procedural feedback; it never counts as a semantic attempt. A valid result,
 * whatever its outcome, is never retried.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { AiInvoker } from "../ai/invoker.ts";
import { asValidatedIndependentReview, validateIndependentReview } from "./independent-review.ts";
import type { ReviewerInputPackage } from "./reviewer-input.ts";
import { serializeReviewerInput } from "./reviewer-input.ts";
import { buildReviewerPrompt, buildReviewerStructuralRetryPrompt } from "./reviewer-prompt.ts";
import type { IndependentReviewResult } from "./types.ts";

export type IndependentReviewInvocation =
  | { status: "VALID"; review: IndependentReviewResult; technicalCalls: 1 | 2 }
  | { status: "FAILED"; failedCheck: string; message: string };

/** Errors that make one stdout structurally invalid; empty when it is a valid review. */
function structuralErrors(stdout: string, reviewerInput: ReviewerInputPackage): { value: unknown; errors: string[]; outputKind: "INVALID_REVIEW" | "NOT_JSON" } {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch (error) {
    return { value: undefined, errors: [`stdout was not valid JSON: ${(error as Error).message}`], outputKind: "NOT_JSON" };
  }
  return { value, errors: validateIndependentReview(value, reviewerInput).errors, outputKind: "INVALID_REVIEW" };
}

/** Invalid output is retained only in the transient workbench, never as a review. */
export function invokeIndependentReview(
  invoker: AiInvoker,
  reviewerInput: ReviewerInputPackage,
  workbenchDir?: string,
): IndependentReviewInvocation {
  // Serialized once: both technical calls carry exactly this frozen input.
  const originalPrompt = buildReviewerPrompt(serializeReviewerInput(reviewerInput));
  let prompt = originalPrompt;
  for (const technicalCall of [1, 2] as const) {
    const result = invoker.invoke({ role: "INDEPENDENT_REVIEWER", input: prompt });
    if (result.status === "TIMEOUT") return { status: "FAILED", failedCheck: "INDEPENDENT_REVIEW_TIMEOUT", message: result.message };
    if (result.status === "INVOCATION_FAILED") return { status: "FAILED", failedCheck: "INDEPENDENT_REVIEW_INVOCATION_FAILED", message: result.message };

    if (workbenchDir) writeFileSync(join(workbenchDir, `independent-review-attempt-${technicalCall}.stdout.txt`), result.stdout, "utf8");
    const { value, errors, outputKind } = structuralErrors(result.stdout, reviewerInput);
    if (errors.length === 0) return { status: "VALID", review: asValidatedIndependentReview(value), technicalCalls: technicalCall };

    if (workbenchDir) writeFileSync(join(workbenchDir, `independent-review-attempt-${technicalCall}.errors.txt`), `${errors.join("\n")}\n`, "utf8");
    if (technicalCall === 2) return { status: "FAILED", failedCheck: "INDEPENDENT_REVIEW_OUTPUT_INVALID", message: errors.join("; ") };
    prompt = buildReviewerStructuralRetryPrompt(originalPrompt, errors, outputKind);
  }
  throw new Error("independent review technical call limit exceeded");
}
