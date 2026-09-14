/**
 * Full structural validation for an already-assembled Human Gate package
 * (docs/design/m013-launch-automation-contract.md §12). Used by
 * package-builder.ts immediately after assembly (HIGH-2 step 1) and again
 * by decision.ts on every re-read from disk at decision-submission time
 * (HIGH-2 step 8) — the same validator both times, so "validated" means the
 * same thing at render time and at decision time.
 *
 * This module performs no filesystem or Git access; it is a pure structural
 * check over an already-parsed JSON value. It reuses the existing RCS
 * structural validator (rcs-validator.ts) for the embedded researchChangeSet
 * rather than re-deriving a second, parallel RCS shape check.
 */
import { validateResearchChangeSet } from "../orchestrate/rcs-validator.ts";
import type { HumanGatePackage } from "./types.ts";

export interface HumanGatePackageValidationResult {
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

const FULL_GIT_SHA = /^[0-9a-fA-F]{40}$/;

function validateReadinessReportShape(value: unknown, index: number): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`affectedProblemReadiness[${index}] must be an object`];
  }
  const report = value as Record<string, unknown>;
  const errors: string[] = [];
  if (!isNonEmptyString(report.problem_id)) errors.push(`affectedProblemReadiness[${index}].problem_id must be a non-empty string`);
  const eligibility = report.eligibility as Record<string, unknown> | undefined;
  if (
    !eligibility ||
    (eligibility.result !== "READY_FOR_PROMOTION_GATE" && eligibility.result !== "REVIEW_REQUIRED") ||
    !Array.isArray(eligibility.reasons)
  ) {
    errors.push(`affectedProblemReadiness[${index}].eligibility must be a valid EligibilityReadiness`);
  }
  const corroboration = report.corroboration as Record<string, unknown> | undefined;
  if (
    !corroboration ||
    (corroboration.result !== "READY_FOR_CORROBORATION_GATE" && corroboration.result !== "REVIEW_REQUIRED") ||
    !Array.isArray(corroboration.reasons)
  ) {
    errors.push(`affectedProblemReadiness[${index}].corroboration must be a valid CorroborationReadiness`);
  }
  return errors;
}

/**
 * Validates one already-parsed Human Gate package. Returns every structural
 * problem found rather than throwing at the first one, matching this
 * codebase's existing validator convention (manifest.ts, rcs-validator.ts).
 */
export function validateHumanGatePackage(value: unknown): HumanGatePackageValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { errors: ["human gate package must be an object"] };
  }
  const pkg = value as Record<string, unknown>;
  const errors: string[] = [];

  if (pkg.schemaVersion !== "1") {
    errors.push(`package.schemaVersion must be exactly "1", got ${JSON.stringify(pkg.schemaVersion)}`);
  }
  if (!isNonEmptyString(pkg.packageId) || !(pkg.packageId as string).startsWith("RCS-")) {
    errors.push(`package.packageId must be a non-empty string starting with "RCS-", got ${JSON.stringify(pkg.packageId)}`);
  }
  if (typeof pkg.baseGitSha !== "string" || !FULL_GIT_SHA.test(pkg.baseGitSha)) {
    errors.push("package.baseGitSha must be a full 40-character hexadecimal SHA");
  }

  const rcsValidation = validateResearchChangeSet(pkg.researchChangeSet);
  errors.push(...rcsValidation.errors.map((message) => `researchChangeSet.${message}`));

  if (
    typeof pkg.researchChangeSet === "object" &&
    pkg.researchChangeSet !== null &&
    typeof pkg.baseGitSha === "string" &&
    (pkg.researchChangeSet as Record<string, unknown>).baseGitSha !== pkg.baseGitSha
  ) {
    errors.push("package.baseGitSha must equal package.researchChangeSet.baseGitSha");
  }
  if (
    typeof pkg.researchChangeSet === "object" &&
    pkg.researchChangeSet !== null &&
    typeof pkg.packageId === "string" &&
    (pkg.researchChangeSet as Record<string, unknown>).packageId !== pkg.packageId
  ) {
    errors.push("package.packageId must equal package.researchChangeSet.packageId");
  }

  if (!isNonEmptyString(pkg.investigationQuestion)) {
    errors.push("package.investigationQuestion must be a non-empty string");
  }
  if (!Array.isArray(pkg.candidates)) errors.push("package.candidates must be an array");
  if (!Array.isArray(pkg.deltas)) errors.push("package.deltas must be an array");
  if (!pkg.prospectiveValidation || typeof pkg.prospectiveValidation !== "object") {
    errors.push("package.prospectiveValidation must be an object");
  }
  if (!pkg.independentReview || typeof pkg.independentReview !== "object") {
    errors.push("package.independentReview must be an object");
  }
  if (pkg.integrationPlan !== null && (typeof pkg.integrationPlan !== "object" || Array.isArray(pkg.integrationPlan))) {
    errors.push("package.integrationPlan must be null or an object");
  }
  if (!pkg.manifest || typeof pkg.manifest !== "object") {
    errors.push("package.manifest must be an object");
  }

  if (!Array.isArray(pkg.affectedProblemReadiness)) {
    errors.push("package.affectedProblemReadiness must be an array");
  } else {
    pkg.affectedProblemReadiness.forEach((report, index) => errors.push(...validateReadinessReportShape(report, index)));
  }

  if (!isStringArray(pkg.affectedProblemIds)) {
    errors.push("package.affectedProblemIds must be an array of strings");
  }
  if (!isStringArray(pkg.expectedPublicEffect)) {
    errors.push("package.expectedPublicEffect must be an array of strings");
  }
  if (!isStringArray(pkg.risksAndUncertainties)) {
    errors.push("package.risksAndUncertainties must be an array of strings");
  }
  if (typeof pkg.nonAuthoritativeRecommendation !== "string") {
    errors.push("package.nonAuthoritativeRecommendation must be a string");
  }

  return { errors };
}

/** Type-narrowing helper for callers that have already confirmed zero errors. */
export function asValidatedHumanGatePackage(value: unknown): HumanGatePackage {
  return value as HumanGatePackage;
}
