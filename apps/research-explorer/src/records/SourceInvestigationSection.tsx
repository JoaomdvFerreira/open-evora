import type { SourceEvidenceRelations, SourceRelatedProblem } from "./sourceEvidenceRelations";
import { SOURCE_SECTION_ANCHOR_IDS } from "./sourceSectionIndex";

/**
 * SUI-03H1/H2: isolated presentation component for the Source View "Na
 * investigação" section. Consumes the already-resolved
 * `SourceEvidenceRelations` (SUI-03A2) — no data fetching, no re-traversal
 * of SRC/EVD/PRB records, no recomputation of `uniqueEvidenceCount` or the
 * `relatedProblems` dedup path. Renders only the SRC → EVD →
 * `analysis.related_problems` → PRB path already resolved by that module.
 * EVD ids under "Através de" stay text-only to avoid duplicating the EVD
 * navigation already available in "O que encontrámos"
 * (`SourceFindingsSection.tsx`). PRB navigation reuses the same
 * `source-finding-id` neutral record-ID button treatment `SourceFindingsSection`
 * already uses for EVD ids — a button when `onSelect` is supplied, plain
 * text otherwise (mirrors that section's own `onSelect`-optional contract).
 */

function RelatedProblemItem({ problem, onSelect }: { problem: SourceRelatedProblem; onSelect?: (id: string) => void }) {
  return (
    <li className="source-finding-item">
      {onSelect ? (
        <button type="button" className="source-finding-id detail-technical-field" onClick={() => onSelect(problem.problemId)}>
          {problem.problemId}
        </button>
      ) : (
        <span className="source-finding-id detail-technical-field">{problem.problemId}</span>
      )}
      <p className="source-finding-summary">Através de: {problem.viaEvidenceIds.join(", ")}</p>
    </li>
  );
}

export function SourceInvestigationSection({ relations, onSelect }: { relations: SourceEvidenceRelations; onSelect?: (id: string) => void }) {
  if (relations.relatedProblems.length === 0) return null;

  return (
    <section id={SOURCE_SECTION_ANCHOR_IDS.investigation} aria-label="Na investigação" className="record-editorial-section source-findings-section">
      <h3 className="detail-panel-label">Na investigação</h3>
      <dl className="detail-provenance-grid">
        <dt>Observações relacionadas</dt>
        <dd>{relations.uniqueEvidenceCount}</dd>
      </dl>
      <div className="source-finding-group">
        <h4 className="record-editorial-subheading">Problemas relacionados</h4>
        <ul className="source-finding-list">
          {relations.relatedProblems.map((problem) => (
            <RelatedProblemItem key={problem.problemId} problem={problem} onSelect={onSelect} />
          ))}
        </ul>
      </div>
    </section>
  );
}
