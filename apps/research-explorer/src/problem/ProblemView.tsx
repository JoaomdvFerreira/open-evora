import { useEffect, useRef, type RefObject } from "react";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import { useProblemProjection } from "./useProblemProjection";
import type { EvidenceWithSources } from "./problemProjection";
import { ContributionChip } from "../records/ContributionChip";
import { summarizeContributions } from "./contributionSummary";
import { DISCLOSURE_FIELDS, DISCLOSURE_FIELD_LABELS, FIELD_CAPTIONS, glossFor, type FieldGloss } from "./statusGloss";
import { describeType, formatTypedId } from "../typeGlossary";
import { formatPublicCount, publicEnumLabel } from "../presentation";
import { ContextTabs } from "../ContextTabs";

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Registo mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar o Problema",
  not_found: "Problema não encontrado",
  invalid_id: "Identificador de Problema inválido",
};

/** PI-02B header: compact canonical investigation-state chips — status, evidence_status, validation_status only, per scope. */
const HEADER_STATE_FIELDS = ["status", "evidence_status", "validation_status"] as const;

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

/** `geography.area` (with `geography.level` as public-labelled context) — omitted entirely when either canonical part is absent, never inferred. */
function geographySummary(record: Record<string, unknown>): string | null {
  const geography = recordValue(record.geography);
  if (!geography) return null;
  const area = fieldValue(geography, "area");
  const level = fieldValue(geography, "level");
  if (!area) return null;
  return level ? `${area} (${publicEnumLabel("geography", level)})` : area;
}

/**
 * `decision_basis.scope` is authored prose per dimension (geography/population/temporal),
 * plus an explicit `bounded` boolean — never merged into a single derived sentence.
 * Returns only the dimensions actually present on record.
 */
interface DecisionBasisScope {
  geography: string | null;
  population: string | null;
  temporal: string | null;
  bounded: boolean | null;
}

function decisionBasisScope(record: Record<string, unknown>): DecisionBasisScope | null {
  const decisionBasis = recordValue(record.decision_basis);
  const scope = decisionBasis ? recordValue(decisionBasis.scope) : null;
  if (!scope) return null;
  const geography = fieldValue(scope, "geography");
  const population = fieldValue(scope, "population");
  const temporal = fieldValue(scope, "temporal");
  const bounded = typeof scope.bounded === "boolean" ? scope.bounded : null;
  if (!geography && !population && !temporal && bounded === null) return null;
  return { geography, population, temporal, bounded };
}

function decisionBasisField(record: Record<string, unknown>, ...path: string[]): string | null {
  let current: Record<string, unknown> | null = recordValue(record.decision_basis);
  for (let i = 0; i < path.length - 1; i += 1) {
    current = current ? recordValue(current[path[i]]) : null;
  }
  return current ? fieldValue(current, path[path.length - 1]) : null;
}

/** `decision_basis.corroboration_statement` / `decision_basis.independence_assessment` — authored prose only, no derived score. */
function decisionBasisText(record: Record<string, unknown>, field: string): string | null {
  return decisionBasisField(record, field);
}

/**
 * `decision_basis.supporting_evidence` / `decision_basis.boundary_evidence`
 * — EVD-* reference lists, authored exactly as recorded. `getPath` on a
 * missing/malformed field yields an empty list, never a fabricated one.
 */
function decisionBasisEvidenceIds(record: Record<string, unknown>, field: string): string[] {
  const decisionBasis = recordValue(record.decision_basis);
  return decisionBasis ? stringValues(decisionBasis[field]) : [];
}

/**
 * PI-02D: `investigation.open_questions[]` — an array of independently
 * authored items, each with its own optional fields. Only `question` is
 * treated as required (it is the item's primary text); every other field is
 * rendered conditionally and never fabricated when absent.
 */
interface OpenQuestion {
  question: string;
  whyOpen: string | null;
  currentAction: string | null;
  latestResult: string | null;
  resolutionCondition: string | null;
  evidenceIds: string[];
}

function openQuestions(record: Record<string, unknown>): OpenQuestion[] {
  const investigation = recordValue(record.investigation);
  const rawList = investigation ? investigation.open_questions : null;
  if (!Array.isArray(rawList)) return [];

  const items: OpenQuestion[] = [];
  for (const raw of rawList) {
    const item = recordValue(raw);
    const question = item ? fieldValue(item, "question") : null;
    if (!item || !question) continue;
    items.push({
      question,
      whyOpen: fieldValue(item, "why_open"),
      currentAction: fieldValue(item, "current_action"),
      latestResult: fieldValue(item, "latest_result"),
      resolutionCondition: fieldValue(item, "resolution_condition"),
      evidenceIds: stringValues(item.evidence),
    });
  }
  return items;
}

/**
 * `decision_basis.contradiction_search` — authored `performed`/`summary`
 * plus its own evidence list. `performed: false` is presented as-authored,
 * never read or reframed as a negative finding.
 */
interface ContradictionSearch {
  performed: boolean | null;
  summary: string | null;
  evidenceIds: string[];
}

function contradictionSearch(record: Record<string, unknown>): ContradictionSearch | null {
  const decisionBasis = recordValue(record.decision_basis);
  const search = decisionBasis ? recordValue(decisionBasis.contradiction_search) : null;
  if (!search) return null;
  const performed = typeof search.performed === "boolean" ? search.performed : null;
  const summary = fieldValue(search, "summary");
  const evidenceIds = stringValues(search.evidence);
  if (performed === null && !summary && evidenceIds.length === 0) return null;
  return { performed, summary, evidenceIds };
}

interface EvidenceGroups {
  supporting: EvidenceWithSources[];
  boundary: EvidenceWithSources[];
  other: EvidenceWithSources[];
}

/**
 * PI-02C §3 partition: deterministic, category-exclusive, dedup by ID —
 * `decision_basis.supporting_evidence` first, then `decision_basis.boundary_evidence`,
 * then every remaining top-level `evidence` ID not already placed in either
 * category. An item already claimed by "supporting" is never repeated under
 * "boundary"/"other" even if it happens to also appear in those lists; this
 * is a partition, not a set of overlapping tags. Membership is authored-list
 * membership only — "boundary" carries no negative/contradictory meaning
 * beyond that it was authored as boundary evidence.
 */
function groupEvidenceByDecisionBasis(record: Record<string, unknown>, evidence: EvidenceWithSources[]): EvidenceGroups {
  const supportingIds = new Set(decisionBasisEvidenceIds(record, "supporting_evidence"));
  const boundaryIds = new Set(decisionBasisEvidenceIds(record, "boundary_evidence"));
  const topLevelEvidenceIds = new Set(stringValues(record.evidence));

  const byId = new Map(evidence.map((item) => [item.detail.id, item]));
  const placed = new Set<string>();

  const supporting: EvidenceWithSources[] = [];
  for (const id of supportingIds) {
    const item = byId.get(id);
    if (item && !placed.has(id)) {
      supporting.push(item);
      placed.add(id);
    }
  }

  const boundary: EvidenceWithSources[] = [];
  for (const id of boundaryIds) {
    const item = byId.get(id);
    if (item && !placed.has(id)) {
      boundary.push(item);
      placed.add(id);
    }
  }

  const other: EvidenceWithSources[] = [];
  for (const id of topLevelEvidenceIds) {
    const item = byId.get(id);
    if (item && !placed.has(id)) {
      other.push(item);
      placed.add(id);
    }
  }

  return { supporting, boundary, other };
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
 * Problem-scoped breadcrumb ("Localização"): visually mirrors Record
 * Detail's Breadcrumb (RecordDetailPanel.tsx) — same navigational pattern
 * (design-system.md §3) — but Problem View is a public problem-reading
 * surface, not conceptually a child of Records (UX-D §2), so its first
 * breadcrumb action returns to Overview ("Visão geral › PRB-0006"), not
 * Registos. Generic Record Detail keeps its own Registos-based breadcrumb
 * unchanged.
 */
function ProblemBreadcrumb({ problemId, onBackToOverview }: { problemId: string; onBackToOverview: () => void }) {
  return (
    <nav aria-label="Localização" className="detail-breadcrumb">
      <button type="button" onClick={onBackToOverview}>
        Visão geral
      </button>
      <span aria-hidden="true" className="detail-breadcrumb-separator">
        ›
      </span>
      <span className="detail-breadcrumb-current">{problemId}</span>
    </nav>
  );
}

/**
 * Section anchors for Problem View's desktop reading rail (this is the
 * "Nesta página" index the rail links into) — kept as one ordered list so
 * the rail and the section `id`s below can never drift apart.
 */
const PROBLEM_SECTIONS = [
  { id: "problem-estado-atual", label: "Estado atual" },
  { id: "problem-evidencia", label: "Evidência" },
] as const;

/**
 * Desktop reading rail (scope §3/§4, UX-C §3): reuses Record Detail's
 * rail/layout pattern (`.record-detail-rail`, `.detail-rail-type-note`)
 * rather than inventing a second sticky-rail treatment. Provides lightweight
 * contextual orientation and a "Nesta página" index — the global
 * ReadingGuide no longer exists on this surface (UX-C §3), so this rail is
 * Problem View's own, self-sufficient orientation, not a link into it.
 * Desktop-only by CSS (hidden under the existing 767px breakpoint, matching
 * `.record-detail-rail`); compact gets the equivalent index in-flow via
 * `ProblemHelpDisclosure` instead (Slice UX-B §4).
 */
function ProblemReadingRail() {
  return (
    <aside className="record-detail-rail problem-reading-rail">
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
    </aside>
  );
}

/**
 * Point-of-use Problem orientation (REDUX-007): a small, collapsed-by-default
 * native disclosure explaining what a PRB- record is and, where canonically
 * grounded, what this Problem's own current status values mean — not a
 * modal, not a tour, no first-session/localStorage state. Self-contained
 * (UX-C §3): the global ReadingGuide no longer exists on Problem View, so
 * this does not point into it.
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
      </div>
    </details>
  );
}

/**
 * PI-02B header: what/where/who at a glance, plus compact canonical
 * investigation-state chips. Currentness/scope render only as a short,
 * labelled presence indicator here — never the full authored sentence
 * (that lives in `ProblemCurrentStateSection` below, so the two never repeat
 * the same prose). Every item is omitted, not fabricated, when its
 * canonical field is absent.
 */
function ProblemHeader({
  problemId,
  record,
  headingRef,
}: {
  problemId: string;
  record: Record<string, unknown>;
  headingRef: RefObject<HTMLHeadingElement>;
}) {
  const title = fieldValue(record, "title") ?? problemId;
  const problemStatement = fieldValue(record, "problem_statement");
  const geography = geographySummary(record);
  const affectedPopulations = stringValues(record.affected_populations);
  const currentnessAssessment = decisionBasisField(record, "currentness", "assessment");
  const scope = decisionBasisScope(record);

  return (
    <div className="problem-identity">
      <div className="problem-identity-id">{problemId}</div>
      <h2 ref={headingRef} id="problem-heading" tabIndex={-1} className="problem-identity-title">
        {title}
      </h2>
      {problemStatement && <p className="problem-statement problem-header-statement">{problemStatement}</p>}

      <dl className="problem-header-facts">
        {geography && (
          <div className="problem-header-fact">
            <dt>Onde</dt>
            <dd>{geography}</dd>
          </div>
        )}
        {affectedPopulations.length > 0 && (
          <div className="problem-header-fact">
            <dt>Quem é afetado</dt>
            <dd>{affectedPopulations.join(", ")}</dd>
          </div>
        )}
        {currentnessAssessment && (
          <div className="problem-header-fact">
            <dt>Atualidade da evidência</dt>
            <dd>Avaliação de atualidade disponível — ver &ldquo;Estado atual&rdquo; abaixo.</dd>
          </div>
        )}
        {scope && (
          <div className="problem-header-fact">
            <dt>Âmbito</dt>
            <dd>{scope.bounded === true ? "Delimitado" : scope.bounded === false ? "Não delimitado" : "Âmbito registado"} — ver &ldquo;Estado atual&rdquo; abaixo.</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * PI-02B §"Estado atual": compact canonical investigation-state chips
 * (always rendered, same landmark/anchor as before) plus, conditionally,
 * one labelled item per authored `decision_basis` field — no synthesis
 * across them and no fallback conclusion when a field is absent. `scope`
 * renders each authored dimension (geography/population/temporal) plus the
 * explicit `bounded` boolean, exactly as authored.
 */
function ProblemCurrentStateSection({ record }: { record: Record<string, unknown> }) {
  const manifestationSummary = decisionBasisField(record, "manifestation", "summary");
  const consequenceSummary = decisionBasisField(record, "consequence", "summary");
  const currentnessAssessment = decisionBasisField(record, "currentness", "assessment");
  const scope = decisionBasisScope(record);

  return (
    <section id="problem-estado-atual" aria-label="Estado atual" className="problem-section">
      <h3 className="detail-panel-label">Estado atual</h3>

      <div className="status-chip-row">
        {HEADER_STATE_FIELDS.map((key) => {
          const value = fieldValue(record, key);
          return value === null ? null : <StatusChip key={key} field={key} value={value} />;
        })}
      </div>

      {manifestationSummary && (
        <div className="problem-current-state-item">
          <h4>O que observamos</h4>
          <p>{manifestationSummary}</p>
        </div>
      )}

      {consequenceSummary && (
        <div className="problem-current-state-item">
          <h4>Consequências conhecidas</h4>
          <p>{consequenceSummary}</p>
        </div>
      )}

      {currentnessAssessment && (
        <div className="problem-current-state-item">
          <h4>Atualidade</h4>
          <p>{currentnessAssessment}</p>
        </div>
      )}

      {scope && (
        <div className="problem-current-state-item">
          <h4>Âmbito conhecido</h4>
          <dl className="problem-scope-grid">
            {scope.geography && (
              <div className="problem-scope-item">
                <dt>Geografia</dt>
                <dd>{scope.geography}</dd>
              </div>
            )}
            {scope.population && (
              <div className="problem-scope-item">
                <dt>População</dt>
                <dd>{scope.population}</dd>
              </div>
            )}
            {scope.temporal && (
              <div className="problem-scope-item">
                <dt>Período</dt>
                <dd>{scope.temporal}</dd>
              </div>
            )}
            {scope.bounded !== null && (
              <div className="problem-scope-item">
                <dt>Delimitado</dt>
                <dd>{scope.bounded ? "Sim" : "Não"}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </section>
  );
}

/**
 * PI-02B/C §2 "O que sustenta esta leitura": conditional on `decision_basis`
 * authored prose only — `corroboration_statement` as the main explanatory
 * text, `independence_assessment` as a secondary, explicitly labelled item.
 * No confidence score, ranking, or extra interpretation is added; the
 * section itself is omitted when neither field is authored.
 */
function ProblemSupportSection({ record }: { record: Record<string, unknown> }) {
  const corroborationStatement = decisionBasisText(record, "corroboration_statement");
  const independenceAssessment = decisionBasisText(record, "independence_assessment");

  if (!corroborationStatement && !independenceAssessment) return null;

  return (
    <section id="problem-sustentacao" aria-label="O que sustenta esta leitura" className="problem-section">
      <h3 className="detail-panel-label">O que sustenta esta leitura</h3>
      {corroborationStatement && <p className="problem-support-statement">{corroborationStatement}</p>}
      {independenceAssessment && (
        <div className="problem-current-state-item">
          <h4>Independência da evidência</h4>
          <p>{independenceAssessment}</p>
        </div>
      )}
    </section>
  );
}

/**
 * One evidence item's card — canonical ID, existing-contribution chips
 * (or the already-established "not registered" fallback), observation
 * summary, and linked sources. Shared by every PI-02C evidence group so
 * "supporting"/"boundary"/"other" render with identical presentation; only
 * the grouping is new; the card itself carries no ranking beyond the
 * already-authored contribution values.
 */
function EvidenceCard({ detail, sources, onOpenGeneric }: EvidenceWithSources & { onOpenGeneric: (id: string) => void }) {
  const evidenceRecord = detail.record as Record<string, unknown>;
  const analysis = recordValue(evidenceRecord.analysis);
  const contributions = stringValues(analysis?.contribution);
  const observation = recordValue(evidenceRecord.observation);
  const observationSummary = observation ? fieldValue(observation, "summary") : null;
  const provenance = evidenceSourceLabel(evidenceRecord);

  return (
    <li className="evidence-card">
      <div className="evidence-item-header">
        <TypedLinkButton
          detail={detail}
          onOpenGeneric={onOpenGeneric}
          suffix={fieldValue(evidenceRecord, "type") ? publicEnumLabel("type", fieldValue(evidenceRecord, "type")!) : undefined}
        />
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
              <TypedLinkButton detail={source} onOpenGeneric={onOpenGeneric} suffix={fieldValue(source.record as Record<string, unknown>, "publisher") ?? undefined} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * PI-02C §3 evidence group — one labelled `<ul>` per category, omitted when
 * empty. Category order (supporting, boundary, other) matches the reading
 * priority in the task spec, not a strength/confidence ranking.
 */
function EvidenceGroup({ label, items, onOpenGeneric }: { label: string; items: EvidenceWithSources[]; onOpenGeneric: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="evidence-group">
      <h4>
        {label} ({formatPublicCount(items.length)})
      </h4>
      <ul className="evidence-list">
        {items.map((item) => (
          <EvidenceCard key={item.detail.id} {...item} onOpenGeneric={onOpenGeneric} />
        ))}
      </ul>
    </div>
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
    <div className="contribution-summary" aria-label="Papel destes registos nesta leitura">
      <p className="contribution-summary-caption">
        Papel destes registos nesta leitura — os papéis indicados não representam força, confiança ou classificação.
      </p>
      <p className="contribution-summary-counts">
        {summary.itemCount} {summary.itemCount === 1 ? "registo" : "registos"} · {summary.occurrenceCount}{" "}
        {summary.occurrenceCount === 1 ? "papel registado" : "papéis registados"}
        {summary.occurrenceCount !== summary.itemCount ? " (um registo pode ter mais do que um papel nesta leitura)" : ""}
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

/**
 * PI-02D compact EVD- reference row — reuses the existing `TypedLinkButton`
 * record-navigation behaviour, but never the full `EvidenceCard` (that stays
 * exclusive to the Evidência section, per scope). Omitted entirely when no
 * referenced ID resolves to an already-loaded evidence detail; an ID that
 * cannot be resolved is silently skipped rather than shown as broken.
 */
function OpenQuestionEvidenceRefs({
  evidenceIds,
  evidenceById,
  onOpenGeneric,
}: {
  evidenceIds: string[];
  evidenceById: Map<string, RecordDetail>;
  onOpenGeneric: (id: string) => void;
}) {
  const details = evidenceIds.map((id) => evidenceById.get(id)).filter((detail): detail is RecordDetail => detail !== undefined);
  if (details.length === 0) return null;

  return (
    <div className="open-question-evidence-refs">
      <span className="open-question-evidence-refs-label">Evidência relacionada:</span>
      <ul className="open-question-evidence-refs-list">
        {details.map((detail) => (
          <li key={detail.id}>
            <TypedLinkButton detail={detail} onOpenGeneric={onOpenGeneric} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** PI-02D one `investigation.open_questions[]` item — every field but `question` is conditional. */
function OpenQuestionItem({
  item,
  evidenceById,
  onOpenGeneric,
}: {
  item: OpenQuestion;
  evidenceById: Map<string, RecordDetail>;
  onOpenGeneric: (id: string) => void;
}) {
  return (
    <li className="open-question-item">
      <p className="open-question-question">{item.question}</p>
      {item.whyOpen && (
        <div className="problem-current-state-item">
          <h4>Porque continua em aberto</h4>
          <p>{item.whyOpen}</p>
        </div>
      )}
      {item.currentAction && (
        <div className="problem-current-state-item">
          <h4>O que estamos a fazer</h4>
          <p>{item.currentAction}</p>
        </div>
      )}
      {item.latestResult && (
        <div className="problem-current-state-item">
          <h4>O que aprendemos mais recentemente</h4>
          <p>{item.latestResult}</p>
        </div>
      )}
      {item.resolutionCondition && (
        <div className="problem-current-state-item">
          <h4>O que permitiria esclarecer</h4>
          <p>{item.resolutionCondition}</p>
        </div>
      )}
      <OpenQuestionEvidenceRefs evidenceIds={item.evidenceIds} evidenceById={evidenceById} onOpenGeneric={onOpenGeneric} />
    </li>
  );
}

/** PI-02D "Procura de evidência contraditória" — authored status/summary only, never interpreted. */
function ContradictionSearchItem({
  search,
  evidenceById,
  onOpenGeneric,
}: {
  search: ContradictionSearch;
  evidenceById: Map<string, RecordDetail>;
  onOpenGeneric: (id: string) => void;
}) {
  return (
    <li className="open-question-item">
      <p className="open-question-question">Procura de evidência contraditória</p>
      {search.performed !== null && (
        <div className="problem-current-state-item">
          <h4>Estado</h4>
          <p>{search.performed ? "Realizada" : "Não realizada"}</p>
        </div>
      )}
      {search.summary && (
        <div className="problem-current-state-item">
          <h4>Resumo</h4>
          <p>{search.summary}</p>
        </div>
      )}
      <OpenQuestionEvidenceRefs evidenceIds={search.evidenceIds} evidenceById={evidenceById} onOpenGeneric={onOpenGeneric} />
    </li>
  );
}

/**
 * PI-02D "O que ainda não sabemos — e o que estamos a fazer": renders
 * `investigation.open_questions[]` independently, each item optional-field by
 * optional-field, plus `decision_basis.contradiction_search` as a final,
 * separately labelled item. Omitted entirely when neither exists; no
 * synthesis or fallback text is added when a problem has no active action or
 * latest result.
 */
function ProblemOpenQuestionsSection({
  record,
  evidence,
  onOpenGeneric,
}: {
  record: Record<string, unknown>;
  evidence: EvidenceWithSources[];
  onOpenGeneric: (id: string) => void;
}) {
  const questions = openQuestions(record);
  const search = contradictionSearch(record);

  if (questions.length === 0 && !search) return null;

  const evidenceById = new Map(evidence.map((item) => [item.detail.id, item.detail]));

  return (
    <section id="problem-questoes-abertas" aria-label="O que ainda não sabemos — e o que estamos a fazer" className="problem-section">
      <h3 className="detail-panel-label">O que ainda não sabemos — e o que estamos a fazer</h3>
      <ul className="open-question-list">
        {questions.map((item, index) => (
          <OpenQuestionItem key={index} item={item} evidenceById={evidenceById} onOpenGeneric={onOpenGeneric} />
        ))}
        {search && <ContradictionSearchItem search={search} evidenceById={evidenceById} onOpenGeneric={onOpenGeneric} />}
      </ul>
    </section>
  );
}

interface ProblemContentProps {
  dataProvider: DataProvider;
  lookup: Map<string, RecordSummary>;
  problemId: string;
  onOpenGeneric: (id: string) => void;
  onBackToOverview: () => void;
  onViewInGraph: (id: string) => void;
}

function ProblemContent({ dataProvider, lookup, problemId, onOpenGeneric, onBackToOverview, onViewInGraph }: ProblemContentProps) {
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

  const { problem, evidence } = state.projection;
  const record = problem.record as Record<string, unknown>;

  return (
    <article aria-labelledby="problem-heading" className="problem-view shell-frame">
      <ProblemBreadcrumb problemId={problem.id} onBackToOverview={onBackToOverview} />

      <ContextTabs prbId={problem.id} active="problem" onOpenGeneric={onOpenGeneric} onViewAsProblem={onOpenGeneric} onViewInGraph={onViewInGraph} />

      <ProblemHelpDisclosure record={record} />

      <div className="record-detail-columns problem-view-columns">
        <div className="record-detail-main">
          <ProblemHeader problemId={problem.id} record={record} headingRef={headingRef} />
          <p className="problem-file-path">
            <code>{problem.file}</code>
          </p>

          <ProblemCurrentStateSection record={record} />

          <ProblemSupportSection record={record} />

          <ProblemOpenQuestionsSection record={record} evidence={evidence} onOpenGeneric={onOpenGeneric} />

          <section id="problem-evidencia" aria-label="Evidência" className="problem-section">
            <h3 className="detail-panel-label">Registos de evidência associados ({formatPublicCount(evidence.length)})</h3>
            <ContributionOccurrenceSummary evidence={evidence} />
            {evidence.length === 0 ? (
              <p>Nenhuma evidência associada.</p>
            ) : (
              (() => {
                const groups = groupEvidenceByDecisionBasis(record, evidence);
                return (
                  <>
                    <EvidenceGroup label="Evidência que suporta" items={groups.supporting} onOpenGeneric={onOpenGeneric} />
                    <EvidenceGroup label="Evidência que limita a conclusão" items={groups.boundary} onOpenGeneric={onOpenGeneric} />
                    <EvidenceGroup label="Outra evidência relacionada" items={groups.other} onOpenGeneric={onOpenGeneric} />
                  </>
                );
              })()
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
  /** UX-D §2: the Problem breadcrumb's own first action — Problem View reads as "Visão geral › PRB-*", not a child of Records. */
  onBackToOverview: () => void;
  onViewInGraph: (id: string) => void;
}

/**
 * The RE-03 specialised Problem view: "what do we currently know about this
 * problem, why do we believe it, and what remains uncertain?" — a
 * presentation projection over the existing generic DataProvider (see
 * problemProjection.ts), not a new persistence model. Any future/unknown
 * record type reached from here (evidence, source) still opens through the
 * same generic detail renderer via onOpenGeneric.
 */
export function ProblemView({ dataProvider, problemId, onOpenGeneric, onBackToRecords, onBackToOverview, onViewInGraph }: ProblemViewProps) {
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
      onBackToOverview={onBackToOverview}
      onViewInGraph={onViewInGraph}
    />
  );
}
