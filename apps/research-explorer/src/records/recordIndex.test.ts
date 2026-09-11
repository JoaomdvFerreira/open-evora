import { describe, expect, it } from "vitest";
import { ALL_TYPES, availableRecordTypes, buildRecordLookup, filterRecords, recordSearchText } from "./recordIndex";
import type { RecordSummary } from "../dataProvider/types";

function summary(overrides: Partial<RecordSummary>): RecordSummary {
  return {
    id: "PRB-0001",
    type: "PRB-",
    label: "Fixture",
    file: "research/problems/PRB-0001.yaml",
    summaryFields: {},
    ...overrides,
  };
}

const RECORDS: RecordSummary[] = [
  summary({ id: "PRB-0005", type: "PRB-", label: "Évora parking pressure" }),
  summary({ id: "EVD-000105", type: "EVD-", label: "Via Verde Parking Buddy", summaryFields: { strength: "secondary" } }),
  summary({ id: "SRC-0092", type: "SRC-", label: "Via Verde Estacionar", summaryFields: { authority: "estimated" } }),
  summary({ id: "WID-0001", type: "WID-", label: "WID-0001" }),
];

describe("buildRecordLookup", () => {
  it("builds an ID -> summary map covering every record exactly once", () => {
    const lookup = buildRecordLookup(RECORDS);
    expect(lookup.size).toBe(RECORDS.length);
    expect(lookup.get("PRB-0005")?.label).toBe("Évora parking pressure");
    expect(lookup.get("SRC-9999")).toBeUndefined();
  });
});

describe("recordSearchText", () => {
  it("includes ID, type, label, and summaryFields values", () => {
    const text = recordSearchText(RECORDS[1]);
    expect(text).toContain("evd-000105");
    expect(text).toContain("secondary");
  });

  it("includes the bounded additional canonical/detail searchText (ODM-014), beyond the truncated label and enum-only summaryFields", () => {
    const record = summary({
      id: "EVD-000200",
      type: "EVD-",
      label: "Um rótulo truncado a 80 carateres que nunca contém a frase de deteção…",
      summaryFields: { evidence_nature: "claim" },
      searchText: "conectividade rural-urbana permanece um desafio fundamental",
    });
    const text = recordSearchText(record);
    expect(text).toContain("conectividade rural-urbana");
  });

  it("tolerates a missing searchText field (pre-ODM-014 generated data)", () => {
    const record = summary({ id: "EVD-000201", searchText: undefined });
    expect(() => recordSearchText(record)).not.toThrow();
  });
});

describe("filterRecords — search", () => {
  it("matches by canonical ID", () => {
    const result = filterRecords(RECORDS, { query: "PRB-0005", typeFilter: ALL_TYPES });
    expect(result.map((r) => r.id)).toEqual(["PRB-0005"]);
  });

  it("matches by label", () => {
    const result = filterRecords(RECORDS, { query: "Parking Buddy", typeFilter: ALL_TYPES });
    expect(result.map((r) => r.id)).toEqual(["EVD-000105"]);
  });

  it("is case-insensitive", () => {
    const result = filterRecords(RECORDS, { query: "via verde", typeFilter: ALL_TYPES });
    expect(result.map((r) => r.id).sort()).toEqual(["EVD-000105", "SRC-0092"]);
  });

  it("is diacritic-insensitive: 'evora' matches 'Évora'", () => {
    const result = filterRecords(RECORDS, { query: "evora", typeFilter: ALL_TYPES });
    expect(result.map((r) => r.id)).toEqual(["PRB-0005"]);
  });

  it("ODM-014: matches a canonical detail phrase beyond the truncated label/enum summaryFields, via searchText", () => {
    const withSearchText: RecordSummary[] = [
      ...RECORDS,
      summary({
        id: "EVD-000200",
        type: "EVD-",
        label: "Um rótulo truncado a 80 carateres que nunca contém a frase de deteção…",
        searchText: "Enquadra a conectividade rural-urbana como um desafio fundamental para a igualdade no acesso aos serviços.",
      }),
    ];
    const result = filterRecords(withSearchText, { query: "conectividade rural-urbana", typeFilter: ALL_TYPES });
    expect(result.map((r) => r.id)).toEqual(["EVD-000200"]);
  });
});

describe("filterRecords — type filter", () => {
  it("filters by record type", () => {
    const result = filterRecords(RECORDS, { query: "", typeFilter: "EVD-" });
    expect(result.map((r) => r.id)).toEqual(["EVD-000105"]);
  });

  it("combines type filter and search", () => {
    const result = filterRecords(RECORDS, { query: "via verde", typeFilter: "SRC-" });
    expect(result.map((r) => r.id)).toEqual(["SRC-0092"]);
  });

  it("ALL_TYPES returns every type", () => {
    const result = filterRecords(RECORDS, { query: "", typeFilter: ALL_TYPES });
    expect(result).toHaveLength(RECORDS.length);
  });
});

describe("availableRecordTypes", () => {
  it("derives the type list from the actual data, not a hardcoded set", () => {
    expect(availableRecordTypes(RECORDS)).toEqual(["EVD-", "PRB-", "SRC-", "WID-"]);
  });
});
