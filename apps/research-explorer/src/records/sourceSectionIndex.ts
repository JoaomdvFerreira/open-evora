/**
 * SUI-03J0: the single presentation authority for the Source View section
 * index — order, public (PT-PT) label, and future DOM anchor id — shared by
 * both the desktop rail and the compact/mobile index that will consume it in
 * a later slice (mirrors `problemSectionIndex` in `ProblemView.tsx`, the
 * existing Problem View precedent for this pattern).
 *
 * This module owns none of the presence rules itself — those stay solely in
 * `computeSourceSectionPresence` (`sourceView.ts`), the one shared
 * presence authority (`AGENTS.md` — no competing semantic definition of
 * canonical state). This module only orders, labels, and filters.
 */

import { computeSourceSectionPresence, type SourceSectionId, type SourceSectionRelationContext } from "./sourceView";

export interface SourceSectionIndexEntry {
  sectionId: SourceSectionId;
  anchorId: string;
  label: string;
}

/** Canonical Source View section order — rendered order, not raw field order. */
const SOURCE_SECTION_ORDER: SourceSectionId[] = [
  "overview",
  "findings",
  "coverage",
  "dates-access",
  "licensing",
  "caveats",
  "investigation",
  "technical",
];

/** PT-PT public copy, exact strings used in rendered Source View headings. */
const SOURCE_SECTION_LABELS: Record<SourceSectionId, string> = {
  overview: "Visão geral",
  findings: "O que encontrámos",
  coverage: "Cobertura",
  "dates-access": "Datas e acesso",
  licensing: "Licenciamento",
  caveats: "Limitações",
  investigation: "Na investigação",
  technical: "Informação técnica",
};

/** Deterministic Source-specific DOM anchor ids, for a later slice to apply to rendered sections. */
const SOURCE_SECTION_ANCHOR_IDS: Record<SourceSectionId, string> = {
  overview: "source-overview",
  findings: "source-findings",
  coverage: "source-coverage",
  "dates-access": "source-dates-access",
  licensing: "source-licensing",
  caveats: "source-caveats",
  investigation: "source-investigation",
  technical: "source-technical",
};

/**
 * Builds the ordered, presence-filtered Source View section index for one
 * record. `"present"` sections are included; `"absent"` and `"deferred"`
 * sections are excluded — `"deferred"` (only ever `investigation`, without
 * `relationContext`) is excluded rather than shown speculatively, so the
 * index never claims a section exists before it's known to.
 */
export function sourceSectionIndex(
  record: Record<string, unknown>,
  relationContext?: SourceSectionRelationContext
): SourceSectionIndexEntry[] {
  const presence = computeSourceSectionPresence(record, relationContext);
  return SOURCE_SECTION_ORDER.filter((sectionId) => presence[sectionId] === "present").map((sectionId) => ({
    sectionId,
    anchorId: SOURCE_SECTION_ANCHOR_IDS[sectionId],
    label: SOURCE_SECTION_LABELS[sectionId],
  }));
}
