import { describe, expect, it } from "vitest";
import { loadEvdProblemUses } from "./evdRelations";
import type { DataProvider, RecordDetail } from "../dataProvider/types";

const evidence: RecordDetail = { id: "EVD-1", type: "EVD-", file: "", record: {}, outgoingEdges: [], incomingEdges: [{ field: "evidence", ordinal: 1, from: "PRB-1" }, { field: "other", ordinal: 0, from: "PRB-2" }] };
const problem: RecordDetail = { id: "PRB-1", type: "PRB-", file: "", incomingEdges: [], outgoingEdges: [], record: { title: "Problema", evidence: [{ evidence_id: "EVD-other", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] }, { evidence_id: "EVD-1", effects: ["REFINES"], research_roles: ["COMPARATIVE_MECHANISM"] }] } };
const provider: DataProvider = { getManifest: async () => { throw Error("unused"); }, listRecords: async () => [], getEdges: async () => [], getRecord: async (id) => ({ "EVD-1": evidence, "PRB-1": problem }[id]!) };

describe("EVD → PRB relationship projection", () => {
  it("resolves only incoming PRB evidence edges and projects the matching top-level relationship", async () => {
    await expect(loadEvdProblemUses(provider, "EVD-1")).resolves.toEqual([{ detail: problem, effects: ["REFINES"], researchRoles: ["COMPARATIVE_MECHANISM"], relationshipPath: "evidence[1]" }]);
  });
});
