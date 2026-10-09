/** Shared Lane A/Lane B reviewer invocation and bounded structural retry. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { AiInvoker } from "./ai-invoker.ts";
import { asValidatedIndependentReview, validateIndependentReview } from "./independent-review.ts";
import type { ReviewerInputPackage } from "./reviewer-input.ts";
import { serializeReviewerInput } from "./reviewer-input.ts";
import { buildReviewerPrompt, buildReviewerStructuralRetryPrompt } from "./reviewer-prompt.ts";
import type { IndependentReviewResult } from "./types.ts";

export type IndependentReviewInvocation =
  | { status: "VALID"; review: IndependentReviewResult }
  | { status: "FAILED"; failedCheck: string; message: string };

/** Invalid output is retained only in the transient workbench, never as a review. */
export function invokeIndependentReview(
  invoker: AiInvoker,
  reviewerInput: ReviewerInputPackage,
  workbenchDir: string,
): IndependentReviewInvocation {
  const originalPrompt = buildReviewerPrompt(serializeReviewerInput(reviewerInput));
  let prompt = originalPrompt;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = invoker.invoke({ role: "INDEPENDENT_REVIEWER", input: prompt });
    if (result.status === "TIMEOUT") return { status: "FAILED", failedCheck: "INDEPENDENT_REVIEW_TIMEOUT", message: result.message };
    if (result.status === "INVOCATION_FAILED") return { status: "FAILED", failedCheck: "INDEPENDENT_REVIEW_INVOCATION_FAILED", message: result.message };

    writeFileSync(join(workbenchDir, `independent-review-attempt-${attempt}.stdout.txt`), result.stdout, "utf8");
    let value: unknown;
    try {
      value = JSON.parse(result.stdout);
    } catch (error) {
      const message = `stdout was not valid JSON: ${(error as Error).message}`;
      writeFileSync(join(workbenchDir, `independent-review-attempt-${attempt}.errors.txt`), `${message}\n`, "utf8");
      return { status: "FAILED", failedCheck: "INDEPENDENT_REVIEW_OUTPUT_INVALID", message };
    }

    const errors = validateIndependentReview(value, reviewerInput).errors;
    if (errors.length === 0) return { status: "VALID", review: asValidatedIndependentReview(value) };

    const message = errors.join("; ");
    writeFileSync(join(workbenchDir, `independent-review-attempt-${attempt}.errors.txt`), `${errors.join("\n")}\n`, "utf8");
    if (attempt === 2) return { status: "FAILED", failedCheck: "INDEPENDENT_REVIEW_OUTPUT_INVALID", message };
    prompt = buildReviewerStructuralRetryPrompt(originalPrompt, errors);
  }
  throw new Error("independent review attempt limit exceeded");
}
