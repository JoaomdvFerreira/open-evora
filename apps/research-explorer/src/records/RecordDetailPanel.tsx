import { Fragment, useEffect, useRef } from "react";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import { useRecordDetail } from "./useRecordDetail";
import { RecordFieldTree } from "./RecordFieldTree";
import { describeType, formatTypedId } from "../typeGlossary";
import { findMeaningField } from "./meaningField";
import { ContributionChip } from "./ContributionChip";
import { publicEnumLabel, publicFieldCaption, formatPublicCount } from "../presentation";
import { ContextTabs } from "../ContextTabs";
import { evidenceQuickRead, sourceQuickRead, sourceName, type QuickReadItem } from "./recordOrientation";

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Registo mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar o registo",
  not_found: "Registo desconhecido",
  invalid_id: "Identificador de registo inválido",
};

interface RelationshipListProps {
  detail: RecordDetail;
  lookup: Map<string, RecordSummary>;
  onSelect: (id: string) => void;
}

/**
 * One canonical reference-path occurrence, direction-tagged, kept exact
 * (field + ordinal) — this is the unit the acceptance case calls a "path",
 * never itself presented as a "record".
 */
interface DirectedPath {
  direction: "incoming" | "outgoing";
  field: string;
  ordinal: number | null;
}

/**
 * `incomingEdges`/`outgoingEdges` are exact canonical reference paths, not
 * unique related-record cardinality (finding under correction here) — a
 * record referenced from both directions, or via more than one field/ordinal
 * in the same direction, must still surface as exactly one related-record
 * group with every one of its paths preserved beneath it. Grouping is by
 * related record ID only; nothing here discards a distinct path.
 */
function groupPathsByRelatedRecord(detail: RecordDetail): Map<string, DirectedPath[]> {
  const groups = new Map<string, DirectedPath[]>();
  for (const edge of detail.outgoingEdges) {
    const relatedId = edge.to!;
    const paths = groups.get(relatedId) ?? [];
    paths.push({ direction: "outgoing", field: edge.field, ordinal: edge.ordinal });
    groups.set(relatedId, paths);
  }
  for (const edge of detail.incomingEdges) {
    const relatedId = edge.from!;
    const paths = groups.get(relatedId) ?? [];
    paths.push({ direction: "incoming", field: edge.field, ordinal: edge.ordinal });
    groups.set(relatedId, paths);
  }
  return groups;
}

/** Count of unique related record IDs across both directions — the cardinality this correction surfaces as "registos relacionados", distinct from the raw edge/path count. */
function countUniqueRelatedRecords(detail: RecordDetail): number {
  return groupPathsByRelatedRecord(detail).size;
}

function RelationshipList({ detail, lookup, onSelect }: RelationshipListProps) {
  const groups = groupPathsByRelatedRecord(detail);
  const relatedIds = [...groups.keys()];

  return (
    <section aria-label="Registos relacionados">
      <h4>Registos relacionados</h4>
      {relatedIds.length === 0 ? (
        <p>Nenhum registo relacionado.</p>
      ) : (
        <ul>
          {relatedIds.map((relatedId) => {
            const related = lookup.get(relatedId);
            const paths = groups.get(relatedId)!;
            return (
              <li key={relatedId}>
                <button type="button" onClick={() => onSelect(relatedId)}>
                  {related ? `${formatTypedId(related.type, related.id)} — ${related.label}` : relatedId}
                </button>
                <ul className="relationship-paths">
                  {paths.map((path, index) => {
                    const arrow = path.direction === "outgoing" ? "→" : "←";
                    const label = path.direction === "outgoing" ? "Saída" : "Entrada";
                    const relation = path.direction === "outgoing" ? "referencia através de" : "referenciado através de";
                    const ordinalSuffix = path.ordinal !== null ? `[${path.ordinal}]` : "";
                    return (
                      <li key={`${path.direction}-${path.field}-${path.ordinal}-${index}`}>
                        {arrow} {label} — {relation} <code>{path.field}</code>
                        {ordinalSuffix}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * The only edge field name any current schema declares specifically to
 * relate a record to the Problem it is about
 * (research/schemas/evidence.schema.json's own `references` entry —
 * declares `targetPrefix: "PRB-"` for exactly this field). Deliberately an
 * explicit allowlist, not a suffix/regex heuristic: an edge whose field is
 * *not* this one never counts, even if it happens to resolve to a PRB-
 * record for some unrelated reason.
 */
const PROBLEM_REFERENCE_FIELDS = ["analysis.related_problems"];

/**
 * Finds a related Problem to offer a "Ver como Problema" action for — but
 * only via one of `PROBLEM_REFERENCE_FIELDS`, never merely because *some*
 * incoming/outgoing edge happens to resolve to a PRB- record. Generic
 * graph connectivity is not semantic equivalence: a reference is "record A
 * points to record B via field F," nothing more (development-contract
 * invariant 8), so this must not imply a Problem is another representation
 * of, say, an Evidence record just because an edge connects them. Records
 * that are themselves PRB- already get their own self action (see
 * `RecordDetailContent`) so are excluded here to avoid a redundant second
 * button.
 */
function findRelatedProblemId(detail: RecordDetail, lookup: Map<string, RecordSummary>): string | null {
  if (detail.type === "PRB-") return null;
  const candidateIds = [
    ...detail.outgoingEdges.filter((edge) => PROBLEM_REFERENCE_FIELDS.includes(edge.field)).map((edge) => edge.to!),
    ...detail.incomingEdges.filter((edge) => PROBLEM_REFERENCE_FIELDS.includes(edge.field)).map((edge) => edge.from!),
  ];
  for (const id of candidateIds) {
    if (lookup.get(id)?.type === "PRB-") return id;
  }
  return null;
}

/**
 * The record's own `analysis.contribution` value(s), if this record type
 * carries them (currently EVD- only) — rendered as the same uniform
 * ContributionChip used in Problem View (no exceptional emphasis for any
 * value, including CONTRADICTS), plus its related-Problem link, matching
 * Prototype A's meaning-zone contribution row.
 */
function contributionValues(record: Record<string, unknown>): string[] {
  const analysis = record.analysis;
  if (analysis === null || typeof analysis !== "object" || Array.isArray(analysis)) return [];
  const contribution = (analysis as Record<string, unknown>).contribution;
  if (typeof contribution === "string") return [contribution];
  if (Array.isArray(contribution)) return contribution.filter((value): value is string => typeof value === "string");
  return [];
}

/**
 * Approved Prototype A only pairs a relationship sentence with CONTRADICTS
 * ("desafia a leitura de [Problema] PRB-0006" — its own inline title attribute
 * spells out this is specifically a contradiction/contest of the Problem's
 * current reading). No neutral wording for any other canonical contribution
 * value appears in the approved reference or the prototype rationale, so
 * none is invented here: every other value renders its ContributionChip with
 * no accompanying sentence, per the semantic-constraint rule (do not invent
 * missing canonical prose; the chip + relations elsewhere already surface
 * the relationship neutrally).
 */
function contributionTargetSentence(value: string, relatedProblemId: string): string | null {
  return value === "CONTRADICTS" ? `desafia a leitura de ${formatTypedId("PRB-", relatedProblemId)}` : null;
}

/**
 * UX-D §3: SRC-only public provenance-verification action. Only a canonical
 * external HTTP(S) reference that the source's own `access.public` marks as
 * valid for public access qualifies — this reuses existing SRC read-model
 * data (`canonical_reference`, `access.public`) rather than adding a schema
 * field. Anything else (missing reference, non-HTTP(S) scheme, or a source
 * not marked publicly accessible) renders no action: this is deliberately
 * not a generic auto-linker for arbitrary strings.
 */
function publicSourceReferenceUrl(record: Record<string, unknown>): string | null {
  const access = record.access;
  const isPublic = access !== null && typeof access === "object" && !Array.isArray(access) && (access as Record<string, unknown>).public === true;
  if (!isPublic) return null;
  const reference = record.canonical_reference;
  if (typeof reference !== "string") return null;
  let url: URL;
  try {
    url = new URL(reference);
  } catch {
    return null;
  }
  return url.protocol === "http:" || url.protocol === "https:" ? reference : null;
}

function SourceOriginalLinkAction({ detail }: { detail: RecordDetail }) {
  if (detail.type !== "SRC-") return null;
  const url = publicSourceReferenceUrl(detail.record);
  if (url === null) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      Abrir fonte ↗
    </a>
  );
}

function Breadcrumb({ detail, onBackToRecords }: { detail: RecordDetail; onBackToRecords: () => void }) {
  return (
    <nav aria-label="Localização" className="detail-breadcrumb">
      <button type="button" onClick={onBackToRecords}>
        Registos
      </button>
      <span aria-hidden="true" className="detail-breadcrumb-separator">
        ›
      </span>
      <span className="detail-breadcrumb-current">{detail.id}</span>
    </nav>
  );
}

/** TechnicalID / TypeBadge row above the meaning sentence. */
function TypeBadge({ detail }: { detail: RecordDetail }) {
  const typeInfo = describeType(detail.type);
  const kind = typeof detail.record.type === "string" ? detail.record.type : null;
  return (
    <div className="detail-type-row">
      <span className="detail-type-badge">
        <code>{detail.type}</code> {typeInfo.label}
      </span>
      {kind && <span className="detail-type-kind">{kind}</span>}
    </div>
  );
}

/**
 * UX-E §1: one concise, plain-language sentence orienting a first-time
 * visitor to Record Detail. TypeBadge already identifies the record kind
 * (Evidência/Fonte/Avaliação/etc.), so this sentence stays generic rather
 * than duplicating that per-type.
 */
function OrientationIntro() {
  return (
    <p className="record-orientation-intro">
      Este é um registo técnico da investigação. Mostra a informação guardada e as suas ligações para que possa ser consultada e verificada.
    </p>
  );
}

/** UX-E §2: bounded "Leitura rápida" — only fields recordOrientation.ts found present on this exact record; never a fallback/invented value. */
function QuickReadList({ items }: { items: QuickReadItem[] }) {
  if (items.length === 0) return null;
  return (
    <dl className="record-quick-read-grid">
      {items.map((item) => (
        <div key={item.field} className="record-quick-read-item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Source/related-problem relationship navigation is deliberately not
 * repeated here: `RelationshipList` below already renders every related
 * record (SRC/PRB included) as its own single navigable entry with the
 * exact reference path, and duplicating that as a second, differently-worded
 * button for the same record would both add a second click target for the
 * same destination and (per UX-E's "no duplicate blocks" rule) restate
 * content already presented more clearly. The quick read stays limited to
 * data fields the record carries but the meaning zone does not already show.
 */
function EvidenceQuickRead({ detail }: { detail: RecordDetail }) {
  const items = evidenceQuickRead(detail.record);
  if (items.length === 0) return null;

  return (
    <section aria-label="Leitura rápida" className="record-quick-read">
      <h3 className="detail-panel-label">Leitura rápida</h3>
      <QuickReadList items={items} />
    </section>
  );
}

/**
 * The `Abrir fonte ↗` action itself is deliberately not repeated here — it
 * already renders once, in the "Mais ações" rail, via `SourceOriginalLinkAction`.
 * Repeating the same link here would duplicate an action already present
 * (UX-E "Do not duplicate large blocks already presented more clearly
 * elsewhere") and would break the singular `getByRole("link", ...)`
 * accessibility contract existing UX-D tests rely on. This section notes
 * public-access availability as a fact (Sim/Não) without re-rendering the link.
 */
function SourceQuickRead({ detail }: { detail: RecordDetail }) {
  const items = sourceQuickRead(detail.record);
  const name = sourceName(detail.record);

  if (items.length === 0 && !name) return null;

  return (
    <section aria-label="Leitura rápida" className="record-quick-read">
      <h3 className="detail-panel-label">Leitura rápida</h3>
      {name && <p className="record-quick-read-title">{name}</p>}
      <QuickReadList items={items} />
    </section>
  );
}

/**
 * RD-01A: PRB Detail orientation sentence replacing the generic
 * OrientationIntro for PRB records — the `Detalhe` tab is the technical
 * inspection surface for a Problem, distinct from the meaning-oriented
 * `Problema` tab, so it must not render `problem_statement` as hero text.
 */
function PrbOrientationIntro() {
  return <p className="record-orientation-intro">Inspeção técnica do registo canónico.</p>;
}

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function getObject(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key];
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

interface MetadataItem {
  label: string;
  field: string;
  value: string;
}

/**
 * RD-01A Section 1 (Metadados): every item here is either a canonical field
 * value shown exactly as stored, or a record-provenance value the read model
 * already exposes (`detail.file`). No schema identifier/path is included —
 * the read model (read-model.js) does not expose a per-record schema path,
 * only `research/schemas/problem.schema.json` at the type level, which is
 * not record-provenance data — so it is deliberately omitted rather than
 * invented.
 */
function prbMetadataItems(detail: RecordDetail): MetadataItem[] {
  const record = detail.record;
  const items: MetadataItem[] = [];

  const problemId = getString(record, "problem_id");
  items.push({ label: "ID", field: "problem_id", value: problemId ?? detail.id });

  items.push({ label: "Tipo", field: "type", value: "PRB" });

  const domain = record.domain;
  const domainValue = Array.isArray(domain) ? domain.filter((d): d is string => typeof d === "string").join(", ") : typeof domain === "string" ? domain : null;
  if (domainValue) items.push({ label: "Domínio", field: "domain", value: domainValue });

  const geography = getObject(record, "geography");
  const level = geography ? getString(geography, "level") : null;
  if (level) items.push({ label: "Nível geográfico", field: "geography.level", value: level });

  const area = geography ? getString(geography, "area") : null;
  if (area) items.push({ label: "Área", field: "geography.area", value: area });

  items.push({ label: "Ficheiro canónico", field: "file", value: detail.file });

  const decisionBasis = getObject(record, "decision_basis");
  const contractVersion = decisionBasis ? getString(decisionBasis, "contract_version") : null;
  if (contractVersion) items.push({ label: "Contrato", field: "decision_basis.contract_version", value: contractVersion });

  return items;
}

function PrbMetadataPanel({ detail }: { detail: RecordDetail }) {
  const items = prbMetadataItems(detail);
  return (
    <section aria-label="Metadados" className="record-prb-metadata">
      <h3 className="detail-panel-label">Metadados</h3>
      <dl className="detail-provenance-grid">
        {items.map((item) => (
          <Fragment key={item.field}>
            <dt>{item.label}</dt>
            <dd className="detail-technical-field">{item.value}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}

interface CanonicalStateItem {
  label: string;
  field: string;
  value: string;
}

/**
 * RD-01A Section 2 (Estado canónico): stored canonical values only — no
 * translated/reinterpreted value, no confidence/severity/editorial gloss.
 * `publicFieldCaption`/`publicEnumLabel` are deliberately not used here: the
 * requirement is the exact stored canonical value alongside the canonical
 * field name, not the Problem-View-style public label substitution.
 */
const CANONICAL_STATE_FIELDS: { field: string; label: string }[] = [
  { field: "status", label: "Estado" },
  { field: "evidence_status", label: "Estado da evidência" },
  { field: "validation_status", label: "Estado de validação" },
  { field: "digital_tractability", label: "Tratabilidade digital" },
  { field: "solution_landscape_status", label: "Estado das soluções existentes" },
];

function prbCanonicalStateItems(record: Record<string, unknown>): CanonicalStateItem[] {
  const items: CanonicalStateItem[] = [];
  for (const { field, label } of CANONICAL_STATE_FIELDS) {
    const value = getString(record, field);
    if (value) items.push({ label, field, value });
  }
  return items;
}

function PrbCanonicalStatePanel({ detail }: { detail: RecordDetail }) {
  const items = prbCanonicalStateItems(detail.record);
  if (items.length === 0) return null;

  return (
    <section aria-label="Estado canónico" className="record-prb-canonical-state">
      <h3 className="detail-panel-label">Estado canónico</h3>
      <dl className="detail-provenance-grid">
        {items.map((item) => (
          <Fragment key={item.field}>
            <dt>{item.label}</dt>
            <dd>
              <code className="detail-technical-field">{item.field}</code> <span className="detail-technical-field">{item.value}</span>
            </dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}

function ProvenancePanel({ detail }: { detail: RecordDetail }) {
  const uniqueRelatedCount = countUniqueRelatedRecords(detail);
  return (
    <section aria-label="Proveniência" className="record-provenance">
      <h3 className="detail-panel-label">Proveniência</h3>
      <dl className="detail-provenance-grid">
        <dt>ID</dt>
        <dd className="detail-technical-field">{detail.id}</dd>
        <dt>Ficheiro</dt>
        <dd className="detail-technical-field">{detail.file}</dd>
        <dt>Relações</dt>
        <dd>
          {formatPublicCount(uniqueRelatedCount)} registo(s) relacionado(s) ({formatPublicCount(detail.incomingEdges.length)} caminho(s) de entrada,{" "}
          {formatPublicCount(detail.outgoingEdges.length)} caminho(s) de saída) — <a href="#relacoes">ver caminhos exatos ↓</a>
        </dd>
      </dl>
    </section>
  );
}

/** Grouped technical disclosure (Identificação/Campos), closed by default — the exhaustive canonical field tree stays a single generic renderer, only the summary/label changes to match Prototype A's wording. */
function TechnicalDisclosure({ detail }: { detail: RecordDetail }) {
  return (
    <details className="technical-disclosure">
      <summary>Inspeção técnica completa — todos os campos canónicos</summary>
      <p className="technical-disclosure-caption">Campos do corpus canónico apresentados tal como registados, para auditabilidade e rastreabilidade — não uma reformulação pública.</p>
      <RecordFieldTree data={detail.record} />
    </details>
  );
}

function RecordDetailContent({
  detail,
  lookup,
  onSelect,
  onBackToRecords,
  onViewAsProblem,
  onViewInGraph,
}: {
  detail: RecordDetail;
  lookup: Map<string, RecordSummary>;
  onSelect: (id: string) => void;
  onBackToRecords: () => void;
  onViewAsProblem: (id: string) => void;
  onViewInGraph: (id: string) => void;
}) {
  const isPrb = detail.type === "PRB-";
  const meaning = findMeaningField(detail.record);
  const typeInfo = describeType(detail.type);
  const relatedProblemId = findRelatedProblemId(detail, lookup);
  const contributions = contributionValues(detail.record);
  // Already-explicit, schema-driven classification/status fields (RE-01's
  // `buildSummaryFields()` — every enum-constrained field the record's own
  // schema declares), reused here rather than singling out any one
  // record-type-specific field for special presentation. `analysis.contribution`
  // is excluded: it already has its own authoritative rendering via
  // ContributionChip above, so including it here would render it twice.
  const roleFields = Object.entries(lookup.get(detail.id)?.summaryFields ?? {}).filter(([field]) => field !== "analysis.contribution");

  return (
    <div className="record-detail-layout shell-frame">
      <Breadcrumb detail={detail} onBackToRecords={onBackToRecords} />

      {detail.type === "PRB-" && (
        <ContextTabs prbId={detail.id} active="detail" onOpenGeneric={onSelect} onViewAsProblem={onViewAsProblem} onViewInGraph={onViewInGraph} />
      )}

      <div className="record-detail-columns">
        <div className="record-detail-main">
          <section aria-label="Significado" className="record-meaning-zone">
            <TypeBadge detail={detail} />
            {isPrb ? <PrbOrientationIntro /> : <OrientationIntro />}
            {isPrb ? (
              (() => {
                const title = getString(detail.record, "title");
                return title ? (
                  <p className="record-meaning">{title}</p>
                ) : (
                  <p className="record-meaning field-empty">{detail.id} — sem título canónico identificado para este registo.</p>
                );
              })()
            ) : meaning ? (
              <p className="record-meaning">{meaning.value}</p>
            ) : (
              <p className="record-meaning field-empty">{detail.id} — sem campo de significado canónico identificado para este tipo de registo.</p>
            )}
            {(contributions.length > 0 || roleFields.length > 0) && (
              <div className="record-role-fields">
                {contributions.map((value, index) => {
                  const sentence = relatedProblemId ? contributionTargetSentence(value, relatedProblemId) : null;
                  return (
                    <span key={`${value}-${index}`}>
                      <ContributionChip value={value} />
                      {sentence && <span className="detail-contribution-target"> {sentence}</span>}
                    </span>
                  );
                })}
                {roleFields.map(([field, value]) => (
                  <span key={field} className="record-role-chip">
                    {publicFieldCaption(field)}: {publicEnumLabel(field, String(value))}
                  </span>
                ))}
              </div>
            )}
          </section>

          {detail.type === "EVD-" && <EvidenceQuickRead detail={detail} />}
          {detail.type === "SRC-" && <SourceQuickRead detail={detail} />}
          {isPrb && <PrbMetadataPanel detail={detail} />}
          {isPrb && <PrbCanonicalStatePanel detail={detail} />}

          <ProvenancePanel detail={detail} />

          <section aria-label="Campos do registo" className="record-detail-technical">
            <TechnicalDisclosure detail={detail} />
          </section>

          <section aria-label="Relações" id="relacoes" className="record-detail-relations">
            <h3 className="detail-panel-label">Relações — por registo relacionado, com caminhos de referência exatos</h3>
            <RelationshipList detail={detail} lookup={lookup} onSelect={onSelect} />
          </section>
        </div>

        <aside className="record-detail-rail" aria-label="Mais ações">
          <div className="detail-rail-type-note">
            <code>{detail.type}</code>
            <p>{typeInfo.description}</p>
          </div>
          <div className="detail-rail-actions">
            <SourceOriginalLinkAction detail={detail} />
            {relatedProblemId && (
              <button type="button" onClick={() => onViewAsProblem(relatedProblemId)}>
                Ver como Problema ({relatedProblemId})
              </button>
            )}
            {detail.type !== "PRB-" && (
              <button type="button" onClick={() => onViewInGraph(detail.id)}>
                Ver no Grafo
              </button>
            )}
            <span className="detail-rail-file">{detail.file}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

interface RecordDetailPanelProps {
  dataProvider: DataProvider;
  lookup: Map<string, RecordSummary>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBackToRecords: () => void;
  onViewAsProblem: (id: string) => void;
  onViewInGraph: (id: string) => void;
}

/**
 * A failure loading one record's detail is isolated here (useRecordDetail's
 * own state) and never affects the already-loaded Records table/index.
 */
export function RecordDetailPanel({ dataProvider, lookup, selectedId, onSelect, onBackToRecords, onViewAsProblem, onViewInGraph }: RecordDetailPanelProps) {
  const state = useRecordDetail(dataProvider, selectedId);
  const contentRef = useRef<HTMLDivElement>(null);
  const readyId = state.status === "ready" ? state.detail.id : null;

  // Move focus onto the freshly-loaded detail content whenever the selected
  // record actually changes (table-row click, relationship navigation, or a
  // URL/back-forward-driven selection) — so keyboard/AT users land on the
  // new content instead of it silently appearing off-screen from their
  // current focus position.
  useEffect(() => {
    if (readyId !== null) {
      contentRef.current?.focus();
    }
  }, [readyId]);

  return (
    <section aria-labelledby="detail-heading" className="record-detail-panel">
      <h2 id="detail-heading" className="record-detail-heading">
        Detalhes
      </h2>

      {selectedId === null && <p>Nenhum registo selecionado.</p>}

      {state.status === "loading" && (
        <p role="status" aria-live="polite">
          A carregar detalhes de {state.id}…
        </p>
      )}

      {state.status === "error" && (
        <>
          <nav aria-label="Localização" className="detail-breadcrumb">
            <button type="button" onClick={onBackToRecords}>
              Registos
            </button>
          </nav>
          <div role="alert">
            <h3>{ERROR_TITLES[state.error.kind] ?? "Não foi possível carregar o registo"}</h3>
            <p>{state.error.message}</p>
            <button type="button" onClick={state.retry}>
              Tentar novamente
            </button>
          </div>
        </>
      )}

      {state.status === "ready" && (
        <div ref={contentRef} tabIndex={-1} aria-label={`Detalhe de ${state.detail.id}`}>
          <RecordDetailContent
            detail={state.detail}
            lookup={lookup}
            onSelect={onSelect}
            onBackToRecords={onBackToRecords}
            onViewAsProblem={onViewAsProblem}
            onViewInGraph={onViewInGraph}
          />
        </div>
      )}
    </section>
  );
}
