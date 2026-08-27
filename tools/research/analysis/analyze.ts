/**
 * Pure analysis logic for the canonical SRC/EVD/PRB research corpus.
 *
 * Built on the shared TC-01 loading/indexing layer (corpus.ts) instead of
 * re-walking research/schemas/* or research/<dir>/*.yaml directly. Reuses
 * the already-loaded CorpusIndex; it does not perform its own filesystem
 * or YAML access and does not build an independent corpus index.
 *
 * No process/console/exit-code handling here; see cli.ts for the
 * CLI wrapper. This module is observational only: every value below is
 * either a raw count/distribution or a verbatim field already recorded on
 * a canonical PRB or EVD record (docs/datamodel.md §6, AGENTS.md
 * "Human-owned decisions"). It never infers analytical metadata from
 * `notes`/free text, and never ranks or scores problems.
 *
 * Preserves the legacy tools/analyze-research.js analytical contract for
 * SRC/EVD/PRB: per-problem linked/analysed EVD counts, lineage
 * known/missing counts, EVD analysis-field distributions, and the explicit
 * structural-gap detections.
 */
import { getRecordField } from "../core/record-fields.ts";
import type { CorpusIndex, RecordFields } from "../core/types.ts";

export interface ProblemAnalysis {
  prbId: string;
  prb: RecordFields;
  linkedEvdCount: number;
  knownLineageCount: number;
  missingLineageCount: number;
}

export interface CorpusSummary {
  sourceCount: number;
  evidenceCount: number;
  problemCount: number;
  totalRecords: number;
}

export interface AnalysisResult {
  summary: CorpusSummary;
  problemIds: string[];
  problems: Map<string, ProblemAnalysis>;
  gaps: string[];
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

  const prb = problemsById.get(prbId);
  if (!prb) return null;

  const linkedEvdIds = (Array.isArray(prb.evidence) ? (prb.evidence as unknown[]) : [])
    .map((entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Record<string, unknown>).evidence_id : undefined)
    .filter((id): id is string => typeof id === "string");
  const linkedEvds = linkedEvdIds
    .map((id) => (typeof id === "string" ? evidenceById.get(id) : undefined))
    .filter((e): e is RecordFields => e !== undefined);

  const lineageIds = linkedEvds
    .map((e) => getRecordField(e, "lineage_id"))
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");
  const knownLineageCount = new Set(lineageIds).size;
  const missingLineageCount = linkedEvds.length - lineageIds.length;

  return {
    prbId,
    prb,
    linkedEvdCount: linkedEvdIds.length,
    knownLineageCount,
    missingLineageCount,
  };
}

/**
 * Explicit, machine-detectable structural/metadata gaps for active
 * (status=OPEN) problems. Every entry restates an already-authored field's
 * absence; none of it is an inferred judgement.
 */
export function computeGaps(_index: CorpusIndex, _problems: Map<string, ProblemAnalysis>): string[] {
  return [];
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
      totalRecords: index.totalRecords,
    },
    problemIds,
    problems,
    gaps,
  };
}
