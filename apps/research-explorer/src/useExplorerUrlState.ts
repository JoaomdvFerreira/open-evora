import { useEffect, useState } from "react";
import { parseUrlState, serializeUrlState, type ExplorerUrlState, type ExplorerView } from "./urlState";
import type { GraphDepth } from "./graph/neighbourhood";

/**
 * Bridges ExplorerUrlState to the real address bar via native History API —
 * no React Router. Two history-write modes:
 *  - push (view, record selection, type filter): a discrete navigation the
 *    user would plausibly want "back" to undo — table-row selection and
 *    relationship navigation both go through the same setSelectedId, so
 *    back/forward walks the PRB-0005 -> EVD-000105 -> SRC-0092 chain.
 *  - replace (search query): continuous typing would otherwise flood the
 *    history stack with one entry per keystroke; the URL still stays in
 *    sync for reload/bookmark purposes.
 *
 * All side effects (history.pushState/replaceState) happen inside the
 * returned event-handler functions, never during render or inside a
 * setState updater — safe under StrictMode's double-invocation of render
 * and reducers.
 */
export function useExplorerUrlState() {
  const [state, setState] = useState<ExplorerUrlState>(() => parseUrlState(window.location.search));

  useEffect(() => {
    const onPopState = () => setState(parseUrlState(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function push(next: ExplorerUrlState) {
    if (serializeUrlState(next) === serializeUrlState(state)) return;
    window.history.pushState(null, "", serializeUrlState(next) || window.location.pathname);
    setState(next);
  }

  function replace(next: ExplorerUrlState) {
    if (serializeUrlState(next) === serializeUrlState(state)) return;
    window.history.replaceState(null, "", serializeUrlState(next) || window.location.pathname);
    setState(next);
  }

  return {
    state,
    setView: (view: ExplorerView) => push({ ...state, view }),
    setSelectedId: (selectedId: string | null) => push({ ...state, selectedId }),
    setQuery: (query: string) => replace({ ...state, query }),
    setTypeFilter: (typeFilter: string) => push({ ...state, typeFilter }),
    // Expand/collapse-by-hop is a continuous-ish adjustment like typing a
    // query, not a discrete "go somewhere new" navigation — replace keeps it
    // out of the back/forward stack while still round-tripping on reload/share.
    setGraphDepth: (graphDepth: GraphDepth) => replace({ ...state, graphDepth }),
    // One combined history entry for "open this ID in that view" (e.g. "Ver
    // como Problema" from the generic detail panel, or opening a related
    // EVD-/SRC- generically from the Problem view) — avoids two separate
    // back-stack entries for what the user experiences as one navigation.
    setViewAndSelection: (view: ExplorerView, selectedId: string) => push({ ...state, view, selectedId }),
    // One combined history entry for "go to a different area, dropping any
    // contextual record identity" — used by GlobalNav (UX-D §1: switching
    // area must never leak a hidden selectedId into the destination area)
    // and by Problem View's own breadcrumb (Visão geral, UX-D §2), which is
    // never itself on view=records and so must clear the selection and
    // change the view together, or it would land on Record Detail (a
    // still-selected PRB id) instead of the destination area. Distinct from
    // RecordsExplorer's own breadcrumb, which clears selectedId via
    // setSelectedId while already on view=records.
    clearSelectionAndSetView: (view: ExplorerView) => push({ ...state, view, selectedId: null }),
  };
}
