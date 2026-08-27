import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RecordDetailPanel } from "./RecordDetailPanel";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

const index: RecordSummary[] = [
  { id: "EVD-1", type: "EVD-", label: "Evidência", file: "", summaryFields: {} },
  { id: "SRC-1", type: "SRC-", label: "Fonte", file: "", summaryFields: {} },
  { id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} },
];
const evd: RecordDetail = {
  id: "EVD-1", type: "EVD-", file: "", outgoingEdges: [{ field: "provenance.sources", ordinal: 0, to: "SRC-1" }],
  incomingEdges: [{ field: "evidence", ordinal: 0, from: "PRB-1" }],
  record: {
    observation: { summary: "Observação delimitada." },
    scope: { geography: { level: "municipality", area: "Évora" }, populations: ["pessoas residentes"], temporal: { as_of: "2026" } },
    provenance: { sources: ["SRC-1"] },
    inference_limits: ["Sem inferência adicional."],
  },
};
const records: Record<string, RecordDetail> = {
  "EVD-1": evd,
  "SRC-1": { id: "SRC-1", type: "SRC-", file: "", record: { name: "Fonte" }, outgoingEdges: [], incomingEdges: [] },
  "PRB-1": { id: "PRB-1", type: "PRB-", file: "", record: { title: "Problema" }, outgoingEdges: [], incomingEdges: [] },
};
const provider: DataProvider = { getManifest: async () => { throw Error("unused"); }, listRecords: async () => index, getEdges: async () => [], getRecord: async (id) => records[id] };
const lookup = new Map(index.map((item) => [item.id, item]));
const renderDetail = (detail = evd, onSelect = vi.fn(), onViewAsProblem = vi.fn()) => {
  const fixture: DataProvider = { ...provider, getRecord: async (id) => id === "EVD-1" ? detail : records[id] };
  render(<RecordDetailPanel dataProvider={fixture} lookup={lookup} selectedId="EVD-1" onBackToRecords={vi.fn()} onSelect={onSelect} onViewAsProblem={onViewAsProblem} onViewInGraph={vi.fn()} />);
  return { onSelect, onViewAsProblem };
};

describe("RecordDetailPanel vNext", () => {
  it("renders bounded observation, scope, inference limits and provenance", async () => {
    renderDetail();
    expect((await screen.findAllByText("Observação delimitada.")).length).toBeGreaterThan(0);
    expect(screen.getByText("Évora")).toBeTruthy();
    expect(screen.getByText("pessoas residentes")).toBeTruthy();
    expect(screen.getByText("Sem inferência adicional.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /SRC-1/ })).toBeTruthy();
  });

  it("navigates to the resolved Source and incoming Problem relationship", async () => {
    const { onSelect, onViewAsProblem } = renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /SRC-1/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ver como Problema \(PRB-1\)/ }));
    expect(onSelect).toHaveBeenCalledWith("SRC-1");
    expect(onViewAsProblem).toHaveBeenCalledWith("PRB-1");
  });

  it("omits absent optional vNext fields without fabricating a value", async () => {
    const sparse: RecordDetail = { ...evd, record: { observation: { summary: "Só observação." }, provenance: { sources: ["SRC-1"] } } };
    renderDetail(sparse);
    expect((await screen.findAllByText("Só observação.")).length).toBeGreaterThan(0);
    expect(screen.queryByText("pessoas residentes")).toBeNull();
    expect(screen.queryByText("Sem inferência adicional.")).toBeNull();
  });
});
