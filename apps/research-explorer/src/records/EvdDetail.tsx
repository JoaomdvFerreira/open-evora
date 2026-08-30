import { Fragment } from "react";
import type { RecordDetail, RecordSummary } from "../dataProvider/types";
import { formatPublicDate, formatPublicPartialDate, publicEnumLabel } from "../presentation/presentation";
import { RecordFieldTree } from "./RecordFieldTree";
import { CompactSectionIndex, type CompactSectionIndexEntry } from "./CompactSectionIndex";
import { EvidenceEffectTag } from "./EvidenceEffectTag";
import { ResearchRoleTag } from "./ResearchRoleTag";
import { RecordTypeLabel } from "./RecordTypeLabel";
import type { EVDProblemUsesState } from "./useEvdProblemUses";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { FactList } from "../presentation/FactList";

const EVD_SECTIONS: CompactSectionIndexEntry[] = [
  { sectionId: "scope", anchorId: "evd-scope", label: "Âmbito desta evidência" },
  { sectionId: "limits", anchorId: "evd-limits", label: "O que não permite concluir" },
  { sectionId: "investigation", anchorId: "evd-investigation", label: "Como é usada" },
  { sectionId: "sources", anchorId: "evd-sources", label: "De onde vem" },
  { sectionId: "technical", anchorId: "evd-technical", label: "Inspeção técnica" },
];

/** One EVD section-presence authority shared by the compact and rail indexes. */
export function evdSectionIndex(record: Record<string, unknown>): CompactSectionIndexEntry[] {
  const hasLimits = strings(record.inference_limits).length > 0;
  return EVD_SECTIONS.filter((section) => section.sectionId !== "limits" || hasLimits);
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown): string | null { return typeof value === "string" && value.trim() !== "" ? value : null; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : []; }
function temporalLabel(temporal: Record<string, unknown> | null): string | null {
  if (!temporal) return null;
  const asOf = text(temporal.as_of);
  if (asOf) return formatPublicPartialDate(asOf);
  const start = text(temporal.start); const end = text(temporal.end);
  if (start && end) return `${formatPublicPartialDate(start)} — ${formatPublicPartialDate(end)}`;
  return temporal.status === "unknown" ? "Desconhecido" : null;
}

function EvdIdentity({ detail }: { detail: RecordDetail }) {
  const observation = objectValue(detail.record.observation);
  const lineageId = text(detail.record.lineage_id);
  const nature = text(detail.record.evidence_nature);
  const authority = text(detail.record.claim_authority);
  return <header className="evd-identity">
    <div className="evd-type-row"><RecordTypeLabel prefix={detail.type} variant="detail" />{lineageId && <span className="evd-secondary-id">Linagem: <code>{lineageId}</code></span>}</div>
    <h1>{text(observation?.summary) ?? detail.id}</h1>
    <div className="evd-identity-facts">
      {nature && <span className="evd-identity-fact">Natureza: <b>{publicEnumLabel("evidence_nature", nature)}</b></span>}
      {authority && <span className="evd-identity-fact">Autoridade da alegação: <b>{publicEnumLabel("claim_authority", authority)}</b></span>}
    </div>
  </header>;
}

function EvdScope({ record }: { record: Record<string, unknown> }) {
  const scope = objectValue(record.scope); const geography = objectValue(scope?.geography);
  const populations = strings(scope?.populations); const domains = strings(record.domains); const temporal = temporalLabel(objectValue(scope?.temporal));
  return <section id="evd-scope" aria-label="Âmbito desta evidência" className="record-editorial-section evd-section">
    <h2 className="detail-panel-label">Âmbito desta evidência</h2>
    <dl className="problem-scope-grid evd-scope-grid">
      {(text(geography?.area) || text(geography?.level)) && <div className="problem-scope-item"><dt>Onde</dt><dd>{text(geography?.area)}{text(geography?.level) && <small>{publicEnumLabel("scope.geography.level", text(geography?.level)!)}</small>}</dd></div>}
      {populations.length > 0 && <div className="problem-scope-item"><dt>Quem</dt><dd>{populations.map((item) => <Fragment key={item}>{item}<br /></Fragment>)}</dd></div>}
      {temporal && <div className="problem-scope-item"><dt>Quando</dt><dd>{temporal}</dd></div>}
      {domains.length > 0 && <div className="problem-scope-item"><dt>Temas</dt><dd>{domains.join(" · ")}</dd></div>}
    </dl>
  </section>;
}

function EvdLimits({ record }: { record: Record<string, unknown> }) {
  const limits = strings(record.inference_limits); if (limits.length === 0) return null;
  return <section id="evd-limits" aria-label="O que esta evidência não permite concluir" className="record-editorial-section evd-section">
    <h2 className="detail-panel-label">O que esta evidência não permite concluir</h2>
    <ul className="evd-limits">{limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>
  </section>;
}

function EvdInvestigation({ state, onSelect }: { state: EVDProblemUsesState & { retry: () => void }; onSelect: (id: string) => void }) {
  return <section id="evd-investigation" aria-label="Como é usada na investigação" className="record-editorial-section evd-section">
    <h2 className="detail-panel-label">Como é usada na investigação</h2>
    {state.status === "loading" || state.status === "idle" ? <ProgressMessage message="A carregar usos nos Problemas…" /> : state.status === "error" ? <ErrorNotice title="Não foi possível carregar os usos desta evidência nos Problemas." message="" action={<button type="button" onClick={state.retry}>Tentar novamente</button>} /> : state.uses.length === 0 ? <p className="field-empty">Esta evidência ainda não está ligada explicitamente a um Problema.</p> : <ul className="evd-problem-list">{state.uses.map((use) => {
      const title = text(use.detail.record.title);
      return <li key={`${use.detail.id}-${use.relationshipPath}`} className="evd-problem-card">
        <div className="evd-problem-heading"><code>{use.detail.id}</code>{title && <span>{title}</span>}</div>
        <FactList
          rows={[
            {
              key: "effects",
              label: "Efeito",
              value: <span className="evd-relation-values">{use.effects.map((effect, index) => <EvidenceEffectTag key={`${effect}-${index}`} effect={effect} variant="compact" />)}</span>,
            },
            {
              key: "roles",
              label: "Papel",
              value: <span className="evd-relation-values">{use.researchRoles.map((role, index) => <ResearchRoleTag key={`${role}-${index}`} role={role} variant="compact" />)}</span>,
            },
          ]}
        />
        <button type="button" className="evd-problem-action" onClick={() => onSelect(use.detail.id)}>Ver Problema →</button>
      </li>;
    })}</ul>}
  </section>;
}

function EvdSources({ record, lookup, onSelect }: { record: Record<string, unknown>; lookup: Map<string, RecordSummary>; onSelect: (id: string) => void }) {
  const provenance = objectValue(record.provenance); const sourceIds = strings(provenance?.sources); const extractedAt = text(provenance?.extracted_at);
  return <section id="evd-sources" aria-label="De onde vem esta evidência" className="record-editorial-section evd-section">
    <h2 className="detail-panel-label">De onde vem esta evidência</h2>
    {extractedAt && <p className="evd-extracted-at">Extraída pela Open Évora em <time dateTime={extractedAt}>{formatPublicDate(extractedAt)}</time></p>}
    <ul className="evd-source-list">{sourceIds.map((id) => <li key={id}><code>{id}</code><button type="button" onClick={() => onSelect(id)}>{lookup.get(id)?.label ?? "Abrir fonte"}</button></li>)}</ul>
  </section>;
}

function EvdTechnical({ detail }: { detail: RecordDetail }) {
  const paths = [
    ...detail.outgoingEdges.map((edge) => edge.to ? `${edge.field}${edge.ordinal === null ? "" : `[${edge.ordinal}]`} → ${edge.to}` : edge.field),
    ...detail.incomingEdges.map((edge) => edge.from ? `${edge.from} → ${edge.field}${edge.ordinal === null ? "" : `[${edge.ordinal}]`}` : edge.field),
  ];
  const lineageId = text(detail.record.lineage_id);
  return <section id="evd-technical" aria-label="Inspeção técnica" className="record-editorial-section evd-section">
    <h2 className="detail-panel-label">Inspeção técnica</h2>
    <details className="technical-disclosure"><summary>Inspeção técnica completa</summary>
      <p className="technical-disclosure-caption">Campos canónicos, ficheiro e caminhos de relação para auditoria.</p>
      <FactList
        rows={[
          { key: "file", label: "Ficheiro canónico", value: <code>{detail.file}</code> },
          { key: "evidence_id", label: "evidence_id", value: <code>{detail.id}</code> },
          ...(lineageId ? [{ key: "lineage_id", label: "lineage_id", value: <code>{lineageId}</code> }] : []),
          ...(paths.length > 0
            ? [{ key: "relationship-paths", label: "Caminhos de relação", value: <ul className="relationship-paths">{paths.map((path) => <li key={path}><code>{path}</code></li>)}</ul> }]
            : []),
        ]}
      />
      <RecordFieldTree data={detail.record} />
    </details>
  </section>;
}

export function EvdDetail({ detail, lookup, problemUses, onSelect }: { detail: RecordDetail; lookup: Map<string, RecordSummary>; problemUses: EVDProblemUsesState & { retry: () => void }; onSelect: (id: string) => void }) {
  const sections = evdSectionIndex(detail.record);
  return <><EvdIdentity detail={detail} /><CompactSectionIndex label="Nesta evidência" sections={sections} className="evd-compact-section-index" /><EvdScope record={detail.record} /><EvdLimits record={detail.record} /><EvdInvestigation state={problemUses} onSelect={onSelect} /><EvdSources record={detail.record} lookup={lookup} onSelect={onSelect} /><EvdTechnical detail={detail} /></>;
}

export function EvdReadingRail({ detail }: { detail: RecordDetail }) {
  const sections = evdSectionIndex(detail.record);
  return <><nav aria-label="Nesta evidência" className="problem-rail-nav problem-reading-rail"><h2 className="detail-panel-label">Nesta evidência</h2><ul>{sections.map((section) => <li key={section.sectionId}><a href={`#${section.anchorId}`}>{section.label}</a></li>)}</ul></nav><span className="detail-rail-file">{detail.file}</span></>;
}
