import type { SectionIndexEntry } from "./SectionIndexEntry";
import { SectionIndexList } from "./SectionIndexList";

/**
 * DS-04D Slice 2C — shared Generic UI rail section-index presentation
 * (docs/design/component-model.md §4.3 "Section-index presentation";
 * component-model.md §5.2), extracted from the current `ProblemReadingRail`
 * "Nesta página" nav and `SourceReadingRailIndex` "Nesta fonte" nav
 * (`apps/research-explorer/src/problem/ProblemView.tsx`,
 * `apps/research-explorer/src/records/RecordDetailPanel.tsx`) — an
 * accessible `<nav>` of ordinary anchor links, suitable for a
 * `ReadingLayout` rail slot. The caller supplies the accessible label and
 * every entry (order, presence, label, href, and any nested entries already
 * decided); this component performs no selection, sorting, deduplication,
 * or id derivation of its own (component-model.md §2.3).
 *
 * This component owns no sticky/layout behaviour and no current-section
 * tracking or scrollspy — `ReadingLayout` owns rail positioning
 * (component-model.md §4.2), and no such tracking exists in current
 * production evidence for this index.
 */
export interface RailSectionIndexProps {
  /** Accessible name for the navigation landmark (e.g. "Nesta página"). */
  label: string;
  /** Ordered entries, rendered in exactly this order. */
  entries: SectionIndexEntry[];
}

export function RailSectionIndex({ label, entries }: RailSectionIndexProps) {
  return (
    <nav aria-label={label} className="ui-section-index-rail">
      <SectionIndexList entries={entries} className="ui-section-index-list" />
    </nav>
  );
}
