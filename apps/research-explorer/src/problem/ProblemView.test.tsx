import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ProblemView } from "./ProblemView";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

const index: RecordSummary[] = [
  { id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} },
  ...["1", "2", "3"].map((id) => ({ id: `EVD-${id}`, type: "EVD-" as const, label: `Evidência ${id}`, file: "", summaryFields: {} })),
  ...["1", "2", "3"].map((id) => ({ id: `SRC-${id}`, type: "SRC-" as const, label: `Fonte ${id}`, file: "", summaryFields: {} })),
];
const prbRecord = {
  title: "Problema de teste",
  problem_statement: "Formulação delimitada.",
  evidence: [
    { evidence_id: "EVD-1", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] },
    { evidence_id: "EVD-2", effects: ["BOUNDS"], research_roles: ["CONTEXTUAL"] },
    { evidence_id: "EVD-3", effects: ["REFINES"], research_roles: ["COMPARATIVE_MECHANISM"] },
  ],
  decision_basis: {
    manifestation: { summary: "Manifestação documentada.", evidence: ["EVD-1"] },
    consequence: { summary: "Consequência documentada.", evidence: ["EVD-1"] },
    currentness: { assessment: "Atualidade explicitamente registada.", evidence: ["EVD-1"] },
    scope: { geography: "Évora", population: "Residentes", temporal: "2026", bounded: true },
    supporting_evidence: ["EVD-1"],
    boundary_evidence: ["EVD-2"],
    contradiction_search: { performed: true, summary: "Procura contraditória concluída.", evidence: ["EVD-3"] },
  },
  investigation: {
    open_questions: [{ question: "Questão em aberto.", why_open: "Ainda não resolvida.", evidence: ["EVD-1"] }],
    path: { initial_signal: { summary: "Sinal inicial registado.", evidence: ["EVD-2"] } },
  },
};
const records: Record<string, RecordDetail> = {
  "PRB-1": { id: "PRB-1", type: "PRB-", file: "", outgoingEdges: ["1", "2", "3"].map((id, ordinal) => ({ field: "evidence", ordinal, to: `EVD-${id}` })), incomingEdges: [], record: prbRecord },
  ...Object.fromEntries(["1", "2", "3"].map((id) => [`EVD-${id}`, {
    id: `EVD-${id}`, type: "EVD-", file: "", incomingEdges: [], outgoingEdges: [{ field: "provenance.sources", ordinal: 0, to: `SRC-${id}` }],
    record: { observation: { summary: `Observação ${id}.` }, provenance: { sources: [`SRC-${id}`] } },
  }])),
  ...Object.fromEntries(["1", "2", "3"].map((id) => [`SRC-${id}`, { id: `SRC-${id}`, type: "SRC-", file: "", record: { name: `Fonte ${id}` }, outgoingEdges: [], incomingEdges: [] }])),
};
const provider: DataProvider = { getManifest: async () => { throw Error("unused"); }, listRecords: async () => index, getEdges: async () => [], getRecord: async (id) => records[id] };
const props = { dataProvider: provider, onOpenGeneric: vi.fn(), onBackToRecords: vi.fn(), onBackToOverview: vi.fn(), onViewHistory: vi.fn() };

describe("ProblemView vNext", () => {
  it("keeps empty selection explicit and redirects non-PRB selections", async () => {
    const { unmount } = render(<ProblemView {...props} problemId={null} />);
    expect(await screen.findByText("Nenhum Problema selecionado.")).toBeTruthy();
    unmount();
    const onOpenGeneric = vi.fn();
    render(<ProblemView {...props} problemId="EVD-1" onOpenGeneric={onOpenGeneric} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe genérico" }));
    expect(onOpenGeneric).toHaveBeenCalledWith("EVD-1");
  });

  it("groups each linked EVD once as supporting, boundary, or other", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    const support = await screen.findByText("Evidência que suporta (1)");
    const boundary = screen.getByText("Evidência que limita a conclusão (1)");
    const other = screen.getByText("Outra evidência relacionada (1)");
    expect(within(support.parentElement!).getByRole("button", { name: /EVD-1/ })).toBeTruthy();
    expect(within(boundary.parentElement!).getByRole("button", { name: /EVD-2/ })).toBeTruthy();
    expect(within(other.parentElement!).getByRole("button", { name: /EVD-3/ })).toBeTruthy();
    expect(within(support.parentElement!).queryByRole("button", { name: /EVD-[23]/ })).toBeNull();
    expect(within(boundary.parentElement!).queryByRole("button", { name: /EVD-[13]/ })).toBeNull();
    expect(within(other.parentElement!).queryByRole("button", { name: /EVD-[12]/ })).toBeNull();
  });

  it("presents authored current state, scope, questions, path and contradiction search", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    await screen.findByText("Manifestação documentada.");
    for (const value of ["Consequência documentada.", "Atualidade explicitamente registada.", "Évora", "Residentes", "Questão em aberto.", "Sinal inicial registado.", "Procura contraditória concluída."]) {
      expect(screen.getByText(value)).toBeTruthy();
    }
  });

  it("omits absent optional decision and investigation content rather than fabricating it", async () => {
    const sparseRecords: Record<string, RecordDetail> = { ...records, "PRB-1": { ...records["PRB-1"], record: { title: "Sem opcionais", evidence: [] }, outgoingEdges: [] } };
    const sparseProvider: DataProvider = { ...provider, getRecord: async (id) => sparseRecords[id] };
    render(<ProblemView {...props} dataProvider={sparseProvider} problemId="PRB-1" />);
    await screen.findByText("Nenhuma evidência associada.");
    expect(screen.queryByLabelText("Estado atual")).toBeNull();
    expect(screen.queryByLabelText("O que ainda não sabemos — e o que estamos a fazer")).toBeNull();
    expect(screen.queryByLabelText("Como chegámos a este problema")).toBeNull();
  });

  it("navigates through canonical EVD and resolved SRC records", async () => {
    const onOpenGeneric = vi.fn();
    render(<ProblemView {...props} problemId="PRB-1" onOpenGeneric={onOpenGeneric} />);
    fireEvent.click((await screen.findAllByRole("button", { name: /EVD-1/ }))[0]);
    fireEvent.click(screen.getByRole("button", { name: /SRC-1/ }));
    expect(onOpenGeneric).toHaveBeenCalledWith("EVD-1");
    expect(onOpenGeneric).toHaveBeenCalledWith("SRC-1");
  });
});
