import { describeType } from "../presentation/typeGlossary";

/**
 * DS-04D Slice 3A — records/presentation domain: record prefix plus the
 * approved public type meaning (docs/design/component-model.md §4.4
 * "RecordTypeLabel"). Reuses `describeType()` as the sole label authority
 * (typeGlossary.ts) rather than a second SRC/EVD/PRB label table, so its
 * existing graceful unknown-prefix fallback (a bare prefix label with the
 * generic schema-defined description) applies here unchanged.
 *
 * Extracted from two demonstrably distinct current rendered forms:
 * - `compact` — the bare prefix marker shown beside a record row/identity
 *   line, current evidence `.desktop-record-type`/`.narrow-record-type`
 *   (RecordsTable.tsx/NarrowRecordsList.tsx) and the EVD identity row's own
 *   `<code>{detail.type}</code> {typeInfo.label}` (EvdDetail.tsx);
 * - `detail` — the bordered badge shown once per Record Detail meaning zone,
 *   current evidence `.detail-type-badge` (`TypeBadge` in
 *   RecordDetailPanel.tsx).
 * These are visually and structurally distinct in current production (a
 * plain prefix token vs. a bordered prefix+label badge), so both are kept
 * rather than collapsed into one shape.
 *
 * Never accepts or visually encodes Problem status, validation status,
 * evidence status, effect, or research role — those remain the province of
 * their own dimension-specific components (component-model.md §5.4). The
 * canonical prefix stays visible in both variants, never hidden behind the
 * gloss alone.
 */
export interface RecordTypeLabelProps {
  /** The canonical type prefix, e.g. "EVD-". Rendered as-is; unknown prefixes fall back gracefully via describeType(). */
  prefix: string;
  /** `compact` — bare prefix marker for a record row/identity line. `detail` — bordered badge for a Record Detail meaning zone. */
  variant?: "compact" | "detail";
}

export function RecordTypeLabel({ prefix, variant = "compact" }: RecordTypeLabelProps) {
  const typeInfo = describeType(prefix);

  if (variant === "detail") {
    return (
      <span className="rec-type-label rec-type-label--detail ui-inline-label">
        <code>{prefix}</code> {typeInfo.label}
      </span>
    );
  }

  return (
    <span className="rec-type-label rec-type-label--compact" title={typeInfo.label}>
      {prefix}
    </span>
  );
}
