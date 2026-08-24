import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { computeRecordsView } from "../records/recordsView";
import { buildRecordLookup } from "../records/recordIndex";
import { loadProblemProjection } from "../problem/problemProjection";
import { buildGraphModel } from "../graph/buildGraphModel";
import { computeHopMap, neighbourhoodView } from "../graph/neighbourhood";
import type { DataProvider, RecordDetail, RecordEdge, RecordSummary, ReadModelManifest } from "../dataProvider/types";

/**
 * RE-05 scale benchmark. Not part of the normal test suite: only runs when
 * BENCH_SCALE points at a `benchmark/output/<scale>/generated/` directory
 * already produced by `benchmark/run-adapter-benchmark.js`. Reuses the real
 * production modules (recordsView, problemProjection, graph/*) directly —
 * these are the actual code paths the app runs, not a re-implementation.
 */
const scale = process.env.BENCH_SCALE;

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function timeIt(fn: () => void, reps: number): { medianMs: number; runs: number[] } {
  const runs: number[] = [];
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    fn();
    runs.push(performance.now() - t0);
  }
  return { medianMs: median(runs), runs };
}

async function timeAsync(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

class FsDataProvider implements DataProvider {
  calls = 0;
  constructor(private generatedDir: string) {}
  async getManifest(): Promise<ReadModelManifest> {
    throw new Error("not used in benchmark");
  }
  async listRecords(): Promise<RecordSummary[]> {
    throw new Error("not used in benchmark");
  }
  async getRecord(id: string): Promise<RecordDetail> {
    this.calls++;
    const raw = fs.readFileSync(path.join(this.generatedDir, "record-detail", `${id}.json`), "utf8");
    return JSON.parse(raw) as RecordDetail;
  }
  async getEdges(): Promise<RecordEdge[]> {
    throw new Error("not used in benchmark");
  }
}

describe.skipIf(!scale)("RE-05 scale benchmark", () => {
  it(
    `measures Records/Problem/Graph code paths at scale=${scale}`,
    async () => {
    const generatedDir = path.resolve(__dirname, "..", "..", "benchmark", "output", String(scale), "generated");
    const records: RecordSummary[] = JSON.parse(fs.readFileSync(path.join(generatedDir, "index.json"), "utf8"));
    const edges: RecordEdge[] = JSON.parse(fs.readFileSync(path.join(generatedDir, "edges.json"), "utf8"));
    const lookup = buildRecordLookup(records);

    // --- Records search/filter (computeRecordsView, the exact function
    // RecordsTable.tsx drives) ------------------------------------------------
    const searchNoQuery = timeIt(
      () => computeRecordsView({ records, query: "", typeFilter: "all", sorting: [], pagination: { pageIndex: 0, pageSize: 25 } }),
      20
    );
    const searchTextQuery = timeIt(
      () => computeRecordsView({ records, query: "synthetic", typeFilter: "all", sorting: [], pagination: { pageIndex: 0, pageSize: 25 } }),
      20
    );
    const searchTypeFilter = timeIt(
      () => computeRecordsView({ records, query: "", typeFilter: "PRB-", sorting: [], pagination: { pageIndex: 0, pageSize: 25 } }),
      20
    );
    const searchSorted = timeIt(
      () =>
        computeRecordsView({
          records,
          query: "",
          typeFilter: "all",
          sorting: [{ id: "label", desc: false }],
          pagination: { pageIndex: 0, pageSize: 25 },
        }),
      20
    );

    // --- Problem projection (loadProblemProjection, the real N+1 fetch
    // pattern) — one hub PRB (max declared evidence-list length) and one
    // typical PRB (closest to the median). --------------------------------
    const prbIds = records.filter((r) => r.type === "PRB-").map((r) => r.id);
    const outgoingEvidenceCount = new Map<string, number>();
    for (const e of edges) {
      if (e.field === "evidence") outgoingEvidenceCount.set(e.from, (outgoingEvidenceCount.get(e.from) || 0) + 1);
    }
    const sortedByEvidence = [...prbIds].sort((a, b) => (outgoingEvidenceCount.get(b) || 0) - (outgoingEvidenceCount.get(a) || 0));
    const hubPrb = sortedByEvidence[0];
    const typicalPrb = sortedByEvidence[Math.floor(sortedByEvidence.length / 2)];

    const hubProvider = new FsDataProvider(generatedDir);
    const hubMs = await timeAsync(() => loadProblemProjection(hubProvider, lookup, hubPrb));
    const typicalProvider = new FsDataProvider(generatedDir);
    const typicalMs = await timeAsync(() => loadProblemProjection(typicalProvider, lookup, typicalPrb));

    // --- Graph: full-corpus model construction (stress observation) + a
    // neighbourhood-first 1-hop/2-hop query from the hub PRB (the supported,
    // primary Graph workflow). --------------------------------
    const graphBuildMs = timeIt(() => buildGraphModel(records, edges), 3);
    const graph = buildGraphModel(records, edges);

    const hopMs = timeIt(() => computeHopMap(graph, hubPrb), 10);
    const hopOf = computeHopMap(graph, hubPrb);
    const oneHopMs = timeIt(() => neighbourhoodView(graph, hubPrb, hopOf, 1, null), 10);
    const twoHopMs = timeIt(() => neighbourhoodView(graph, hubPrb, hopOf, 2, null), 10);
    const oneHop = neighbourhoodView(graph, hubPrb, hopOf, 1, null);
    const twoHop = neighbourhoodView(graph, hubPrb, hopOf, 2, null);

    const memUsedMB = process.memoryUsage().heapUsed / (1024 * 1024);

    const results = {
      scale: Number(scale),
      totalRecords: records.length,
      totalEdges: edges.length,
      search: {
        noQueryMedianMs: searchNoQuery.medianMs,
        textQueryMedianMs: searchTextQuery.medianMs,
        typeFilterMedianMs: searchTypeFilter.medianMs,
        sortedMedianMs: searchSorted.medianMs,
      },
      problemProjection: {
        hub: { id: hubPrb, evidenceOutDegree: outgoingEvidenceCount.get(hubPrb) || 0, elapsedMs: hubMs, providerCalls: hubProvider.calls },
        typical: {
          id: typicalPrb,
          evidenceOutDegree: outgoingEvidenceCount.get(typicalPrb) || 0,
          elapsedMs: typicalMs,
          providerCalls: typicalProvider.calls,
        },
      },
      graph: {
        fullModelBuildMedianMs: graphBuildMs.medianMs,
        fullModelNodeCount: graph.order,
        fullModelEdgeCount: graph.size,
        hopMapMedianMs: hopMs.medianMs,
        focusNode: hubPrb,
        oneHop: { medianMs: oneHopMs.medianMs, nodeCount: oneHop.nodeIds.length, edgeCount: oneHop.edgeIds.length },
        twoHop: { medianMs: twoHopMs.medianMs, nodeCount: twoHop.nodeIds.length, edgeCount: twoHop.edgeIds.length },
      },
      nodeProcessHeapUsedMB: memUsedMB,
    };

    fs.writeFileSync(path.join(path.dirname(generatedDir), "ui-results.json"), JSON.stringify(results, null, 2) + "\n");
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results, null, 2));

      expect(records.length).toBeGreaterThan(0);
    },
    120_000
  );
});
