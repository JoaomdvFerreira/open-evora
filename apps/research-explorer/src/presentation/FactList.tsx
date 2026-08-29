import { Fragment, type ReactNode } from "react";

/**
 * DS-04D Slice 2A — shared Generic UI fact-list presentation
 * (docs/design/component-model.md §4.3 "FactList"). Renders a semantic
 * <dl>/<dt>/<dd> from explicitly ordered rows the caller supplies in full:
 * no raw canonical record input, no field extraction, no translation, no
 * sorting, and no absence/UNKNOWN inference — the caller decides what a row
 * means and whether it exists at all (mirrors the current
 * `.detail-provenance-grid` markup this is extracted from, without
 * inheriting any call site's field selection). `value` is `ReactNode`
 * because demonstrated usage already needs it: plain text, a `<code>` +
 * technical-role pair, and an action link all appear as `<dd>` content at
 * current `.detail-provenance-grid` call sites.
 */
export interface FactListRow {
  /** Stable identity for the list; not rendered. */
  key: string;
  /** The <dt> label, exactly as supplied — no caption lookup. */
  label: ReactNode;
  /** The <dd> value, exactly as supplied — no extraction or formatting. */
  value: ReactNode;
}

export interface FactListProps {
  rows: FactListRow[];
}

export function FactList({ rows }: FactListProps) {
  return (
    <dl className="ui-fact-list">
      {rows.map((row) => (
        <Fragment key={row.key}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
