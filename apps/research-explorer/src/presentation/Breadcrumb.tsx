import { Fragment, type ReactNode } from "react";

/**
 * DS-04D Slice 2A — shared Generic UI breadcrumb presentation
 * (docs/design/component-model.md §4.3 "Breadcrumb"). Renders a named
 * navigation landmark, ordered ancestor actions, a presentation-only
 * separator hidden from the accessibility tree, and a non-interactive
 * current item. The caller supplies every label, every ancestor's actual
 * element (native <a> or <button>, so link vs button semantics stay
 * caller-owned), and the current item's content — this component never
 * assumes "Registos"/"Visão geral", a record type, a route shape, or
 * canonical ID formatting, and contains no routing logic and no domain
 * imports (mirrors the current RecordDetailPanel/ProblemView/
 * ProblemHistoryView `<nav aria-label="Localização">` markup this is
 * extracted from, without importing their label/navigation choices).
 */
export interface BreadcrumbAncestor {
  /** Stable identity for the list; not rendered. */
  key: string;
  /** The ancestor's own actionable element — an <a> or <button> the caller renders and owns. */
  action: ReactNode;
}

export interface BreadcrumbProps {
  /** Accessible name for the navigation landmark (e.g. "Localização"). */
  label: string;
  /** Ordered ancestors, rendered before the current item. */
  ancestors: BreadcrumbAncestor[];
  /** The current, non-interactive item's content (e.g. a record id). */
  current: ReactNode;
}

export function Breadcrumb({ label, ancestors, current }: BreadcrumbProps) {
  return (
    <nav aria-label={label} className="ui-breadcrumb">
      {ancestors.map((ancestor) => (
        <Fragment key={ancestor.key}>
          {ancestor.action}
          <span aria-hidden="true" className="ui-breadcrumb-separator">
            ›
          </span>
        </Fragment>
      ))}
      <span className="ui-breadcrumb-current">{current}</span>
    </nav>
  );
}
