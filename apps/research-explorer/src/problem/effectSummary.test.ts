import { describe, expect, it } from "vitest";
import { summarizeEffects } from "./effectSummary";
import type { EvidenceWithSources } from "./problemProjection";

const item = (id: string, effects: string[]): EvidenceWithSources => ({ detail: { id, type: "EVD-", file: "", record: {}, outgoingEdges: [], incomingEdges: [] }, sources: [], effects, researchRoles: [] });

describe("effect summary", () => {
  it("counts PRB-owned effects in frozen order", () => {
    expect(summarizeEffects([item("EVD-1", ["CONTRADICTS", "SUPPORTS"]), item("EVD-2", ["SUPPORTS", "BOUNDS"])]))
      .toEqual({ itemCount: 2, occurrenceCount: 4, occurrences: [{ value: "SUPPORTS", count: 2 }, { value: "BOUNDS", count: 1 }, { value: "CONTRADICTS", count: 1 }] });
  });
});
