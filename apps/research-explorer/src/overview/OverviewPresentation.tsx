import { useId, useState } from "react";
import {
  allTopicCodes,
  evidenceCountLabel,
  problemCountLabel,
  sourceCountLabel,
  topCategoryCounts,
  type CitizenProblem,
  type ProblemSortOrder,
} from "./overviewStats";
import { formatPublicCount } from "../presentation/presentation";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { CategoryDrawer, CitizenSearchControl, FiltrosToggle, ProblemRow, SortControl } from "./CitizenDiscovery";
import { describeTopic } from "../presentation/topicMapping";

/**
 * Durable presentation-only Overview composition. Receives already-projected
 * data/state and callbacks; it must never reach into DataProvider, corpus,
 * routing, or canonical research state itself (see AGENTS.md canonical-state
 * integrity and docs/design/component-model.md §2.5 page-composition
 * boundary). `Overview.tsx` continues to own data loading, projection, and
 * URL/routing concerns; this component owns rendered structure only.
 *
 * Final macro-structure (Overview final redesign, Phase 1): Hero → toolbar →
 * collapsible category drawer → full-width problem list. The category-drawer
 * open/closed state is local presentation state, owned entirely here — never
 * URL-synced, persisted, or promoted into `Overview.tsx`'s canonical/data
 * state (delta §4).
 */
export function OverviewPresentation({
  problemCount,
  evidenceCount,
  sourceCount,
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
  sortOrder,
  onSortOrderChange,
  onExploreProblem,
}: {
  problemCount: number;
  evidenceCount: number;
  /** Canonical `SRC-` record count (docs/datamodel.md §1) — same counting pattern as `evidenceCount`, shown in the Hero metrics as "fontes primárias". */
  sourceCount: number;
  citizenProblems: CitizenProblem[] | null;
  /** The full filtered+sorted result set (pre-pagination) — its length is the sole source for the toolbar's "N problemas" count, never `paginatedProblems.length`. */
  visibleProblems: CitizenProblem[] | null;
  /** `visibleProblems` sliced to the current page (Overview visual-completion — pagination) — this is what actually renders as rows. */
  paginatedProblems: CitizenProblem[] | null;
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  /** The sole remaining Overview filter dimension (Overview final redesign, Phase 1 — delta §6 removes evidence/validation/lifecycle filtering outright). `Overview.tsx` composes this together with `searchQuery` into `visibleProblems`; this component never filters on its own. */
  topicFilter: string | null;
  onTopicFilterChange: (value: string | null) => void;
  sortOrder: ProblemSortOrder;
  onSortOrderChange: (order: ProblemSortOrder) => void;
  onExploreProblem: (id: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();

  // Category drawer vocabulary (Overview final redesign, Phase 1 — delta
  // §5): the complete canonical TEMA vocabulary, in the same stable
  // deterministic order every phase of Overview has used, each with a real
  // count derived from the full unfiltered Problem set — never a fixture,
  // never a ranked/truncated top-N (the drawer replaces the former Hero
  // top-4 category shortcuts entirely; see overviewStats.ts's
  // `allTopicCodes`/`topCategoryCounts`).
  const allProblems = citizenProblems ?? [];
  const topicCodes = allTopicCodes();
  const topicCounts = new Map(topCategoryCounts(allProblems, topicCodes.length).map(({ code, count }) => [code, count]));
  const categories = topicCodes.map((code) => ({ code, count: topicCounts.get(code) ?? 0 }));
  const activeTopicLabel = topicFilter === null ? null : describeTopic(topicFilter).label;

  return (
    <section aria-labelledby="overview-heading" className="public-overview shell-frame shell-frame--wide">
      <h2 id="overview-heading">Visão geral</h2>

      <div className="overview-hero">
        <div className="overview-hero-content">
          <p className="overview-hero-eyebrow">
            <span className="overview-hero-eyebrow-chip">
              <span className="overview-hero-eyebrow-dot" aria-hidden="true">•</span> Projeto independente — não oficial
            </span>
          </p>
          <h3 className="overview-hero-headline">Problemas práticos que afetam Évora.</h3>
          <p className="overview-hero-supporting">O que sabemos, o que falta saber, e a fonte de cada afirmação.</p>

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
          </ul>
        </div>
        {/* Deliberate negative space (TARGET) — no replacement content. */}
      </div>

      <div className="overview-toolbar">
        <div className="overview-toolbar-controls">
          <FiltrosToggle
            expanded={drawerOpen}
            onToggle={() => setDrawerOpen((open) => !open)}
            controlsId={drawerId}
            activeTopicLabel={activeTopicLabel}
          />
          <CitizenSearchControl value={searchQuery} onChange={onSearchChange} />
        </div>
        <div className="overview-toolbar-meta">
          <div aria-live="polite" aria-atomic="true">
            {citizenProblems !== null && visibleProblems !== null && (
              <p className="overview-results-count">{formatPublicCount(visibleProblems.length)} problemas</p>
            )}
          </div>
          <SortControl value={sortOrder} onChange={onSortOrderChange} />
        </div>
      </div>

      {drawerOpen && (
        <CategoryDrawer id={drawerId} categories={categories} activeTopic={topicFilter} onChange={onTopicFilterChange} totalCount={allProblems.length} />
      )}

      <section id="overview-problemas" aria-label="Explorar problemas">
        {citizenProblems === null || visibleProblems === null ? (
          <ProgressMessage message="A carregar problemas…" />
        ) : (
          <div className="overview-results">
            {visibleProblems.length === 0 ? (
              <p className="overview-empty-state">Nenhum problema corresponde à pesquisa.</p>
            ) : (
              <ul className="overview-problem-list">
                {(paginatedProblems ?? []).map((problem) => (
                  <ProblemRow key={problem.id} problem={problem} onExplore={onExploreProblem} />
                ))}
              </ul>
            )}

            {/* Pagination footer (Overview visual-completion): only when
                there is more than one page — a single-page result set gets
                no footer at all, never a disabled/no-op one. */}
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
        )}
      </section>
    </section>
  );
}
