import { glossFor, FIELD_CAPTIONS } from "./statusGloss";
import { publicEnumLabel } from "../presentation/presentation";

/**
 * DS-04D Slice 3B — Problem domain: the Problem lifecycle `status` field
 * (`research/schemas/problem.schema.json`, `docs/datamodel.md`), one of the
 * three approved semantic dimensions named by this slice's task scope and
 * the "Problem lifecycle status — four dimensioned presentations" block of
 * the approved catalogue (docs/design/reference/components/
 * ds-03b-component-catalogue.dc.html §4). The catalogue's own six lifecycle
 * chips (Aberto/Rejeitado/Duplicado/Não digital/Já resolvido/Evidência
 * insuficiente) render flat, with no per-value glyph/tint — that distinguishes
 * `status` from the ordered validation/evidence dimensions in
 * `InvestigationStatus.tsx`, so this stays its own component rather than a
 * shared "investigation state" renderer with a different value set bolted on.
 *
 * Three forms are implemented, matching current production evidence exactly:
 * - `overview` — plain caption/value pair, no chip anatomy (Overview.tsx's
 *   `.overview-status-dimension`/`problemStatusDimensions()` pattern; that
 *   call site does not itself surface `status`, but the same plain-pair
 *   anatomy is the catalogue's own "Overview summary" cell for this field).
 * - `reading` — the bounded inline-label chip (ProblemView.tsx's `StatusChip`,
 *   `.status-chip`), still the sole production reading presentation of `status`.
 * - `technical` — raw canonical field:value pair
 *   (RecordDetailPanel.tsx's `PrbCanonicalStatePanel`/production
 *   `.detail-technical-field` treatment of the same field, reimplemented
 *   here as `.prb-status-technical-field` in domain.css on the DS-04B
 *   foundation token layer rather than depending on `index.css`'s pre-DS-04
 *   legacy tokens), never substituting the public gloss for the stored
 *   value.
 *
 * A `history` transition form is not implemented here: `ProblemHistoryView.tsx`'s
 * `StateChanges` already renders `status` transitions today, but as one of
 * five fields sharing one generic `publicFieldCaption()`/`publicEnumLabel()`
 * row, not as a `status`-specific composition with its own coherent
 * component boundary — extracting one dimension out of that shared renderer
 * without touching the other four would not be a clean isolated boundary,
 * and this slice does not modify `ProblemHistoryView.tsx`.
 *
 * The dimension caption is always rendered — no form may drop it, per this
 * slice's scope boundary. `overview` uses the surface-specific "Estado do
 * problema" (DS-04D Slice 3B F01); `reading`'s inline chip caption stays
 * "Estado" (FIELD_CAPTIONS), matching the bounded chip's existing anatomy.
 * The public gloss (`glossFor`/
 * `publicEnumLabel`) and the raw canonical value are never substituted for
 * one another: `technical` shows only the stored value, `overview`/`reading`
 * show only the public label. An unrecognised future `status` value still
 * renders via `publicEnumLabel`'s existing safe fallback (the raw canonical
 * value) rather than disappearing or being reclassified.
 */
export interface ProblemLifecycleStatusProps {
  /** The stored canonical `status` value, e.g. "OPEN". Never translated or reclassified by this component. */
  value: string;
  /** `overview` — plain caption/value pair. `reading` — bounded inline-label chip. `technical` — raw field:value pair, gloss never substituted. */
  form: "overview" | "reading" | "technical";
}

const FIELD = "status";

/* DS-04D Slice 3B F01: `overview`'s caption is the surface-specific
 * "Estado do problema" (disambiguating this dimension from validation/
 * evidence state when several status dimensions may appear together in a
 * summary), distinct from `reading`'s inline "Estado" (FIELD_CAPTIONS,
 * unchanged — the bounded chip already carries its own visual boundary, so
 * the shorter caption stays sufficient there). Presentation copy, not a
 * second canonical enum mapping. */
const OVERVIEW_CAPTION = "Estado do problema";

export function ProblemLifecycleStatus({ value, form }: ProblemLifecycleStatusProps) {
  const readingCaption = FIELD_CAPTIONS[FIELD];

  if (form === "technical") {
    return (
      <span className="prb-status-technical">
        <code className="prb-status-technical-field">{FIELD}</code> <span className="prb-status-technical-field">{value}</span>
      </span>
    );
  }

  const gloss = glossFor(FIELD, value);
  const label = gloss ? gloss.label : publicEnumLabel(FIELD, value);

  if (form === "overview") {
    return (
      <span className="prb-status-overview">
        <span className="prb-status-overview-caption">{OVERVIEW_CAPTION}</span>
        <span className="prb-status-overview-value">{label}</span>
      </span>
    );
  }

  return (
    <span className="prb-status-chip ui-inline-label" aria-label={`${readingCaption}: ${label}`}>
      <span className="prb-status-chip-caption">{readingCaption}:</span>
      <span className="prb-status-chip-value">{label}</span>
    </span>
  );
}
