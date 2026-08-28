import { ALL_TYPES } from "../records/recordIndex";
import { MIN_DEPTH, clampDepth, type GraphDepth } from "../graph/neighbourhood";

/**
 * Pure URL <-> application-state mapping (RE-02C). Native URLSearchParams
 * only — no React Router: two views and four flat query params don't need
 * path matching/nested routing, and this keeps the base-path portability
 * (docs/explorerarchitecture.md) trivial since nothing here assumes a route prefix.
 *
 * Record-ID safety note: `selectedId` parsed here is NOT validated against
 * the generated index — it is handed to the existing DataProvider path
 * (StaticDataProvider.getRecord -> isSyntacticallySafeId + index-membership
 * check) exactly like any other selection, so a malformed or stale URL
 * degrades to the same "invalid_id"/"not_found" error state a bad click
 * would, never a bypassed fetch. See StaticDataProvider.ts.
 */

export type ExplorerView = "overview" | "records" | "problem" | "history" | "graph";
export const DEFAULT_VIEW: ExplorerView = "overview";
export const DEFAULT_GRAPH_DEPTH: GraphDepth = MIN_DEPTH;

export interface ExplorerUrlState {
  view: ExplorerView;
  selectedId: string | null;
  query: string;
  typeFilter: string;
  /** RE-04: hops around the focused record shown in the Graph view. Irrelevant to every other view. */
  graphDepth: GraphDepth;
}

export const DEFAULT_URL_STATE: ExplorerUrlState = {
  view: DEFAULT_VIEW,
  selectedId: null,
  query: "",
  typeFilter: ALL_TYPES,
  graphDepth: DEFAULT_GRAPH_DEPTH,
};

function isExplorerView(value: string | null): value is ExplorerView {
  return value === "overview" || value === "records" || value === "problem" || value === "history" || value === "graph";
}

/**
 * Graph is temporarily unavailable to public users (not removed — see
 * docs/explorerarchitecture.md §3, Graph capability). A direct/bookmarked
 * Graph URL must not render Graph, so
 * `view=graph` is normalized away here — the one place both initial load and
 * popstate (browser Back/Forward, via useExplorerUrlState) already funnel
 * through — rather than patched separately in every caller. A PRB-shaped
 * `id` still gets its Problem View (the closest still-available surface to
 * "focused on this PRB"); anything else falls back to Overview. This is a
 * syntactic prefix check only — id existence is validated downstream (same
 * as any other selectedId) by ProblemView/StaticDataProvider.
 */
const PRB_ID_PATTERN = /^PRB-[A-Za-z0-9-]+$/;

function isPrbShapedId(id: string | null): id is string {
  return id !== null && PRB_ID_PATTERN.test(id);
}

export function parseUrlState(search: string): ExplorerUrlState {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const id = params.get("id");
  const depthParam = Number(params.get("d"));
  const selectedId = id !== null && id.trim() !== "" ? id : null;
  const requestedView = isExplorerView(view) ? view : DEFAULT_VIEW;
  const view_ =
    requestedView === "graph" ? (isPrbShapedId(selectedId) ? "problem" : DEFAULT_VIEW) : requestedView;
  return {
    view: view_,
    selectedId: requestedView === "graph" && !isPrbShapedId(selectedId) ? null : selectedId,
    query: params.get("q") ?? "",
    typeFilter: params.get("type") ?? ALL_TYPES,
    graphDepth: Number.isFinite(depthParam) && depthParam > 0 ? clampDepth(depthParam) : DEFAULT_GRAPH_DEPTH,
  };
}

/** Only non-default values are serialized, so a default state round-trips to "" (bare path). */
export function serializeUrlState(state: ExplorerUrlState): string {
  const params = new URLSearchParams();
  if (state.view !== DEFAULT_VIEW) params.set("view", state.view);
  if (state.selectedId) params.set("id", state.selectedId);
  if (state.query.trim() !== "") params.set("q", state.query);
  if (state.typeFilter !== ALL_TYPES) params.set("type", state.typeFilter);
  if (state.graphDepth !== DEFAULT_GRAPH_DEPTH) params.set("d", String(state.graphDepth));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
