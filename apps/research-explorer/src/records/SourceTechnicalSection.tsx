import { RecordFieldTree } from "./RecordFieldTree";
import { SOURCE_SECTION_ANCHOR_IDS } from "./sourceSectionIndex";

/**
 * SUI-03I1: SRC Source View's collapsed canonical-inspection surface —
 * the raw canonical SRC record only, via the same `RecordFieldTree` the
 * generic `TechnicalDisclosure` (RecordDetailPanel.tsx) already uses. No
 * second recursive/raw renderer, no repository/YAML path, no relation
 * count/RelationshipList/edge paths, no duplicated identity/acquisition
 * summary. Closed by default; the section itself always renders for a
 * valid canonical SRC record (RecordFieldTree never produces an
 * empty-state — see SUI-03I0).
 */
export function SourceTechnicalSection({ record }: { record: Record<string, unknown> }) {
  return (
    <section id={SOURCE_SECTION_ANCHOR_IDS.technical} aria-label="Informação técnica" className="source-technical-section">
      <h3 className="detail-panel-label">Informação técnica</h3>
      <details className="technical-disclosure">
        <summary>Inspeção completa do registo canónico</summary>
        <p className="technical-disclosure-caption">Campos do corpus canónico apresentados tal como registados, para auditabilidade e rastreabilidade — não uma reformulação pública.</p>
        <RecordFieldTree data={record} />
      </details>
    </section>
  );
}
