import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import "../index.css";
import "../styles/topic.css";
import { OverviewPresentation } from "./OverviewPresentation";
import { ExplorerHeader } from "../app/ExplorerHeader";
import { PublicFooter } from "../app/TrustPage";
import {
  matchesCitizenSearch,
  matchesTopicFilter,
  overviewPageCount,
  paginateProblems,
  sortProblems,
  type CitizenProblem,
  type MaterialChangeEntry,
  type ProblemSortOrder,
} from "./overviewStats";

const meta = { title: "Overview/Full composition" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Realistic multi-problem fixture. Every problem id is a synthetic PRB-XXXX
 * per docs/design/foundations.md; content covers the state combinations
 * Overview.tsx itself renders differently (all three dimensions present,
 * only some present, multiple topics, long content) so full-page composition
 * exercises real rhythm rather than a single repeated card.
 */
const problems: CitizenProblem[] = [
  {
    id: "PRB-XXXX-1", title: "Percursos pedonais entre bairros e serviços",
    problemStatement: "Pessoas que se deslocam a pé entre bairros residenciais e serviços essenciais descrevem passeios interrompidos e desvios frequentes.",
    domainCodes: ["MOB"], affectedPopulations: ["Pessoas idosas", "Pessoas com mobilidade reduzida"], geographyArea: "Évora",
    lifecycleStatus: "OPEN", validationStatus: "unvalidated", evidenceStatus: "corroborated", updatedAt: "2026-04-08",
  },
  {
    id: "PRB-XXXX-2", title: "Acesso a informação de estacionamento",
    problemStatement: "A informação pública sobre disponibilidade de estacionamento está dispersa por múltiplas fontes desatualizadas.",
    domainCodes: ["MOB", "PUB"], affectedPopulations: [], geographyArea: "Centro histórico",
    lifecycleStatus: "OPEN", validationStatus: null, evidenceStatus: "corroborated", updatedAt: "2026-03-12",
  },
  {
    id: "PRB-XXXX-3", title: "Continuidade dos horários de recolha de resíduos",
    problemStatement: null,
    domainCodes: ["ENV"], affectedPopulations: [], geographyArea: null,
    lifecycleStatus: "OPEN", validationStatus: "unvalidated", evidenceStatus: null, updatedAt: null,
  },
  {
    id: "PRB-XXXX-4", title: "Disponibilidade de consultas de cuidados primários",
    problemStatement: "Utentes reportam tempos de espera prolongados para marcação de consultas em centros de saúde locais.",
    domainCodes: ["HEA"], affectedPopulations: ["Famílias com crianças pequenas"], geographyArea: "Évora",
    lifecycleStatus: "INSUFFICIENT_EVIDENCE", validationStatus: "unvalidated", evidenceStatus: "corroborated", updatedAt: "2026-02-20",
  },
  {
    id: "PRB-XXXX-5", title: "Dificuldades persistentes nas deslocações quotidianas entre bairros, equipamentos e serviços públicos no centro histórico e periferia de Évora",
    problemStatement: "Pessoas que atravessam a cidade para aceder a serviços essenciais descrevem interrupções e desvios frequentes, com impacto desproporcional em quem depende de transporte público ou percursos pedonais para tarefas do quotidiano, incluindo deslocações a serviços de saúde, educação e comércio local.",
    domainCodes: ["MOB", "PUB", "HEA"], affectedPopulations: ["Pessoas idosas", "Pessoas com mobilidade reduzida", "Famílias com crianças pequenas"], geographyArea: "Évora e freguesias limítrofes",
    lifecycleStatus: "OPEN", validationStatus: "unvalidated", evidenceStatus: "corroborated", updatedAt: "2026-04-01",
  },
  {
    id: "PRB-XXXX-6", title: "Sinalização de obras em espaço público",
    problemStatement: "Obras em curso no espaço público carecem de sinalização consistente para peões e condutores.",
    domainCodes: ["future-domain"], affectedPopulations: [], geographyArea: "Évora",
    lifecycleStatus: null, validationStatus: null, evidenceStatus: null, updatedAt: null,
  },
];

/**
 * A representative material change on one fixture Problem (Overview final
 * redesign, Phase 2) — enough for the full-composition stories to show the
 * changed-row treatment in context, alongside every other row state above.
 */
const latestChangeByProblem = new Map<string, MaterialChangeEntry>([
  ["PRB-XXXX-2", { problemId: "PRB-XXXX-2", problemTitle: "Acesso a informação de estacionamento", date: "2026-08-31", summary: "Fonte adicional incorporada.", domainCodes: ["MOB", "PUB"] }],
]);

function useOverviewState(initial: { search?: string; source?: CitizenProblem[] } = {}) {
  const source = initial.source ?? problems;
  const [searchQuery, setSearchQuery] = useState(initial.search ?? "");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [alteredThisWeekSelected, setAlteredThisWeekSelected] = useState(false);
  // Default sort (Storybook fidelity correction): matches production
  // Overview.tsx's own initial state — "updatedAt" descending, rendered as
  // "Última atualização ↓" — not "id". `id` remains available via the
  // existing SortControl.
  const [sortOrder, setSortOrder] = useState<ProblemSortOrder>("updatedAt");
  const [currentPage, setCurrentPage] = useState(1);
  const visibleProblems = useMemo(() => {
    const matched = source.filter(
      (problem) => matchesCitizenSearch(problem, searchQuery) && matchesTopicFilter(problem, topicFilter)
    );
    return sortProblems(matched, sortOrder);
  }, [source, searchQuery, topicFilter, sortOrder]);
  const pageCount = overviewPageCount(visibleProblems.length);
  const paginatedProblems = paginateProblems(visibleProblems, currentPage);
  return {
    searchQuery, setSearchQuery, visibleProblems, source,
    topicFilter, setTopicFilter,
    alteredThisWeekSelected, setAlteredThisWeekSelected,
    sortOrder, setSortOrder,
    currentPage, setCurrentPage, pageCount, paginatedProblems,
  };
}

function FullOverview({
  source = problems,
  search,
  citizenProblemsOverride,
  visibleProblemsOverride,
  withMaterialChanges = false,
}: {
  source?: CitizenProblem[];
  search?: string;
  citizenProblemsOverride?: CitizenProblem[] | null;
  visibleProblemsOverride?: CitizenProblem[] | null;
  withMaterialChanges?: boolean;
}) {
  const state = useOverviewState({ search, source });
  const citizenProblems = citizenProblemsOverride !== undefined ? citizenProblemsOverride : state.source;
  const visibleProblems = visibleProblemsOverride !== undefined ? visibleProblemsOverride : state.visibleProblems;
  const paginatedProblems = visibleProblemsOverride !== undefined ? visibleProblemsOverride : state.paginatedProblems;
  return (
    <OverviewPresentation
      problemCount={state.source.length}
      evidenceCount={41}
      sourceCount={17}
      totalRecordCount={state.source.length + 41 + 17}
      citizenProblems={citizenProblems}
      visibleProblems={visibleProblems}
      paginatedProblems={paginatedProblems}
      currentPage={state.currentPage}
      pageCount={state.pageCount}
      onPageChange={state.setCurrentPage}
      searchQuery={state.searchQuery}
      onSearchChange={state.setSearchQuery}
      topicFilter={state.topicFilter}
      onTopicFilterChange={state.setTopicFilter}
      alteredThisWeekSelected={state.alteredThisWeekSelected}
      onAlteredThisWeekChange={state.setAlteredThisWeekSelected}
      alteredThisWeekCount={withMaterialChanges ? latestChangeByProblem.size : 0}
      latestChangeByProblem={withMaterialChanges ? latestChangeByProblem : new Map()}
      sortOrder={state.sortOrder}
      onSortOrderChange={state.setSortOrder}
      onExploreProblem={() => {}}
    />
  );
}

/**
 * Storybook-only faithful reproduction of production's complete public
 * Overview page/chrome hierarchy — not just Overview's own body. Production
 * composes this as (App.tsx + Explorer.tsx): a `<main id="main-content"
 * className="explorer-shell">` containing `ExplorerHeader` followed by
 * `Overview`, with `PublicFooter` rendered as a sibling *outside* that main
 * shell. This wrapper reproduces the same hierarchy using the real
 * `ExplorerHeader`/`PublicFooter` components (not recreated markup) around
 * the controlled `FullOverview` fixture, so Full composition stories are a
 * truthful full-page review surface rather than Overview's body alone.
 *
 * Overview's full-bleed rules (e.g. the negative margins on
 * discovery/results) intentionally rely on the horizontal padding
 * `.explorer-shell` itself owns in index.css — without this real shell class
 * around it, a story has no such padding to bleed against, which can
 * produce false horizontal scrolling and clip PRB ids, dates, or row
 * content that render correctly in production. This wrapper introduces no
 * Storybook-only CSS of its own (no duplicated padding, no overflow
 * hiding) — it only reuses the production `explorer-shell`/chrome classes so
 * `index.css`'s real rules apply exactly as they do outside Storybook.
 *
 * Header fixture state: `activeView="overview"` with no active Sources type
 * filter, matching the truthful Overview state Explorer.tsx itself passes
 * (Problemas reads as the active nav item; Fontes does not). The
 * onProblemas/onFontes callbacks are SPA URL-state navigation in production
 * (see Explorer.tsx) — here they are stable no-ops since this fixture has no
 * URL/routing machinery to navigate.
 */
const noop = () => {};

function FullOverviewShell(props: Parameters<typeof FullOverview>[0]) {
  return (
    <>
      <main className="explorer-shell">
        <ExplorerHeader activeView="overview" activeTypeFilter="" onProblemas={noop} onFontes={noop} />
        <FullOverview {...props} />
      </main>
      <PublicFooter />
    </>
  );
}

export const Desktop1440: Story = {
  name: "1440 desktop",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverviewShell />,
};

export const Desktop1024Fit: Story = {
  name: "1024 desktop-fit",
  globals: { viewport: { value: "reviewDesktopFit" } },
  render: () => <FullOverviewShell />,
};

export const Boundary768: Story = {
  name: "768 boundary",
  globals: { viewport: { value: "reviewBoundary" } },
  render: () => <FullOverviewShell />,
};

export const Compact360: Story = {
  name: "360 compact",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <FullOverviewShell />,
};

export const ActiveSearch: Story = {
  name: "active search",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverviewShell search="Évora" />,
};

export const NoResults: Story = {
  name: "no results",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverviewShell search="xyz-sem-correspondencia" />,
};

export const ProblemsLoading: Story = {
  name: "problems loading",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverviewShell citizenProblemsOverride={null} visibleProblemsOverride={null} />,
};

const stressProblems: CitizenProblem[] = [
  ...problems,
  {
    id: "PRB-XXXX-7", title: "Fiabilidade dos horários de transporte público interurbano",
    problemStatement: "Utentes de transporte público interurbano descrevem atrasos frequentes e falta de informação em tempo real, com impacto acrescido para quem depende exclusivamente deste serviço para aceder a emprego, educação e cuidados de saúde fora do centro urbano.",
    domainCodes: ["MOB", "PUB", "HEA", "future-domain"], affectedPopulations: ["Pessoas idosas", "Pessoas com mobilidade reduzida", "Famílias com crianças pequenas", "Trabalhadores deslocados"], geographyArea: "Évora e concelhos limítrofes",
    lifecycleStatus: "OPEN", validationStatus: "unvalidated", evidenceStatus: "corroborated", updatedAt: "2026-04-10",
  },
  {
    id: "PRB-XXXX-8", title: "Acessibilidade de edifícios públicos municipais",
    problemStatement: "Vários edifícios de atendimento público carecem de rampas, elevadores ou sinalética acessível.",
    domainCodes: ["PUB"], affectedPopulations: ["Pessoas com mobilidade reduzida"], geographyArea: "Évora",
    lifecycleStatus: "INSUFFICIENT_EVIDENCE", validationStatus: null, evidenceStatus: "corroborated", updatedAt: "2026-01-15",
  },
];

export const RealisticMaximumContentStress: Story = {
  name: "realistic maximum-content stress",
  globals: { viewport: { value: "reviewCompact" } },
  render: () => <FullOverviewShell source={stressProblems} />,
};

/** Material-change integration (Overview final redesign, Phase 2): one row (PRB-XXXX-2) carries the changed-row variant and marker, shown alongside every other row state. */
export const MaterialChangeRow: Story = {
  name: "material change — row treatment",
  globals: { viewport: { value: "reviewDesktop" } },
  render: () => <FullOverviewShell withMaterialChanges />,
};
