/**
 * SUI-03J2A: isolated compact/in-flow "Nesta fonte" section index — the
 * Source View counterpart to `ProblemHelpDisclosure`'s compact "Nesta
 * página" nav (`ProblemView.tsx`), for layouts where the desktop
 * `SourceReadingRailIndex` rail (`RecordDetailPanel.tsx`) is unavailable.
 *
 * `sourceSectionIndex` (`sourceSectionIndex.ts`) is the sole order/label/
 * anchor/presence authority — this component never hardcodes a duplicate
 * section list, and carries no loading, action, or type-card semantics of
 * its own (those stay the rail/content-shell's responsibility).
 *
 * DS-05H: renders the canonical `presentation/CompactSectionIndex` (not the
 * retired `records/CompactSectionIndex`); `.source-compact-section-index`
 * remains this Source-owned wrapper's sole responsibility (responsive
 * visibility), not generic component styling.
 */

import { sourceSectionIndex, type SourceSectionIndexEntry } from "./sourceSectionIndex";
import type { SourceSectionRelationContext } from "./sourceView";
import { CompactSectionIndex } from "../presentation/CompactSectionIndex";
import type { SectionIndexEntry } from "../presentation/SectionIndexEntry";

function toSectionIndexEntries(sections: SourceSectionIndexEntry[]): SectionIndexEntry[] {
  return sections.map((section) => ({ key: section.sectionId, label: section.label, href: `#${section.anchorId}` }));
}

export function SourceCompactSectionIndex({
  record,
  relationContext,
}: {
  record: Record<string, unknown>;
  relationContext?: SourceSectionRelationContext;
}) {
  const sections = sourceSectionIndex(record, relationContext);

  return (
    <div className="source-compact-section-index">
      <CompactSectionIndex summary="Nesta fonte" navLabel="Nesta fonte (versão compacta)" entries={toSectionIndexEntries(sections)} />
    </div>
  );
}
