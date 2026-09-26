import type { ReactNode } from "react";
import type { RecordDetail, RecordSummary } from "../dataProvider/types";
import { canonicalFileUrl } from "../dataProvider/StaticDataProvider";
import { formatPublicCompactDate, formatPublicCount, formatPublicPartialDate, publicEnumLabel } from "../presentation/presentation";
import { describeTopic } from "../presentation/topicMapping";
import { Breadcrumb } from "../presentation/Breadcrumb";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { EmptyState } from "../presentation/EmptyState";
import { RecordIdentifier } from "./RecordIdentifier";
import { extractSourceCaveats, extractSourceCoverage, extractSourceDatesAccess, extractSourceLicensing, extractSourceOverview, isHttpUrl, type SourceCoverage } from "./sourceView";
import type { SourceEvidenceRelations } from "./sourceEvidenceRelations";
import type { SourceEvidenceRelationsState } from "./useSourceEvidenceRelations";

/**
 * Public SRC Record Detail: the editorial reading and verification page for
 * one Source. Every value is read from the canonical SRC record, the record
 * index (`lookup`, for Problem titles/status) or the one SRC → EVD → PRB
 * relation state (`relations`, `loadSourceEvidenceRelations`) — which is also
 * the sole authority for the hero summary counts, the "Observações" cell,
 * "O que encontrámos" and "Na investigação", so they can never disagree.
 * Styles: styles/src-detail.css.
 */

/** Stable in-page anchor targeted by "Verificar". */
export const SRC_AUDIT_ANCHOR_ID = "src-auditoria";

type RelationsState = SourceEvidenceRelationsState & { retry: () => void };

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown): string | null { return typeof value === "string" && value.trim() !== "" ? value : null; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : []; }

function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatPublicCount(count)} ${count === 1 ? singular : pluralForm}`;
}

/**
 * SRC v2 eligibility for the external "Abrir fonte" actions (`docs/datamodel.md`
 * §1.1): only a canonical HTTP(S) reference of a Source whose own
 * `access.level` is "public" and `access.availability` is "available".
 * Availability is never inferred from any other field.
 */
export function publicSourceReferenceUrl(record: Record<string, unknown>): string | null {
  const access = objectValue(record.access);
  if (access?.level !== "public" || access.availability !== "available") return null;
  const reference = text(record.canonical_reference);
  return reference && isHttpUrl(reference) ? reference : null;
}

/** Presentation-only display form of an address: no scheme, no leading "www.". The link target stays the canonical value. */
function displayAddress(reference: string): string {
  return reference.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

/** "Município de Évora" only for levels that read naturally as "<level> de <area>"; otherwise the authored area (or the level alone). */
const LEVELS_NAMED_BY_AREA = new Set(["parish", "city", "municipality"]);

function whereLabel(coverage: SourceCoverage): string | null {
  const { geographyLevel: level, geographyArea: area } = coverage;
  if (area && level && LEVELS_NAMED_BY_AREA.has(level)) return `${publicEnumLabel("scope.geography.level", level)} de ${area}`;
  if (area) return area;
  return level ? publicEnumLabel("scope.geography.level", level) : null;
}

/** Distinct Problems related to the ready relation set, and whether every one is canonically OPEN (indexed `status`). */
function problemSummary(relations: SourceEvidenceRelations, lookup: Map<string, RecordSummary>) {
  const count = relations.relatedProblems.length;
  const allOpen = count > 0 && relations.relatedProblems.every((problem) => lookup.get(problem.problemId)?.summaryFields.status === "OPEN");
  return { count, allOpen };
}

/** Problems that use each EVD — the inverse of `relatedProblems[].viaEvidenceIds`, in relation order. */
function problemsByEvidence(relations: SourceEvidenceRelations): Map<string, string[]> {
  const byEvidence = new Map<string, string[]>();
  for (const problem of relations.relatedProblems) {
    for (const evidenceId of problem.viaEvidenceIds) byEvidence.set(evidenceId, [...(byEvidence.get(evidenceId) ?? []), problem.problemId]);
  }
  return byEvidence;
}

function SrcLocalHeader({ detail, originalUrl, onBackToRecords }: { detail: RecordDetail; originalUrl: string | null; onBackToRecords: () => void }) {
  return (
    <div className="src-header-band">
      <div className="shell-frame shell-frame--wide">
        <div className="src-header">
          <Breadcrumb
            label="Localização"
            ancestors={[{ key: "registos", action: <button type="button" className="src-breadcrumb-ancestor" onClick={onBackToRecords}>Registos</button> }]}
            current={<RecordIdentifier variant="text" density="compact" id={detail.id} />}
          />
          <div className="src-header-utilities">
            {originalUrl && (
              <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="src-header-utility" aria-label="Abrir fonte original (abre numa nova janela)">
                <span aria-hidden="true" className="src-header-utility-icon">↗</span>
                <span className="src-header-utility-label">Abrir fonte<span className="src-header-utility-extra"> original</span></span>
              </a>
            )}
            <a href={`#${SRC_AUDIT_ANCHOR_ID}`} className="src-header-utility" aria-label="Verificar esta fonte">
              <span aria-hidden="true" className="src-header-utility-icon">↓</span>
              <span className="src-header-utility-label">Verificar</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The summary states only relation-derived facts: how many EVDs cite this
 * Source and how many Problems use them. "em investigação" only when every
 * related Problem is canonically OPEN. Rendered once relations are ready.
 */
function heroSummary(state: RelationsState, lookup: Map<string, RecordSummary>): string | null {
  if (state.status !== "ready") return null;
  const evidenceCount = state.relations.uniqueEvidenceCount;
  if (evidenceCount === 0) return "A Open Évora ainda não extraiu observações desta fonte.";
  const { count, allOpen } = problemSummary(state.relations, lookup);
  const observations = plural(evidenceCount, "observação", "observações");
  if (count === 0) return `A Open Évora extraiu desta fonte ${observations}, ainda sem ligação explícita a problemas.`;
  const usedIn = evidenceCount === 1 ? "usada" : "usadas";
  return `A Open Évora extraiu desta fonte ${observations}, ${usedIn} em ${plural(count, "problema", "problemas")}${allOpen ? " em investigação" : ""}.`;
}

function SrcHero({ record, name, summary }: { record: Record<string, unknown>; name: string; summary: string | null }) {
  const overview = extractSourceOverview(record);
  const origin = [overview.publisher, overview.creators?.join(", ")].filter(Boolean).join(" · ");
  return (
    <header className="src-hero">
      <div className="src-hero-eyebrow-row">
        <span className="src-hero-eyebrow">
          <span className="src-hero-eyebrow-mark" aria-hidden="true" />
          Fonte{overview.resourceType && ` · ${publicEnumLabel("resource_type", overview.resourceType)}`}
        </span>
        {origin && <span className="src-hero-publisher">{origin}</span>}
      </div>
      {overview.lastCheckedAt && (
        <p className="src-hero-checked">Verificada em <time dateTime={overview.lastCheckedAt}>{formatPublicCompactDate(overview.lastCheckedAt)}</time></p>
      )}
      <h1 id="src-title" className="src-hero-title">{name}</h1>
      {summary && <p className="src-hero-summary">{summary}</p>}
    </header>
  );
}

function usageValue(state: RelationsState): ReactNode {
  if (state.status === "ready") {
    const problems = state.relations.relatedProblems.length;
    return `${formatPublicCount(state.relations.uniqueEvidenceCount)} · ${plural(problems, "problema", "problemas")}`;
  }
  if (state.status === "error") return "Indisponível";
  return <span aria-label="A carregar">…</span>;
}

/**
 * Six public facts in one fixed cell set, so every breakpoint's grid keeps
 * its shape; an absent optional value reads "Não registado" rather than
 * disappearing or being inferred. The COBERTURA / ACESSO / USO group row is
 * presentation-only (aria-hidden): the facts' own labels carry meaning.
 */
function SrcMetadataStrip({ record, relations }: { record: Record<string, unknown>; relations: RelationsState }) {
  const coverage = extractSourceCoverage(record);
  const datesAccess = extractSourceDatesAccess(record);
  const reuse = extractSourceLicensing(record).reuse;
  const temporal = coverage.temporal;
  const domains = coverage.domains ?? [];
  const access = [
    datesAccess.accessLevel && publicEnumLabel("access.level", datesAccess.accessLevel),
    datesAccess.accessFormat && publicEnumLabel("access.format", datesAccess.accessFormat),
  ].filter(Boolean).join(" · ");
  const cells: { key: string; label: string; value: ReactNode }[] = [
    { key: "where", label: "Onde", value: whereLabel(coverage) },
    temporal?.kind === "as_of"
      ? { key: "when", label: "Data", value: formatPublicPartialDate(temporal.asOf) }
      : { key: "when", label: "Período", value: temporal ? `${formatPublicPartialDate(temporal.start)}–${formatPublicPartialDate(temporal.end)}` : null },
    { key: "topics", label: "Temas", value: domains.length > 0 ? plural(domains.length, "tema", "temas") : null },
    { key: "access", label: "Acesso", value: access || null },
    {
      key: "reuse",
      label: "Reutilização",
      value: reuse && (
        <span className={`src-reuse${reuse === "permitted" ? "" : " src-reuse--attention"}`}>
          <span className="src-reuse-mark" aria-hidden="true" />
          {publicEnumLabel("licensing.reuse", reuse)}
        </span>
      ),
    },
    { key: "usage", label: "Observações", value: usageValue(relations) },
  ];
  return (
    <section className="src-meta" aria-label="Cobertura, acesso e uso">
      <div className="shell-frame shell-frame--wide src-meta-groups" aria-hidden="true">
        <span className="src-meta-group src-meta-group--coverage">Cobertura</span>
        <span className="src-meta-group src-meta-group--access">Acesso</span>
        <span className="src-meta-group src-meta-group--use">Uso</span>
      </div>
      <div className="src-meta-band">
        <dl className="shell-frame shell-frame--wide src-meta-grid">
          {cells.map((cell) => (
            <div key={cell.key} className={`src-meta-cell src-meta-cell--${cell.key}`}>
              <dt>{cell.label}</dt>
              <dd>{cell.value ?? <span className="src-meta-empty">Não registado</span>}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function SrcSection({ id, label, note, tone, children }: { id: string; label: string; note?: string | null; tone?: "accent"; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-label`} className={`src-section${tone ? ` src-section--${tone}` : ""}`}>
      <div className="src-section-intro">
        <h2 id={`${id}-label`} className="src-section-label">{label}</h2>
        {note && <p className="src-section-note">{note}</p>}
      </div>
      <div className="src-section-body">{children}</div>
    </section>
  );
}

function SrcFinding({ evidence, sourceId, problemIds, onSelect, onViewAsProblem }: {
  evidence: RecordDetail;
  sourceId: string;
  problemIds: string[];
  onSelect: (id: string) => void;
  onViewAsProblem: (id: string) => void;
}) {
  const record = evidence.record;
  const scope = objectValue(record.scope);
  const geography = objectValue(scope?.geography);
  const level = text(geography?.level);
  const where = text(geography?.area) ?? (level && publicEnumLabel("scope.geography.level", level));
  const populations = strings(scope?.populations);
  const otherSources = strings(objectValue(record.provenance)?.sources).filter((id) => id !== sourceId);
  const domains = strings(record.domains);
  const summary = text(objectValue(record.observation)?.summary);
  return (
    <li className="src-finding">
      <p className="src-finding-head">
        <RecordIdentifier variant="action" density="compact" id={evidence.id} onActivate={() => onSelect(evidence.id)} accessibleLabel={`Abrir ${evidence.id}`} />
        {domains.length > 0 && <span className="src-finding-topics">{domains.map((domain) => describeTopic(domain).label).join(" · ")}</span>}
      </p>
      {summary && <p className="src-finding-summary">{summary}</p>}
      <dl className="src-finding-facts">
        {where && <div><dt>Onde</dt><dd>{where}</dd></div>}
        {populations.length > 0 && <div><dt>Quem</dt><dd className="src-finding-populations">{populations.join("; ")}</dd></div>}
        {otherSources.length > 0 && (
          <div>
            <dt>Também em</dt>
            <dd className="src-finding-ids">{otherSources.map((id, index) => <span key={id}>{index > 0 && ", "}<RecordIdentifier variant="text" density="compact" id={id} /></span>)}</dd>
          </div>
        )}
      </dl>
      {problemIds.length > 0 && (
        <dl className="src-finding-problems">
          <div>
            <dt>{problemIds.length === 1 ? "Problema" : "Problemas"}</dt>
            <dd>
              {problemIds.map((id) => (
                <RecordIdentifier key={id} variant="action" density="compact" id={id} onActivate={() => onViewAsProblem(id)} accessibleLabel={`Ver problema ${id}`} />
              ))}
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}

function SrcFindings({ state, sourceId, onSelect, onViewAsProblem }: { state: RelationsState; sourceId: string; onSelect: (id: string) => void; onViewAsProblem: (id: string) => void }) {
  const ready = state.status === "ready" ? state.relations : null;
  const note = ready && ready.uniqueEvidenceCount > 0 ? plural(ready.uniqueEvidenceCount, "observação", "observações") : null;
  const byEvidence = ready ? problemsByEvidence(ready) : null;
  return (
    <SrcSection id="src-findings" label="O que encontrámos" note={note}>
      {state.status === "loading" || state.status === "idle" ? (
        <ProgressMessage message="A carregar observações da investigação…" />
      ) : state.status === "error" ? (
        <ErrorNotice title="Não foi possível carregar as observações da investigação ligadas a esta fonte." message="" action={<button type="button" onClick={state.retry}>Tentar novamente</button>} />
      ) : ready!.evidence.length === 0 ? (
        <EmptyState message="Ainda não existem observações da investigação ligadas explicitamente a esta fonte." />
      ) : (
        <ul className="src-finding-list">
          {ready!.evidence.map((evidence) => (
            <SrcFinding key={evidence.id} evidence={evidence} sourceId={sourceId} problemIds={byEvidence!.get(evidence.id) ?? []} onSelect={onSelect} onViewAsProblem={onViewAsProblem} />
          ))}
        </ul>
      )}
    </SrcSection>
  );
}

/**
 * Public Problem label for "Na investigação": the shared topic labels of the
 * Problem's canonical domain codes (all of them, in canonical order — no
 * primary domain is picked). Falls back to the record-index label, then the id.
 */
function problemTopicLabel(problemId: string, relations: SourceEvidenceRelations, lookup: Map<string, RecordSummary>): string {
  const codes = relations.problemDomainCodes[problemId] ?? [];
  if (codes.length > 0) return codes.map((code) => describeTopic(code).label).join(" · ");
  return lookup.get(problemId)?.label ?? problemId;
}

/** Rendered only once relations are ready and at least one Problem uses a related EVD — never a second loading/error message. */
function SrcInvestigation({ state, lookup, onViewAsProblem }: { state: RelationsState; lookup: Map<string, RecordSummary>; onViewAsProblem: (id: string) => void }) {
  if (state.status !== "ready" || state.relations.relatedProblems.length === 0) return null;
  return (
    <SrcSection id="src-investigation" label="Na investigação" note="Problemas que esta fonte informa">
      <ul className="src-problem-list">
        {state.relations.relatedProblems.map((problem) => (
          <li key={problem.problemId} className="src-problem">
            <RecordIdentifier variant="action" density="compact" id={problem.problemId} onActivate={() => onViewAsProblem(problem.problemId)} accessibleLabel={`Ver problema ${problem.problemId}`} />
            <button type="button" className="src-problem-title" onClick={() => onViewAsProblem(problem.problemId)}>{problemTopicLabel(problem.problemId, state.relations, lookup)}</button>
            <p className="src-problem-via">através de <span className="src-problem-via-ids">{problem.viaEvidenceIds.join(", ")}</span></p>
          </li>
        ))}
      </ul>
    </SrcSection>
  );
}

function SrcCaveats({ record }: { record: Record<string, unknown> }) {
  const caveats = extractSourceCaveats(record);
  if (!caveats) return null;
  return (
    <SrcSection id="src-caveats" label="Limitações" note={plural(caveats.length, "limite registado", "limites registados")} tone="accent">
      <ol className="src-limit-list">
        {caveats.map((caveat, index) => (
          <li key={`${index}-${caveat}`} className="src-limit">
            <span className="src-limit-index">Limite {index + 1}</span>
            <p>{caveat}</p>
          </li>
        ))}
      </ol>
    </SrcSection>
  );
}

function SrcTopics({ record }: { record: Record<string, unknown> }) {
  const domains = extractSourceCoverage(record).domains;
  if (!domains) return null;
  return (
    <SrcSection id="src-topics" label="Temas">
      <ul className="src-topic-list">{domains.map((domain) => <li key={domain}>{describeTopic(domain).label}</li>)}</ul>
    </SrcSection>
  );
}

const CONSULT_HEADINGS: Record<string, string> = {
  document: "Consultar o documento",
  webpage: "Consultar a página",
  dataset: "Consultar os dados",
  database: "Consultar a base de dados",
  service: "Consultar o serviço",
};

const AVAILABLE_FOR: Record<string, string> = {
  browser: "consulta no navegador",
  download: "transferência",
  api: "consulta por API",
  feed: "subscrição",
  gis_service: "consulta num serviço GIS",
  direct: "acesso direto",
};

const ACCESS_LEVEL_PHRASES: Record<string, string> = {
  public: "A fonte é pública",
  restricted: "A fonte tem acesso restrito",
  private: "A fonte é privada",
};

const REUSE_SENTENCES: Record<string, string> = {
  permitted: "A reutilização do conteúdo é permitida.",
  restricted: "A reutilização do conteúdo é restrita.",
  prohibited: "A reutilização do conteúdo é proibida.",
};

/** Access sentence from `access.level` / `access.availability` / `access.method` only; unknown stays unknown. */
function accessSentence(level: string | null, availability: string | null, method: string | null): string {
  const lead = (level && ACCESS_LEVEL_PHRASES[level]) ?? "O nível de acesso à fonte é desconhecido";
  if (availability === "available") return `${lead} e está disponível${method && AVAILABLE_FOR[method] ? ` para ${AVAILABLE_FOR[method]}` : ""}.`;
  if (availability === "unavailable") return `${lead}, mas está indisponível.`;
  return `${lead}; a sua disponibilidade é desconhecida.`;
}

/** Reuse sentence from `licensing.reuse`; an unknown value is never presented as a publisher declaration. */
function reuseSentence(reuse: string | null): string {
  return (reuse && REUSE_SENTENCES[reuse]) ?? "Os direitos de reutilização não são conhecidos.";
}

function machineReadablePhrase(value: boolean | "unknown" | null): string | null {
  if (value === true) return "com leitura automática";
  if (value === false) return "sem leitura automática";
  return value === "unknown" ? "leitura automática desconhecida" : null;
}

function SrcDatesAccess({ record, originalUrl }: { record: Record<string, unknown>; originalUrl: string | null }) {
  const facts = extractSourceDatesAccess(record);
  const availability = [
    facts.accessAvailability && publicEnumLabel("access.availability", facts.accessAvailability),
    facts.accessLevel && publicEnumLabel("access.level", facts.accessLevel),
  ].filter(Boolean).join(" · ");
  const consult = [
    facts.accessMethod && publicEnumLabel("access.method", facts.accessMethod),
    facts.accessFormat && publicEnumLabel("access.format", facts.accessFormat),
    machineReadablePhrase(facts.accessMachineReadable),
  ].filter(Boolean).join(" · ");
  const reference = facts.canonicalReference;
  const rows: { key: string; label: string; value: ReactNode }[] = [
    { key: "published", label: "Publicação", value: facts.publishedAt && formatPublicPartialDate(facts.publishedAt) },
    { key: "updated", label: "Atualização da fonte", value: facts.updatedAt && formatPublicPartialDate(facts.updatedAt) },
    { key: "checked", label: "Última verificação", value: facts.lastCheckedAt && formatPublicPartialDate(facts.lastCheckedAt) },
    { key: "frequency", label: "Frequência", value: facts.updateFrequency && publicEnumLabel("temporal.update_frequency", facts.updateFrequency) },
    { key: "availability", label: "Disponibilidade", value: availability || null },
    { key: "consult", label: "Consulta", value: consult || null },
    {
      key: "address",
      label: "Endereço",
      value: reference && (isHttpUrl(reference)
        ? <a href={reference} target="_blank" rel="noopener noreferrer" className="src-audit-address">{displayAddress(reference)}</a>
        : <span className="src-audit-address">{reference}</span>),
    },
  ].filter((row) => row.value);
  return (
    <div className="src-audit-row">
      <div>
        <h4>Datas e acesso</h4>
        <dl className="src-audit-facts">
          {rows.map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
        </dl>
      </div>
      {originalUrl && <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="src-audit-secondary-cta">Abrir fonte <span aria-hidden="true">↗</span></a>}
    </div>
  );
}

function SrcLicensing({ record, readable }: { record: Record<string, unknown>; readable: boolean }) {
  const licensing = extractSourceLicensing(record);
  const lead = licensing.status === "known" ? (licensing.licence ? `${licensing.licence}.` : "Licença conhecida.") : "Estado desconhecido.";
  const reuse = licensing.reuse && REUSE_SENTENCES[licensing.reuse]
    ? REUSE_SENTENCES[licensing.reuse]
    : readable
      ? "Pode ser lida e citada; a reutilização do conteúdo requer confirmação junto do editor."
      : "A reutilização do conteúdo requer confirmação junto do editor.";
  return (
    <div className="src-audit-row">
      <div>
        <h4>Licenciamento</h4>
        <p><strong>{lead}</strong> {reuse}{licensing.attribution && ` Atribuição: ${licensing.attribution}`}</p>
      </div>
      <a href="/methodology" className="src-audit-method-link">Ler o método →</a>
    </div>
  );
}

function SrcAudit({ detail, originalUrl }: { detail: RecordDetail; originalUrl: string | null }) {
  const record = detail.record;
  const facts = extractSourceDatesAccess(record);
  const resourceType = extractSourceOverview(record).resourceType;
  const fileName = detail.file.split("/").at(-1) || `${detail.id}.yaml`;
  return (
    <section id={SRC_AUDIT_ANCHOR_ID} aria-labelledby="src-audit-label" className="src-audit src-section">
      <div className="shell-frame shell-frame--wide src-audit-frame">
        <div className="src-section-intro">
          <h2 id="src-audit-label" className="src-section-label">Acesso e auditoria</h2>
        </div>
        <div className="src-section-body">
          <div className="src-audit-lede">
            <h3 className="src-audit-heading">{(resourceType && CONSULT_HEADINGS[resourceType]) ?? "Consultar a fonte"}</h3>
            <p className="src-audit-intro">
              {accessSentence(facts.accessLevel, facts.accessAvailability, facts.accessMethod)} {reuseSentence(extractSourceLicensing(record).reuse)}
            </p>
          </div>

          <SrcDatesAccess record={record} originalUrl={originalUrl} />
          <SrcLicensing record={record} readable={facts.accessLevel === "public" && facts.accessAvailability === "available"} />

          <div className="src-audit-row src-audit-row--canonical">
            <div>
              <h4>Registo canónico</h4>
              <p className="src-audit-canonical-meta"><code>{detail.file}</code></p>
            </div>
            <a href={canonicalFileUrl(detail.file)} download={fileName} className="src-audit-primary-cta">
              <span aria-hidden="true">↓</span>Descarregar YAML
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SrcDetail({ detail, lookup, relations, onSelect, onViewAsProblem, onBackToRecords }: {
  detail: RecordDetail;
  lookup: Map<string, RecordSummary>;
  relations: RelationsState;
  onSelect: (id: string) => void;
  onViewAsProblem: (id: string) => void;
  onBackToRecords: () => void;
}) {
  const name = text(detail.record.name) ?? detail.id;
  const originalUrl = publicSourceReferenceUrl(detail.record);
  return (
    <article className="src-detail-view" aria-labelledby="src-title">
      <SrcLocalHeader detail={detail} originalUrl={originalUrl} onBackToRecords={onBackToRecords} />
      <div className="shell-frame shell-frame--wide">
        <SrcHero record={detail.record} name={name} summary={heroSummary(relations, lookup)} />
      </div>
      <SrcMetadataStrip record={detail.record} relations={relations} />
      <div className="shell-frame shell-frame--wide src-body">
        <SrcFindings state={relations} sourceId={detail.id} onSelect={onSelect} onViewAsProblem={onViewAsProblem} />
        <SrcInvestigation state={relations} lookup={lookup} onViewAsProblem={onViewAsProblem} />
        <SrcCaveats record={detail.record} />
        <SrcTopics record={detail.record} />
      </div>
      <SrcAudit detail={detail} originalUrl={originalUrl} />
    </article>
  );
}
