import type { SourceEvidenceRelations, SourceRelatedProblem } from "./sourceEvidenceRelations";
import { SOURCE_SECTION_ANCHOR_IDS } from "./sourceSectionIndex";
import { RecordIdentifier } from "./RecordIdentifier";

/**
 * SUI-03H1/H2: isolated presentation component for the Source View "Na
 * investigação" section. Consumes the already-resolved
 * `SourceEvidenceRelations` (SUI-03A2) — no data fetching, no re-traversal
 * of SRC/EVD/PRB records, no recomputation of `uniqueEvidenceCount` or the
 * `relatedProblems` dedup path. Renders only the SRC → EVD →
 * canonical `evidence[]` → PRB path already resolved by that module.
 * EVD ids under "Através de" stay text-only to avoid duplicating the EVD
 * navigation already available in "O que encontrámos"
 * (`SourceFindingsSection.tsx`). PRB navigation reuses the same
 * `RecordIdentifier` action/text neutral record-ID treatment (DS-05E)
 * `SourceFindingsSection` already uses for EVD ids — action when `onSelect`
 * is supplied, text otherwise (mirrors that section's own
 * `onSelect`-optional contract).
 *
 * SUI-03K3: "Observações relacionadas" (the `uniqueEvidenceCount` metric)
 * moved to `SourceFindingsSection` ("O que encontrámos") — that count
 * describes related evidence, not PRB-level investigation context, so it no
 * longer renders here. This section is now PRB-only: presence still keys off
 * `relatedProblems.length === 0`, unaffected by the count's removal.
 */

function RelatedProblemItem({ problem, onSelect }: { problem: SourceRelatedProblem; onSelect?: (id: string) => void }) {
  return (
    <li className="source-finding-item">
      {onSelect ? (
        <RecordIdentifier variant="action" id={problem.problemId} density="compact" onActivate={() => onSelect(problem.problemId)} accessibleLabel={`Abrir ${problem.problemId}`} />
      ) : (
        <RecordIdentifier variant="text" id={problem.problemId} density="compact" />
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
