import { useEffect, useMemo, useState } from "react";
import type { DataProvider } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import {
  computePublicOverviewData,
  matchesCitizenSearch,
  matchesTopicFilter,
  overviewPageCount,
  paginateProblems,
  sortProblems,
  toCitizenProblem,
  type CitizenProblem,
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
 * redesign, Phase 1). Loads the same index.json summaries as before, then
 * resolves each PRB's full canonical detail once (the same `getRecord()`
 * reads the previous Overview already performed only to resolve titles) and
 * projects each into a runtime-only `CitizenProblem` (overviewStats.ts's
 * `toCitizenProblem`) — never persisted, never a second parallel data path.
 * Search and topic filters operate purely client-side over that projection;
 * PRB ID order is the deterministic neutral ordering throughout, unaffected
 * by search/filter/ranking.
 *
 * Phase 1 loads no material-change history: the former Hero recent-updates
 * panel that consumed it is removed (Overview final redesign, Phase 1 —
 * delta §2), and nothing else in this phase reads it. Phase 2 (row-level
 * material-change highlighting, `Alterados esta semana`) will re-introduce
 * that load once it has an actual consumer — see overviewStats.ts's
 * `projectMaterialChangeEntries`, which remains available and untouched for
 * that phase to call.
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
  const [searchQuery, setSearchQuery] = useState("");
  // TEMA is the sole remaining Overview filter dimension (Overview final
  // redesign, Phase 1, delta §6) — EVIDÊNCIA/VALIDAÇÃO/ESTADO were removed
  // outright, not moved into the category drawer.
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
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
      return;
    }
    let cancelled = false;
    setCitizenProblems(null);
    const summaries = indexState.records.filter((record) => record.type === "PRB-");
    Promise.all(
      summaries.map(async (summary) => {
        try {
          const detail = await dataProvider.getRecord(summary.id);
          return toCitizenProblem(summary, detail);
        } catch {
          const detail = { id: summary.id, type: summary.type, file: summary.file, record: {}, outgoingEdges: [], incomingEdges: [] };
          return toCitizenProblem(summary, detail);
        }
      })
    ).then((problems) => {
      if (!cancelled) {
        setCitizenProblems(problems.sort((a, b) => a.id.localeCompare(b.id)));
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- problemIds is a stable content-based key for the summaries above
  }, [dataProvider, indexState.status, problemIds]);

  const visibleProblems = useMemo(() => {
    if (!citizenProblems) return null;
    const matched = citizenProblems.filter(
      (problem) => matchesCitizenSearch(problem, searchQuery) && matchesTopicFilter(problem, topicFilter)
    );
    return sortProblems(matched, sortOrder);
  }, [citizenProblems, searchQuery, topicFilter, sortOrder]);

  // Reset to page 1 whenever search, the topic filter, or sort changes —
  // never on a page-count shrink alone from unrelated causes (e.g. a
  // re-fetch), since `paginateProblems` already clamps a stale page number
  // defensively.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, topicFilter, sortOrder]);

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
      onTopicFilterChange={setTopicFilter}
      sortOrder={sortOrder}
      onSortOrderChange={setSortOrder}
      onExploreProblem={onExploreProblem}
    />
  );
}
