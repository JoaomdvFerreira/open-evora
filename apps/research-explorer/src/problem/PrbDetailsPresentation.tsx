import { useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { EvidenceEffectTag } from "../records/EvidenceEffectTag";
import { ResearchRoleTag } from "../records/ResearchRoleTag";
import { RecordIdentifier } from "../records/RecordIdentifier";
import { Breadcrumb } from "../presentation/Breadcrumb";
import { ContextTabs } from "../navigation/ContextTabs";
import { describeTopic } from "../presentation/topicMapping";
import { validationVisual } from "./stateVisuals";
import { ShareAction } from "./ShareAction";
import { formatPublicCount, formatPublicDate, publicCompactEnumLabel, publicEnumLabel } from "../presentation/presentation";
import type { PrbDetailsData, PrbOpenQuestion, PrbPathStage } from "./prbDetailsProjection";

/**
 * Generic public PRB Details full-page composition.
 *
 * Approved visual reference: docs/design/reference/prb-details/ (README is
 * the authority contract). This design applies to every canonical PRB, not
 * specifically PRB-0005 — PRB-0005 is only the representative Storybook
 * fixture (PrbDetailsPresentation.stories.tsx). No PRB-0005-specific logic
 * lives here: every section is schema-driven from PrbDetailsData
 * (prbDetailsProjection.ts) and omits itself when its canonical field is
 * absent.
 *
 * This view intentionally does not reuse the retired 720+rail Problem
 * presentation architecture (right-side reading rail/CompactSectionIndex
 * "Nesta página"). The approved reference is a wide editorial composition
 * with its own local header (breadcrumb + the shared Detalhes|Histórico
 * PRB navigation + Verificar/Partilhar utilities) and a
 * left-label/broad-content section rhythm at desktop widths — see the
 * `.prb-*` classes in styles/prb-details.css, which own this view's own
 * geometry rather than `.lyt-reading`/`.context-tabs`.
 *
 * This component is a pure presentation layer — it receives already-resolved
 * plain data and issues no data fetches of its own, mirroring
 * OverviewPresentation.tsx's split from its data-wiring counterpart.
 * ProblemView.tsx is its runtime container (`view=problem`).
 *
 * Heading outline: the Explorer chrome owns the page-level <h1>, so the PRB
 * title is an <h2>, top-level sections are <h3>, and nested headings descend
 * from there. Semantic level never drives appearance — each heading's class
 * (or its section-scoped selector in styles/prb-details.css) is the visual
 * authority.
 */
export interface PrbDetailsPresentationProps {
  data: PrbDetailsData;
  onOpenGeneric: (id: string) => void;
  onBackToOverview: () => void;
  onViewHistory: (id: string) => void;
  /** Receives the focusable PRB title heading so the container can move focus to it once the async projection resolves. */
  titleRef?: RefObject<HTMLHeadingElement>;
}

/**
 * Local PRB header: breadcrumb (Visão geral › PRB-xxxx) + the shared
 * Detalhes|Histórico PRB navigation (ContextTabs) + Verificar/Partilhar
 * utilities. Detalhes is this view itself (current page), Histórico routes
 * to ProblemHistoryView via `onViewHistory`. "Verificar"
 * jumps to the audit section already on this page; "Partilhar" reuses the
 * existing ShareAction behaviour (Web Share API / copy-link fallback). Both
 * utilities carry a decorative aria-hidden glyph (↓/↗); their visible text
 * stays their accessible name. At 360 the breadcrumb takes its own line,
 * Partilhar collapses to its icon (label kept for assistive tech) and
 * Verificar is omitted from this row — the audit section itself remains in
 * normal page flow.
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
              <button type="button" className="prb-breadcrumb-ancestor" onClick={onBackToOverview}>
                Visão geral
              </button>
            ),
          },
        ]}
        current={<RecordIdentifier variant="text" density="compact" id={data.problemId} />}
      />
      <ContextTabs prbId={data.problemId} active="details" onViewDetails={() => undefined} onViewHistory={onViewHistory} />
      <div className="prb-header-utilities">
        <a href="#prb-auditoria" className="prb-header-utility prb-header-utility--verify">
          <span aria-hidden="true" className="prb-header-utility-icon">
            ↓
          </span>
          Verificar
        </a>
        <ShareAction title={data.title} icon="↗" />
      </div>
    </div>
  );
}

/**
 * Editorial hero. The "Atualizado em …" line is canonical `updated_at` —
 * the date the PRB record was last edited. It is record metadata only, not
 * a currentness assessment: nothing here infers that the reading is still
 * current from it. It follows the statement in DOM order: at >=768 the hero
 * grid lifts it into the eyebrow row's right edge; at 360 it stays below the
 * statement as the compact "PRB-xxxx · Atualizado em …" line (the id prefix
 * is shown only there — the local header breadcrumb already carries it at
 * wider widths).
 */
function PrbIdentityHeader({ data, titleRef }: { data: PrbDetailsData; titleRef?: RefObject<HTMLHeadingElement> }) {
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
      </div>
      <h2 id="prb-identity-title" ref={titleRef} tabIndex={-1} className="prb-identity-title">
        {data.title}
      </h2>
      {data.statement && <p className="prb-identity-statement">{data.statement}</p>}
      {data.updatedAt && (
        <p className="prb-identity-updated">
          <span className="prb-identity-updated-id">{`${data.problemId} · `}</span>
          Atualizado em <time dateTime={data.updatedAt}>{formatPublicDate(data.updatedAt)}</time>
        </p>
      )}
    </header>
  );
}

/**
 * One "Estado da investigação" dimension value — plain text, never a chip/pill
 * control. Uses the same compact PT-PT label set as the field's own
 * inline-chip form (statusGloss.ts/presentation.ts), matching the terse
 * reference copy ("Identificada", "Por validar").
 *
 * Colour hierarchy: lifecycle and evidence values always read neutral; only
 * an outstanding validation step (validation tone open/partial, e.g. "Por
 * validar") takes the accent, so the band draws the eye to the one
 * human-owned step still pending rather than accenting every value. The
 * explicit text label carries the meaning either way.
 */
function PrbStateValue({ field, value }: { field: "status" | "validation_status" | "evidence_status"; value: string }) {
  const label = field === "status" ? publicEnumLabel(field, value) : publicCompactEnumLabel(field, value);
  const tone = field === "validation_status" ? validationVisual(value).tone : null;
  const accent = tone === "open" || tone === "partial";
  return <dd className={accent ? "prb-state-value prb-state-value--accent" : "prb-state-value"}>{label}</dd>;
}

/**
 * Investigation-state + scope full-width flat band — plain caption/value pairs and plain count metrics, not chip-like status controls. All values come directly from canonical fields; no derived posture.
 *
 * DOM order stays heading → values per group (Estado da investigação, then Âmbito); at >=768 the stylesheet lays both groups onto one six-column grid (group-heading row + data row) without reordering the markup.
 */
function PrbInvestigationStateSection({ data }: { data: PrbDetailsData }) {
  return (
    <section id="prb-estado" aria-labelledby="prb-estado-heading" className="prb-state-scope-band">
      <div className="shell-frame shell-frame--wide prb-state-scope-row">
        <div className="prb-state-block">
          <h3 id="prb-estado-heading" className="detail-panel-label">
            Estado da investigação
          </h3>
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
          <h3 className="detail-panel-label">Âmbito</h3>
          <div className="prb-scope-metrics">
            <a href="#prb-questoes" className="prb-scope-metric">
              <span className="prb-scope-metric-label">{data.openQuestionCount === 1 ? "Questão aberta" : "Questões abertas"}</span>
              <span className="prb-scope-metric-value">{formatPublicCount(data.openQuestionCount)}</span>
            </a>
            <a href="#prb-auditoria" className="prb-scope-metric">
              <span className="prb-scope-metric-label">{data.evidenceRecordCount === 1 ? "Registo" : "Registos"}</span>
              <span className="prb-scope-metric-value">{formatPublicCount(data.evidenceRecordCount)}</span>
            </a>
            <a href="#prb-auditoria" className="prb-scope-metric">
              <span className="prb-scope-metric-label">{data.evidenceEffectCount === 1 ? "Efeito" : "Efeitos"}</span>
              <span className="prb-scope-metric-value">{formatPublicCount(data.evidenceEffectCount)}</span>
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
 * wide frame (Leitura atual/O que ainda não sabemos) leave it unset.
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
        <h3 id={`${id}-heading`} className="detail-panel-label">
          {label}
        </h3>
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

/** "Leitura atual" — canonical `causal_reading`, rendered verbatim as authored. Never derived from, summarised from, or paired with an evidence subset; omitted entirely when the PRB authors no causal reading. */
function PrbCurrentReadingSection({ causalReading }: { causalReading: string | null }) {
  if (!causalReading) return null;
  return (
    <PrbSection id="prb-leitura" label="Leitura atual">
      <p className="prb-current-reading">{causalReading}</p>
    </PrbSection>
  );
}

/**
 * Known canonical effect values → this view's restrained effect tone class.
 * CONTRADICTS deliberately has no dedicated tone until an approved design
 * reference exercises it: it uses the neutral treatment and its explicit
 * text label carries the meaning. Anything else (a future/unrecognised
 * value) is neutral too, rather than borrowing another effect's colour.
 */
const EFFECT_TONE: Record<string, string> = { SUPPORTS: "supports", REFINES: "refines", BOUNDS: "bounds" };

/** Stable public display order for known effects — a presentation convention only, never a ranking or strength order. */
const EFFECT_DISPLAY_ORDER = ["SUPPORTS", "REFINES", "BOUNDS", "CONTRADICTS"];

/**
 * Returns a display-ordered copy of `items` (canonical data is never
 * mutated): known effects in EFFECT_DISPLAY_ORDER, then unknown/future
 * effects in their existing relative order (Array.prototype.sort is stable).
 */
function inEffectDisplayOrder<T>(items: readonly T[], effectOf: (item: T) => string): T[] {
  const rank = (item: T) => {
    const index = EFFECT_DISPLAY_ORDER.indexOf(effectOf(item));
    return index === -1 ? EFFECT_DISPLAY_ORDER.length : index;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
}

/**
 * Approved restrained effect treatment for this view: a small square colour
 * marker plus the effect's explicit PT-PT label (EvidenceEffectTag, which
 * stays the sole label authority), both in an effect-specific restrained
 * tone. The marker is aria-hidden and colour is supplemental only — the
 * text label alone carries the meaning. Used identically by the audit
 * effect tally and the "Como verificamos" legend.
 */
function PrbEffectLabel({ effect, children }: { effect: string; children?: ReactNode }) {
  const tone = EFFECT_TONE[effect] ?? "neutral";
  return (
    <span className={`prb-effect prb-effect--${tone}`}>
      <span aria-hidden="true" className="prb-effect-marker" />
      <EvidenceEffectTag effect={effect} variant="compact" />
      {children}
    </span>
  );
}

/**
 * Open-question fields use two independent vertical stacks at >=1024 and a
 * single column below. The breakpoint is read in JS rather than CSS alone so
 * the DOM order always equals the visual order: a flat list cannot flow as
 * two height-independent columns in CSS, and CSS `order` over stack wrappers
 * would make the single-column reading order diverge from the visual one.
 * Must stay in step with the 1024 breakpoint in styles/prb-details.css.
 * Environments without matchMedia (jsdom) get the single-column order.
 */
const OPEN_QUESTION_STACKS_QUERY = "(min-width: 1024px)";

function subscribeOpenQuestionStacks(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(OPEN_QUESTION_STACKS_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function openQuestionStacksActive() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(OPEN_QUESTION_STACKS_QUERY).matches;
}

function useOpenQuestionStacks() {
  return useSyncExternalStore(subscribeOpenQuestionStacks, openQuestionStacksActive, () => false);
}

function OpenQuestionTextField({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="prb-open-question-field">
      <h4>{label}</h4>
      <p>{text}</p>
    </div>
  );
}

/**
 * One `investigation.open_questions[]` item. Each canonical field renders in
 * its own labelled block only when authored — never merged into a synthetic
 * summary and never given fallback prose. `current_action` is rendered as
 * authored free text only, exactly as stored — never parsed for a leading
 * "WATCH —"/"STOP —" keyword, never turned into a badge/posture, and never
 * replaced with the approved HTML reference's illustrative "Acompanhar"
 * label, which has no canonical counterpart for every question.
 *
 * `latestResult` always spans the full width. Single column (<1024) follows
 * the semantic order latestResult → whyOpen → resolutionCondition →
 * currentAction → relatedEvidenceIds; at >=1024 the remaining fields split
 * into a left stack (whyOpen, currentAction) and a right stack
 * (resolutionCondition, relatedEvidenceIds) that flow independently.
 */
function OpenQuestionItem({ index, item, stacked, onOpenGeneric }: { index: number; item: PrbOpenQuestion; stacked: boolean; onOpenGeneric: (id: string) => void }) {
  const latestResult = <OpenQuestionTextField label="O que sabemos até agora" text={item.latestResult} />;
  const whyOpen = <OpenQuestionTextField label="Porque continua em aberto" text={item.whyOpen} />;
  const resolutionCondition = <OpenQuestionTextField label="O que falta confirmar" text={item.resolutionCondition} />;
  const currentAction = <OpenQuestionTextField label="O que estamos a fazer" text={item.currentAction} />;
  const relatedEvidence = item.relatedEvidenceIds.length > 0 && (
    <div className="prb-open-question-field">
      <h4>Evidência relacionada</h4>
      <ul className="prb-open-question-evidence-refs">
        {item.relatedEvidenceIds.map((id) => (
          <li key={id}>
            <RecordIdentifier variant="action" id={id} density="compact" onActivate={() => onOpenGeneric(id)} accessibleLabel={`Abrir ${id}`} />
          </li>
        ))}
      </ul>
    </div>
  );
  const hasPrimaryStack = Boolean(item.whyOpen || item.currentAction);
  const hasSecondaryStack = Boolean(item.resolutionCondition || item.relatedEvidenceIds.length > 0);
  return (
    <li className="prb-open-question-item">
      <div className="prb-open-question-index">Questão {index + 1}</div>
      <p className="prb-open-question-text">{item.question}</p>
      <div className={stacked ? "prb-open-question-grid prb-open-question-grid--stacked" : "prb-open-question-grid"}>
        {latestResult}
        {stacked ? (
          <>
            {hasPrimaryStack && (
              <div className="prb-open-question-stack prb-open-question-stack--primary">
                {whyOpen}
                {currentAction}
              </div>
            )}
            {hasSecondaryStack && (
              <div className="prb-open-question-stack prb-open-question-stack--secondary">
                {resolutionCondition}
                {relatedEvidence}
              </div>
            )}
          </>
        ) : (
          <>
            {whyOpen}
            {resolutionCondition}
            {currentAction}
            {relatedEvidence}
          </>
        )}
      </div>
    </li>
  );
}

function PrbOpenQuestionsSection({ questions, onOpenGeneric }: { questions: PrbOpenQuestion[]; onOpenGeneric: (id: string) => void }) {
  const stacked = useOpenQuestionStacks();
  if (questions.length === 0) return null;
  return (
    <PrbSection
      id="prb-questoes"
      label="O que ainda não sabemos"
      note={`${formatPublicCount(questions.length)} ${questions.length === 1 ? "questão em acompanhamento" : "questões em acompanhamento"}`}
    >
      <ul className="prb-open-question-list">
        {questions.map((item, index) => (
          <OpenQuestionItem key={index} index={index} item={item} stacked={stacked} onOpenGeneric={onOpenGeneric} />
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
 * a progress indicator. The same vertical timeline (rail, marker, 01/02/03
 * sequence number, label, summary) at every width; only spacing and reading
 * width scale with the breakpoint (styles/prb-details.css). The approved
 * presentation shows only sequence number, stage label and authored
 * summary: each stage's `evidenceIds` stay available on the projection but
 * are not rendered here.
 */
function PrbPathSection({ stages }: { stages: PrbPathStage[] }) {
  if (stages.length === 0) return null;
  return (
    <PrbSection id="prb-percurso" label="Percurso da investigação" note="Sequência dos registos que deram forma ao problema" className="prb-path-section" bleed>
      <h4 className="prb-path-heading">Como chegámos a este problema</h4>
      <ol className="prb-path-stage-list">
        {stages.map((stage, index) => (
          <li key={stage.key} className="prb-path-stage">
            <span className="prb-path-stage-marker" aria-hidden="true" />
            <span className="prb-path-stage-index">{String(index + 1).padStart(2, "0")}</span>
            <h5 className="prb-path-stage-label">{stage.label}</h5>
            <p>{stage.summary}</p>
          </li>
        ))}
      </ol>
    </PrbSection>
  );
}

/**
 * "Evidência e auditoria" — the audit layer: Toda a evidência (aggregate
 * evidence-record count and effect tally, never a ranking or strength
 * score), Como verificamos (a concise methodology explainer:
 * Sustenta/Refina/Delimita and Observação local/Resposta existente are
 * illustrative examples of the approved copy, not the full vocabulary;
 * "Ler o método" routes to the fuller methodology), and Dossiê canónico (a
 * disabled placeholder CTA only — PDF generation itself is out of scope).
 * No per-evidence metadata is rendered here. "Abrir os N registos" is kept
 * non-destructive/explicit here: it does not route to the PRB generic-detail
 * record merely because that callback already exists, since the real
 * all-evidence interaction contract is not yet decided.
 */
function PrbAuditSection({ data }: { data: PrbDetailsData }) {
  return (
    <section id="prb-auditoria" aria-labelledby="prb-auditoria-heading" className="prb-section prb-audit-section">
      <div className="shell-frame shell-frame--wide prb-section-frame">
        <div className="prb-section-intro">
          <h3 id="prb-auditoria-heading" className="detail-panel-label">
            Evidência e auditoria
          </h3>
        </div>
        <div className="prb-section-content">
          <div className="prb-audit-lede">
            <h4 className="prb-audit-heading">Verificar esta investigação</h4>
            <p className="prb-audit-intro">
              Este problema mantém ligações explícitas a registos de evidência e às respetivas fontes. Aqui pode ver como essas relações são classificadas e
              consultar o método usado na investigação.
            </p>
          </div>

          <div className="prb-audit-row prb-audit-row--first">
            <div>
              <h5>Toda a evidência</h5>
              <div className="prb-audit-evidence-summary">
                <span>
                  <strong>{formatPublicCount(data.evidenceRecordCount)}</strong> {data.evidenceRecordCount === 1 ? "registo" : "registos"}
                </span>
                <span>
                  <strong>{formatPublicCount(data.evidenceEffectCount)}</strong> {data.evidenceEffectCount === 1 ? "efeito" : "efeitos"}
                </span>
                {data.effectTally.length > 0 && (
                  <>
                    <span aria-hidden="true" className="prb-audit-evidence-summary-sep" />
                    <span className="prb-audit-effect-tally">
                      {inEffectDisplayOrder(data.effectTally, (entry) => entry.value).map(({ value, count }) => (
                        <PrbEffectLabel key={value} effect={value}>
                          {" "}
                          <strong>{formatPublicCount(count)}</strong>
                        </PrbEffectLabel>
                      ))}
                    </span>
                  </>
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
              <h5>Como verificamos</h5>
              <p>
                Cada ligação entre um registo e este problema é descrita em duas dimensões independentes. Um registo pode ter mais do que um efeito, mais do
                que um papel e mais do que uma fonte.
              </p>
              <div className="prb-audit-dimension-grid">
                <div>
                  <h6>Efeito</h6>
                  <p>Como o registo se relaciona com este problema específico.</p>
                  <dl className="prb-audit-effect-legend">
                    <dt>
                      <PrbEffectLabel effect="SUPPORTS" />
                    </dt>
                    <dd>O registo apoia diretamente a formulação do problema.</dd>
                    <dt>
                      <PrbEffectLabel effect="REFINES" />
                    </dt>
                    <dd>O registo torna a formulação mais precisa ou qualifica-a.</dd>
                    <dt>
                      <PrbEffectLabel effect="BOUNDS" />
                    </dt>
                    <dd>O registo marca o que fica dentro ou fora do âmbito.</dd>
                  </dl>
                </div>
                <div>
                  <h6>Papel na investigação</h6>
                  <p>Que tipo de contributo o registo representa.</p>
                  <dl className="prb-audit-role-legend">
                    <div>
                      <dt>
                        <ResearchRoleTag role="LOCAL_OBSERVATION" variant="compact" />
                      </dt>
                      <dd>Dado, medição ou relato recolhido sobre a situação em Évora.</dd>
                    </div>
                    <div>
                      <dt>
                        <ResearchRoleTag role="EXISTING_RESPONSE" variant="compact" />
                      </dt>
                      <dd>Medida, serviço ou plano que já responde, total ou parcialmente, ao problema.</dd>
                    </div>
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
              <h5>Dossiê canónico</h5>
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

export function PrbDetailsPresentation({ data, onOpenGeneric, onBackToOverview, onViewHistory, titleRef }: PrbDetailsPresentationProps) {
  return (
    <article aria-labelledby="prb-identity-title" className="prb-details-view">
      <div className="prb-header-band">
        <div className="shell-frame shell-frame--wide">
          <PrbHeader data={data} onBackToOverview={onBackToOverview} onViewHistory={onViewHistory} />
        </div>
      </div>

      <div className="shell-frame shell-frame--wide prb-details-frame">
        <PrbIdentityHeader data={data} titleRef={titleRef} />
      </div>

      <PrbInvestigationStateSection data={data} />

      <div className="shell-frame shell-frame--wide prb-details-frame">
        <PrbCurrentReadingSection causalReading={data.causalReading} />
        <PrbOpenQuestionsSection questions={data.openQuestions} onOpenGeneric={onOpenGeneric} />
      </div>

      <PrbPathSection stages={data.pathStages} />
      <PrbAuditSection data={data} />
    </article>
  );
}
