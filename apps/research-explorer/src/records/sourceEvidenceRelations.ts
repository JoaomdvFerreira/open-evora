/**
 * Canonical SRC → EVD → PRB relation selectors for Source View.
 *
 * EVDs cite sources only through `provenance.sources[]`; PRBs use EVDs only
 * through their `evidence[]` relationship objects. This module consumes the
 * corresponding generic graph edges and never recreates semantic state.
 */

import type { DataProvider, RecordDetail } from "../dataProvider/types";
import type { SourceSectionRelationContext } from "./sourceView";

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

  return {
    evidence,
    uniqueEvidenceCount: evidenceIds.length,
    relatedProblems: [...relatedProblemsByPrbId.values()],
  };
}

export function toSourceSectionRelationContext(relations: Pick<SourceEvidenceRelations, "relatedProblems">): SourceSectionRelationContext {
  return { hasRelatedProblem: relations.relatedProblems.length > 0 };
}
