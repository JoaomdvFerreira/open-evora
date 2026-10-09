/**
 * Full structural validation for an already-assembled Human Gate package.
 * Used by
 * package-builder.ts immediately after assembly (HIGH-2 step 1) and again
 * by decision.ts on every re-read from disk at decision-submission time
 * (HIGH-2 step 8) — the same validator both times, so "validated" means the
 * same thing at render time and at decision time.
 *
 * This module performs no filesystem or Git access; it is a pure structural
 * check over an already-parsed JSON value. It reuses the existing RCS
 * structural validator (rcs-validator.ts) for the embedded researchChangeSet
 * rather than re-deriving a second, parallel RCS shape check.
 *
 * The package is self-contained for semantic-review revalidation: the stored
 * reviewer evidence context and signals are checked structurally, then the
 * existing context-aware validateIndependentReview() is re-run against them,
 * so no live CorpusIndex is needed at decision time. Stored Source
 * Verification Support is checked the same way: shape, caps and eligibility
 * against the SRC records the package itself carries, never a corpus.
 */
import { validateSourceVerification } from "../core/source-verifications.ts";
import type { RecordFields } from "../core/types.ts";
import { canonicalJsonStringify } from "../orchestrate/fingerprint.ts";
import { validateIndependentReview } from "../orchestrate/independent-review.ts";
import { asValidatedResearchChangeSet, validateResearchChangeSet } from "../orchestrate/rcs-validator.ts";
import { reviewSignalId, type ReviewerInputPackage } from "../orchestrate/reviewer-input.ts";
import { ADVISORY, SIGNAL_DIMENSION, type SignalCode } from "../language/signals.ts";
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

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key)).map((key) => `${path} has unknown field ${JSON.stringify(key)}`);
}

/**
 * Convenience projections the semantic review is presented and revalidated
 * from. Each must be exactly its RCS authority (canonical serialization), so
 * the owner can never be shown, e.g., CONCUR while the RCS says otherwise.
 */
const RCS_PROJECTIONS = [
  ["independentReview", "independentReview"],
  ["candidates", "candidates"],
  ["deltas", "deltas"],
  ["prospectiveValidation", "validation"],
] as const;

/** Record families the reviewer evidence chain (PRB -> EVD -> SRC) can reach outside the candidates. */
const CONTEXT_FAMILIES: readonly string[] = ["EVD-", "SRC-"];
const CONTEXT_RECORD_KEYS = ["recordFamily", "id", "fields"];
const REVIEW_SIGNAL_KEYS = ["signalId", "signal"];
const SIGNAL_KEYS = ["code", "dimension", "subjectId", "field", "excerpt", "match", "severity", "evidenceReferences"];

function validateReviewEvidenceContext(value: unknown, candidateIds: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return ["package.reviewEvidenceContext must be an array"];
  const errors: string[] = [];
  const seen = new Set<string>();
  let previous: string | undefined;
  value.forEach((record, i) => {
    const path = `package.reviewEvidenceContext[${i}]`;
    if (!isObject(record)) {
      errors.push(`${path} must be an object`);
      return;
    }
    errors.push(...unknownKeys(record, CONTEXT_RECORD_KEYS, path));
    if (!CONTEXT_FAMILIES.includes(record.recordFamily as string)) {
      errors.push(`${path}.recordFamily must be one of ${CONTEXT_FAMILIES.join(", ")}, got ${JSON.stringify(record.recordFamily)}`);
    }
    if (!isNonEmptyString(record.id) || (typeof record.recordFamily === "string" && !record.id.startsWith(record.recordFamily))) {
      errors.push(`${path}.id must be a record ID of family ${JSON.stringify(record.recordFamily)}, got ${JSON.stringify(record.id)}`);
    } else if (candidateIds.has(record.id)) {
      errors.push(`${path}.id ${record.id} is a candidate; candidates are presented under package.candidates, not as review context`);
    } else if (seen.has(record.id)) {
      errors.push(`${path}.id ${record.id} is duplicated`);
    } else {
      seen.add(record.id);
      // Same deterministic order buildReviewerInputPackage() produces: family, then ID.
      const key = `${record.recordFamily}\u0000${record.id}`;
      if (previous !== undefined && key <= previous) errors.push(`${path} is out of order (records are sorted by family, then ID)`);
      previous = key;
    }
    if (!isObject(record.fields)) errors.push(`${path}.fields must be an object`);
  });
  return errors;
}

function validateReviewSignals(value: unknown, candidateIds: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return ["package.reviewSignals must be an array"];
  const errors: string[] = [];
  value.forEach((entry, i) => {
    const path = `package.reviewSignals[${i}]`;
    if (!isObject(entry)) {
      errors.push(`${path} must be an object`);
      return;
    }
    errors.push(...unknownKeys(entry, REVIEW_SIGNAL_KEYS, path));
    // Package-local IDs are positional, exactly as the reviewer package assigns them.
    if (entry.signalId !== reviewSignalId(i)) {
      errors.push(`${path}.signalId must be ${reviewSignalId(i)}, got ${JSON.stringify(entry.signalId)}`);
    }
    const signal = entry.signal;
    if (!isObject(signal)) {
      errors.push(`${path}.signal must be an object`);
      return;
    }
    errors.push(...unknownKeys(signal, SIGNAL_KEYS, `${path}.signal`));
    const code = signal.code as SignalCode;
    if (!Object.prototype.hasOwnProperty.call(SIGNAL_DIMENSION, code)) {
      errors.push(`${path}.signal.code must be a known CLEC signal code, got ${JSON.stringify(signal.code)}`);
    } else if (signal.dimension !== SIGNAL_DIMENSION[code]) {
      errors.push(`${path}.signal.dimension must be ${SIGNAL_DIMENSION[code]} for ${code}, got ${JSON.stringify(signal.dimension)}`);
    }
    if (typeof signal.subjectId !== "string" || !candidateIds.has(signal.subjectId)) {
      errors.push(`${path}.signal.subjectId must name a candidate record, got ${JSON.stringify(signal.subjectId)}`);
    }
    if (!isNonEmptyString(signal.field)) errors.push(`${path}.signal.field must be a non-empty string`);
    if (typeof signal.excerpt !== "string") errors.push(`${path}.signal.excerpt must be a string`);
    if (signal.match !== undefined && typeof signal.match !== "string") errors.push(`${path}.signal.match must be a string when present`);
    if (signal.severity !== ADVISORY) errors.push(`${path}.signal.severity must be ${JSON.stringify(ADVISORY)}`);
    if (signal.evidenceReferences !== undefined && !isStringArray(signal.evidenceReferences)) {
      errors.push(`${path}.signal.evidenceReferences must be an array of strings when present`);
    }
  });
  return errors;
}

/**
 * The SRC records the reviewer received, by ID: SRC candidates and SRC
 * evidence-context records. Stored support may only ever describe these.
 */
function reviewedSources(pkg: Record<string, unknown>, candidates: readonly { recordFamily: string; fields: RecordFields }[], deltas: readonly { recordFamily: string; id: string }[]): Map<string, RecordFields> {
  const sources = new Map<string, RecordFields>();
  deltas.forEach((delta, i) => {
    if (delta.recordFamily === "SRC-" && candidates[i]) sources.set(delta.id, candidates[i].fields);
  });
  for (const record of Array.isArray(pkg.reviewEvidenceContext) ? pkg.reviewEvidenceContext : []) {
    if (isObject(record) && record.recordFamily === "SRC-" && typeof record.id === "string" && isObject(record.fields)) sources.set(record.id, record.fields);
  }
  return sources;
}

function validateReviewSourceVerificationContext(value: unknown, sources: ReadonlyMap<string, RecordFields>): string[] {
  if (value === undefined) return [];
  const path = "package.reviewSourceVerificationContext";
  if (!Array.isArray(value) || value.length === 0) {
    return [`${path} must be a non-empty array when present; it is omitted when the reviewer received no Source Verification Support`];
  }
  const errors: string[] = [];
  let previous: string | undefined;
  value.forEach((entry, i) => {
    const sourceId = isObject(entry) ? entry.source_id : undefined;
    if (typeof sourceId !== "string" || !sources.has(sourceId)) {
      errors.push(`${path}[${i}].source_id must name an SRC record the reviewer received (candidate or evidence context), got ${JSON.stringify(sourceId)}`);
      return;
    }
    // Same deterministic order buildReviewerInputPackage() produces: by SRC ID, one entry per Source.
    if (previous !== undefined && sourceId <= previous) errors.push(`${path}[${i}] is out of order or duplicated (support is sorted by SRC ID)`);
    previous = sourceId;
    errors.push(...validateSourceVerification(entry, sourceId, sources.get(sourceId)).errors.map((message) => `${path}[${i}]: ${message}`));
  });
  return errors;
}

/**
 * The reviewer input rebuilt purely from a Gate package's own hash-bound
 * content: for a package assembled by package-builder.ts it is exactly the
 * input the independent reviewer received, Source Verification Support
 * included. Call only on a package whose inputs passed structure checks.
 */
export function reviewerInputFromGatePackage(pkg: HumanGatePackage): ReviewerInputPackage {
  const rcs = pkg.researchChangeSet;
  return {
    schemaVersion: "2",
    baseGitSha: pkg.baseGitSha,
    investigationQuestion: rcs.manifest.investigationQuestion,
    mode: rcs.manifest.mode,
    ...(rcs.manifest.targetProblemId !== undefined ? { targetProblemId: rcs.manifest.targetProblemId } : {}),
    candidates: pkg.candidates,
    deltas: pkg.deltas,
    validation: pkg.prospectiveValidation,
    readiness: rcs.readiness,
    evidenceContext: pkg.reviewEvidenceContext,
    signals: pkg.reviewSignals,
    ...(pkg.reviewSourceVerificationContext !== undefined ? { sourceVerificationContext: pkg.reviewSourceVerificationContext } : {}),
  };
}

/** Re-runs the context-aware F00-F review validation against reviewerInputFromGatePackage(). */
function revalidateSemanticReview(pkg: HumanGatePackage): string[] {
  return validateIndependentReview(pkg.independentReview, reviewerInputFromGatePackage(pkg)).errors.map(
    (message) => `package.independentReview does not validate against the stored review context: ${message}`
  );
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

  if (pkg.schemaVersion !== "2") {
    errors.push(`package.schemaVersion must be exactly "2", got ${JSON.stringify(pkg.schemaVersion)}`);
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
  if (!pkg.safetyAdmission || typeof pkg.safetyAdmission !== "object") {
    errors.push("package.safetyAdmission must be an object");
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

  // Semantic-review integrity, checked only over an RCS that is itself valid.
  if (rcsValidation.errors.length === 0) {
    const rcs = asValidatedResearchChangeSet(pkg.researchChangeSet);
    for (const [projection, authority] of RCS_PROJECTIONS) {
      if (canonicalJsonStringify(pkg[projection]) !== canonicalJsonStringify(rcs[authority])) {
        errors.push(`package.${projection} must equal package.researchChangeSet.${authority} exactly`);
      }
    }
    const candidateIds = new Set(rcs.deltas.map((delta) => delta.id));
    errors.push(...validateReviewEvidenceContext(pkg.reviewEvidenceContext, candidateIds));
    errors.push(...validateReviewSignals(pkg.reviewSignals, candidateIds));
    errors.push(...validateReviewSourceVerificationContext(pkg.reviewSourceVerificationContext, reviewedSources(pkg, rcs.candidates, rcs.deltas)));
    if (errors.length === 0) errors.push(...revalidateSemanticReview(asValidatedHumanGatePackage(pkg)));
  }

  return { errors };
}

/** Type-narrowing helper for callers that have already confirmed zero errors. */
export function asValidatedHumanGatePackage(value: unknown): HumanGatePackage {
  return value as HumanGatePackage;
}
