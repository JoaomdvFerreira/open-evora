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
    independence_assessment: "Avaliação de independência documentada.",
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

  it("orders the Evidência section as EffectOccurrenceSummary, then evidence groups, then independence assessment", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    const support = await screen.findByText("Evidência que suporta (1)");
    const section = support.closest("section")!;

    const effectSummaryLabel = within(section).getByText(/papéis indicados não representam/);
    const evidenceGroupHeading = within(section).getByText("Evidência que suporta (1)");
    const independenceHeading = within(section).getByText("Independência da evidência");
    const independenceText = within(section).getByText("Avaliação de independência documentada.");

    const position = (node: Element) => node.compareDocumentPosition(effectSummaryLabel);
    expect(position(evidenceGroupHeading) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(evidenceGroupHeading.compareDocumentPosition(independenceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(independenceHeading.compareDocumentPosition(independenceText) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the empty-evidence EmptyState in place of evidence groups ahead of any independence assessment", async () => {
    const sparseRecords: Record<string, RecordDetail> = { ...records, "PRB-1": { ...records["PRB-1"], record: { title: "Sem opcionais", evidence: [] }, outgoingEdges: [] } };
    const sparseProvider: DataProvider = { ...provider, getRecord: async (id) => sparseRecords[id] };
    render(<ProblemView {...props} dataProvider={sparseProvider} problemId="PRB-1" />);
    const message = await screen.findByText("Nenhuma evidência associada.");
    expect(message.className).toBe("ui-empty-state-message");
    expect(screen.queryByText("Independência da evidência")).toBeNull();
  });

  it("orders EmptyState before independence_assessment when evidence is empty but the assessment is authored", async () => {
    const emptyEvidenceWithAssessmentRecords: Record<string, RecordDetail> = {
      ...records,
      "PRB-1": {
        ...records["PRB-1"],
        record: {
          title: "Sem evidência, com avaliação de independência",
          evidence: [],
          decision_basis: { independence_assessment: "Avaliação de independência documentada." },
        },
        outgoingEdges: [],
      },
    };
    const emptyEvidenceProvider: DataProvider = { ...provider, getRecord: async (id) => emptyEvidenceWithAssessmentRecords[id] };
    render(<ProblemView {...props} dataProvider={emptyEvidenceProvider} problemId="PRB-1" />);

    const message = await screen.findByText("Nenhuma evidência associada.");
    const independenceHeading = screen.getByText("Independência da evidência");

    expect(message.className).toBe("ui-empty-state-message");
    expect(independenceHeading.tagName).toBe("H4");
    expect(message.compareDocumentPosition(independenceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("ProblemView AR-04 CR-2 — open-question internal detail labels", () => {
  const fullOpenQuestionRecords: Record<string, RecordDetail> = {
    ...records,
    "PRB-1": {
      ...records["PRB-1"],
      record: {
        ...prbRecord,
        investigation: {
          ...prbRecord.investigation,
          open_questions: [
            {
              question: "Questão em aberto.",
              why_open: "Ainda não resolvida.",
              current_action: "Ação em curso registada.",
              latest_result: "Resultado mais recente registado.",
              resolution_condition: "Condição de resolução registada.",
              evidence: ["EVD-1"],
            },
          ],
        },
      },
    },
  };
  const fullOpenQuestionProvider: DataProvider = { ...provider, getRecord: async (id) => fullOpenQuestionRecords[id] };

  it("marks all four open-question internal detail labels with open-question-detail-label, unchanged text and heading level", async () => {
    render(<ProblemView {...props} dataProvider={fullOpenQuestionProvider} problemId="PRB-1" />);

    const expectedLabels = [
      "Porque continua em aberto",
      "O que estamos a fazer",
      "O que aprendemos mais recentemente",
      "O que permitiria esclarecer",
    ];

    for (const text of expectedLabels) {
      const label = await screen.findByText(text);
      expect(label.tagName).toBe("H4");
      expect(label.className).toBe("open-question-detail-label");
    }
  });

  it("does not apply open-question-detail-label to the primary open question", async () => {
    render(<ProblemView {...props} dataProvider={fullOpenQuestionProvider} problemId="PRB-1" />);
    const question = await screen.findByText("Questão em aberto.");
    expect(question.className).toBe("open-question-question");
  });

  it("does not apply open-question-detail-label to Estado atual's h4 labels", async () => {
    render(<ProblemView {...props} dataProvider={fullOpenQuestionProvider} problemId="PRB-1" />);
    await screen.findByText("Manifestação documentada.");
    const manifestationLabel = screen.getAllByText("O que observamos").find((node) => node.tagName === "H4")!;
    expect(manifestationLabel).toBeTruthy();
    expect(manifestationLabel.className).toBe("");
  });
});

describe("ProblemView DS-05I — EmptyState adoption", () => {
  it("renders EmptyState with the exact copy when the resolved Evidence collection is zero", async () => {
    const sparseRecords: Record<string, RecordDetail> = { ...records, "PRB-1": { ...records["PRB-1"], record: { title: "Sem opcionais", evidence: [] }, outgoingEdges: [] } };
    const sparseProvider: DataProvider = { ...provider, getRecord: async (id) => sparseRecords[id] };
    render(<ProblemView {...props} dataProvider={sparseProvider} problemId="PRB-1" />);
    const message = await screen.findByText("Nenhuma evidência associada.");
    expect(message.className).toBe("ui-empty-state-message");
  });

  it("keeps a missing PRB→EVD effect as field-empty, not EmptyState", async () => {
    const noEffectRecords: Record<string, RecordDetail> = {
      ...records,
      "PRB-1": {
        ...records["PRB-1"],
        record: { ...prbRecord, evidence: [{ evidence_id: "EVD-1", research_roles: ["LOCAL_OBSERVATION"] }] },
      },
    };
    const noEffectProvider: DataProvider = { ...provider, getRecord: async (id) => noEffectRecords[id] };
    render(<ProblemView {...props} dataProvider={noEffectProvider} problemId="PRB-1" />);
    const missing = await screen.findAllByText("efeito não registado.");
    expect(missing.length).toBeGreaterThan(0);
    missing.forEach((node) => expect(node.className).toBe("field-empty"));
  });
});

describe("ProblemView DS-05H — RailSectionIndex/CompactSectionIndex adoption", () => {
  it("rail and compact 'Nesta página' indexes expose identical ordered entries/hrefs", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    await screen.findByText("Manifestação documentada.");

    const railNav = screen.getAllByRole("navigation", { name: "Nesta página" });
    expect(railNav).toHaveLength(1);
    const compactNav = screen.getByRole("navigation", { name: "Nesta página (versão compacta)" });

    const railLinks = Array.from(railNav[0].querySelectorAll("a"));
    const compactLinks = Array.from(compactNav.querySelectorAll("a"));
    expect(railLinks.map((link) => link.textContent)).toEqual(compactLinks.map((link) => link.textContent));
    expect(railLinks.map((link) => link.getAttribute("href"))).toEqual(compactLinks.map((link) => link.getAttribute("href")));
    expect(railLinks.length).toBeGreaterThan(0);
  });

  it("conditional subsections are present in the index exactly matching rendered content", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    await screen.findByText("Manifestação documentada.");
    const compactNav = screen.getByRole("navigation", { name: "Nesta página (versão compacta)" });
    expect(within(compactNav).getByRole("link", { name: "O que observamos" })).toBeTruthy();
    expect(within(compactNav).getByRole("link", { name: "Sinal inicial" })).toBeTruthy();
  });

  it("omits an absent conditional subsection from both rail and compact when its content is absent", async () => {
    const sparseRecords: Record<string, RecordDetail> = {
      ...records,
      "PRB-1": { ...records["PRB-1"], record: { title: "Sem opcionais", evidence: [] }, outgoingEdges: [] },
    };
    const sparseProvider: DataProvider = { ...provider, getRecord: async (id) => sparseRecords[id] };
    render(<ProblemView {...props} dataProvider={sparseProvider} problemId="PRB-1" />);
    await screen.findByText("Nenhuma evidência associada.");
    expect(screen.queryByRole("link", { name: "O que observamos" })).toBeNull();
  });

  it("ProblemHelpDisclosure no longer owns section-index navigation", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    await screen.findByText("Manifestação documentada.");
    const disclosureSummary = screen.getByText("O que é um Problema, e o que significam os estados abaixo?");
    const disclosure = disclosureSummary.closest("details")!;
    expect(within(disclosure).queryByRole("navigation")).toBeNull();
  });

  it("the compact 'Nesta página' index is independently discoverable without opening the explanatory help disclosure", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    await screen.findByText("Manifestação documentada.");
    const disclosureSummary = screen.getByText("O que é um Problema, e o que significam os estados abaixo?");
    const helpDisclosure = disclosureSummary.closest("details")!;
    expect(helpDisclosure.hasAttribute("open")).toBe(false);

    const compactNav = screen.getByRole("navigation", { name: "Nesta página (versão compacta)" });
    const compactDisclosure = compactNav.closest("details")!;
    expect(compactDisclosure).not.toBe(helpDisclosure);
  });
});
