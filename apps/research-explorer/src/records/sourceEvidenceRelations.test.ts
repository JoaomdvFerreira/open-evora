import { describe, expect, it } from "vitest";
import { loadSourceEvidenceRelations, toSourceSectionRelationContext } from "./sourceEvidenceRelations";
import type { DataProvider, RecordDetail } from "../dataProvider/types";

function detail(overrides: Partial<RecordDetail> & Pick<RecordDetail, "id" | "type">): RecordDetail {
  return {
    file: `research/${overrides.type === "SRC-" ? "sources" : overrides.type === "EVD-" ? "evidence" : "problems"}/${overrides.id}.yaml`,
    record: { id: overrides.id },
    outgoingEdges: [],
    incomingEdges: [],
    ...overrides,
  };
}

function fakeProvider(details: Record<string, RecordDetail>): DataProvider {
  return {
    getManifest: () => Promise.reject(new Error("not used")),
    listRecords: () => Promise.resolve([]),
    getRecord: (id: string) => {
      const found = details[id];
      return found ? Promise.resolve(found) : Promise.reject(new Error(`no fixture detail for ${id}`));
    },
    getEdges: () => Promise.resolve([]),
  };
}

describe("loadSourceEvidenceRelations", () => {
  it("1. classifies a single source.source_id EVD as primary", async () => {
    const src = detail({ id: "SRC-1", type: "SRC-", incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-1" }] });
    const evd1 = detail({ id: "EVD-1", type: "EVD-" });
    const provider = fakeProvider({ "SRC-1": src, "EVD-1": evd1 });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.primaryEvidence.map((d) => d.id)).toEqual(["EVD-1"]);
    expect(relations.additionalEvidence).toEqual([]);
    expect(relations.uniqueEvidenceCount).toBe(1);
  });

  it("2. classifies a single additional_sources EVD as additional", async () => {
    const src = detail({ id: "SRC-1", type: "SRC-", incomingEdges: [{ field: "additional_sources", ordinal: 0, from: "EVD-2" }] });
    const evd2 = detail({ id: "EVD-2", type: "EVD-" });
    const provider = fakeProvider({ "SRC-1": src, "EVD-2": evd2 });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.primaryEvidence).toEqual([]);
    expect(relations.additionalEvidence.map((d) => d.id)).toEqual(["EVD-2"]);
    expect(relations.uniqueEvidenceCount).toBe(1);
  });

  it("3. keeps both categories separate when both are present", async () => {
    const src = detail({
      id: "SRC-1",
      type: "SRC-",
      incomingEdges: [
        { field: "source.source_id", ordinal: null, from: "EVD-1" },
        { field: "additional_sources", ordinal: 0, from: "EVD-2" },
      ],
    });
    const evd1 = detail({ id: "EVD-1", type: "EVD-" });
    const evd2 = detail({ id: "EVD-2", type: "EVD-" });
    const provider = fakeProvider({ "SRC-1": src, "EVD-1": evd1, "EVD-2": evd2 });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.primaryEvidence.map((d) => d.id)).toEqual(["EVD-1"]);
    expect(relations.additionalEvidence.map((d) => d.id)).toEqual(["EVD-2"]);
    expect(relations.uniqueEvidenceCount).toBe(2);
  });

  it("4. same EVD reaching SRC through both paths: primary wins, no duplicate", async () => {
    const src = detail({
      id: "SRC-1",
      type: "SRC-",
      incomingEdges: [
        { field: "source.source_id", ordinal: null, from: "EVD-1" },
        { field: "additional_sources", ordinal: 0, from: "EVD-1" },
      ],
    });
    const evd1 = detail({ id: "EVD-1", type: "EVD-" });
    const provider = fakeProvider({ "SRC-1": src, "EVD-1": evd1 });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.primaryEvidence.map((d) => d.id)).toEqual(["EVD-1"]);
    expect(relations.additionalEvidence).toEqual([]);
    expect(relations.uniqueEvidenceCount).toBe(1);
  });

  it("5. unrelated incoming edge field is ignored", async () => {
    const src = detail({ id: "SRC-1", type: "SRC-", incomingEdges: [{ field: "some_other_field", ordinal: null, from: "EVD-9" }] });
    const provider = fakeProvider({ "SRC-1": src });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.primaryEvidence).toEqual([]);
    expect(relations.additionalEvidence).toEqual([]);
    expect(relations.uniqueEvidenceCount).toBe(0);
  });

  it("6. no EVD backlinks at all — empty case", async () => {
    const src = detail({ id: "SRC-1", type: "SRC-", incomingEdges: [] });
    const provider = fakeProvider({ "SRC-1": src });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.primaryEvidence).toEqual([]);
    expect(relations.additionalEvidence).toEqual([]);
    expect(relations.uniqueEvidenceCount).toBe(0);
    expect(relations.relatedProblems).toEqual([]);
  });

  it("7. EVD with one analysis.related_problems PRB is reachable", async () => {
    const src = detail({ id: "SRC-1", type: "SRC-", incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-1" }] });
    const evd1 = detail({ id: "EVD-1", type: "EVD-", outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-1" }] });
    const provider = fakeProvider({ "SRC-1": src, "EVD-1": evd1 });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.relatedProblems).toEqual([{ problemId: "PRB-1", viaEvidenceIds: ["EVD-1"] }]);
  });

  it("8. multiple EVDs reaching the same PRB are deduplicated", async () => {
    const src = detail({
      id: "SRC-1",
      type: "SRC-",
      incomingEdges: [
        { field: "source.source_id", ordinal: null, from: "EVD-1" },
        { field: "additional_sources", ordinal: 0, from: "EVD-2" },
      ],
    });
    const evd1 = detail({ id: "EVD-1", type: "EVD-", outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-1" }] });
    const evd2 = detail({ id: "EVD-2", type: "EVD-", outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-1" }] });
    const provider = fakeProvider({ "SRC-1": src, "EVD-1": evd1, "EVD-2": evd2 });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.relatedProblems).toHaveLength(1);
    expect(relations.relatedProblems[0].problemId).toBe("PRB-1");
    expect(relations.relatedProblems[0].viaEvidenceIds.sort()).toEqual(["EVD-1", "EVD-2"]);
  });

  it("9. one EVD reaching multiple PRBs lists both", async () => {
    const src = detail({ id: "SRC-1", type: "SRC-", incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-1" }] });
    const evd1 = detail({
      id: "EVD-1",
      type: "EVD-",
      outgoingEdges: [
        { field: "analysis.related_problems", ordinal: 0, to: "PRB-1" },
        { field: "analysis.related_problems", ordinal: 1, to: "PRB-2" },
      ],
    });
    const provider = fakeProvider({ "SRC-1": src, "EVD-1": evd1 });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.relatedProblems.map((p) => p.problemId).sort()).toEqual(["PRB-1", "PRB-2"]);
  });

  it("10. unrelated EVD outgoing relation is ignored for PRB traversal", async () => {
    const src = detail({ id: "SRC-1", type: "SRC-", incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-1" }] });
    const evd1 = detail({ id: "EVD-1", type: "EVD-", outgoingEdges: [{ field: "some_other_field", ordinal: 0, to: "PRB-1" }] });
    const provider = fakeProvider({ "SRC-1": src, "EVD-1": evd1 });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.relatedProblems).toEqual([]);
  });

  it("11. no EVD backlinks — relatedProblems is empty", async () => {
    const src = detail({ id: "SRC-1", type: "SRC-", incomingEdges: [] });
    const provider = fakeProvider({ "SRC-1": src });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.relatedProblems).toEqual([]);
  });

  it("12. EVD backlink exists but no related PRB", async () => {
    const src = detail({ id: "SRC-1", type: "SRC-", incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-1" }] });
    const evd1 = detail({ id: "EVD-1", type: "EVD-", outgoingEdges: [] });
    const provider = fakeProvider({ "SRC-1": src, "EVD-1": evd1 });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-1");
    expect(relations.primaryEvidence.map((d) => d.id)).toEqual(["EVD-1"]);
    expect(relations.relatedProblems).toEqual([]);
  });

  it("13. SRC-0093 -> EVD-000106 -> PRB-0005 acceptance shape", async () => {
    const src = detail({
      id: "SRC-0093",
      type: "SRC-",
      incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-000106" }],
    });
    const evd = detail({
      id: "EVD-000106",
      type: "EVD-",
      outgoingEdges: [{ field: "analysis.related_problems", ordinal: 0, to: "PRB-0005" }],
    });
    const provider = fakeProvider({ "SRC-0093": src, "EVD-000106": evd });

    const relations = await loadSourceEvidenceRelations(provider, "SRC-0093");
    expect(relations.primaryEvidence.map((d) => d.id)).toEqual(["EVD-000106"]);
    expect(relations.additionalEvidence).toEqual([]);
    expect(relations.uniqueEvidenceCount).toBe(1);
    expect(relations.relatedProblems).toEqual([{ problemId: "PRB-0005", viaEvidenceIds: ["EVD-000106"] }]);
  });
});

describe("toSourceSectionRelationContext", () => {
  it("14a. reports hasRelatedProblem true when at least one PRB is reachable", () => {
    expect(toSourceSectionRelationContext({ relatedProblems: [{ problemId: "PRB-1", viaEvidenceIds: ["EVD-1"] }] })).toEqual({
      hasRelatedProblem: true,
    });
  });

  it("14b. reports hasRelatedProblem false for no related problems (empty case)", () => {
    expect(toSourceSectionRelationContext({ relatedProblems: [] })).toEqual({ hasRelatedProblem: false });
  });
});
