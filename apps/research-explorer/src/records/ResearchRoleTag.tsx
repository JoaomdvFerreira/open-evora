import { publicEnumLabel } from "../presentation/presentation";

/**
 * DS-04D Slice 3C — PRB→EVD relationship domain: render exactly one already-
 * authored research role (docs/design/component-model.md §4.4 "Keep
 * `research_roles` in an explicitly named domain wrapper"). Sibling to
 * `EvidenceEffectTag.tsx`, same relationship domain, deliberately its own
 * component rather than a variant of it — effect and research role are
 * independent PRB→EVD dimensions (component-visual-contract.md "Effects and
 * research roles belong to presentation of a PRB→EVD relationship, not to an
 * EVD intrinsically"; component-model.md §5.4 "Keep `research_roles` in an
 * explicitly named domain wrapper").
 *
 * Extracted from current `.record-role-chip` treatments of `research_roles`
 * in `EvdDetail.tsx` (`EvdInvestigation`'s per-item Papel column,
 * `publicEnumLabel("research_roles", role)` per chip) and the approved
 * catalogue's captioned "Papel:" chip
 * (docs/design/reference/components/ds-03b-component-catalogue.dc.html
 * §"Research role (PRB→EVD)" / §"Evidence use inside Problem" / §"Research
 * role — also a property of the PRB→EVD relationship, never of a record").
 * `publicEnumLabel("research_roles", role)` remains the sole label
 * authority (presentation.ts); this component adds no second mapping table.
 *
 * This component receives one already-authored `role` string and performs no
 * derivation, aggregation, ranking, or relationship discovery of its own —
 * the caller (an EVD's Problem-use list today; a future Problem evidence
 * list) already resolved which role(s) apply, in what authored order, and
 * whether the surrounding PRB→EVD relationship itself is being rendered.
 *
 * `role` is a plain string, matching every current call site's own typing
 * (`evdRelations.ts`'s `researchRoles: string[]`, `problemProjection.ts`'s
 * `researchRoles?: string[]`) rather than a closed union: an unrecognised
 * future role value must still render via `publicEnumLabel`'s existing safe
 * fallback (raw canonical value) instead of disappearing or being
 * reclassified, so the type must not reject it at compile time either.
 *
 * The visible text alone carries the meaning — an explicit "Papel:" caption
 * — so colour/shape never carries it alone (component-visual-contract.md
 * "Status always has explicit text"). `standard`/`compact` density mirrors
 * `EvidenceEffectTag`'s precedent: `EvdDetail`'s standalone catalogue chip
 * keeps the caption inline (`standard`); `EvdDetail`'s `EvdInvestigation`
 * Papel column already supplies the visible "Papel" context via its own
 * `<dt>`, so repeating the caption per-chip there would duplicate it
 * (`compact`, caption dropped, accessible name preserved via aria-label).
 */
export interface ResearchRoleTagProps {
  /** One already-authored PRB→EVD research role value, e.g. "LOCAL_OBSERVATION". Never derived, ranked, or aggregated here. */
  role: string;
  /** `standard` — includes the "Papel:" caption inline. `compact` — value only, for a caller-provided context (e.g. an already-captioned `<dt>Papel</dt>` fact row). */
  variant?: "standard" | "compact";
}

export function ResearchRoleTag({ role, variant = "standard" }: ResearchRoleTagProps) {
  const label = publicEnumLabel("research_roles", role);

  if (variant === "compact") {
    return (
      <span className="research-role-tag research-role-tag--compact ui-inline-label" aria-label={`Papel: ${label}`}>
        {label}
      </span>
    );
  }

  return (
    <span className="research-role-tag research-role-tag--standard ui-inline-label">
      <span className="research-role-tag-caption">Papel:</span>
      <span className="research-role-tag-value">{label}</span>
    </span>
  );
}
