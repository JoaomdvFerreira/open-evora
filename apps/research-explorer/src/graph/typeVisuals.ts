/**
 * Presentation-only visual encoding for record types in the Graph view
 * (RE-04) — colour + a short legend swatch, keyed by schema `prefix`. Lives
 * entirely in the app layer, never in `research/**` (development contract
 * #11: no graph colours/shapes added to canonical schemas). A prefix with no
 * entry here gets `GENERIC_TYPE_VISUAL`, so a future schema-conforming
 * record type still renders as a usable (grey) node rather than breaking.
 *
 * Colour is never the only type indicator in the UI that consumes this: node
 * labels always show the record's own `[prefix]id` text (see
 * typeGlossary.formatTypedId), and the legend pairs each colour with its
 * prefix/name in text.
 */

export interface TypeVisual {
  /** Node fill colour, chosen for contrast against both light and dark canvas backgrounds. */
  color: string;
}

const KNOWN_TYPE_VISUALS: Record<string, TypeVisual> = {
  "SRC-": { color: "#2563eb" },
  "EVD-": { color: "#059669" },
  "PRB-": { color: "#dc2626" },
};

export const GENERIC_TYPE_VISUAL: TypeVisual = { color: "#64748b" };

export const FOCUS_NODE_COLOR = "#111827";

export function typeVisual(prefix: string): TypeVisual {
  return KNOWN_TYPE_VISUALS[prefix] ?? GENERIC_TYPE_VISUAL;
}

/** All prefixes with a bespoke colour, for the legend's fixed rows (dynamic prefixes are appended by the caller). */
export function knownVisualPrefixes(): string[] {
  return Object.keys(KNOWN_TYPE_VISUALS);
}
