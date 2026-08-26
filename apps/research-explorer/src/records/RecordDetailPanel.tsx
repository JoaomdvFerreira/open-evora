import { Fragment, useEffect, useRef, type ReactNode } from "react";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import { useRecordDetail } from "./useRecordDetail";
import { RecordFieldTree } from "./RecordFieldTree";
import { describeType, formatTypedId, knownTypePrefixes } from "../typeGlossary";
import { findMeaningField } from "./meaningField";
import { ContributionChip } from "./ContributionChip";
import { publicEnumLabel, publicFieldCaption, formatPublicCount } from "../presentation";
import { ContextTabs } from "../ContextTabs";
import { evidenceQuickRead, type QuickReadItem } from "./recordOrientation";
import { SourceOverviewSection } from "./SourceOverviewSection";
import { SourceFindingsSection } from "./SourceFindingsSection";
import { SourceCoverageSection } from "./SourceCoverageSection";
import { SourceDatesAccessSection } from "./SourceDatesAccessSection";
import { SourceLicensingSection } from "./SourceLicensingSection";
import { SourceCaveatsSection } from "./SourceCaveatsSection";
import { SourceInvestigationSection } from "./SourceInvestigationSection";
import { useSourceEvidenceRelations, type SourceEvidenceRelationsState } from "./useSourceEvidenceRelations";
import { extractSourceCaveats } from "./sourceView";
import { SourceTechnicalSection } from "./SourceTechnicalSection";

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
 * RD-01D: unique related-record IDs for one direction only, deduplicated —
 * a record referenced through more than one edge/canonical path in the same
 * direction still appears exactly once. Unlike `groupPathsByRelatedRecord`
 * (which preserves every distinct path, for `Referências canónicas`'s and
 * the generic Relações section's own purposes), this deliberately discards
 * path detail: RD-01D's Relações no corpus answers "which records", not
 * "through which fields".
 */
function uniqueRelatedIds(edges: { to?: string; from?: string }[], key: "to" | "from"): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const edge of edges) {
    const id = edge[key]!;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function RelatedRecordButton({ id, lookup, onSelect }: { id: string; lookup: Map<string, RecordSummary>; onSelect: (id: string) => void }) {
  const related = lookup.get(id);
  return (
    <li>
      <button type="button" onClick={() => onSelect(id)}>
        {related ? `${formatTypedId(related.type, related.id)} — ${related.label}` : id}
      </button>
    </li>
  );
}

/**
 * RD-01G: for PRB records, Relações no corpus now shows only records that
 * reference the current PRB (incoming direction) — outgoing references are
 * already owned exclusively by `Referências canónicas` above (current PRB →
 * other records, with the exact canonical field path). Relações no corpus
 * answers the complementary question: which other records point at this one
 * (other records → current PRB), deduplicated by record ID, no field path,
 * no ordinal.
 */
function PrbRelationsBoundary({ detail, lookup, onSelect }: { detail: RecordDetail; lookup: Map<string, RecordSummary>; onSelect: (id: string) => void }) {
  const incomingIds = uniqueRelatedIds(detail.incomingEdges, "from");

  return (
    <section aria-label="Relações no corpus" className="record-prb-relations-boundary">
      <h4>← Referenciado por</h4>
      {incomingIds.length === 0 ? (
        <p>Nenhum registo referencia este PRB.</p>
      ) : (
        <ul className="prb-relations-list">
          {incomingIds.map((id) => (
            <RelatedRecordButton key={id} id={id} lookup={lookup} onSelect={onSelect} />
          ))}
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
 * SUI-02A: SRC-only public provenance-verification action, restored to SRC
 * v2 canonical eligibility semantics (`docs/datamodel.md` §1.1) — the
 * retired v1 `access.public` field no longer governs this. A canonical
 * external HTTP(S) reference qualifies only when the source's own
 * `access.level` is `"public"` and `access.availability` is `"available"`;
 * availability is never inferred from any other field. Anything else
 * (missing reference, non-HTTP(S) scheme, non-public level, or
 * unavailable/unknown availability) renders no action: this is deliberately
 * not a generic auto-linker for arbitrary strings.
 */
function publicSourceReferenceUrl(record: Record<string, unknown>): string | null {
  const access = record.access;
  if (access === null || typeof access !== "object" || Array.isArray(access)) return null;
  const accessRecord = access as Record<string, unknown>;
  if (accessRecord.level !== "public") return null;
  if (accessRecord.availability !== "available") return null;
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

/**
 * SUI-03B3: moved out of the rail into the Source identity/header area — the
 * action stays visually tied to the Source itself rather than to
 * investigation navigation. Eligibility (`publicSourceReferenceUrl`) is
 * unchanged from SUI-02A; only placement and label moved.
 */
function SourceOriginalLinkAction({ detail }: { detail: RecordDetail }) {
  if (detail.type !== "SRC-") return null;
  const url = publicSourceReferenceUrl(detail.record);
  if (url === null) return null;
  return (
    <p className="record-source-header-action">
      <a href={url} target="_blank" rel="noopener noreferrer">
        Abrir fonte original ↗
      </a>
    </p>
  );
}

/**
 * SUI-03C2/H2: `SourceFindingsSection` ("O que encontrámos") half of the one
 * shared SRC → EVD relation state (`SourceRelationsState`, owned by
 * `RecordDetailContent` via `useSourceEvidenceRelations` —
 * SUI-03A2's `loadSourceEvidenceRelations` as sole SRC→EVD relation
 * authority). Mirrors `useRecordDetail`'s own loading/error contract: while
 * loading, a loading placeholder renders; on failure, an inline retry
 * affordance renders instead of the zero-EVD empty state, which
 * `SourceFindingsSection` itself only ever renders once relation loading has
 * actually succeeded with zero backlinks.
 */
function SourceFindings({ state, onSelect }: { state: SourceEvidenceRelationsState & { retry: () => void }; onSelect: (id: string) => void }) {
  if (state.status === "loading" || state.status === "idle") {
    return (
      <section aria-label="O que encontrámos" className="source-findings-section">
        <h3 className="detail-panel-label">O que encontrámos</h3>
        <p role="status" aria-live="polite">
          A carregar observações da investigação…
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section aria-label="O que encontrámos" className="source-findings-section">
        <h3 className="detail-panel-label">O que encontrámos</h3>
        <div role="alert">
          <p>Não foi possível carregar as observações da investigação ligadas a esta fonte.</p>
          <button type="button" onClick={state.retry}>
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  return <SourceFindingsSection relations={state.relations} onSelect={onSelect} />;
}

/**
 * SUI-03H2: `SourceInvestigationSection` ("Na investigação") half of the
 * same shared `SourceRelationsState` `SourceFindings` above consumes — no
 * second relation load. Renders only once relation state is `"ready"`;
 * absent during loading, on error, and (via `SourceInvestigationSection`'s
 * own `relatedProblems.length === 0` check) when ready with no related
 * Problem — never a second loading/error message.
 */
function SourceInvestigation({ state, onSelect }: { state: SourceEvidenceRelationsState; onSelect: (id: string) => void }) {
  if (state.status !== "ready") return null;
  return <SourceInvestigationSection relations={state.relations} onSelect={onSelect} />;
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

/**
 * RD-01B: the set of top-level PRB fields already owned by a dedicated
 * section elsewhere (RD-01A Metadados / Estado canónico, or record identity
 * already shown in the breadcrumb/meaning zone) — excluded from the
 * inspector to avoid unnecessary duplication, per RD-01B's own instruction.
 * `type`/`file` are read-model provenance, not canonical PRB record fields,
 * so they never appear here regardless.
 */
const PRB_FIELDS_OWNED_ELSEWHERE = new Set(["problem_id", "title", "domain", "geography", "status", "evidence_status", "validation_status", "digital_tractability", "solution_landscape_status"]);

/**
 * RD-01B bounded field list: only PRB fields the task explicitly names as
 * "known optional PRB contract field" get a `Não registado` placeholder when
 * absent. Every other top-level field renders only if the record actually
 * carries it — this deliberately does not walk the schema to invent a full
 * theoretical field list (RD-01B's own "keep this bounded" instruction).
 */
const PRB_INSPECTOR_KNOWN_FIELDS = ["problem_statement", "affected_populations", "causal_reading", "evidence", "investigation", "decision_basis"];

/**
 * decision_basis's own known sub-keys, in canonical contract order (mirrors
 * problem.schema.json's documented decision_basis shape) — rendered in this
 * order when present so the inspector's nesting matches the task's own
 * worked example, rather than object insertion order from YAML parsing.
 */
const DECISION_BASIS_KNOWN_KEYS = [
  "contract_version",
  "eligibility_basis",
  "corroboration_basis",
  "manifestation",
  "consequence",
  "scope",
  "currentness",
  "contradiction_search",
  "overlap_check",
  "corroboration_statement",
  "supporting_evidence",
  "boundary_evidence",
  "independence_assessment",
  "limitations",
];

/**
 * RD-01B's own absent/null/empty contract: missing field, explicit `null`,
 * empty array, and empty object are four visibly distinct states — never
 * collapsed into one generic dash the way `RecordFieldTree` (the pre-existing
 * complete disclosure) does. `isKnownField` gates the "missing" case: an
 * unlisted, absent field renders nothing (never invents a placeholder row),
 * per the task's "do not invent absent optional fields" instruction.
 */
function InspectorValue({ value }: { value: unknown }): ReactNode {
  if (value === null) return <span className="inspector-null">null</span>;
  if (typeof value === "boolean" || typeof value === "number") return <span className="inspector-scalar-value">{String(value)}</span>;
  if (typeof value === "string") {
    return <span className="inspector-scalar-value">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="inspector-empty">[ ] · 0 elementos</span>;
    return (
      <ol className="inspector-array">
        {value.map((item, index) => (
          <li key={index}>
            <span className="inspector-index">[{index}]</span> <InspectorValue value={item} />
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="inspector-empty">{"{ } · 0 propriedades"}</span>;
    return (
      <dl className="inspector-object">
        {entries.map(([key, entryValue]) => (
          <Fragment key={key}>
            <dt className="inspector-key">{key}</dt>
            <dd>
              <InspectorValue value={entryValue} />
            </dd>
          </Fragment>
        ))}
      </dl>
    );
  }
  return <span className="detail-technical-field">{String(value)}</span>;
}

interface InspectorField {
  key: string;
  present: boolean;
  value: unknown;
}

function resolveInspectorField(record: Record<string, unknown>, key: string): InspectorField {
  return { key, present: key in record && record[key] !== undefined, value: record[key] };
}

/**
 * decision_basis.scope is the one decision_basis sub-key RD-01B names
 * explicitly as a "known optional PRB contract field" (alongside
 * causal_reading/investigation at the top level) — so it renders a
 * `Não registado` row when absent, unlike every other decision_basis
 * sub-key, which is simply omitted from the entries list when the record
 * doesn't carry it (bounded to the known contract shape, no deeper invented
 * placeholders for sub-keys the task never named as known-optional).
 */
const DECISION_BASIS_KNOWN_ABSENT_KEYS = new Set(["scope"]);

/** `decision_basis` gets its own field ordering (canonical contract order) rather than raw object insertion order, per RD-01B's structural example. */
function decisionBasisFields(decisionBasis: Record<string, unknown>): InspectorField[] {
  return DECISION_BASIS_KNOWN_KEYS.filter((key) => (key in decisionBasis && decisionBasis[key] !== undefined) || DECISION_BASIS_KNOWN_ABSENT_KEYS.has(key)).map((key) =>
    resolveInspectorField(decisionBasis, key)
  );
}

function InspectorFieldRow({ field }: { field: InspectorField }) {
  return (
    <div className="inspector-field">
      <div className="inspector-field-name">{field.key}</div>
      <div className="inspector-field-value">{field.present ? <InspectorValue value={field.value} /> : <span className="field-empty">Não registado</span>}</div>
    </div>
  );
}

/**
 * RD-01B: technical object inspector for the canonical PRB fields not
 * already owned by Metadados/Estado canónico — faithful structure, exact
 * canonical field names and stored values, no editorial reinterpretation.
 * Deliberately separate from `TechnicalDisclosure` (the pre-existing
 * exhaustive raw tree), which this task must not change.
 */
function PrbFieldInspector({ detail }: { detail: RecordDetail }) {
  const record = detail.record;

  const knownFields = PRB_INSPECTOR_KNOWN_FIELDS.map((key) => resolveInspectorField(record, key));

  const otherFields = Object.keys(record)
    .filter((key) => !PRB_FIELDS_OWNED_ELSEWHERE.has(key) && !PRB_INSPECTOR_KNOWN_FIELDS.includes(key))
    .map((key) => resolveInspectorField(record, key));

  const decisionBasisField = knownFields.find((f) => f.key === "decision_basis")!;
  const otherKnownFields = knownFields.filter((f) => f.key !== "decision_basis");

  return (
    <section aria-label="Campos canónicos" className="record-prb-inspector">
      <h3 className="detail-panel-label">Campos canónicos</h3>
      {otherKnownFields.map((field) => (
        <InspectorFieldRow key={field.key} field={field} />
      ))}
      <div className="inspector-field">
        <div className="inspector-field-name">decision_basis</div>
        <div className="inspector-field-value">
          {decisionBasisField.present ? (
            (() => {
              const decisionBasis = getObject(record, "decision_basis");
              if (!decisionBasis) return <InspectorValue value={decisionBasisField.value} />;
              const fields = decisionBasisFields(decisionBasis);
              if (fields.length === 0) return <span className="inspector-empty">{"{ } · 0 propriedades"}</span>;
              return (
                <>
                  {fields.map((field) => (
                    <InspectorFieldRow key={field.key} field={field} />
                  ))}
                </>
              );
            })()
          ) : (
            <span className="field-empty">Não registado</span>
          )}
        </div>
      </div>
      {otherFields.map((field) => (
        <InspectorFieldRow key={field.key} field={field} />
      ))}
    </section>
  );
}

/**
 * RD-01C: a single canonical-record reference found by walking the raw PRB
 * object — `path` is the exact canonical field path (including array
 * indexes) at which `targetId` was found, e.g.
 * `decision_basis.manifestation.evidence[0]`. Deliberately not deduplicated
 * by `targetId`: the same target referenced through two distinct paths is
 * two distinct entries here (task's own "do not deduplicate" instruction).
 */
interface CanonicalReference {
  path: string;
  targetId: string;
}

/**
 * RD-01F/F03: the field must contain *only* an exact canonical record ID
 * (`^(?:SRC|EVD|PRB)-\d+$`), not merely start with or contain one — a
 * `startsWith` check (the prior predicate) misclassifies prose fields such as
 * `decision_basis.eligibility_basis` as references whenever their text
 * happens to open with a record ID. Exact-match against
 * `typeGlossary.ts`'s own known record-type prefixes (SRC-/EVD-/PRB-) — the
 * same narrowly scoped source `describeType`/`formatTypedId` above rely on —
 * rather than inventing a new shared abstraction for this one field.
 */
function isCanonicalRecordId(value: string): boolean {
  return knownTypePrefixes().some((prefix) => new RegExp(`^${prefix}\\d+$`).test(value));
}

/**
 * Walks the full raw PRB record (`detail.record`, the complete parsed-YAML
 * object — not the edge projection, which is schema-`references`-driven and
 * silently omits paths like `investigation.open_questions[].evidence` and
 * `investigation.path.*.evidence`, see read-model.js / problem.schema.json)
 * to recover every canonical-record-ID string value together with its exact
 * field path. This is the only reliable source of path-faithful references.
 */
function collectCanonicalReferences(value: unknown, path: string, out: CanonicalReference[]): void {
  if (typeof value === "string") {
    if (isCanonicalRecordId(value)) out.push({ path, targetId: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectCanonicalReferences(item, `${path}[${index}]`, out));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      collectCanonicalReferences(entryValue, path ? `${path}.${key}` : key, out);
    }
  }
}

/**
 * RD-01C: technical section owning canonical field path → referenced record
 * ID → navigation. Deliberately separate from `RelationshipList` (which
 * groups by related record and is driven by the edge projection): this
 * section's primary information is the exact canonical path itself, one row
 * per path, never grouped or deduplicated by target.
 */
/**
 * `problem_id` is the record's own self-identification (already shown in
 * Metadados/the breadcrumb), not a reference to another canonical record —
 * excluded here so the record never "references" itself.
 */
const SELF_ID_FIELD = "problem_id";

function PrbCanonicalReferences({ detail, onSelect }: { detail: RecordDetail; onSelect: (id: string) => void }) {
  const references: CanonicalReference[] = [];
  collectCanonicalReferences(detail.record, "", references);
  const filteredReferences = references.filter((ref) => ref.path !== SELF_ID_FIELD);

  return (
    <section aria-label="Referências canónicas" className="record-prb-references">
      <h3 className="detail-panel-label">Referências canónicas</h3>
      {filteredReferences.length === 0 ? (
        <p className="field-empty">Nenhuma referência canónica registada.</p>
      ) : (
        <ul className="prb-reference-list">
          {filteredReferences.map((ref, index) => (
            <li key={`${ref.path}-${index}`} className="prb-reference-item">
              <code className="prb-reference-path">{ref.path}</code>
              <button type="button" className="prb-reference-target" onClick={() => onSelect(ref.targetId)} aria-label={`Abrir ${ref.targetId} referenciado em ${ref.path}`}>
                {ref.targetId}
              </button>
            </li>
          ))}
        </ul>
      )}
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

/**
 * RD-01E: for PRB records, the same exhaustive `RecordFieldTree` fallback
 * as `TechnicalDisclosure`, reframed as "Estrutura técnica completa" — the
 * final audit fallback, deliberately still exhaustive (never pruned to
 * avoid duplicating Metadados/Estado canónico/Campos canónicos/Referências
 * canónicas, per the task's explicit "do not remove fields" instruction).
 */
function PrbRawTechnicalDisclosure({ detail }: { detail: RecordDetail }) {
  return (
    <details className="technical-disclosure">
      <summary>Estrutura técnica completa</summary>
      <p className="technical-disclosure-caption">Objeto canónico completo, sem omissões.</p>
      <RecordFieldTree data={detail.record} />
    </details>
  );
}

function RecordDetailContent({
  dataProvider,
  detail,
  lookup,
  onSelect,
  onBackToRecords,
  onViewAsProblem,
  onViewInGraph,
}: {
  dataProvider: DataProvider;
  detail: RecordDetail;
  lookup: Map<string, RecordSummary>;
  onSelect: (id: string) => void;
  onBackToRecords: () => void;
  onViewAsProblem: (id: string) => void;
  onViewInGraph: (id: string) => void;
}) {
  const isPrb = detail.type === "PRB-";
  const isSrc = detail.type === "SRC-";
  const meaning = findMeaningField(detail.record);
  const typeInfo = describeType(detail.type);
  const relatedProblemId = findRelatedProblemId(detail, lookup);
  const contributions = contributionValues(detail.record);
  // SUI-03H2: the one SRC → EVD relation load/state owner for this rendered
  // SRC detail, shared by `SourceFindings` ("O que encontrámos") and
  // `SourceInvestigation` ("Na investigação") below — never a second
  // `useSourceEvidenceRelations`/`loadSourceEvidenceRelations` call for the
  // same detail. `sourceId` is `null` for non-SRC records, which is this
  // hook's own no-op contract (see `useSourceEvidenceRelations.ts`).
  const sourceRelationsState = useSourceEvidenceRelations(dataProvider, isSrc ? detail.id : null);
  const hasCaveats = isSrc ? extractSourceCaveats(detail.record) !== null : false;
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

          {detail.type === "SRC-" && <SourceOriginalLinkAction detail={detail} />}

          {detail.type === "EVD-" && <EvidenceQuickRead detail={detail} />}
          {isSrc && <SourceOverviewSection record={detail.record} />}
          {isSrc && <SourceFindings state={sourceRelationsState} onSelect={onSelect} />}
          {isSrc && <SourceCoverageSection record={detail.record} />}
          {isSrc && <SourceDatesAccessSection record={detail.record} />}
          {isSrc && <SourceLicensingSection record={detail.record} />}
          {isSrc && !hasCaveats && <SourceInvestigation state={sourceRelationsState} onSelect={onSelect} />}
          {isSrc && <SourceCaveatsSection record={detail.record} />}
          {isSrc && hasCaveats && <SourceInvestigation state={sourceRelationsState} onSelect={onSelect} />}

          {isSrc && <SourceTechnicalSection record={detail.record} />}

          {isPrb ? (
            <>
              <PrbMetadataPanel detail={detail} />
              <PrbCanonicalStatePanel detail={detail} />
              <PrbFieldInspector detail={detail} />
              <PrbCanonicalReferences detail={detail} onSelect={onSelect} />

              <section aria-label="Relações" id="relacoes" className="record-detail-relations">
                <h3 className="detail-panel-label">Relações no corpus</h3>
                <PrbRelationsBoundary detail={detail} lookup={lookup} onSelect={onSelect} />
              </section>

              <section aria-label="Campos do registo" className="record-detail-technical">
                <PrbRawTechnicalDisclosure detail={detail} />
              </section>
            </>
          ) : isSrc ? null : (
            <>
              <ProvenancePanel detail={detail} />

              <section aria-label="Campos do registo" className="record-detail-technical">
                <TechnicalDisclosure detail={detail} />
              </section>

              <section aria-label="Relações" id="relacoes" className="record-detail-relations">
                <h3 className="detail-panel-label">Relações — por registo relacionado, com caminhos de referência exatos</h3>
                <RelationshipList detail={detail} lookup={lookup} onSelect={onSelect} />
              </section>
            </>
          )}
        </div>

        <aside className="record-detail-rail" aria-label="Mais ações">
          <div className="detail-rail-type-note">
            <code>{detail.type}</code>
            <p>{typeInfo.description}</p>
          </div>
          {!isSrc && (
            <div className="detail-rail-actions">
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
          )}
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
            dataProvider={dataProvider}
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
