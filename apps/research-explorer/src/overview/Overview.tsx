import { useEffect, useMemo, useState } from "react";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import {
  computePublicOverviewData,
  latestMaterialChangeByProblem,
  matchesCitizenSearch,
  matchesTopicFilter,
  overviewPageCount,
  paginateProblems,
  problemIdsAlteredInCivilWeek,
  projectMaterialChangeEntries,
  sortProblems,
  toCitizenProblem,
  type CitizenProblem,
  type MaterialChangeEntry,
  type ProblemSortOrder,
} from "./overviewStats";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { OverviewPresentation } from "./OverviewPresentation";

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Índice de registos mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar a visão geral",
};

/**
 * Citizen-first Overview (WU054; final macro-structure per Overview final
 * redesign, Phase 1; material-change integration per Phase 2). Loads the
 * same index.json summaries as before, then resolves each PRB's full
 * canonical detail once (the same `getRecord()` reads the previous Overview
 * already performed only to resolve titles) and projects each into a
 * runtime-only `CitizenProblem` (overviewStats.ts's `toCitizenProblem`) —
 * never persisted, never a second parallel data path. Search and topic
 * filters operate purely client-side over that projection; PRB ID order is
 * the deterministic neutral ordering throughout, unaffected by
 * search/filter/ranking.
 *
 * Phase 2 reuses that same per-PRB `getRecord()` detail read (never a second
 * fetch) to also project each detail's canonical `history[]` via
 * `projectMaterialChangeEntries`, feeding both the row-level changed
 * treatment (`latestMaterialChangeByProblem`) and the `Alterados esta
 * semana` shortcut (`problemIdsAlteredInCivilWeek`). A PRB whose detail read
 * fails degrades the same way `toCitizenProblem` already does — the
 * existing `catch` substitutes an empty `record: {}`, which carries no
 * `history`, so that Problem simply contributes no material-change entries
 * (row stays on the neutral path, cannot count toward the weekly shortcut)
 * without being dropped from the normal list or blocking anyone else's
 * projection (§9 graceful degradation — never a reinterpretation of
 * `updated_at` as a fallback history signal).
 */
export function Overview({
  dataProvider,
  onExploreProblem,
}: {
  dataProvider: DataProvider;
  onExploreProblem: (id: string) => void;
}) {
  const indexState = useRecordIndex(dataProvider);
  const [citizenProblems, setCitizenProblems] = useState<CitizenProblem[] | null>(null);
  const [materialChangeEntries, setMaterialChangeEntries] = useState<MaterialChangeEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // TEMA is the sole remaining normal Overview filter dimension (Overview
  // final redesign, Phase 1, delta §6) — EVIDÊNCIA/VALIDAÇÃO/ESTADO were
  // removed outright, not moved into the category drawer. `Alterados esta
  // semana` (Phase 2, §7) is a separate, mutually-exclusive shortcut
  // selection: selecting one clears the other, and `Todos` clears both.
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [alteredThisWeekSelected, setAlteredThisWeekSelected] = useState(false);
  const [sortOrder, setSortOrder] = useState<ProblemSortOrder>("id");
  // Pagination (Overview visual-completion): applies strictly after search,
  // filters, and sort (see overviewStats.ts's `paginateProblems`). Resets to
  // page 1 whenever any of those upstream inputs change, below, so a stale
  // page number never survives a search/filter/sort change that shrinks or
  // reorders the result set.
  const [currentPage, setCurrentPage] = useState(1);
  const overview = indexState.status === "ready" ? computePublicOverviewData(indexState.records) : null;
  const problemIds = overview?.problems.map((problem) => problem.id).join("|") ?? "";

  useEffect(() => {
    if (indexState.status !== "ready") {
      setCitizenProblems(null);
      setMaterialChangeEntries([]);
      return;
    }
    let cancelled = false;
    setCitizenProblems(null);
    setMaterialChangeEntries([]);
    const summaries = indexState.records.filter((record) => record.type === "PRB-");
    Promise.all(
      summaries.map(async (summary) => {
        try {
          const detail = await dataProvider.getRecord(summary.id);
          return { summary, detail };
        } catch {
          const detail: RecordDetail = { id: summary.id, type: summary.type, file: summary.file, record: {}, outgoingEdges: [], incomingEdges: [] };
          return { summary, detail };
        }
      })
    ).then((resolved: { summary: RecordSummary; detail: RecordDetail }[]) => {
      if (cancelled) return;
      setCitizenProblems(
        resolved.map(({ summary, detail }) => toCitizenProblem(summary, detail)).sort((a, b) => a.id.localeCompare(b.id))
      );
      // Same resolved detail reads, reused rather than re-fetched (§1/§9) —
      // a Problem whose read failed above contributes an empty `record: {}`
      // here too, which `projectMaterialChangeEntries` already treats as "no
      // authored history" (see its own doc comment), never as a fallback
      // material-change signal.
      setMaterialChangeEntries(projectMaterialChangeEntries(resolved));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- problemIds is a stable content-based key for the summaries above
  }, [dataProvider, indexState.status, problemIds]);

  // Latest material change per Problem (row-level changed treatment) and
  // the distinct set of Problems qualifying for `Alterados esta semana`
  // (Overview final redesign, Phase 2, §2/§6) — both derived from the same
  // `materialChangeEntries` projection, recomputed only when it changes.
  // `referenceDate` is intentionally left at its default (`new Date()`):
  // Overview always evaluates the shortcut against the real current civil
  // week; only tests inject a fixed reference via the helpers directly.
  const latestChangeByProblem = useMemo(() => latestMaterialChangeByProblem(materialChangeEntries), [materialChangeEntries]);
  const alteredThisWeekIds = useMemo(() => problemIdsAlteredInCivilWeek(materialChangeEntries), [materialChangeEntries]);

  const visibleProblems = useMemo(() => {
    if (!citizenProblems) return null;
    const matched = citizenProblems.filter(
      (problem) =>
        matchesCitizenSearch(problem, searchQuery) &&
        matchesTopicFilter(problem, topicFilter) &&
        (!alteredThisWeekSelected || alteredThisWeekIds.has(problem.id))
    );
    return sortProblems(matched, sortOrder);
  }, [citizenProblems, searchQuery, topicFilter, alteredThisWeekSelected, alteredThisWeekIds, sortOrder]);

  // Reset to page 1 whenever search, either category-drawer selection, or
  // sort changes — never on a page-count shrink alone from unrelated causes
  // (e.g. a re-fetch), since `paginateProblems` already clamps a stale page
  // number defensively.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, topicFilter, alteredThisWeekSelected, sortOrder]);

  // Category-drawer shortcut selections are mutually exclusive with the
  // normal TEMA topic filter (§7): selecting a topic clears the shortcut;
  // selecting the shortcut clears the topic; and `Todos` — `topicFilter` set
  // to `null` via the existing `onTopicFilterChange` path, which
  // `CategoryDrawer`'s own `Todos` button always calls — clears both.
  const handleTopicFilterChange = (value: string | null) => {
    setTopicFilter(value);
    setAlteredThisWeekSelected(false);
  };
  const handleAlteredThisWeekChange = (selected: boolean) => {
    setAlteredThisWeekSelected(selected);
    if (selected) setTopicFilter(null);
  };

  const pageCount = visibleProblems === null ? 1 : overviewPageCount(visibleProblems.length);
  const paginatedProblems = visibleProblems === null ? null : paginateProblems(visibleProblems, currentPage);

  if (indexState.status === "loading") {
    return <div className="shell-frame shell-frame--wide"><ProgressMessage message="A carregar visão geral…" /></div>;
  }

  if (indexState.status === "error") {
    return (
      <div className="shell-frame shell-frame--wide">
        <ErrorNotice
          titleAs="h2"
          title={ERROR_TITLES[indexState.error.kind] ?? "Não foi possível carregar a visão geral"}
          message={indexState.error.message}
          action={
            <button type="button" onClick={indexState.retry}>
              Tentar novamente
            </button>
          }
        />
      </div>
    );
  }

  if (overview === null) return null;

  return (
    <OverviewPresentation
      problemCount={overview.problemCount}
      evidenceCount={overview.evidenceCount}
      sourceCount={overview.sourceCount}
      citizenProblems={citizenProblems}
      visibleProblems={visibleProblems}
      paginatedProblems={paginatedProblems}
      currentPage={currentPage}
      pageCount={pageCount}
      onPageChange={setCurrentPage}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      topicFilter={topicFilter}
      onTopicFilterChange={handleTopicFilterChange}
      alteredThisWeekSelected={alteredThisWeekSelected}
      onAlteredThisWeekChange={handleAlteredThisWeekChange}
      alteredThisWeekCount={alteredThisWeekIds.size}
      latestChangeByProblem={latestChangeByProblem}
      sortOrder={sortOrder}
      onSortOrderChange={setSortOrder}
      onExploreProblem={onExploreProblem}
    />
  );
}
