import { Suspense, lazy, useEffect } from "react";
import type { DataProvider } from "./dataProvider/types";
import { useExplorerUrlState } from "./useExplorerUrlState";
import { Overview } from "./overview/Overview";
import { RecordsExplorer } from "./records/RecordsExplorer";
import { ProblemView } from "./problem/ProblemView";
import { ReadingGuide } from "./guide/ReadingGuide";

// RE-05: lazily imported, not just GraphCanvas's Sigma module inside it —
// GraphExplorer's own module graph (Graphology + buildGraphModel/neighbourhood/
// layout/renderGraph/typeVisuals) was otherwise pulled into the initial bundle
// by this static import alone, even though nothing in it ever runs before the
// Graph view is opened. Measured: ~17 KB gzip moved out of the initial chunk
// into its own lazy chunk by this change alone (see RE-05 closure report).
const GraphExplorer = lazy(() => import("./graph/GraphExplorer").then((m) => ({ default: m.GraphExplorer })));

interface ExplorerProps {
  dataProvider: DataProvider;
  /** manifest.schemaPrefixes — passed down so the reading guide's type list is data-driven, not hardcoded. */
  schemaPrefixes?: string[];
}

/**
 * Top-level view switcher (RE-02C: Overview/Registos; RE-03 adds Problema).
 * Owns URL-synced state (view, selected record, search query, type filter)
 * via useExplorerUrlState and passes it down as controlled props —
 * Overview/RecordsExplorer/ProblemView own no competing copy of this state.
 */
export function Explorer({ dataProvider, schemaPrefixes }: ExplorerProps) {
  const url = useExplorerUrlState();

  useEffect(() => {
    const selected = url.state.selectedId ? ` ${url.state.selectedId}` : "";
    const viewTitle =
      url.state.view === "problem"
        ? `Problema${selected}`
        : url.state.view === "graph"
          ? `Grafo${selected}`
          : url.state.view === "overview"
            ? "Visão geral"
            : "Registos";
    document.title = `${viewTitle} — Explorador de Investigação Open Évora`;
  }, [url.state.selectedId, url.state.view]);

  return (
    <>
      <header className="explorer-chrome">
        <div className="explorer-chrome-inner shell-frame">
          <h1>
            <span className="explorer-brand">Open Évora</span>
            <span className="explorer-subtitle">Explorador de Investigação</span>
          </h1>
          <nav aria-label="Vistas do Explorador de Investigação" className="explorer-navigation">
            <button type="button" aria-current={url.state.view === "overview" ? "page" : undefined} onClick={() => url.setView("overview")}>
              Visão geral
            </button>
            <button type="button" aria-current={url.state.view === "records" ? "page" : undefined} onClick={() => url.setView("records")}>
              Registos
            </button>
            <button type="button" aria-current={url.state.view === "graph" ? "page" : undefined} onClick={() => url.setView("graph")}>
              Grafo
            </button>
          </nav>
        </div>
      </header>

      {url.state.view === "graph" && <ReadingGuide schemaPrefixes={schemaPrefixes} />}

      {url.state.view === "overview" && (
        <Overview
          dataProvider={dataProvider}
          onExploreProblem={(id) => url.setViewAndSelection("problem", id)}
          onViewRecords={() => url.setView("records")}
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
          onViewInGraph={(id) => url.setViewAndSelection("graph", id)}
        />
      )}

      {url.state.view === "graph" && (
        <Suspense
          fallback={
            <p role="status" aria-live="polite">
              A carregar o grafo…
            </p>
          }
        >
          <GraphExplorer
            dataProvider={dataProvider}
            focusId={url.state.selectedId}
            depth={url.state.graphDepth}
            onFocusChange={url.setSelectedId}
            onClearFocus={() => url.setSelectedId(null)}
            onDepthChange={url.setGraphDepth}
            onOpenGeneric={(id) => url.setViewAndSelection("records", id)}
            onViewAsProblem={(id) => url.setViewAndSelection("problem", id)}
          />
        </Suspense>
      )}
    </>
  );
}
