import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProblemHistoryView } from "./ProblemHistoryView";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

const summaries: RecordSummary[] = [
  { id: "PRB-0010", type: "PRB-", label: "Pavimento", file: "research/problems/PRB-0010.yaml", summaryFields: {} },
  { id: "PRB-0001", type: "PRB-", label: "Sem histórico", file: "research/problems/PRB-0001.yaml", summaryFields: {} },
  { id: "PRB-0002", type: "PRB-", label: "Com transição", file: "research/problems/PRB-0002.yaml", summaryFields: {} },
  { id: "EVD-000154", type: "EVD-", label: "Levantamento", file: "research/evidence/EVD-000154.yaml", summaryFields: {} },
  { id: "EVD-000155", type: "EVD-", label: "Procedimento", file: "research/evidence/EVD-000155.yaml", summaryFields: {} },
  { id: "EVD-000156", type: "EVD-", label: "Intervenções", file: "research/evidence/EVD-000156.yaml", summaryFields: {} },
];

const details: Record<string, RecordDetail> = {
  "PRB-0010": {
    id: "PRB-0010", type: "PRB-", file: "research/problems/PRB-0010.yaml", incomingEdges: [], outgoingEdges: [],
    record: {
      title: "Degradação do pavimento",
      history: [
        { date: "2026-08-28", summary: "Nova evidência oficial estabeleceu uma cronologia de resposta faseada/em curso — levantamento técnico em fevereiro, prazo de execução contratual de 10 meses e intervenções locais até junho — pelo que a investigação deixa de assumir um estado pós-reparação e passa a perguntar pela condição atual da rede em todo o município durante a implementação.", evidence: ["EVD-000154", "EVD-000155", "EVD-000156"] },
      ],
    },
  },
  "PRB-0001": { id: "PRB-0001", type: "PRB-", file: "research/problems/PRB-0001.yaml", incomingEdges: [], outgoingEdges: [], record: { title: "Sem histórico" } },
  "PRB-0002": { id: "PRB-0002", type: "PRB-", file: "research/problems/PRB-0002.yaml", incomingEdges: [], outgoingEdges: [], record: { title: "Com transição", history: [{ date: "2026-08-27", summary: "Entrada anterior." }, { date: "2026-08-28", summary: "Mudança de estado.", state_changes: { status: { from: "OPEN", to: "NON_DIGITAL" } } }] } },
};

function provider(): DataProvider {
  return {
    getManifest: async () => { throw new Error("unused"); },
    listRecords: async () => summaries,
    getEdges: async () => [],
    getRecord: async (id) => {
      const detail = details[id];
      if (!detail) throw new Error("not found");
      return detail;
    },
  };
}

const props = {
  dataProvider: provider(), onOpenGeneric: vi.fn(), onBackToRecords: vi.fn(), onBackToOverview: vi.fn(), onViewAsProblem: vi.fn(),
};

describe("ProblemHistoryView", () => {
  it("renders the authored PRB-0010 entry and typed evidence navigation", async () => {
    const onOpenGeneric = vi.fn();
    render(<ProblemHistoryView {...props} problemId="PRB-0010" onOpenGeneric={onOpenGeneric} />);

    await screen.findByText(/Nova evidência oficial estabeleceu uma cronologia de resposta faseada/);
    fireEvent.click(screen.getAllByRole("button", { name: "[Evidência] EVD-000154" })[0]);
    expect(onOpenGeneric).toHaveBeenCalledWith("EVD-000154");
  });

  it("renders optional authored state changes", async () => {
    render(<ProblemHistoryView {...props} problemId="PRB-0002" />);
    const latest = await screen.findByText("Mudança de estado.");
    const older = screen.getByText("Entrada anterior.");
    expect(latest.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Estado")).toBeTruthy();
    expect(screen.getByText("Aberto → Não digital")).toBeTruthy();
  });

  it("uses a neutral empty state for a Problem with no authored history", async () => {
    render(<ProblemHistoryView {...props} problemId="PRB-0001" />);
    expect(await screen.findByText("Não existe histórico material registado para este problema.")).toBeTruthy();
  });
});
