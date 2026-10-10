/**
 * Builds the immutable, bounded input handed to the INDEPENDENT_REVIEWER AI
 * invocation (WU045-B01 remediation; contract §9 OD-B strengthened point 6,
 * §6 "Independent review contract"). This module is the sole place the
 * reviewer's input is assembled — it is constructed exclusively from
 * already-validated, already-written artifacts (the manifest, the
 * materialized candidate YAML, the deterministic
 * validation/readiness/delta results, and the canonical corpus index the
 * candidates are overlaid onto), never from the primary invocation's
 * process object, stdout transcript, or any other live reference to that
 * invocation. Because the reviewer invocation is a brand-new child process
 * (ai-invoker.ts) that only ever receives the string this module returns,
 * there is no code path by which generator conversational history, scratch
 * reasoning, or free-form rationale beyond `manifest.rationale` itself can
 * reach the reviewer.
 *
 * The same frozen package object is used both to build the reviewer prompt
 * and to validate the reviewer's structured result (independent-review.ts),
 * so the review is always judged against exactly the context it was given.
 */
import { getRecordField } from "../core/record-fields.ts";
import {
  selectSourceVerificationContext,
  sourceVerificationIneligibility,
  type SourceVerification,
  type SourceVerificationIneligibility,
  type SourceVerificationSet,
} from "../core/source-verifications.ts";
import type { CorpusIndex, RecordFields, RecordIndex } from "../core/types.ts";
import type { CandidateDelta, CandidateRecord } from "../integration/candidate-delta.ts";
import type { CanonicalIntegrationReadiness } from "../integration/canonical-integration-review.ts";
import { buildProspectiveCorpusIndex } from "../integration/prospective-validation.ts";
import { detectLanguageSignals, type LanguageSignal } from "../language/signals.ts";
import type { ValidationResult } from "../validation/validate.ts";
import { canonicalJsonStringify } from "./fingerprint.ts";
import type { GenerationManifest } from "./types.ts";

/**
 * The review framing a package carries: an orchestrated cycle's manifest
 * (Lane A), or a fixed, author-independent framing for a direct
 * pull-request change (Lane B). Only these fields are ever read.
 */
export type ReviewFraming = Pick<GenerationManifest, "investigationQuestion" | "targetProblemId"> & { mode: string };

export interface ReviewerInputSource {
  baseGitSha: string;
  manifest: GenerationManifest | ReviewFraming;
  /** The canonical index the candidates are overlaid onto. */
  index: CorpusIndex;
  /** Candidate records in the same order as `deltas` (CanonicalIntegrationReview order). */
  candidates: readonly CandidateRecord[];
  deltas: readonly CandidateDelta[];
  validation: ValidationResult;
  readiness: CanonicalIntegrationReadiness;
  /**
   * Source Verification Support loaded from the review base — the research
   * root `index` was loaded from (loadSourceVerifications(index)), never from
   * the candidates or a prospective head.
   */
  sourceVerifications: SourceVerificationSet;
}

/** One non-candidate record from the prospective corpus that a candidate's evidence chain requires. */
export interface ReviewContextRecord {
  recordFamily: string;
  id: string;
  fields: RecordFields;
}

/** One deterministic CLEC signal (unchanged signal-engine data) under a package-local stable ID. */
export interface ReviewSignal {
  signalId: string;
  signal: LanguageSignal;
}

/**
 * The exact allow-listed shape delivered to the reviewer over stdin. Every
 * field here is either a deterministic tooling output or content the
 * primary pass produced that has already been written to disk and
 * re-validated — never a live conversational artifact. Field names are
 * deliberately explicit and enumerated (not "spread the manifest") so an
 * accidental future manifest field can never silently smuggle
 * generator-only context into the reviewer's input.
 */
export interface ReviewerInputPackage {
  schemaVersion: "2";
  baseGitSha: string;
  investigationQuestion: string;
  mode: string;
  targetProblemId?: string;
  candidates: CandidateRecord[];
  deltas: CandidateDelta[];
  validation: ValidationResult;
  readiness: CanonicalIntegrationReadiness;
  /** Existing records the candidates' evidence chains reference, prospective version, sorted by family then ID. */
  evidenceContext: ReviewContextRecord[];
  /** Candidate-scoped deterministic CLEC signals, in signal-engine order. */
  signals: ReviewSignal[];
  /**
   * Base-bound Source Verification Support for the Sources of EVDs this
   * change creates or updates (sourceVerificationSubjectSourceIds()), which
   * the package already carries, sorted by SRC ID, claims in file order. Review context only — never Source text and
   * never an EVD. Omitted entirely when no applicable support exists, so such
   * packages serialize exactly as they did before this field existed.
   */
  sourceVerificationContext?: SourceVerification[];
}

/** Record families a candidate's evidence chain follows: PRB -> EVD -> SRC, never to other problems. */
const EVIDENCE_CHAIN_PREFIXES: ReadonlySet<string> = new Set(["EVD-", "SRC-"]);

/** Package-local stable signal ID, assigned in signal-engine order. */
export function reviewSignalId(position: number): string {
  return `CLEC-SIG-${String(position + 1).padStart(4, "0")}`;
}

function evidenceChainReferences(recordIndex: RecordIndex, fields: RecordFields): { prefix: string; id: string }[] {
  const out: { prefix: string; id: string }[] = [];
  for (const ref of recordIndex.schema.references ?? []) {
    if (!EVIDENCE_CHAIN_PREFIXES.has(ref.targetPrefix)) continue;
    const value = getRecordField(fields, ref.field);
    const items = ref.isList && Array.isArray(value) ? value : [value];
    for (const item of items) {
      const target = ref.itemField && item !== null && typeof item === "object" && !Array.isArray(item)
        ? getRecordField(item as RecordFields, ref.itemField)
        : item;
      if (typeof target === "string" && target.trim() !== "") out.push({ prefix: ref.targetPrefix, id: target });
    }
  }
  return out;
}

function compareContextRecords(a: ReviewContextRecord, b: ReviewContextRecord): number {
  const left = `${a.recordFamily}\u0000${a.id}`;
  const right = `${b.recordFamily}\u0000${b.id}`;
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Walks each candidate's evidence chain through the prospective index and
 * returns the referenced records that are not themselves candidates. A
 * referenced record that is also a candidate is already present (in its
 * candidate version) under `candidates`; unrelated corpus records are never
 * reached.
 */
function evidenceContextOf(prospective: CorpusIndex, deltas: readonly CandidateDelta[]): ReviewContextRecord[] {
  const key = (prefix: string, id: string): string => `${prefix}\u0000${id}`;
  const candidateKeys = new Set(deltas.map((delta) => key(delta.recordFamily, delta.id)));
  const visited = new Set<string>();
  const queue = deltas.map((delta) => ({ prefix: delta.recordFamily, id: delta.id }));
  const context: ReviewContextRecord[] = [];

  while (queue.length > 0) {
    const { prefix, id } = queue.shift()!;
    if (visited.has(key(prefix, id))) continue;
    visited.add(key(prefix, id));
    const recordIndex = prospective.byPrefix.get(prefix);
    const record = recordIndex?.byId.get(id);
    if (!recordIndex || !record) continue;
    if (!candidateKeys.has(key(prefix, id))) context.push({ recordFamily: prefix, id, fields: structuredClone(record.fields) });
    queue.push(...evidenceChainReferences(recordIndex, record.fields));
  }

  return context.sort(compareContextRecords);
}

/** Where an EVD names its Sources (research/schemas/evidence.schema.json). */
const EVIDENCE_SOURCES_FIELD = "provenance.sources";

/**
 * The only SRC IDs whose Source Verification Support a review may carry:
 * Sources referenced by EVD candidates this change creates or updates, in
 * candidate order. Support exists to judge Source→EVD fidelity of changed
 * Evidence. An unchanged EVD reached through a PRB is the complete evidential
 * boundary for that PRB, so it never makes support eligible; neither does a
 * PRB-only or SRC-only change.
 */
export function sourceVerificationSubjectSourceIds(candidates: readonly CandidateRecord[], deltas: readonly CandidateDelta[]): string[] {
  const ids: string[] = [];
  deltas.forEach((delta, i) => {
    const candidate = candidates[i];
    if (delta.recordFamily !== "EVD-" || (delta.action !== "CREATE" && delta.action !== "UPDATE") || candidate?.recordFamily !== "EVD-") return;
    const sources = getRecordField(candidate.fields, EVIDENCE_SOURCES_FIELD);
    for (const id of Array.isArray(sources) ? sources : []) if (typeof id === "string" && !ids.includes(id)) ids.push(id);
  });
  return ids;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

/**
 * Builds the frozen reviewer package. The evidence context and the CLEC
 * signals both come from the one prospective corpus produced by overlaying
 * the candidates onto `index` (buildProspectiveCorpusIndex()), so candidate
 * replacements win over canonical versions. Signal subjects are limited to
 * the candidate records; cross-record signal context still reads the whole
 * prospective index. Deliberately omits `manifest.rationale`: the primary
 * author's free-form justification is not on the allow-list (contract §6
 * "must NOT receive... primary free-form rationale outside the immutable
 * package"). Canonical SRC records carry provenance and metadata, not the
 * Source body; no Source content is fetched or synthesized here. Applicable
 * base Source Verification Support (only for Sources of created or updated
 * EVD candidates) is attached as bounded review context;
 * invalid or no-longer-eligible applicable support throws
 * SourceVerificationError, on which every caller fails closed.
 */
export function buildReviewerInputPackage(source: ReviewerInputSource): ReviewerInputPackage {
  const prospective = buildProspectiveCorpusIndex(source.index, source.candidates);
  const candidateIds = new Set(source.deltas.map((delta) => delta.id));
  const signals = detectLanguageSignals(prospective, { subjectIds: candidateIds }).map((signal, position) => ({
    signalId: reviewSignalId(position),
    signal,
  }));

  const evidenceContext = evidenceContextOf(prospective, source.deltas);
  // Only SRC records the package already carries: support never widens the evidence graph.
  const reachableSourceIds = new Set([
    ...source.deltas.filter((delta) => delta.recordFamily === "SRC-").map((delta) => delta.id),
    ...evidenceContext.filter((record) => record.recordFamily === "SRC-").map((record) => record.id),
  ]);
  const supportSourceIds = sourceVerificationSubjectSourceIds(source.candidates, source.deltas).filter((id) => reachableSourceIds.has(id));
  const sourceVerificationContext = selectSourceVerificationContext(source.sourceVerifications, supportSourceIds, prospective);

  const pkg: ReviewerInputPackage = {
    schemaVersion: "2",
    baseGitSha: source.baseGitSha,
    investigationQuestion: source.manifest.investigationQuestion,
    mode: source.manifest.mode,
    ...(source.manifest.targetProblemId !== undefined ? { targetProblemId: source.manifest.targetProblemId } : {}),
    candidates: structuredClone([...source.candidates]),
    deltas: structuredClone([...source.deltas]),
    validation: structuredClone(source.validation),
    readiness: source.readiness,
    evidenceContext,
    signals,
    ...(sourceVerificationContext.length > 0 ? { sourceVerificationContext } : {}),
  };
  return deepFreeze(pkg);
}

/** One SRC record the reviewer received, with its Source Verification Support eligibility. */
export interface ReviewSourceEligibility {
  sourceId: string;
  /** Empty when the Source is eligible for Source Verification Support. */
  ineligibility: SourceVerificationIneligibility[];
}

/**
 * Source Verification Support eligibility of every SRC record a package
 * carries (SRC candidates and SRC evidence-context records), sorted by SRC
 * ID. A pure function of the package, using the one eligibility rule in
 * source-verifications.ts: it adds no Source content and no record, and is
 * derived rather than stored, so the frozen input, its fingerprint and the
 * Gate package are unchanged.
 */
export function reviewSourceEligibility(pkg: Pick<ReviewerInputPackage, "candidates" | "deltas" | "evidenceContext">): ReviewSourceEligibility[] {
  const sources = new Map<string, RecordFields>();
  pkg.deltas.forEach((delta, i) => {
    if (delta.recordFamily === "SRC-" && pkg.candidates[i]) sources.set(delta.id, pkg.candidates[i].fields);
  });
  for (const record of pkg.evidenceContext) if (record.recordFamily === "SRC-") sources.set(record.id, record.fields);
  return [...sources.keys()].sort().map((sourceId) => ({ sourceId, ineligibility: sourceVerificationIneligibility(sources.get(sourceId)!) }));
}

/**
 * Serializes the frozen package as canonical JSON (stable key ordering, no
 * insignificant whitespace — same serialization discipline as
 * fingerprint.ts) ready to deliver over stdin.
 */
export function serializeReviewerInput(pkg: ReviewerInputPackage): string {
  return canonicalJsonStringify(pkg);
}
