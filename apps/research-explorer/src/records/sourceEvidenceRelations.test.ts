import { describe, expect, it } from "vitest";
import { loadSourceEvidenceRelations } from "./sourceEvidenceRelations";
import type { DataProvider, RecordDetail } from "../dataProvider/types";

const src: RecordDetail = { id: "SRC-1", type: "SRC-", file: "", record: {}, outgoingEdges: [], incomingEdges: [{ field: "provenance.sources", ordinal: 0, from: "EVD-1" }, { field: "provenance.sources", ordinal: 1, from: "EVD-2" }] };
const evd = (id: string, incomingEdges: RecordDetail["incomingEdges"]): RecordDetail => ({ id, type: "EVD-", file: "", record: {}, outgoingEdges: [], incomingEdges });
const records: Record<string, RecordDetail> = {
  "SRC-1": src,
  "EVD-1": evd("EVD-1", [{ field: "evidence", ordinal: 0, from: "PRB-1" }]),
  "EVD-2": evd("EVD-2", [{ field: "evidence", ordinal: 1, from: "PRB-1" }, { field: "evidence", ordinal: 0, from: "PRB-2" }]),
};
const provider: DataProvider = { getManifest: async () => { throw Error("unused"); }, listRecords: async () => [], getEdges: async () => [], getRecord: async (id) => records[id] };

describe("SRC → EVD → PRB vNext", () => {
  it("uses provenance and incoming PRB relationships only", async () => {
    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.evidence.map((item) => item.id)).toEqual(["EVD-1", "EVD-2"]);
    expect(relations.uniqueEvidenceCount).toBe(2);
    expect(relations.relatedProblems).toEqual([{ problemId: "PRB-1", viaEvidenceIds: ["EVD-1", "EVD-2"] }, { problemId: "PRB-2", viaEvidenceIds: ["EVD-2"] }]);
  });

  it("deduplicates repeated graph edges and leaves an unrelated Source empty", async () => {
    const repeated = { ...src, incomingEdges: [...src.incomingEdges, src.incomingEdges[0]] };
    const empty: RecordDetail = { ...src, id: "SRC-empty", incomingEdges: [] };
    const fixture: Record<string, RecordDetail> = { ...records, "SRC-1": repeated, "SRC-empty": empty };
    const fixtureProvider: DataProvider = { ...provider, getRecord: async (id) => fixture[id] };
    await expect(loadSourceEvidenceRelations(fixtureProvider, "SRC-1")).resolves.toMatchObject({ uniqueEvidenceCount: 2 });
    await expect(loadSourceEvidenceRelations(fixtureProvider, "SRC-empty")).resolves.toEqual({
      evidence: [], uniqueEvidenceCount: 0, relatedProblems: [],
    });
  });
});
