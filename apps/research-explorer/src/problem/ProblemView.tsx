import { useEffect, useRef } from "react";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import { useProblemProjection } from "./useProblemProjection";
import type { EvidenceWithSources } from "./problemProjection";
import { ContributionChip } from "../records/ContributionChip";
import { summarizeContributions } from "./contributionSummary";
import { DISCLOSURE_FIELDS, DISCLOSURE_FIELD_LABELS, FIELD_CAPTIONS, glossFor, type FieldGloss } from "./statusGloss";
import { describeType, formatTypedId } from "../typeGlossary";
import { formatPublicCount, publicEnumLabel, publicFieldCaption } from "../presentation";
import { ContextTabs } from "../ContextTabs";

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Registo mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar o Problema",
  not_found: "Problema não encontrado",
  invalid_id: "Identificador de Problema inválido",
};

const PROBLEM_STATE_FIELDS = ["status", "validation_status", "evidence_status", "digital_tractability", "existing_solutions"] as const;
const ASSESSMENT_SUMMARY_FIELDS = ["assessment_status", "triage", "structure_action", "digital_leverage"] as const;

function fieldValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function AssessmentUnknowns({ record }: { record: Record<string, unknown> }) {
  const remainingGap = fieldValue(record, "remaining_gap");
  const unknowns = recordValue(record.critical_unknowns);
  return (
    <>
      {remainingGap !== null && (
        <p><strong>{publicFieldCaption("remaining_gap")}:</strong> {publicEnumLabel("remaining_gap", remainingGap)}</p>
      )}
      {unknowns && Object.keys(unknowns).length > 0 && (
        <section aria-label="Incertezas">
          <h5>Incertezas</h5>
          {Object.entries(unknowns).map(([id, value]) => {
            const unknown = recordValue(value);
            if (!unknown) return null;
            const question = fieldValue(unknown, "question");
            const impact = fieldValue(unknown, "decision_impact");
            const phase = fieldValue(unknown, "target_phase");
            const nextEvidence = stringValues(unknown.best_next_evidence);
            return (
              <section key={id} aria-label={`Incerteza ${id}`}>
                <h6>Incerteza {id}</h6>
                {question && <p><strong>Questão em aberto:</strong> {question}</p>}
                {impact && <p><strong>{publicFieldCaption("decision_impact")}:</strong> {publicEnumLabel("decision_impact", impact)}</p>}
                {phase && <p><strong>{publicFieldCaption("target_phase")}:</strong> {phase}</p>}
                {nextEvidence.length > 0 && (
                  <><strong>Próxima evidência:</strong><ul>{nextEvidence.map((item, index) => <li key={index}>{item}</li>)}</ul></>
                )}
              </section>
            );
          })}
        </section>
      )}
    </>
  );
}

function evidenceSourceLabel(record: Record<string, unknown>): string | null {
  const source = recordValue(record.source);
  if (!source) return null;
  const publisher = fieldValue(source, "publisher");
  const title = fieldValue(source, "title");
  return [publisher, title].filter((value): value is string => value !== null).join(" — ") || null;
}

function TypedLinkButton({ detail, onOpenGeneric, suffix }: { detail: RecordDetail; onOpenGeneric: (id: string) => void; suffix?: string }) {
  return (
    <button type="button" onClick={() => onOpenGeneric(detail.id)}>
      {formatTypedId(detail.type, detail.id)}
      {suffix ? ` — ${suffix}` : ""}
    </button>
  );
}

/**
 * Presentation labels retain canonical values only as a safe fallback when a
 * future value has no approved PT-PT mapping.
 */
function StatusChip({ field, value }: { field: string; value: string }) {
  const gloss = glossFor(field, value);
  const caption = FIELD_CAPTIONS[field] ?? field;
  return (
    <span className="status-chip" aria-label={`${caption}: ${gloss ? gloss.label : publicEnumLabel(field, value)}`}>
      {gloss ? gloss.label : publicEnumLabel(field, value)}
    </span>
  );
}

/**
 * Problem-scoped breadcrumb ("Localização"): mirrors Record Detail's
 * Breadcrumb (RecordDetailPanel.tsx) so both record-scoped surfaces share
 * one navigational pattern (design-system.md §3) — "Registos › PRB-0006".
 * Replaces the earlier plain "← Voltar aos Registos" button with the same
 * onBackToRecords action.
 */
function ProblemBreadcrumb({ problemId, onBackToRecords }: { problemId: string; onBackToRecords: () => void }) {
  return (
    <nav aria-label="Localização" className="detail-breadcrumb">
      <button type="button" onClick={onBackToRecords}>
        Registos
      </button>
      <span aria-hidden="true" className="detail-breadcrumb-separator">
        ›
      </span>
      <span className="detail-breadcrumb-current">{problemId}</span>
    </nav>
  );
}

/**
 * Section anchors for Problem View's desktop reading rail (design-system.md
 * §3's ContextTabs sits above this; this is the "Nesta página" index the
 * rail links into) — kept as one ordered list so the rail and the section
 * `id`s below can never drift apart.
 */
const PROBLEM_SECTIONS = [
  { id: "problem-estado-atual", label: "Estado atual" },
  { id: "problem-avaliacao", label: "Avaliação" },
  { id: "problem-evidencia", label: "Evidência" },
  { id: "problem-incertezas", label: "Incertezas e lacunas" },
  { id: "problem-hipoteses", label: "Hipóteses" },
] as const;

/**
 * Desktop reading rail (scope §3/§4): reuses Record Detail's rail/layout
 * pattern (`.record-detail-rail`, `.detail-rail-type-note`,
 * `.detail-rail-actions`) rather than inventing a second sticky-rail
 * treatment. Provides a "Nesta página" index, the same canonical
 * contribution chips already used inline (no new semantics), and a link
 * into the full Reading Guide — never a duplicate of it. Desktop-only by
 * CSS (hidden under the existing 767px breakpoint, matching
 * `.record-detail-rail`); compact gets the equivalent index in-flow via
 * `ProblemHelpDisclosure` instead (Slice UX-B §4).
 */
function ProblemReadingRail() {
  return (
    <aside className="record-detail-rail problem-reading-rail" aria-label="Nesta página">
      <div className="detail-rail-type-note">
        <p>
          Cada secção reúne o que já é canónico sobre este Problema — nenhuma ordem ou destaque aqui implica classificação, força ou
          confiança.
        </p>
      </div>
      <nav aria-label="Nesta página" className="problem-rail-nav">
        <h4 className="detail-panel-label">Nesta página</h4>
        <ul>
          {PROBLEM_SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="problem-rail-contributions">
        <h4 className="detail-panel-label">Contribuição canónica</h4>
        <div className="problem-rail-contribution-chips">
          {["CONFIRMS", "REFINES", "CONTRADICTS", "CURRENT-STATE-UPDATE", "EXISTING-SOLUTION", "PLANNED-SOLUTION", "NEW-CANDIDATE"].map(
            (value) => (
              <ContributionChip key={value} value={value} />
            ),
          )}
        </div>
      </div>
      <div className="detail-rail-actions">
        <a href="#reading-guide">Ver a Orientação completa do Explorer</a>
      </div>
    </aside>
  );
}

/**
 * Point-of-use Problem orientation (REDUX-007): a small, collapsed-by-default
 * native disclosure explaining what a PRB- record is and, where canonically
 * grounded, what this Problem's own current status values mean — not a
 * modal, not a tour, no first-session/localStorage state. Points to the full
 * Reading Guide for deeper orientation rather than duplicating it.
 */
function ProblemHelpDisclosure({ record }: { record: Record<string, unknown> }) {
  const explainedFields: { field: string; value: string; gloss: FieldGloss | null }[] = [];
  for (const field of DISCLOSURE_FIELDS) {
    const value = fieldValue(record, field);
    if (value !== null) explainedFields.push({ field, value, gloss: glossFor(field, value) });
  }

  return (
    <details className="problem-help">
      <summary>O que é um Problema, e o que significam os estados abaixo?</summary>
      <div className="problem-help-content">
        <p>
          <strong>Problema (PRB-):</strong> {describeType("PRB-").description}
        </p>
        {explainedFields.map(({ field, value, gloss }) => (
          <p key={field}>
            <strong>{DISCLOSURE_FIELD_LABELS[field]}:</strong> {gloss ? gloss.label : publicEnumLabel(field, value)}
            {gloss?.explanation ? ` — ${gloss.explanation}` : ""}
          </p>
        ))}
        {/* Compact substitute for the desktop reading rail's "Nesta página" index (UX-B §4) —
            hidden on desktop (index.css) where `.record-detail-rail`'s own nav already covers it. */}
        <nav aria-label="Nesta página (versão compacta)" className="problem-help-section-index">
          <p className="problem-help-section-index-label">Nesta página:</p>
          <ul>
            {PROBLEM_SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <p>
          <a href="#reading-guide">Ver a Orientação completa do Explorer →</a>
        </p>
      </div>
    </details>
  );
}

/**
 * Scannable summary of contribution *occurrences* across the evidence list
 * (REDUX-002's aggregate-legend pattern) — never a ranking, score, or
 * inferred strength; a tally of already-explicit canonical values. Shown
 * only when at least one evidence item carries a recorded contribution.
 */
function ContributionOccurrenceSummary({ evidence }: { evidence: EvidenceWithSources[] }) {
  const summary = summarizeContributions(evidence);
  if (summary.occurrences.length === 0) return null;

  return (
    <div className="contribution-summary" aria-label="Resumo de ocorrências de contribuição canónica">
      <p className="contribution-summary-caption">
        Ocorrências de contribuição canónica nesta lista — nenhuma implica força, confiança ou classificação.
      </p>
      <p className="contribution-summary-counts">
        {summary.itemCount} {summary.itemCount === 1 ? "item de evidência" : "itens de evidência"} · {summary.occurrenceCount}{" "}
        {summary.occurrenceCount === 1 ? "ocorrência de contribuição" : "ocorrências de contribuição"}
        {summary.occurrenceCount !== summary.itemCount
          ? " (uma evidência pode ter mais do que uma contribuição — estas contagens não correspondem ao número de itens de evidência)"
          : ""}
      </p>
      <div className="contribution-summary-chips">
        {summary.occurrences.map(({ value, count }) => (
          <span key={value} className="contribution-summary-chip">
            <ContributionChip value={value} /> <span className="contribution-count">{count} {count === 1 ? "ocorrência" : "ocorrências"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface ProblemContentProps {
  dataProvider: DataProvider;
  lookup: Map<string, RecordSummary>;
  problemId: string;
  onOpenGeneric: (id: string) => void;
  onBackToRecords: () => void;
  onViewInGraph: (id: string) => void;
}

function ProblemContent({ dataProvider, lookup, problemId, onOpenGeneric, onBackToRecords, onViewInGraph }: ProblemContentProps) {
  const state = useProblemProjection(dataProvider, lookup, problemId);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const focusedEntryRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusedEntryRef.current === problemId) return;
    if (state.status === "ready") {
      headingRef.current?.focus();
      focusedEntryRef.current = problemId;
    } else if (state.status === "error") {
      errorRef.current?.focus();
      focusedEntryRef.current = problemId;
    }
  }, [problemId, state.status]);

  if (state.status === "idle") return null;

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite">
        A carregar Problema {state.id}…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div ref={errorRef} role="alert" tabIndex={-1}>
        <h2>{ERROR_TITLES[state.error.kind] ?? "Não foi possível carregar o Problema"}</h2>
        <p>{state.error.message}</p>
        <button type="button" onClick={state.retry}>
          Tentar novamente
        </button>
      </div>
    );
  }

  const { problem, assessments, evidence, hypotheses } = state.projection;
  const record = problem.record as Record<string, unknown>;
  const title = fieldValue(record, "title") ?? problem.id;

  const unknownsSections = assessments
    .map((assessment) => {
      const asmRecord = assessment.record as Record<string, unknown>;
      const picked: Record<string, unknown> = {};
      if (asmRecord.remaining_gap !== undefined) picked.remaining_gap = asmRecord.remaining_gap;
      if (asmRecord.critical_unknowns !== undefined) picked.critical_unknowns = asmRecord.critical_unknowns;
      return Object.keys(picked).length > 0 ? { assessment, picked } : null;
    })
    .filter((x): x is { assessment: RecordDetail; picked: Record<string, unknown> } => x !== null);

  return (
    <article aria-labelledby="problem-heading" className="problem-view">
      <ProblemBreadcrumb problemId={problem.id} onBackToRecords={onBackToRecords} />

      <ContextTabs prbId={problem.id} active="problem" onOpenGeneric={onOpenGeneric} onViewAsProblem={onOpenGeneric} onViewInGraph={onViewInGraph} />

      <ProblemHelpDisclosure record={record} />

      <div className="record-detail-columns problem-view-columns">
        <div className="record-detail-main">
          <div className="problem-identity">
            <div className="problem-identity-id">{problem.id}</div>
            <h2 ref={headingRef} id="problem-heading" tabIndex={-1} className="problem-identity-title">
              {title}
            </h2>
          </div>
          <p className="problem-file-path">
            <code>{problem.file}</code>
          </p>

          <section id="problem-estado-atual" aria-label="Estado atual" className="problem-section">
            <h3 className="detail-panel-label">Estado atual</h3>
            <div className="status-chip-row">
              {PROBLEM_STATE_FIELDS.map((key) => {
                const value = fieldValue(record, key);
                return value === null ? null : <StatusChip key={key} field={key} value={value} />;
              })}
            </div>
            {fieldValue(record, "problem_statement") && <p className="problem-statement">{fieldValue(record, "problem_statement")}</p>}
          </section>

          <section id="problem-avaliacao" aria-label="Avaliação" className="problem-section">
            <h3 className="detail-panel-label">Avaliação</h3>
            {assessments.length === 0 ? (
              <p>Nenhuma avaliação associada.</p>
            ) : (
              <ul className="assessment-list">
                {assessments.map((assessment) => {
                  const asmRecord = assessment.record as Record<string, unknown>;
                  return (
                    <li key={assessment.id} className="assessment-card">
                      <TypedLinkButton detail={assessment} onOpenGeneric={onOpenGeneric} />
                      <dl className="assessment-fields">
                        {ASSESSMENT_SUMMARY_FIELDS.map((key) => {
                          const value = fieldValue(asmRecord, key);
                          return value === null ? null : (
                            <div key={key}>
                              <dt>{publicFieldCaption(key)}</dt>
                              <dd>{publicEnumLabel(key, value)}</dd>
                            </div>
                          );
                        })}
                      </dl>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="problem-evidencia" aria-label="Evidência" className="problem-section">
            <h3 className="detail-panel-label">Evidência ({formatPublicCount(evidence.length)})</h3>
            <ContributionOccurrenceSummary evidence={evidence} />
            {evidence.length === 0 ? (
              <p>Nenhuma evidência associada.</p>
            ) : (
              <ul className="evidence-list">
                {evidence.map(({ detail, sources }) => {
                  const evidenceRecord = detail.record as Record<string, unknown>;
                  const analysis = recordValue(evidenceRecord.analysis);
                  const contributions = stringValues(analysis?.contribution);
                  const observation = recordValue(evidenceRecord.observation);
                  const observationSummary = observation ? fieldValue(observation, "summary") : null;
                  const provenance = evidenceSourceLabel(evidenceRecord);

                  return (
                    <li key={detail.id} className="evidence-card">
                      <div className="evidence-item-header">
                        <TypedLinkButton detail={detail} onOpenGeneric={onOpenGeneric} suffix={fieldValue(evidenceRecord, "type") ? publicEnumLabel("type", fieldValue(evidenceRecord, "type")!) : undefined} />
                        <span className="evidence-item-contributions" aria-label="Contribuição canónica">
                          {contributions.length > 0 ? (
                            contributions.map((value, index) => <ContributionChip key={`${value}-${index}`} value={value} />)
                          ) : (
                            <span className="field-empty">contribuição não registada.</span>
                          )}
                        </span>
                      </div>
                      {observationSummary && (
                        <p className="evidence-observation">
                          <strong>Observação:</strong> {observationSummary}
                        </p>
                      )}
                      {(provenance || sources.length > 0) && (
                        <p className="evidence-provenance">
                          <strong>Origem:</strong> {provenance ?? "registo de fonte relacionado abaixo"}.
                        </p>
                      )}
                      {sources.length > 0 && (
                        <ul aria-label={`Registos de fonte relacionados com ${detail.id}`} className="evidence-sources">
                          {sources.map((source) => (
                            <li key={source.id}>
                              <TypedLinkButton
                                detail={source}
                                onOpenGeneric={onOpenGeneric}
                                suffix={fieldValue(source.record as Record<string, unknown>, "publisher") ?? undefined}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="problem-incertezas" aria-label="Incertezas e lacunas" className="problem-section">
            <h3 className="detail-panel-label">Incertezas e lacunas conhecidas</h3>
            {unknownsSections.length === 0 ? (
              <p>Nenhuma registada nas avaliações associadas.</p>
            ) : (
              unknownsSections.map(({ assessment, picked }) => (
                <div key={assessment.id} className="unknowns-card">
                  <h4>{formatTypedId(assessment.type, assessment.id)}</h4>
                  <AssessmentUnknowns record={picked} />
                </div>
              ))
            )}
          </section>

          <section id="problem-hipoteses" aria-label="Hipóteses" className="problem-section">
            <h3 className="detail-panel-label">Hipóteses</h3>
            {hypotheses.length === 0 ? (
              <p>Nenhuma hipótese associada.</p>
            ) : (
              <ul>
                {hypotheses.map((hypothesis) => (
                  <li key={hypothesis.id}>
                    <TypedLinkButton detail={hypothesis} onOpenGeneric={onOpenGeneric} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <ProblemReadingRail />
      </div>
    </article>
  );
}

interface ProblemViewProps {
  dataProvider: DataProvider;
  problemId: string | null;
  onOpenGeneric: (id: string) => void;
  onBackToRecords: () => void;
  onViewInGraph: (id: string) => void;
}

/**
 * The RE-03 specialised Problem view: "what do we currently know about this
 * problem, why do we believe it, and what remains uncertain?" — a
 * presentation projection over the existing generic DataProvider (see
 * problemProjection.ts), not a new persistence model. Any future/unknown
 * record type reached from here (assessment, evidence, source, hypothesis)
 * still opens through the same generic detail renderer via onOpenGeneric.
 */
export function ProblemView({ dataProvider, problemId, onOpenGeneric, onBackToRecords, onViewInGraph }: ProblemViewProps) {
  const indexState = useRecordIndex(dataProvider);

  if (indexState.status === "loading") {
    return (
      <p role="status" aria-live="polite">
        A carregar…
      </p>
    );
  }

  if (indexState.status === "error") {
    return (
      <div role="alert">
        <h2>Não foi possível carregar os registos</h2>
          <p>{indexState.error.message}</p>
          <button type="button" onClick={indexState.retry}>
            Tentar novamente
          </button>
      </div>
    );
  }

  if (problemId === null) {
    return (
      <div>
        <p>Nenhum Problema selecionado.</p>
        <button type="button" onClick={onBackToRecords}>
          Procurar um Problema em Registos
        </button>
      </div>
    );
  }

  const summary = indexState.lookup.get(problemId);
  if (summary && summary.type !== "PRB-") {
    return (
      <div role="alert">
        <h2>Este registo não é um Problema</h2>
        <p>{formatTypedId(summary.type, problemId)} não pode ser aberto como vista de Problema.</p>
        <button type="button" onClick={() => onOpenGeneric(problemId)}>
          Ver detalhe genérico
        </button>
      </div>
    );
  }

  return (
    <ProblemContent
      dataProvider={dataProvider}
      lookup={indexState.lookup}
      problemId={problemId}
      onOpenGeneric={onOpenGeneric}
      onBackToRecords={onBackToRecords}
      onViewInGraph={onViewInGraph}
    />
  );
}
