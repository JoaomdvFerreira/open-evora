import { Suspense, lazy, useEffect, useRef } from "react";
import type { DataProvider } from "../dataProvider/types";
import { useExplorerUrlState } from "../navigation/useExplorerUrlState";
import { Overview, useOverviewDiscoveryState } from "../overview/Overview";
import { RecordsExplorer } from "../records/RecordsExplorer";
import { ProblemView } from "../problem/ProblemView";
import { ProblemHistoryView } from "../problem/ProblemHistoryView";
import { ReadingGuide } from "../guide/ReadingGuide";
import { GraphSkeleton } from "../loading/LoadingSkeletons";
import { ExplorerHeader } from "./ExplorerHeader";
import { documentTitle, recordsTitleLabel } from "./documentTitle";
import { formatPublicCount, formatPublicDateTime } from "../presentation/presentation";
import { SKIP_TARGET_ID } from "./skipTarget";

// RE-05: lazily imported, not just GraphCanvas's Sigma module inside it —
// GraphExplorer's own module graph (Graphology + buildGraphModel/neighbourhood/
// layout/renderGraph/typeVisuals) was otherwise pulled into the initial bundle
// by this static import alone, even though nothing in it ever runs before the
// Graph view is opened. Measured: ~17 KB gzip moved out of the initial chunk
// into its own lazy chunk by this change alone (see RE-05 closure report).
const GraphExplorer = lazy(() => import("../graph/GraphExplorer").then((m) => ({ default: m.GraphExplorer })));

/** Shared Graph-shaped fallback used by the lazy module boundary. */
export function GraphLoadingFallback() {
  return <GraphSkeleton message="A carregar o grafo…" />;
}

/**
 * Views whose content has no terminal band of its own before the public
 * footer. EVD and SRC Record Detail end on their own audit band ("Origem e
 * auditoria" / "Acesso e auditoria").
 */
function showsManifestSummary(view: string, selectedId: string | null): boolean {
  if (view === "records") return selectedId !== null && !selectedId.startsWith("EVD-") && !selectedId.startsWith("SRC-");
  return view === "graph";
}

interface ExplorerProps {
  dataProvider: DataProvider;
  /** manifest.schemaPrefixes — passed down so the reading guide's type list is data-driven, not hardcoded. */
  schemaPrefixes?: string[];
  /** manifest.totalRecords — the same canonical corpus count shown in the "Corpus: X registos" summary below (Record Detail and Graph only — see showsManifestSummary). */
  totalRecords?: number;
  /** manifest.generatedAt — read-model build timestamp for the "Corpus: X registos" summary below (ODM-020: build/generation time, distinct from research currentness). */
  generatedAt?: string;
  /** Publication identity from the startup manifest, carried to portable PRB dossiers. */
  sourceCommit?: string | null;
  corpusFingerprint?: string;
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
export function Explorer({ dataProvider, schemaPrefixes, totalRecords, generatedAt, sourceCommit = null, corpusFingerprint = "" }: ExplorerProps) {
  const url = useExplorerUrlState();
  const overviewDiscovery = useOverviewDiscoveryState();
  const previousLocation = useRef({ view: url.state.view, selectedId: url.state.selectedId });

  useEffect(() => {
    const previous = previousLocation.current;
    const arrivedAtOverview = url.state.view === "overview" && previous.view !== "overview";
    const arrivedAtRecords = url.state.view === "records" && url.state.selectedId === null &&
      (previous.view !== "records" || previous.selectedId !== null);
    previousLocation.current = { view: url.state.view, selectedId: url.state.selectedId };
    if (!arrivedAtOverview && !arrivedAtRecords) return;

    const headingId = arrivedAtOverview ? "overview-heading" : "records-heading";
    const focusHeading = () => {
      const heading = document.getElementById(headingId);
      if (!heading) return false;
      heading.focus();
      return true;
    };
    if (window.location.hash || focusHeading()) return;

    // Overview/Records data can still be loading when the URL transition
    // commits. Watch the existing main landmark until its content heading is
    // mounted, then focus it once.
    const main = document.getElementById("main-content") ?? document.body;
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect();
    });
    observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [url.state.selectedId, url.state.view]);

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
            : recordsTitleLabel(url.state.selectedId);
    document.title = documentTitle(viewTitle);
  }, [url.state.selectedId, url.state.view]);

  return (
    <>
      <ExplorerHeader
        activeView={url.state.view}
        onProblemas={() => url.clearSelectionAndSetView("overview")}
        onRegistos={url.goToRecords}
      />

      {/* F06: the skip link's real destination — after global navigation in
          document order, so activating it bypasses ExplorerHeader entirely
          rather than merely landing at the top of the shared <main> that
          still wraps both (see skipTarget.ts's own SKIP_TARGET_ID doc
          comment). No visual footprint: an empty, unstyled, focusable node. */}
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
          onViewInGraph={(id) => url.setViewAndSelection("graph", id)}
          onBackToRecords={() => url.setSelectedId(null)}
        />
      )}

      {url.state.view === "problem" && (
        <ProblemView
          dataProvider={dataProvider}
          sourceCommit={sourceCommit}
          corpusFingerprint={corpusFingerprint}
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
          onVerifyInDetails={(id) => url.setViewAndSelectionAtFragment("problem", id, "prb-auditoria")}
        />
      )}

      {url.state.view === "graph" && (
        <Suspense fallback={<GraphLoadingFallback />}>
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

      {/* Global manifest/build summary — Record Detail and Graph only.
          Overview replaced it with its own editorial metrics ruler, the
          Records landing ends on its own pagination row, and both public
          PRB views and EVD/SRC Record Detail end on their own terminal
          content band (Detalhes: the audit band; Histórico: the
          material-history section; EVD: Origem e auditoria; SRC: Acesso e
          auditoria). Kept here
          rather than duplicated per view: still a single canonical rendering
          of manifest.totalRecords/generatedAt, not a competing corpus figure (AGENTS.md canonical-state integrity). */}
      {showsManifestSummary(url.state.view, url.state.selectedId) && totalRecords !== undefined && generatedAt !== undefined && (
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
