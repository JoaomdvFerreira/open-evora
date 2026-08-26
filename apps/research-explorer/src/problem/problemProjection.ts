import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

/**
 * Problem-feature-specific projection over the existing generic DataProvider
 * — no new DataProvider methods, no second persistence model, no data
 * duplication. Everything here is assembled purely from getRecord() calls
 * already used elsewhere and the already-loaded index lookup; it is a
 * *presentation* projection, discarded and rebuilt whenever a Problem is
 * selected, never stored as its own source of truth.
 *
 * Type-specific logic (literal "EVD-"/"SRC-" checks) is intentional and
 * scoped to this file only — RE-03's whole purpose is a specialised Problem
 * projection (see docs/explorerarchitecture.md on presentation
 * projections); the generic DataProvider/Records/RecordDetail layers this
 * builds on remain untouched and fully generic.
 */

export interface EvidenceWithSources {
  detail: RecordDetail;
  sources: RecordDetail[];
  effects?: string[];
  researchRoles?: string[];
}

export interface ProblemProjection {
  problem: RecordDetail;
  evidence: EvidenceWithSources[];
}

function uniqueIds(ids: (string | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === "string"))];
}

function incomingIdsByFieldAndType(detail: RecordDetail, field: string, type: string, lookup: Map<string, RecordSummary>): string[] {
  return uniqueIds(
    detail.incomingEdges.filter((edge) => edge.field === field && lookup.get(edge.from ?? "")?.type === type).map((edge) => edge.from)
  );
}

function outgoingIdsByType(detail: RecordDetail, type: string, lookup: Map<string, RecordSummary>): string[] {
  return uniqueIds(detail.outgoingEdges.filter((edge) => lookup.get(edge.to ?? "")?.type === type).map((edge) => edge.to));
}

/**
 * Loads and assembles the full Problem projection for one PRB-* ID.
 * Fetches: the problem itself, its linked evidence (both the problem's own
 * outgoing `evidence` list and any EVD- pointing back at it via
 * `analysis.related_problems`, unioned/deduplicated), and each evidence
 * item's own linked sources (SRC-). All independent fetches run in parallel.
 */
export async function loadProblemProjection(
  provider: DataProvider,
  lookup: Map<string, RecordSummary>,
  problemId: string
): Promise<ProblemProjection> {
  const problem = await provider.getRecord(problemId);

  const evidenceIds = uniqueIds([
    ...outgoingIdsByType(problem, "EVD-", lookup),
    ...incomingIdsByFieldAndType(problem, "analysis.related_problems", "EVD-", lookup),
  ]);

  const evidenceDetails = await Promise.all(evidenceIds.map((id) => provider.getRecord(id)));

  const relationships = new Map(
    (Array.isArray(problem.record.evidence) ? problem.record.evidence : [])
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => [entry.evidence_id, { effects: Array.isArray(entry.effects) ? entry.effects.filter((v): v is string => typeof v === "string") : [], researchRoles: Array.isArray(entry.research_roles) ? entry.research_roles.filter((v): v is string => typeof v === "string") : [] }])
  );
  const evidence = await Promise.all(
    evidenceDetails.map(async (evidenceDetail): Promise<EvidenceWithSources> => {
      const sourceIds = outgoingIdsByType(evidenceDetail, "SRC-", lookup);
      const sources = await Promise.all(sourceIds.map((id) => provider.getRecord(id)));
      const relationship = relationships.get(evidenceDetail.id) ?? { effects: [], researchRoles: [] };
      return { detail: evidenceDetail, sources, ...relationship };
    })
  );

  return { problem, evidence };
}
