import { extractSourceCaveats } from "./sourceView";
import { SOURCE_SECTION_ANCHOR_IDS } from "./sourceSectionIndex";

/**
 * SUI-03G1: SRC-owned caveats only (`extractSourceCaveats`). Absence of
 * authored caveats is not evidence that limitations do not exist, so this
 * section renders nothing — no heading, no empty-state placeholder — when
 * `caveats` is absent or empty. Canonical strings render verbatim, in
 * canonical order: no rewriting, summarizing, ranking, or severity
 * classification, and no merging with EVD notes/representativeness/
 * verification/temporal_relevance, PRB uncertainty, research_role, or
 * investigation-gap content.
 */
export function SourceCaveatsSection({ record }: { record: Record<string, unknown> }) {
  const caveats = extractSourceCaveats(record);
  if (!caveats) return null;

  return (
    <section id={SOURCE_SECTION_ANCHOR_IDS.caveats} aria-label="Limitações" className="record-editorial-section source-caveats-section">
      <h3 className="detail-panel-label">Limitações</h3>
      <ul>
        {caveats.map((caveat) => (
          <li key={caveat}>{caveat}</li>
        ))}
      </ul>
    </section>
  );
}
