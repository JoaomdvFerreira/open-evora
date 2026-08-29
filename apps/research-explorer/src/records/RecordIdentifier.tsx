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
 * status/effect/research-role value, and never derives a route: an
 * actionable identifier's `onActivate` is caller-supplied, exactly as
 * `RelatedRecordButton`'s `onSelect`/`TypedLinkButton`'s `onOpenGeneric`
 * are today. Static and actionable forms are kept explicit — `variant`
 * chooses between a non-interactive `<span>` (static) and a native
 * `<button>` (actionable), never a polymorphic element (component-model.md
 * §4.3 "no polymorphic Action component" applies equally here).
 *
 * No compact/standard density split: current evidence shows exactly one
 * rendered size for every identifier occurrence above, so DS-04D does not
 * invent a second one.
 */
export interface RecordIdentifierStaticProps {
  variant?: "static";
  /** The canonical ID exactly as stored, e.g. "EVD-000105". */
  id: string;
}

export interface RecordIdentifierActionProps {
  variant: "action";
  /** The canonical ID exactly as stored, e.g. "EVD-000105". */
  id: string;
  /** Caller-owned navigation/action intent — this component derives no route. */
  onActivate: () => void;
  /** Optional caller-owned accessible name override (e.g. "Abrir EVD-000105 referenciado em ..."); defaults to the visible id text. */
  accessibleLabel?: string;
}

export type RecordIdentifierProps = RecordIdentifierStaticProps | RecordIdentifierActionProps;

export function RecordIdentifier(props: RecordIdentifierProps) {
  if (props.variant === "action") {
    return (
      <button type="button" className="rec-identifier rec-identifier--action" onClick={props.onActivate} aria-label={props.accessibleLabel}>
        {props.id}
      </button>
    );
  }
  return <span className="rec-identifier">{props.id}</span>;
}
