/**
 * Pure analysis logic for the canonical SRC/EVD/PRB/ASM research corpus.
 *
 * Built on the shared TC-01 loading/indexing layer (corpus.ts) instead of
 * re-walking research/schemas/* or research/<dir>/*.yaml directly. Reuses
 * the already-loaded CorpusIndex; it does not perform its own filesystem
 * or YAML access and does not build an independent corpus index.
 *
 * No process/console/exit-code handling here; see cli.ts for the
 * CLI wrapper. This module is observational only: every value below is
 * either a raw count/distribution or a verbatim field already recorded on
 * a canonical PRB, EVD, or ASM record (docs/datamodel.md §6, AGENTS.md
 * "Human-owned decisions"). It never infers analytical metadata from
 * `notes`/free text, and never ranks or scores problems.
 *
 * Preserves the legacy tools/analyze-research.js analytical contract:
 * per-problem linked/analysed EVD counts, lineage known/missing counts,
 * EVD analysis-field distributions, the transitional legacy-ASM
 * `assessment_status=CURRENT` selection (docs/datamodel.md's disclosed
 * PRB-current-state / ASM-immutable-snapshot migration boundary), and the
 * explicit structural-gap detections.
 */
import type { CorpusIndex, RecordFields } from "../core/types.ts";

const ACTIVE_STATUS = "OPEN";

export type Distribution = Array<[string, number]>;

export interface ProblemAnalysis {
  prbId: string;
  prb: RecordFields;
  linkedEvdCount: number;
  evdWithAnalysisCount: number;
  knownLineageCount: number;
  missingLineageCount: number;
  contributionDistribution: Distribution;
  frictionTypeDistribution: Distribution;
  verificationDistribution: Distribution;
  temporalRelevanceDistribution: Distribution;
  representativenessDistribution: Distribution;
  publicSignalClassDistribution: Distribution;
  asmRecords: RecordFields[];
  currentAsm: RecordFields | null;
}

export interface CorpusSummary {
  sourceCount: number;
  evidenceCount: number;
  problemCount: number;
  assessmentCount: number;
  totalRecords: number;
}

export interface AnalysisResult {
  summary: CorpusSummary;
  problemIds: string[];
  problems: Map<string, ProblemAnalysis>;
  gaps: string[];
}

function getPath(fields: RecordFields, dotted: string): unknown {
  let cur: unknown = fields;
  for (const part of dotted.split(".")) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur) || !(part in cur)) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Tallies occurrences of each value, sorted deterministically by value. */
export function tally(items: unknown[]): Distribution {
  const counts = new Map<string, number>();
  for (const it of items) {
    if (it === undefined || it === null) continue;
    const key = String(it);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function recordsOf(index: CorpusIndex, prefix: string): RecordFields[] {
  const recordIndex = index.byPrefix.get(prefix);
  if (!recordIndex) return [];
  return recordIndex.records.map((r) => r.fields);
}

function byId(index: CorpusIndex, prefix: string): ReadonlyMap<string, RecordFields> {
  const recordIndex = index.byPrefix.get(prefix);
  const map = new Map<string, RecordFields>();
  if (!recordIndex) return map;
  for (const [id, record] of recordIndex.byId) {
    map.set(id, record.fields);
  }
  return map;
}

/**
 * Computes the per-problem analysis for one PRB-* record, or null if
 * prbId does not resolve to a canonical record in the given index.
 */
export function computeProblemAnalysis(index: CorpusIndex, prbId: string): ProblemAnalysis | null {
  const problemsById = byId(index, "PRB-");
  const evidenceById = byId(index, "EVD-");
  const assessments = recordsOf(index, "ASM-");

  const prb = problemsById.get(prbId);
  if (!prb) return null;

  const linkedEvdIds = Array.isArray(prb.evidence) ? (prb.evidence as unknown[]) : [];
  const linkedEvds = linkedEvdIds
    .map((id) => (typeof id === "string" ? evidenceById.get(id) : undefined))
    .filter((e): e is RecordFields => e !== undefined);

  const withAnalysis = linkedEvds.filter((e) => e.analysis);
  const lineageIds = withAnalysis
    .map((e) => getPath(e, "analysis.lineage_id"))
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");
  const knownLineageCount = new Set(lineageIds).size;
  const missingLineageCount = linkedEvds.length - lineageIds.length;

  const contributionAll: unknown[] = [];
  const frictionAll: unknown[] = [];
  const verificationAll: unknown[] = [];
  const temporalAll: unknown[] = [];
  const representativenessAll: unknown[] = [];
  const signalClassAll: unknown[] = [];
  for (const e of withAnalysis) {
    const a = e.analysis as Record<string, unknown>;
    if (Array.isArray(a.contribution)) contributionAll.push(...a.contribution);
    if (Array.isArray(a.friction_types)) frictionAll.push(...a.friction_types);
    if (a.verification != null) verificationAll.push(a.verification);
    if (a.temporal_relevance != null) temporalAll.push(a.temporal_relevance);
    if (a.representativeness != null) representativenessAll.push(a.representativeness);
    if (a.public_signal_class != null) signalClassAll.push(a.public_signal_class);
  }

  const asmRecords = assessments.filter((a) => a.problem === prbId);
  const currentAsm = asmRecords.find((a) => a.assessment_status === "CURRENT") || null;

  return {
    prbId,
    prb,
    linkedEvdCount: linkedEvdIds.length,
    evdWithAnalysisCount: withAnalysis.length,
    knownLineageCount,
    missingLineageCount,
    contributionDistribution: tally(contributionAll),
    frictionTypeDistribution: tally(frictionAll),
    verificationDistribution: tally(verificationAll),
    temporalRelevanceDistribution: tally(temporalAll),
    representativenessDistribution: tally(representativenessAll),
    publicSignalClassDistribution: tally(signalClassAll),
    asmRecords,
    currentAsm,
  };
}

/**
 * Explicit, machine-detectable structural/metadata gaps for active
 * (status=OPEN) problems and all assessments. Every entry restates an
 * already-authored field's absence or an already-authored UNKNOWN/
 * NOT_ASSESSED value; none of it is an inferred judgement.
 */
export function computeGaps(index: CorpusIndex, problems: Map<string, ProblemAnalysis>): string[] {
  const gaps: string[] = [];

  const allProblems = recordsOf(index, "PRB-");
  const activePrbIds = allProblems
    .filter((p) => p.status === ACTIVE_STATUS)
    .map((p) => p.problem_id as string)
    .sort();

  for (const prbId of activePrbIds) {
    const analysis = problems.get(prbId);
    const asmRecords = analysis ? analysis.asmRecords : [];
    if (asmRecords.length === 0) {
      gaps.push(`active ${prbId} has no ASM record`);
    } else if (!asmRecords.some((a) => a.assessment_status === "CURRENT")) {
      gaps.push(`active ${prbId} has ASM record(s) but none with assessment_status=CURRENT`);
    }
  }

  for (const prbId of activePrbIds) {
    const analysis = problems.get(prbId);
    if (!analysis) continue;
    const missing = analysis.linkedEvdCount - analysis.evdWithAnalysisCount;
    if (missing > 0) {
      gaps.push(
        `${prbId}: ${missing}/${analysis.linkedEvdCount} linked EVD missing analytical metadata (analysis block absent)`
      );
    }
  }

  const assessments = recordsOf(index, "ASM-");
  for (const asm of assessments) {
    const gateEntries = Object.entries((asm.decision_gates as Record<string, unknown>) || {});
    const unresolved = gateEntries.filter(([, v]) => v === "UNKNOWN" || v === "NOT_ASSESSED");
    if (unresolved.length > 0) {
      gaps.push(
        `${asm.assessment_id}: ${unresolved.length} decision gate(s) UNKNOWN/NOT_ASSESSED (${unresolved
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")})`
      );
    }
    const unknownCount = Object.keys((asm.critical_unknowns as Record<string, unknown>) || {}).length;
    if (unknownCount > 0) {
      gaps.push(`${asm.assessment_id}: ${unknownCount} critical unknown(s) recorded`);
    }
    if (asm.triage === "DEEPEN" && (!asm.next_action || String(asm.next_action).trim() === "")) {
      gaps.push(`${asm.assessment_id}: triage=DEEPEN without a usable next_action`);
    }
  }

  return gaps;
}

/**
 * Analyzes an already-loaded, already-validated CorpusIndex. Callers are
 * responsible for validating the corpus first (see validate.ts); this
 * function performs no validation of its own and assumes referential
 * integrity already holds.
 */
export function analyzeCorpus(index: CorpusIndex): AnalysisResult {
  const sources = recordsOf(index, "SRC-");
  const evidence = recordsOf(index, "EVD-");
  const problemRecords = recordsOf(index, "PRB-");
  const assessments = recordsOf(index, "ASM-");

  const problemIds = problemRecords.map((p) => p.problem_id as string).sort();
  const problems = new Map<string, ProblemAnalysis>();
  for (const prbId of problemIds) {
    const analysis = computeProblemAnalysis(index, prbId);
    if (analysis) problems.set(prbId, analysis);
  }

  const gaps = computeGaps(index, problems);

  return {
    summary: {
      sourceCount: sources.length,
      evidenceCount: evidence.length,
      problemCount: problemRecords.length,
      assessmentCount: assessments.length,
      totalRecords: index.totalRecords,
    },
    problemIds,
    problems,
    gaps,
  };
}
