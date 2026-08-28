import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RecordDetailPanel } from "./RecordDetailPanel";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

const index: RecordSummary[] = [
  { id: "EVD-1", type: "EVD-", label: "Evidência", file: "", summaryFields: {} },
  { id: "SRC-1", type: "SRC-", label: "Fonte", file: "", summaryFields: {} },
  { id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} },
  { id: "PRB-2", type: "PRB-", label: "Problema relacionado", file: "", summaryFields: {} },
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
  "PRB-1": { id: "PRB-1", type: "PRB-", file: "", record: { title: "Problema", evidence: [{ evidence_id: "EVD-1", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] }] }, outgoingEdges: [], incomingEdges: [] },
  "PRB-2": { id: "PRB-2", type: "PRB-", file: "", record: { title: "Problema relacionado" }, outgoingEdges: [], incomingEdges: [] },
};
const provider: DataProvider = { getManifest: async () => { throw Error("unused"); }, listRecords: async () => index, getEdges: async () => [], getRecord: async (id) => records[id] };
const lookup = new Map(index.map((item) => [item.id, item]));
const renderDetail = (detail = evd, onSelect = vi.fn(), onViewAsProblem = vi.fn(), selectedId = "EVD-1") => {
  const fixture: DataProvider = { ...provider, getRecord: async (id) => id === selectedId ? detail : records[id] };
  render(<RecordDetailPanel dataProvider={fixture} lookup={lookup} selectedId={selectedId} onBackToRecords={vi.fn()} onSelect={onSelect} onViewAsProblem={onViewAsProblem} onViewHistory={vi.fn()} onViewInGraph={vi.fn()} />);
  return { onSelect, onViewAsProblem };
};

describe("RecordDetailPanel vNext", () => {
  it("uses the approved neutral EVD description in the desktop rail", async () => {
    renderDetail();
    expect(await screen.findByText("Evidência é um registo com proveniência e limites explícitos.")).toBeTruthy();
  });

  it("renders bounded observation, scope, inference limits and provenance", async () => {
    renderDetail();
    expect((await screen.findAllByText("Observação delimitada.")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Évora").length).toBeGreaterThan(0);
    expect(screen.getAllByText("pessoas residentes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sem inferência adicional.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Fonte" })).toBeTruthy();
  });

  it("navigates to the resolved Source and incoming Problem relationship", async () => {
    const { onSelect } = renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Fonte" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver Problema →" }));
    expect(onSelect).toHaveBeenCalledWith("SRC-1");
    expect(onSelect).toHaveBeenCalledWith("PRB-1");
  });

  it("omits absent optional vNext fields without fabricating a value", async () => {
    const sparse: RecordDetail = { ...evd, record: { observation: { summary: "Só observação." }, provenance: { sources: ["SRC-1"] } } };
    renderDetail(sparse);
    expect((await screen.findAllByText("Só observação.")).length).toBeGreaterThan(0);
    expect(screen.queryByText("pessoas residentes")).toBeNull();
    expect(screen.queryByText("Sem inferência adicional.")).toBeNull();
  });

  it("omits the PRB corpus-relations section when no incoming records exist", async () => {
    renderDetail(records["PRB-1"], vi.fn(), vi.fn(), "PRB-1");
    await screen.findByText("Estrutura técnica completa");
    expect(screen.queryByText("Relações no corpus")).toBeNull();
    expect(screen.queryByText("← Referenciado por")).toBeNull();
  });

  it("renders deduplicated incoming PRB relations and preserves their navigation target", async () => {
    const prbWithDuplicateIncomingPaths: RecordDetail = {
      ...records["PRB-1"],
      incomingEdges: [
        { field: "decision_basis.overlap_check.related_problems", ordinal: 0, from: "PRB-2" },
        { field: "decision_basis.overlap_check.related_problems", ordinal: 1, from: "PRB-2" },
      ],
    };
    const onSelect = vi.fn();
    renderDetail(prbWithDuplicateIncomingPaths, onSelect, vi.fn(), "PRB-1");

    expect(await screen.findByText("Relações no corpus")).toBeTruthy();
    expect(screen.getByText("← Referenciado por")).toBeTruthy();
    const relatedButton = screen.getByRole("button", { name: /PRB-2.*Problema relacionado/ });
    fireEvent.click(relatedButton);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("PRB-2");
  });
});
