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

/** Canonical enum order (evidence.schema.json's `analysis.contribution`) — used only to order presentation, never to restrict which values may render. */
export const CANONICAL_CONTRIBUTION_ORDER = Object.keys(CONTRIBUTION_GLYPHS);

export function ContributionChip({ value }: { value: string }) {
  const glyph = CONTRIBUTION_GLYPHS[value];
  return (
    <span className="contribution-chip">
      {glyph !== undefined && (
        <span aria-hidden="true" className="contribution-chip-glyph">
          {glyph}{" "}
        </span>
      )}
      {publicEnumLabel("contribution", value)}
    </span>
  );
}
