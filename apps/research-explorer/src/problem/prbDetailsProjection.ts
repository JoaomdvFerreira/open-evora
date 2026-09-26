import type { EvidenceWithSources, ProblemProjection } from "./problemProjection";

/**
 * Pure canonical-to-presentation mapping for the generic public PRB
 * Details composition (PrbDetailsPresentation.tsx). This module owns no
 * rendering; it only reads a resolved ProblemProjection (already-fetched PRB
 * + linked EVD + linked SRC, from problemProjection.ts) and reshapes it into
 * plain presentation-ready values.
 *
 * Every field is optional/conditional exactly as it is in canonical data
 * (docs/datamodel.md) — nothing here fabricates a value, infers a posture,
 * or derives a state the record does not author. Where the approved HTML
 * reference (docs/design/reference/prb-details/) shows illustrative content
 * with no canonical counterpart (e.g. a "WATCH" badge on every open
 * question), this module simply does not produce it — see current_action
 * below, which is carried as authored free text only, never parsed into a
 * posture/badge.
 */

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function fieldValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export interface PrbScope {
  area: string | null;
  level: string | null;
}

function scope(record: Record<string, unknown>): PrbScope | null {
  const geography = recordValue(record.geography);
  if (!geography) return null;
  const area = fieldValue(geography, "area");
  const level = fieldValue(geography, "level");
  if (!area && !level) return null;
  return { area, level };
}

export interface PrbOpenQuestion {
  question: string;
  latestResult: string | null;
  whyOpen: string | null;
  resolutionCondition: string | null;
  currentAction: string | null;
  relatedEvidenceIds: string[];
}

/**
 * `investigation.open_questions[]` — each canonical field maps one-to-one
 * (`latest_result`, `why_open`, `resolution_condition`, `current_action`,
 * `evidence`) and stays null/empty when unauthored. Fields are never merged
 * into a synthetic summary or substituted with fallback prose.
 * `current_action` is authored free text: it is never parsed for a leading
 * keyword like "WATCH —", never turned into a posture/badge, and never
 * replaced with reference-only illustrative text (e.g. "Acompanhar").
 */
export function openQuestions(record: Record<string, unknown>): PrbOpenQuestion[] {
  const investigation = recordValue(record.investigation);
  const rawList = investigation ? investigation.open_questions : null;
  if (!Array.isArray(rawList)) return [];

  const items: PrbOpenQuestion[] = [];
  for (const raw of rawList) {
    const item = recordValue(raw);
    const question = item ? fieldValue(item, "question") : null;
    if (!item || !question) continue;
    items.push({
      question,
      latestResult: fieldValue(item, "latest_result"),
      whyOpen: fieldValue(item, "why_open"),
      resolutionCondition: fieldValue(item, "resolution_condition"),
      currentAction: fieldValue(item, "current_action"),
      relatedEvidenceIds: stringValues(item.evidence),
    });
  }
  return items;
}

export interface PrbPathStage {
  key: "initial_signal" | "development" | "delimitation";
  label: string;
  summary: string;
  evidenceIds: string[];
}

const PATH_STAGE_KEYS = ["initial_signal", "development", "delimitation"] as const;

const PATH_STAGE_LABELS: Record<(typeof PATH_STAGE_KEYS)[number], string> = {
  initial_signal: "Sinal inicial",
  development: "Desenvolvimento",
  delimitation: "Delimitação",
};

/**
 * `investigation.path.*` stages, in fixed canonical order. These are
 * sequential authored narrative stages, not a completion/current/pending
 * timeline state machine — no such state exists in canonical data, so none
 * is derived or displayed here (task: "do not fabricate timeline
 * completion/current/pending states").
 */
export function investigationPathStages(record: Record<string, unknown>): PrbPathStage[] {
  const investigation = recordValue(record.investigation);
  const path = investigation ? recordValue(investigation.path) : null;
  if (!path) return [];

  const stages: PrbPathStage[] = [];
  for (const key of PATH_STAGE_KEYS) {
    const stage = recordValue(path[key]);
    const summary = stage ? fieldValue(stage, "summary") : null;
    if (!stage || !summary) continue;
    stages.push({ key, label: PATH_STAGE_LABELS[key], summary, evidenceIds: stringValues(stage.evidence) });
  }
  return stages;
}

export interface PrbEffectTally {
  value: string;
  count: number;
}

/** Deterministic tally of PRB→EVD relationship effects, in first-seen order — a count of already-authored values, never a ranking or strength score. */
export function effectTally(evidence: EvidenceWithSources[]): PrbEffectTally[] {
  const counts = new Map<string, number>();
  for (const item of evidence) {
    for (const effect of item.effects ?? []) {
      counts.set(effect, (counts.get(effect) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

/**
 * The shared public PRB identity (local header + editorial hero) rendered by
 * both PRB views — Detalhes (PrbDetailsPresentation.tsx) and Histórico
 * (ProblemHistoryView.tsx) — so both read the same canonical fields the same
 * way rather than each re-deriving them.
 */
export interface PrbIdentityData {
  problemId: string;
  title: string;
  statement: string | null;
  topics: string[];
  /** Canonical `updated_at`: the date the PRB record was last edited — record metadata, not a currentness assessment. */
  updatedAt: string | null;
}

export function prbIdentity(problemId: string, record: Record<string, unknown>): PrbIdentityData {
  return {
    problemId,
    title: fieldValue(record, "title") ?? problemId,
    statement: fieldValue(record, "problem_statement"),
    topics: stringValues(record.domain),
    updatedAt: fieldValue(record, "updated_at"),
  };
}

export interface PrbDetailsData extends PrbIdentityData {
  /** Canonical `causal_reading`, verbatim — authored text, never derived from evidence. */
  causalReading: string | null;
  geographyScope: PrbScope | null;
  status: string | null;
  evidenceStatus: string | null;
  validationStatus: string | null;
  openQuestionCount: number;
  evidenceRecordCount: number;
  evidenceEffectCount: number;
  effectTally: PrbEffectTally[];
  openQuestions: PrbOpenQuestion[];
  pathStages: PrbPathStage[];
}

/**
 * Assembles the full PrbDetailsPresentation data from a resolved
 * ProblemProjection. Every field reflects the PRB's complete canonical
 * authored content — no caller-selected evidence subset, ranking or
 * "top evidence" rule exists here, and no shortened reference copy is used.
 */
export function buildPrbDetailsData(projection: ProblemProjection): PrbDetailsData {
  const record = projection.problem.record;
  const evidenceEffectCount = projection.evidence.reduce((total, item) => total + (item.effects?.length ?? 0), 0);

  return {
    ...prbIdentity(projection.problem.id, record),
    causalReading: fieldValue(record, "causal_reading"),
    geographyScope: scope(record),
    status: fieldValue(record, "status"),
    evidenceStatus: fieldValue(record, "evidence_status"),
    validationStatus: fieldValue(record, "validation_status"),
    openQuestionCount: openQuestions(record).length,
    evidenceRecordCount: projection.evidence.length,
    evidenceEffectCount,
    effectTally: effectTally(projection.evidence),
    openQuestions: openQuestions(record),
    pathStages: investigationPathStages(record),
  };
}
