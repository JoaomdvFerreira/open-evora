import type { RecordDetail } from "../dataProvider/types";
import type { ProblemProjection } from "./problemProjection";

/**
 * Pure, deterministic `ProblemProjection -> PrbDossierData` boundary: the
 * complete canonical content of one PRB and its linked EVD/SRC records,
 * reshaped into a plain, JSON-serialisable document model for a downloadable
 * dossier renderer.
 *
 * It reads only the already-resolved ProblemProjection — nothing is fetched,
 * no DataProvider/browser/React API is touched — and it is independent of
 * the PRB Details presentation (prbDetailsProjection.ts): the two are
 * separate contracts over the same canonical input.
 *
 * Values are carried exactly as authored: canonical enum codes are not
 * translated (presentation labels and date formatting belong to the
 * renderer), unauthored optional fields are `null` / `[]` rather than
 * fabricated, explicit `false` booleans survive, and no ranking, score,
 * confidence or derived state is produced. No generation timestamp exists
 * here — identical input always yields deep-equal output; the renderer owns
 * generation metadata.
 */

/** Version of the PrbDossierData contract (not of the canonical records). */
export const PRB_DOSSIER_PROJECTION_VERSION = 1 as const;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

/** An explicit authored boolean — `false` is preserved, never collapsed by a truthiness check; anything else is `null`. */
function flag(record: Record<string, unknown> | null, key: string): boolean | null {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
}

function texts(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** First-seen de-duplication of already-ordered IDs. */
function uniqueInOrder(ids: string[]): string[] {
  return [...new Set(ids)];
}

export interface PrbDossierGeography {
  /** Canonical geography `level` code. */
  level: string | null;
  area: string | null;
}

function geography(record: Record<string, unknown> | null): PrbDossierGeography | null {
  const value = objectValue(record?.geography);
  return value ? { level: text(value, "level"), area: text(value, "area") } : null;
}

/**
 * Canonical temporal scope exactly as authored — `as_of`, or `start`/`end`,
 * or (EVD only) `status`. Precision is never widened or narrowed: "2026-09"
 * stays "2026-09".
 */
export interface PrbDossierTemporalScope {
  asOf: string | null;
  start: string | null;
  end: string | null;
  status: string | null;
}

function temporalScope(value: unknown): PrbDossierTemporalScope | null {
  const temporal = objectValue(value);
  if (!temporal) return null;
  return { asOf: text(temporal, "as_of"), start: text(temporal, "start"), end: text(temporal, "end"), status: text(temporal, "status") };
}

// ---------------------------------------------------------------- problem

export interface PrbDossierProblem {
  id: string;
  createdAt: string | null;
  /** Canonical `updated_at`: last authored edit of the PRB record — edit metadata, not investigation currentness. */
  updatedAt: string | null;
  title: string | null;
  /** Canonical `domain` codes in authored order (a single authored string becomes a one-item list). */
  domains: string[];
  geography: PrbDossierGeography | null;
  affectedPopulations: string[];
  problemStatement: string | null;
  causalReading: string | null;
  /** Canonical lifecycle `status` code. */
  status: string | null;
  evidenceStatus: string | null;
  validationStatus: string | null;
  digitalTractability: string | null;
  solutionLandscapeStatus: string | null;
}

function problemData(problem: RecordDetail): PrbDossierProblem {
  const record = problem.record;
  return {
    id: problem.id,
    createdAt: text(record, "created_at"),
    updatedAt: text(record, "updated_at"),
    title: text(record, "title"),
    domains: typeof record.domain === "string" ? [record.domain] : texts(record.domain),
    geography: geography(record),
    affectedPopulations: texts(record.affected_populations),
    problemStatement: text(record, "problem_statement"),
    causalReading: text(record, "causal_reading"),
    status: text(record, "status"),
    evidenceStatus: text(record, "evidence_status"),
    validationStatus: text(record, "validation_status"),
    digitalTractability: text(record, "digital_tractability"),
    solutionLandscapeStatus: text(record, "solution_landscape_status"),
  };
}

// ---------------------------------------------------------- investigation

/**
 * One authored `investigation.open_questions[]` entry. Every field maps
 * one-to-one; `currentAction` is free text and is never parsed (e.g. a
 * leading "WATCH —" stays plain text, not a posture).
 */
export interface PrbDossierOpenQuestion {
  question: string;
  latestResult: string | null;
  whyOpen: string | null;
  resolutionCondition: string | null;
  currentAction: string | null;
  evidenceIds: string[];
}

function openQuestions(investigation: Record<string, unknown> | null): PrbDossierOpenQuestion[] {
  const list = investigation?.open_questions;
  if (!Array.isArray(list)) return [];
  return list.flatMap((raw) => {
    const item = objectValue(raw);
    const question = text(item, "question");
    if (!item || question === null) return [];
    return [{
      question,
      latestResult: text(item, "latest_result"),
      whyOpen: text(item, "why_open"),
      resolutionCondition: text(item, "resolution_condition"),
      currentAction: text(item, "current_action"),
      evidenceIds: texts(item.evidence),
    }];
  });
}

export const PRB_DOSSIER_PATH_STAGES = ["initial_signal", "development", "delimitation"] as const;
export type PrbDossierPathStageKey = (typeof PRB_DOSSIER_PATH_STAGES)[number];

/** One authored `investigation.path` stage — narrative, carrying no completion/current/pending state. */
export interface PrbDossierPathStage {
  key: PrbDossierPathStageKey;
  summary: string | null;
  evidenceIds: string[];
}

function pathStages(investigation: Record<string, unknown> | null): PrbDossierPathStage[] {
  const path = objectValue(investigation?.path);
  if (!path) return [];
  return PRB_DOSSIER_PATH_STAGES.flatMap((key) => {
    const stage = objectValue(path[key]);
    return stage ? [{ key, summary: text(stage, "summary"), evidenceIds: texts(stage.evidence) }] : [];
  });
}

export interface PrbDossierInvestigation {
  openQuestions: PrbDossierOpenQuestion[];
  /** Authored stages only, always in canonical order: initial_signal, development, delimitation. */
  path: PrbDossierPathStage[];
}

export interface PrbDossierStateChange {
  field: string;
  from: string;
  to: string;
}

/** One authored PRB `history[]` entry, in authored order. Nothing is synthesised from dates, Git or `updated_at`. */
export interface PrbDossierHistoryEntry {
  date: string | null;
  summary: string | null;
  evidenceIds: string[];
  stateChanges: PrbDossierStateChange[];
}

function stateChanges(value: unknown): PrbDossierStateChange[] {
  const changes = objectValue(value);
  if (!changes) return [];
  return Object.entries(changes).flatMap(([field, raw]) => {
    const transition = objectValue(raw);
    const from = text(transition, "from");
    const to = text(transition, "to");
    return from !== null && to !== null ? [{ field, from, to }] : [];
  });
}

function history(record: Record<string, unknown>): PrbDossierHistoryEntry[] {
  if (!Array.isArray(record.history)) return [];
  return record.history.flatMap((raw) => {
    const entry = objectValue(raw);
    if (!entry) return [];
    return [{ date: text(entry, "date"), summary: text(entry, "summary"), evidenceIds: texts(entry.evidence), stateChanges: stateChanges(entry.state_changes) }];
  });
}

// --------------------------------------------------------- decision basis

/**
 * Canonical optional `decision_basis`, mapped field-for-field. Human-authored
 * booleans (`performed`, `bounded`) keep an explicit `false`; nothing absent
 * is derived (e.g. `bounded` is never inferred from the scope texts).
 */
export interface PrbDossierDecisionBasis {
  contractVersion: string | null;
  eligibilityBasis: string | null;
  corroborationBasis: string | null;
  manifestation: { kind: string | null; summary: string | null; evidenceIds: string[] } | null;
  consequence: { summary: string | null; evidenceIds: string[] } | null;
  currentness: { assessment: string | null; evidenceIds: string[] } | null;
  contradictionSearch: { performed: boolean | null; summary: string | null; evidenceIds: string[] } | null;
  overlapCheck: { performed: boolean | null; summary: string | null; relatedProblemIds: string[] } | null;
  corroborationStatement: string | null;
  supportingEvidenceIds: string[];
  boundaryEvidenceIds: string[];
  independenceAssessment: string | null;
  scope: { geography: string | null; population: string | null; temporal: string | null; bounded: boolean | null } | null;
  limitations: string | null;
}

function decisionBasis(record: Record<string, unknown>): PrbDossierDecisionBasis | null {
  const basis = objectValue(record.decision_basis);
  if (!basis) return null;
  const manifestation = objectValue(basis.manifestation);
  const consequence = objectValue(basis.consequence);
  const currentness = objectValue(basis.currentness);
  const contradiction = objectValue(basis.contradiction_search);
  const overlap = objectValue(basis.overlap_check);
  const scope = objectValue(basis.scope);
  return {
    contractVersion: text(basis, "contract_version"),
    eligibilityBasis: text(basis, "eligibility_basis"),
    corroborationBasis: text(basis, "corroboration_basis"),
    manifestation: manifestation && { kind: text(manifestation, "kind"), summary: text(manifestation, "summary"), evidenceIds: texts(manifestation.evidence) },
    consequence: consequence && { summary: text(consequence, "summary"), evidenceIds: texts(consequence.evidence) },
    currentness: currentness && { assessment: text(currentness, "assessment"), evidenceIds: texts(currentness.evidence) },
    contradictionSearch: contradiction && { performed: flag(contradiction, "performed"), summary: text(contradiction, "summary"), evidenceIds: texts(contradiction.evidence) },
    overlapCheck: overlap && { performed: flag(overlap, "performed"), summary: text(overlap, "summary"), relatedProblemIds: texts(overlap.related_problems) },
    corroborationStatement: text(basis, "corroboration_statement"),
    supportingEvidenceIds: texts(basis.supporting_evidence),
    boundaryEvidenceIds: texts(basis.boundary_evidence),
    independenceAssessment: text(basis, "independence_assessment"),
    scope: scope && { geography: text(scope, "geography"), population: text(scope, "population"), temporal: text(scope, "temporal"), bounded: flag(scope, "bounded") },
    limitations: text(basis, "limitations"),
  };
}

// --------------------------------------------------------------- evidence

/**
 * One linked EVD as used by this PRB, in `projection.evidence` order: the
 * EVD's canonical fields plus the PRB→EVD relationship's authored
 * `effects`/`research_roles`. No confidence, strength, relevance or
 * reliability value exists here.
 */
export interface PrbDossierEvidence {
  id: string;
  lineageId: string | null;
  observationSummary: string | null;
  extractedAt: string | null;
  /** Canonical `provenance.sources`, in authored order. Each resolves to one `PrbDossierData.sources` entry unless listed in `unresolvedSourceIds`. */
  sourceIds: string[];
  /** Authored source IDs with no resolved SRC record in the projection — kept observable, never filled with fabricated source data. */
  unresolvedSourceIds: string[];
  scope: {
    geography: PrbDossierGeography | null;
    populations: string[];
    temporal: PrbDossierTemporalScope | null;
  };
  domains: string[];
  evidenceNature: string | null;
  claimAuthority: string | null;
  inferenceLimits: string[];
  effects: string[];
  researchRoles: string[];
}

// ---------------------------------------------------------------- sources

/**
 * One distinct SRC, carrying its canonical audit fields. Access, licensing
 * and temporal metadata stay separate dimensions: public access does not
 * imply reuse permission, and `temporal.lastCheckedAt` is only the date Open
 * Évora checked the source — not a currentness or validation claim.
 */
export interface PrbDossierSource {
  id: string;
  name: string | null;
  publisher: string | null;
  creators: string[];
  resourceType: string | null;
  identity: {
    persistentIdentifier: { scheme: string | null; value: string | null } | null;
    version: string | null;
    snapshotReference: string | null;
  } | null;
  scope: {
    geography: PrbDossierGeography | null;
    /** Sources author `as_of` or `start`/`end`; `status` is always null here. */
    temporal: PrbDossierTemporalScope | null;
    domains: string[];
  };
  access: {
    level: string | null;
    availability: string | null;
    /** Tri-state exactly as authored: `"unknown"` is distinct from `false`. */
    machineReadable: boolean | "unknown" | null;
    method: string | null;
    format: string | null;
  };
  acquisition: { method: string | null; obtainedAt: string | null };
  canonicalReference: string | null;
  licensing: { status: string | null; licence: string | null; reuse: string | null; attribution: string | null };
  temporal: { publishedAt: string | null; updatedAt: string | null; lastCheckedAt: string | null; updateFrequency: string | null };
  caveats: string[];
  /** Derived relationship index: EVD IDs in this dossier whose resolved sources include this SRC, in evidence order. */
  usedByEvidenceIds: string[];
}

function machineReadable(access: Record<string, unknown> | null): boolean | "unknown" | null {
  const value = access?.machine_readable;
  return typeof value === "boolean" || value === "unknown" ? value : null;
}

function sourceData(source: RecordDetail, usedByEvidenceIds: string[]): PrbDossierSource {
  const record = source.record;
  const identity = objectValue(record.identity);
  const persistentIdentifier = objectValue(identity?.persistent_identifier);
  const scope = objectValue(record.scope);
  const access = objectValue(record.access);
  const acquisition = objectValue(record.acquisition);
  const licensing = objectValue(record.licensing);
  const temporal = objectValue(record.temporal);
  return {
    id: source.id,
    name: text(record, "name"),
    publisher: text(record, "publisher"),
    creators: texts(record.creators),
    resourceType: text(record, "resource_type"),
    identity: identity && {
      persistentIdentifier: persistentIdentifier && { scheme: text(persistentIdentifier, "scheme"), value: text(persistentIdentifier, "value") },
      version: text(identity, "version"),
      snapshotReference: text(identity, "snapshot_reference"),
    },
    scope: { geography: geography(scope), temporal: temporalScope(scope?.temporal), domains: texts(scope?.domains) },
    access: { level: text(access, "level"), availability: text(access, "availability"), machineReadable: machineReadable(access), method: text(access, "method"), format: text(access, "format") },
    acquisition: { method: text(acquisition, "method"), obtainedAt: text(acquisition, "obtained_at") },
    canonicalReference: text(record, "canonical_reference"),
    licensing: { status: text(licensing, "status"), licence: text(licensing, "licence"), reuse: text(licensing, "reuse"), attribution: text(licensing, "attribution") },
    temporal: { publishedAt: text(temporal, "published_at"), updatedAt: text(temporal, "updated_at"), lastCheckedAt: text(temporal, "last_checked_at"), updateFrequency: text(temporal, "update_frequency") },
    caveats: texts(record.caveats),
    usedByEvidenceIds,
  };
}

// ------------------------------------------------------------------ total

/** Deterministic counts of already-projected values — never qualitative metrics or scores. */
export interface PrbDossierCounts {
  evidenceRecordCount: number;
  distinctSourceCount: number;
  /** Total authored PRB→EVD `effects[]` entries across all linked evidence. */
  effectCount: number;
  openQuestionCount: number;
}

export interface PrbDossierData {
  projectionVersion: typeof PRB_DOSSIER_PROJECTION_VERSION;
  problem: PrbDossierProblem;
  investigation: PrbDossierInvestigation;
  /** `null` when the PRB authors no `decision_basis` — never an empty stand-in. */
  decisionBasis: PrbDossierDecisionBasis | null;
  history: PrbDossierHistoryEntry[];
  /** Exactly `projection.evidence`, same order — no ranking, sorting, filtering or de-duplication. */
  evidence: PrbDossierEvidence[];
  /** Every resolved SRC once, by canonical ID, in first-seen order across evidence order then each evidence item's source order. */
  sources: PrbDossierSource[];
  counts: PrbDossierCounts;
}

export function buildPrbDossierData(projection: ProblemProjection): PrbDossierData {
  const record = projection.problem.record;
  const investigation = objectValue(record.investigation);

  const distinctSources = new Map<string, { detail: RecordDetail; usedBy: string[] }>();
  for (const item of projection.evidence) {
    for (const source of item.sources) {
      const entry = distinctSources.get(source.id) ?? { detail: source, usedBy: [] };
      entry.usedBy.push(item.detail.id);
      distinctSources.set(source.id, entry);
    }
  }

  const evidence = projection.evidence.map((item): PrbDossierEvidence => {
    const evd = item.detail.record;
    const provenance = objectValue(evd.provenance);
    const observation = objectValue(evd.observation);
    const scope = objectValue(evd.scope);
    const sourceIds = texts(provenance?.sources);
    return {
      id: item.detail.id,
      lineageId: text(evd, "lineage_id"),
      observationSummary: text(observation, "summary"),
      extractedAt: text(provenance, "extracted_at"),
      sourceIds,
      unresolvedSourceIds: uniqueInOrder(sourceIds.filter((id) => !distinctSources.has(id))),
      scope: { geography: geography(scope), populations: texts(scope?.populations), temporal: temporalScope(scope?.temporal) },
      domains: texts(evd.domains),
      evidenceNature: text(evd, "evidence_nature"),
      claimAuthority: text(evd, "claim_authority"),
      inferenceLimits: texts(evd.inference_limits),
      effects: texts(item.effects),
      researchRoles: texts(item.researchRoles),
    };
  });

  const sources = [...distinctSources.values()].map(({ detail, usedBy }) => sourceData(detail, uniqueInOrder(usedBy)));
  const questions = openQuestions(investigation);

  return {
    projectionVersion: PRB_DOSSIER_PROJECTION_VERSION,
    problem: problemData(projection.problem),
    investigation: { openQuestions: questions, path: pathStages(investigation) },
    decisionBasis: decisionBasis(record),
    history: history(record),
    evidence,
    sources,
    counts: {
      evidenceRecordCount: evidence.length,
      distinctSourceCount: sources.length,
      effectCount: evidence.reduce((total, item) => total + item.effects.length, 0),
      openQuestionCount: questions.length,
    },
  };
}
