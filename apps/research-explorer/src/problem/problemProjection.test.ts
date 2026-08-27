import { describe, expect, it } from "vitest";
import { loadProblemProjection } from "./problemProjection";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
const index:RecordSummary[]=[{id:"PRB-1",type:"PRB-",label:"P",file:"",summaryFields:{}},{id:"EVD-1",type:"EVD-",label:"E",file:"",summaryFields:{}},{id:"SRC-1",type:"SRC-",label:"S",file:"",summaryFields:{}}];
const records:Record<string,RecordDetail>={"PRB-1":{id:"PRB-1",type:"PRB-",file:"",record:{evidence:[{evidence_id:"EVD-1",effects:["SUPPORTS"],research_roles:["LOCAL_OBSERVATION"]}]},outgoingEdges:[{field:"evidence",ordinal:0,to:"EVD-1"}],incomingEdges:[]},"EVD-1":{id:"EVD-1",type:"EVD-",file:"",record:{},outgoingEdges:[{field:"provenance.sources",ordinal:0,to:"SRC-1"}],incomingEdges:[]},"SRC-1":{id:"SRC-1",type:"SRC-",file:"",record:{},outgoingEdges:[],incomingEdges:[]}};
const provider:DataProvider={getManifest:async()=>{throw Error("unused")},listRecords:async()=>index,getEdges:async()=>[],getRecord:async id=>records[id]};
describe("Problem projection vNext",()=>{it("uses PRB effects and EVD provenance",async()=>{const r=await loadProblemProjection(provider,new Map(index.map(x=>[x.id,x])),"PRB-1");expect(r.evidence[0].effects).toEqual(["SUPPORTS"]);expect(r.evidence[0].sources.map(x=>x.id)).toEqual(["SRC-1"]);});});

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
