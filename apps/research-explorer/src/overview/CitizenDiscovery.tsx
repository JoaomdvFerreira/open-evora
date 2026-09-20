import type { CitizenProblem, MaterialChangeEntry, ProblemSortOrder, TopicCategoryCount } from "./overviewStats";
import { formatOverviewCompactDate } from "./overviewStats";
import { describeTopic } from "../presentation/topicMapping";
import { IconSearch, IconTrendUp } from "../presentation/icons";
import { EvidenceStatus } from "../problem/InvestigationStatus";
import { publicEnumLabel } from "../presentation/presentation";

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
 * The toolbar's `Filtros` disclosure trigger (Overview final redesign, Phase
 * 1 — delta §4). A native `<button type="button">`, controlling the category
 * drawer below it via the standard disclosure pattern (`aria-expanded` +
 * `aria-controls`, no focus trap, no forced focus movement — see
 * OverviewPresentation.tsx's drawer-open state, which is local presentation
 * state only, never URL-synced/persisted). `aria-controls` always resolves to
 * the drawer's stable id: the drawer stays mounted and is hidden via the
 * native `hidden` attribute when collapsed, never removed from the DOM (see
 * `CategoryDrawer`'s own doc comment). When a topic — or the `Alterados esta
 * semana` shortcut (Phase 2, §8; the two are mutually exclusive, so at most
 * one ever applies) — is active and the drawer is closed, the trigger takes
 * a restrained active visual state and exposes the active selection's PT-PT
 * label in its own accessible name (`activeTopicLabel`) — never a separate
 * visible chip/badge next to it, which TARGET does not show.
 */
export function FiltrosToggle({ expanded, onToggle, controlsId, activeTopicLabel, id = "overview-filtros-toggle" }: {
  expanded: boolean;
  onToggle: () => void;
  controlsId: string;
  /** PT-PT label of the currently active category-drawer selection (a TEMA topic or `Alterados esta semana`), or `null` when `Todos`/neither is active. Folded into the accessible name only — never a separate visible badge. */
  activeTopicLabel: string | null;
  id?: string;
}) {
  const accessibleName = activeTopicLabel === null ? "Filtros" : `Filtros — ${activeTopicLabel}`;
  return (
    <button
      type="button"
      id={id}
      className="overview-filtros-toggle"
      aria-expanded={expanded}
      aria-controls={controlsId}
      aria-label={accessibleName}
      data-active={activeTopicLabel !== null}
      onClick={onToggle}
    >
      Filtros
    </button>
  );
}

/**
 * The category drawer's contents (Overview final redesign, Phase 1 — delta
 * §5, narrowed by the visual-convergence pass): `Todos` plus the canonical
 * TEMA topics that currently have at least one Problem, each with a real
 * count derived from the full unfiltered Problem set (never a fixture, never
 * a ranked/truncated top-N — see overviewStats.ts's
 * `allTopicCodes`/`topCategoryCounts` doc comments; the zero-count filtering
 * itself is presentation-only and lives in the caller, OverviewPresentation.tsx,
 * not here or in overviewStats.ts). Rendered in normal document flow directly
 * beneath the toolbar by the caller; this component itself has no open/closed
 * state or animation.
 *
 * Always kept mounted at its stable `id` so `FiltrosToggle`'s
 * `aria-controls` always resolves to a real element, open or collapsed (a
 * disclosure trigger's `aria-controls` must reference the controlled element
 * regardless of its current visibility). `hidden` is the sole visibility
 * switch: the native `hidden` attribute removes the drawer from the
 * accessibility tree, visual rendering, and the tab order when collapsed,
 * while `aria-expanded` on the trigger remains the actual source of
 * disclosure state. When not hidden, the drawer sits in normal document flow
 * beneath the toolbar exactly as before. Options wrap safely (`flex-wrap`)
 * rather than truncating at narrower widths.
 *
 * `Alterados esta semana` (Overview final redesign, Phase 2, §5) renders
 * last, after every normal topic — it is not a topic and carries no
 * canonical domain code, so it gets its own button/handler pair rather than
 * being folded into `categories`. It always renders, including at a
 * truthful count of `0` (§6 — intentional, never hidden or faked), and takes
 * a visually distinct (`overview-category-drawer-option--shortcut`) but
 * still restrained treatment. Selection here and normal-topic selection are
 * mutually exclusive; `Overview.tsx` owns that exclusivity via the two
 * separate `onChange`/`onAlteredThisWeekChange` callbacks, this component
 * only reflects whichever is currently active.
 */
export function CategoryDrawer({ id, hidden, categories, activeTopic, onChange, totalCount, alteredThisWeekSelected, alteredThisWeekCount, onAlteredThisWeekChange }: {
  id: string;
  /** True while the disclosure is collapsed — applies the native `hidden` attribute instead of unmounting. */
  hidden: boolean;
  categories: TopicCategoryCount[];
  activeTopic: string | null;
  onChange: (code: string | null) => void;
  /** The unfiltered Problem count — `Todos`'s own count, not affected by the current selection. */
  totalCount: number;
  /** Whether the `Alterados esta semana` shortcut is the current selection. */
  alteredThisWeekSelected: boolean;
  /** Distinct-Problem count for the shortcut — rendered even when `0`. */
  alteredThisWeekCount: number;
  onAlteredThisWeekChange: (selected: boolean) => void;
}) {
  return (
    <div id={id} hidden={hidden} className="overview-category-drawer" role="group" aria-label="Filtrar por tema">
      <button type="button" className="overview-category-drawer-option" aria-pressed={activeTopic === null && !alteredThisWeekSelected} onClick={() => onChange(null)}>
        <span>Todos</span> <span className="overview-category-drawer-count">{totalCount}</span>
      </button>
      {categories.map(({ code, count }) => (
        <button key={code} type="button" className="overview-category-drawer-option" aria-pressed={activeTopic === code} onClick={() => onChange(activeTopic === code ? null : code)}>
          <span>{describeTopic(code).label}</span> <span className="overview-category-drawer-count">{count}</span>
        </button>
      ))}
      <button
        type="button"
        className="overview-category-drawer-option overview-category-drawer-option--shortcut"
        aria-pressed={alteredThisWeekSelected}
        onClick={() => onAlteredThisWeekChange(!alteredThisWeekSelected)}
      >
        <span>Alterados esta semana</span> <span className="overview-category-drawer-count">{alteredThisWeekCount}</span>
      </button>
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

/** The toolbar's sort control — a native `<select>` so it stays a single accessible control without reimplementing listbox semantics. */
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
 * One full-width editorial row in the problem list (replaces the former card
 * grid — Overview visual-completion editorial-list redesign, following the
 * owner-approved TARGET reference). The top meta line renders three
 * independent, never-merged signals — PRB id, `evidenceStatus`, and
 * `lifecycleStatus` — plus the canonical `updatedAt` date aligned right.
 * `validationStatus` is deliberately not repeated here: it remains available
 * on the canonical Problem record itself (ProblemView), and TARGET's own
 * compact meta row does not carry a third status term either. Dropping it
 * from the row is a presentation choice only (AGENTS.md "Human-owned
 * decisions": no canonical dimension is merged or reinterpreted, one is
 * simply not duplicated at this density).
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
 * The row's `updatedAt` date renders in TARGET's compact `DD/MM` form
 * (Overview final redesign, Phase 3A, §5 — `formatOverviewCompactDate`,
 * shared with the material-change marker's own compact date below, though the
 * two remain distinct signals), while `<time dateTime>` keeps the full
 * canonical `YYYY-MM-DD` value. Scoped to this row only —
 * ProblemView/Records/History keep the shared `formatPublicDate` full-year
 * presentation untouched.
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
 *
 * `latestChange` (Overview final redesign, Phase 2, §2/§3; weekly-emphasis
 * correction) is this Problem's newest material-change entry that also falls
 * in the current `Europe/Lisbon` civil week
 * (overviewStats.ts's `latestMaterialChangeInCivilWeekByProblem`), or
 * `undefined` for a Problem with no qualifying entry this week — including a
 * Problem whose only authored history predates this week, which renders on
 * this same neutral path. The caller decides membership entirely; this
 * component only renders what it is given. When present, the row takes a
 * restrained `overview-problem-row--changed` variant (pale clay background +
 * a narrow left-edge accent, TARGET's own treatment) and gains a compact
 * marker near its top reading "ALTERAÇÃO REGISTADA · DD/MM" — truthful
 * generic copy naming only that *something* material changed and *when*,
 * never a categorical change-type label the canonical model cannot support
 * (no "NOVO REGISTO DE EVIDÊNCIA"/"ESTADO ALTERADO" — see this file's module
 * doc and overviewStats.ts's `formatOverviewCompactDate`). The marker
 * date is `latestChange.date` (the authored material-change date), never
 * `problem.updatedAt` — the two remain separate signals throughout Overview.
 * The variant never turns the row into a card: same flat full-width link,
 * same click target, same hover/focus treatment, only the background/edge
 * and the added marker change.
 */
export function ProblemRow({ problem, onExplore, latestChange }: { problem: CitizenProblem; onExplore: (id: string) => void; latestChange?: MaterialChangeEntry }) {
  const rowClassName = latestChange !== undefined ? "overview-problem-row overview-problem-row--changed" : "overview-problem-row";
  return (
    <li className={rowClassName}>
      <button type="button" className="overview-problem-row-link" aria-label={`Explorar ${problem.title}`} onClick={() => onExplore(problem.id)}>
        {latestChange !== undefined && (
          <p className="overview-problem-row-change-marker">
            <IconTrendUp />
            <span>ALTERAÇÃO REGISTADA</span> · <time dateTime={latestChange.date}>{formatOverviewCompactDate(latestChange.date)}</time>
          </p>
        )}
        <div className="overview-problem-row-meta">
          <code className="overview-problem-technical-id">{problem.id}</code>
          {problem.evidenceStatus !== null && <EvidenceStatus value={problem.evidenceStatus} form="reading" />}
          {problem.lifecycleStatus !== null && (
            <span className="overview-problem-row-lifecycle">{publicEnumLabel("status", problem.lifecycleStatus)}</span>
          )}
          {problem.updatedAt !== null && (
            <time className="overview-problem-row-date" dateTime={problem.updatedAt}>{formatOverviewCompactDate(problem.updatedAt)}</time>
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
