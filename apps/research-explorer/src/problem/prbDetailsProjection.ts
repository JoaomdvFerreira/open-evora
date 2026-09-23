import type { EvidenceWithSources, ProblemProjection } from "./problemProjection";

/**
 * PD-02A — pure canonical-to-presentation mapping for the generic public PRB
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
 * below, which is rendered as authored free text only, never parsed into a
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

export interface PrbEvidenceRelationship {
  evidenceId: string;
  observationSummary: string | null;
  effects: string[];
  researchRoles: string[];
  sourcePublishers: string[];
}

/**
 * "O que sabemos até agora" statements. `evidenceIds`, when supplied, is a
 * caller-chosen subset (PD-02A's PRB-0005 Storybook fixture uses exactly
 * EVD-000139/EVD-000003/EVD-000105/EVD-000167 — a fixture-only selection,
 * not a production ranking rule); production callers omit it and receive
 * every linked evidence item in the PRB's own authored `evidence[]` order.
 */
export function knownEvidenceStatements(projection: ProblemProjection, evidenceIds?: string[]): PrbEvidenceRelationship[] {
  const byId = new Map(projection.evidence.map((item) => [item.detail.id, item]));
  const ordered: EvidenceWithSources[] = evidenceIds
    ? evidenceIds.map((id) => byId.get(id)).filter((item): item is EvidenceWithSources => item !== undefined)
    : projection.evidence;

  return ordered.map((item) => {
    const evidenceRecord = item.detail.record;
    const observation = recordValue(evidenceRecord.observation);
    return {
      evidenceId: item.detail.id,
      observationSummary: observation ? fieldValue(observation, "summary") : null,
      effects: item.effects ?? [],
      researchRoles: item.researchRoles ?? [],
      sourcePublishers: item.sources.map((source) => fieldValue(source.record, "publisher")).filter((value): value is string => value !== null),
    };
  });
}

export interface PrbOpenQuestion {
  question: string;
  currentAction: string | null;
  whatWeUnderstand: string | null;
  relatedEvidenceIds: string[];
}

/**
 * `investigation.open_questions[]` — `why_open` is the canonical field that
 * best matches the reference's "O que entendemos" block; `current_action` is
 * rendered exactly as authored, never parsed for a leading keyword like
 * "WATCH —" and never substituted with reference-only illustrative text
 * (e.g. "Acompanhar") when the field itself carries different authored
 * content or is entirely absent.
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
      currentAction: fieldValue(item, "current_action"),
      whatWeUnderstand: fieldValue(item, "why_open"),
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

export interface PrbDetailsData {
  problemId: string;
  title: string;
  statement: string | null;
  topics: string[];
  geographyScope: PrbScope | null;
  updatedAt: string | null;
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
 * Assembles the full PrbDetailsPresentation prop set from a resolved
 * ProblemProjection. `knownEvidenceIds`, when supplied, narrows "O que
 * sabemos até agora" to a caller-chosen subset (see knownEvidenceStatements);
 * every other section always reflects the PRB's complete canonical content,
 * per the task's "use the full canonical authored content, not shortened
 * HTML copy" requirement.
 */
export function buildPrbDetailsData(projection: ProblemProjection): PrbDetailsData {
  const record = projection.problem.record;
  const evidenceEffectCount = projection.evidence.reduce((total, item) => total + (item.effects?.length ?? 0), 0);

  return {
    problemId: projection.problem.id,
    title: fieldValue(record, "title") ?? projection.problem.id,
    statement: fieldValue(record, "problem_statement"),
    topics: stringValues(record.domain),
    geographyScope: scope(record),
    updatedAt: fieldValue(record, "updated_at"),
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
