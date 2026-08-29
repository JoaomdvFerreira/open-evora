/**
 * DS-04D Slice 2C — shared Generic UI section-index entry contract
 * (docs/design/component-model.md §4.3 "Section-index presentation";
 * component-model.md §5.2). The smallest neutral shape both `RailSectionIndex`
 * and `CompactSectionIndex` render: a caller-supplied, caller-ordered anchor
 * link plus an optional one level of nested entries of the same shape.
 * Nesting depth is constrained to exactly this one level — current
 * production evidence (`problemSectionIndex` in `apps/research-explorer/src/
 * problem/ProblemView.tsx`) only ever demonstrates a top-level section with
 * one level of subsections, so the contract is deliberately non-recursive
 * rather than speculatively supporting deeper hierarchy.
 *
 * Domain code remains the sole owner of entry order, presence, labels,
 * anchor hrefs, and nested-entry derivation (component-model.md §2.3): this
 * module defines only the caller-supplied shape, no selection logic.
 */
export interface SectionIndexSubentry {
  /** Stable identity for the list; not rendered. */
  key: string;
  /** The link's visible text, exactly as supplied — no label derivation. */
  label: string;
  /** The anchor's href, exactly as supplied (e.g. "#problem-estado") — no id-from-label derivation. */
  href: string;
}

export interface SectionIndexEntry {
  /** Stable identity for the list; not rendered. */
  key: string;
  /** The link's visible text, exactly as supplied — no label derivation. */
  label: string;
  /** The anchor's href, exactly as supplied (e.g. "#problem-estado") — no id-from-label derivation. */
  href: string;
  /** Optional one level of nested entries, exactly as supplied and ordered by the caller. */
  entries?: SectionIndexSubentry[];
}
