/**
 * Full structural validation for an already-materialized Research Change
 * Set (WU045-B01 independent-review remediation, finding 1: "secure
 * idempotent RCS reuse"). Used exclusively by cli.ts's idempotent-rerun
 * path (contract §11 idempotency requirement, §14 case 20) to decide
 * whether a `research-change-set.json` already on disk may be trusted as a
 * genuinely completed prior cycle, rather than trusting a handful of
 * top-level string fields.
 *
 * This module does not invent a parallel identity/fingerprint rule: it
 * reuses the exact same deterministic fingerprint contract
 * fingerprint.ts/research-change-set.ts already define for a freshly
 * assembled package (sha256 over the canonical JSON serialization of every
 * field except `packageId`/`preparationFingerprint` themselves) and
 * recomputes it from the on-disk content. A `research-change-set.json`
 * whose stored `preparationFingerprint` does not match its own recomputed
 * fingerprint is definitionally not a value this codebase could have
 * produced — it fails closed exactly like a schema-invalid manifest does.
 */
import { validateManifest, asValidatedManifest } from "./manifest.ts";
import { validateIndependentReview, asValidatedIndependentReview } from "./independent-review.ts";
import { sha256Hex } from "./fingerprint.ts";
import type { CandidateDelta, CandidateRecord } from "../integration/candidate-delta.ts";
import type { CanonicalIntegrationPlan } from "../integration/canonical-integration-plan.ts";
import type { ValidationResult } from "../validation/validate.ts";
import type { GenerationManifest, IndependentReviewResult, ResearchChangeSet } from "./types.ts";
import type { SafetyAdmission } from "../admission/safety-admission.ts";

export interface RcsValidationResult {
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

const FULL_GIT_SHA = /^[0-9a-fA-F]{40}$/;
const READINESS_VALUES = new Set(["READY_FOR_INTEGRATION_GATE", "REVIEW_REQUIRED"]);

function validateCandidateRecordShape(value: unknown, index: number): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`candidates[${index}] must be an object`];
  }
  const candidate = value as Record<string, unknown>;
  const errors: string[] = [];
  if (!isNonEmptyString(candidate.recordFamily)) errors.push(`candidates[${index}].recordFamily must be a non-empty string`);
  if (!candidate.fields || typeof candidate.fields !== "object" || Array.isArray(candidate.fields)) {
    errors.push(`candidates[${index}].fields must be an object`);
  }
  return errors;
}

function validateDeltaShape(value: unknown, index: number): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`deltas[${index}] must be an object`];
  }
  const delta = value as Record<string, unknown>;
  const errors: string[] = [];
  if (!isNonEmptyString(delta.recordFamily)) errors.push(`deltas[${index}].recordFamily must be a non-empty string`);
  if (!isNonEmptyString(delta.id)) errors.push(`deltas[${index}].id must be a non-empty string`);
  if (delta.action !== "CREATE" && delta.action !== "UPDATE" && delta.action !== "NO_CHANGE") {
    errors.push(`deltas[${index}].action must be one of CREATE, UPDATE, NO_CHANGE, got ${JSON.stringify(delta.action)}`);
  }
  return errors;
}

function validateValidationResultShape(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["validation must be an object"];
  }
  const validation = value as Record<string, unknown>;
  const errors: string[] = [];
  if (!Array.isArray(validation.errors) || !validation.errors.every((e) => typeof e === "string")) {
    errors.push("validation.errors must be an array of strings");
  }
  if (typeof validation.totalRecords !== "number") {
    errors.push("validation.totalRecords must be a number");
  }
  // A reusable idempotent package must itself be a package that reached
  // READY_FOR_HUMAN_REVIEW, which requires zero validation errors — see the
  // readiness cross-check below for the corresponding readiness value.
  if (Array.isArray(validation.errors) && validation.errors.length > 0) {
    errors.push("validation.errors must be empty for a package that reached READY_FOR_HUMAN_REVIEW");
  }
  return errors;
}

function validatePlanOperationShape(value: unknown, index: number): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`integrationPlan.operations[${index}] must be an object`];
  }
  const op = value as Record<string, unknown>;
  const errors: string[] = [];
  if (!isNonEmptyString(op.recordFamily)) errors.push(`integrationPlan.operations[${index}].recordFamily must be a non-empty string`);
  if (!isNonEmptyString(op.id)) errors.push(`integrationPlan.operations[${index}].id must be a non-empty string`);
  if (op.action !== "CREATE" && op.action !== "UPDATE" && op.action !== "NO_CHANGE") {
    errors.push(`integrationPlan.operations[${index}].action must be one of CREATE, UPDATE, NO_CHANGE`);
  }
  if (op.action === "CREATE" || op.action === "UPDATE") {
    if (!isNonEmptyString(op.targetFile)) errors.push(`integrationPlan.operations[${index}].targetFile must be a non-empty string`);
    if (!isNonEmptyString(op.yaml)) errors.push(`integrationPlan.operations[${index}].yaml must be a non-empty string`);
  }
  return errors;
}

function validateIntegrationPlanShape(value: unknown, baseGitSha: string): string[] {
  if (value === null) return [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["integrationPlan must be null or an object"];
  }
  const plan = value as Record<string, unknown>;
  const errors: string[] = [];
  if (plan.baseGitSha !== baseGitSha) {
    errors.push(`integrationPlan.baseGitSha must equal the package's own baseGitSha (got ${JSON.stringify(plan.baseGitSha)})`);
  }
  if (!Array.isArray(plan.deltas)) {
    errors.push("integrationPlan.deltas must be an array");
  }
  if (!Array.isArray(plan.operations)) {
    errors.push("integrationPlan.operations must be an array");
  } else {
    plan.operations.forEach((op, index) => errors.push(...validatePlanOperationShape(op, index)));
  }
  return errors;
}

/**
 * Deterministically recomputes what preparationFingerprintOf() in
 * research-change-set.ts would have produced for this package's own
 * content, using the exact same field set and the exact same
 * canonicalJsonStringify()-backed sha256Hex() this codebase already uses to
 * fingerprint a freshly assembled package. Kept in lockstep with that
 * function's field list deliberately — see the comment there.
 */
function recomputeFingerprint(rcs: {
  baseGitSha: string;
  manifest: GenerationManifest;
  candidates: CandidateRecord[];
  deltas: CandidateDelta[];
  validation: ValidationResult;
  readiness: string;
  independentReview: IndependentReviewResult;
  integrationPlan: CanonicalIntegrationPlan | null;
  safetyAdmission: SafetyAdmission;
}): string {
  return sha256Hex({
    baseGitSha: rcs.baseGitSha,
    manifest: rcs.manifest,
    candidates: rcs.candidates,
    deltas: rcs.deltas,
    validation: rcs.validation,
    readiness: rcs.readiness,
    independentReview: rcs.independentReview,
    integrationPlan: rcs.integrationPlan,
    safetyAdmission: {
      disposition: rcs.safetyAdmission.disposition,
      findings: rcs.safetyAdmission.findings.map(({ code, subjectId, severity, summary, evidenceReferences }) => ({ code, subjectId, severity, summary, evidenceReferences })),
    },
  });
}

/**
 * Validates that `value` is a complete, internally consistent, genuinely
 * previously-assembled ResearchChangeSet: every sub-structure this codebase
 * itself produces is present and well-formed, and — the decisive check —
 * the stored `preparationFingerprint` matches one freshly recomputed from
 * the package's own content. Returns every problem found rather than
 * throwing at the first one, matching this module family's existing
 * convention (manifest.ts, independent-review.ts, authoring-envelope.ts).
 *
 * This function performs no filesystem or network access; it is a pure
 * structural check over an already-parsed JSON value.
 */
export function validateResearchChangeSet(value: unknown): RcsValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { errors: ["research change set must be an object"] };
  }
  const rcs = value as Record<string, unknown>;
  const errors: string[] = [];

  if (rcs.schemaVersion !== "1") {
    errors.push(`rcs.schemaVersion must be exactly "1", got ${JSON.stringify(rcs.schemaVersion)}`);
  }
  if (!isNonEmptyString(rcs.packageId) || !(rcs.packageId as string).startsWith("RCS-")) {
    errors.push(`rcs.packageId must be a non-empty string starting with "RCS-", got ${JSON.stringify(rcs.packageId)}`);
  }
  if (typeof rcs.baseGitSha !== "string" || !FULL_GIT_SHA.test(rcs.baseGitSha)) {
    errors.push("rcs.baseGitSha must be a full 40-character hexadecimal SHA");
  }

  const manifestValidation = validateManifest(rcs.manifest);
  errors.push(...manifestValidation.errors.map((message) => `manifest.${message}`));

  if (!Array.isArray(rcs.candidates) || rcs.candidates.length === 0) {
    errors.push("rcs.candidates must be a non-empty array");
  } else {
    rcs.candidates.forEach((candidate, index) => errors.push(...validateCandidateRecordShape(candidate, index)));
  }

  if (!Array.isArray(rcs.deltas) || rcs.deltas.length === 0) {
    errors.push("rcs.deltas must be a non-empty array");
  } else {
    rcs.deltas.forEach((delta, index) => errors.push(...validateDeltaShape(delta, index)));
  }

  errors.push(...validateValidationResultShape(rcs.validation));

  if (!READINESS_VALUES.has(rcs.readiness as string) || rcs.readiness !== "READY_FOR_INTEGRATION_GATE") {
    errors.push(
      `rcs.readiness must be exactly "READY_FOR_INTEGRATION_GATE" for a package that reached READY_FOR_HUMAN_REVIEW, got ${JSON.stringify(rcs.readiness)}`
    );
  }

  const reviewValidation = validateIndependentReview(rcs.independentReview);
  errors.push(...reviewValidation.errors.map((message) => `independentReview.${message}`));
  if (!rcs.safetyAdmission || typeof rcs.safetyAdmission !== "object" || (rcs.safetyAdmission as Record<string, unknown>).disposition !== "ELIGIBLE" || !Array.isArray((rcs.safetyAdmission as Record<string, unknown>).findings)) {
    errors.push("rcs.safetyAdmission must be an eligible structured admission result");
  }

  if (typeof rcs.baseGitSha === "string") {
    errors.push(...validateIntegrationPlanShape(rcs.integrationPlan, rcs.baseGitSha));
  }

  if (!isNonEmptyString(rcs.preparationFingerprint) || !/^[0-9a-f]{64}$/.test(rcs.preparationFingerprint as string)) {
    errors.push("rcs.preparationFingerprint must be a 64-character lowercase hex string");
  }

  // Only attempt the fingerprint recomputation once every sub-structure it
  // depends on has already passed shape validation — recomputing over a
  // malformed value would produce a meaningless mismatch message on top of
  // the real, already-reported structural errors.
  if (errors.length === 0) {
    const manifest = asValidatedManifest(rcs.manifest);
    const independentReview = asValidatedIndependentReview(rcs.independentReview);
    const recomputed = recomputeFingerprint({
      baseGitSha: rcs.baseGitSha as string,
      manifest,
      candidates: rcs.candidates as CandidateRecord[],
      deltas: rcs.deltas as CandidateDelta[],
      validation: rcs.validation as ValidationResult,
      readiness: rcs.readiness as string,
      independentReview,
      integrationPlan: rcs.integrationPlan as CanonicalIntegrationPlan | null,
      safetyAdmission: rcs.safetyAdmission as SafetyAdmission,
    });
    if (recomputed !== rcs.preparationFingerprint) {
      errors.push(
        "rcs.preparationFingerprint does not match a fingerprint recomputed from the package's own content " +
        "(the file is corrupted, hand-edited, or was never produced by this codebase's assembly path)"
      );
    }
    const expectedPackageId = `RCS-${recomputed.slice(0, 16)}`;
    if (rcs.packageId !== expectedPackageId) {
      errors.push(`rcs.packageId does not match the package's own recomputed fingerprint (expected ${expectedPackageId})`);
    }
  }

  return { errors };
}

/** Type-narrowing helper for callers that have already confirmed zero errors. */
export function asValidatedResearchChangeSet(value: unknown): ResearchChangeSet {
  return value as ResearchChangeSet;
}
