import { Suspense, lazy, useEffect } from "react";
import type { DataProvider } from "../dataProvider/types";
import { useExplorerUrlState } from "../navigation/useExplorerUrlState";
import { Overview, useOverviewDiscoveryState } from "../overview/Overview";
import { RecordsExplorer } from "../records/RecordsExplorer";
import { ProblemView } from "../problem/ProblemView";
import { ProblemHistoryView } from "../problem/ProblemHistoryView";
import { ReadingGuide } from "../guide/ReadingGuide";
import { ProgressMessage } from "../presentation/ProgressMessage";
import { ExplorerHeader } from "./ExplorerHeader";
import { formatPublicCount, formatPublicDateTime } from "../presentation/presentation";
import { SKIP_TARGET_ID } from "./App";

// RE-05: lazily imported, not just GraphCanvas's Sigma module inside it —
// GraphExplorer's own module graph (Graphology + buildGraphModel/neighbourhood/
// layout/renderGraph/typeVisuals) was otherwise pulled into the initial bundle
// by this static import alone, even though nothing in it ever runs before the
// Graph view is opened. Measured: ~17 KB gzip moved out of the initial chunk
// into its own lazy chunk by this change alone (see RE-05 closure report).
const GraphExplorer = lazy(() => import("../graph/GraphExplorer").then((m) => ({ default: m.GraphExplorer })));

interface ExplorerProps {
  dataProvider: DataProvider;
  /** manifest.schemaPrefixes — passed down so the reading guide's type list is data-driven, not hardcoded. */
  schemaPrefixes?: string[];
  /** manifest.totalRecords — the same canonical corpus count shown in the "Corpus: X registos" summary below (every view except Overview, which now has no total-records metric of its own — Overview final redesign, Phase 1). */
  totalRecords?: number;
  /** manifest.generatedAt — read-model build timestamp for the "Corpus: X registos" summary below (ODM-020: build/generation time, distinct from research currentness). */
  generatedAt?: string;
}

/**
 * Top-level view switcher (RE-02C: Overview/Registos; RE-03 adds Problema).
 * Owns URL-synced state (view, selected record, search query, type filter)
 * via useExplorerUrlState and passes it down as controlled props —
 * Overview/RecordsExplorer/ProblemView own no competing copy of this state.
 *
 * F03: also owns Overview's discovery/browse context
 * (`useOverviewDiscoveryState`) for the same reason — Explorer stays mounted
 * across the view=overview <-> view=problem transition, while Overview
 * itself unmounts/remounts on every such switch, so Explorer is the one
 * stable owner that can survive that and hand the same state back.
 */
export function Explorer({ dataProvider, schemaPrefixes, totalRecords, generatedAt }: ExplorerProps) {
  const url = useExplorerUrlState();
  const overviewDiscovery = useOverviewDiscoveryState();

  useEffect(() => {
    const selected = url.state.selectedId ? ` ${url.state.selectedId}` : "";
    const viewTitle =
      url.state.view === "problem"
        ? `Problema${selected}`
        : url.state.view === "history"
          ? `Histórico${selected}`
        : url.state.view === "graph"
          ? `Grafo${selected}`
          : url.state.view === "overview"
            ? "Visão geral"
            : "Registos";
    document.title = `${viewTitle} — Explorador de Investigação Open Évora`;
  }, [url.state.selectedId, url.state.view]);

  return (
    <>
      <ExplorerHeader
        activeView={url.state.view}
        activeTypeFilter={url.state.typeFilter}
        onProblemas={() => url.clearSelectionAndSetView("overview")}
        onFontes={url.goToSourcesInRecords}
      />

      {/* F06: the skip link's real destination — after global navigation in
          document order, so activating it bypasses ExplorerHeader entirely
          rather than merely landing at the top of the shared <main> that
          still wraps both (see App.tsx's own SKIP_TARGET_ID doc comment). No
          visual footprint: an empty, unstyled, focusable node. */}
      <div id={SKIP_TARGET_ID} tabIndex={-1} />

      {url.state.view === "graph" && <ReadingGuide schemaPrefixes={schemaPrefixes} />}

      {url.state.view === "overview" && (
        <Overview
          dataProvider={dataProvider}
          onExploreProblem={(id) => url.setViewAndSelection("problem", id)}
          discovery={overviewDiscovery}
        />
      )}

      {url.state.view === "records" && (
        <RecordsExplorer
          dataProvider={dataProvider}
          selectedId={url.state.selectedId}
          onSelect={url.setSelectedId}
          query={url.state.query}
          onQueryChange={url.setQuery}
          typeFilter={url.state.typeFilter}
          onTypeFilterChange={url.setTypeFilter}
          onViewAsProblem={(id) => url.setViewAndSelection("problem", id)}
          onViewHistory={(id) => url.setViewAndSelection("history", id)}
          onViewInGraph={(id) => url.setViewAndSelection("graph", id)}
          onBackToRecords={() => url.setSelectedId(null)}
        />
      )}

      {url.state.view === "problem" && (
        <ProblemView
          dataProvider={dataProvider}
          problemId={url.state.selectedId}
          onOpenGeneric={(id) => url.setViewAndSelection("records", id)}
          onBackToRecords={() => url.clearSelectionAndSetView("records")}
          onBackToOverview={() => url.clearSelectionAndSetView("overview")}
          onViewHistory={(id) => url.setViewAndSelection("history", id)}
        />
      )}

      {url.state.view === "history" && (
        <ProblemHistoryView
          dataProvider={dataProvider}
          problemId={url.state.selectedId}
          onOpenGeneric={(id) => url.setViewAndSelection("records", id)}
          onBackToRecords={() => url.clearSelectionAndSetView("records")}
          onBackToOverview={() => url.clearSelectionAndSetView("overview")}
          onViewAsProblem={(id) => url.setViewAndSelection("problem", id)}
        />
      )}

      {url.state.view === "graph" && (
        <Suspense fallback={<div className="shell-frame"><ProgressMessage message="A carregar o grafo…" /></div>}>
          <GraphExplorer
            dataProvider={dataProvider}
            focusId={url.state.selectedId}
            depth={url.state.graphDepth}
            onFocusChange={url.setSelectedId}
            onClearFocus={() => url.setSelectedId(null)}
            onDepthChange={url.setGraphDepth}
            onOpenGeneric={(id) => url.setViewAndSelection("records", id)}
            onViewAsProblem={(id) => url.setViewAndSelection("problem", id)}
            onViewHistory={(id) => url.setViewAndSelection("history", id)}
          />
        </Suspense>
      )}

      {/* Global manifest/build summary — every view except Overview, which
          replaced it with its own editorial metrics ruler (Overview visual
          completion). Kept here rather than duplicated per view: still a
          single canonical rendering of manifest.totalRecords/generatedAt,
          not a competing corpus figure (AGENTS.md canonical-state
          integrity). */}
      {url.state.view !== "overview" && totalRecords !== undefined && generatedAt !== undefined && (
        <div className="shell-frame">
          <p className="manifest-summary">
            Corpus: {formatPublicCount(totalRecords)} registos · esta versão publicada dos dados foi gerada em{" "}
            <time dateTime={generatedAt}>{formatPublicDateTime(generatedAt)}</time>{" "}
            (não indica a atualidade da investigação)
          </p>
        </div>
      )}
    </>
  );
}
