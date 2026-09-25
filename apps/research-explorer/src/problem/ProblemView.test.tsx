import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  // F07: a second, minimal PRB fixture — used only to exercise ordinary
  // in-app PRB->PRB navigation on an already-mounted ProblemView (see the
  // "does not repeatedly reapply" test below); never mixed into the
  // vNext/AR-05/etc. suites above, which are all scoped to PRB-1.
  "PRB-2": { id: "PRB-2", type: "PRB-", file: "", outgoingEdges: [], incomingEdges: [], record: { title: "Segundo problema" } },
  // F16: a third minimal PRB fixture — used only by the A->B->C rapid-chain
  // transition regression below.
  "PRB-3": { id: "PRB-3", type: "PRB-", file: "", outgoingEdges: [], incomingEdges: [], record: { title: "Terceiro problema" } },
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

  it("renders the two-view Detalhes|Histórico PRB navigation with Detalhes as the current page", async () => {
    const onViewHistory = vi.fn();
    render(<ProblemView {...props} problemId="PRB-1" onViewHistory={onViewHistory} />);
    const nav = await screen.findByRole("navigation", { name: "Vistas do problema" });
    expect(nav.textContent).toBe("DetalhesHistórico");
    expect(within(nav).getByText("Detalhes").getAttribute("aria-current")).toBe("page");
    fireEvent.click(within(nav).getByRole("button", { name: "Histórico" }));
    expect(onViewHistory).toHaveBeenCalledWith("PRB-1");
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

describe("ProblemView AR-05 CR-1 — research_roles[] rendering per evidence card", () => {
  it("renders each evidence relationship's research_roles alongside its effects, matching the fixture exactly", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    const support = await screen.findByText("Evidência que suporta (1)");
    const boundary = screen.getByText("Evidência que limita a conclusão (1)");
    const other = screen.getByText("Outra evidência relacionada (1)");

    const supportCard = within(support.parentElement!).getByRole("button", { name: /EVD-1/ }).closest("li")!;
    const boundaryCard = within(boundary.parentElement!).getByRole("button", { name: /EVD-2/ }).closest("li")!;
    const otherCard = within(other.parentElement!).getByRole("button", { name: /EVD-3/ }).closest("li")!;

    expect(within(supportCard).getByText("Observação local").closest(".research-role-tag")).toBeTruthy();
    expect(within(boundaryCard).getByText("Contexto").closest(".research-role-tag")).toBeTruthy();
    expect(within(otherCard).getByText("Mecanismo comparativo").closest(".research-role-tag")).toBeTruthy();

    expect(within(supportCard).getByLabelText("Efeito canónico no Problema")).toBeTruthy();
    expect(within(boundaryCard).getByLabelText("Efeito canónico no Problema")).toBeTruthy();
    expect(within(otherCard).getByLabelText("Efeito canónico no Problema")).toBeTruthy();
  });

  it("does not render a research-role tag when a relationship carries no research_roles", async () => {
    const noRoleRecords: Record<string, RecordDetail> = {
      ...records,
      "PRB-1": {
        ...records["PRB-1"],
        record: { ...prbRecord, evidence: [{ evidence_id: "EVD-1", effects: ["SUPPORTS"] }] },
      },
    };
    const noRoleProvider: DataProvider = { ...provider, getRecord: async (id) => noRoleRecords[id] };
    render(<ProblemView {...props} dataProvider={noRoleProvider} problemId="PRB-1" />);
    await screen.findAllByText("efeito não registado.");
    expect(screen.queryByLabelText("Papel desta evidência na investigação do Problema")).toBeNull();
  });

  it("continues to render effects and EffectOccurrenceSummary unchanged alongside the new research-role rendering", async () => {
    render(<ProblemView {...props} problemId="PRB-1" />);
    await screen.findByText("Evidência que suporta (1)");
    expect(screen.getByText(/papéis indicados não representam/)).toBeTruthy();
    expect(screen.getAllByLabelText("Efeito canónico no Problema")).toHaveLength(3);
    expect(screen.getAllByLabelText("Papel desta evidência na investigação do Problema")).toHaveLength(3);
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
    railLinks.forEach((link) => expect(document.querySelector(link.getAttribute("href")!)).toBeTruthy());
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

describe("ProblemView citizen-facing metadata and actions", () => {
  const recordsWithMetadata: Record<string, RecordDetail> = {
    ...records,
    "PRB-1": { ...records["PRB-1"], record: { ...prbRecord, domain: ["MOB", "ACC"], geography: { area: "Évora", level: "city" }, affected_populations: ["Residentes", "Visitantes"], updated_at: "2026-09-01", history: [{ date: "2026-02-01", summary: "Alteração antiga." }, { date: "2026-04-01", summary: "Alteração recente." }] } },
  };
  const metadataProvider: DataProvider = { ...provider, getRecord: async (id) => recordsWithMetadata[id] };

  it("binds the public update date to PRB.updated_at and omits it neutrally when absent", async () => {
    render(<ProblemView {...props} dataProvider={metadataProvider} problemId="PRB-1" />);
    expect(await screen.findByText("Última atualização do registo")).toBeTruthy();
    expect(document.querySelector('time[datetime="2026-09-01"]')).toBeTruthy();
    const missingDateProvider: DataProvider = { ...provider, getRecord: async (id) => ({ ...recordsWithMetadata[id], record: { ...recordsWithMetadata[id].record, updated_at: undefined } }) };
    const second = render(<ProblemView {...props} dataProvider={missingDateProvider} problemId="PRB-1" />);
    await screen.findByText("Alteração recente.");
    expect(screen.getAllByText("Última atualização do registo")).toHaveLength(1);
    second.unmount();
  });

  it("uses only authored PRB.history for the recent summary and opens the full History view", async () => {
    const onViewHistory = vi.fn();
    render(<ProblemView {...props} dataProvider={metadataProvider} problemId="PRB-1" onViewHistory={onViewHistory} />);
    const recent = await screen.findByText("Alteração recente.");
    const older = screen.getByText("Alteração antiga.");
    expect(recent.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Ver histórico completo/ })[0]);
    expect(onViewHistory).toHaveBeenCalledWith("PRB-1");
  });

  it("uses Web Share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<ProblemView {...props} problemId="PRB-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Partilhar" }));
    await vi.waitFor(() => expect(share).toHaveBeenCalled());
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });

  it("copies the current link when Web Share is unavailable", async () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ProblemView {...props} problemId="PRB-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Partilhar" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
    expect(await screen.findByText("Ligação copiada.")).toBeTruthy();
  });
});

/**
 * F07: a direct PRB deep link that also carries a URL fragment (e.g.
 * `?view=problem&id=PRB-0005#problem-evidencia`) must have that requested
 * section receive the initial scroll/focus once it exists — the generic
 * "focus the Problem heading on first ready content" behaviour
 * (ProblemContent's own effect, above) must be the fallback only, never
 * override a fragment that was actually applied. Reuses the shared
 * `applyInitialFragment` (navigation/applyInitialFragment.ts) — the same
 * helper Generic Record Detail already uses — rather than a second
 * fragment-lookup implementation; see that module's own tests for the
 * lower-level scroll/tabindex/decode-failure contract this builds on.
 */
describe("ProblemView — initial-fragment focus vs. heading fallback (F07)", () => {
  beforeEach(() => {
    // jsdom does not implement scrollIntoView (see applyInitialFragment's own
    // test file, which stubs it the same way for the same reason).
    Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("applies a valid initial fragment target instead of focusing the heading", async () => {
    window.location.hash = "#problem-evidencia";
    render(<ProblemView {...props} problemId="PRB-1" />);

    const evidenceSection = await screen.findByLabelText("Evidência");
    await vi.waitFor(() => expect(document.activeElement).toBe(evidenceSection));

    const heading = screen.getByRole("heading", { name: /Problema de teste/ });
    expect(document.activeElement).not.toBe(heading);
  });

  it("falls back to focusing the heading when the URL carries no fragment", async () => {
    window.location.hash = "";
    render(<ProblemView {...props} problemId="PRB-1" />);

    const heading = await screen.findByRole("heading", { name: /Problema de teste/ });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("falls back to focusing the heading when the fragment target does not exist on this PRB", async () => {
    window.location.hash = "#does-not-exist-on-this-prb";
    render(<ProblemView {...props} problemId="PRB-1" />);

    const heading = await screen.findByRole("heading", { name: /Problema de teste/ });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("fails safely on a malformed hash and still falls back to the heading, without throwing", async () => {
    window.location.hash = "#%E0%A4%A";

    expect(() => render(<ProblemView {...props} problemId="PRB-1" />)).not.toThrow();
    const heading = await screen.findByRole("heading", { name: /Problema de teste/ });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("does not repeatedly reapply the initial fragment or hijack focus on later in-app PRB navigation", async () => {
    window.location.hash = "#problem-evidencia";
    const { rerender } = render(<ProblemView {...props} problemId="PRB-1" />);

    const evidenceSection = await screen.findByLabelText("Evidência");
    await vi.waitFor(() => expect(document.activeElement).toBe(evidenceSection));
    const scrollIntoView = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // The hash is still present in the URL (ordinary in-app navigation never
    // clears it here — that is F08's concern), but a subsequent PRB selection
    // on the same mounted ProblemView instance must never re-read it and
    // re-scroll back to the original fragment target — the initial-fragment
    // application is a one-time, first-ready-transition behaviour.
    rerender(<ProblemView {...props} problemId="PRB-2" />);
    await screen.findByRole("heading", { name: "Segundo problema" });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

/**
 * F16: rapid/in-place PRB->PRB navigation (a new `problemId` arriving before
 * the previous PRB's projection load has settled) must never let the
 * previous PRB's `ready` projection be presented as though it belongs to the
 * newly requested PRB, and must never skip focusing the newly loaded PRB's
 * own heading once it becomes ready. Uses a controllable `getRecord` so each
 * PRB's load can be resolved independently and out of request order,
 * reproducing the race directly rather than only asserting the final static
 * state.
 */
describe("ProblemView — PRB transition identity/focus integrity (F16)", () => {
  // Only PRB-* lookups (the projection's own root fetch) are held back —
  // their linked EVD/SRC lookups resolve immediately — so each test controls
  // exactly the race under test (when a PRB's own projection settles)
  // without needing to separately track and resolve every downstream fetch.
  function deferredProvider() {
    const pending = new Map<string, { resolve: (detail: RecordDetail) => void; reject: (error: unknown) => void }>();
    const dataProvider: DataProvider = {
      getManifest: async () => { throw Error("unused"); },
      listRecords: async () => index,
      getEdges: async () => [],
      getRecord: (id) =>
        id.startsWith("PRB-")
          ? new Promise<RecordDetail>((resolve, reject) => {
              pending.set(id, { resolve, reject });
            })
          : Promise.resolve(records[id]),
    };
    return {
      dataProvider,
      resolve(id: string) {
        pending.get(id)?.resolve(records[id]);
        pending.delete(id);
      },
      reject(id: string, error: unknown) {
        pending.get(id)?.reject(error);
        pending.delete(id);
      },
    };
  }

  it("does not present the previous PRB's ready content as the newly requested PRB's state, and focuses the new PRB once ready", async () => {
    const { dataProvider, resolve } = deferredProvider();
    const { rerender } = render(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-1" />);
    await screen.findByText("A carregar Problema PRB-1…");

    resolve("PRB-1");
    await screen.findByRole("heading", { name: /Problema de teste/ });

    // Navigate to PRB-2 before its own load settles.
    rerender(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-2" />);
    await screen.findByText("A carregar Problema PRB-2…");

    // PRB-1's heading/content must not still be presented as PRB-2's ready state.
    expect(screen.queryByRole("heading", { name: /Problema de teste/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Segundo problema" })).toBeNull();

    resolve("PRB-2");
    const heading = await screen.findByRole("heading", { name: "Segundo problema" });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("does not let a cancelled previous PRB's late completion replace the new PRB or steal its focus", async () => {
    const { dataProvider, resolve } = deferredProvider();
    const { rerender } = render(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-1" />);
    await screen.findByText("A carregar Problema PRB-1…");

    rerender(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-2" />);
    await screen.findByText("A carregar Problema PRB-2…");
    resolve("PRB-2");
    const heading = await screen.findByRole("heading", { name: "Segundo problema" });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));

    // The stale PRB-1 request finally resolves after PRB-2 is already ready
    // and focused — it must not overwrite the rendered PRB or steal focus.
    resolve("PRB-1");
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("heading", { name: "Segundo problema" })).toBeTruthy();
    expect(document.activeElement).toBe(heading);
  });

  it("resolves a rapid A -> B -> C chain on C, with B unable to win late", async () => {
    const { dataProvider, resolve } = deferredProvider();
    const { rerender } = render(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-1" />);
    await screen.findByText("A carregar Problema PRB-1…");
    rerender(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-2" />);
    await screen.findByText("A carregar Problema PRB-2…");
    rerender(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-3" />);
    await screen.findByText("A carregar Problema PRB-3…");

    resolve("PRB-3");
    const heading = await screen.findByRole("heading", { name: "Terceiro problema" });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));

    // B (and A) resolving late must not win over the already-rendered C.
    resolve("PRB-2");
    resolve("PRB-1");
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("heading", { name: "Terceiro problema" })).toBeTruthy();
    expect(document.activeElement).toBe(heading);
  });

  it("keeps an error associated with the ID whose load failed, and retry correct, across a PRB transition", async () => {
    const { dataProvider, resolve, reject } = deferredProvider();
    const { rerender } = render(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-1" />);
    await screen.findByText("A carregar Problema PRB-1…");

    rerender(<ProblemView {...props} dataProvider={dataProvider} problemId="PRB-2" />);
    await screen.findByText("A carregar Problema PRB-2…");
    reject("PRB-2", new Error("network failure"));
    await screen.findByText("Falha ao carregar o Problema");

    // The earlier PRB-1 request resolving after the error must not clear it
    // or replace PRB-2's error state.
    resolve("PRB-1");
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("Falha ao carregar o Problema")).toBeTruthy();
  });

  it("still applies a direct-load fragment target over heading focus (H2/F07 unaffected)", async () => {
    Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
    window.location.hash = "#problem-evidencia";
    try {
      render(<ProblemView {...props} problemId="PRB-1" />);
      const evidenceSection = await screen.findByLabelText("Evidência");
      await vi.waitFor(() => expect(document.activeElement).toBe(evidenceSection));
      expect(screen.queryByRole("heading", { name: /Problema de teste/ })).not.toBe(document.activeElement);
    } finally {
      window.location.hash = "";
    }
  });

  it("focuses the newly selected PRB's heading on ordinary navigation without a hash (H2/F07 unaffected)", async () => {
    const { rerender } = render(<ProblemView {...props} problemId="PRB-1" />);
    await screen.findByRole("heading", { name: /Problema de teste/ });

    rerender(<ProblemView {...props} problemId="PRB-2" />);
    const heading = await screen.findByRole("heading", { name: "Segundo problema" });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
  });
});
