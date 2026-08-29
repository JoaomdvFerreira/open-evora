/**
 * DS-04D Slice 2C — shared Generic UI section-index entry contract
 * (docs/design/component-model.md §4.3 "Section-index presentation";
 * component-model.md §5.2). The smallest neutral shape both `RailSectionIndex`
 * and `CompactSectionIndex` render: a caller-supplied, caller-ordered anchor
 * link plus an optional one-level-nested list of the same shape. Nesting
 * depth is not constrained here, but current production evidence
 * (`problemSectionIndex` in `apps/research-explorer/src/problem/
 * ProblemView.tsx`) only ever demonstrates one level of nested entries —
 * this contract does not itself add, infer, or validate depth.
 *
 * Domain code remains the sole owner of entry order, presence, labels,
 * anchor hrefs, and nested-entry derivation (component-model.md §2.3): this
 * module defines only the caller-supplied shape, no selection logic.
 */
export interface SectionIndexEntry {
  /** Stable identity for the list; not rendered. */
  key: string;
  /** The link's visible text, exactly as supplied — no label derivation. */
  label: string;
  /** The anchor's href, exactly as supplied (e.g. "#problem-estado") — no id-from-label derivation. */
  href: string;
  /** Optional nested entries, exactly as supplied and ordered by the caller. */
  entries?: SectionIndexEntry[];
}
