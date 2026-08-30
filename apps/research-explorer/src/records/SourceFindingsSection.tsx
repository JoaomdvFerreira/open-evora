import type { RecordDetail } from "../dataProvider/types";
import type { SourceEvidenceRelations } from "./sourceEvidenceRelations";
import { SOURCE_SECTION_ANCHOR_IDS } from "./sourceSectionIndex";
import { RecordIdentifier } from "./RecordIdentifier";
import { FactList, type FactListRow } from "../presentation/FactList";
import { EmptyState } from "../presentation/EmptyState";

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
  const rows: FactListRow[] = [];
  if (text(geography?.area)) rows.push({ key: "geography", label: "Âmbito", value: text(geography?.area) });
  if (populations.length > 0) rows.push({ key: "populations", label: "Populações", value: populations.join(", ") });
  if (sources.length > 0) rows.push({ key: "sources", label: "Fontes de proveniência", value: sources.join(", ") });
  return (
    <li className="source-finding-item">
      {onSelect ? (
        <RecordIdentifier variant="action" id={evidence.id} density="compact" onActivate={() => onSelect(evidence.id)} accessibleLabel={`Abrir ${evidence.id}`} />
      ) : (
        <RecordIdentifier variant="text" id={evidence.id} density="compact" />
      )}
      {text(observation?.summary) && <p className="source-finding-summary">{text(observation?.summary)}</p>}
      {rows.length > 0 && <FactList rows={rows} />}
    </li>
  );
}

export function SourceFindingsSection({ relations, onSelect }: { relations: SourceEvidenceRelations; onSelect?: (id: string) => void }) {
  return (
    <section id={SOURCE_SECTION_ANCHOR_IDS.findings} aria-label="O que encontrámos" className="record-editorial-section source-findings-section">
      <h3 className="detail-panel-label">O que encontrámos</h3>
      {relations.evidence.length === 0 ? <EmptyState message="Ainda não existem observações da investigação ligadas explicitamente a esta fonte." /> : (
        <>
          <FactList rows={[{ key: "unique-evidence-count", label: "Observações relacionadas", value: relations.uniqueEvidenceCount }]} />
          <div className="source-finding-group"><h4 className="record-editorial-subheading">Observações com esta fonte de proveniência</h4><ul className="source-finding-list">{relations.evidence.map((item) => <EvidenceFindingItem key={item.id} evidence={item} onSelect={onSelect} />)}</ul></div>
        </>
      )}
    </section>
  );
}
