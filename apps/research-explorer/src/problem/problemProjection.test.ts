import { describe, expect, it, vi } from "vitest";
import { loadProblemProjection } from "./problemProjection";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import { buildRecordLookup } from "../records/recordIndex";

const INDEX: RecordSummary[] = [
  { id: "PRB-0005", type: "PRB-", label: "Parking pressure", file: "research/problems/PRB-0005.yaml", summaryFields: {} },
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
    incomingEdges: [{ field: "analysis.related_problems", ordinal: 0, from: "EVD-0002" }],
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
  it("assembles the problem and its evidence (both directions) and sources", async () => {
    const lookup = buildRecordLookup(INDEX);
    const projection = await loadProblemProjection(fakeProvider(), lookup, "PRB-0005");

    expect(projection.problem.id).toBe("PRB-0005");

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

    // 1 (problem) + 2 (evidence) + 1 (source) = 4
    expect(getRecordSpy).toHaveBeenCalledTimes(4);
  });

  it("carries the canonical PI-01 Problem fields through untransformed (causal_reading, investigation.*, solution_landscape_status)", async () => {
    const piIndex: RecordSummary[] = [
      { id: "PRB-0100", type: "PRB-", label: "PI-01 fixture", file: "research/problems/PRB-0100.yaml", summaryFields: {} },
    ];
    const piRecord = {
      problem_id: "PRB-0100",
      title: "PI-01 fixture",
      causal_reading: "A bounded, unvalidated causal reading.",
      investigation: {
        open_questions: [{ question: "What remains unresolved?", evidence: ["EVD-0001"] }],
        path: {
          initial_signal: { summary: "First signal.", evidence: ["EVD-0001"] },
          development: { summary: "How it developed.", evidence: [] },
          delimitation: { summary: "How it was bounded.", evidence: [] },
        },
      },
      solution_landscape_status: "assessed",
    };
    const piDetail: RecordDetail = {
      id: "PRB-0100",
      type: "PRB-",
      file: "research/problems/PRB-0100.yaml",
      record: piRecord,
      outgoingEdges: [],
      incomingEdges: [],
    };
    const provider: DataProvider = {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.resolve(piIndex),
      getRecord: () => Promise.resolve(piDetail),
      getEdges: () => Promise.resolve([]),
    };

    const projection = await loadProblemProjection(provider, buildRecordLookup(piIndex), "PRB-0100");

    // No semantic transformation: the projection is a pass-through — the
    // exact canonical object identity/shape is preserved on `problem.record`.
    expect(projection.problem.record).toEqual(piRecord);
    expect((projection.problem.record as typeof piRecord).causal_reading).toBe("A bounded, unvalidated causal reading.");
    expect((projection.problem.record as typeof piRecord).investigation.open_questions[0].question).toBe("What remains unresolved?");
    expect((projection.problem.record as typeof piRecord).investigation.path.initial_signal!.summary).toBe("First signal.");
    expect((projection.problem.record as typeof piRecord).solution_landscape_status).toBe("assessed");

    // Removed canonical fields carry no projection assumption: their absence
    // from the canonical record must not be treated specially anywhere here.
    expect("current_journey" in piRecord).toBe(false);
    expect("reported_consequences" in piRecord).toBe(false);
    expect("possible_root_causes" in piRecord).toBe(false);
    expect("existing_solutions" in piRecord).toBe(false);
  });

  it("handles a problem with no evidence gracefully", async () => {
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
    expect(projection.evidence).toEqual([]);
  });
});
