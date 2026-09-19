import {
  allTopicCodes,
  countByCanonicalValues,
  countByLifecycleGroup,
  evidenceCountLabel,
  lifecycleGroupLabel,
  problemCountLabel,
  projectRecentDistinctProblems,
  sourceCountLabel,
  topCategoryCounts,
  totalRecordsLabel,
  type CitizenProblem,
  type LifecycleGroup,
  type MaterialChangeEntry,
  type ProblemSortOrder,
} from "./overviewStats";
import { formatPublicCount, formatPublicDate, formatPublicRelativeDays, publicCompactEnumLabel } from "../presentation/presentation";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { CategoryShortcuts, CitizenSearchControl, FilterRailGroup, ProblemRow, SortControl } from "./CitizenDiscovery";
import { describeTopic } from "../presentation/topicMapping";
import { canonicalEvidenceValues, canonicalValidationValues } from "../problem/stateVisuals";

const RECENT_UPDATES_LIMIT = 4;
const CATEGORY_SHORTCUT_LIMIT = 4;

export interface MaterialChangesPresentationState {
  entries: MaterialChangeEntry[];
  complete: boolean;
}

/**
 * Durable presentation-only Overview composition. Receives already-projected
 * data/state and callbacks; it must never reach into DataProvider, corpus,
 * routing, or canonical research state itself (see AGENTS.md canonical-state
 * integrity and docs/design/component-model.md §2.5 page-composition
 * boundary). `Overview.tsx` continues to own data loading, projection, and
 * URL/routing concerns; this component owns rendered structure only.
 */
export function OverviewPresentation({
  problemCount,
  evidenceCount,
  sourceCount,
  totalRecords,
  citizenProblems,
  visibleProblems,
  paginatedProblems,
  currentPage,
  pageCount,
  onPageChange,
  searchQuery,
  onSearchChange,
  topicFilter,
  onTopicFilterChange,
  evidenceFilter,
  onEvidenceFilterChange,
  validationFilter,
  onValidationFilterChange,
  lifecycleFilter,
  onLifecycleFilterChange,
  sortOrder,
  onSortOrderChange,
  materialChanges,
  onExploreProblem,
  onViewRecords,
}: {
  problemCount: number;
  evidenceCount: number;
  /** Canonical `SRC-` record count (docs/datamodel.md §1) — same counting pattern as `evidenceCount`, shown in the Hero footer ruler as "fontes primárias". */
  sourceCount: number;
  /** manifest.totalRecords — the same canonical corpus count as App.tsx's "Corpus: X registos" summary. `null` when the caller has none to give (e.g. a test); the metric is then omitted rather than fabricated. */
  totalRecords: number | null;
  citizenProblems: CitizenProblem[] | null;
  /** The full filtered+sorted result set (pre-pagination) — its length is the sole source for the results header's "X de Y problemas" count, never `paginatedProblems.length`. */
  visibleProblems: CitizenProblem[] | null;
  /** `visibleProblems` sliced to the current page (Overview visual-completion — pagination) — this is what actually renders as rows. */
  paginatedProblems: CitizenProblem[] | null;
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  /** Filter-rail state (Overview visual-completion — editorial list redesign). Each of the four rail groups (TEMA/EVIDÊNCIA/VALIDAÇÃO/ESTADO) is controlled independently — `Overview.tsx` composes them together with `searchQuery` into `visibleProblems`; this component never filters on its own. */
  topicFilter: string | null;
  onTopicFilterChange: (value: string | null) => void;
  evidenceFilter: string | null;
  onEvidenceFilterChange: (value: string | null) => void;
  validationFilter: string | null;
  onValidationFilterChange: (value: string | null) => void;
  /** ESTADO filters on the grouped lifecycle dimension (Aberto/Fechado), not the raw canonical `status` enum — see overviewStats.ts's `lifecycleGroupOf`. */
  lifecycleFilter: LifecycleGroup | null;
  onLifecycleFilterChange: (value: LifecycleGroup | null) => void;
  sortOrder: ProblemSortOrder;
  onSortOrderChange: (order: ProblemSortOrder) => void;
  materialChanges: MaterialChangesPresentationState | null;
  onExploreProblem: (id: string) => void;
  onViewRecords: () => void;
}) {
  // Recent updates is now the sole material-change surface in Overview (the
  // former lower "O que mudou recentemente" section was a duplicate of this
  // Hero panel and was removed). It reuses the same authored material-change
  // projection (no second data source — AGENTS.md canonical-state
  // integrity), narrowed to distinct Problems via `projectRecentDistinctProblems`
  // (deduplicates by canonical PRB id, keeping each Problem's newest entry,
  // before the 4-item limit — see that helper's own note on why order
  // matters here). The title stays the sole primary clickable line. Below it,
  // two secondary lines: (1) a topic/domain line joining every canonical
  // `domain` code the entry actually carries via the existing
  // `describeTopic` label lookup — all of the entry's codes are shown, never
  // one chosen as "primary" (each domain is a distinct, non-ranked
  // classification per topicMapping.ts; picking one would be a human-owned
  // semantic judgement this presentation component is not authorized to make
  // — AGENTS.md "Human-owned decisions"); (2) a PRB id / last-updated
  // metadata row. The date shown is the canonical PRB `updatedAt` (resolved
  // from the already-loaded `CitizenProblem`, keyed by `problemId` — never
  // `MaterialChangeEntry.date`, which is the authored history entry's own
  // date, not "when was this Problem last updated"), formatted with the
  // existing canonical date formatter (`formatPublicDate`). No TopicBadge/pill
  // in this compact Hero list — domain is rendered as plain restrained text
  // here, not as the discovery list's colored badge.
  const recentUpdates = materialChanges ? projectRecentDistinctProblems(materialChanges.entries, RECENT_UPDATES_LIMIT) : [];
  const updatedAtByProblemId = new Map((citizenProblems ?? []).map((problem) => [problem.id, problem.updatedAt]));
  const categoryShortcuts = topCategoryCounts(citizenProblems ?? [], CATEGORY_SHORTCUT_LIMIT);
  // materialChanges.entries is already sorted newest-first (projectMaterialChangeEntries),
  // so its first entry's date is the canonical latest material-change date — never a
  // separately computed "latest".
  const latestMaterialChangeDate = materialChanges?.entries[0]?.date ?? null;

  // Filter rail (Overview visual-completion — editorial list redesign; filter-
  // rail correction pass): four independent groups, one per canonical
  // dimension, each exposing the complete project filter vocabulary — every
  // canonical topic/domain code, evidence_status, validation_status, and
  // lifecycle group value, not only values present in the currently visible
  // result subset — and each counted across the full unfiltered
  // `citizenProblems` set (TARGET's own "Todos 12" pattern — counts describe
  // what's available to filter by, not the current result set, so choosing
  // one filter never hides another dimension's other options, and an option
  // with zero matches still renders rather than disappearing).
  // `allTopicCodes`/`topCategoryCounts` own TEMA's full code set and
  // per-topic counts; `countByCanonicalValues` zero-fills EVIDÊNCIA/
  // VALIDAÇÃO against their full canonical enum; `countByLifecycleGroup` owns
  // ESTADO's Aberto/Fechado grouping (never the raw six-value `status` enum,
  // and never merging an evidence/validation concept into this group).
  const allProblems = citizenProblems ?? [];
  const topicCodes = allTopicCodes();
  const topicCounts = new Map(topCategoryCounts(allProblems, topicCodes.length).map(({ code, count }) => [code, count]));
  const topicOptions = topicCodes.map((code) => ({ value: code, text: describeTopic(code).label, count: topicCounts.get(code) ?? 0 }));
  const evidenceOptions = countByCanonicalValues(allProblems, "evidenceStatus", canonicalEvidenceValues()).map(({ value, count }) => ({ value, text: publicCompactEnumLabel("evidence_status", value), count }));
  const validationOptions = countByCanonicalValues(allProblems, "validationStatus", canonicalValidationValues()).map(({ value, count }) => ({ value, text: publicCompactEnumLabel("validation_status", value), count }));
  const lifecycleOptions = countByLifecycleGroup(allProblems).map(({ value, count }) => ({ value, text: lifecycleGroupLabel(value as LifecycleGroup), count }));

  // Results header's compact active-filter summary (TARGET: "sem filtros
  // ativos" / a joined list of active selections) — text only, describing
  // filter state; it never re-derives or duplicates the live result count
  // itself, which stays owned by the aria-live region below.
  const activeFilterSummary = [
    topicFilter !== null && describeTopic(topicFilter).label,
    evidenceFilter !== null && publicCompactEnumLabel("evidence_status", evidenceFilter),
    validationFilter !== null && publicCompactEnumLabel("validation_status", validationFilter),
    lifecycleFilter !== null && lifecycleGroupLabel(lifecycleFilter),
  ].filter((value): value is string => value !== false);

  return (
    <section aria-labelledby="overview-heading" className="public-overview shell-frame shell-frame--wide">
      <h2 id="overview-heading">Visão geral</h2>

      <div className="overview-top-surface">
        <div className="overview-hero-content">
          <p className="overview-hero-eyebrow">
            <span className="overview-hero-eyebrow-chip">
              <span className="overview-hero-eyebrow-dot" aria-hidden="true">•</span> Projeto independente — não oficial
            </span>
          </p>
          <h3 className="overview-hero-headline">Investigamos problemas práticos que afetam Évora.</h3>
          <p className="overview-hero-supporting">
            Reunimos fontes e evidência para mostrar o que sabemos, o que ainda não sabemos e o que mudou.
            Cada leitura remete para registos identificáveis.
          </p>

          <div className="overview-hero-search-row">
            <CitizenSearchControl value={searchQuery} onChange={onSearchChange} />
            <a className="overview-hero-cta" href="#overview-problemas">Ver os {formatPublicCount(problemCount)} problemas</a>
          </div>

          <CategoryShortcuts categories={categoryShortcuts} onSelectCategory={onTopicFilterChange} />
        </div>

        <div className="overview-hero-recent" aria-labelledby="overview-hero-recent-heading">
          <div className="overview-hero-recent-header">
            <h3 id="overview-hero-recent-heading">Atualizado recentemente</h3>
            <button type="button" className="overview-hero-recent-viewall" onClick={onViewRecords}>Ver tudo</button>
          </div>

          {materialChanges === null ? (
            <ProgressMessage message="A carregar alterações recentes…" />
          ) : recentUpdates.length === 0 ? (
            <p className="material-change-empty-state">Ainda não existem alterações materiais registadas para apresentar.</p>
          ) : (
            <>
              <ul className="overview-hero-recent-list">
                {recentUpdates.map((entry) => {
                  const updatedAt = updatedAtByProblemId.get(entry.problemId) ?? null;
                  return (
                    <li key={`${entry.problemId}-${entry.date}-${entry.summary}`}>
                      <button type="button" className="overview-hero-recent-item" onClick={() => onExploreProblem(entry.problemId)}>
                        <span className="overview-hero-recent-item-title">{entry.problemTitle}</span>
                        <span className="overview-hero-recent-item-meta">
                          <span className="overview-hero-recent-item-identity">
                            <code className="technical-id">{entry.problemId}</code>
                            {entry.domainCodes.length > 0 && (
                              <span className="overview-hero-recent-item-topics">
                                · {entry.domainCodes.map((code) => describeTopic(code).label).join(" · ")}
                              </span>
                            )}
                          </span>
                          {updatedAt !== null && <time dateTime={updatedAt}>{formatPublicDate(updatedAt)}</time>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {/* Reuses the existing incomplete-history meaning (`materialChanges.complete`,
                  set by Overview.tsx when at least one PRB detail failed to load) rather than
                  inventing new copy/semantics — same empty-state paragraph treatment used
                  above, kept restrained (a caption, not an error banner) since the panel above
                  it is still showing whatever entries did load successfully. */}
              {!materialChanges.complete && (
                <p className="material-change-empty-state">Histórico recente incompleto — nem todos os registos puderam ser carregados.</p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="overview-hero-ruler">
        <ul className="overview-metrics" aria-label="Números da investigação">
          <li className="overview-metric">
            <span className="overview-metric-value">{problemCount}</span>
            <span className="overview-metric-label">{problemCountLabel(problemCount)}</span>
          </li>
          <li className="overview-metric">
            <span className="overview-metric-value">{evidenceCount}</span>
            <span className="overview-metric-label">{evidenceCountLabel(evidenceCount)}</span>
          </li>
          <li className="overview-metric">
            <span className="overview-metric-value">{sourceCount}</span>
            <span className="overview-metric-label">{sourceCountLabel(sourceCount)}</span>
          </li>
          {totalRecords !== null && (
            <li className="overview-metric">
              <span className="overview-metric-value">{totalRecords}</span>
              <span className="overview-metric-label">{totalRecordsLabel(totalRecords)}</span>
            </li>
          )}
        </ul>

        {/* Latest-update summary (TARGET): the canonical latest material-change
            date, i.e. the newest entry in the already newest-first-sorted
            `materialChanges.entries` projection (overviewStats.ts's
            `projectMaterialChangeEntries`) — never a separately computed
            "latest" and never `CitizenProblem.updatedAt` (a different,
            per-Problem canonical field; see the recent-updates list above).
            Omitted entirely when no material-change entry exists yet, rather
            than fabricating a summary. */}
        {latestMaterialChangeDate !== null && (
          <p className="overview-hero-ruler-latest">
            <span aria-hidden="true">↗</span> Última alteração {formatPublicRelativeDays(latestMaterialChangeDate)}
          </p>
        )}
      </div>

      <section id="overview-problemas" aria-label="Explorar problemas">
        {citizenProblems === null || visibleProblems === null ? (
          <ProgressMessage message="A carregar problemas…" />
        ) : (
          <div className="overview-discovery">
            {/* Filter rail — TEMA/EVIDÊNCIA/VALIDAÇÃO/ESTADO, each its own
                group backed by its own canonical field (never a single mixed
                "evidence state" grouping — see the field-specific helpers in
                overviewStats.ts). Composes with the Hero search in
                Overview.tsx's `visibleProblems`; no second filtering model. */}
            <aside className="overview-filter-rail" aria-label="Filtrar problemas">
              <FilterRailGroup label="Tema" options={topicOptions} totalCount={allProblems.length} activeValue={topicFilter} onChange={onTopicFilterChange} />
              <FilterRailGroup label="Evidência" options={evidenceOptions} totalCount={allProblems.length} activeValue={evidenceFilter} onChange={onEvidenceFilterChange} showAllOption={false} />
              <FilterRailGroup label="Validação" options={validationOptions} totalCount={allProblems.length} activeValue={validationFilter} onChange={onValidationFilterChange} showAllOption={false} />
              <FilterRailGroup label="Estado" options={lifecycleOptions} totalCount={allProblems.length} activeValue={lifecycleFilter} onChange={(value) => onLifecycleFilterChange(value as LifecycleGroup | null)} showAllOption={false} />
            </aside>

            <div className="overview-results">
              <div className="overview-results-header">
                <div className="overview-results-header-summary">
                  <div aria-live="polite" aria-atomic="true">
                    {visibleProblems.length === 0 ? (
                      <p className="overview-empty-state">Nenhum problema corresponde à pesquisa.</p>
                    ) : (
                      <p className="overview-results-count">{formatPublicCount(visibleProblems.length)} de {formatPublicCount(citizenProblems.length)} problemas</p>
                    )}
                  </div>
                  <p className="overview-results-filter-summary">
                    {activeFilterSummary.length === 0 ? "sem filtros ativos" : activeFilterSummary.join(" · ")}
                  </p>
                </div>
                <SortControl value={sortOrder} onChange={onSortOrderChange} />
              </div>

              {visibleProblems.length > 0 && (
                <ul className="overview-problem-list">
                  {(paginatedProblems ?? []).map((problem) => (
                    <ProblemRow key={problem.id} problem={problem} onExplore={onExploreProblem} />
                  ))}
                </ul>
              )}

              {/* Pagination footer (Overview visual-completion): only when
                  there is more than one page — a single-page result set gets
                  no footer at all, never a disabled/no-op one. Lives inside
                  `.overview-results`, the same column the results header and
                  problem rows already share, so its horizontal padding
                  matches theirs by construction rather than a duplicated
                  width calculation. */}
              {pageCount > 1 && (
                <div className="overview-pagination-footer">
                  <p className="overview-pagination-status">Página {currentPage} de {pageCount}</p>
                  <div className="overview-pagination-actions">
                    <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
                      Anterior
                    </button>
                    <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= pageCount}>
                      Seguinte
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
