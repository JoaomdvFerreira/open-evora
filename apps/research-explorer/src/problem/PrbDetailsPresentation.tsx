import { EvidenceEffectTag } from "../records/EvidenceEffectTag";
import { ResearchRoleTag } from "../records/ResearchRoleTag";
import { RecordIdentifier } from "../records/RecordIdentifier";
import { TopicBadge } from "../presentation/TopicBadge";
import { Breadcrumb } from "../presentation/Breadcrumb";
import { ContextTabs } from "../navigation/ContextTabs";
import { EmptyState } from "../presentation/EmptyState";
import { RailSectionIndex } from "../presentation/RailSectionIndex";
import { CompactSectionIndex } from "../presentation/CompactSectionIndex";
import type { SectionIndexEntry } from "../presentation/SectionIndexEntry";
import { ProblemLifecycleStatus } from "./ProblemLifecycleStatus";
import { EvidenceStatus, ValidationStatus } from "./InvestigationStatus";
import { ShareAction } from "./ShareAction";
import { formatPublicCount, formatPublicDate } from "../presentation/presentation";
import type { PrbDetailsData, PrbEvidenceRelationship, PrbOpenQuestion, PrbPathStage } from "./prbDetailsProjection";

/**
 * PD-02A — generic public PRB Details full-page composition.
 *
 * Approved visual reference: docs/design/reference/prb-details/ (README is
 * the authority contract). This design applies to every canonical PRB, not
 * specifically PRB-0005 — PRB-0005 is only the representative Storybook
 * fixture (PrbDetailsPresentation.stories.tsx). No PRB-0005-specific logic
 * lives here: every section is schema-driven from PrbDetailsData
 * (prbDetailsProjection.ts) and omits itself when its canonical field is
 * absent, exactly like ProblemView.tsx's established convention.
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

function PrbBreadcrumb({ problemId, onBackToOverview }: { problemId: string; onBackToOverview: () => void }) {
  return (
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
      current={<RecordIdentifier variant="text" density="compact" id={problemId} />}
    />
  );
}

/** Investigation-state + scope compact stat row — status/evidence/validation chips plus open-question/evidence/effect counts, all directly from canonical fields. No derived posture. */
function PrbInvestigationStateSection({ data }: { data: PrbDetailsData }) {
  return (
    <section id="prb-estado" aria-labelledby="prb-estado-heading" className="prb-state-scope-row">
      <div className="prb-state-block">
        <h2 id="prb-estado-heading" className="detail-panel-label">
          Estado da investigação
        </h2>
        <dl className="prb-state-grid">
          {data.status && (
            <div className="prb-state-item">
              <dt>Estado</dt>
              <dd>
                <ProblemLifecycleStatus value={data.status} form="reading" />
              </dd>
            </div>
          )}
          {data.evidenceStatus && (
            <div className="prb-state-item">
              <dt>Evidência</dt>
              <dd>
                <EvidenceStatus value={data.evidenceStatus} form="reading" />
              </dd>
            </div>
          )}
          {data.validationStatus && (
            <div className="prb-state-item">
              <dt>Validação</dt>
              <dd>
                <ValidationStatus value={data.validationStatus} form="reading" />
              </dd>
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
    </section>
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
            {data.topics.map((topic) => (
              <TopicBadge key={topic} code={topic} />
            ))}
          </span>
        )}
        {data.updatedAt && (
          <span className="prb-identity-updated">
            Atualizado em <time dateTime={data.updatedAt}>{formatPublicDate(data.updatedAt)}</time>
          </span>
        )}
      </div>
      <div className="prb-identity-heading-row">
        <h1 id="prb-identity-title" className="prb-identity-title">{data.title}</h1>
        <ShareAction title={data.title} />
      </div>
      {data.statement && <p className="prb-identity-statement">{data.statement}</p>}
    </header>
  );
}

/** "O que sabemos até agora" — one authored observation statement per evidence item, each linked to its evidence record and relationship metadata. Content and count come entirely from `knownEvidence`; this component owns no selection policy — the caller decides which/how many items to pass (PRB-0005 Storybook fixture: a caller-chosen subset; the section renders nothing when the caller passes none). */
function PrbKnownEvidenceSection({
  knownEvidence,
  onOpenGeneric,
}: {
  knownEvidence: PrbEvidenceRelationship[];
  onOpenGeneric: (id: string) => void;
}) {
  if (knownEvidence.length === 0) return null;
  return (
    <section id="prb-sabemos" aria-labelledby="prb-sabemos-heading" className="prb-section">
      <div className="prb-section-intro">
        <h2 id="prb-sabemos-heading" className="detail-panel-label">
          O que sabemos até agora
        </h2>
        <p className="prb-section-intro-note">
          {formatPublicCount(knownEvidence.length)} {knownEvidence.length === 1 ? "afirmação" : "afirmações"}, cada uma ligada a um registo de
          evidência
        </p>
      </div>
      <ul className="prb-known-evidence-list">
        {knownEvidence.map((item) => (
          <li key={item.evidenceId} className="prb-known-evidence-item">
            {item.observationSummary && <p className="prb-known-evidence-statement">{item.observationSummary}</p>}
            <EvidenceRelationshipMetaAction item={item} onOpenGeneric={onOpenGeneric} />
          </li>
        ))}
      </ul>
    </section>
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
              <EvidenceEffectTag key={`${effect}-${index}`} effect={effect} variant="standard" />
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
              <ResearchRoleTag key={`${role}-${index}`} role={role} variant="standard" />
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
 * counterpart for every question (task: "do not fabricate WATCH/Acompanhar
 * for Question 1").
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
    <section id="prb-questoes" aria-labelledby="prb-questoes-heading" className="prb-section">
      <div className="prb-section-intro">
        <h2 id="prb-questoes-heading" className="detail-panel-label">
          O que ainda não sabemos
        </h2>
        <p className="prb-section-intro-note">
          {formatPublicCount(questions.length)} {questions.length === 1 ? "questão em acompanhamento" : "questões em acompanhamento"}
        </p>
      </div>
      <ul className="prb-open-question-list">
        {questions.map((item, index) => (
          <OpenQuestionItem key={index} index={index} item={item} onOpenGeneric={onOpenGeneric} />
        ))}
      </ul>
      <p className="prb-contribute-prompt">
        Tem informação ou documentação sobre uma destas questões? <a href="/contact">Contribuir com evidência →</a>
      </p>
    </section>
  );
}

/**
 * "Como chegámos a este problema" — sequential authored narrative stages
 * only (initial_signal/development/delimitation, in that fixed order). No
 * completion/current/pending state exists in canonical data, so none is
 * rendered here (task: "do not fabricate timeline completion/current/pending
 * states") — each stage is presented as an equally-weighted step in a
 * sequence, not a progress indicator.
 */
function PrbPathSection({ stages, onOpenGeneric }: { stages: PrbPathStage[]; onOpenGeneric: (id: string) => void }) {
  if (stages.length === 0) return null;
  return (
    <section id="prb-percurso" aria-labelledby="prb-percurso-heading" className="prb-section prb-path-section">
      <div className="prb-section-intro">
        <h2 id="prb-percurso-heading" className="detail-panel-label">
          Percurso da investigação
        </h2>
        <p className="prb-section-intro-note">Sequência dos registos que deram forma ao problema</p>
      </div>
      <h3 className="prb-path-heading">Como chegámos a este problema</h3>
      <ol className="prb-path-stage-list">
        {stages.map((stage, index) => (
          <li key={stage.key} className="prb-path-stage">
            <span className="prb-path-stage-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
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
    </section>
  );
}

/**
 * "Evidência e auditoria" — an aggregate summary of the PRB's own already-
 * authored evidence-record count and effect tally (a count, never a ranking
 * or strength score), plus a methodology explanation of the effect/role
 * dimensions using the same enum labels rendered throughout this page. No
 * publisher-attribution claim is made about "related evidence" — every
 * evidence reference here is this PRB's own linked evidence, resolved
 * per-item exactly as `EvidenceRelationshipMetaAction` already does
 * elsewhere on the page (task: "do not fabricate shared publisher
 * attribution for related evidence").
 */
function PrbAuditSection({ data, onOpenGeneric }: { data: PrbDetailsData; onOpenGeneric: (id: string) => void }) {
  return (
    <section id="prb-auditoria" aria-labelledby="prb-auditoria-heading" className="prb-section prb-audit-section">
      <h2 id="prb-auditoria-heading" className="detail-panel-label">
        Evidência e auditoria
      </h2>
      <h3 className="prb-audit-heading">Verificar esta investigação</h3>
      <p className="prb-audit-intro">
        Cada afirmação desta página remete para um registo de evidência e para a sua fonte. Pode consultá-los e perceber como foram
        classificados.
      </p>

      <div className="prb-audit-row">
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
        <button type="button" className="prb-audit-open-records" onClick={() => onOpenGeneric(data.problemId)}>
          Abrir os {formatPublicCount(data.evidenceRecordCount)} registos
        </button>
      </div>

      <div className="prb-audit-row">
        <div>
          <h4>Como verificamos</h4>
          <p>
            Cada ligação entre um registo e este problema é descrita em duas dimensões independentes. Um registo pode ter mais do que um
            efeito, mais do que um papel e mais do que uma fonte.
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
      </div>
    </section>
  );
}

const SECTION_INDEX_ENTRIES = (data: PrbDetailsData): SectionIndexEntry[] => {
  const entries: SectionIndexEntry[] = [
    { key: "prb-estado", label: "Estado da investigação", href: "#prb-estado" },
  ];
  if (data.effectTally.length > 0 || data.evidenceRecordCount > 0) entries.push({ key: "prb-sabemos", label: "O que sabemos até agora", href: "#prb-sabemos" });
  if (data.openQuestionCount > 0) entries.push({ key: "prb-questoes", label: "O que ainda não sabemos", href: "#prb-questoes" });
  if (data.pathStages.length > 0) entries.push({ key: "prb-percurso", label: "Percurso da investigação", href: "#prb-percurso" });
  entries.push({ key: "prb-auditoria", label: "Evidência e auditoria", href: "#prb-auditoria" });
  return entries;
};

function PrbReadingRail({ data }: { data: PrbDetailsData }) {
  return (
    <aside className="lyt-reading-rail prb-reading-rail">
      <h4 className="detail-panel-label">Nesta página</h4>
      <RailSectionIndex label="Nesta página" entries={SECTION_INDEX_ENTRIES(data)} />
    </aside>
  );
}

function PrbCompactSectionIndex({ data }: { data: PrbDetailsData }) {
  return (
    <div className="prb-compact-section-index">
      <CompactSectionIndex summary="Nesta página" navLabel="Nesta página (versão compacta)" entries={SECTION_INDEX_ENTRIES(data)} />
    </div>
  );
}

export function PrbDetailsPresentation({ data, knownEvidence, onOpenGeneric, onBackToOverview, onViewHistory }: PrbDetailsPresentationProps) {
  return (
    <article aria-labelledby="prb-identity-title" className="prb-details-view shell-frame">
      <PrbBreadcrumb problemId={data.problemId} onBackToOverview={onBackToOverview} />
      <ContextTabs prbId={data.problemId} active="problem" onOpenGeneric={onOpenGeneric} onViewAsProblem={onOpenGeneric} onViewHistory={onViewHistory} />
      <PrbCompactSectionIndex data={data} />

      <div className="lyt-reading" data-rail="present">
        <div className="prb-details-main lyt-reading-main">
          <PrbIdentityHeader data={data} />
          <PrbInvestigationStateSection data={data} />

          {knownEvidence.length > 0 ? (
            <PrbKnownEvidenceSection knownEvidence={knownEvidence} onOpenGeneric={onOpenGeneric} />
          ) : (
            <EmptyState message="Nenhuma evidência associada." />
          )}

          <PrbOpenQuestionsSection questions={data.openQuestions} onOpenGeneric={onOpenGeneric} />
          <PrbPathSection stages={data.pathStages} onOpenGeneric={onOpenGeneric} />
          <PrbAuditSection data={data} onOpenGeneric={onOpenGeneric} />
        </div>

        <PrbReadingRail data={data} />
      </div>
    </article>
  );
}
