import { describe, expect, it } from "vitest";
import type { RecordEdge, RecordSummary } from "../dataProvider/types";
import { buildGraphModel } from "./buildGraphModel";
import { canExpand, clampDepth, computeHopMap, neighbourhoodView, typesWithinHops } from "./neighbourhood";

// PRB-0005 --evidence--> EVD-0001 --source.source_id--> SRC-0001
// WID-0005 --related--> PRB-0005
// EVD-0002 is unrelated (not reachable from PRB-0005 at all)
const RECORDS: RecordSummary[] = [
  { id: "PRB-0005", type: "PRB-", label: "Parking pressure", file: "research/problems/PRB-0005.yaml", summaryFields: {} },
  { id: "EVD-0001", type: "EVD-", label: "Evidence one", file: "research/evidence/EVD-0001.yaml", summaryFields: {} },
  { id: "SRC-0001", type: "SRC-", label: "Source one", file: "research/sources/SRC-0001.yaml", summaryFields: {} },
  { id: "WID-0005", type: "WID-", label: "Widget five", file: "research/widgets/WID-0005.yaml", summaryFields: {} },
  { id: "EVD-0002", type: "EVD-", label: "Unrelated evidence", file: "research/evidence/EVD-0002.yaml", summaryFields: {} },
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

describe("clampDepth", () => {
  it("clamps to the [1, 2] range", () => {
    expect(clampDepth(0)).toBe(1);
    expect(clampDepth(1)).toBe(1);
    expect(clampDepth(2)).toBe(2);
    expect(clampDepth(5)).toBe(2);
  });
});

describe("computeHopMap", () => {
  it("assigns hop 0 to the focus, hop 1 to direct neighbours (either edge direction), hop 2 to their neighbours", () => {
    const hopOf = computeHopMap(graph, "PRB-0005");
    expect(hopOf.get("PRB-0005")).toBe(0);
    expect(hopOf.get("EVD-0001")).toBe(1);
    expect(hopOf.get("WID-0005")).toBe(1); // incoming reference counts as a neighbour too
    expect(hopOf.get("SRC-0001")).toBe(2);
    expect(hopOf.has("EVD-0002")).toBe(false); // unreachable within MAX_DEPTH
  });

  it("returns an empty map for a focus ID not present in the graph", () => {
    expect(computeHopMap(graph, "PRB-9999").size).toBe(0);
  });

  it("does not loop or misassign hops when the focus node has a self-referencing edge", () => {
    const selfLoopGraph = buildGraphModel(RECORDS, [...EDGES, { id: "PRB-0005::related::0::PRB-0005", from: "PRB-0005", to: "PRB-0005", field: "related", ordinal: 0, required: false }]);
    const hopOf = computeHopMap(selfLoopGraph, "PRB-0005");
    expect(hopOf.get("PRB-0005")).toBe(0);
    expect(hopOf.get("EVD-0001")).toBe(1);
    expect(hopOf.get("SRC-0001")).toBe(2);
  });
});

describe("neighbourhoodView", () => {
  const hopOf = computeHopMap(graph, "PRB-0005");

  it("at depth 1, includes the focus and its direct neighbours only", () => {
    const view = neighbourhoodView(graph, "PRB-0005", hopOf, 1, null);
    expect(new Set(view.nodeIds)).toEqual(new Set(["PRB-0005", "EVD-0001", "WID-0005"]));
    expect(view.edgeIds).toContain("PRB-0005::evidence::0::EVD-0001");
    expect(view.edgeIds).toContain("WID-0005::related::-::PRB-0005");
    expect(view.edgeIds).not.toContain("EVD-0001::source.source_id::-::SRC-0001");
  });

  it("at depth 2, reaches the second hop (e.g. Evidence -> Source)", () => {
    const view = neighbourhoodView(graph, "PRB-0005", hopOf, 2, null);
    expect(new Set(view.nodeIds)).toEqual(new Set(["PRB-0005", "EVD-0001", "WID-0005", "SRC-0001"]));
    expect(view.edgeIds).toContain("EVD-0001::source.source_id::-::SRC-0001");
  });

  it("always keeps the focus node visible even if its own type is excluded by the filter", () => {
    const view = neighbourhoodView(graph, "PRB-0005", hopOf, 1, new Set(["EVD-"]));
    expect(view.nodeIds).toContain("PRB-0005");
    expect(view.nodeIds).not.toContain("WID-0005");
    expect(view.nodeIds).toContain("EVD-0001");
  });

  it("only includes an edge when both endpoints survive the type filter", () => {
    const view = neighbourhoodView(graph, "PRB-0005", hopOf, 2, new Set(["PRB-", "EVD-"]));
    expect(view.nodeIds).not.toContain("SRC-0001");
    expect(view.edgeIds).not.toContain("EVD-0001::source.source_id::-::SRC-0001");
  });
});

describe("canExpand", () => {
  it("is true at depth 1 when a second hop exists, false at the max depth", () => {
    const hopOf = computeHopMap(graph, "PRB-0005");
    expect(canExpand(hopOf, 1)).toBe(true);
    expect(canExpand(hopOf, 2)).toBe(false);
  });

  it("is false when there is nothing beyond the current depth", () => {
    const hopOf = computeHopMap(graph, "EVD-0002"); // isolated node — no neighbours at all
    expect(canExpand(hopOf, 1)).toBe(false);
  });
});

describe("typesWithinHops", () => {
  it("lists only the record types actually reachable, not the whole corpus's types", () => {
    const hopOf = computeHopMap(graph, "PRB-0005");
    expect(typesWithinHops(graph, hopOf)).toEqual(["EVD-", "PRB-", "SRC-", "WID-"]);
  });
});
