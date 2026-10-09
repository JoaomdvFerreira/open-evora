import { describe, expect, it, vi } from "vitest";
import { loadProblemProjection } from "./problemProjection";
import { StaticDataProvider } from "../dataProvider/StaticDataProvider";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import generatedIndex from "../../generated/index.json";
const index:RecordSummary[]=[{id:"PRB-1",type:"PRB-",label:"P",file:"",summaryFields:{}},{id:"EVD-1",type:"EVD-",label:"E",file:"",summaryFields:{}},{id:"SRC-1",type:"SRC-",label:"S",file:"",summaryFields:{}}];
const records:Record<string,RecordDetail>={"PRB-1":{corpusFingerprint:"same",id:"PRB-1",type:"PRB-",file:"",record:{evidence:[{evidence_id:"EVD-1",effects:["SUPPORTS"],research_roles:["LOCAL_OBSERVATION"]}]},outgoingEdges:[{field:"evidence",ordinal:0,to:"EVD-1"}],incomingEdges:[]},"EVD-1":{corpusFingerprint:"same",id:"EVD-1",type:"EVD-",file:"",record:{},outgoingEdges:[{field:"provenance.sources",ordinal:0,to:"SRC-1"}],incomingEdges:[]},"SRC-1":{corpusFingerprint:"same",id:"SRC-1",type:"SRC-",file:"",record:{},outgoingEdges:[],incomingEdges:[]}};
const provider:DataProvider={getManifest:async()=>{throw Error("unused")},listRecords:async()=>index,getEdges:async()=>[],getRecord:async id=>records[id]};
describe("Problem projection vNext",()=>{it("uses PRB effects and EVD provenance",async()=>{const r=await loadProblemProjection(provider,new Map(index.map(x=>[x.id,x])),"PRB-1");expect(r.evidence[0].effects).toEqual(["SUPPORTS"]);expect(r.evidence[0].sources.map(x=>x.id)).toEqual(["SRC-1"]);});});

it("fails closed when an old session receives a new-version PRB that references newly added Evidence", async () => {
  const mismatch = Object.assign(new Error("Os dados publicados foram atualizados. Recarregue a página antes de continuar."), { kind: "version_mismatch" });
  const oldLookup = new Map(index.filter((item) => item.id !== "EVD-NEW").map((item) => [item.id, item]));
  const skewedProvider: DataProvider = { ...provider, getRecord: async (id) => {
    if (id === "PRB-1") throw mismatch;
    if (id === "EVD-NEW") return { ...records["EVD-1"], id: "EVD-NEW", corpusFingerprint: "version-b" };
    return records[id];
  } };
  await expect(loadProblemProjection(skewedProvider, oldLookup, "PRB-1")).rejects.toMatchObject({ kind: "version_mismatch" });
});

it("uses only graph-backed provenance and PRB relationship metadata, never EVD-v1 fallbacks", async () => {
  const legacy: Record<string, RecordDetail> = {
    ...records,
    "EVD-1": {
      ...records["EVD-1"],
      record: {
        source: { source_id: "SRC-legacy" },
        additional_sources: [{ source_id: "SRC-extra" }],
        analysis: { contribution: "SUPPORTS" },
      },
      outgoingEdges: [{ field: "provenance.sources", ordinal: 0, to: "SRC-1" }],
    },
  };
  const legacyProvider: DataProvider = { ...provider, getRecord: async (id) => legacy[id] };
  const result = await loadProblemProjection(legacyProvider, new Map(index.map((item) => [item.id, item])), "PRB-1");
  expect(result.evidence[0]).toMatchObject({ effects: ["SUPPORTS"], researchRoles: ["LOCAL_OBSERVATION"] });
  expect(result.evidence[0].sources.map((source) => source.id)).toEqual(["SRC-1"]);
});

const corpusIndex = generatedIndex as RecordSummary[];
const corpusLookup = new Map(corpusIndex.map((item) => [item.id, item]));
const corpusDetails = import.meta.glob<RecordDetail>("../../generated/record-detail/*.json", { eager: true, import: "default" });
const corpusProvider: DataProvider = {
  ...provider,
  getRecord: async (id) => corpusDetails[`../../generated/record-detail/${id}.json`],
};

it("preserves authored Evidence order and unrelated relationships for a PRB with differently ordered decision-basis edges", async () => {
  const problem = await corpusProvider.getRecord("PRB-0001");
  const authored = problem.record.evidence as { evidence_id: string; effects: string[]; research_roles: string[] }[];
  const authoredIds = authored.map((entry) => entry.evidence_id);
  const edgeIds = problem.outgoingEdges.filter((edge) => corpusLookup.get(edge.to ?? "")?.type === "EVD-").map((edge) => edge.to);
  expect(edgeIds.slice(0, authoredIds.length)).not.toEqual(authoredIds);

  const projection = await loadProblemProjection(corpusProvider, corpusLookup, problem.id);
  expect(projection.evidence.map(({ detail }) => detail.id)).toEqual(authoredIds);
  expect(new Set(projection.evidence.map(({ detail }) => detail.id)).size).toBe(authoredIds.length);
  expect(projection.problem.outgoingEdges).toEqual(problem.outgoingEdges);
  for (const [index, evidence] of projection.evidence.entries()) {
    expect(evidence.effects).toEqual(authored[index].effects);
    expect(evidence.researchRoles).toEqual(authored[index].research_roles);
    expect(evidence.sources.map((source) => source.id)).toEqual(
      evidence.detail.outgoingEdges.filter((edge) => corpusLookup.get(edge.to ?? "")?.type === "SRC-").map((edge) => edge.to)
    );
  }
});

it("projects every canonical PRB Evidence ID exactly once in authored order", async () => {
  const problemIds = corpusIndex.filter((item) => item.type === "PRB-").map((item) => item.id);
  expect(problemIds).toHaveLength(12);
  for (const problemId of problemIds) {
    const projection = await loadProblemProjection(corpusProvider, corpusLookup, problemId);
    const authoredIds = (projection.problem.record.evidence as { evidence_id: string }[]).map((entry) => entry.evidence_id);
    const projectedIds = projection.evidence.map(({ detail }) => detail.id);
    expect(projectedIds, problemId).toEqual(authoredIds);
    expect(new Set(projectedIds).size, problemId).toBe(authoredIds.length);
  }
});

const sharedSourceIndex: RecordSummary[] = ["PRB-2", "EVD-A", "EVD-B", "SRC-SHARED", "SRC-ONLY"].map((id) => ({ id, type: `${id.split("-")[0]}-`, label: id, file: `research/${id}.yaml`, summaryFields: {} }));
const sharedSourceLookup = new Map(sharedSourceIndex.map((item) => [item.id, item]));
const linkedDetail = (id: string, record: Record<string, unknown>, field: string, targets: string[]): RecordDetail => ({
  corpusFingerprint: "same",
  id,
  type: `${id.split("-")[0]}-`,
  file: `research/${id}.yaml`,
  record,
  outgoingEdges: targets.map((to, ordinal) => ({ field, ordinal, to })),
  incomingEdges: [],
});
// EVD-B is authored first and is the first to cite SRC-SHARED, so the
// projection-wide Source order differs from EVD-A's own Source order.
const sharedSourceRecords: Record<string, RecordDetail> = {
  "PRB-2": linkedDetail("PRB-2", {
    evidence: [
      { evidence_id: "EVD-B", effects: ["REFINES"], research_roles: ["CONTEXTUAL"] },
      { evidence_id: "EVD-A", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] },
    ],
  }, "evidence", ["EVD-B", "EVD-A"]),
  "EVD-A": linkedDetail("EVD-A", {}, "provenance.sources", ["SRC-ONLY", "SRC-SHARED"]),
  "EVD-B": linkedDetail("EVD-B", {}, "provenance.sources", ["SRC-SHARED"]),
  "SRC-SHARED": linkedDetail("SRC-SHARED", {}, "provenance.sources", []),
  "SRC-ONLY": linkedDetail("SRC-ONLY", {}, "provenance.sources", []),
};
const sharedSourceShape = [
  { id: "EVD-B", sources: ["SRC-SHARED"], effects: ["REFINES"], researchRoles: ["CONTEXTUAL"] },
  { id: "EVD-A", sources: ["SRC-ONLY", "SRC-SHARED"], effects: ["SUPPORTS"], researchRoles: ["LOCAL_OBSERVATION"] },
];
const shapeOf = (evidence: Awaited<ReturnType<typeof loadProblemProjection>>["evidence"]) =>
  evidence.map(({ detail, sources, effects, researchRoles }) => ({ id: detail.id, sources: sources.map((source) => source.id), effects, researchRoles }));

it("requests a Source shared by several Evidence records once per projection, keeping it under each citing Evidence in that Evidence's order", async () => {
  const requested: string[] = [];
  const nonCachingProvider: DataProvider = { ...provider, getRecord: async (id) => { requested.push(id); return sharedSourceRecords[id]; } };
  const projection = await loadProblemProjection(nonCachingProvider, sharedSourceLookup, "PRB-2");

  expect(requested.filter((id) => id === "SRC-SHARED")).toHaveLength(1);
  expect([...requested].sort()).toEqual(["EVD-A", "EVD-B", "PRB-2", "SRC-ONLY", "SRC-SHARED"]);
  expect(shapeOf(projection.evidence)).toEqual(sharedSourceShape);
  expect(projection.evidence[0].sources[0]).toBe(projection.evidence[1].sources[1]);
});

it("revisits a PRB through the same StaticDataProvider without issuing any further record-detail request", async () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const manifest = { readModelVersion: "1.0.0", generatedAt: "2026-01-01T00:00:00.000Z", generator: "test", sourceCommit: null, corpusFingerprint: "same", totalRecords: sharedSourceIndex.length, counts: {}, schemaPrefixes: [] };
  const fetchMock = vi.fn(async (url: string) => {
    const path = String(url).slice(import.meta.env.BASE_URL.length);
    if (path === "manifest.json") return json(manifest);
    if (path === "index.json") return json(sharedSourceIndex);
    const id = /^record-detail\/(.+)\.json$/.exec(path)?.[1];
    return id && sharedSourceRecords[id] ? json(sharedSourceRecords[id]) : new Response(null, { status: 404 });
  });
  const detailRequests = () => fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("record-detail/")).map((url) => url.slice(url.lastIndexOf("/") + 1)).sort();
  vi.stubGlobal("fetch", fetchMock);
  try {
    const sessionProvider = new StaticDataProvider();
    const cold = await loadProblemProjection(sessionProvider, sharedSourceLookup, "PRB-2");
    expect(detailRequests()).toEqual(["EVD-A.json", "EVD-B.json", "PRB-2.json", "SRC-ONLY.json", "SRC-SHARED.json"]);
    expect(shapeOf(cold.evidence)).toEqual(sharedSourceShape);
    const coldFetches = fetchMock.mock.calls.length;

    const revisit = await loadProblemProjection(sessionProvider, sharedSourceLookup, "PRB-2");
    expect(fetchMock.mock.calls.length).toBe(coldFetches);
    expect(detailRequests()).toHaveLength(5);
    expect(revisit).toEqual(cold);
  } finally {
    vi.unstubAllGlobals();
  }
});
