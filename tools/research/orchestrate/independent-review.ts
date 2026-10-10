/**
 * Deterministic validation for the OD-B structured independent-review
 * output (strengthened minimum bar points 1-6). This module enforces only
 * points 3-4 (structured outcome + deterministic schema validation) — points
 * 1-2 and 5-6 (separate invocation/role, immutable input, context isolation,
 * self-assessment never counting as review) are process/orchestration
 * properties enforced by run-cycle.ts's control flow, not properties a
 * schema check can observe from the output value alone.
 *
 * Two layers, one rule set:
 * - validateIndependentReview() checks a result against the exact frozen
 *   reviewer package it answered (signal coverage, evidence references,
 *   finding/signal subject agreement) on top of every structural rule;
 * - validateIndependentReviewStructure() checks only what a frozen Research
 *   Change Set itself permits (exact shape, enums, internal references,
 *   candidate record/field/claim against the RCS candidates, outcome
 *   consistency) and needs no corpus index.
 *
 * Neither layer judges whether wording is semantically supported — that is
 * the reviewer's decision. The context-aware layer only rejects a SUPPORTED
 * PRB scope-term disposition that cites no linked EVD carrying the term
 * lexically (signals.ts linkedEvidenceSupportsScopeTerm()), a deterministic
 * reference check. Malformed output is never corrected; it fails closed.
 */
import {
  CLEC_DIMENSION,
  linkedEvidenceIds,
  linkedEvidenceSupportsScopeTerm,
  SCOPE_TERM_CODES,
  type ClecDimension,
  type LanguageSignal,
} from "../language/signals.ts";
import type { CandidateDelta, CandidateRecord } from "../integration/candidate-delta.ts";
import type { RecordFields } from "../core/types.ts";
import type { ReviewerInputPackage } from "./reviewer-input.ts";
import type {
  IndependentReviewOutcome,
  IndependentReviewResult,
  ReviewFindingKind,
  ReviewFindingSeverity,
  SignalDispositionValue,
} from "./types.ts";

export interface IndependentReviewValidationResult {
  errors: string[];
}

const VALID_OUTCOMES: readonly IndependentReviewOutcome[] = ["CONCUR", "DISAGREEMENT_FOUND", "INSUFFICIENT_EVIDENCE"];
const FINDING_KINDS: readonly ReviewFindingKind[] = ["CLEC_VIOLATION", "INSUFFICIENT_EVIDENCE"];
const FINDING_SEVERITIES: readonly ReviewFindingSeverity[] = ["BLOCKING", "ADVISORY"];
const SIGNAL_DISPOSITIONS: readonly SignalDispositionValue[] = ["SUPPORTED", "VIOLATION", "NOT_APPLICABLE", "INSUFFICIENT_EVIDENCE"];
const CLEC_DIMENSIONS: readonly ClecDimension[] = Object.values(CLEC_DIMENSION);

const RESULT_KEYS = ["schemaVersion", "outcome", "rationale", "findings", "signalDispositions"];
const FINDING_KEYS = ["findingId", "recordId", "field", "claim", "dimension", "kind", "severity", "reason", "evidenceReferences", "correctionDirection", "relatedSignalIds"];
const DISPOSITION_KEYS = ["signalId", "disposition", "reason", "evidenceReferences", "relatedFindingIds"];

const FINDING_ID = /^CLEC-FND-\d{4,}$/;
const SIGNAL_ID = /^CLEC-SIG-\d{4,}$/;

/** Authored candidate fields a review may quote, keyed by candidate record ID. */
export type ReviewCandidateFields = ReadonlyMap<string, RecordFields>;

/** What the context-aware layer additionally knows: the frozen package's records and signals. */
interface ReviewContext {
  recordIds: ReadonlySet<string>;
  /** Every record in the package (candidate version wins), by ID, with its family. */
  records: ReadonlyMap<string, { recordFamily: string; fields: RecordFields }>;
  signals: ReadonlyMap<string, LanguageSignal>;
}

interface ParsedFinding {
  findingId: string;
  recordId: unknown;
  kind: unknown;
  severity: unknown;
  relatedSignalIds: string[];
}

interface ParsedDisposition {
  signalId: string;
  disposition: unknown;
  relatedFindingIds: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function checkExactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, errors: string[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path} has unknown field ${JSON.stringify(key)}`);
  }
}

/** A list of distinct non-empty strings; reports problems and returns the usable entries. */
function stringList(value: unknown, path: string, errors: string[], pattern?: RegExp): string[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  value.forEach((entry, i) => {
    if (!isNonEmptyString(entry) || (pattern && !pattern.test(entry))) {
      errors.push(`${path}[${i}] must be ${pattern ? `an ID matching ${pattern}` : "a non-empty string"}, got ${JSON.stringify(entry)}`);
      return;
    }
    if (seen.has(entry)) {
      errors.push(`${path} contains duplicate ${JSON.stringify(entry)}`);
      return;
    }
    seen.add(entry);
    out.push(entry);
  });
  return out;
}

/**
 * Resolves a dotted field path with indexed list items (`a.b[1].c`) on
 * authored candidate fields, reading own properties only.
 */
function resolveAuthoredField(fields: RecordFields, path: string): unknown {
  let current: unknown = fields;
  for (const part of path.split(".")) {
    const match = /^([^[\]]+)((?:\[\d+\])*)$/.exec(part);
    if (!match || !isObject(current) || !Object.prototype.hasOwnProperty.call(current, match[1])) return undefined;
    current = current[match[1]];
    for (const index of match[2].matchAll(/\[(\d+)\]/g)) {
      const i = Number(index[1]);
      if (!Array.isArray(current) || i >= current.length) return undefined;
      current = current[i];
    }
  }
  return current;
}

function checkReferences(references: string[], path: string, context: ReviewContext | undefined, errors: string[]): void {
  if (!context) return;
  for (const id of references) {
    if (!context.recordIds.has(id)) errors.push(`${path} references ${JSON.stringify(id)}, which is not a record in the review input`);
  }
}

function checkFinding(value: unknown, i: number, candidates: ReviewCandidateFields, context: ReviewContext | undefined, errors: string[]): ParsedFinding | undefined {
  const path = `findings[${i}]`;
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }
  checkExactKeys(value, FINDING_KEYS, path, errors);

  if (!isNonEmptyString(value.findingId) || !FINDING_ID.test(value.findingId)) {
    errors.push(`${path}.findingId must match ${FINDING_ID}, got ${JSON.stringify(value.findingId)}`);
  }

  const fields = typeof value.recordId === "string" ? candidates.get(value.recordId) : undefined;
  if (!fields) {
    errors.push(`${path}.recordId must name a candidate record, got ${JSON.stringify(value.recordId)}`);
  } else if (!isNonEmptyString(value.field)) {
    errors.push(`${path}.field must be a non-empty string`);
  } else {
    const authored = resolveAuthoredField(fields, value.field);
    if (typeof authored !== "string") {
      errors.push(`${path}.field ${JSON.stringify(value.field)} is not an authored text field of ${value.recordId}`);
    } else if (!isNonEmptyString(value.claim)) {
      errors.push(`${path}.claim must be a non-empty string`);
    } else if (!authored.includes(value.claim)) {
      errors.push(`${path}.claim does not occur verbatim in ${value.recordId} ${value.field}`);
    }
  }

  if (!CLEC_DIMENSIONS.includes(value.dimension as ClecDimension)) {
    errors.push(`${path}.dimension must be one of ${CLEC_DIMENSIONS.join(", ")}, got ${JSON.stringify(value.dimension)}`);
  }
  if (!FINDING_KINDS.includes(value.kind as ReviewFindingKind)) {
    errors.push(`${path}.kind must be one of ${FINDING_KINDS.join(", ")}, got ${JSON.stringify(value.kind)}`);
  }
  if (!FINDING_SEVERITIES.includes(value.severity as ReviewFindingSeverity)) {
    errors.push(`${path}.severity must be one of ${FINDING_SEVERITIES.join(", ")}, got ${JSON.stringify(value.severity)}`);
  }
  // An unresolved evidence gap always prevents CONCUR, so it cannot be advisory.
  if (value.kind === "INSUFFICIENT_EVIDENCE" && value.severity !== "BLOCKING") {
    errors.push(`${path}.severity must be BLOCKING for an INSUFFICIENT_EVIDENCE finding`);
  }
  if (!isNonEmptyString(value.reason)) errors.push(`${path}.reason must be a non-empty string`);
  if (!isNonEmptyString(value.correctionDirection)) errors.push(`${path}.correctionDirection must be a non-empty string`);

  const references = stringList(value.evidenceReferences, `${path}.evidenceReferences`, errors);
  if (Array.isArray(value.evidenceReferences) && value.evidenceReferences.length === 0) {
    errors.push(`${path}.evidenceReferences must name at least one record the finding was judged against`);
  }
  checkReferences(references, `${path}.evidenceReferences`, context, errors);

  const relatedSignalIds = stringList(value.relatedSignalIds, `${path}.relatedSignalIds`, errors, SIGNAL_ID);
  if (context) {
    for (const signalId of relatedSignalIds) {
      const signal = context.signals.get(signalId);
      if (!signal) errors.push(`${path}.relatedSignalIds references unknown signal ${signalId}`);
      else if (signal.subjectId !== value.recordId) errors.push(`${path}.recordId must equal the subject ${signal.subjectId} of related signal ${signalId}`);
    }
  }

  if (!isNonEmptyString(value.findingId) || !FINDING_ID.test(value.findingId)) return undefined;
  return { findingId: value.findingId, recordId: value.recordId, kind: value.kind, severity: value.severity, relatedSignalIds };
}

/**
 * A SUPPORTED PRB scope-term disposition must cite an EVD the subject PRB
 * links whose observation.summary or scope contains the term, judged on the
 * frozen package by the same predicate that emitted the signal. SRC records,
 * Source Verification Support, unlinked EVD and inference_limits never
 * support the term.
 */
function checkScopeTermSupport(signal: LanguageSignal, references: readonly string[], context: ReviewContext, path: string, errors: string[]): void {
  const problem = context.records.get(signal.subjectId);
  const linked = new Set(problem?.recordFamily === "PRB-" ? linkedEvidenceIds(problem.fields) : []);
  const supported = references.some((id) => {
    const record = context.records.get(id);
    return linked.has(id) && record?.recordFamily === "EVD-" && linkedEvidenceSupportsScopeTerm(signal.code, signal.match ?? signal.excerpt, record.fields);
  });
  if (!supported) {
    errors.push(
      `${path} is SUPPORTED for ${signal.code} but cites no EVD linked by ${signal.subjectId} whose observation.summary or scope contains ${JSON.stringify(signal.match ?? signal.excerpt)} (SRC records, Source Verification Support, unlinked EVD and inference_limits do not support it)`
    );
  }
}

function checkDisposition(value: unknown, i: number, context: ReviewContext | undefined, errors: string[]): ParsedDisposition | undefined {
  const path = `signalDispositions[${i}]`;
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }
  checkExactKeys(value, DISPOSITION_KEYS, path, errors);

  const validId = isNonEmptyString(value.signalId) && SIGNAL_ID.test(value.signalId);
  if (!validId) errors.push(`${path}.signalId must match ${SIGNAL_ID}, got ${JSON.stringify(value.signalId)}`);
  else if (context && !context.signals.has(value.signalId as string)) errors.push(`${path}.signalId ${value.signalId} is not a signal in the review input`);

  if (!SIGNAL_DISPOSITIONS.includes(value.disposition as SignalDispositionValue)) {
    errors.push(`${path}.disposition must be one of ${SIGNAL_DISPOSITIONS.join(", ")}, got ${JSON.stringify(value.disposition)}`);
  }
  if (!isNonEmptyString(value.reason)) errors.push(`${path}.reason must be a non-empty string`);

  const references = stringList(value.evidenceReferences, `${path}.evidenceReferences`, errors);
  if (value.disposition === "SUPPORTED" && Array.isArray(value.evidenceReferences) && value.evidenceReferences.length === 0) {
    errors.push(`${path} is SUPPORTED but names no evidence in the review input that supports it`);
  }
  checkReferences(references, `${path}.evidenceReferences`, context, errors);
  const signal = validId && context ? context.signals.get(value.signalId as string) : undefined;
  if (value.disposition === "SUPPORTED" && signal && context && SCOPE_TERM_CODES.has(signal.code)) {
    checkScopeTermSupport(signal, references, context, path, errors);
  }

  const relatedFindingIds = stringList(value.relatedFindingIds, `${path}.relatedFindingIds`, errors, FINDING_ID);
  if (!validId) return undefined;
  return { signalId: value.signalId as string, disposition: value.disposition, relatedFindingIds };
}

/** Disposition <-> finding linkage: explicit, bidirectional, and consistent with the disposition's meaning. */
function checkLinkage(findings: ReadonlyMap<string, ParsedFinding>, dispositions: ReadonlyMap<string, ParsedDisposition>, errors: string[]): void {
  for (const disposition of dispositions.values()) {
    const path = `signal disposition ${disposition.signalId}`;
    const linked: ParsedFinding[] = [];
    for (const findingId of disposition.relatedFindingIds) {
      const finding = findings.get(findingId);
      if (!finding) {
        errors.push(`${path} references unknown finding ${findingId}`);
        continue;
      }
      linked.push(finding);
      if (!finding.relatedSignalIds.includes(disposition.signalId)) {
        errors.push(`${path} links finding ${findingId}, but that finding does not list ${disposition.signalId} in relatedSignalIds`);
      }
    }

    if (disposition.disposition === "VIOLATION" && !linked.some((f) => f.kind === "CLEC_VIOLATION")) {
      errors.push(`${path} is VIOLATION but links no CLEC_VIOLATION finding`);
    }
    if (disposition.disposition === "INSUFFICIENT_EVIDENCE" && !linked.some((f) => f.kind === "INSUFFICIENT_EVIDENCE")) {
      errors.push(`${path} is INSUFFICIENT_EVIDENCE but links no INSUFFICIENT_EVIDENCE finding`);
    }
    if ((disposition.disposition === "SUPPORTED" || disposition.disposition === "NOT_APPLICABLE") && disposition.relatedFindingIds.length > 0) {
      errors.push(`${path} is ${disposition.disposition} and must not link findings (a supported or inapplicable signal has no finding)`);
    }
  }

  for (const finding of findings.values()) {
    for (const signalId of finding.relatedSignalIds) {
      const disposition = dispositions.get(signalId);
      if (!disposition) errors.push(`finding ${finding.findingId} references signal ${signalId}, which has no disposition`);
      else if (!disposition.relatedFindingIds.includes(finding.findingId)) {
        errors.push(`finding ${finding.findingId} lists signal ${signalId}, but that signal's disposition does not link the finding`);
      }
    }
  }
}

/**
 * The outcome is fully determined by the structured content: a confirmed
 * blocking defect (blocking CLEC_VIOLATION finding or VIOLATION disposition)
 * means DISAGREEMENT_FOUND; otherwise any evidence gap (INSUFFICIENT_EVIDENCE
 * finding or disposition) means INSUFFICIENT_EVIDENCE; otherwise CONCUR.
 * Evidence gaps are never hidden by a coexisting violation — they stay in
 * the result alongside it.
 */
function expectedOutcome(findings: readonly ParsedFinding[], dispositions: readonly ParsedDisposition[]): IndependentReviewOutcome {
  const blockingViolation = findings.some((f) => f.kind === "CLEC_VIOLATION" && f.severity === "BLOCKING");
  const violationDisposition = dispositions.some((d) => d.disposition === "VIOLATION");
  if (blockingViolation || violationDisposition) return "DISAGREEMENT_FOUND";
  const gap = findings.some((f) => f.kind === "INSUFFICIENT_EVIDENCE") || dispositions.some((d) => d.disposition === "INSUFFICIENT_EVIDENCE");
  return gap ? "INSUFFICIENT_EVIDENCE" : "CONCUR";
}

function checkReview(value: unknown, candidates: ReviewCandidateFields, context: ReviewContext | undefined): IndependentReviewValidationResult {
  // A missing result is reported explicitly rather than treated as
  // absent-but-acceptable: "no independent review occurred" must fail closed
  // exactly like a malformed one.
  if (value === undefined || value === null) {
    return { errors: ["independent review result is required and must not be absent"] };
  }
  if (!isObject(value)) {
    return { errors: ["independent review result must be an object"] };
  }
  const errors: string[] = [];
  checkExactKeys(value, RESULT_KEYS, "independentReview", errors);

  if (value.schemaVersion !== "2") {
    errors.push(`independentReview.schemaVersion must be exactly "2", got ${JSON.stringify(value.schemaVersion)}`);
  }
  if (!VALID_OUTCOMES.includes(value.outcome as IndependentReviewOutcome)) {
    errors.push(`independentReview.outcome must be one of ${VALID_OUTCOMES.join(", ")}, got ${JSON.stringify(value.outcome)}`);
  }
  if (!isNonEmptyString(value.rationale)) {
    errors.push("independentReview.rationale must be a non-empty string");
  }

  const findings = new Map<string, ParsedFinding>();
  if (!Array.isArray(value.findings)) {
    errors.push("independentReview.findings must be an array");
  } else {
    value.findings.forEach((entry, i) => {
      const finding = checkFinding(entry, i, candidates, context, errors);
      if (!finding) return;
      if (findings.has(finding.findingId)) errors.push(`findings contain duplicate findingId ${finding.findingId}`);
      else findings.set(finding.findingId, finding);
    });
  }

  const dispositions = new Map<string, ParsedDisposition>();
  if (!Array.isArray(value.signalDispositions)) {
    errors.push("independentReview.signalDispositions must be an array");
  } else {
    value.signalDispositions.forEach((entry, i) => {
      const disposition = checkDisposition(entry, i, context, errors);
      if (!disposition) return;
      if (dispositions.has(disposition.signalId)) errors.push(`signalDispositions contain more than one disposition for ${disposition.signalId}`);
      else dispositions.set(disposition.signalId, disposition);
    });
  }

  if (context) {
    for (const signalId of context.signals.keys()) {
      if (!dispositions.has(signalId)) errors.push(`signal ${signalId} has no disposition (every supplied signal requires exactly one)`);
    }
  }

  checkLinkage(findings, dispositions, errors);

  if (VALID_OUTCOMES.includes(value.outcome as IndependentReviewOutcome)) {
    const expected = expectedOutcome([...findings.values()], [...dispositions.values()]);
    if (value.outcome !== expected) {
      errors.push(`independentReview.outcome ${value.outcome} is inconsistent with its findings and signal dispositions, which require ${expected}`);
    }
  }

  return { errors };
}

/**
 * Pairs candidates with their record IDs by position. Both the
 * CanonicalIntegrationReview and a Research Change Set keep `candidates` in
 * the same deterministic order as `deltas`.
 */
export function candidateFieldsById(candidates: readonly CandidateRecord[], deltas: readonly CandidateDelta[]): ReviewCandidateFields {
  const byId = new Map<string, RecordFields>();
  deltas.forEach((delta, i) => {
    const candidate = candidates[i];
    if (!isObject(delta) || !isObject(candidate) || typeof delta.id !== "string") return;
    if (candidate.recordFamily === delta.recordFamily && isObject(candidate.fields)) byId.set(delta.id, candidate.fields);
  });
  return byId;
}

/**
 * Context-aware validation of a reviewer result against the exact frozen
 * reviewer package that reviewer answered. Must be called with the same
 * package object used to build the reviewer prompt.
 */
export function validateIndependentReview(value: unknown, pkg: ReviewerInputPackage): IndependentReviewValidationResult {
  const recordIds = new Set([...pkg.deltas.map((delta) => delta.id), ...pkg.evidenceContext.map((record) => record.id)]);
  const records = new Map<string, { recordFamily: string; fields: RecordFields }>();
  for (const record of pkg.evidenceContext) records.set(record.id, { recordFamily: record.recordFamily, fields: record.fields });
  pkg.deltas.forEach((delta, i) => {
    const candidate = pkg.candidates[i];
    if (candidate && candidate.recordFamily === delta.recordFamily) records.set(delta.id, { recordFamily: delta.recordFamily, fields: candidate.fields });
  });
  const signals = new Map(pkg.signals.map((entry) => [entry.signalId, entry.signal]));
  return checkReview(value, candidateFieldsById(pkg.candidates, pkg.deltas), { recordIds, records, signals });
}

/**
 * Corpus-independent validation of a stored review, as far as the frozen
 * Research Change Set's own candidates permit. Does not re-run the
 * context-aware checks that need the reviewer package.
 */
export function validateIndependentReviewStructure(value: unknown, candidates: ReviewCandidateFields): IndependentReviewValidationResult {
  return checkReview(value, candidates, undefined);
}

export function asValidatedIndependentReview(value: unknown): IndependentReviewResult {
  return value as IndependentReviewResult;
}
