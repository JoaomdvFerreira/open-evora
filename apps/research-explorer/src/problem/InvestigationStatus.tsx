import { glossFor, FIELD_CAPTIONS } from "./statusGloss";
import { publicEnumLabel, publicCompactEnumLabel } from "../presentation/presentation";

/**
 * DS-04D Slice 3B — Problem domain: `validation_status` and `evidence_status`,
 * the two remaining approved semantic dimensions named by this slice's task
 * scope ("Evidence status" / "Corroboration / validation-related state").
 * Both belong to a Problem's own investigation state — never to an
 * individual EVD or Source record (component-visual-contract.md
 * "`evidence_status` belongs to a Problem's investigation state, not to an
 * individual EVD"; the approved catalogue's "Evidence status — a Problem
 * investigation state" card: "shown only in explicit Problem-state context,
 * never on an individual EVD").
 *
 * They share one anatomy in the approved catalogue — caption + value, same
 * chip shape, same `ui-inline-label` anatomy, same three call-site forms —
 * which is why one private renderer backs both. But they remain two
 * distinct public components with distinct field names, distinct value
 * sets, and distinct caption/gloss lookups, per this slice's explicit scope
 * boundary ("The approved semantic dimensions must remain distinct... Do
 * not merge these merely because their visual anatomy may be similar").
 * Neither accepts the other's values, and neither accepts `status`
 * (Problem lifecycle — see ProblemLifecycleStatus.tsx): "Evidência
 * insuficiente" is a lifecycle value and does not belong to this dimension
 * (catalogue, same card).
 *
 * Three forms are implemented, matching current production evidence:
 * - `overview` — plain caption/value pair (Overview.tsx's
 *   `problemStatusDimensions()`/`.overview-status-dimension`, which already
 *   renders both fields this way, using `publicCompactEnumLabel`).
 * - `reading` — the bounded inline-label chip (ProblemView.tsx's
 *   `StatusChip`, `.status-chip`, the current production reading form for
 *   both fields via `HEADER_STATE_FIELDS`).
 * - `technical` — raw canonical field:value pair
 *   (RecordDetailPanel.tsx's `PrbCanonicalStatePanel`, reimplemented here as
 *   `.prb-status-technical-field` in domain.css on the DS-04B foundation
 *   token layer), gloss never substituted for the stored value.
 *
 * A `history` transition form is not implemented for the same reason given
 * in ProblemLifecycleStatus.tsx: `ProblemHistoryView.tsx`'s `StateChanges`
 * renders these fields' transitions today only as two of five fields inside
 * one generic renderer, not as a dimension-specific composition, and this
 * slice does not modify `ProblemHistoryView.tsx`.
 *
 * `overview` uses the compact label set (`publicCompactEnumLabel`) to match
 * Overview.tsx's existing grammar exactly ("Validação: Parcialmente
 * validada", not the full-label "Parcialmente validado"); `reading` and
 * `technical` keep the full label set, matching `StatusChip`/the canonical
 * panel unchanged.
 */
export interface InvestigationStatusProps {
  /** The stored canonical value, e.g. "unvalidated" or "discovered". Never translated or reclassified by this component. */
  value: string;
  /** `overview` — plain caption/value pair (compact label grammar). `reading` — bounded inline-label chip. `technical` — raw field:value pair, gloss never substituted. */
  form: "overview" | "reading" | "technical";
}

function InvestigationDimensionStatus({ field, value, form }: { field: "validation_status" | "evidence_status" } & InvestigationStatusProps) {
  const caption = FIELD_CAPTIONS[field];

  if (form === "technical") {
    return (
      <span className="prb-status-technical">
        <code className="prb-status-technical-field">{field}</code> <span className="prb-status-technical-field">{value}</span>
      </span>
    );
  }

  if (form === "overview") {
    return (
      <span className="prb-status-overview">
        <span className="prb-status-overview-caption">{caption}</span>
        <span className="prb-status-overview-value">{publicCompactEnumLabel(field, value)}</span>
      </span>
    );
  }

  const gloss = glossFor(field, value);
  const label = gloss ? gloss.label : publicEnumLabel(field, value);

  return (
    <span className="prb-status-chip ui-inline-label" aria-label={`${caption}: ${label}`}>
      <span className="prb-status-chip-caption">{caption}:</span>
      <span className="prb-status-chip-value">{label}</span>
    </span>
  );
}

/** `validation_status` — whether the Problem's current framing has survived a deliberate challenge. Never accepts `evidence_status` or `status` values. */
export function ValidationStatus(props: InvestigationStatusProps) {
  return <InvestigationDimensionStatus field="validation_status" {...props} />;
}

/** `evidence_status` — a Problem's investigation state, not an EVD property. Never accepts `validation_status` or `status` values. */
export function EvidenceStatus(props: InvestigationStatusProps) {
  return <InvestigationDimensionStatus field="evidence_status" {...props} />;
}
