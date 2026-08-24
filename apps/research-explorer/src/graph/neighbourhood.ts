import type { ResearchGraph } from "./buildGraphModel";

/** Neighbourhood mode defaults to selected node ± 1–2 hops, never the full graph. */
export const MIN_DEPTH = 1;
export const MAX_DEPTH = 2;
export type GraphDepth = 1 | 2;

export function clampDepth(value: number): GraphDepth {
  return value >= MAX_DEPTH ? MAX_DEPTH : MIN_DEPTH;
}

/**
 * Breadth-first hop distance from `focusId`, computed once up to `MAX_DEPTH`
 * regardless of the currently-selected depth — so "expand to another hop"
 * and "can this node expand further?" are cheap lookups rather than a
 * repeated graph walk. Traverses edges in either direction (a neighbour is a
 * neighbour regardless of reference direction); edge direction itself is
 * preserved separately for rendering (see edgesAmong below).
 */
export function computeHopMap(graph: ResearchGraph, focusId: string): Map<string, number> {
  const hopOf = new Map<string, number>();
  if (!graph.hasNode(focusId)) return hopOf;

  hopOf.set(focusId, 0);
  let frontier = [focusId];
  for (let hop = 1; hop <= MAX_DEPTH; hop++) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const neighbor of graph.neighbors(nodeId)) {
        if (!hopOf.has(neighbor)) {
          hopOf.set(neighbor, hop);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return hopOf;
}

export interface NeighbourhoodView {
  /** Node IDs visible at the current depth/type-filter, including the focus node itself. */
  nodeIds: string[];
  /** Edge keys whose both endpoints are visible. */
  edgeIds: string[];
  hopOf: Map<string, number>;
}

/**
 * Narrows a precomputed hop map to what should actually be rendered: nodes
 * within `depth` hops whose type passes `allowedTypes` (the focus node is
 * always kept, regardless of the type filter, since it is the anchor the
 * user explicitly selected), plus every edge whose both endpoints survive
 * that filter.
 */
export function neighbourhoodView(
  graph: ResearchGraph,
  focusId: string,
  hopOf: Map<string, number>,
  depth: GraphDepth,
  allowedTypes: ReadonlySet<string> | null
): NeighbourhoodView {
  const nodeIds = [...hopOf.entries()]
    .filter(([id, hop]) => {
      if (hop > depth) return false;
      if (id === focusId) return true;
      if (!allowedTypes) return true;
      return allowedTypes.has(graph.getNodeAttribute(id, "recordType"));
    })
    .map(([id]) => id);

  const visible = new Set(nodeIds);
  const edgeIds = graph.filterEdges((_edge, _attrs, source, target) => visible.has(source) && visible.has(target));

  return { nodeIds, edgeIds, hopOf };
}

/** True if expanding from `depth` to `depth + 1` would reveal at least one more node (ignoring the type filter — expansion is a structural affordance). */
export function canExpand(hopOf: Map<string, number>, depth: GraphDepth): boolean {
  if (depth >= MAX_DEPTH) return false;
  for (const hop of hopOf.values()) {
    if (hop === depth + 1) return true;
  }
  return false;
}

/** All record types present within the current hop map, for a "filter to what's actually reachable" type-filter UI (not the whole corpus's type list). */
export function typesWithinHops(graph: ResearchGraph, hopOf: Map<string, number>): string[] {
  const types = new Set<string>();
  for (const id of hopOf.keys()) {
    types.add(graph.getNodeAttribute(id, "recordType"));
  }
  return [...types].sort();
}
