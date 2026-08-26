import type { SourceEvidenceRelations, SourceRelatedProblem } from "./sourceEvidenceRelations";

/**
 * SUI-03H1: isolated presentation component for the Source View "Na
 * investigação" section. Consumes the already-resolved
 * `SourceEvidenceRelations` (SUI-03A2) — no data fetching, no re-traversal
 * of SRC/EVD/PRB records, no recomputation of `uniqueEvidenceCount` or the
 * `relatedProblems` dedup path. Renders only the SRC → EVD →
 * `analysis.related_problems` → PRB path already resolved by that module;
 * PRB navigation is deferred to SUI-03H2 (problemId renders as plain text
 * here), and EVD ids under "Através de" stay text-only to avoid duplicating
 * the EVD navigation already available in "O que encontrámos"
 * (`SourceFindingsSection.tsx`).
 */

function RelatedProblemItem({ problem }: { problem: SourceRelatedProblem }) {
  return (
    <li className="source-finding-item">
      <span className="source-finding-id detail-technical-field">{problem.problemId}</span>
      <p className="source-finding-summary">Através de: {problem.viaEvidenceIds.join(", ")}</p>
    </li>
  );
}

export function SourceInvestigationSection({ relations }: { relations: SourceEvidenceRelations }) {
  if (relations.relatedProblems.length === 0) return null;

  return (
    <section aria-label="Na investigação" className="source-findings-section">
      <h3 className="detail-panel-label">Na investigação</h3>
      <dl className="detail-provenance-grid">
        <dt>Observações relacionadas</dt>
        <dd>{relations.uniqueEvidenceCount}</dd>
      </dl>
      <div className="source-finding-group">
        <h4>Problemas relacionados</h4>
        <ul className="source-finding-list">
          {relations.relatedProblems.map((problem) => (
            <RelatedProblemItem key={problem.problemId} problem={problem} />
          ))}
        </ul>
      </div>
    </section>
  );
}
