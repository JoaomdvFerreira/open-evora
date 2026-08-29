import type { ReactNode } from "react";

/**
 * DS-04D Slice 2B — shared Generic UI in-progress/loading feedback boundary
 * (docs/design/component-model.md §4.3 "ProgressMessage"). Renders the
 * caller-owned message inside the same `role="status" aria-live="polite"`
 * pattern already repeated across App/Explorer/Overview/RecordsExplorer/
 * ProblemView/RecordDetailPanel loading branches (e.g.
 * `apps/research-explorer/src/app/App.tsx`), without adopting error or
 * empty-result meaning: this component never renders a retry action, never
 * uses alert semantics, and never appears for an established empty result.
 * The caller decides when loading is in progress and supplies the exact
 * PT-PT copy; no polling, timers, or progress inference happen here.
 */
export interface ProgressMessageProps {
  /** The in-progress copy, exactly as supplied — no phrasing or truncation. */
  message: ReactNode;
}

export function ProgressMessage({ message }: ProgressMessageProps) {
  return (
    <p role="status" aria-live="polite" className="ui-progress-message">
      {message}
    </p>
  );
}
