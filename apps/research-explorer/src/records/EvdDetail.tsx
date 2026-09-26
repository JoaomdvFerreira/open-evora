import type { ReactNode } from "react";
import type { RecordDetail, RecordSummary } from "../dataProvider/types";
import { canonicalFileUrl } from "../dataProvider/StaticDataProvider";
import { formatPublicCompactDate, formatPublicCount, formatPublicDate, formatPublicPartialDate, publicEnumExplanation, publicEnumLabel } from "../presentation/presentation";
import { describeTopic } from "../presentation/topicMapping";
import { Breadcrumb } from "../presentation/Breadcrumb";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { EmptyState } from "../presentation/EmptyState";
import { ShareAction } from "../problem/ShareAction";
import { RecordIdentifier } from "./RecordIdentifier";
import { EvidenceEffectTag } from "./EvidenceEffectTag";
import { ResearchRoleTag } from "./ResearchRoleTag";
import type { EVDProblemUsesState } from "./useEvdProblemUses";
import type { EVDProblemUse } from "./evdRelations";

/**
 * Public EVD Record Detail: the editorial reading and verification page for
 * one Evidence record. Every value is read from the canonical record, the
 * record index (`lookup`, for Source titles) or the one EVD → PRB relation
 * state (`problemUses`, `loadEvdProblemUses`) — which is also the sole
 * authority for the "Problemas" count, so the metadata strip and "Como é
 * usada" can never disagree. Styles: styles/evd-detail.css.
 */

/** Stable in-page anchor targeted by "Verificar". */
export const EVD_AUDIT_ANCHOR_ID = "evd-auditoria";

type ProblemUsesState = EVDProblemUsesState & { retry: () => void };

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
  if (start && end) return `${formatPublicPartialDate(start)}–${formatPublicPartialDate(end)}`;
  return temporal.status === "unknown" ? "Desconhecido" : null;
}

/** Distinct Problems among the ready EVD → PRB uses (one PRB may use the same EVD more than once). */
function problemIds(uses: EVDProblemUse[]): string[] {
  return [...new Set(uses.map((use) => use.detail.id))];
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatPublicCount(count)} ${count === 1 ? singular : pluralForm}`;
}

function EvdLocalHeader({ detail, title, onBackToRecords }: { detail: RecordDetail; title: string; onBackToRecords: () => void }) {
  return (
    <div className="evd-header-band">
      <div className="shell-frame shell-frame--wide">
        <div className="evd-header">
          <Breadcrumb
            label="Localização"
            ancestors={[{ key: "registos", action: <button type="button" className="evd-breadcrumb-ancestor" onClick={onBackToRecords}>Registos</button> }]}
            current={<RecordIdentifier variant="text" density="compact" id={detail.id} />}
          />
          <div className="evd-header-utilities">
            <a href={`#${EVD_AUDIT_ANCHOR_ID}`} className="evd-header-utility" aria-label="Verificar este registo">
              <span aria-hidden="true" className="evd-header-utility-icon">↓</span>
              <span className="evd-header-utility-label">Verificar</span>
            </a>
            <ShareAction title={title} icon="↗" accessibleLabel="Partilhar este registo" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EvdHero({ record, summary }: { record: Record<string, unknown>; summary: string }) {
  const domains = strings(record.domains);
  const extractedAt = text(objectValue(record.provenance)?.extracted_at);
  return (
    <header className="evd-hero">
      <div className="evd-hero-eyebrow-row">
        <span className="evd-hero-eyebrow"><span className="evd-hero-eyebrow-mark" aria-hidden="true" />Registo de evidência</span>
        {domains.length > 0 && (
          <span className="evd-hero-topics" aria-label="Temas">
            {domains.map((domain, index) => (
              <span key={domain} className="evd-hero-topic-item">
                {index > 0 && <span aria-hidden="true" className="evd-hero-topic-sep">·</span>}
                <span className="evd-hero-topic">{describeTopic(domain).label}</span>
              </span>
            ))}
          </span>
        )}
      </div>
      {extractedAt && <p className="evd-hero-extracted">Extraída em <time dateTime={extractedAt}>{formatPublicCompactDate(extractedAt)}</time></p>}
      <h1 id="evd-title" className="evd-hero-title">{summary}</h1>
    </header>
  );
}

function problemCountValue(state: ProblemUsesState) {
  if (state.status === "ready") return formatPublicCount(problemIds(state.uses).length);
  if (state.status === "error") return "Indisponível";
  return <span aria-label="A carregar">…</span>;
}

/**
 * Six public facts in one fixed cell set, so every breakpoint's grid keeps
 * its shape; an absent optional value reads "Não registado" rather than
 * disappearing or being inferred. The CLASSIFICAÇÃO / ÂMBITO / USO group row
 * is presentation-only (aria-hidden): the facts' own labels carry meaning.
 */
function EvdMetadataStrip({ record, problemUses }: { record: Record<string, unknown>; problemUses: ProblemUsesState }) {
  const scope = objectValue(record.scope); const geography = objectValue(scope?.geography);
  const nature = text(record.evidence_nature); const authority = text(record.claim_authority);
  const domains = strings(record.domains);
  const cells: { key: string; label: string; value: ReactNode }[] = [
    { key: "nature", label: "Natureza", value: nature && publicEnumLabel("evidence_nature", nature) },
    { key: "authority", label: "Autoridade", value: authority && publicEnumLabel("claim_authority", authority) },
    { key: "where", label: "Onde", value: text(geography?.area) ?? (text(geography?.level) && publicEnumLabel("scope.geography.level", text(geography?.level)!)) },
    { key: "when", label: "Quando", value: temporalLabel(objectValue(scope?.temporal)) },
    { key: "topic", label: domains.length > 1 ? "Temas" : "Tema", value: domains.length > 0 ? domains.map((domain) => describeTopic(domain).label).join(" · ") : null },
    { key: "problems", label: "Problemas", value: problemCountValue(problemUses) },
  ];
  return (
    <section className="evd-meta" aria-label="Classificação e âmbito">
      <div className="shell-frame shell-frame--wide evd-meta-groups" aria-hidden="true">
        <span className="evd-meta-group evd-meta-group--classification">Classificação</span>
        <span className="evd-meta-group evd-meta-group--scope">Âmbito</span>
        <span className="evd-meta-group evd-meta-group--use">Uso</span>
      </div>
      <div className="evd-meta-band">
        <dl className="shell-frame shell-frame--wide evd-meta-grid">
          {cells.map((cell) => (
            <div key={cell.key} className={`evd-meta-cell evd-meta-cell--${cell.key}`}>
              <dt>{cell.label}</dt>
              <dd>{cell.value ?? <span className="evd-meta-empty">Não registado</span>}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function EvdSection({ id, label, note, tone, children }: { id: string; label: string; note?: string | null; tone?: "accent"; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-label`} className={`evd-section${tone ? ` evd-section--${tone}` : ""}`}>
      <div className="evd-section-intro">
        <h2 id={`${id}-label`} className="evd-section-label">{label}</h2>
        {note && <p className="evd-section-note">{note}</p>}
      </div>
      <div className="evd-section-body">{children}</div>
    </section>
  );
}

function EvdPopulation({ record }: { record: Record<string, unknown> }) {
  const populations = strings(objectValue(record.scope)?.populations);
  if (populations.length === 0) return null;
  return (
    <EvdSection id="evd-population" label="A quem se refere" note="População abrangida pela afirmação">
      <ul className="evd-population-list">{populations.map((population) => <li key={population}>{population}</li>)}</ul>
    </EvdSection>
  );
}

function EvdLimits({ record }: { record: Record<string, unknown> }) {
  const limits = strings(record.inference_limits);
  if (limits.length === 0) return null;
  return (
    <EvdSection id="evd-limits" label="O que não permite concluir" note={plural(limits.length, "limite explícito", "limites explícitos")} tone="accent">
      <ol className="evd-limit-list">
        {limits.map((limit, index) => (
          <li key={`${index}-${limit}`} className="evd-limit">
            <span className="evd-limit-index">Limite {index + 1}</span>
            <p>{limit}</p>
          </li>
        ))}
      </ol>
    </EvdSection>
  );
}

function effectTone(effect: string): string {
  return ["SUPPORTS", "REFINES", "BOUNDS"].includes(effect) ? effect.toLowerCase() : "neutral";
}

function EvdUse({ use, onViewAsProblem }: { use: EVDProblemUse; onViewAsProblem: (id: string) => void }) {
  const title = text(use.detail.record.title) ?? use.detail.id;
  return (
    <li className="evd-use">
      <RecordIdentifier variant="action" density="compact" id={use.detail.id} onActivate={() => onViewAsProblem(use.detail.id)} accessibleLabel={`Ver problema ${use.detail.id}`} />
      <button type="button" className="evd-use-title" onClick={() => onViewAsProblem(use.detail.id)}>{title}</button>
      <dl className="evd-use-facts">
        <div>
          <dt>Efeito</dt>
          <dd>{use.effects.map((effect, index) => (
            <span key={`${effect}-${index}`} className={`evd-effect evd-effect--${effectTone(effect)}`}>
              <span className="evd-effect-marker" aria-hidden="true" />
              <EvidenceEffectTag effect={effect} variant="compact" />
            </span>
          ))}</dd>
        </div>
        <div>
          <dt>Papel</dt>
          <dd>{use.researchRoles.map((role, index) => <ResearchRoleTag key={`${role}-${index}`} role={role} variant="compact" />)}</dd>
        </div>
      </dl>
    </li>
  );
}

function usesNote(state: ProblemUsesState): string | null {
  if (state.status !== "ready" || state.uses.length === 0) return null;
  const problems = [...new Map(state.uses.map((use) => [use.detail.id, use.detail])).values()];
  // "em investigação" only when every related Problem is canonically OPEN — never implied for a closed one.
  const allOpen = problems.every((problem) => problem.record.status === "OPEN");
  return `${plural(problems.length, "problema", "problemas")}${allOpen ? " em investigação" : ""}`;
}

function EvdUses({ state, onViewAsProblem }: { state: ProblemUsesState; onViewAsProblem: (id: string) => void }) {
  return (
    <EvdSection id="evd-investigation" label="Como é usada" note={usesNote(state)}>
      {state.status === "loading" || state.status === "idle" ? (
        <ProgressMessage message="A carregar usos nos Problemas…" />
      ) : state.status === "error" ? (
        <ErrorNotice title="Não foi possível carregar os usos desta evidência nos Problemas." message="" action={<button type="button" onClick={state.retry}>Tentar novamente</button>} />
      ) : state.uses.length === 0 ? (
        <EmptyState message="Esta evidência ainda não está ligada explicitamente a um Problema." />
      ) : (
        <ul className="evd-use-list">{state.uses.map((use) => <EvdUse key={`${use.detail.id}-${use.relationshipPath}`} use={use} onViewAsProblem={onViewAsProblem} />)}</ul>
      )}
    </EvdSection>
  );
}

function ClassificationTerm({ field, value }: { field: string; value: string }) {
  const explanation = publicEnumExplanation(field, value);
  return <span className="evd-audit-term"><strong>{publicEnumLabel(field, value)}</strong>{explanation ? ` — ${explanation}` : null}</span>;
}

/**
 * Source number and "pública" follow the cited Sources' own indexed
 * `access.level`; a Source not known to be public is never called public.
 */
function auditIntro(sourceIds: string[], lookup: Map<string, RecordSummary>): string {
  const plural = sourceIds.length > 1;
  const allPublic = sourceIds.length > 0 && sourceIds.every((id) => lookup.get(id)?.summaryFields["access.level"] === "public");
  const origin = plural ? (allPublic ? "de fontes públicas" : "das fontes indicadas") : allPublic ? "de uma fonte pública" : "da fonte indicada";
  return `Este registo foi extraído ${origin} e classificado segundo o método da Open Évora. Pode consultar ${plural ? "as fontes" : "a fonte"} e descarregar a versão canónica.`;
}

function EvdAudit({ detail, lookup, onSelect }: { detail: RecordDetail; lookup: Map<string, RecordSummary>; onSelect: (id: string) => void }) {
  const record = detail.record;
  const provenance = objectValue(record.provenance);
  const sourceIds = strings(provenance?.sources);
  const extractedAt = text(provenance?.extracted_at);
  const nature = text(record.evidence_nature); const authority = text(record.claim_authority);
  const lineageId = text(record.lineage_id);
  const fileName = detail.file.split("/").at(-1) || `${detail.id}.yaml`;
  return (
    <section id={EVD_AUDIT_ANCHOR_ID} aria-labelledby="evd-audit-label" className="evd-audit evd-section">
      <div className="shell-frame shell-frame--wide evd-audit-frame">
        <div className="evd-section-intro">
          <h2 id="evd-audit-label" className="evd-section-label">Origem e auditoria</h2>
        </div>
        <div className="evd-section-body">
          <div className="evd-audit-lede">
            <h3 className="evd-audit-heading">Verificar este registo</h3>
            <p className="evd-audit-intro">{auditIntro(sourceIds, lookup)}</p>
          </div>

          <ul className="evd-audit-sources" aria-label="Fontes">
            {sourceIds.map((id) => {
              const title = lookup.get(id)?.label;
              return (
                <li key={id} className="evd-audit-row">
                  <div>
                    <p className="evd-audit-source-id"><RecordIdentifier variant="text" density="compact" id={id} /></p>
                    {title && <h4>{title}</h4>}
                    {extractedAt && <p>Extraída pela Open Évora em <time dateTime={extractedAt}>{formatPublicDate(extractedAt)}</time></p>}
                  </div>
                  <button type="button" className="evd-audit-secondary-cta" onClick={() => onSelect(id)} aria-label={`Abrir fonte ${id}`}>Abrir fonte</button>
                </li>
              );
            })}
          </ul>

          <div className="evd-audit-row">
            <div>
              <h4>Como classificamos</h4>
              {(nature || authority) && (
                <p>
                  {nature && <ClassificationTerm field="evidence_nature" value={nature} />}
                  {nature && authority && " "}
                  {authority && <ClassificationTerm field="claim_authority" value={authority} />}
                </p>
              )}
            </div>
            <a href="/methodology" className="evd-audit-method-link">Ler o método →</a>
          </div>

          <div className="evd-audit-row evd-audit-row--canonical">
            <div>
              <h4>Registo canónico</h4>
              <p className="evd-audit-canonical-meta">
                <code>{detail.file}</code>
                {lineageId && <span>linhagem <code>{lineageId}</code></span>}
              </p>
            </div>
            <a href={canonicalFileUrl(detail.file)} download={fileName} className="evd-audit-primary-cta">
              <span aria-hidden="true">↓</span>Descarregar YAML
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function EvdDetail({ detail, lookup, problemUses, onSelect, onViewAsProblem, onBackToRecords }: {
  detail: RecordDetail;
  lookup: Map<string, RecordSummary>;
  problemUses: ProblemUsesState;
  onSelect: (id: string) => void;
  onViewAsProblem: (id: string) => void;
  onBackToRecords: () => void;
}) {
  const summary = text(objectValue(detail.record.observation)?.summary) ?? detail.id;
  return (
    <article className="evd-detail-view" aria-labelledby="evd-title">
      <EvdLocalHeader detail={detail} title={summary} onBackToRecords={onBackToRecords} />
      <div className="shell-frame shell-frame--wide">
        <EvdHero record={detail.record} summary={summary} />
      </div>
      <EvdMetadataStrip record={detail.record} problemUses={problemUses} />
      <div className="shell-frame shell-frame--wide evd-body">
        <EvdPopulation record={detail.record} />
        <EvdLimits record={detail.record} />
        <EvdUses state={problemUses} onViewAsProblem={onViewAsProblem} />
      </div>
      <EvdAudit detail={detail} lookup={lookup} onSelect={onSelect} />
    </article>
  );
}
