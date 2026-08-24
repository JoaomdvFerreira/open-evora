import { describe, expect, it, vi } from "vitest";
import { loadProblemProjection } from "./problemProjection";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import { buildRecordLookup } from "../records/recordIndex";

const INDEX: RecordSummary[] = [
  { id: "PRB-0005", type: "PRB-", label: "Parking pressure", file: "research/problems/PRB-0005.yaml", summaryFields: {} },
  { id: "ASM-0005", type: "ASM-", label: "ASM-0005", file: "research/assessments/ASM-0005.yaml", summaryFields: {} },
  { id: "EVD-0001", type: "EVD-", label: "Evidence one", file: "research/evidence/EVD-0001.yaml", summaryFields: {} },
  { id: "EVD-0002", type: "EVD-", label: "Evidence two (linked only via analysis.related_problems)", file: "research/evidence/EVD-0002.yaml", summaryFields: {} },
  { id: "SRC-0001", type: "SRC-", label: "Source one", file: "research/sources/SRC-0001.yaml", summaryFields: {} },
];

const DETAILS: Record<string, RecordDetail> = {
  "PRB-0005": {
    id: "PRB-0005",
    type: "PRB-",
    file: "research/problems/PRB-0005.yaml",
    record: { title: "Parking pressure" },
    outgoingEdges: [{ field: "evidence", ordinal: 0, to: "EVD-0001" }],
    incomingEdges: [
      { field: "problem", ordinal: null, from: "ASM-0005" },
      { field: "analysis.related_problems", ordinal: 0, from: "EVD-0002" },
    ],
  },
  "ASM-0005": {
    id: "ASM-0005",
    type: "ASM-",
    file: "research/assessments/ASM-0005.yaml",
    record: { assessment_id: "ASM-0005", problem: "PRB-0005", triage: "DEEPEN" },
    outgoingEdges: [{ field: "problem", ordinal: null, to: "PRB-0005" }],
    incomingEdges: [],
  },
  "EVD-0001": {
    id: "EVD-0001",
    type: "EVD-",
    file: "research/evidence/EVD-0001.yaml",
    record: { evidence_id: "EVD-0001" },
    outgoingEdges: [{ field: "source.source_id", ordinal: null, to: "SRC-0001" }],
    incomingEdges: [{ field: "evidence", ordinal: 0, from: "PRB-0005" }],
  },
  "EVD-0002": {
    id: "EVD-0002",
    type: "EVD-",
    file: "research/evidence/EVD-0002.yaml",
    record: { evidence_id: "EVD-0002" },
    outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-0005" }],
    incomingEdges: [],
  },
  "SRC-0001": {
    id: "SRC-0001",
    type: "SRC-",
    file: "research/sources/SRC-0001.yaml",
    record: { source_id: "SRC-0001" },
    outgoingEdges: [],
    incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-0001" }],
  },
};

function fakeProvider(): DataProvider {
  return {
    getManifest: () => Promise.reject(new Error("not used")),
    listRecords: () => Promise.resolve(INDEX),
    getRecord: (id: string) => {
      const detail = DETAILS[id];
      return detail ? Promise.resolve(detail) : Promise.reject(new Error(`no fixture detail for ${id}`));
    },
    getEdges: () => Promise.resolve([]),
  };
}

describe("loadProblemProjection", () => {
  it("assembles the problem, its assessment, evidence (both directions), and sources", async () => {
    const lookup = buildRecordLookup(INDEX);
    const projection = await loadProblemProjection(fakeProvider(), lookup, "PRB-0005");

    expect(projection.problem.id).toBe("PRB-0005");
    expect(projection.assessments.map((a) => a.id)).toEqual(["ASM-0005"]);

    // Evidence linked via PRB's own outgoing "evidence" AND via EVD's incoming
    // "analysis.related_problems" are both included, deduplicated.
    expect(projection.evidence.map((e) => e.detail.id).sort()).toEqual(["EVD-0001", "EVD-0002"]);

    const evd1 = projection.evidence.find((e) => e.detail.id === "EVD-0001")!;
    expect(evd1.sources.map((s) => s.id)).toEqual(["SRC-0001"]);

    const evd2 = projection.evidence.find((e) => e.detail.id === "EVD-0002")!;
    expect(evd2.sources).toEqual([]);
  });

  it("fetches independent record groups in parallel, not sequentially", async () => {
    const provider = fakeProvider();
    const getRecordSpy = vi.spyOn(provider, "getRecord");
    const lookup = buildRecordLookup(INDEX);

    await loadProblemProjection(provider, lookup, "PRB-0005");

    // 1 (problem) + 1 (assessment) + 2 (evidence) + 1 (source) = 5
    expect(getRecordSpy).toHaveBeenCalledTimes(5);
  });

  it("handles a problem with no assessments or evidence gracefully", async () => {
    const soloIndex: RecordSummary[] = [
      { id: "PRB-9001", type: "PRB-", label: "Solo problem", file: "research/problems/PRB-9001.yaml", summaryFields: {} },
    ];
    const soloDetail: RecordDetail = {
      id: "PRB-9001",
      type: "PRB-",
      file: "research/problems/PRB-9001.yaml",
      record: { title: "Solo problem" },
      outgoingEdges: [],
      incomingEdges: [],
    };
    const provider: DataProvider = {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.resolve(soloIndex),
      getRecord: () => Promise.resolve(soloDetail),
      getEdges: () => Promise.resolve([]),
    };

    const projection = await loadProblemProjection(provider, buildRecordLookup(soloIndex), "PRB-9001");
    expect(projection.assessments).toEqual([]);
    expect(projection.evidence).toEqual([]);
  });
});
