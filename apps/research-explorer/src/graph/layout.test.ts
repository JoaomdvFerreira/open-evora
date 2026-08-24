import { describe, expect, it } from "vitest";
import type { RecordEdge, RecordSummary } from "../dataProvider/types";
import { buildGraphModel } from "./buildGraphModel";
import { computeHopMap } from "./neighbourhood";
import { computeFullCorpusLayout, computeNeighbourhoodLayout } from "./layout";

const RECORDS: RecordSummary[] = [
  { id: "PRB-0005", type: "PRB-", label: "Parking pressure", file: "research/problems/PRB-0005.yaml", summaryFields: {} },
  { id: "EVD-0001", type: "EVD-", label: "Evidence one", file: "research/evidence/EVD-0001.yaml", summaryFields: {} },
  { id: "SRC-0001", type: "SRC-", label: "Source one", file: "research/sources/SRC-0001.yaml", summaryFields: {} },
  { id: "WID-0005", type: "WID-", label: "Widget five", file: "research/widgets/WID-0005.yaml", summaryFields: {} },
];

const EDGES: RecordEdge[] = [
  { id: "PRB-0005::evidence::0::EVD-0001", from: "PRB-0005", to: "EVD-0001", field: "evidence", ordinal: 0, required: false },
  {
    id: "EVD-0001::source.source_id::-::SRC-0001",
    from: "EVD-0001",
    to: "SRC-0001",
    field: "source.source_id",
    ordinal: null,
    required: true,
  },
  { id: "WID-0005::related::-::PRB-0005", from: "WID-0005", to: "PRB-0005", field: "related", ordinal: null, required: true },
];

const graph = buildGraphModel(RECORDS, EDGES);

describe("computeNeighbourhoodLayout", () => {
  it("places the focus node at the origin", () => {
    const hopOf = computeHopMap(graph, "PRB-0005");
    const nodeIds = [...hopOf.keys()];
    const positions = computeNeighbourhoodLayout(graph, "PRB-0005", nodeIds, hopOf);
    expect(positions.get("PRB-0005")).toEqual({ x: 0, y: 0 });
  });

  it("places every non-focus node away from the origin", () => {
    const hopOf = computeHopMap(graph, "PRB-0005");
    const nodeIds = [...hopOf.keys()];
    const positions = computeNeighbourhoodLayout(graph, "PRB-0005", nodeIds, hopOf);
    for (const id of nodeIds) {
      if (id === "PRB-0005") continue;
      const p = positions.get(id)!;
      expect(Math.hypot(p.x, p.y)).toBeGreaterThan(0);
    }
  });

  it("is deterministic for identical input", () => {
    const hopOf = computeHopMap(graph, "PRB-0005");
    const nodeIds = [...hopOf.keys()];
    const a = computeNeighbourhoodLayout(graph, "PRB-0005", nodeIds, hopOf);
    const b = computeNeighbourhoodLayout(graph, "PRB-0005", nodeIds, hopOf);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});

describe("computeFullCorpusLayout", () => {
  it("assigns a position to every node, grouped by type", () => {
    const nodeIds = graph.nodes();
    const positions = computeFullCorpusLayout(graph, nodeIds);
    expect(positions.size).toBe(nodeIds.length);
  });

  it("is deterministic for identical input", () => {
    const nodeIds = graph.nodes();
    const a = computeFullCorpusLayout(graph, nodeIds);
    const b = computeFullCorpusLayout(graph, nodeIds);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});
