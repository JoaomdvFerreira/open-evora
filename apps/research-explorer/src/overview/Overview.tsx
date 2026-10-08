import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import { useRecordIndex } from "../records/useRecordIndex";
import {
  computePublicOverviewData,
  getLisbonCivilDate,
  latestMaterialChangeInCivilWeekOfByProblem,
  matchesCitizenSearch,
  matchesTopicFilter,
  overviewPageCount,
  paginateProblems,
  problemIdsAlteredInCivilWeekOf,
  projectMaterialChangeEntries,
  sortProblems,
  toCitizenProblem,
  type ProblemSortOrder,
} from "./overviewStats";
import { OverviewSkeleton } from "../loading/LoadingSkeletons";
import { ErrorNotice } from "../presentation/ErrorNotice";
import { DataLoadError } from "../dataProvider/types";
import { dataLoadRecovery } from "../presentation/dataLoadRecovery";
import { OverviewPresentation } from "./OverviewPresentation";

const ERROR_TITLES: Record<string, string> = {
  missing: "Modelo de leitura gerado não encontrado",
  malformed: "Índice de registos mal formado",
  incompatible: "Versão do modelo de leitura incompatível",
  network: "Falha ao carregar a visão geral",
};

// How often Overview re-checks whether the Europe/Lisbon civil date has
// rolled over while mounted (Overview final redesign, Phase 2 — Lisbon
// date-boundary hardening). Day/week-boundary staleness is the only thing
// this guards against, so a coarse interval is sufficient; this never
// updates state unless the resolved civil date actually changed (see
// `useLisbonCivilDate` below).
const LISBON_CIVIL_DATE_POLL_INTERVAL_MS = 60_000;

/**
 * Overview's single source of "what is today, in the Europe/Lisbon civil
 * calendar" (Lisbon date-boundary hardening). Both the `Alterados esta
 * semana` shortcut and the row-level changed treatment must agree on exactly
 * the same civil date, so this is the one place either is read from — never
 * a separate implicit `new Date()` inside each projection.
 *
 * A lightweight interval timer re-resolves `getLisbonCivilDate()` and only
 * calls `setState` when the resolved civil date actually differs from the
 * current one, so a mounted Overview picks up a Lisbon civil-day/week
 * rollover without requiring a remount or an unrelated re-render to trigger
 * it. The timer is cleared on unmount.
 */
function useLisbonCivilDate(): string {
  const [civilDate, setCivilDate] = useState(() => getLisbonCivilDate());

  useEffect(() => {
    const id = setInterval(() => {
      const next = getLisbonCivilDate();
      setCivilDate((current) => (current === next ? current : next));
    }, LISBON_CIVIL_DATE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return civilDate;
}

/**
 * F03: Overview's discovery/browse context — search, topic filter, the
 * `Alterados esta semana` shortcut, sort order, and page. Lifted out of
 * `Overview` itself (WU054/Overview final redesign state, formerly local
 * `useState` here) so `Explorer` — which stays mounted across the
 * view=overview/view=problem transition, unlike `Overview` — is the one
 * authoritative owner. `Overview` unmounts whenever a PRB is opened and
 * remounts fresh on return (view switch, browser Back, or the Problem
 * breadcrumb); without this, all discovery context a citizen configured was
 * silently reset. This hook owns no data loading/projection — only the
 * discovery inputs and their existing mutual-exclusion/page-reset rules —
 * so `Overview` remains the single place that turns them into
 * `visibleProblems`.
 */
export function useOverviewDiscoveryState() {
  const [searchQuery, setSearchQuery] = useState("");
  // TEMA is the sole remaining normal Overview filter dimension (Overview
  // final redesign, Phase 1, delta §6) — EVIDÊNCIA/VALIDAÇÃO/ESTADO were
  // removed outright, not moved into the category drawer. `Alterados esta
  // semana` (Phase 2, §7) is a separate, mutually-exclusive shortcut
  // selection: selecting one clears the other, and `Todos` clears both.
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [alteredThisWeekSelected, setAlteredThisWeekSelected] = useState(false);
  // Default sort (Overview visual-convergence pass): existing `updatedAt`
  // descending — the Problem's own canonical `updatedAt`, most recently
  // updated first, null-last, deterministic ties (sortProblems's own doc
  // comment). Rendered as "Última atualização ↓" (CitizenDiscovery.tsx's
  // SortControl) — deliberately not "última alteração", which names the Hero
  // ruler's authored material-change date, a different canonical signal (see
  // OverviewPresentation.tsx). `id` remains available as the alternative
  // order via SortControl.
  const [sortOrder, setSortOrder] = useState<ProblemSortOrder>("updatedAt");
  // Pagination (Overview visual-completion): applies strictly after search,
  // filters, and sort (see overviewStats.ts's `paginateProblems`). Resets to
  // page 1 whenever any of those upstream inputs change, below, so a stale
  // page number never survives a search/filter/sort change that shrinks or
  // reorders the result set.
  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, topicFilter, alteredThisWeekSelected, sortOrder]);

  return {
    searchQuery,
    setSearchQuery,
    topicFilter,
    onTopicFilterChange: handleTopicFilterChange,
    alteredThisWeekSelected,
    onAlteredThisWeekChange: handleAlteredThisWeekChange,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
  };
}

export type OverviewDiscoveryState = ReturnType<typeof useOverviewDiscoveryState>;

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
 * treatment (`latestMaterialChangeInCivilWeekOfByProblem`) and the
 * `Alterados esta semana` shortcut (`problemIdsAlteredInCivilWeekOf`) from
 * the same civil-week membership (weekly-emphasis correction) — a Problem
 * only ever gets the changed-row treatment when it also counts toward the
 * shortcut; a Problem whose only history is outside the current civil week
 * renders on the normal neutral row path, even though
 * `latestMaterialChangeByProblem` (kept for other historical uses) would
 * still report an entry for it. Both projections are derived from the same
 * `useLisbonCivilDate()` value (Lisbon date-boundary hardening) rather than
 * each calling `new Date()`/`getLisbonCivilDate()` independently, so they can
 * never disagree even at the instant the civil date rolls over. A PRB whose
 * detail read fails degrades the same way `toCitizenProblem` already does —
 * the existing `catch` substitutes an empty `record: {}`, which carries no
 * `history`, so that Problem simply contributes no material-change entries
 * (row stays on the neutral path, cannot count toward the weekly shortcut)
 * without being dropped from the normal list or blocking anyone else's
 * projection (§9 graceful degradation — never a reinterpretation of
 * `updated_at` as a fallback history signal).
 *
 * F03: the discovery inputs (search/topic/weekly-shortcut/sort/page) are a
 * controlled `discovery` prop (`useOverviewDiscoveryState`, above) rather
 * than local state, so `Explorer` — which stays mounted across
 * Overview/Problem view switches — remains the one authoritative owner and
 * that context survives Overview's own unmount/remount.
 */
export function Overview({
  dataProvider,
  onExploreProblem,
  discovery,
}: {
  dataProvider: DataProvider;
  onExploreProblem: (id: string) => void;
  discovery: OverviewDiscoveryState;
}) {
  const indexState = useRecordIndex(dataProvider);
  const [detailState, setDetailState] = useState<{
    key: string;
    details: Map<string, { summary: RecordSummary; detail: RecordDetail }>;
    failedIds: string[];
    retrying: boolean;
    error: DataLoadError | null;
  } | null>(null);
  const generation = useRef(0);
  const retryLock = useRef(false);
  const providerIdentity = useRef({ provider: dataProvider, version: 0 });
  if (providerIdentity.current.provider !== dataProvider) {
    providerIdentity.current = { provider: dataProvider, version: providerIdentity.current.version + 1 };
  }
  // The one current Europe/Lisbon civil date Overview evaluates every
  // "esta semana" judgement against (Lisbon date-boundary hardening) — see
  // `useLisbonCivilDate`'s own doc comment.
  const lisbonCivilDate = useLisbonCivilDate();
  const {
    searchQuery,
    setSearchQuery,
    topicFilter,
    onTopicFilterChange: handleTopicFilterChange,
    alteredThisWeekSelected,
    onAlteredThisWeekChange: handleAlteredThisWeekChange,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
  } = discovery;
  const overview = indexState.status === "ready" ? computePublicOverviewData(indexState.records) : null;
  const problemIds = overview?.problems.map((problem) => problem.id).join("|") ?? "";
  const datasetKey = `${providerIdentity.current.version}:${problemIds}`;

  useEffect(() => {
    const currentGeneration = ++generation.current;
    if (indexState.status !== "ready") {
      setDetailState(null);
      return;
    }
    let cancelled = false;
    retryLock.current = false;
    const summaries = indexState.records.filter((record) => record.type === "PRB-").sort((a, b) => a.id.localeCompare(b.id));
    const key = `${providerIdentity.current.version}:${summaries.map((s) => s.id).join("|")}`;
    setDetailState({ key, details: new Map(), failedIds: [], retrying: false, error: null });
    Promise.all(
      summaries.map(async (summary) => {
        try {
          const detail = await dataProvider.getRecord(summary.id);
          return { summary, detail, failed: false, error: null };
        } catch (error) {
          const detail: RecordDetail = { id: summary.id, type: summary.type, file: summary.file, record: {}, outgoingEdges: [], incomingEdges: [] };
          return { summary, detail, failed: true, error: error instanceof DataLoadError ? error : null };
        }
      })
    ).then((results) => {
      if (cancelled || generation.current !== currentGeneration) return;
      const mismatch = results.find((result) => result.error?.kind === "version_mismatch");
      if (mismatch?.error) {
        setDetailState({ key, details: new Map(), failedIds: [], retrying: false, error: mismatch.error });
        return;
      }
      setDetailState({
        key,
        details: new Map(results.map(({ summary, detail }) => [summary.id, { summary, detail }])),
        failedIds: results.filter((result) => result.failed).map((result) => result.summary.id),
        retrying: false,
        error: null,
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- problemIds is a stable content-based key for the summaries above
  }, [dataProvider, indexState.status, problemIds]);

  const retryFailedDetails = useCallback(async () => {
    if (!detailState || detailState.key !== datasetKey || detailState.failedIds.length === 0 || retryLock.current) return;
    retryLock.current = true;
    const currentGeneration = generation.current;
    const ids = [...detailState.failedIds];
    setDetailState((current) => current?.key === datasetKey ? { ...current, retrying: true } : current);
    const summaries = indexState.status === "ready" ? indexState.records.filter((record) => ids.includes(record.id)) : [];
    const results = await Promise.all(summaries.map(async (summary) => {
      try { return { summary, detail: await dataProvider.getRecord(summary.id), failed: false, error: null }; }
      catch (error) { return { summary, detail: { id: summary.id, type: summary.type, file: summary.file, record: {}, outgoingEdges: [], incomingEdges: [] } as RecordDetail, failed: true, error: error instanceof DataLoadError ? error : null }; }
    }));
    if (generation.current === currentGeneration) {
      const mismatch = results.find((result) => result.error?.kind === "version_mismatch");
      if (mismatch?.error) {
        setDetailState({ key: datasetKey, details: new Map(), failedIds: [], retrying: false, error: mismatch.error });
        retryLock.current = false;
        return;
      }
      setDetailState((current) => {
        if (!current || current.key !== datasetKey) return current;
        const details = new Map(current.details);
        for (const result of results) details.set(result.summary.id, { summary: result.summary, detail: result.detail });
        const failed = new Set(current.failedIds);
        for (const result of results) result.failed ? failed.add(result.summary.id) : failed.delete(result.summary.id);
        return { key: current.key, details, failedIds: [...failed], retrying: false, error: null };
      });
    }
    retryLock.current = false;
  }, [dataProvider, datasetKey, detailState, indexState]);

  const currentDetailState = detailState?.key === datasetKey ? detailState : null;
  const resolved = currentDetailState ? [...currentDetailState.details.values()] : [];
  const citizenProblems = currentDetailState && resolved.length === (overview?.problemCount ?? -1)
    ? resolved.map(({ summary, detail }) => toCitizenProblem(summary, detail)).sort((a, b) => a.id.localeCompare(b.id)) : null;
  const materialChangeEntries = useMemo(() => projectMaterialChangeEntries(resolved), [currentDetailState]);

  // This-civil-week latest material change per Problem (row-level changed
  // treatment) and the distinct set of Problems qualifying for `Alterados
  // esta semana` (Overview final redesign, Phase 2 — weekly-emphasis
  // correction; Lisbon date-boundary hardening) — both derived from the same
  // `materialChangeEntries` projection AND the same `lisbonCivilDate` value
  // (never each calling `new Date()`/`getLisbonCivilDate()` on its own),
  // recomputed whenever either changes. Using the civil-date-input helpers
  // directly (`latestMaterialChangeInCivilWeekOfByProblem`/
  // `problemIdsAlteredInCivilWeekOf`) avoids converting the shared civil date
  // back into an artificial instant merely to re-resolve it.
  const latestChangeByProblem = useMemo(
    () => latestMaterialChangeInCivilWeekOfByProblem(materialChangeEntries, lisbonCivilDate),
    [materialChangeEntries, lisbonCivilDate]
  );
  const alteredThisWeekIds = useMemo(
    () => problemIdsAlteredInCivilWeekOf(materialChangeEntries, lisbonCivilDate),
    [materialChangeEntries, lisbonCivilDate]
  );

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

  const pageCount = visibleProblems === null ? 1 : overviewPageCount(visibleProblems.length);
  const paginatedProblems = visibleProblems === null ? null : paginateProblems(visibleProblems, currentPage);

  if (indexState.status === "loading") {
    return <OverviewSkeleton />;
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

  if (currentDetailState?.error) {
    const recovery = dataLoadRecovery(currentDetailState.error, retryFailedDetails);
    return <div className="shell-frame shell-frame--wide"><ErrorNotice titleAs="h2" title="A versão publicada mudou" message={recovery.message} action={recovery.action} /></div>;
  }

  return (
    <OverviewPresentation
      problemCount={overview.problemCount}
      evidenceCount={overview.evidenceCount}
      sourceCount={overview.sourceCount}
      totalRecordCount={overview.totalRecordCount}
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
      partialState={currentDetailState && currentDetailState.failedIds.length > 0 ? { failedIds: currentDetailState.failedIds, total: overview.problemCount, retrying: currentDetailState.retrying, onRetry: retryFailedDetails } : null}
    />
  );
}
