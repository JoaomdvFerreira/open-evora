/**
 * The REDUCED reviewer input profile (CRR-03, docs/freezeplan.md §3.3): a
 * deterministic, smaller representation of the same semantic review the
 * REFERENCE package (reviewer-input.ts, buildReviewerInputPackage()) frames.
 * It is built from the same ReviewerInputSource and is not yet used by any
 * review route: Lane A, Lane B, the Gate and every receipt stay on the
 * reference profile until the CRR-07 equivalence benchmark and owner cutover.
 *
 * Less context, never less coverage:
 * - every candidate is carried as its complete canonical candidate value,
 *   with deterministic changed paths against the base as relevance guidance;
 * - every reverse-impacted PRB (reverse-impact.ts) stays a review subject,
 *   carried as its exact authored text, its EVD reference roles and the
 *   complete bounded boundary of every EVD it links;
 * - a changed PRB gets the same linked-EVD boundary, never SRC or Source
 *   Verification Support; a changed EVD gets only allow-listed metadata of
 *   its own Sources and the base-only support the reference profile selects;
 *   a changed SRC gets no further context;
 * - full deterministic CLEC detection still runs on every review subject and
 *   a context-free blocker anywhere in it fails before any package exists;
 *   only the signals a reviewer must disposition are filtered for relevance
 *   and grouped by record, field, code and folded wording.
 */
import { canonicalJsonStringify } from "../core/fingerprint.ts";
import { getRecordField } from "../core/record-fields.ts";
import {
  selectSourceVerificationContext,
  sourceVerificationIneligibility,
  type SourceVerification,
  type SourceVerificationIneligibility,
} from "../core/source-verifications.ts";
import type { CorpusIndex, RecordFields } from "../core/types.ts";
import type { CandidateDeltaAction } from "../integration/candidate-delta.ts";
import { buildProspectiveCorpusIndex } from "../integration/prospective-validation.ts";
import {
  contextFreeBlockers,
  describeContextFreeBlockers,
  detectLanguageSignals,
  foldSignalText,
  problemAuthoredText,
  SCOPE_TERM_CODES,
  SIGNAL_CODE,
  type ClecDimension,
  type LanguageSignal,
  type SignalCode,
} from "../language/signals.ts";
import {
  deriveReverseEvidenceImpacts,
  linkedEvidenceBoundaryFields,
  problemEvidenceReferences,
  type LinkedEvidenceBoundary,
} from "./reverse-impact.ts";
import { reviewSignalId, sourceVerificationSubjectSourceIds, type ReviewerInputSource, type ReviewSignal } from "./reviewer-input.ts";

export const REDUCED_REVIEWER_INPUT_SCHEMA_VERSION = "3" as const;
export const REDUCED_REVIEWER_INPUT_PROFILE = "REDUCED" as const;

// ---------------------------------------------------------------------------
// Changed paths
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function walkChanges(base: unknown, candidate: unknown, path: string, out: string[]): void {
  if (isPlainObject(base) && isPlainObject(candidate)) {
    for (const key of [...new Set([...Object.keys(base), ...Object.keys(candidate)])].sort()) {
      const child = path === "" ? key : `${path}.${key}`;
      const inBase = Object.prototype.hasOwnProperty.call(base, key);
      const inCandidate = Object.prototype.hasOwnProperty.call(candidate, key);
      if (inBase && inCandidate) walkChanges(base[key], candidate[key], child, out);
      else out.push(child);
    }
    return;
  }
  if (Array.isArray(base) && Array.isArray(candidate)) {
    for (let i = 0; i < Math.max(base.length, candidate.length); i++) {
      if (i < base.length && i < candidate.length) walkChanges(base[i], candidate[i], `${path}[${i}]`, out);
      else out.push(`${path}[${i}]`);
    }
    return;
  }
  // Leaves (and any non-plain value) compare by canonical serialization: exact values, no normalization.
  if (canonicalJsonStringify(base) !== canonicalJsonStringify(candidate)) out.push(path === "" ? "*" : path);
}

/**
 * Deterministic changed paths of a candidate against its base version, in
 * the dotted, list-indexed form signals and findings use (`a.b[1].c`).
 * Object keys are compared as a set (sorted), so key order is never a change;
 * list items compare by position, so order stays significant and an
 * insertion or removal reports every shifted index plus the tail. Values are
 * compared exactly, with no semantic normalization. Guidance only: it never
 * limits what a reviewer may find in the complete candidate.
 */
export function changedPaths(base: RecordFields, candidate: RecordFields): string[] {
  const out: string[] = [];
  walkChanges(base, candidate, "", out);
  return out;
}

/** Whether a signal field lies on, inside or around one of the changed paths. */
function touchesChangedPath(field: string, paths: readonly string[]): boolean {
  const within = (inner: string, outer: string): boolean => inner === outer || inner.startsWith(`${outer}.`) || inner.startsWith(`${outer}[`);
  return paths.some((path) => path === "*" || within(field, path) || within(path, field));
}

// ---------------------------------------------------------------------------
// PRB → EVD relationship roles
// ---------------------------------------------------------------------------

/**
 * What one PRB location that names an EVD means. Only EVIDENCE_RELATIONSHIP
 * carries authored relationship `effects`; a reference elsewhere is never by
 * itself positive support for every PRB claim.
 */
export type EvidenceReferenceRole =
  | "EVIDENCE_RELATIONSHIP"
  | "MANIFESTATION_BASIS"
  | "CONSEQUENCE_BASIS"
  | "CURRENTNESS_BASIS"
  | "CONTRADICTION_SEARCH"
  | "SUPPORTING_EVIDENCE"
  | "BOUNDARY_EVIDENCE"
  | "OPEN_QUESTION"
  | "INVESTIGATION_PATH"
  | "DECLARED_REFERENCE";

const ROLE_BY_DECLARED_FIELD: ReadonlyMap<string, EvidenceReferenceRole> = new Map([
  ["evidence", "EVIDENCE_RELATIONSHIP"],
  ["decision_basis.manifestation.evidence", "MANIFESTATION_BASIS"],
  ["decision_basis.consequence.evidence", "CONSEQUENCE_BASIS"],
  ["decision_basis.currentness.evidence", "CURRENTNESS_BASIS"],
  ["decision_basis.contradiction_search.evidence", "CONTRADICTION_SEARCH"],
  ["decision_basis.supporting_evidence", "SUPPORTING_EVIDENCE"],
  ["decision_basis.boundary_evidence", "BOUNDARY_EVIDENCE"],
  ["investigation.open_questions", "OPEN_QUESTION"],
  ["investigation.path.initial_signal.evidence", "INVESTIGATION_PATH"],
  ["investigation.path.development.evidence", "INVESTIGATION_PATH"],
  ["investigation.path.delimitation.evidence", "INVESTIGATION_PATH"],
]);

/** One location where the PRB names the EVD. */
export interface EvidenceLinkReference {
  /** Exact indexed path of the ID in the PRB, e.g. `evidence[0].evidence_id`, `decision_basis.boundary_evidence[1]`. */
  field: string;
  role: EvidenceReferenceRole;
  /** For EVIDENCE_RELATIONSHIP only: the authored `evidence[]` entry without its `evidence_id` (effects, research_roles…). */
  relationship?: RecordFields;
}

/** Every location one EVD is named by the PRB, in authored discovery order. */
export interface EvidenceLink {
  evidenceId: string;
  references: EvidenceLinkReference[];
}

const PROBLEM_EVIDENCE_RELATIONSHIP_FIELD = /^evidence\[\d+\]\.evidence_id$/;

function evidenceLinksOf(prospective: CorpusIndex, fields: RecordFields): EvidenceLink[] {
  const problems = prospective.byPrefix.get("PRB-");
  if (!problems) return [];
  const byId = new Map<string, EvidenceLinkReference[]>();
  for (const occurrence of problemEvidenceReferences(problems, fields)) {
    const role = ROLE_BY_DECLARED_FIELD.get(occurrence.declaredField) ?? "DECLARED_REFERENCE";
    const reference: EvidenceLinkReference = { field: occurrence.field, role };
    if (role === "EVIDENCE_RELATIONSHIP" && occurrence.entry) {
      const { evidence_id: _id, ...relationship } = structuredClone(occurrence.entry);
      reference.relationship = relationship;
    }
    byId.set(occurrence.evidenceId, [...(byId.get(occurrence.evidenceId) ?? []), reference]);
  }
  return [...byId.keys()].sort().map((evidenceId) => ({ evidenceId, references: byId.get(evidenceId)! }));
}

/**
 * EVD IDs a reduced PRB links through `evidence[]` (EVIDENCE_RELATIONSHIP),
 * the same set signals.ts linkedEvidenceIds() reads from complete fields:
 * the only EVD that can positively support a PRB scope term (FZ-01).
 */
export function relationshipEvidenceIds(links: readonly EvidenceLink[]): string[] {
  return links.filter((link) => link.references.some((ref) => PROBLEM_EVIDENCE_RELATIONSHIP_FIELD.test(ref.field))).map((link) => link.evidenceId);
}

function boundariesOf(prospective: CorpusIndex, links: readonly EvidenceLink[], changed: ReadonlySet<string>): LinkedEvidenceBoundary[] {
  const evidence = prospective.byPrefix.get("EVD-");
  return links.map(({ evidenceId }) => {
    const record = evidence?.byId.get(evidenceId);
    return { evidenceId, changed: changed.has(evidenceId), fields: record ? linkedEvidenceBoundaryFields(record.fields) : {} };
  });
}

// ---------------------------------------------------------------------------
// Minimal Source context
// ---------------------------------------------------------------------------

/**
 * The only SRC fields the reduced profile carries for a changed EVD's
 * Sources (research/schemas/source.schema.json), and why:
 * - source_id, name, identity, canonical_reference: published Source identity
 *   and provenance reference (SRC review "published Source identity", and
 *   the ID a finding cites);
 * - publisher, creators, licensing.attribution: who an EVD attributes to;
 * - resource_type, access.level, licensing.reuse: the exact inputs of
 *   sourceVerificationIneligibility() (correspondence, non-public, reuse
 *   prohibited), so the eligibility section is derived from the package;
 * - scope.geography, scope.temporal, temporal.published_at,
 *   temporal.updated_at: what place and period the Source covers, against
 *   which EVD scope and temporal fidelity are judged;
 * - caveats: authored Source limits an EVD must not drop.
 * Excluded as having no semantic-review purpose: scope.domains, access
 * availability/machine_readable/method/format, acquisition.*,
 * licensing.status, licensing.licence, temporal.last_checked_at and
 * temporal.update_frequency. Canonical SRC records hold no Source body.
 */
export const REDUCED_SOURCE_CONTEXT_FIELDS: readonly string[] = [
  "source_id",
  "publisher",
  "creators",
  "name",
  "resource_type",
  "identity",
  "canonical_reference",
  "scope.geography",
  "scope.temporal",
  "access.level",
  "licensing.reuse",
  "licensing.attribution",
  "temporal.published_at",
  "temporal.updated_at",
  "caveats",
];

/** The allow-listed projection of one SRC record, each field present only when authored. */
export function reducedSourceFields(fields: RecordFields): RecordFields {
  const out: RecordFields = {};
  for (const path of REDUCED_SOURCE_CONTEXT_FIELDS) {
    const value = getRecordField(fields, path);
    if (value === undefined) continue;
    const parts = path.split(".");
    let target = out;
    for (const part of parts.slice(0, -1)) target = (target[part] ??= {}) as RecordFields;
    target[parts[parts.length - 1]] = structuredClone(value);
  }
  return out;
}

export interface ReducedSourceContext {
  sourceId: string;
  /** Only REDUCED_SOURCE_CONTEXT_FIELDS. */
  fields: RecordFields;
}

// ---------------------------------------------------------------------------
// Grouped signals
// ---------------------------------------------------------------------------

/** One exact underlying signal-engine occurrence inside a group. */
export interface ReviewSignalOccurrence {
  /** `CLEC-OCC-nnnn`: the occurrence's 1-based position in full signal-engine order over the package's subjects (the reference package's CLEC-SIG number). */
  occurrenceId: string;
  excerpt: string;
  match?: string;
  evidenceReferences?: string[];
}

/** One mandatory disposition unit: every occurrence of one folded wording, in one field, of one code, in one record. */
export interface ReviewSignalGroup {
  /** `CLEC-SIG-nnnn`, numbered by group order (first occurrence in signal-engine order). */
  signalId: string;
  code: SignalCode;
  dimension: ClecDimension;
  subjectId: string;
  field: string;
  occurrences: ReviewSignalOccurrence[];
}

/** The FZ-01 PRB scope/layer signals that judge PRB wording against its linked Evidence. */
export const REVERSE_IMPACT_SIGNAL_CODES: ReadonlySet<SignalCode> = new Set([SIGNAL_CODE.PRB_GEOGRAPHY_BROADER_THAN_EVIDENCE, ...SCOPE_TERM_CODES]);

function occurrenceId(position: number): string {
  return `CLEC-OCC-${String(position + 1).padStart(4, "0")}`;
}

function signalTerm(signal: LanguageSignal): string {
  return foldSignalText(signal.match ?? signal.excerpt);
}

/** A signal "semantically present" in the base: same subject, field, code, folded wording and evidence references. */
function noveltyKey(signal: LanguageSignal): string {
  return JSON.stringify([signal.subjectId, signal.field, signal.code, signalTerm(signal), [...(signal.evidenceReferences ?? [])].sort()]);
}

/** The deterministic grouping key: record, field, code and folded wording. */
function groupKey(signal: LanguageSignal): string {
  return JSON.stringify([signal.subjectId, signal.field, signal.code, signalTerm(signal)]);
}

/** Groups mandatory occurrences in order of first occurrence; each group keeps every exact occurrence. */
export function groupReviewSignals(mandatory: readonly ReviewSignal[]): ReviewSignalGroup[] {
  const groups = new Map<string, ReviewSignalGroup>();
  for (const { signalId, signal } of mandatory) {
    const position = Number(signalId.slice("CLEC-SIG-".length)) - 1;
    const occurrence: ReviewSignalOccurrence = {
      occurrenceId: occurrenceId(position),
      excerpt: signal.excerpt,
      ...(signal.match !== undefined ? { match: signal.match } : {}),
      ...(signal.evidenceReferences ? { evidenceReferences: [...signal.evidenceReferences] } : {}),
    };
    const key = groupKey(signal);
    const group = groups.get(key);
    if (group) group.occurrences.push(occurrence);
    else groups.set(key, { signalId: "", code: signal.code, dimension: signal.dimension, subjectId: signal.subjectId, field: signal.field, occurrences: [occurrence] });
  }
  return [...groups.values()].map((group, i) => ({ ...group, signalId: reviewSignalId(i) }));
}

// ---------------------------------------------------------------------------
// The package
// ---------------------------------------------------------------------------

/** One candidate: its complete canonical candidate value and family-specific bounded context. */
export interface ReducedCandidate {
  recordFamily: string;
  id: string;
  action: CandidateDeltaAction;
  fields: RecordFields;
  /** Changed paths against the base (changedPaths()); absent for CREATE, where all authored content is new. */
  changedPaths?: string[];
  /** PRB only: every EVD it names, with the role of each reference. */
  evidenceLinks?: EvidenceLink[];
  /** PRB only: the bounded boundary of every EVD it names, sorted by EVD ID. */
  linkedEvidenceBoundary?: LinkedEvidenceBoundary[];
}

/** One unchanged reverse-impacted PRB, reduced to what PRB→EVD review needs. */
export interface ReducedImpactedSubject {
  recordFamily: "PRB-";
  id: string;
  changedEvidenceIds: string[];
  /** Every authored text field (signals.ts problemAuthoredText()), exact text under its exact canonical path. */
  authoredText: { field: string; text: string }[];
  /** Structured scope values that are not authored text, under their exact canonical paths. */
  structuredScope: { field: string; value: unknown }[];
  evidenceLinks: EvidenceLink[];
  linkedEvidenceBoundary: LinkedEvidenceBoundary[];
}

/** Structured PRB scope values a reduced impacted subject carries beside its authored text. */
export const REDUCED_PROBLEM_STRUCTURED_SCOPE_FIELDS: readonly string[] = ["geography.level", "decision_basis.scope.bounded"];

export interface ReducedReviewerInputPackage {
  schemaVersion: typeof REDUCED_REVIEWER_INPUT_SCHEMA_VERSION;
  profile: typeof REDUCED_REVIEWER_INPUT_PROFILE;
  baseGitSha: string;
  investigationQuestion: string;
  mode: string;
  targetProblemId?: string;
  /** Every candidate, in delta order. */
  candidates: ReducedCandidate[];
  /** Allow-listed metadata of the non-candidate Sources of EVD candidates, sorted by SRC ID. */
  sourceContext: ReducedSourceContext[];
  /** Exactly the reference profile's base-only Source Verification Support selection; omitted when empty. */
  sourceVerificationContext?: SourceVerification[];
  /** Unchanged reverse-impacted PRBs, sorted by PRB ID; omitted when none. */
  impactedSubjects?: ReducedImpactedSubject[];
  /** Grouped mandatory signals; one disposition per group. */
  signals: ReviewSignalGroup[];
}

/** Full deterministic detection found a context-free blocker: no reduced package exists and semantic review must not run. */
export class ReducedReviewContextFreeBlockError extends Error {
  readonly blockers: ReviewSignal[];
  constructor(blockers: ReviewSignal[]) {
    super(describeContextFreeBlockers(blockers));
    this.name = "ReducedReviewContextFreeBlockError";
    this.blockers = blockers;
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

/** The full and mandatory signal sets of a reduced package, before grouping. */
export interface ReducedSignalDerivation {
  /** Full signal-engine output over every review subject, under reference-equal CLEC-SIG positions. */
  detected: ReviewSignal[];
  /** The subset a reviewer must disposition. */
  mandatory: ReviewSignal[];
}

/**
 * Full detection, then relevance:
 * - a CREATE candidate: every signal;
 * - any other candidate: a signal whose field is on a changed path, or one
 *   not semantically present in the base version (noveltyKey()), which keeps
 *   a signal that context made applicable (e.g. a changed evidence_nature);
 * - a PRB reached by a changed EVD, changed or not: every
 *   REVERSE_IMPACT_SIGNAL_CODES signal.
 */
export function deriveReducedSignals(source: ReviewerInputSource): ReducedSignalDerivation {
  return reducedSignals(source, buildProspectiveCorpusIndex(source.index, source.candidates));
}

function reducedSignals(source: ReviewerInputSource, prospective: CorpusIndex): ReducedSignalDerivation {
  const impacts = deriveReverseEvidenceImpacts(prospective, source.deltas);
  const impactedIds = new Set(impacts.map((impact) => impact.problemId));
  const subjectIds = new Set([...source.deltas.map((delta) => delta.id), ...impactedIds]);
  const detected = detectLanguageSignals(prospective, { subjectIds }).map((signal, position) => ({ signalId: reviewSignalId(position), signal }));

  const actions = new Map(source.deltas.map((delta) => [delta.id, delta.action]));
  const paths = new Map<string, string[]>();
  source.deltas.forEach((delta, i) => {
    const base = source.index.byPrefix.get(delta.recordFamily)?.byId.get(delta.id);
    if (delta.action !== "CREATE" && base) paths.set(delta.id, changedPaths(base.fields, source.candidates[i].fields));
  });
  const baseSubjects = new Set(source.deltas.filter((delta) => delta.action !== "CREATE").map((delta) => delta.id));
  const baseKeys = new Set(detectLanguageSignals(source.index, { subjectIds: baseSubjects }).map(noveltyKey));

  const mandatory = detected.filter(({ signal }) => {
    if (impactedIds.has(signal.subjectId) && REVERSE_IMPACT_SIGNAL_CODES.has(signal.code)) return true;
    const action = actions.get(signal.subjectId);
    if (action === undefined) return false;
    if (action === "CREATE" || !paths.has(signal.subjectId)) return true;
    return touchesChangedPath(signal.field, paths.get(signal.subjectId)!) || !baseKeys.has(noveltyKey(signal));
  });
  return { detected, mandatory };
}

/**
 * Builds the frozen REDUCED reviewer package from the same source the
 * reference profile reads. Throws ReducedReviewContextFreeBlockError when full
 * detection finds a context-free blocker, and SourceVerificationError exactly
 * where the reference profile does. Deterministic: no timestamp, runtime or
 * network value, and no AI.
 */
export function buildReducedReviewerInputPackage(source: ReviewerInputSource): ReducedReviewerInputPackage {
  const prospective = buildProspectiveCorpusIndex(source.index, source.candidates);
  const { detected, mandatory } = reducedSignals(source, prospective);
  const blockers = contextFreeBlockers(detected);
  if (blockers.length > 0) throw new ReducedReviewContextFreeBlockError(blockers);

  const impacts = deriveReverseEvidenceImpacts(prospective, source.deltas);
  const changedEvidence = new Set(source.deltas.filter((d) => d.recordFamily === "EVD-" && (d.action === "CREATE" || d.action === "UPDATE")).map((d) => d.id));
  const candidateIds = new Set(source.deltas.map((delta) => `${delta.recordFamily}\u0000${delta.id}`));

  const candidates: ReducedCandidate[] = source.deltas.map((delta, i) => {
    const fields = structuredClone(source.candidates[i].fields);
    const base = source.index.byPrefix.get(delta.recordFamily)?.byId.get(delta.id);
    const out: ReducedCandidate = { recordFamily: delta.recordFamily, id: delta.id, action: delta.action, fields };
    if (delta.action !== "CREATE") out.changedPaths = base ? changedPaths(base.fields, fields) : ["*"];
    if (delta.recordFamily === "PRB-") {
      out.evidenceLinks = evidenceLinksOf(prospective, fields);
      out.linkedEvidenceBoundary = boundariesOf(prospective, out.evidenceLinks, changedEvidence);
    }
    return out;
  });

  const sourceIds = new Set<string>();
  source.deltas.forEach((delta, i) => {
    if (delta.recordFamily !== "EVD-") return;
    const sources = getRecordField(source.candidates[i].fields, "provenance.sources");
    for (const id of Array.isArray(sources) ? sources : []) if (typeof id === "string" && !candidateIds.has(`SRC-\u0000${id}`)) sourceIds.add(id);
  });
  const sourceRecords = prospective.byPrefix.get("SRC-");
  const sourceContext = [...sourceIds].sort().flatMap((sourceId) => {
    const record = sourceRecords?.byId.get(sourceId);
    return record ? [{ sourceId, fields: reducedSourceFields(record.fields) }] : [];
  });

  // The reference profile's exact selection: Sources of created or updated EVD the package carries.
  const reachable = new Set([...source.deltas.filter((d) => d.recordFamily === "SRC-").map((d) => d.id), ...sourceContext.map((s) => s.sourceId)]);
  const supportIds = sourceVerificationSubjectSourceIds(source.candidates, source.deltas).filter((id) => reachable.has(id));
  const sourceVerificationContext = selectSourceVerificationContext(source.sourceVerifications, supportIds, prospective);

  const problems = prospective.byPrefix.get("PRB-");
  const impactedSubjects: ReducedImpactedSubject[] = impacts
    .filter((impact) => !impact.problemChanged)
    .map((impact) => {
      const fields = problems!.byId.get(impact.problemId)!.fields;
      const evidenceLinks = evidenceLinksOf(prospective, fields);
      return {
        recordFamily: "PRB-" as const,
        id: impact.problemId,
        changedEvidenceIds: impact.changedEvidenceIds,
        authoredText: problemAuthoredText(fields),
        structuredScope: REDUCED_PROBLEM_STRUCTURED_SCOPE_FIELDS.flatMap((field) => {
          const value = getRecordField(fields, field);
          return value === undefined ? [] : [{ field, value: structuredClone(value) }];
        }),
        evidenceLinks,
        linkedEvidenceBoundary: boundariesOf(prospective, evidenceLinks, changedEvidence),
      };
    });

  const pkg: ReducedReviewerInputPackage = {
    schemaVersion: REDUCED_REVIEWER_INPUT_SCHEMA_VERSION,
    profile: REDUCED_REVIEWER_INPUT_PROFILE,
    baseGitSha: source.baseGitSha,
    investigationQuestion: source.manifest.investigationQuestion,
    mode: source.manifest.mode,
    ...(source.manifest.targetProblemId !== undefined ? { targetProblemId: source.manifest.targetProblemId } : {}),
    candidates,
    sourceContext,
    ...(sourceVerificationContext.length > 0 ? { sourceVerificationContext } : {}),
    ...(impactedSubjects.length > 0 ? { impactedSubjects } : {}),
    signals: groupReviewSignals(mandatory),
  };
  return deepFreeze(pkg);
}

/** Canonical JSON of a reduced package, the same serialization discipline as serializeReviewerInput(). */
export function serializeReducedReviewerInput(pkg: ReducedReviewerInputPackage): string {
  return canonicalJsonStringify(pkg);
}

/** Source Verification Support eligibility of every SRC record a reduced package carries, sorted by SRC ID. */
export function reducedSourceEligibility(pkg: Pick<ReducedReviewerInputPackage, "candidates" | "sourceContext">): { sourceId: string; ineligibility: SourceVerificationIneligibility[] }[] {
  const sources = new Map<string, RecordFields>();
  for (const candidate of pkg.candidates) if (candidate.recordFamily === "SRC-") sources.set(candidate.id, candidate.fields);
  for (const entry of pkg.sourceContext) sources.set(entry.sourceId, entry.fields);
  return [...sources.keys()].sort().map((sourceId) => ({ sourceId, ineligibility: sourceVerificationIneligibility(sources.get(sourceId)!) }));
}

/**
 * The record IDs each review subject may cite: a candidate cites itself, any
 * other candidate and its own context (a PRB its linked EVD, an EVD its
 * Sources); an impacted PRB cites only itself and its linked EVD. No PRB can
 * cite an SRC through another record's context.
 */
export function reducedCitableRecords(pkg: ReducedReviewerInputPackage): Map<string, Set<string>> {
  const candidateIds = pkg.candidates.map((c) => c.id);
  const contextIds = new Set(pkg.sourceContext.map((s) => s.sourceId));
  const out = new Map<string, Set<string>>();
  for (const candidate of pkg.candidates) {
    const ids = new Set(candidateIds);
    for (const boundary of candidate.linkedEvidenceBoundary ?? []) ids.add(boundary.evidenceId);
    if (candidate.recordFamily === "EVD-") {
      const sources = getRecordField(candidate.fields, "provenance.sources");
      for (const id of Array.isArray(sources) ? sources : []) if (typeof id === "string" && (contextIds.has(id) || candidateIds.includes(id))) ids.add(id);
    }
    out.set(candidate.id, ids);
  }
  for (const subject of pkg.impactedSubjects ?? []) out.set(subject.id, new Set([subject.id, ...subject.linkedEvidenceBoundary.map((b) => b.evidenceId)]));
  return out;
}
