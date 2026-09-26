/**
 * Canonical SRC → EVD → PRB relation selectors for Source View.
 *
 * EVDs cite sources only through `provenance.sources[]`; PRBs use EVDs only
 * through their `evidence[]` relationship objects. This module consumes the
 * corresponding generic graph edges and never recreates semantic state.
 */

import type { DataProvider, RecordDetail } from "../dataProvider/types";

const PROVENANCE_SOURCES_FIELD = "provenance.sources";
const PRB_EVIDENCE_FIELD = "evidence";

function uniqueIds(ids: (string | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === "string"))];
}

export interface SourceRelatedProblem {
  problemId: string;
  viaEvidenceIds: string[];
}

export interface SourceEvidenceRelations {
  /** EVDs explicitly citing this Source in `provenance.sources[]`. */
  evidence: RecordDetail[];
  uniqueEvidenceCount: number;
  /** PRBs explicitly using one of these EVDs in `evidence[]`. */
  relatedProblems: SourceRelatedProblem[];
  /**
   * Canonical PRB `domain` codes per related Problem, read from each PRB
   * detail after relation resolution (the record index does not carry them).
   * A Problem whose detail cannot be read, or that has no domain, maps to [].
   */
  problemDomainCodes: Record<string, string[]>;
}

function domainCodesOf(problemDetail: RecordDetail): string[] {
  const domain = problemDetail.record.domain;
  return Array.isArray(domain) ? domain.filter((code): code is string => typeof code === "string" && code.trim() !== "") : [];
}

function evidenceIdsFor(sourceDetail: RecordDetail): string[] {
  return uniqueIds(sourceDetail.incomingEdges.filter((edge) => edge.field === PROVENANCE_SOURCES_FIELD).map((edge) => edge.from));
}

function relatedProblemIdsFor(evidenceDetail: RecordDetail): string[] {
  return uniqueIds(evidenceDetail.incomingEdges.filter((edge) => edge.field === PRB_EVIDENCE_FIELD).map((edge) => edge.from));
}

/** Loads the complete canonical relation set for one Source. */
export async function loadSourceEvidenceRelations(provider: DataProvider, sourceId: string): Promise<SourceEvidenceRelations> {
  const sourceDetail = await provider.getRecord(sourceId);
  const evidenceIds = evidenceIdsFor(sourceDetail);
  const evidence = await Promise.all(evidenceIds.map((id) => provider.getRecord(id)));
  const relatedProblemsByPrbId = new Map<string, SourceRelatedProblem>();

  for (const evidenceDetail of evidence) {
    for (const problemId of relatedProblemIdsFor(evidenceDetail)) {
      const existing = relatedProblemsByPrbId.get(problemId);
      if (existing) {
        if (!existing.viaEvidenceIds.includes(evidenceDetail.id)) existing.viaEvidenceIds.push(evidenceDetail.id);
      } else {
        relatedProblemsByPrbId.set(problemId, { problemId, viaEvidenceIds: [evidenceDetail.id] });
      }
    }
  }

  const relatedProblems = [...relatedProblemsByPrbId.values()];
  const domainEntries = await Promise.all(relatedProblems.map(async ({ problemId }) => {
    const codes = await provider.getRecord(problemId).then(domainCodesOf, () => []);
    return [problemId, codes] as const;
  }));

  return {
    evidence,
    uniqueEvidenceCount: evidenceIds.length,
    relatedProblems,
    problemDomainCodes: Object.fromEntries(domainEntries),
  };
}
