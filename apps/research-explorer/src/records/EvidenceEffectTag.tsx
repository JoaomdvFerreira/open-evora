import { publicEnumLabel } from "../presentation/presentation";

/**
 * DS-04D Slice 3A — PRB→EVD relationship domain: render exactly one already-
 * authored effect (docs/design/component-model.md §4.4 "EvidenceEffectTag").
 * Extracted from the current `.effect-chip` treatments in
 * `ProblemView.tsx` (`EvidenceCard`'s per-item effect chips and
 * `EffectOccurrenceSummary`'s tally chips) and `EvdDetail.tsx`
 * (`EvdInvestigation`'s Problem-use effect chips) — both already render one
 * `publicEnumLabel("effects", value)` string per chip, which remains the
 * sole label authority here (presentation.ts), not a second mapping.
 *
 * Effect belongs to a PRB→EVD relationship, never to an EVD intrinsically
 * (component-visual-contract.md "Effects and research roles belong to
 * presentation of a PRB→EVD relationship, not to an EVD intrinsically").
 * This component receives one already-authored `effect` string and performs
 * no derivation, aggregation, inference, ranking, or relationship discovery
 * of its own — the caller (Problem evidence list, EVD Problem-use list, or
 * an occurrence tally) already resolved which effect(s) apply and in what
 * order.
 *
 * `effect` is a plain string, matching every current call site's own typing
 * (`problemProjection.ts`'s `effects?: string[]`, `evdRelations.ts`'s
 * `effects: string[]`) rather than a closed union: an unrecognised future
 * effect value must still render via `publicEnumLabel`'s existing safe
 * fallback (raw canonical value) instead of disappearing or being
 * reclassified, so the type must not reject it at compile time either.
 *
 * The visible text alone carries the meaning — an explicit "Efeito:" caption
 * plus the resolved label — so colour/shape never carries it alone
 * (component-visual-contract.md "Status always has explicit text").
 * `compact`/`standard` density are both demonstrated: `EvidenceCard`'s
 * effect chip sits inline in a dense item header with the caption
 * (`standard`), while `EffectOccurrenceSummary`'s tally chip drops the
 * caption per-chip in favour of a shared section heading and pairs the
 * value with a count (`compact`).
 */
export interface EvidenceEffectTagProps {
  /** One already-authored PRB→EVD effect value, e.g. "SUPPORTS". Never derived, ranked, or aggregated here. */
  effect: string;
  /** `standard` — includes the "Efeito:" caption inline. `compact` — value only, for a caller-provided context (e.g. a tally row already captioned by its section heading). */
  variant?: "standard" | "compact";
}

export function EvidenceEffectTag({ effect, variant = "standard" }: EvidenceEffectTagProps) {
  const label = publicEnumLabel("effects", effect);

  if (variant === "compact") {
    return (
      <span className="evd-effect-tag evd-effect-tag--compact ui-inline-label" aria-label={`Efeito: ${label}`}>
        {label}
      </span>
    );
  }

  return (
    <span className="evd-effect-tag evd-effect-tag--standard ui-inline-label">
      <span className="evd-effect-tag-caption">Efeito:</span>
      <span aria-hidden="true" className="evd-effect-tag-arrow">
        →
      </span>
      {label}
    </span>
  );
}
