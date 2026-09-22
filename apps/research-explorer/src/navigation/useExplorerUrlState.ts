import { useEffect, useState } from "react";
import { parseUrlState, serializeUrlState, type ExplorerUrlState, type ExplorerView } from "./urlState";
import type { GraphDepth } from "../graph/neighbourhood";

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
 *
 * F08: `window.location.hash` is deliberately not part of `ExplorerUrlState`
 * — it stays a browser/document-fragment concern (see
 * navigation/applyInitialFragment.ts), not query-param application state.
 * But every history write below reconstructs the URL from pathname+search
 * alone, so writing it naively drops an existing hash. The rule this module
 * applies: a write that only *canonicalizes* the current location (the
 * normalization effect below, and `replace`'s own continuous same-context
 * refinement, e.g. typing a search query) preserves the hash exactly;
 * `push` — a genuine navigation to a different view/record — does not carry
 * it over, since a fragment scoped to the previous content may no longer
 * make sense on the new one.
 */
export function useExplorerUrlState() {
  const [state, setState] = useState<ExplorerUrlState>(() => parseUrlState(window.location.search));

  useEffect(() => {
    const onPopState = () => setState(parseUrlState(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // UX-F: parseUrlState normalizes an unavailable view=graph out of `state`
  // (initial load and popstate both already funnel through it above), but
  // the address bar itself is a separate, raw string — left alone it would
  // still show/round-trip the original "?view=graph..." on share/reload.
  // Correct it in place via replaceState (no new history entry) whenever it
  // no longer matches the serialized, normalized state — covers a direct
  // navigation, a bookmark, and a browser Back/Forward onto a stale URL.
  // F08: this only ever canonicalizes the query string for the same
  // location, so the existing hash (if any) is preserved exactly rather than
  // reconstructed away.
  useEffect(() => {
    const normalizedSearch = serializeUrlState(state);
    if (window.location.search !== normalizedSearch) {
      window.history.replaceState(null, "", (normalizedSearch || window.location.pathname) + window.location.hash);
    }
  }, [state]);

  // Round-tripped through serialize->parse before every write (not just on
  // load/popstate) so UX-F's view=graph normalization (parseUrlState) governs
  // every path into state uniformly — including in-app calls like "Ver no
  // Grafo" or a ContextTabs graph link — not just direct/bookmarked URLs.
  function normalize(next: ExplorerUrlState): ExplorerUrlState {
    return parseUrlState(serializeUrlState(next));
  }

  // F08: a genuine navigation to different content — the previous location's
  // fragment (if any) is scoped to content that may no longer exist/apply on
  // the new URL, so it is intentionally not carried over (existing semantics,
  // matching native same-document navigation to a fragment-less URL).
  function push(next: ExplorerUrlState) {
    const normalized = normalize(next);
    if (serializeUrlState(normalized) === serializeUrlState(state)) return;
    window.history.pushState(null, "", serializeUrlState(normalized) || window.location.pathname);
    setState(normalized);
  }

  // F08: continuous refinement of the same view/context (e.g. typing a
  // search query) — not "intentional navigation to another view/record", so
  // an existing hash is preserved exactly, matching the normalization
  // effect's own same-location rule above.
  function replace(next: ExplorerUrlState) {
    const normalized = normalize(next);
    if (serializeUrlState(normalized) === serializeUrlState(state)) return;
    window.history.replaceState(null, "", (serializeUrlState(normalized) || window.location.pathname) + window.location.hash);
    setState(normalized);
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
    // One combined history entry for the header's "Fontes" destination:
    // Records filtered to the canonical Source type, always the complete
    // set — never sequential setView/setTypeFilter calls, which would each
    // close over the same stale `state` and could leave a leftover search
    // query or a different type filter from wherever the user came from
    // (Overview final redesign, Phase 3B §2).
    goToSourcesInRecords: () => push({ ...state, view: "records", selectedId: null, query: "", typeFilter: "SRC-" }),
  };
}
