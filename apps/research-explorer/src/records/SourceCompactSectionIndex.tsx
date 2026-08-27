/**
 * SUI-03J2A: isolated compact/in-flow "Nesta fonte" section index — the
 * Source View counterpart to `ProblemHelpDisclosure`'s compact "Nesta
 * página" nav (`ProblemView.tsx`), for layouts where the desktop
 * `SourceReadingRailIndex` rail (`RecordDetailPanel.tsx`) is unavailable.
 *
 * `sourceSectionIndex` (`sourceSectionIndex.ts`) is the sole order/label/
 * anchor/presence authority — this component never hardcodes a duplicate
 * section list, and carries no loading, action, or type-card semantics of
 * its own (those stay the rail/content-shell's responsibility). This slice
 * only creates and tests the component; it is not yet wired into
 * `RecordDetailPanel`.
 */

import { sourceSectionIndex } from "./sourceSectionIndex";
import type { SourceSectionRelationContext } from "./sourceView";
import { CompactSectionIndex } from "./CompactSectionIndex";

export function SourceCompactSectionIndex({
  record,
  relationContext,
}: {
  record: Record<string, unknown>;
  relationContext?: SourceSectionRelationContext;
}) {
  const sections = sourceSectionIndex(record, relationContext);

  return <CompactSectionIndex label="Nesta fonte" sections={sections} className="source-compact-section-index" />;
}
