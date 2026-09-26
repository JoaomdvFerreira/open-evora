import { describe, expect, it } from "vitest";
import { computeRecordsView, paginationItems } from "./recordsView";
import type { RecordSummary } from "../dataProvider/types";
import { ALL_TYPES } from "./recordIndex";

function summary(overrides: Partial<RecordSummary>): RecordSummary {
  return { id: "PRB-0001", type: "PRB-", label: "Fixture", file: "research/problems/PRB-0001.yaml", summaryFields: {}, ...overrides };
}

const FIXTURE: RecordSummary[] = [
  summary({ id: "PRB-0003", type: "PRB-", label: "Charlie" }),
  summary({ id: "PRB-0001", type: "PRB-", label: "Alpha" }),
  summary({ id: "EVD-000001", type: "EVD-", label: "Evidence one" }),
  summary({ id: "PRB-0002", type: "PRB-", label: "Bravo" }),
];

function baseInput(overrides: Partial<Parameters<typeof computeRecordsView>[0]> = {}) {
  return {
    records: FIXTURE,
    query: "",
    typeFilter: ALL_TYPES,
    sorting: [],
    pagination: { pageIndex: 0, pageSize: 25 },
    ...overrides,
  };
}

describe("computeRecordsView", () => {
  it("returns all records with no filter/query", () => {
    const result = computeRecordsView(baseInput());
    expect(result.filteredCount).toBe(4);
    expect(result.rows).toHaveLength(4);
  });

  it("sorts stably by a given column via TanStack's real sorting engine", () => {
    const result = computeRecordsView(baseInput({ sorting: [{ id: "id", desc: false }] }));
    expect(result.rows.map((r) => r.id)).toEqual(["EVD-000001", "PRB-0001", "PRB-0002", "PRB-0003"]);
  });

  it("paginates with a stable page size", () => {
    const result = computeRecordsView(baseInput({ pagination: { pageIndex: 0, pageSize: 2 } }));
    expect(result.rows).toHaveLength(2);
    expect(result.pageCount).toBe(2);
  });

  it("returns the second page correctly", () => {
    const result = computeRecordsView(
      baseInput({ sorting: [{ id: "id", desc: false }], pagination: { pageIndex: 1, pageSize: 2 } })
    );
    expect(result.rows.map((r) => r.id)).toEqual(["PRB-0002", "PRB-0003"]);
  });
});

describe("paginationItems", () => {
  /** One-based page labels with "…" for gaps, as the wide pagination renders them. */
  function labels(pageIndex: number, pageCount: number): string {
    return paginationItems(pageIndex, pageCount)
      .map((item) => (item.kind === "gap" ? "…" : String(item.pageIndex + 1)))
      .join(" ");
  }

  it("shows the first three pages, a gap and the last page from the start", () => {
    expect(labels(0, 5)).toBe("1 2 3 … 5");
    expect(labels(1, 5)).toBe("1 2 3 … 5");
  });

  it("shows the current page with its neighbours between gaps in the middle", () => {
    expect(labels(2, 5)).toBe("1 2 3 4 5");
    expect(labels(4, 9)).toBe("1 … 4 5 6 … 9");
  });

  it("mirrors the start at the end", () => {
    expect(labels(4, 5)).toBe("1 … 3 4 5");
    expect(labels(3, 5)).toBe("1 … 3 4 5");
  });

  it("lists every page when there are few", () => {
    expect(labels(0, 1)).toBe("1");
    expect(labels(0, 2)).toBe("1 2");
    expect(labels(1, 3)).toBe("1 2 3");
  });

  it("returns nothing for zero pages and clamps an out-of-range index", () => {
    expect(paginationItems(0, 0)).toEqual([]);
    expect(labels(9, 3)).toBe("1 2 3");
  });
});
