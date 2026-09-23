import type { ReactNode } from "react";
import { EvidenceEffectTag } from "../records/EvidenceEffectTag";
import { ResearchRoleTag } from "../records/ResearchRoleTag";
import { RecordIdentifier } from "../records/RecordIdentifier";
import { Breadcrumb } from "../presentation/Breadcrumb";
import { describeTopic } from "../presentation/topicMapping";
import { lifecycleVisual, validationVisual, evidenceVisual } from "./stateVisuals";
import { ShareAction } from "./ShareAction";
import { formatPublicCount, formatPublicDate, publicCompactEnumLabel, publicEnumLabel } from "../presentation/presentation";
import type { PrbDetailsData, PrbEvidenceRelationship, PrbOpenQuestion, PrbPathStage } from "./prbDetailsProjection";

/**
 * PD-02A.2 — generic public PRB Details full-page composition.
 *
 * Approved visual reference: docs/design/reference/prb-details/ (README is
 * the authority contract). This design applies to every canonical PRB, not
 * specifically PRB-0005 — PRB-0005 is only the representative Storybook
 * fixture (PrbDetailsPresentation.stories.tsx). No PRB-0005-specific logic
 * lives here: every section is schema-driven from PrbDetailsData
 * (prbDetailsProjection.ts) and omits itself when its canonical field is
 * absent, exactly like ProblemView.tsx's established convention.
 *
 * This view intentionally does not reuse ProblemView.tsx's legacy 720+rail
 * presentation architecture (ContextTabs three-tab row, right-side reading
 * rail/CompactSectionIndex "Nesta página"). The approved reference is a wide
 * editorial composition with its own local header (breadcrumb + grouped
 * Detalhes|Histórico selector + Verificar/Partilhar utilities) and a
 * left-label/broad-content section rhythm at desktop widths — see the
 * `.prb-*` classes in styles/prb-details.css, which own this view's own
 * geometry rather than `.lyt-reading`/`.context-tabs`.
 *
 * This component is a pure presentation layer — it receives already-resolved
 * plain data and issues no data fetches of its own, mirroring
 * OverviewPresentation.tsx's split from its data-wiring counterpart.
 */
export interface PrbDetailsPresentationProps {
  data: PrbDetailsData;
  /** "O que sabemos até agora" statements, already resolved to observation text + relationship tags + source publishers. */
  knownEvidence: PrbEvidenceRelationship[];
  onOpenGeneric: (id: string) => void;
  onBackToOverview: () => void;
  onViewHistory: (id: string) => void;
}

/**
 * Local PRB header: breadcrumb (Visão geral › PRB-xxxx) + grouped
 * Detalhes|Histórico selector + Verificar/Partilhar utilities. There is no
 * public "Problema" tab in this architecture — Detalhes is this view itself,
 * Histórico routes to ProblemHistoryView via `onViewHistory`. "Verificar"
 * jumps to the audit section already on this page; "Partilhar" reuses the
 * existing ShareAction behaviour (Web Share API / copy-link fallback).
 */
function PrbHeader({ data, onBackToOverview, onViewHistory }: { data: PrbDetailsData; onBackToOverview: () => void; onViewHistory: (id: string) => void }) {
  return (
    <div className="prb-header">
      <Breadcrumb
        label="Localização"
        ancestors={[
          {
            key: "visao-geral",
            action: (
              <button type="button" onClick={onBackToOverview}>
                Visão geral
              </button>
            ),
          },
        ]}
        current={<RecordIdentifier variant="text" density="compact" id={data.problemId} />}
      />
      <div role="tablist" aria-label="Vistas do problema" className="prb-view-selector">
        <span role="tab" aria-selected="true" className="prb-view-selector-item prb-view-selector-item--active">
          Detalhes
        </span>
        <button type="button" role="tab" aria-selected="false" className="prb-view-selector-item" onClick={() => onViewHistory(data.problemId)}>
          Histórico
        </button>
      </div>
      <div className="prb-header-utilities">
        <a href="#prb-auditoria" className="prb-header-utility">
          Verificar
        </a>
        <ShareAction title={data.title} />
      </div>
    </div>
  );
}

function PrbIdentityHeader({ data }: { data: PrbDetailsData }) {
  return (
    <header className="prb-identity">
      <div className="prb-identity-eyebrow-row">
        <span className="prb-identity-eyebrow">
          <span className="prb-identity-eyebrow-dot" aria-hidden="true" />
          Problema em investigação
        </span>
        {data.topics.length > 0 && (
          <span className="prb-identity-topics" aria-label="Temas">
            {data.topics.map((topic, index) => (
              <span key={topic} className="prb-identity-topic-item">
                {index > 0 && (
                  <span aria-hidden="true" className="prb-identity-topic-sep">
                    ·
                  </span>
                )}
                <span className="prb-identity-topic-link">
                  {describeTopic(topic).label}
                </span>
              </span>
            ))}
          </span>
        )}
        {data.updatedAt && (
          <span className="prb-identity-updated">
            Atualizado em <time dateTime={data.updatedAt}>{formatPublicDate(data.updatedAt)}</time>
          </span>
        )}
      </div>
      <h1 id="prb-identity-title" className="prb-identity-title">
        {data.title}
      </h1>
      {data.statement && <p className="prb-identity-statement">{data.statement}</p>}
    </header>
  );
}

/** One "Estado da investigação" / "Âmbito" dimension value — plain text, coloured by semantic tone only where the reference does (never a chip/pill control). Uses the same compact PT-PT label set as the field's own inline-chip form (statusGloss.ts/presentation.ts), matching the terse reference copy ("Identificada", "Por validar"). */
function PrbStateValue({ field, value }: { field: "status" | "validation_status" | "evidence_status"; value: string }) {
  const label = field === "status" ? publicEnumLabel(field, value) : publicCompactEnumLabel(field, value);
  const visual = field === "status" ? lifecycleVisual(value) : field === "validation_status" ? validationVisual(value) : evidenceVisual(value);
  const accent = visual.tone === "open" || visual.tone === "partial";
  return <dd className={accent ? "prb-state-value prb-state-value--accent" : "prb-state-value"}>{label}</dd>;
}

/** Investigation-state + scope full-width flat band — plain caption/value pairs and plain count metrics, not chip-like status controls. All values come directly from canonical fields; no derived posture. */
function PrbInvestigationStateSection({ data }: { data: PrbDetailsData }) {
  return (
    <section id="prb-estado" aria-labelledby="prb-estado-heading" className="prb-state-scope-band">
      <div className="shell-frame shell-frame--wide prb-state-scope-row">
        <div className="prb-state-block">
          <h2 id="prb-estado-heading" className="detail-panel-label">
            Estado da investigação
          </h2>
          <dl className="prb-state-grid">
            {data.status && (
              <div className="prb-state-item">
                <dt>Estado</dt>
                <PrbStateValue field="status" value={data.status} />
              </div>
            )}
            {data.evidenceStatus && (
              <div className="prb-state-item">
                <dt>Evidência</dt>
                <PrbStateValue field="evidence_status" value={data.evidenceStatus} />
              </div>
            )}
            {data.validationStatus && (
              <div className="prb-state-item">
                <dt>Validação</dt>
                <PrbStateValue field="validation_status" value={data.validationStatus} />
              </div>
            )}
          </dl>
        </div>
        <div className="prb-scope-block">
          <h2 className="detail-panel-label">Âmbito</h2>
          <div className="prb-scope-metrics">
            <a href="#prb-questoes" className="prb-scope-metric">
              <span className="prb-scope-metric-value">{formatPublicCount(data.openQuestionCount)}</span>
              <span className="prb-scope-metric-label">{data.openQuestionCount === 1 ? "questão aberta" : "questões abertas"}</span>
            </a>
            <a href="#prb-auditoria" className="prb-scope-metric">
              <span className="prb-scope-metric-value">{formatPublicCount(data.evidenceRecordCount)}</span>
              <span className="prb-scope-metric-label">{data.evidenceRecordCount === 1 ? "registo" : "registos"}</span>
            </a>
            <a href="#prb-auditoria" className="prb-scope-metric">
              <span className="prb-scope-metric-value">{formatPublicCount(data.evidenceEffectCount)}</span>
              <span className="prb-scope-metric-label">{data.evidenceEffectCount === 1 ? "efeito" : "efeitos"}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Shared "left editorial label + broad content" section frame. At
 * 1440/1024/768 the label sits in a left column; at 360 it moves into normal
 * content flow (styles/prb-details.css). `bleed` wraps the inner frame in
 * `.shell-frame--wide` for a section that is its own full-bleed band
 * (Percurso/Auditoria); sections that already sit inside a caller-supplied
 * wide frame (O que sabemos/O que ainda não sabemos) leave it unset.
 */
function PrbSection({
  id,
  label,
  note,
  children,
  className,
  bleed,
}: {
  id: string;
  label: string;
  note?: string;
  children: ReactNode;
  className?: string;
  bleed?: boolean;
}) {
  const frame = (
    <div className={bleed ? "shell-frame shell-frame--wide prb-section-frame" : "prb-section-frame"}>
      <div className="prb-section-intro">
        <h2 id={`${id}-heading`} className="detail-panel-label">
          {label}
        </h2>
        {note && <p className="prb-section-intro-note">{note}</p>}
      </div>
      <div className="prb-section-content">{children}</div>
    </div>
  );
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={className ? `prb-section ${className}` : "prb-section"}>
      {frame}
    </section>
  );
}

/** "O que sabemos até agora" — one authored observation statement per evidence item, each linked to its evidence record and relationship metadata. Content and count come entirely from `knownEvidence`; this component owns no selection policy — the caller decides which/how many items to pass (PRB-0005 Storybook fixture: a caller-chosen subset). If `knownEvidence` is empty, this section renders nothing — absence of an editorial selection does not mean the PRB has no evidence, so no "Nenhuma evidência associada" fallback is ever shown. */
function PrbKnownEvidenceSection({
  knownEvidence,
  onOpenGeneric,
}: {
  knownEvidence: PrbEvidenceRelationship[];
  onOpenGeneric: (id: string) => void;
}) {
  if (knownEvidence.length === 0) return null;
  return (
    <PrbSection
      id="prb-sabemos"
      label="O que sabemos até agora"
      note={`${formatPublicCount(knownEvidence.length)} ${knownEvidence.length === 1 ? "afirmação" : "afirmações"}, cada uma ligada a um registo de evidência`}
    >
      <ul className="prb-known-evidence-list">
        {knownEvidence.map((item) => (
          <li key={item.evidenceId} className="prb-known-evidence-item">
            {item.observationSummary && <p className="prb-known-evidence-statement">{item.observationSummary}</p>}
            <EvidenceRelationshipMetaAction item={item} onOpenGeneric={onOpenGeneric} />
          </li>
        ))}
      </ul>
    </PrbSection>
  );
}

function EvidenceRelationshipMetaAction({ item, onOpenGeneric }: { item: PrbEvidenceRelationship; onOpenGeneric: (id: string) => void }) {
  return (
    <div className="prb-evidence-meta">
      {item.effects.length > 0 && (
        <span className="prb-evidence-meta-group">
          <span className="prb-evidence-meta-caption">{item.effects.length === 1 ? "Efeito" : "Efeitos"}</span>
          <span className="prb-evidence-meta-values">
            {item.effects.map((effect, index) => (
              <EvidenceEffectTag key={`${effect}-${index}`} effect={effect} variant="compact" />
            ))}
          </span>
        </span>
      )}
      {item.sourcePublishers.length > 0 && (
        <span className="prb-evidence-meta-group">
          <span className="prb-evidence-meta-caption">{item.sourcePublishers.length === 1 ? "Fonte" : "Fontes"}</span>
          <span className="prb-evidence-meta-values">{item.sourcePublishers.join(" · ")}</span>
        </span>
      )}
      {item.researchRoles.length > 0 && (
        <span className="prb-evidence-meta-group">
          <span className="prb-evidence-meta-caption">{item.researchRoles.length === 1 ? "Papel" : "Papéis"}</span>
          <span className="prb-evidence-meta-values">
            {item.researchRoles.map((role, index) => (
              <ResearchRoleTag key={`${role}-${index}`} role={role} variant="compact" />
            ))}
          </span>
        </span>
      )}
      <RecordIdentifier variant="action" id={item.evidenceId} density="compact" onActivate={() => onOpenGeneric(item.evidenceId)} accessibleLabel={`Abrir ${item.evidenceId}`} />
    </div>
  );
}

/**
 * One `investigation.open_questions[]` item. `current_action` is rendered as
 * authored free text only, exactly as stored — never parsed for a leading
 * "WATCH —"/"STOP —" keyword and never replaced with the approved HTML
 * reference's illustrative "Acompanhar" label, which has no canonical
 * counterpart for every question.
 */
function OpenQuestionItem({ index, item, onOpenGeneric }: { index: number; item: PrbOpenQuestion; onOpenGeneric: (id: string) => void }) {
  return (
    <li className="prb-open-question-item">
      <div className="prb-open-question-index">Questão {index + 1}</div>
      <p className="prb-open-question-text">{item.question}</p>
      <div className="prb-open-question-grid">
        {item.whatWeUnderstand && (
          <div className="prb-open-question-field">
            <h3>O que entendemos</h3>
            <p>{item.whatWeUnderstand}</p>
          </div>
        )}
        {item.currentAction && (
          <div className="prb-open-question-field">
            <h3>Ação atual</h3>
            <p>{item.currentAction}</p>
          </div>
        )}
        {item.relatedEvidenceIds.length > 0 && (
          <div className="prb-open-question-field">
            <h3>Evidência relacionada</h3>
            <ul className="prb-open-question-evidence-refs">
              {item.relatedEvidenceIds.map((id) => (
                <li key={id}>
                  <RecordIdentifier variant="action" id={id} density="compact" onActivate={() => onOpenGeneric(id)} accessibleLabel={`Abrir ${id}`} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
}

function PrbOpenQuestionsSection({ questions, onOpenGeneric }: { questions: PrbOpenQuestion[]; onOpenGeneric: (id: string) => void }) {
  if (questions.length === 0) return null;
  return (
    <PrbSection
      id="prb-questoes"
      label="O que ainda não sabemos"
      note={`${formatPublicCount(questions.length)} ${questions.length === 1 ? "questão em acompanhamento" : "questões em acompanhamento"}`}
    >
      <ul className="prb-open-question-list">
        {questions.map((item, index) => (
          <OpenQuestionItem key={index} index={index} item={item} onOpenGeneric={onOpenGeneric} />
        ))}
      </ul>
      <p className="prb-contribute-prompt">
        Tem informação ou documentação sobre uma destas questões? <a href="/contact">Contribuir com evidência →</a>
      </p>
    </PrbSection>
  );
}

/**
 * "Como chegámos a este problema" — sequential authored narrative stages
 * only (initial_signal/development/delimitation, in that fixed order). No
 * completion/current/pending state exists in canonical data, so none is
 * rendered here — each stage is an equally-weighted step in a sequence, not
 * a progress indicator. Horizontal at 1440/1024/768, vertical at 360
 * (styles/prb-details.css).
 */
function PrbPathSection({ stages, onOpenGeneric }: { stages: PrbPathStage[]; onOpenGeneric: (id: string) => void }) {
  if (stages.length === 0) return null;
  return (
    <PrbSection id="prb-percurso" label="Percurso da investigação" note="Sequência dos registos que deram forma ao problema" className="prb-path-section" bleed>
      <h3 className="prb-path-heading">Como chegámos a este problema</h3>
      <ol className="prb-path-stage-list">
        {stages.map((stage, index) => (
          <li key={stage.key} className="prb-path-stage">
            <span className="prb-path-stage-marker" aria-hidden="true" />
            <span className="prb-path-stage-index">{String(index + 1).padStart(2, "0")}</span>
            <h4 className="prb-path-stage-label">{stage.label}</h4>
            <p>{stage.summary}</p>
            {stage.evidenceIds.length > 0 && (
              <ul className="prb-open-question-evidence-refs">
                {stage.evidenceIds.map((id) => (
                  <li key={id}>
                    <RecordIdentifier variant="action" id={id} density="compact" onActivate={() => onOpenGeneric(id)} accessibleLabel={`Abrir ${id}`} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </PrbSection>
  );
}

/**
 * "Evidência e auditoria" — the audit layer: Toda a evidência (aggregate
 * count/effect tally, never a ranking or strength score), Como verificamos
 * (methodology explanation using the same enum labels rendered throughout
 * this page), and Dossiê canónico (the approved visual CTA only — PDF
 * generation itself is out of scope). "Abrir os N registos" is kept
 * non-destructive/explicit here: it does not route to the PRB generic-detail
 * record merely because that callback already exists, since the real
 * all-evidence interaction contract is not yet decided.
 */
function PrbAuditSection({ data }: { data: PrbDetailsData }) {
  return (
    <section id="prb-auditoria" aria-labelledby="prb-auditoria-heading" className="prb-section prb-audit-section">
      <div className="shell-frame shell-frame--wide prb-section-frame">
        <div className="prb-section-intro">
          <h2 id="prb-auditoria-heading" className="detail-panel-label">
            Evidência e auditoria
          </h2>
        </div>
        <div className="prb-section-content">
          <div className="prb-audit-lede">
            <h3 className="prb-audit-heading">Verificar esta investigação</h3>
            <p className="prb-audit-intro">
              Cada afirmação desta página remete para um registo de evidência e para a sua fonte. Pode consultá-los aqui, perceber como foram classificados e
              descarregar a versão canónica.
            </p>
          </div>

          <div className="prb-audit-row prb-audit-row--first">
            <div>
              <h4>Toda a evidência</h4>
              <div className="prb-audit-evidence-summary">
                <span>
                  <strong>{formatPublicCount(data.evidenceRecordCount)}</strong> {data.evidenceRecordCount === 1 ? "registo" : "registos"}
                </span>
                <span>
                  <strong>{formatPublicCount(data.evidenceEffectCount)}</strong> {data.evidenceEffectCount === 1 ? "efeito" : "efeitos"}
                </span>
                {data.effectTally.length > 0 && (
                  <span className="prb-audit-effect-tally">
                    {data.effectTally.map(({ value, count }) => (
                      <span key={value} className="prb-audit-effect-tally-item">
                        <EvidenceEffectTag effect={value} variant="compact" /> <strong>{formatPublicCount(count)}</strong>
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
            {/* The real all-evidence interaction (e.g. a filtered Records
                view scoped to this PRB) is not yet decided — this must not
                route to the PRB's own generic-detail record merely because
                `onOpenGeneric` already exists for that unrelated purpose, so
                the action stays explicitly disabled rather than wired to a
                semantically wrong destination. */}
            <button type="button" className="prb-audit-open-records" disabled aria-disabled="true">
              Abrir os {formatPublicCount(data.evidenceRecordCount)} registos
            </button>
          </div>

          <div className="prb-audit-row">
            <div>
              <h4>Como verificamos</h4>
              <p>
                Cada ligação entre um registo e este problema é descrita em duas dimensões independentes. Um registo pode ter mais do que um efeito, mais do
                que um papel e mais do que uma fonte.
              </p>
              <div className="prb-audit-dimension-grid">
                <div>
                  <h5>Efeito</h5>
                  <p>Como o registo se relaciona com este problema específico.</p>
                  <dl>
                    <dt>
                      <EvidenceEffectTag effect="SUPPORTS" variant="compact" />
                    </dt>
                    <dd>O registo apoia diretamente a formulação do problema.</dd>
                    <dt>
                      <EvidenceEffectTag effect="REFINES" variant="compact" />
                    </dt>
                    <dd>O registo torna a formulação mais precisa ou qualifica-a.</dd>
                    <dt>
                      <EvidenceEffectTag effect="BOUNDS" variant="compact" />
                    </dt>
                    <dd>O registo marca o que fica dentro ou fora do âmbito.</dd>
                    <dt>
                      <EvidenceEffectTag effect="CONTRADICTS" variant="compact" />
                    </dt>
                    <dd>O registo contradiz a formulação do problema.</dd>
                  </dl>
                </div>
                <div>
                  <h5>Papel na investigação</h5>
                  <p>Que tipo de contributo o registo representa.</p>
                  <dl>
                    {["LOCAL_OBSERVATION", "CONTEXTUAL", "COMPARATIVE_MECHANISM", "COMPARATIVE_RESPONSE", "EXISTING_RESPONSE", "PLANNED_RESPONSE"].map((role) => (
                      <dd key={role}>
                        <ResearchRoleTag role={role} variant="standard" />
                      </dd>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
            <a href="/methodology" className="prb-audit-method-link">
              Ler o método →
            </a>
          </div>

          <div className="prb-audit-row prb-audit-row--dossier">
            <div>
              <h4>Dossiê canónico</h4>
              <p>
                Representação de auditoria de {data.problemId}: problema, questões, evidência, fontes e percurso num único documento.
              </p>
            </div>
            <button type="button" className="prb-audit-dossier-cta" disabled aria-disabled="true">
              ↓ Descarregar dossiê (PDF)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PrbDetailsPresentation({ data, knownEvidence, onOpenGeneric, onBackToOverview, onViewHistory }: PrbDetailsPresentationProps) {
  return (
    <article aria-labelledby="prb-identity-title" className="prb-details-view">
      <div className="prb-header-band">
        <div className="shell-frame shell-frame--wide">
          <PrbHeader data={data} onBackToOverview={onBackToOverview} onViewHistory={onViewHistory} />
        </div>
      </div>

      <div className="shell-frame shell-frame--wide prb-details-frame">
        <PrbIdentityHeader data={data} />
      </div>

      <PrbInvestigationStateSection data={data} />

      <div className="shell-frame shell-frame--wide prb-details-frame">
        <PrbKnownEvidenceSection knownEvidence={knownEvidence} onOpenGeneric={onOpenGeneric} />
        <PrbOpenQuestionsSection questions={data.openQuestions} onOpenGeneric={onOpenGeneric} />
      </div>

      <PrbPathSection stages={data.pathStages} onOpenGeneric={onOpenGeneric} />
      <PrbAuditSection data={data} />
    </article>
  );
}
