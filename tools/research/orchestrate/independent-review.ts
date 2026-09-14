/**
 * Deterministic structural validation for the OD-B independent-review
 * output (docs/design/m013-launch-automation-contract.md §9 OD-B,
 * strengthened minimum bar points 1-6; §11; §14 case 19). This module
 * enforces only points 3-4 (structured outcome + deterministic schema
 * validation) — points 1-2 and 5-6 (separate invocation/role, immutable
 * input, context isolation, self-assessment never counting as review) are
 * process/orchestration properties enforced by cli.ts's control flow, not
 * properties a schema check can observe from the output value alone.
 */
import type { IndependentReviewOutcome, IndependentReviewResult } from "./types.ts";

export interface IndependentReviewValidationResult {
  errors: string[];
}

const VALID_OUTCOMES: readonly IndependentReviewOutcome[] = ["CONCUR", "DISAGREEMENT_FOUND", "INSUFFICIENT_EVIDENCE"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Validates one already-parsed independent-review result object. A missing
 * result (undefined/null) is reported as an explicit error rather than
 * silently treated as absent-but-acceptable — OD-B's non-empty requirement
 * (§11) means "no independent review occurred" must fail closed exactly
 * like a malformed one (§14 case 19).
 */
export function validateIndependentReview(value: unknown): IndependentReviewValidationResult {
  if (value === undefined || value === null) {
    return { errors: ["independent review result is required and must not be absent"] };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { errors: ["independent review result must be an object"] };
  }

  const result = value as Record<string, unknown>;
  const errors: string[] = [];

  if (result.schemaVersion !== "1") {
    errors.push(`independentReview.schemaVersion must be exactly "1", got ${JSON.stringify(result.schemaVersion)}`);
  }

  if (!VALID_OUTCOMES.includes(result.outcome as IndependentReviewOutcome)) {
    errors.push(`independentReview.outcome must be one of ${VALID_OUTCOMES.join(", ")}, got ${JSON.stringify(result.outcome)}`);
  }

  if (!isNonEmptyString(result.rationale)) {
    errors.push("independentReview.rationale must be a non-empty string");
  }

  return { errors };
}

export function asValidatedIndependentReview(value: unknown): IndependentReviewResult {
  return value as IndependentReviewResult;
}
