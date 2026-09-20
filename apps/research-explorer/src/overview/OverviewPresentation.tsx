import { useId, useState } from "react";
import {
  evidenceCountLabel,
  MAX_OVERVIEW_TOPIC_SHORTCUTS,
  problemCountLabel,
  sourceCountLabel,
  topCategoryCounts,
  type CitizenProblem,
  type MaterialChangeEntry,
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
  alteredThisWeekSelected,
  onAlteredThisWeekChange,
  alteredThisWeekCount,
  latestChangeByProblem,
  sortOrder,
  onSortOrderChange,
  onExploreProblem,
}: {
  problemCount: number;
  evidenceCount: number;
  /** Canonical `SRC-` record count (docs/datamodel.md §1) — same counting pattern as `evidenceCount`, shown in the Hero metrics as "Fontes" (the data model does not classify Sources as primary vs secondary/additional). */
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
  /** The normal TEMA filter dimension (Overview final redesign, Phase 1 — delta §6 removes evidence/validation/lifecycle filtering outright). `Overview.tsx` composes this together with `searchQuery`/`alteredThisWeekSelected` into `visibleProblems`; this component never filters on its own. */
  topicFilter: string | null;
  onTopicFilterChange: (value: string | null) => void;
  /** The `Alterados esta semana` category-drawer shortcut (Overview final redesign, Phase 2, §5) — mutually exclusive with `topicFilter`; `Overview.tsx` owns that exclusivity, this component only renders/toggles the current selection. */
  alteredThisWeekSelected: boolean;
  onAlteredThisWeekChange: (selected: boolean) => void;
  /** Distinct-Problem count for the shortcut (Phase 2, §6) — rendered even when `0` (intentional; never hidden or fabricated). */
  alteredThisWeekCount: number;
  /** Each Problem's newest material-change entry, keyed by `problemId` (Phase 2, §2/§3) — `undefined` for a Problem with no canonical history, which renders on the unchanged neutral row path. */
  latestChangeByProblem: Map<string, MaterialChangeEntry>;
  sortOrder: ProblemSortOrder;
  onSortOrderChange: (order: ProblemSortOrder) => void;
  onExploreProblem: (id: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();

  // Category drawer vocabulary (Overview final redesign, Phase 1 — delta §5;
  // narrowed to a top-5 shortlist in the visual-convergence pass, TARGET's
  // "Todos + top 5 real topics + Alterados esta semana" composition): the
  // top 5 canonical TEMA topics by real, unfiltered Problem count — never a
  // hardcoded topic list, and never TARGET's own fixture topic names.
  // `topCategoryCounts` already ranks by real descending count with a
  // deterministic PT-PT-label tie-break (overviewStats.ts's own doc
  // comment); this reuses that projection directly rather than re-deriving
  // ranking here. A topic with a genuinely zero current count cannot appear
  // in a top-5-by-count ranking, so the earlier explicit zero-count filter
  // is subsumed by the limit itself. `Todos` is never subject to this limit
  // — it always renders, over the full unfiltered Problem count.
  const allProblems = citizenProblems ?? [];
  const categories = topCategoryCounts(allProblems, MAX_OVERVIEW_TOPIC_SHORTCUTS);
  // `Filtros`'s active state/accessible name reflects either category-drawer
  // selection (Overview final redesign, Phase 2, §8) — the two are already
  // mutually exclusive (`Overview.tsx` owns that), so at most one label ever
  // applies here.
  const activeTopicLabel = alteredThisWeekSelected
    ? "Alterados esta semana"
    : topicFilter === null
      ? null
      : describeTopic(topicFilter).label;

  return (
    <section aria-labelledby="overview-heading" className="public-overview">
      <h2 id="overview-heading">Visão geral</h2>

      <div className="overview-hero">
        <div className="shell-frame shell-frame--wide">
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
                <span className="overview-metric-value">{problemCount}</span> {problemCountLabel(problemCount)}
              </li>
              <li className="overview-metric">
                <span className="overview-metric-value">{evidenceCount}</span> {evidenceCountLabel(evidenceCount)}
              </li>
              <li className="overview-metric">
                <span className="overview-metric-value">{sourceCount}</span> {sourceCountLabel(sourceCount)}
              </li>
            </ul>
          </div>
          {/* Deliberate negative space (TARGET) — no replacement content. */}
        </div>
      </div>

      {/* Discovery band (visual-convergence pass, §7/§8): one full-width warm
          band housing the toolbar and the category drawer as a single
          composition — no strong separator between them (the drawer's own
          top border is removed below; the band's outer rule is the only
          edge). Content stays aligned to the shared wide grid via the same
          `shell-frame shell-frame--wide` inner column every other band
          uses. */}
      <div className="overview-discovery">
        <div className="overview-toolbar shell-frame shell-frame--wide">
          <div className="overview-toolbar-controls">
            <FiltrosToggle
              expanded={drawerOpen}
              onToggle={() => setDrawerOpen((open) => !open)}
              controlsId={drawerId}
              activeTopicLabel={activeTopicLabel}
            />
            <CitizenSearchControl value={searchQuery} onChange={onSearchChange} />
            <div aria-live="polite" aria-atomic="true">
              {citizenProblems !== null && visibleProblems !== null && (
                <p className="overview-results-count">{formatPublicCount(visibleProblems.length)} problemas</p>
              )}
            </div>
          </div>
          <div className="overview-toolbar-meta">
            <SortControl value={sortOrder} onChange={onSortOrderChange} />
          </div>
        </div>

        <CategoryDrawer
          id={drawerId}
          hidden={!drawerOpen}
          categories={categories}
          activeTopic={topicFilter}
          onChange={onTopicFilterChange}
          totalCount={allProblems.length}
          alteredThisWeekSelected={alteredThisWeekSelected}
          alteredThisWeekCount={alteredThisWeekCount}
          onAlteredThisWeekChange={onAlteredThisWeekChange}
        />
      </div>

      <section id="overview-problemas" aria-label="Explorar problemas">
        {citizenProblems === null || visibleProblems === null ? (
          <div className="shell-frame shell-frame--wide"><ProgressMessage message="A carregar problemas…" /></div>
        ) : (
          <div className="overview-results">
            {visibleProblems.length === 0 ? (
              <p className="overview-empty-state shell-frame shell-frame--wide">Nenhum problema corresponde à pesquisa.</p>
            ) : (
              <ul className="overview-problem-list">
                {(paginatedProblems ?? []).map((problem) => (
                  <ProblemRow key={problem.id} problem={problem} onExplore={onExploreProblem} latestChange={latestChangeByProblem.get(problem.id)} />
                ))}
              </ul>
            )}

            {/* End-of-results row (Overview final redesign, Phase 3A, §2/§3):
                renders whenever there is at least one visible result — unlike
                the former pagination-only footer, which rendered nothing at
                all for a single-page result set. The status copy is
                deliberately truthful about what is and is not currently
                rendered: a single-page result set reads "N de N problemas"
                (every filtered result is on this one page), while a
                multi-page result set reads "Página X de Y · N problemas" —
                never a count that could be misread as "results currently
                rendered" or "results loaded so far" (§2). This status is
                informational only, not a second live region — the toolbar's
                own `aria-live` count above already announces filter/search
                changes (§8). `Propor um problema` (§3) is a normal outbound
                link to the existing `/contact` route, not a new submission
                workflow — the Contact page already owns public
                questions/suggestions/problems. Full-width band (§11), same
                shared wide grid as every other band. */}
            {visibleProblems.length > 0 && (
              <div className="overview-end-of-results">
                <div className="overview-end-of-results-inner shell-frame shell-frame--wide">
                  <p className="overview-end-of-results-status">
                    {pageCount > 1
                      ? `Página ${currentPage} de ${pageCount} · ${formatPublicCount(visibleProblems.length)} problemas`
                      : `${formatPublicCount(visibleProblems.length)} de ${formatPublicCount(visibleProblems.length)} problemas`}
                  </p>
                  {pageCount > 1 && (
                    <div className="overview-pagination-actions">
                      <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
                        Anterior
                      </button>
                      <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= pageCount}>
                        Seguinte
                      </button>
                    </div>
                  )}
                  <a className="overview-propose-problem" href="/contact">
                    Propor um problema
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
