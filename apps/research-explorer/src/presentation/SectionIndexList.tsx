import type { SectionIndexEntry } from "./SectionIndexEntry";

/**
 * DS-04D Slice 2C — internal `<ul>`/`<li>`/`<a>` renderer shared by
 * `RailSectionIndex` and `CompactSectionIndex`. Not exported: the two
 * callers' semantic DOM differs (a `<nav>` alone for the rail; a `<nav>`
 * inside a `<details>`/`<summary>` for the compact index), so only this
 * innermost, identical list shape is shared (component-model.md §5.2,
 * "shared styling/helpers; domain-owned entries and semantic DOM"). Renders
 * entries in exactly the caller-supplied order with ordinary anchor links;
 * nesting recurses one caller-supplied level at a time without inferring,
 * flattening, sorting, or deduplicating.
 */
export function SectionIndexList({ entries, className }: { entries: SectionIndexEntry[]; className: string }) {
  return (
    <ul className={className}>
      {entries.map((entry) => (
        <li key={entry.key}>
          <a href={entry.href}>{entry.label}</a>
          {entry.entries && entry.entries.length > 0 && <SectionIndexList entries={entry.entries} className={className} />}
        </li>
      ))}
    </ul>
  );
}
