import type { CitizenProblem, ProblemSortOrder, TopicCategoryCount } from "./overviewStats";
import { describeTopic } from "../presentation/topicMapping";
import { IconSearch } from "../presentation/icons";
import { EvidenceStatus } from "../problem/InvestigationStatus";
import { formatPublicDate, publicEnumLabel } from "../presentation/presentation";

export function CitizenSearchControl({ value, onChange, id = "overview-search-input" }: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="overview-search" role="search">
      <label htmlFor={id} className="overview-search-label">Pesquisar problemas</label>
      <span className="overview-search-input-wrap">
        <IconSearch className="overview-search-icon" />
        <input id={id} type="search" className="overview-search-input" placeholder="Pesquisar problemas em Évora…" value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </div>
  );
}

/**
 * Compact Hero shortcut chips (Overview visual-completion delta §4) — a
 * lightweight affordance distinct from `TopicFilterGroup` below, which
 * remains the full reusable topic-filter control for a dedicated
 * search/exploration page. Each chip sets the *same canonical TEMA filter
 * state the filter rail owns* (`onSelectCategory`, called with the
 * canonical `domain` code — never the PT-PT display label — exactly like
 * `FilterRailGroup`'s own `onChange`) and then moves the reader to the
 * in-page problem list (`#overview-problemas`, the same in-page target the
 * Hero search action reuses). There is no second filter/search
 * implementation here — this component only ever forwards the canonical
 * code it was given to the caller's single TEMA filter state.
 */
export function CategoryShortcuts({ categories, onSelectCategory }: {
  categories: TopicCategoryCount[];
  onSelectCategory: (code: string) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div className="overview-category-shortcuts-row">
      <span className="overview-category-shortcuts-intro">Ou entre por:</span>
      <ul className="overview-category-shortcuts" aria-label="Atalhos por tema">
        {categories.map(({ code, count }) => (
          <li key={code}>
            <a
              className="overview-category-shortcut"
              href="#overview-problemas"
              onClick={() => onSelectCategory(code)}
            >
              {describeTopic(code).label} <span className="overview-category-shortcut-count">{count}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TopicFilterGroup({ topicCodes, activeTopic, onChange }: {
  topicCodes: string[];
  activeTopic: string | null;
  onChange: (code: string | null) => void;
}) {
  if (topicCodes.length === 0) return null;
  return (
    <div className="overview-topic-filters" role="group" aria-label="Filtrar por tema">
      <button type="button" className="overview-topic-filter" aria-pressed={activeTopic === null} onClick={() => onChange(null)}>Todos</button>
      {topicCodes.map((code) => (
        <button key={code} type="button" className="overview-topic-filter" aria-pressed={activeTopic === code} onClick={() => onChange(activeTopic === code ? null : code)}>{describeTopic(code).label}</button>
      ))}
    </div>
  );
}

const SORT_LABELS: Record<ProblemSortOrder, string> = {
  id: "identificador",
  // Deliberately not "última alteração" — that phrase names the Hero
  // ruler's authored material-change date (a different canonical signal;
  // see OverviewPresentation.tsx). This sorts by the Problem's own
  // `updatedAt`, so it is labelled "última atualização" instead.
  updatedAt: "última atualização",
};

/** The results header's sort control — a native `<select>` so it stays a single accessible control without reimplementing listbox semantics. */
export function SortControl({ value, onChange, id = "overview-sort" }: {
  value: ProblemSortOrder;
  onChange: (order: ProblemSortOrder) => void;
  id?: string;
}) {
  return (
    <p className="overview-sort-control">
      <label htmlFor={id}>Ordenar por</label>{" "}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as ProblemSortOrder)}>
        {(Object.entries(SORT_LABELS) as [ProblemSortOrder, string][]).map(([order, text]) => (
          <option key={order} value={order}>{text}</option>
        ))}
      </select>
    </p>
  );
}

/**
 * One filter-rail group (TEMA / EVIDÊNCIA / VALIDAÇÃO / ESTADO) in the
 * editorial problem-list redesign. Every group is single-select with an
 * inline count per option (TARGET's "Aberto 8" pattern), backed by whichever
 * canonical field/count list the caller supplies — this component holds no
 * field-specific logic itself, so the four rail groups stay visually
 * identical while each still composes against its own distinct canonical
 * dimension (`overviewStats.ts`'s `countByDimension`/`relevantTopicCodes`+
 * `topCategoryCounts` own that per-field counting; this component only
 * renders whatever list it is given). Never collapses two dimensions into
 * one group — the caller renders one `FilterRailGroup` per dimension, each
 * with its own `aria-label`.
 *
 * `showAllOption` (default `true`) controls whether a visible "Todos" reset
 * row is rendered (filter-rail correction pass §3) — TEMA keeps it as the
 * explicit topic reset; EVIDÊNCIA/VALIDAÇÃO/ESTADO omit it since their
 * internal no-filter (`null`) state is still reachable by clicking the
 * currently-selected option again, which already toggles back to `null`
 * below regardless of `showAllOption`. Hiding the row never removes the
 * no-filter state itself, only this one extra permanent entry point to it.
 */
export function FilterRailGroup({ label, options, totalCount, activeValue, onChange, showAllOption = true }: {
  label: string;
  options: { value: string; text: string; count: number }[];
  /** The unfiltered "Todos" count — the total Problems this dimension could ever match, not affected by this group's own selection. */
  totalCount: number;
  activeValue: string | null;
  onChange: (value: string | null) => void;
  showAllOption?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div className="overview-filter-rail-group" role="group" aria-label={label}>
      <h3 className="overview-filter-rail-heading">{label}</h3>
      <div className="overview-filter-rail-options">
        {showAllOption && (
          <button type="button" className="overview-filter-rail-option" aria-pressed={activeValue === null} onClick={() => onChange(null)}>
            <span>Todos</span> <span className="overview-filter-rail-count">{totalCount}</span>
          </button>
        )}
        {options.map(({ value, text, count }) => (
          <button key={value} type="button" className="overview-filter-rail-option" aria-pressed={activeValue === value} onClick={() => onChange(activeValue === value ? null : value)}>
            <span>{text}</span> <span className="overview-filter-rail-count">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * One full-width editorial row in the problem list (replaces the former card
 * grid — Overview visual-completion editorial-list redesign, following the
 * owner-approved TARGET reference). The top meta line renders three
 * independent, never-merged signals — PRB id, `evidenceStatus`, and
 * `lifecycleStatus` — plus the canonical `updatedAt` date aligned right.
 * `validationStatus` is deliberately not repeated here: it remains available
 * through the canonical filter rail (VALIDAÇÃO), and TARGET's own compact
 * meta row does not carry a third status term either. Dropping it from the
 * row is a presentation choice only — `matchesValidationFilter` and the
 * VALIDAÇÃO rail group are unaffected (AGENTS.md "Human-owned decisions": no
 * canonical dimension is merged or reinterpreted, one is simply not
 * duplicated at this density).
 *
 * `evidenceStatus` uses the existing restrained `reading` chip
 * (InvestigationStatus.tsx's `EvidenceStatus`, bounded `ui-inline-label`
 * anatomy, its own tone+icon) — the same production reading presentation
 * used elsewhere, not a new badge. `lifecycleStatus` is plain secondary text
 * (`publicEnumLabel`, no caption prefix, no chip) since the row's own
 * position already establishes it as a Problem's state, matching TARGET's
 * plain "{{ p.estado }}" term. Never concatenates a caption directly against
 * a value (the former "Estado do problemaAberto" adjacency) — each meta
 * fragment is its own flex/inline-flex item.
 *
 * Topics render as quiet inline text (`describeTopic(code).label`, joined),
 * not `TopicBadge` chip UI — this list is metadata under the row, not a
 * filterable control; the filter rail already owns the chip-like affordance
 * for topic selection. Every canonical domain code is still shown, none
 * chosen as "primary" (AGENTS.md "Human-owned decisions" — same rule
 * `topCategoryCounts` already documents).
 *
 * TARGET's per-row "11 registos · 5 fontes" counts are deliberately not
 * reproduced: `CitizenProblem` exposes no such field, and inventing one here
 * would mean either fabricating data or adding ad-hoc graph traversal outside
 * this visual pass's scope.
 *
 * The whole row is the primary click target (an anchor-like button covering
 * the row), matching TARGET's row-as-link treatment, while staying reachable
 * as a single named control for assistive tech (`aria-label` carries the
 * title, exactly as the former "Explorar {title}" action did).
 */
export function ProblemRow({ problem, onExplore }: { problem: CitizenProblem; onExplore: (id: string) => void }) {
  return (
    <li className="overview-problem-row">
      <button type="button" className="overview-problem-row-link" aria-label={`Explorar ${problem.title}`} onClick={() => onExplore(problem.id)}>
        <div className="overview-problem-row-meta">
          <code className="overview-problem-technical-id">{problem.id}</code>
          {problem.evidenceStatus !== null && <EvidenceStatus value={problem.evidenceStatus} form="reading" />}
          {problem.lifecycleStatus !== null && (
            <span className="overview-problem-row-lifecycle">{publicEnumLabel("status", problem.lifecycleStatus)}</span>
          )}
          {problem.updatedAt !== null && (
            <time className="overview-problem-row-date" dateTime={problem.updatedAt}>{formatPublicDate(problem.updatedAt)}</time>
          )}
        </div>
        <h4 className="overview-problem-title">{problem.title}</h4>
        {problem.problemStatement !== null && <p className="overview-problem-statement">{problem.problemStatement}</p>}
        {problem.domainCodes.length > 0 && (
          <p className="overview-problem-topics">
            {problem.domainCodes.map((code) => describeTopic(code).label).join(", ")}
          </p>
        )}
      </button>
    </li>
  );
}
