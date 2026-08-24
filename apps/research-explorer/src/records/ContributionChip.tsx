/**
 * Presentation-only chip for one `analysis.contribution` value (Evidência's
 * canonical closed vocabulary, `research/schemas/evidence.schema.json`).
 * Structurally identical for every value — including CONTRADICTS — by
 * design: no per-value border weight, colour, or background. The glyph is
 * a purely decorative, non-semantic accompaniment — the canonical text
 * label is what actually carries the distinction. Rendering never
 * depends on recognising the value: an unrecognised future value still
 * renders its own text, with no glyph and no crash.
 */
import { useId } from "react";
import { publicEnumLabel } from "../presentation";

const CONTRIBUTION_GLYPHS: Record<string, string> = {
  CONFIRMS: "✓",
  REFINES: "≈",
  CONTRADICTS: "✕",
  "CURRENT-STATE-UPDATE": "↻",
  "EXISTING-SOLUTION": "◆",
  "PLANNED-SOLUTION": "◇",
  "NEW-CANDIDATE": "✧",
};

/**
 * PI-02F3: short plain-language explanation of what each contribution label
 * means, surfaced as an accessible tooltip on the chip. Deliberately absent
 * for any value with no approved explanation (e.g. a future/unrecognised
 * value, or NEW-CANDIDATE, which the remediation spec does not cover) —
 * the chip still renders correctly with no tooltip in that case. No ranking
 * or severity distinction between values.
 */
const CONTRIBUTION_EXPLANATIONS: Record<string, string> = {
  CONFIRMS: "Reforça uma leitura já sustentada.",
  REFINES: "Acrescenta detalhe ou restringe a leitura atual.",
  "CURRENT-STATE-UPDATE": "Traz informação mais recente sobre a situação.",
  "EXISTING-SOLUTION": "Documenta uma resposta ou intervenção já existente.",
  "PLANNED-SOLUTION": "Documenta uma resposta prevista, não necessariamente executada.",
  CONTRADICTS: "Apresenta evidência em tensão com a leitura atual.",
};

/** Canonical enum order (evidence.schema.json's `analysis.contribution`) — used only to order presentation, never to restrict which values may render. */
export const CANONICAL_CONTRIBUTION_ORDER = Object.keys(CONTRIBUTION_GLYPHS);

export function ContributionChip({ value }: { value: string }) {
  const glyph = CONTRIBUTION_GLYPHS[value];
  const explanation = CONTRIBUTION_EXPLANATIONS[value];
  const explanationId = useId();
  const label = publicEnumLabel("contribution", value);

  return (
    <span className="contribution-chip-wrap">
      <span className="contribution-chip" tabIndex={explanation ? 0 : undefined} aria-describedby={explanation ? explanationId : undefined}>
        {glyph !== undefined && (
          <span aria-hidden="true" className="contribution-chip-glyph">
            {glyph}{" "}
          </span>
        )}
        {label}
      </span>
      {explanation && (
        <span role="note" id={explanationId} className="contribution-chip-note">
          {explanation}
        </span>
      )}
    </span>
  );
}
