import { describeType } from "../presentation/typeGlossary";

/**
 * DS-04D Slice 3A — records/presentation domain: the approved public type
 * meaning for a record's canonical prefix (docs/design/component-model.md
 * §4.4 "RecordTypeLabel"). Reuses `describeType()` as the sole label
 * authority (typeGlossary.ts) rather than a second SRC/EVD/PRB label table,
 * so its existing graceful unknown-prefix fallback (a bare prefix label
 * with the generic schema-defined description) applies here unchanged.
 *
 * The approved catalogue (docs/design/reference/components/
 * ds-03b-component-catalogue.dc.html §4) renders the public type label
 * itself — "Fonte" / "Evidência" / "Problema" — in sans/interface
 * typography for both variants, never the raw technical prefix alone: a
 * reader must not need to memorise SRC-/EVD-/PRB- to know a record's type.
 * The canonical prefix stays available through the record's own
 * `RecordIdentifier`, so this component does not duplicate technical
 * identity into its own markup.
 *
 * - `compact` — the list/row marker beside a record row/identity line,
 *   current evidence `.desktop-record-type`/`.narrow-record-type`
 *   (RecordsTable.tsx/NarrowRecordsList.tsx) and the EVD identity row
 *   (EvdDetail.tsx).
 * - `detail` — the stronger-emphasis presentation shown once per Record
 *   Detail meaning zone, current evidence `.detail-type-badge` (`TypeBadge`
 *   in RecordDetailPanel.tsx). Per the approved catalogue, this is "the
 *   same anatomy at higher contrast, not a different shape" — both variants
 *   stay plain sans/interface type presentation, never technical
 *   identifier typography.
 *
 * The public label is rendered as ordinary visible text, so it is present
 * in accessible content without relying on a `title` attribute.
 *
 * Never accepts or visually encodes Problem status, validation status,
 * evidence status, effect, or research role — those remain the province of
 * their own dimension-specific components (component-model.md §5.4).
 */
export interface RecordTypeLabelProps {
  /** The canonical type prefix, e.g. "EVD-". Used only to look up the public label via describeType(); unknown prefixes fall back gracefully. */
  prefix: string;
  /** `compact` — list/row marker. `detail` — stronger-emphasis Record Detail presentation. */
  variant?: "compact" | "detail";
}

export function RecordTypeLabel({ prefix, variant = "compact" }: RecordTypeLabelProps) {
  const typeInfo = describeType(prefix);

  if (variant === "detail") {
    return <span className="rec-type-label rec-type-label--detail">{typeInfo.label}</span>;
  }

  return <span className="rec-type-label rec-type-label--compact">{typeInfo.label}</span>;
}
