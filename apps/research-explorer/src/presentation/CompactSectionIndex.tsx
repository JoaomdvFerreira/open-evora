import type { SectionIndexEntry } from "./SectionIndexEntry";
import { SectionIndexList } from "./SectionIndexList";

/**
 * DS-04D Slice 2C — shared Generic UI compact section-index presentation
 * (docs/design/component-model.md §4.3 "Section-index presentation";
 * component-model.md §5.2), extracted from the current in-flow "Nesta
 * página"/"Nesta fonte" compact indexes (`apps/research-explorer/src/
 * problem/ProblemView.tsx`'s `ProblemHelpDisclosure` nav,
 * `apps/research-explorer/src/records/CompactSectionIndex.tsx`,
 * `SourceCompactSectionIndex.tsx`) — a native `<details>`/`<summary>` with
 * an accessible `<nav>` inside, remaining ordinary in-flow content. This is
 * not a generic `Disclosure` abstraction (component-model.md §4.3, "Native
 * `<details>/<summary>` remains the generic disclosure primitive... A React
 * `Disclosure` abstraction is deferred"): it renders exactly this one
 * section-index shape and nothing else, with no caller-supplied arbitrary
 * disclosure content.
 *
 * The caller owns the summary text, the nav's accessible label, and every
 * entry (order, presence, label, href, nesting) — this component performs
 * no selection, sorting, deduplication, or id derivation of its own
 * (component-model.md §2.3). Keyboard operability comes from the native
 * `<details>`/`<summary>` element, not from any behaviour added here.
 */
export interface CompactSectionIndexProps {
  /** The <summary> text, exactly as supplied (e.g. "Nesta página"). */
  summary: string;
  /** Accessible name for the nested navigation landmark (e.g. "Nesta página (versão compacta)"). */
  navLabel: string;
  /** Ordered entries, rendered in exactly this order. */
  entries: SectionIndexEntry[];
}

export function CompactSectionIndex({ summary, navLabel, entries }: CompactSectionIndexProps) {
  return (
    <details className="ui-surface-inset ui-section-index-compact">
      <summary>{summary}</summary>
      <nav aria-label={navLabel} className="ui-section-index-compact-nav">
        <SectionIndexList entries={entries} className="ui-section-index-list" />
      </nav>
    </details>
  );
}
