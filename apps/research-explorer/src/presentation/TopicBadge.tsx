import { describeTopic } from "./topicMapping";

/**
 * WU053 — presentation-only rendering of a PRB `domain` code: PT-PT label,
 * tone, and icon from `topicMapping.ts`. Colour (tone) is never the sole
 * carrier of meaning — the explicit PT-PT label is always rendered as text
 * alongside the icon (foundations.md "Colour and contrast intent";
 * component-visual-contract.md "Status always has explicit text").
 *
 * `compact` renders label + icon only (list/filter contexts); `technical`
 * additionally exposes the raw stored code, matching the existing Problem
 * state pattern of never substituting the public gloss for the canonical
 * value (ProblemLifecycleStatus.tsx, InvestigationStatus.tsx).
 */
export interface TopicBadgeProps {
  /** The stored canonical `domain` code, e.g. "MOB". Never translated or reclassified by this component. */
  code: string;
  /** `compact` — icon + PT-PT label only. `technical` — additionally shows the raw canonical code. */
  form?: "compact" | "technical";
}

export function TopicBadge({ code, form = "compact" }: TopicBadgeProps) {
  const { label, tone, icon: Icon } = describeTopic(code);

  return (
    <span className={`topic-badge topic-badge--${tone} ui-inline-label`} aria-label={form === "technical" ? `Tema: ${label} (${code})` : `Tema: ${label}`}>
      <Icon className="topic-badge-icon" />
      <span className="topic-badge-label">{label}</span>
      {form === "technical" && <code className="topic-badge-code">{code}</code>}
    </span>
  );
}
