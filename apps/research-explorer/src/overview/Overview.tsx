import { useEffect, useMemo, useState } from "react";
import type { DataProvider } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import {
  computePublicOverviewData,
  matchesCitizenSearch,
  matchesEvidenceFilter,
  matchesLifecycleGroupFilter,
  matchesTopicFilter,
  matchesValidationFilter,
  sortProblems,
  toCitizenProblem,
  projectMaterialChangeEntries,
  type CitizenProblem,
  type LifecycleGroup,
  type MaterialChangeEntry,
  type MaterialChangeSource,
  type ProblemSortOrder,
} from "./overviewStats";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { OverviewPresentation } from "./OverviewPresentation";

interface MaterialChangesState {
  entries: MaterialChangeEntry[];
  complete: boolean;
}

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Índice de registos mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar a visão geral",
};

/**
 * Citizen-first Overview (WU054). Loads the same index.json summaries as
 * before, then resolves each PRB's full canonical detail once (the same
 * `getRecord()` reads the previous Overview already performed only to
 * resolve titles) and projects each into a runtime-only `CitizenProblem`
 * (overviewStats.ts's `toCitizenProblem`) — never persisted, never a second
 * parallel data path. Search and topic filters operate purely client-side
 * over that projection; PRB ID order is the deterministic neutral ordering
 * throughout, unaffected by search/filter/ranking.
 */
export function Overview({
  dataProvider,
  totalRecords,
  onExploreProblem,
  onViewRecords,
}: {
  dataProvider: DataProvider;
  /** manifest.totalRecords, passed down from App.tsx — the same canonical corpus count as the "Corpus: X registos" summary. Optional/undefined only when a caller (e.g. a test) does not supply it; the metrics row omits the total metric in that case rather than fabricating one. */
  totalRecords?: number;
  onExploreProblem: (id: string) => void;
  onViewRecords: () => void;
}) {
  const indexState = useRecordIndex(dataProvider);
  const [citizenProblems, setCitizenProblems] = useState<CitizenProblem[] | null>(null);
  const [materialChanges, setMaterialChanges] = useState<MaterialChangesState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Editorial problem-list filter rail state (Overview visual-completion —
  // editorial list redesign). Four independent single-select filters, one
  // per canonical dimension (TEMA→domain, EVIDÊNCIA→evidence_status,
  // VALIDAÇÃO→validation_status, ESTADO→status) — never merged into one
  // combined filter model, and always composed together with the existing
  // Hero search below, never a second, separate filtering path.
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState<string | null>(null);
  const [validationFilter, setValidationFilter] = useState<string | null>(null);
  // ESTADO filters on the grouped lifecycle dimension (Aberto/Fechado — see
  // overviewStats.ts's `lifecycleGroupOf`), not the raw six-value canonical
  // `status` field.
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleGroup | null>(null);
  const [sortOrder, setSortOrder] = useState<ProblemSortOrder>("id");
  const overview = indexState.status === "ready" ? computePublicOverviewData(indexState.records) : null;
  const problemIds = overview?.problems.map((problem) => problem.id).join("|") ?? "";

  useEffect(() => {
    if (indexState.status !== "ready") {
      setCitizenProblems(null);
      setMaterialChanges(null);
      return;
    }
    let cancelled = false;
    setCitizenProblems(null);
    setMaterialChanges(null);
    const summaries = indexState.records.filter((record) => record.type === "PRB-");
    Promise.all(
      summaries.map(async (summary) => {
        try {
          const detail = await dataProvider.getRecord(summary.id);
          return {
            problem: toCitizenProblem(summary, detail),
            source: { summary, detail } satisfies MaterialChangeSource,
            materialHistoryLoaded: true,
          };
        } catch {
          const detail = { id: summary.id, type: summary.type, file: summary.file, record: {}, outgoingEdges: [], incomingEdges: [] };
          return {
            problem: toCitizenProblem(summary, detail),
            materialHistoryLoaded: false,
          };
        }
      })
    ).then((loaded) => {
      if (!cancelled) {
        setCitizenProblems(loaded.map(({ problem }) => problem).sort((a, b) => a.id.localeCompare(b.id)));
        setMaterialChanges({
          entries: projectMaterialChangeEntries(loaded.flatMap(({ source }) => source === undefined ? [] : [source])),
          complete: loaded.every(({ materialHistoryLoaded }) => materialHistoryLoaded),
        });
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
      (problem) =>
        matchesCitizenSearch(problem, searchQuery) &&
        matchesTopicFilter(problem, topicFilter) &&
        matchesEvidenceFilter(problem, evidenceFilter) &&
        matchesValidationFilter(problem, validationFilter) &&
        matchesLifecycleGroupFilter(problem, lifecycleFilter)
    );
    return sortProblems(matched, sortOrder);
  }, [citizenProblems, searchQuery, topicFilter, evidenceFilter, validationFilter, lifecycleFilter, sortOrder]);

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
      totalRecords={totalRecords ?? null}
      citizenProblems={citizenProblems}
      visibleProblems={visibleProblems}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      topicFilter={topicFilter}
      onTopicFilterChange={setTopicFilter}
      evidenceFilter={evidenceFilter}
      onEvidenceFilterChange={setEvidenceFilter}
      validationFilter={validationFilter}
      onValidationFilterChange={setValidationFilter}
      lifecycleFilter={lifecycleFilter}
      onLifecycleFilterChange={setLifecycleFilter}
      sortOrder={sortOrder}
      onSortOrderChange={setSortOrder}
      materialChanges={materialChanges}
      onExploreProblem={onExploreProblem}
      onViewRecords={onViewRecords}
    />
  );
}
