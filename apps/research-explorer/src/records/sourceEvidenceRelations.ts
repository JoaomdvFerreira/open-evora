/**
 * SUI-03A2: pure relation selectors extending the SUI-03A1 Source View model
 * (`sourceView.ts`) with EVD backlinks and PRB traversal — the "O que
 * encontrámos" / "Na investigação" data those section-presence slots were
 * deliberately deferred for.
 *
 * Relations come exclusively from the read model's own `incomingEdges` /
 * `outgoingEdges` (`../dataProvider/types`), never by re-reading canonical
 * `record` fields directly — mirrors `problemProjection.ts`'s pattern of
 * building a presentation projection purely from `DataProvider.getRecord()`
 * calls over the existing generic edge mechanism (`AGENTS.md` — no
 * competing semantic definition of canonical relations).
 *
 * A Source relates to an EVD through two distinct canonical incoming edge
 * fields, which this module keeps separate per the task's presentation
 * meanings for later UI:
 *   - `source.source_id`   → "Evidência retirada desta fonte" (primary)
 *   - `additional_sources` → "Evidência que também usa esta fonte" (additional)
 * If the same EVD reaches the SRC through both fields, it is classified as
 * primary only — `source.source_id` wins, no duplicate in additional.
 *
 * PRB traversal from each related EVD uses only that EVD's own outgoing
 * `analysis.related_problems` edges (mirrors `PROBLEM_REFERENCE_FIELDS` in
 * `RecordDetailPanel.tsx`) — never PRB.evidence, notes, or any other path.
 */

import type { DataProvider, RecordDetail } from "../dataProvider/types";

const PRIMARY_SOURCE_FIELD = "provenance.sources";
const ADDITIONAL_SOURCE_FIELD = "additional_sources";
const RELATED_PROBLEMS_FIELD = "analysis.related_problems";

function uniqueIds(ids: (string | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === "string"))];
}

/** One related PRB together with the related EVD IDs whose `analysis.related_problems` edge leads to it, so later UI can explain the SRC → EVD → PRB path. */
export interface SourceRelatedProblem {
  problemId: string;
  viaEvidenceIds: string[];
}

export interface SourceEvidenceRelations {
  /** EVDs reaching this SRC via `source.source_id` — "Evidência retirada desta fonte". */
  primaryEvidence: RecordDetail[];
  /** EVDs reaching this SRC via `additional_sources` only — "Evidência que também usa esta fonte". An EVD present in `primaryEvidence` is never repeated here. */
  additionalEvidence: RecordDetail[];
  /** Deterministic unique count across both categories combined. */
  uniqueEvidenceCount: number;
  /** PRBs explicitly reachable from any related EVD's own `analysis.related_problems` edges, deduplicated, each annotated with the related EVD ID(s) that lead to it. */
  relatedProblems: SourceRelatedProblem[];
}

/**
 * Splits a Source's incoming EVD edges into primary/additional, applying
 * the primary-wins precedence rule before any EVD detail is fetched.
 */
function classifyIncomingEvidenceIds(sourceDetail: RecordDetail): { primaryIds: string[]; additionalIds: string[] } {
  const primaryIds = uniqueIds(sourceDetail.incomingEdges.filter((edge) => edge.field === PRIMARY_SOURCE_FIELD || edge.field === "source.source_id").map((edge) => edge.from));
  const primarySet = new Set(primaryIds);

  const additionalIds = uniqueIds(
    sourceDetail.incomingEdges.filter((edge) => edge.field === ADDITIONAL_SOURCE_FIELD).map((edge) => edge.from)
  ).filter((id) => !primarySet.has(id));

  return { primaryIds, additionalIds };
}

/** This EVD's directly-reachable related PRB IDs, via `analysis.related_problems` outgoing edges only. */
function relatedProblemIdsFor(evidenceDetail: RecordDetail): string[] {
  return uniqueIds([
    ...evidenceDetail.incomingEdges.filter((edge) => edge.field === "evidence").map((edge) => edge.from),
    ...evidenceDetail.outgoingEdges.filter((edge) => edge.field === RELATED_PROBLEMS_FIELD).map((edge) => edge.to),
  ]);
}

/**
 * Loads the full SRC → EVD → PRB relation set for one Source, deduplicated
 * and precedence-resolved per the module doc above. `sourceId` must already
 * resolve to a SRC- record; the caller is responsible for that (mirrors
 * `loadProblemProjection`'s contract).
 */
export async function loadSourceEvidenceRelations(provider: DataProvider, sourceId: string): Promise<SourceEvidenceRelations> {
  const sourceDetail = await provider.getRecord(sourceId);
  const { primaryIds, additionalIds } = classifyIncomingEvidenceIds(sourceDetail);

  const primaryEvidence = await Promise.all(primaryIds.map((id) => provider.getRecord(id)));
  const additionalEvidence = await Promise.all(additionalIds.map((id) => provider.getRecord(id)));

  const relatedProblemsByPrbId = new Map<string, SourceRelatedProblem>();
  for (const evidenceDetail of [...primaryEvidence, ...additionalEvidence]) {
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
    primaryEvidence,
    additionalEvidence,
    uniqueEvidenceCount: primaryIds.length + additionalIds.length,
    relatedProblems: [...relatedProblemsByPrbId.values()],
  };
}

// ---------------------------------------------------------------------------
// Section presence (feeds SUI-03A1's computeSourceSectionPresence)
// ---------------------------------------------------------------------------

import type { SourceSectionRelationContext } from "./sourceView";

/**
 * Derives the `SourceSectionRelationContext` `computeSourceSectionPresence`
 * (`sourceView.ts`) needs from a loaded relation set — the one shared
 * section-index source stays in `sourceView.ts`; this is just the adapter
 * from this module's relation shape to that function's small input.
 */
export function toSourceSectionRelationContext(relations: Pick<SourceEvidenceRelations, "relatedProblems">): SourceSectionRelationContext {
  return { hasRelatedProblem: relations.relatedProblems.length > 0 };
}
