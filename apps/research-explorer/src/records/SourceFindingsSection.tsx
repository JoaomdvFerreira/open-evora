import type { RecordDetail } from "../dataProvider/types";
import type { SourceEvidenceRelations } from "./sourceEvidenceRelations";
import { SOURCE_SECTION_ANCHOR_IDS } from "./sourceSectionIndex";
import { RecordIdentifier } from "./RecordIdentifier";

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

function EvidenceFindingItem({ evidence, onSelect }: { evidence: RecordDetail; onSelect?: (id: string) => void }) {
  const observation = objectValue(evidence.record.observation);
  const scope = objectValue(evidence.record.scope);
  const geography = objectValue(scope?.geography);
  const provenance = objectValue(evidence.record.provenance);
  const populations = textList(scope?.populations);
  const sources = textList(provenance?.sources);
  return (
    <li className="source-finding-item">
      {onSelect ? (
        <RecordIdentifier variant="action" id={evidence.id} density="compact" onActivate={() => onSelect(evidence.id)} accessibleLabel={`Abrir ${evidence.id}`} />
      ) : (
        <RecordIdentifier variant="text" id={evidence.id} density="compact" />
      )}
      {text(observation?.summary) && <p className="source-finding-summary">{text(observation?.summary)}</p>}
      {(text(geography?.area) || populations.length > 0 || sources.length > 0) && (
        <dl className="detail-provenance-grid">
          {text(geography?.area) && <><dt>Âmbito</dt><dd>{text(geography?.area)}</dd></>}
          {populations.length > 0 && <><dt>Populações</dt><dd>{populations.join(", ")}</dd></>}
          {sources.length > 0 && <><dt>Fontes de proveniência</dt><dd>{sources.join(", ")}</dd></>}
        </dl>
      )}
    </li>
  );
}

export function SourceFindingsSection({ relations, onSelect }: { relations: SourceEvidenceRelations; onSelect?: (id: string) => void }) {
  return (
    <section id={SOURCE_SECTION_ANCHOR_IDS.findings} aria-label="O que encontrámos" className="record-editorial-section source-findings-section">
      <h3 className="detail-panel-label">O que encontrámos</h3>
      {relations.evidence.length === 0 ? <p className="field-empty">Ainda não existem observações da investigação ligadas explicitamente a esta fonte.</p> : (
        <>
          <dl className="detail-provenance-grid"><dt>Observações relacionadas</dt><dd>{relations.uniqueEvidenceCount}</dd></dl>
          <div className="source-finding-group"><h4 className="record-editorial-subheading">Observações com esta fonte de proveniência</h4><ul className="source-finding-list">{relations.evidence.map((item) => <EvidenceFindingItem key={item.id} evidence={item} onSelect={onSelect} />)}</ul></div>
        </>
      )}
    </section>
  );
}
