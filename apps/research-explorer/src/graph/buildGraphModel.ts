import { MultiDirectedGraph } from "graphology";
import type { RecordEdge, RecordSummary } from "../dataProvider/types";

/**
 * Node/edge attribute shapes stored on the Graphology model. Domain/research
 * semantics only — no colour, shape, size, or (x, y) position here. Those
 * are Sigma-specific rendering concerns computed separately (see
 * typeVisuals.ts and layout.ts) and applied only at the point a render-ready
 * graph is built for Sigma (renderGraph.ts) or via Sigma's own reducers
 * (GraphCanvas.tsx) — never mixed into this model.
 */
export interface GraphNodeAttributes {
  recordType: string;
  recordLabel: string;
  [key: string]: unknown;
}

export interface GraphEdgeAttributes {
  field: string;
  ordinal: number | null;
  required: boolean;
  [key: string]: unknown;
}

export type ResearchGraph = MultiDirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>;

/**
 * Builds the full in-memory Graphology model from the generated read model
 * (index.json + edges.json), exactly as delivered by the DataProvider — no
 * inferred/derived relationships (see docs/explorerarchitecture.md's read-model role).
 * `MultiDirectedGraph` because two records can be linked by more than one
 * distinct reference (different field, or different list ordinal) — see
 * read-model-spec.md's edge-identity note; those must render as separate
 * edges, not collapse into one.
 *
 * A record referenced by an edge but absent from `records` (should not
 * happen against a validated read model — edges.json is guaranteed
 * consistent with index.json's id set at generation time) is skipped rather
 * than throwing, so a partially-stale fetch degrades safely instead of
 * crashing the Graph view.
 */
export function buildGraphModel(records: RecordSummary[], edges: RecordEdge[]): ResearchGraph {
  const graph: ResearchGraph = new MultiDirectedGraph();

  for (const record of records) {
    graph.addNode(record.id, { recordType: record.type, recordLabel: record.label });
  }

  for (const edge of edges) {
    if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to)) continue;
    graph.addEdgeWithKey(edge.id, edge.from, edge.to, {
      field: edge.field,
      ordinal: edge.ordinal,
      required: edge.required,
    });
  }

  return graph;
}
