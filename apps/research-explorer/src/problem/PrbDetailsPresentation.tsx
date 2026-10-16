import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { IconInfo } from "../presentation/icons";
import { EvidenceEffectTag } from "../records/EvidenceEffectTag";
import { ResearchRoleTag } from "../records/ResearchRoleTag";
import { RecordIdentifier } from "../records/RecordIdentifier";
import { ExplorerLink } from "../navigation/ExplorerLink";
import { PrbHeader, PrbIdentityHeader } from "./PrbPageHeader";
import { formatPublicCount, formatPublicDate, formatPublicPartialDate, formatPublicPeriod, publicCompactEnumLabel, publicEnumExplanation, publicEnumLabel } from "../presentation/presentation";
import { isHttpUrl } from "../records/sourceView";
import { Drawer } from "../presentation/Drawer";
import type { PrbDetailsData, PrbEvidenceItem, PrbOpenQuestion, PrbPathStage } from "./prbDetailsProjection";
import type { PrbDossierData } from "./prbDossierProjection";
import { PrbDossierAction } from "./PrbDossierAction";

export interface DossierPublicationIdentity { sourceCommit: string | null; corpusFingerprint: string }

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
 * PRB navigation + Verificar/Partilhar utilities — shared with Histórico,
 * see PrbPageHeader.tsx) and a
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
  /** The same PRB's dossier projection (prbDossierProjection.ts); the dossier download stays disabled without it. */
  dossier?: PrbDossierData | null;
  dossierIdentity?: DossierPublicationIdentity;
}

/**
 * One "Estado da investigação" dimension value — plain text, never a chip/pill
 * control. Uses the same compact PT-PT label set as the field's own
 * inline-chip form (statusGloss.ts/presentation.ts), matching the terse
 * reference copy ("Identificada", "Por validar").
 *
 * All three state dimensions use neutral presentation. Their text labels
 * carry the canonical meaning without implying urgency or currentness.
 */
function PrbStateValue({ field, value }: { field: "status" | "validation_status" | "evidence_status"; value: string }) {
  const label = field === "status" ? publicEnumLabel(field, value) : publicCompactEnumLabel(field, value);
  return <dd className="prb-state-value">{label}</dd>;
}

/** Presentation-only explanation for the Evidence state "Identificada". */
const DISCOVERED_EVIDENCE_EXPLANATION = "Foram encontradas evidências relevantes; o problema ainda não foi plenamente validado.";

/**
 * State term with an info control beside the label ("Evidência ⓘ"), so the
 * value rows of all three dimensions keep identical geometry. The term is
 * one non-wrapping row whose height and baseline come from the label text;
 * it is also the tooltip's containing block.
 */
function PrbStateTermWithInfo({ term, accessibleName, explanation }: { term: string; accessibleName: string; explanation: string }) {
  const explanationId = useId();
  const controlRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused || pinned) && !dismissed;

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !controlRef.current?.contains(event.target)) {
        setPinned(false);
        setHovered(false);
        setDismissed(true);
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [open]);

  return (
    <dt ref={controlRef} className="prb-state-term--with-info">
      <span>{term}</span>
      <span
        className="prb-state-info-wrap"
        onPointerEnter={(event) => {
          if (event.pointerType === "touch") return;
          setHovered(true);
          setDismissed(false);
        }}
        onPointerLeave={() => setHovered(false)}
      >
        <button
          type="button"
          className="prb-state-info-button"
          aria-label={accessibleName}
          aria-describedby={explanationId}
          onFocus={() => { setFocused(true); setDismissed(false); }}
          onBlur={() => setFocused(false)}
          onClick={() => {
            setPinned(!pinned);
            setDismissed(pinned);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setPinned(false);
              setHovered(false);
              setDismissed(true);
            }
          }}
        >
          <IconInfo />
        </button>
      </span>
      <span id={explanationId} role="tooltip" className="prb-state-info-tooltip" data-open={open || undefined}>
        {explanation}
      </span>
    </dt>
  );
}

/**
 * Investigation-state + scope full-width flat band — plain caption/value pairs and plain count metrics, not chip-like status controls. All values come directly from canonical fields; no derived posture.
 *
 * DOM order stays heading → values per group (Estado da investigação, then Base da investigação); at >=768 the stylesheet lays both groups onto one six-column grid (group-heading row + data row) without reordering the markup.
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
                {data.evidenceStatus === "discovered" ? (
                  <PrbStateTermWithInfo term="Evidência" accessibleName="O que significa Evidência identificada?" explanation={DISCOVERED_EVIDENCE_EXPLANATION} />
                ) : (
                  <dt>Evidência</dt>
                )}
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
          <p className="prb-state-method-link"><a href="/methodology#methodology-investigation-status">O que significam estes estados?</a></p>
        </div>
        <div className="prb-scope-block">
          <h3 className="detail-panel-label">Base da investigação</h3>
          <div className="prb-scope-metrics">
            <a href="#prb-questoes" className="prb-scope-metric">
              <span className="prb-scope-metric-label">{data.status === "CLOSED" ? "Questões que ficaram por responder" : data.openQuestionCount === 1 ? "Questão aberta" : "Questões abertas"}</span>
              <span className="prb-scope-metric-value">{formatPublicCount(data.openQuestionCount)}</span>
            </a>
            <a href="#prb-auditoria" className="prb-scope-metric">
              <span className="prb-scope-metric-label">{data.evidenceRecordCount === 1 ? "Evidência" : "Evidências"}</span>
              <span className="prb-scope-metric-value">{formatPublicCount(data.evidenceRecordCount)}</span>
            </a>
            <a href="#prb-auditoria" className="prb-scope-metric">
              <span className="prb-scope-metric-label">{data.sourceCount === 1 ? "Fonte" : "Fontes"}</span>
              <span className="prb-scope-metric-value">{formatPublicCount(data.sourceCount)}</span>
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
 * One `investigation.open_questions[]` item. Authored fields remain separate.
 * The action block is always visible; an absent action gets a neutral
 * presentation-only fallback while the projection retains null. Authored
 * actions are never parsed into badges or postures.
 *
 * Fields follow the same semantic and visual order at every viewport.
 */
function OpenQuestionItem({ index, item, status, onOpenGeneric }: { index: number; item: PrbOpenQuestion; status: string | null; onOpenGeneric: (id: string) => void }) {
  const closed = status === "CLOSED";
  const latestResult = <OpenQuestionTextField label={closed ? "Último resultado registado" : "Resultado até agora"} text={item.latestResult} />;
  const whyOpen = <OpenQuestionTextField label={closed ? "Porque ficou por responder" : "Porque continua em aberto"} text={item.whyOpen} />;
  const resolutionCondition = <OpenQuestionTextField label="O que permitiria esclarecer" text={item.resolutionCondition} />;
  const currentAction = <OpenQuestionTextField label={closed ? "Ação registada" : "Ação atual"} text={item.currentAction?.trim() ? item.currentAction : "Sem ação em curso"} />;
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
  return (
    <li className="prb-open-question-item">
      <div className="prb-open-question-index">Questão {index + 1}</div>
      <p className="prb-open-question-text">{item.question}</p>
      <div className="prb-open-question-grid">
        {latestResult}
        {whyOpen}
        {resolutionCondition}
        {currentAction}
        {relatedEvidence}
      </div>
    </li>
  );
}

function PrbOpenQuestionsSection({ problemId, questions, status, onOpenGeneric }: { problemId: string; questions: PrbOpenQuestion[]; status: string | null; onOpenGeneric: (id: string) => void }) {
  if (questions.length === 0) return null;
  const closed = status === "CLOSED";
  return (
    <PrbSection
      id="prb-questoes"
      label={closed ? "Questões que ficaram por responder" : "O que ainda não sabemos"}
      note={closed ? undefined : `${formatPublicCount(questions.length)} ${questions.length === 1 ? "questão em acompanhamento" : "questões em acompanhamento"}`}
    >
      <ul className="prb-open-question-list">
        {questions.map((item, index) => (
          <OpenQuestionItem key={index} index={index} item={item} status={status} onOpenGeneric={onOpenGeneric} />
        ))}
      </ul>
      {!closed && <p className="prb-contribute-prompt">
        Tem informação ou documentação sobre uma destas questões? <a href={`/contact?${new URLSearchParams({ type: "evidence", prb: problemId })}`}>Contribuir para a investigação →</a>
      </p>}
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
    <PrbSection id="prb-percurso" label="Como chegámos a esta leitura" className="prb-path-section" bleed>
      <h4 className="prb-path-heading">Etapas da investigação</h4>
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
 * "Evidência e verificação" — the audit layer: Toda a evidência (aggregate
 * evidence count and effect tally, never a ranking or strength score),
 * Como verificamos (explaining each effect and role present in this Problem;
 * "Ler o método" routes to the fuller methodology), and Dossiê da investigação (the
 * client-side PDF dossier download, PrbDossierAction.tsx).
 * No per-evidence metadata is rendered in the page itself: the evidence
 * button opens PrbEvidenceDrawer in place (no URL change, navigation or
 * data load), and stays disabled when the PRB links no evidence so an empty
 * drawer can never open.
 */
function PrbAuditSection({ data, dossier, dossierIdentity, onOpenGeneric }: { data: PrbDetailsData; dossier: PrbDossierData | null; dossierIdentity: DossierPublicationIdentity | undefined; onOpenGeneric: (id: string) => void }) {
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const openRecordsRef = useRef<HTMLButtonElement>(null);
  const hasEvidence = data.evidence.length > 0;
  return (
    <section id="prb-auditoria" aria-labelledby="prb-auditoria-heading" className="prb-section prb-audit-section">
      <div className="shell-frame shell-frame--wide prb-section-frame">
        <div className="prb-section-intro">
          <h3 id="prb-auditoria-heading" className="detail-panel-label">
            Evidência e verificação
          </h3>
        </div>
        <div className="prb-section-content">
          <div className="prb-audit-lede">
            <h4 className="prb-audit-heading">Verificar esta investigação</h4>
            <p className="prb-audit-intro">
              Este problema mantém ligações explícitas a evidências e às respetivas fontes. Aqui pode ver como essas relações são classificadas e
              consultar o método usado na investigação.
            </p>
          </div>

          <div className="prb-audit-row prb-audit-row--first">
            <div>
              <h5>Toda a evidência</h5>
              <div className="prb-audit-evidence-summary">
                <span>
                  <strong>{formatPublicCount(data.evidenceRecordCount)}</strong> {data.evidenceRecordCount === 1 ? "evidência" : "evidências"}
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
            <button
              ref={openRecordsRef}
              type="button"
              className="prb-audit-open-records"
              disabled={!hasEvidence}
              aria-disabled={hasEvidence ? undefined : "true"}
              aria-haspopup="dialog"
              onClick={() => setEvidenceDrawerOpen(true)}
            >
              Ver as {formatPublicCount(data.evidenceRecordCount)} evidências
            </button>
          </div>
          {evidenceDrawerOpen && hasEvidence && (
            <PrbEvidenceDrawer
              evidence={data.evidence}
              returnFocusRef={openRecordsRef}
              onDismiss={() => setEvidenceDrawerOpen(false)}
              onOpenRecord={(id) => {
                setEvidenceDrawerOpen(false);
                onOpenGeneric(id);
              }}
            />
          )}

          <div className="prb-audit-row">
            <div>
              <h5>Como verificamos</h5>
              <p>
                Cada ligação entre uma evidência e este problema é descrita em duas dimensões independentes. Uma evidência pode ter mais do que um efeito, mais do
                que um papel e mais do que uma fonte.
              </p>
              <div className="prb-audit-dimension-grid">
                <div>
                  <h6>Efeito</h6>
                  <p>Como a evidência se relaciona com este problema específico.</p>
                  <dl className="prb-audit-effect-legend">
                    {[...new Set(data.evidence.flatMap((item) => item.effects))].map((effect) => (
                      <div key={effect}>
                        <dt><PrbEffectLabel effect={effect} /></dt>
                        <dd>{publicEnumExplanation("effects", effect) ?? "Efeito indicado na evidência."}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <h6>Papel na investigação</h6>
                  <p>Que tipo de contributo a evidência representa.</p>
                  <dl className="prb-audit-role-legend">
                    {[...new Set(data.evidence.flatMap((item) => item.researchRoles))].map((role) => (
                      <div key={role}>
                        <dt><ResearchRoleTag role={role} variant="compact" /></dt>
                        <dd>{publicEnumExplanation("research_roles", role) ?? "Papel indicado na evidência."}</dd>
                      </div>
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
              <h5>Dossiê da investigação</h5>
              <p>
                Documento para consultar {data.problemId}: problema, questões, evidências, fontes e percurso da investigação.
              </p>
            </div>
            <PrbDossierAction dossier={dossier} identity={dossierIdentity ?? null} />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * One linked evidence record inside the audit drawer: canonical ID,
 * the PRB→EVD effects and research roles in authored order, the observation
 * summary and resolved source references — each omitted when unavailable.
 * The primary action opens the canonical EVD Record Detail; the full EVD
 * Detail is never rendered here, and no confidence, importance or ranking
 * is shown.
 */
function PrbEvidenceRow({ item, onOpenRecord }: { item: PrbEvidenceItem; onOpenRecord: (id: string) => void }) {
  const temporal = item.temporal;
  const asOfLabel = item.evidenceNature && ({
    fact: "Observado em",
    measurement: "Observado em",
    "reported-experience": "Observado em",
    recommendation: "Referência temporal",
    claim: "Referência temporal",
    opinion: "Referência temporal",
  } as Record<string, string>)[item.evidenceNature];
  const temporalLabel = temporal?.asOf && asOfLabel
    ? `${asOfLabel}: ${formatPublicPartialDate(temporal.asOf)}`
    : temporal?.start && temporal.end
      ? `Período: ${formatPublicPeriod(temporal.start, temporal.end)}`
      : null;
  return (
    <li className="prb-evidence-item">
      <h3 className="prb-evidence-item-id">
        <RecordIdentifier variant="text" density="compact" id={item.id} />
      </h3>
      {item.summary && <p className="prb-evidence-item-summary">{item.summary}</p>}
      {temporalLabel && <p className="prb-evidence-item-temporal">{temporalLabel}</p>}
      {(item.effects.length > 0 || item.researchRoles.length > 0 || item.sources.length > 0) && (
        <dl className="prb-evidence-item-facts">
          {item.effects.length > 0 && (
            <div>
              <dt>{item.effects.length === 1 ? "Efeito" : "Efeitos"}</dt>
              <dd>
                {item.effects.map((effect, index) => (
                  <PrbEffectLabel key={`${effect}-${index}`} effect={effect} />
                ))}
              </dd>
            </div>
          )}
          {item.researchRoles.length > 0 && (
            <div>
              <dt>{item.researchRoles.length === 1 ? "Papel" : "Papéis"}</dt>
              <dd>
                {item.researchRoles.map((role, index) => (
                  <ResearchRoleTag key={`${role}-${index}`} role={role} variant="compact" />
                ))}
              </dd>
            </div>
          )}
          {item.sources.length > 0 && (
            <div>
              <dt>{item.sources.length === 1 ? "Fonte" : "Fontes"}</dt>
              <dd>
                <ul className="prb-evidence-item-sources">
                  {item.sources.map((source) => (
                    <li key={source.id}>
                      {source.name && source.publiclyAvailable && source.canonicalReference && isHttpUrl(source.canonicalReference) ? (
                        <a className="prb-evidence-item-source-name" href={source.canonicalReference} target="_blank" rel="noopener noreferrer">{source.name}</a>
                      ) : source.name ? (
                        <span className="prb-evidence-item-source-name">{source.name}</span>
                      ) : null}
                      <RecordIdentifier variant="text" density="compact" id={source.id} />
                      {source.publishedAt && <span>Publicado: {formatPublicPartialDate(source.publishedAt)}</span>}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}
      <ExplorerLink to={{ view: "records", selectedId: item.id }} onNavigate={() => onOpenRecord(item.id)} className="prb-evidence-item-open" aria-label={`Abrir evidência ${item.id}`}>
        Abrir evidência →
      </ExplorerLink>
    </li>
  );
}

/** Every linked evidence record, in `projection.evidence` order, inside the generic modal Drawer. */
function PrbEvidenceDrawer({
  evidence,
  returnFocusRef,
  onDismiss,
  onOpenRecord,
}: {
  evidence: PrbEvidenceItem[];
  returnFocusRef: RefObject<HTMLButtonElement>;
  onDismiss: () => void;
  onOpenRecord: (id: string) => void;
}) {
  return (
    <Drawer
      title="Evidências usadas neste problema"
      description={`${formatPublicCount(evidence.length)} ${evidence.length === 1 ? "evidência" : "evidências"}`}
      returnFocusRef={returnFocusRef}
      onDismiss={onDismiss}
    >
      <ul className="prb-evidence-list">
        {evidence.map((item) => (
          <PrbEvidenceRow key={item.id} item={item} onOpenRecord={onOpenRecord} />
        ))}
      </ul>
    </Drawer>
  );
}

export function PrbDetailsPresentation({ data, onOpenGeneric, onBackToOverview, onViewHistory, titleRef, dossier = null, dossierIdentity }: PrbDetailsPresentationProps) {
  return (
    <article aria-labelledby="prb-identity-title" className="prb-details-view">
      <PrbHeader identity={data} active="details" onBackToOverview={onBackToOverview} onViewDetails={() => undefined} onViewHistory={onViewHistory} />

      <div className="shell-frame shell-frame--wide prb-details-frame">
        <PrbIdentityHeader identity={data} titleRef={titleRef} />
      </div>

      <PrbInvestigationStateSection data={data} />
      {data.status === "CLOSED" && <section className="shell-frame shell-frame--wide prb-details-frame" aria-labelledby="prb-closure-heading">
        <h2 id="prb-closure-heading">Encerramento</h2>
        <dl>
          {data.closureReason && <div><dt>Motivo</dt><dd>{publicEnumLabel("closure.reason", data.closureReason)}</dd></div>}
          {data.closureExplanation && <div><dt>Porque deixou de estar ativo</dt><dd>{data.closureExplanation}</dd></div>}
          {data.closureClosedAt && <div><dt>Data de encerramento</dt><dd><time dateTime={data.closureClosedAt}>{formatPublicDate(data.closureClosedAt)}</time></dd></div>}
          {data.reopenCondition && <div><dt>Condi&ccedil;&atilde;o para reabrir</dt><dd>{data.reopenCondition}</dd></div>}
          <div><dt>O que significa</dt><dd>{data.closureReason === "OUT_OF_SCOPE"
            ? "O Open Évora acompanha problemas da cidade de Évora. Este registo ficou fora do âmbito porque a informação disponível não é específica da cidade; o encerramento não é uma conclusão de que o problema não exista."
            : "O encerramento indica que este registo deixou de estar ativo no programa; não significa, por si só, que a condição cívica tenha desaparecido."}</dd></div>
        </dl>
        {data.closureReason === "OUT_OF_SCOPE" && <p className="prb-contribute-prompt">
          Tem informação sobre uma situação concreta na cidade de Évora? Pode partilhá-la para que a reabertura deste registo seja avaliada. <a href={`/contact?${new URLSearchParams({ type: "evidence", prb: data.problemId })}`}>Partilhar informação →</a>
        </p>}
      </section>}

      <div className="shell-frame shell-frame--wide prb-details-frame">
        <PrbCurrentReadingSection causalReading={data.causalReading} />
        <PrbOpenQuestionsSection problemId={data.problemId} questions={data.openQuestions} status={data.status} onOpenGeneric={onOpenGeneric} />
      </div>

      <PrbPathSection stages={data.pathStages} />
      <PrbAuditSection data={data} dossier={dossier} dossierIdentity={dossierIdentity} onOpenGeneric={onOpenGeneric} />
    </article>
  );
}
