import { ExplorerLink } from "../navigation/ExplorerLink";

/**
 * DS-04D Slice 3A — records/presentation domain: canonical record ID
 * presentation only (docs/design/component-model.md §4.4 "RecordIdentifier").
 * Extracted from the current static `<code>{detail.id}</code>`/
 * `<span className="detail-technical-field">` identifier treatments
 * (`ProvenancePanel`, `PrbMetadataPanel` in RecordDetailPanel.tsx) and the
 * current actionable identifier treatments (`RelatedRecordButton`,
 * `TypedLinkButton`'s own `formatTypedId(...)` call, `PrbCanonicalReferences`'s
 * `.prb-reference-target` button — RecordDetailPanel.tsx/ProblemView.tsx).
 *
 * Renders the bare canonical ID in technical typography — nothing else.
 * It never concatenates a type gloss (`formatTypedId`'s `[Evidência]`
 * prefix stays with `RecordTypeLabel`/its call sites), never accepts a
 * status/effect/research-role value. Action links use the PRB prefix for
 * Problem context and generic Record Detail for other IDs; the
 * actionable identifier's `onActivate` is caller-supplied, exactly as
 * `RelatedRecordButton`'s `onSelect`/`TypedLinkButton`'s `onOpenGeneric`
 * are today. Text and action forms are kept explicit — `variant` chooses
 * between a non-interactive `<span>` (text) and a native link
 * (action), never a polymorphic element (component-model.md §4.3 "no
 * polymorphic Action component" applies equally here).
 *
 * `density` is orthogonal to `variant` (docs/design/reference/components/
 * ds-03b-component-catalogue.dc.html §4 "text and action forms, standard
 * and compact density"): `standard` renders the bounded identifier
 * treatment (hairline outline, subtle fill) the approved catalogue
 * demonstrates; `compact` drops that surrounding treatment and stays bare
 * technical identity for dense rows/prose. Both densities apply to both
 * interaction forms.
 */
export interface RecordIdentifierTextProps {
  variant?: "text";
  /** The canonical ID exactly as stored, e.g. "EVD-000105". */
  id: string;
  /** `standard` — bounded identifier treatment. `compact` — bare technical identity for dense rows/prose. Defaults to `standard`. */
  density?: "standard" | "compact";
}

export interface RecordIdentifierActionProps {
  variant: "action";
  /** The canonical ID exactly as stored, e.g. "EVD-000105". */
  id: string;
  /** `standard` — bounded identifier treatment. `compact` — bare technical identity for dense rows/prose. Defaults to `standard`. */
  density?: "standard" | "compact";
  /** Caller-owned SPA navigation for an ordinary click. */
  onActivate: () => void;
  /** Problem context uses its own public view; all other records use generic Detail. */
  view?: "records" | "problem";
  /** Optional caller-owned accessible name override (e.g. "Abrir EVD-000105 referenciado em ..."); defaults to the visible id text. */
  accessibleLabel?: string;
}

export type RecordIdentifierProps = RecordIdentifierTextProps | RecordIdentifierActionProps;

export function RecordIdentifier(props: RecordIdentifierProps) {
  const density = props.density ?? "standard";
  const densityClass = density === "compact" ? "rec-identifier--compact" : "rec-identifier--standard";

  if (props.variant === "action") {
    return (
      <ExplorerLink
        to={{ view: props.view ?? (props.id.startsWith("PRB-") ? "problem" : "records"), selectedId: props.id }}
        onNavigate={props.onActivate}
        className={`rec-identifier rec-identifier--action ${densityClass}`}
        aria-label={props.accessibleLabel}
      >
        {props.id}
      </ExplorerLink>
    );
  }
  return <span className={`rec-identifier ${densityClass}`}>{props.id}</span>;
}
