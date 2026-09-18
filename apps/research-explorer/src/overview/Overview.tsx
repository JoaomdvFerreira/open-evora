import { useEffect, useMemo, useState } from "react";
import type { DataProvider } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import {
  computePublicOverviewData,
  matchesCitizenSearch,
  matchesTopicFilter,
  relevantTopicCodes,
  toCitizenProblem,
  projectMaterialChangeEntries,
  type CitizenProblem,
  type MaterialChangeEntry,
  type MaterialChangeSource,
} from "./overviewStats";
import { publicEnumLabel, publicCompactEnumLabel } from "../presentation/presentation";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { OverviewPresentation } from "./OverviewPresentation";

const MATERIAL_CHANGE_PRESENTATION_LIMIT = 5;

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
  onExploreProblem,
  onViewRecords,
}: {
  dataProvider: DataProvider;
  onExploreProblem: (id: string) => void;
  onViewRecords: () => void;
}) {
  const indexState = useRecordIndex(dataProvider);
  const [citizenProblems, setCitizenProblems] = useState<CitizenProblem[] | null>(null);
  const [materialChanges, setMaterialChanges] = useState<MaterialChangesState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
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

  const topicCodes = useMemo(() => (citizenProblems ? relevantTopicCodes(citizenProblems) : []), [citizenProblems]);

  const visibleProblems = useMemo(() => {
    if (!citizenProblems) return null;
    return citizenProblems.filter((problem) => matchesTopicFilter(problem, activeTopic) && matchesCitizenSearch(problem, searchQuery));
  }, [citizenProblems, activeTopic, searchQuery]);

  if (indexState.status === "loading") {
    return <div className="shell-frame"><ProgressMessage message="A carregar visão geral…" /></div>;
  }

  if (indexState.status === "error") {
    return (
      <div className="shell-frame">
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

  const unvalidatedLabel = publicEnumLabel("validation_status", "unvalidated");
  const corroboratedLabel = publicEnumLabel("evidence_status", "corroborated");
  const compactCorroboratedLabel = publicCompactEnumLabel("evidence_status", "corroborated");
  return (
    <OverviewPresentation
      problemCount={overview.problemCount}
      evidenceCount={overview.evidenceCount}
      citizenProblems={citizenProblems}
      visibleProblems={visibleProblems}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      topicCodes={topicCodes}
      activeTopic={activeTopic}
      onTopicChange={setActiveTopic}
      materialChanges={materialChanges}
      materialChangePresentationLimit={MATERIAL_CHANGE_PRESENTATION_LIMIT}
      unvalidatedLabel={unvalidatedLabel}
      corroboratedLabel={corroboratedLabel}
      compactCorroboratedLabel={compactCorroboratedLabel}
      onExploreProblem={onExploreProblem}
      onViewRecords={onViewRecords}
    />
  );
}
