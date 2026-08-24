import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProblemView } from "./ProblemView";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

const INDEX: RecordSummary[] = [
  { id: "PRB-0005", type: "PRB-", label: "Parking pressure", file: "research/problems/PRB-0005.yaml", summaryFields: {} },
  { id: "EVD-0001", type: "EVD-", label: "Evidence one", file: "research/evidence/EVD-0001.yaml", summaryFields: {} },
  { id: "SRC-0001", type: "SRC-", label: "Source one", file: "research/sources/SRC-0001.yaml", summaryFields: {} },
  { id: "WID-0001", type: "WID-", label: "Future widget", file: "research/widgets/WID-0001.yaml", summaryFields: {} },
];

const DETAILS: Record<string, RecordDetail> = {
  "PRB-0005": {
    id: "PRB-0005",
    type: "PRB-",
    file: "research/problems/PRB-0005.yaml",
    record: { title: "Parking pressure", status: "OPEN", problem_statement: "Traffic and parking conflict with pedestrian space.", evidence: ["EVD-0001"] },
    outgoingEdges: [{ field: "evidence", ordinal: 0, to: "EVD-0001" }],
    incomingEdges: [],
  },
  "EVD-0001": {
    id: "EVD-0001",
    type: "EVD-",
    file: "research/evidence/EVD-0001.yaml",
    record: {
      evidence_id: "EVD-0001",
      type: "institutional",
      source: { publisher: "Fixture Publisher", title: "Fixture source" },
      observation: { summary: "The fixture observation provides concise context." },
      analysis: { contribution: ["CONFIRMS", "REFINES"] },
    },
    outgoingEdges: [
      { field: "source.source_id", ordinal: null, to: "SRC-0001" },
      { field: "additional_sources", ordinal: 0, to: "WID-0001" },
    ],
    incomingEdges: [{ field: "evidence", ordinal: 0, from: "PRB-0005" }],
  },
  "SRC-0001": {
    id: "SRC-0001",
    type: "SRC-",
    file: "research/sources/SRC-0001.yaml",
    record: { source_id: "SRC-0001", publisher: "Fixture Publisher" },
    outgoingEdges: [],
    incomingEdges: [{ field: "source.source_id", ordinal: null, from: "EVD-0001" }],
  },
  "WID-0001": {
    id: "WID-0001",
    type: "WID-",
    file: "research/widgets/WID-0001.yaml",
    record: { widget_id: "WID-0001" },
    outgoingEdges: [],
    incomingEdges: [{ field: "additional_sources", ordinal: 0, from: "EVD-0001" }],
  },
};

function fakeProvider(): DataProvider {
  return {
    getManifest: () => Promise.reject(new Error("not used")),
    listRecords: () => Promise.resolve(INDEX),
    getRecord: (id: string) => {
      const detail = DETAILS[id];
      return detail ? Promise.resolve(detail) : Promise.reject(new Error(`no fixture detail for ${id}`));
    },
    getEdges: () => Promise.resolve([]),
  };
}

describe("ProblemView", () => {
  it("shows a prompt when no problem is selected", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId={null} onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByText("Nenhum Problema selecionado.");
  });

  it("shows a redirect message when the selected record is not a Problem", async () => {
    const onOpenGeneric = vi.fn();
    render(<ProblemView dataProvider={fakeProvider()} problemId="EVD-0001" onOpenGeneric={onOpenGeneric} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/não pode ser aberto/)).toBeTruthy();
    const user = userEvent.setup();
    await user.click(within(alert).getByRole("button", { name: "Ver detalhe genérico" }));
    expect(onOpenGeneric).toHaveBeenCalledWith("EVD-0001");
  });

  it("surfaces identity, current state, evidence, and sources for a real problem shape", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);

    await screen.findByRole("heading", { name: "Parking pressure" });
    expect(screen.getByText(/Traffic and parking conflict/)).toBeTruthy();

    const evidenceSection = screen.getByLabelText("Evidência");
    expect(within(evidenceSection).getByText(/EVD-0001/)).toBeTruthy();
    expect(within(evidenceSection).getByText(/SRC-0001/)).toBeTruthy();
  });

  it("only surfaces SRC- typed targets as Sources, and does not crash when evidence links a non-source future type", async () => {
    // EVD-0001 links WID-0001 (a future type) via `additional_sources` too;
    // the Sources section is specifically about SRC- provenance, so a
    // non-SRC- target is correctly excluded from it rather than mislabelled
    // as a "source" — and its presence must not crash the projection or the
    // render.
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);
    const evidenceSection = await screen.findByLabelText("Evidência");
    await within(evidenceSection).findByText(/EVD-0001/);
    expect(within(evidenceSection).getByText(/SRC-0001/)).toBeTruthy();
    expect(within(evidenceSection).queryByText(/WID-0001/)).toBeNull();
  });

  it("clicking an evidence or source ID calls onOpenGeneric with that ID", async () => {
    const onOpenGeneric = vi.fn();
    const user = userEvent.setup();
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={onOpenGeneric} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);

    const sourceButton = await screen.findByRole("button", { name: /SRC-0001/ });
    await user.click(sourceButton);
    expect(onOpenGeneric).toHaveBeenCalledWith("SRC-0001");
  });

  it("shows explicit canonical evidence contributions as distinct chips, observation, and provenance context", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByRole("heading", { name: "Parking pressure" });
    const evidenceSection = screen.getByLabelText("Evidência");
    const evidenceItems = within(evidenceSection.querySelector("ul")!);
    // EVD-0001 carries two contributions (CONFIRMS, REFINES) — both must render as separate chips, not merged text.
    expect(evidenceItems.getByText("Confirma")).toBeTruthy();
    expect(evidenceItems.getByText("Refina")).toBeTruthy();
    expect(within(evidenceSection).getByText(/fixture observation provides concise context/i)).toBeTruthy();
    expect(within(evidenceSection).getByText(/Fixture Publisher — Fixture source/)).toBeTruthy();
  });

  it("keeps missing evidence contribution explicitly unclassified rather than inferring confirmation", async () => {
    const provider = fakeProvider();
    provider.getRecord = (id: string) => {
      if (id === "EVD-0001") {
        return Promise.resolve({ ...DETAILS[id], record: { evidence_id: id, type: "institutional" } });
      }
      const detail = DETAILS[id];
      return detail ? Promise.resolve(detail) : Promise.reject(new Error(`no fixture detail for ${id}`));
    };
    render(<ProblemView dataProvider={provider} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);

    const evidenceSection = await screen.findByLabelText("Evidência");
    expect(within(evidenceSection).getByText("contribuição não registada.")).toBeTruthy();
    expect(within(evidenceSection).queryByText("Confirma")).toBeNull();
  });

  it("renders every current canonical contribution value, including a multi-contribution item, without crashing", async () => {
    const provider = fakeProvider();
    provider.getRecord = (id: string) => {
      if (id === "EVD-0001") {
        return Promise.resolve({
          ...DETAILS[id],
          record: {
            ...DETAILS[id].record,
            analysis: {
              contribution: [
                "CONFIRMS",
                "REFINES",
                "CONTRADICTS",
                "CURRENT-STATE-UPDATE",
                "EXISTING-SOLUTION",
                "PLANNED-SOLUTION",
                "NEW-CANDIDATE",
              ],
            },
          },
        });
      }
      const detail = DETAILS[id];
      return detail ? Promise.resolve(detail) : Promise.reject(new Error(`no fixture detail for ${id}`));
    };
    render(<ProblemView dataProvider={provider} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);

    const evidenceSection = await screen.findByLabelText("Evidência");
    const evidenceItems = within(evidenceSection.querySelector("ul")!);
    for (const value of [
      "Confirma",
      "Refina",
      "Contradiz",
      "Atualização do estado atual",
      "Solução existente",
      "Solução planeada",
      "Novo candidato",
    ]) {
      expect(evidenceItems.getByText(value)).toBeTruthy();
    }
    // CONTRADICTS carries no exceptional class distinguishing it structurally from the other six.
    const contradicts = evidenceItems.getByText("Contradiz").closest(".contribution-chip");
    const confirms = evidenceItems.getByText("Confirma").closest(".contribution-chip");
    expect(contradicts?.className).toBe(confirms?.className);
  });

  it("renders an unrecognised future contribution value without crashing", async () => {
    const provider = fakeProvider();
    provider.getRecord = (id: string) => {
      if (id === "EVD-0001") {
        return Promise.resolve({ ...DETAILS[id], record: { ...DETAILS[id].record, analysis: { contribution: ["FUTURE-VALUE"] } } });
      }
      const detail = DETAILS[id];
      return detail ? Promise.resolve(detail) : Promise.reject(new Error(`no fixture detail for ${id}`));
    };
    render(<ProblemView dataProvider={provider} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);

    const evidenceSection = await screen.findByLabelText("Evidência");
    expect(within(evidenceSection.querySelector("ul")!).getByText("FUTURE-VALUE")).toBeTruthy();
  });

  it("shows a contribution occurrence summary distinguishing occurrences from evidence-item count, in public wording (F02)", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);
    const evidenceSection = await screen.findByLabelText("Evidência");
    // 1 evidence item, 2 contributions (CONFIRMS, REFINES) — occurrenceCount (2) must not be presented as the item count (1).
    const countsLine = within(evidenceSection).getByText(/registos? · \d+ papéis? registado/);
    expect(countsLine.textContent).toContain("1 registo");
    expect(countsLine.textContent).toContain("2 papéis registados");
    expect(within(evidenceSection).getByText(/um registo pode ter mais do que um papel nesta leitura/)).toBeTruthy();
    expect(within(evidenceSection).queryByText(/item de evidência/)).toBeNull();
    expect(within(evidenceSection).queryByText(/ocorrências de contribuição/)).toBeNull();
  });

  it("shows localized Estado atual values without inventing a corroborated-independence claim", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByRole("heading", { name: "Parking pressure" });
    const stateSection = screen.getByLabelText("Estado atual");
    expect(within(stateSection).queryByText("OPEN")).toBeNull();
    expect(within(stateSection).getByText(/Aberto/)).toBeTruthy();
    expect(screen.queryByText(/fontes independentes/i)).toBeNull();
    expect(screen.queryByText(/independent sources/i)).toBeNull();
  });

  it("renders an unmapped/future status value as its raw canonical value, with no crash and no fabricated gloss", async () => {
    const provider = fakeProvider();
    provider.getRecord = (id: string) => {
      if (id === "PRB-0005") {
        return Promise.resolve({ ...DETAILS[id], record: { ...DETAILS[id].record, status: "FUTURE_STATUS" } });
      }
      const detail = DETAILS[id];
      return detail ? Promise.resolve(detail) : Promise.reject(new Error(`no fixture detail for ${id}`));
    };
    render(<ProblemView dataProvider={provider} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByRole("heading", { name: "Parking pressure" });

    const stateSection = screen.getByLabelText("Estado atual");
    // An unknown future value remains visible as the safe fallback.
    expect(within(stateSection).getByText("FUTURE_STATUS")).toBeTruthy();
    // ...and the help disclosure surfaces the same raw value rather than a manufactured label/explanation.
    const details = screen.getByText("O que é um Problema, e o que significam os estados abaixo?").closest("details")!;
    expect(within(details).getAllByText(/FUTURE_STATUS/).length).toBeGreaterThan(0);
  });

  it("exposes a collapsed-by-default point-of-use Problem help disclosure, self-sufficient with no link to the removed global reading guide", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByRole("heading", { name: "Parking pressure" });
    const details = screen.getByText("O que é um Problema, e o que significam os estados abaixo?").closest("details");
    expect(details).toBeTruthy();
    expect(details!.hasAttribute("open")).toBe(false);
    // UX-C §3: the global ReadingGuide no longer exists on Problem View, so
    // neither the help disclosure nor the desktop rail points into it.
    expect(within(details!).queryByRole("link", { name: /Orientação completa do Explorer/ })).toBeNull();
    expect(document.querySelector('a[href="#reading-guide"]')).toBeNull();
  });

  it("shows a PRB-scoped Detalhe/Problema/Grafo context switcher with Problema active and correct navigation calls", async () => {
    const onOpenGeneric = vi.fn();
    const onViewInGraph = vi.fn();
    const user = userEvent.setup();
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={onOpenGeneric} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={onViewInGraph} />);
    await screen.findByRole("heading", { name: "Parking pressure" });

    const switcher = screen.getByRole("navigation", { name: /PRB-0005/ });
    const problemaButton = within(switcher).getByRole("button", { name: "Problema" });
    expect(problemaButton.getAttribute("aria-current")).toBe("page");

    await user.click(within(switcher).getByRole("button", { name: "Detalhe" }));
    expect(onOpenGeneric).toHaveBeenCalledWith("PRB-0005");

    // UX-F: Grafo is visible and focusable but aria-disabled — cannot invoke onViewInGraph.
    const grafoButton = within(switcher).getByRole("button", { name: "Grafo" }) as HTMLButtonElement;
    expect(grafoButton.disabled).toBe(false);
    expect(grafoButton.getAttribute("aria-disabled")).toBe("true");
    expect(grafoButton.getAttribute("title")).toBe("Em desenvolvimento");

    grafoButton.focus();
    expect(document.activeElement).toBe(grafoButton);

    await user.click(grafoButton);
    expect(onViewInGraph).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onViewInGraph).not.toHaveBeenCalled();

    await user.keyboard(" ");
    expect(onViewInGraph).not.toHaveBeenCalled();
  });

  it("exposes 'Nesta página' section-index anchors that target every major Problem View section", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByRole("heading", { name: "Parking pressure" });

    const expectedSections = [
      { id: "problem-estado-atual", label: "Estado atual" },
      { id: "problem-evidencia", label: "Evidência" },
    ];

    for (const { id, label } of expectedSections) {
      // The target anchor itself must exist in the DOM...
      expect(document.getElementById(id)).toBeTruthy();
      // ...and the rail's index must link to it by that exact id.
      const railLink = screen.getByRole("navigation", { name: "Nesta página" }).querySelector(`a[href="#${id}"]`);
      expect(railLink?.textContent).toBe(label);
    }
  });

  it("keeps the compact section-index self-sufficient — its anchors do not depend on the desktop reading rail rendering", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByRole("heading", { name: "Parking pressure" });

    // The compact-substitute index (inside ProblemHelpDisclosure) is a
    // second, independent nav carrying the same anchors — CSS alone decides
    // which of the two is visible at a given width, so both must exist and
    // link correctly regardless of which one compact/desktop actually shows.
    const compactIndex = screen.getByRole("navigation", { name: "Nesta página (versão compacta)" });
    expect(within(compactIndex).getByRole("link", { name: "Evidência" }).getAttribute("href")).toBe("#problem-evidencia");
  });

  it("fails closed on a child-detail failure and retries the complete projection", async () => {
    const provider = fakeProvider();
    let evidenceAttempts = 0;
    provider.getRecord = (id: string) => {
      if (id === "EVD-0001" && evidenceAttempts++ === 0) return Promise.reject(new Error("temporary evidence failure"));
      const detail = DETAILS[id];
      return detail ? Promise.resolve(detail) : Promise.reject(new Error(`no fixture detail for ${id}`));
    };
    const user = userEvent.setup();
    render(<ProblemView dataProvider={provider} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/temporary evidence failure/)).toBeTruthy();
    expect(screen.queryByLabelText("Evidência")).toBeNull();
    await user.click(within(alert).getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByLabelText("Evidência")).toBeTruthy();
    expect(evidenceAttempts).toBeGreaterThanOrEqual(2);
  });

  it("UX-D §2: the Problem breadcrumb's first action is Visão geral, not Registos", async () => {
    const onBackToOverview = vi.fn();
    const onBackToRecords = vi.fn();
    const user = userEvent.setup();
    render(
      <ProblemView
        dataProvider={fakeProvider()}
        problemId="PRB-0005"
        onOpenGeneric={vi.fn()}
        onBackToRecords={onBackToRecords}
        onBackToOverview={onBackToOverview}
        onViewInGraph={vi.fn()}
      />
    );

    const breadcrumb = await screen.findByLabelText("Localização");
    expect(within(breadcrumb).queryByRole("button", { name: "Registos" })).toBeNull();
    const overviewLink = within(breadcrumb).getByRole("button", { name: "Visão geral" });
    await user.click(overviewLink);

    expect(onBackToOverview).toHaveBeenCalledTimes(1);
    expect(onBackToRecords).not.toHaveBeenCalled();
  });

  it("UX-D §5: uses public evidence-comprehension copy instead of raw contribution-occurrence language", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);

    const evidenceSection = await screen.findByLabelText("Evidência");
    expect(within(evidenceSection).getByText(/Registos de evidência associados \(1\)/)).toBeTruthy();
    expect(within(evidenceSection).getByText("Papel destes registos nesta leitura — os papéis indicados não representam força, confiança ou classificação.")).toBeTruthy();
    expect(within(evidenceSection).queryByText(/Ocorrências de contribuição canónica/)).toBeNull();
    expect(within(evidenceSection).queryByText(/nenhuma implica força, confiança ou classificação/)).toBeNull();
    // Canonical contribution labels/counts (CONFIRMS, REFINES) are unchanged.
    expect(within(evidenceSection).getAllByText("Confirma").length).toBeGreaterThan(0);
    expect(within(evidenceSection).getAllByText("Refina").length).toBeGreaterThan(0);
  });
});

describe("ProblemView — PI-02B header + Estado atual", () => {
  const HEADER_INDEX: RecordSummary[] = [
    { id: "PRB-0200", type: "PRB-", label: "Header fixture", file: "research/problems/PRB-0200.yaml", summaryFields: {} },
  ];

  function headerProvider(record: Record<string, unknown>): DataProvider {
    const detail: RecordDetail = {
      id: "PRB-0200",
      type: "PRB-",
      file: "research/problems/PRB-0200.yaml",
      record,
      outgoingEdges: [],
      incomingEdges: [],
    };
    return {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.resolve(HEADER_INDEX),
      getRecord: () => Promise.resolve(detail),
      getEdges: () => Promise.resolve([]),
    };
  }

  it("renders title, problem_statement, geography, affected_populations, and compact status/evidence_status/validation_status chips from canonical data only", async () => {
    render(
      <ProblemView
        dataProvider={headerProvider({
          title: "Header fixture problem",
          problem_statement: "A concise canonical statement.",
          geography: { level: "municipality", area: "Município de Évora" },
          affected_populations: ["students", "commuters"],
          status: "OPEN",
          evidence_status: "corroborated",
          validation_status: "unvalidated",
        })}
        problemId="PRB-0200"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Header fixture problem" });
    expect(screen.getByText("A concise canonical statement.")).toBeTruthy();
    expect(screen.getByText(/Município de Évora/)).toBeTruthy();
    expect(screen.getByText("students, commuters")).toBeTruthy();

    const stateSection = screen.getByLabelText("Estado atual");
    expect(within(stateSection).getByText(/Aberto/)).toBeTruthy();
    expect(within(stateSection).getByText(/Evidência corroborada/)).toBeTruthy();
    expect(within(stateSection).getByText(/Por validar/)).toBeTruthy();
  });

  it("omits geography, affected_populations, currentness, and scope entirely when the canonical fields are absent, without inventing a fallback", async () => {
    render(
      <ProblemView
        dataProvider={headerProvider({ title: "No optional fields", status: "OPEN" })}
        problemId="PRB-0200"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "No optional fields" });
    expect(screen.queryByText("Onde")).toBeNull();
    expect(screen.queryByText("Quem é afetado")).toBeNull();
    expect(screen.queryByText("Atualidade da evidência")).toBeNull();
    expect(screen.queryByText("Âmbito")).toBeNull();
  });

  it("renders 'Estado atual' from decision_basis (manifestation, consequence, currentness, scope) without repeating the header's compact indicators as full sentences", async () => {
    render(
      <ProblemView
        dataProvider={headerProvider({
          title: "Decision basis fixture",
          status: "OPEN",
          decision_basis: {
            manifestation: { summary: "What the evidence shows is happening." },
            consequence: { summary: "The documented downstream effect." },
            currentness: { assessment: "HIGH — evidence remains current as of 2026." },
            scope: {
              geography: "Município de Évora only.",
              population: "Residents dependent on the service.",
              temporal: "2022-2026.",
              bounded: true,
            },
          },
        })}
        problemId="PRB-0200"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Decision basis fixture" });
    const stateSection = screen.getByLabelText("Estado atual");

    expect(within(stateSection).getByText("O que observamos")).toBeTruthy();
    expect(within(stateSection).getByText("What the evidence shows is happening.")).toBeTruthy();
    expect(within(stateSection).getByText("Consequências conhecidas")).toBeTruthy();
    expect(within(stateSection).getByText("The documented downstream effect.")).toBeTruthy();
    expect(within(stateSection).getByText("Atualidade")).toBeTruthy();
    expect(within(stateSection).getByText("HIGH — evidence remains current as of 2026.")).toBeTruthy();
    expect(within(stateSection).getByText("Âmbito conhecido")).toBeTruthy();
    expect(within(stateSection).getByText("Município de Évora only.")).toBeTruthy();
    expect(within(stateSection).getByText("Residents dependent on the service.")).toBeTruthy();
    expect(within(stateSection).getByText("2022-2026.")).toBeTruthy();
    expect(within(stateSection).getByText("Sim")).toBeTruthy();

    // The header's own currentness/scope indicators stay compact — the full
    // authored sentence appears exactly once, in "Estado atual", not twice.
    expect(screen.getAllByText("What the evidence shows is happening.").length).toBe(1);
    expect(screen.getAllByText(/2022-2026\./).length).toBe(1);
  });

  it("omits manifestation/consequence/currentness/scope items individually when decision_basis carries only some of them", async () => {
    render(
      <ProblemView
        dataProvider={headerProvider({
          title: "Partial decision basis",
          status: "OPEN",
          decision_basis: {
            manifestation: { summary: "Only manifestation is authored." },
          },
        })}
        problemId="PRB-0200"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Partial decision basis" });
    const stateSection = screen.getByLabelText("Estado atual");

    expect(within(stateSection).getByText("O que observamos")).toBeTruthy();
    expect(within(stateSection).queryByText("Consequências conhecidas")).toBeNull();
    expect(within(stateSection).queryByText("Atualidade")).toBeNull();
    expect(within(stateSection).queryByText("Âmbito conhecido")).toBeNull();
  });
});

describe("ProblemView — PI-02C support section + evidence grouping", () => {
  const SUPPORT_INDEX: RecordSummary[] = [
    { id: "PRB-0300", type: "PRB-", label: "Support fixture", file: "research/problems/PRB-0300.yaml", summaryFields: {} },
    { id: "EVD-0301", type: "EVD-", label: "Supporting evidence", file: "research/evidence/EVD-0301.yaml", summaryFields: {} },
    { id: "EVD-0302", type: "EVD-", label: "Boundary evidence", file: "research/evidence/EVD-0302.yaml", summaryFields: {} },
    { id: "EVD-0303", type: "EVD-", label: "Other related evidence", file: "research/evidence/EVD-0303.yaml", summaryFields: {} },
  ];

  function evidenceDetail(id: string, summary: string): RecordDetail {
    return {
      id,
      type: "EVD-",
      file: `research/evidence/${id}.yaml`,
      record: { evidence_id: id, type: "institutional", observation: { summary } },
      outgoingEdges: [],
      incomingEdges: [{ field: "evidence", ordinal: 0, from: "PRB-0300" }],
    };
  }

  function supportProvider(record: Record<string, unknown>, evidenceIds: string[]): DataProvider {
    const problemDetail: RecordDetail = {
      id: "PRB-0300",
      type: "PRB-",
      file: "research/problems/PRB-0300.yaml",
      record,
      outgoingEdges: evidenceIds.map((id, ordinal) => ({ field: "evidence", ordinal, to: id })),
      incomingEdges: [],
    };
    const evidenceDetails: Record<string, RecordDetail> = {
      "EVD-0301": evidenceDetail("EVD-0301", "Supporting evidence observation."),
      "EVD-0302": evidenceDetail("EVD-0302", "Boundary evidence observation."),
      "EVD-0303": evidenceDetail("EVD-0303", "Other related evidence observation."),
    };
    return {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.resolve(SUPPORT_INDEX),
      getRecord: (id: string) => {
        if (id === "PRB-0300") return Promise.resolve(problemDetail);
        const detail = evidenceDetails[id];
        return detail ? Promise.resolve(detail) : Promise.reject(new Error(`no fixture detail for ${id}`));
      },
      getEdges: () => Promise.resolve([]),
    };
  }

  it("renders corroboration_statement and independence_assessment in 'O que sustenta esta leitura', and omits the section when decision_basis carries neither", async () => {
    const { rerender } = render(
      <ProblemView
        dataProvider={supportProvider(
          {
            title: "Support fixture",
            status: "OPEN",
            evidence: ["EVD-0301"],
            decision_basis: {
              corroboration_statement: "The reading is corroborated by two institutional threads.",
              independence_assessment: "Independence is assessed as MEDIUM.",
            },
          },
          ["EVD-0301"]
        )}
        problemId="PRB-0300"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Support fixture" });
    const supportSection = screen.getByLabelText("O que sustenta esta leitura");
    expect(within(supportSection).getByText("The reading is corroborated by two institutional threads.")).toBeTruthy();
    expect(within(supportSection).getByText("Independência da evidência")).toBeTruthy();
    expect(within(supportSection).getByText("Independence is assessed as MEDIUM.")).toBeTruthy();

    rerender(
      <ProblemView
        dataProvider={supportProvider({ title: "Support fixture", status: "OPEN", evidence: ["EVD-0301"] }, ["EVD-0301"])}
        problemId="PRB-0300"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );
    await screen.findByRole("heading", { name: "Support fixture" });
    expect(screen.queryByLabelText("O que sustenta esta leitura")).toBeNull();
  });

  it("partitions evidence into Evidência que suporta / que limita a conclusão / Outra evidência relacionada by decision_basis membership, deduplicated and category-exclusive", async () => {
    render(
      <ProblemView
        dataProvider={supportProvider(
          {
            title: "Support fixture",
            status: "OPEN",
            evidence: ["EVD-0301", "EVD-0302", "EVD-0303"],
            decision_basis: {
              supporting_evidence: ["EVD-0301", "EVD-0301"],
              boundary_evidence: ["EVD-0302"],
            },
          },
          ["EVD-0301", "EVD-0302", "EVD-0303"]
        )}
        problemId="PRB-0300"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Support fixture" });
    const evidenceSection = screen.getByLabelText("Evidência");

    const supportingHeading = within(evidenceSection).getByText(/^Evidência que suporta/);
    const boundaryHeading = within(evidenceSection).getByText(/^Evidência que limita a conclusão/);
    const otherHeading = within(evidenceSection).getByText(/^Outra evidência relacionada/);

    expect(supportingHeading.textContent).toContain("(1)");
    expect(boundaryHeading.textContent).toContain("(1)");
    expect(otherHeading.textContent).toContain("(1)");

    const supportingGroup = supportingHeading.closest(".evidence-group") as HTMLElement;
    expect(within(supportingGroup).getByText(/EVD-0301/)).toBeTruthy();
    expect(within(supportingGroup).queryByText(/EVD-0302/)).toBeNull();

    const boundaryGroup = boundaryHeading.closest(".evidence-group") as HTMLElement;
    expect(within(boundaryGroup).getByText(/EVD-0302/)).toBeTruthy();
    expect(within(boundaryGroup).queryByText(/EVD-0301/)).toBeNull();

    const otherGroup = otherHeading.closest(".evidence-group") as HTMLElement;
    expect(within(otherGroup).getByText(/EVD-0303/)).toBeTruthy();
    expect(within(otherGroup).queryByText(/EVD-0301/)).toBeNull();
    expect(within(otherGroup).queryByText(/EVD-0302/)).toBeNull();
  });

  it("omits empty evidence groups, e.g. when decision_basis carries no supporting_evidence/boundary_evidence at all", async () => {
    render(
      <ProblemView
        dataProvider={supportProvider({ title: "Support fixture", status: "OPEN", evidence: ["EVD-0303"] }, ["EVD-0303"])}
        problemId="PRB-0300"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Support fixture" });
    const evidenceSection = screen.getByLabelText("Evidência");
    expect(within(evidenceSection).queryByText(/^Evidência que suporta/)).toBeNull();
    expect(within(evidenceSection).queryByText(/^Evidência que limita a conclusão/)).toBeNull();
    expect(within(evidenceSection).getByText(/^Outra evidência relacionada/)).toBeTruthy();
    expect(within(evidenceSection).getByText(/EVD-0303/)).toBeTruthy();
  });

  it("does not treat boundary evidence as negative or contradictory — it renders with the same EvidenceCard presentation as every other group", async () => {
    render(
      <ProblemView
        dataProvider={supportProvider(
          {
            title: "Support fixture",
            status: "OPEN",
            evidence: ["EVD-0302"],
            decision_basis: { boundary_evidence: ["EVD-0302"] },
          },
          ["EVD-0302"]
        )}
        problemId="PRB-0300"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Support fixture" });
    const evidenceSection = screen.getByLabelText("Evidência");
    const boundaryHeading = within(evidenceSection).getByText(/^Evidência que limita a conclusão/);
    const boundaryGroup = boundaryHeading.closest(".evidence-group") as HTMLElement;
    expect(within(boundaryGroup).getByText("Boundary evidence observation.")).toBeTruthy();
    expect(within(boundaryGroup).queryByText(/contradiz|negativ/i)).toBeNull();
  });
});

describe("ProblemView — PI-02D open questions + contradiction search", () => {
  const OQ_INDEX: RecordSummary[] = [
    { id: "PRB-0400", type: "PRB-", label: "Open questions fixture", file: "research/problems/PRB-0400.yaml", summaryFields: {} },
    { id: "EVD-0401", type: "EVD-", label: "Referenced evidence one", file: "research/evidence/EVD-0401.yaml", summaryFields: {} },
    { id: "EVD-0402", type: "EVD-", label: "Referenced evidence two", file: "research/evidence/EVD-0402.yaml", summaryFields: {} },
  ];

  function oqEvidenceDetail(id: string): RecordDetail {
    return {
      id,
      type: "EVD-",
      file: `research/evidence/${id}.yaml`,
      record: { evidence_id: id, type: "institutional", observation: { summary: `${id} observation.` } },
      outgoingEdges: [],
      incomingEdges: [{ field: "evidence", ordinal: 0, from: "PRB-0400" }],
    };
  }

  function oqProvider(record: Record<string, unknown>, evidenceIds: string[]): DataProvider {
    const problemDetail: RecordDetail = {
      id: "PRB-0400",
      type: "PRB-",
      file: "research/problems/PRB-0400.yaml",
      record,
      outgoingEdges: evidenceIds.map((id, ordinal) => ({ field: "evidence", ordinal, to: id })),
      incomingEdges: [],
    };
    const evidenceDetails: Record<string, RecordDetail> = {
      "EVD-0401": oqEvidenceDetail("EVD-0401"),
      "EVD-0402": oqEvidenceDetail("EVD-0402"),
    };
    return {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.resolve(OQ_INDEX),
      getRecord: (id: string) => {
        if (id === "PRB-0400") return Promise.resolve(problemDetail);
        const detail = evidenceDetails[id];
        return detail ? Promise.resolve(detail) : Promise.reject(new Error(`no fixture detail for ${id}`));
      },
      getEdges: () => Promise.resolve([]),
    };
  }

  it("omits the entire section when there are no open questions and no authored contradiction_search", async () => {
    render(
      <ProblemView
        dataProvider={oqProvider({ title: "No open questions", status: "OPEN" }, [])}
        problemId="PRB-0400"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );
    await screen.findByRole("heading", { name: "No open questions" });
    expect(screen.queryByLabelText("O que ainda não sabemos — e o que estamos a fazer")).toBeNull();
  });

  it("renders every open_questions[] field under its PT-PT label, omitting optional fields individually when absent", async () => {
    render(
      <ProblemView
        dataProvider={oqProvider(
          {
            title: "Open questions fixture",
            status: "OPEN",
            evidence: ["EVD-0401"],
            investigation: {
              open_questions: [
                {
                  question: "Does the gap cause a material failure?",
                  why_open: "No direct evidence exists yet.",
                  current_action: "Field validation is underway.",
                  latest_result: "A partial result was found.",
                  resolution_condition: "Direct affected-journey evidence would resolve this.",
                  evidence: ["EVD-0401"],
                },
                {
                  question: "Second question with only why_open authored.",
                  why_open: "Only this field is authored for this item.",
                },
              ],
            },
          },
          ["EVD-0401"]
        )}
        problemId="PRB-0400"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Open questions fixture" });
    const section = screen.getByLabelText("O que ainda não sabemos — e o que estamos a fazer");

    expect(within(section).getByText("Does the gap cause a material failure?")).toBeTruthy();
    expect(within(section).getAllByText("Porque continua em aberto").length).toBe(2);
    expect(within(section).getByText("No direct evidence exists yet.")).toBeTruthy();
    expect(within(section).getByText("O que estamos a fazer")).toBeTruthy();
    expect(within(section).getByText("Field validation is underway.")).toBeTruthy();
    expect(within(section).getByText("O que aprendemos mais recentemente")).toBeTruthy();
    expect(within(section).getByText("A partial result was found.")).toBeTruthy();
    expect(within(section).getByText("O que permitiria esclarecer")).toBeTruthy();
    expect(within(section).getByText("Direct affected-journey evidence would resolve this.")).toBeTruthy();

    // Second item renders independently and only shows the one field it authored.
    expect(within(section).getByText("Second question with only why_open authored.")).toBeTruthy();
    expect(within(section).getByText("Only this field is authored for this item.")).toBeTruthy();
    // "O que estamos a fazer" heading appears only once (for item 1), not fabricated for item 2.
    expect(within(section).getAllByText("O que estamos a fazer").length).toBe(1);
  });

  it("shows compact EVD- references for open_questions[].evidence via existing record navigation, without duplicating the full EvidenceCard", async () => {
    const onOpenGeneric = vi.fn();
    const user = userEvent.setup();
    render(
      <ProblemView
        dataProvider={oqProvider(
          {
            title: "Open questions fixture",
            status: "OPEN",
            evidence: ["EVD-0401"],
            investigation: {
              open_questions: [{ question: "Question with evidence.", evidence: ["EVD-0401"] }],
            },
          },
          ["EVD-0401"]
        )}
        problemId="PRB-0400"
        onOpenGeneric={onOpenGeneric}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Open questions fixture" });
    const section = screen.getByLabelText("O que ainda não sabemos — e o que estamos a fazer");
    const refButton = within(section).getByRole("button", { name: /EVD-0401/ });
    // The compact reference must not carry the full EvidenceCard's observation text.
    expect(within(section).queryByText("EVD-0401 observation.")).toBeNull();

    await user.click(refButton);
    expect(onOpenGeneric).toHaveBeenCalledWith("EVD-0401");
  });

  it("omits the evidence-reference row entirely when open_questions[].evidence is empty", async () => {
    render(
      <ProblemView
        dataProvider={oqProvider(
          {
            title: "Open questions fixture",
            status: "OPEN",
            investigation: { open_questions: [{ question: "Question without evidence." }] },
          },
          []
        )}
        problemId="PRB-0400"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Open questions fixture" });
    const section = screen.getByLabelText("O que ainda não sabemos — e o que estamos a fazer");
    expect(within(section).queryByText("Evidência relacionada:")).toBeNull();
  });

  it("renders decision_basis.contradiction_search as a separate labelled item, stating authored status/summary without interpreting performed:false as a negative finding", async () => {
    render(
      <ProblemView
        dataProvider={oqProvider(
          {
            title: "Contradiction search fixture",
            status: "OPEN",
            decision_basis: {
              contradiction_search: {
                performed: false,
                summary: "No deliberate contradiction search has been carried out yet.",
              },
            },
          },
          []
        )}
        problemId="PRB-0400"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Contradiction search fixture" });
    const section = screen.getByLabelText("O que ainda não sabemos — e o que estamos a fazer");
    expect(within(section).getByText("Procura de evidência contraditória")).toBeTruthy();
    expect(within(section).getByText("Não realizada")).toBeTruthy();
    expect(within(section).getByText("No deliberate contradiction search has been carried out yet.")).toBeTruthy();
    // No negative/derived language beyond the authored summary itself.
    expect(within(section).queryByText(/nenhuma evidência contraditória foi encontrada/i)).toBeNull();
  });

  it("renders contradiction_search evidence references and keeps the section present even with zero open_questions", async () => {
    render(
      <ProblemView
        dataProvider={oqProvider(
          {
            title: "Contradiction search fixture",
            status: "OPEN",
            evidence: ["EVD-0402"],
            decision_basis: {
              contradiction_search: { performed: true, summary: "A deliberate search was performed.", evidence: ["EVD-0402"] },
            },
          },
          ["EVD-0402"]
        )}
        problemId="PRB-0400"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Contradiction search fixture" });
    const section = screen.getByLabelText("O que ainda não sabemos — e o que estamos a fazer");
    expect(within(section).getByText("Realizada")).toBeTruthy();
    expect(within(section).getByRole("button", { name: /EVD-0402/ })).toBeTruthy();
  });
});

describe("ProblemView — PI-02E investigation path + final section order", () => {
  const PATH_INDEX: RecordSummary[] = [
    { id: "PRB-0500", type: "PRB-", label: "Path fixture", file: "research/problems/PRB-0500.yaml", summaryFields: {} },
    { id: "EVD-0501", type: "EVD-", label: "Initial signal evidence", file: "research/evidence/EVD-0501.yaml", summaryFields: {} },
    { id: "EVD-0502", type: "EVD-", label: "Development evidence", file: "research/evidence/EVD-0502.yaml", summaryFields: {} },
  ];

  function pathEvidenceDetail(id: string): RecordDetail {
    return {
      id,
      type: "EVD-",
      file: `research/evidence/${id}.yaml`,
      record: { evidence_id: id, type: "institutional", observation: { summary: `${id} observation.` } },
      outgoingEdges: [],
      incomingEdges: [{ field: "evidence", ordinal: 0, from: "PRB-0500" }],
    };
  }

  function pathProvider(record: Record<string, unknown>, evidenceIds: string[]): DataProvider {
    const problemDetail: RecordDetail = {
      id: "PRB-0500",
      type: "PRB-",
      file: "research/problems/PRB-0500.yaml",
      record,
      outgoingEdges: evidenceIds.map((id, ordinal) => ({ field: "evidence", ordinal, to: id })),
      incomingEdges: [],
    };
    const evidenceDetails: Record<string, RecordDetail> = {
      "EVD-0501": pathEvidenceDetail("EVD-0501"),
      "EVD-0502": pathEvidenceDetail("EVD-0502"),
    };
    return {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.resolve(PATH_INDEX),
      getRecord: (id: string) => {
        if (id === "PRB-0500") return Promise.resolve(problemDetail);
        const detail = evidenceDetails[id];
        return detail ? Promise.resolve(detail) : Promise.reject(new Error(`no fixture detail for ${id}`));
      },
      getEdges: () => Promise.resolve([]),
    };
  }

  it("omits the path section entirely when investigation.path has no authored stage", async () => {
    render(
      <ProblemView
        dataProvider={pathProvider({ title: "No path", status: "OPEN" }, [])}
        problemId="PRB-0500"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );
    await screen.findByRole("heading", { name: "No path" });
    expect(screen.queryByLabelText("Como chegámos a este problema")).toBeNull();
  });

  it("renders initial_signal, development, and delimitation under their PT-PT labels with compact evidence references, omitting evidence rows when absent", async () => {
    render(
      <ProblemView
        dataProvider={pathProvider(
          {
            title: "Path fixture",
            status: "OPEN",
            evidence: ["EVD-0501", "EVD-0502"],
            investigation: {
              path: {
                initial_signal: { summary: "The first signal that surfaced this problem.", evidence: ["EVD-0501"] },
                development: { summary: "How the investigation developed.", evidence: ["EVD-0502"] },
                delimitation: { summary: "How the problem was bounded." },
              },
            },
          },
          ["EVD-0501", "EVD-0502"]
        )}
        problemId="PRB-0500"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Path fixture" });
    const section = screen.getByLabelText("Como chegámos a este problema");

    expect(within(section).getByText("Sinal inicial")).toBeTruthy();
    expect(within(section).getByText("The first signal that surfaced this problem.")).toBeTruthy();
    expect(within(section).getByText("Desenvolvimento da investigação")).toBeTruthy();
    expect(within(section).getByText("How the investigation developed.")).toBeTruthy();
    expect(within(section).getByText("Delimitação")).toBeTruthy();
    expect(within(section).getByText("How the problem was bounded.")).toBeTruthy();

    const items = within(section).getAllByRole("listitem");
    const initialSignalItem = items.find((item) => within(item).queryByText("Sinal inicial"))!;
    expect(within(initialSignalItem).getByRole("button", { name: /EVD-0501/ })).toBeTruthy();
    const delimitationItem = items.find((item) => within(item).queryByText("Delimitação"))!;
    expect(within(delimitationItem).queryByText("Evidência relacionada:")).toBeNull();
  });

  it("omits an individual stage when its summary is absent, without inferring or fabricating text", async () => {
    render(
      <ProblemView
        dataProvider={pathProvider(
          { title: "Partial path", status: "OPEN", investigation: { path: { development: { summary: "Only development is authored." } } } },
          []
        )}
        problemId="PRB-0500"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Partial path" });
    const section = screen.getByLabelText("Como chegámos a este problema");
    expect(within(section).getByText("Desenvolvimento da investigação")).toBeTruthy();
    expect(within(section).queryByText("Sinal inicial")).toBeNull();
    expect(within(section).queryByText("Delimitação")).toBeNull();
  });

  it("does not render current_formulation anywhere in the path section", async () => {
    render(
      <ProblemView
        dataProvider={pathProvider(
          {
            title: "Current formulation fixture",
            status: "OPEN",
            investigation: {
              current_formulation: "This must never be rendered by PI-02E.",
              path: { initial_signal: { summary: "Authored initial signal." } },
            },
          },
          []
        )}
        problemId="PRB-0500"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Current formulation fixture" });
    expect(screen.queryByText("This must never be rendered by PI-02E.")).toBeNull();
  });

  it("renders the final Problem View body section order: Estado atual, O que sustenta esta leitura, Evidência, O que ainda não sabemos, Como chegámos a este problema", async () => {
    render(
      <ProblemView
        dataProvider={pathProvider(
          {
            title: "Order fixture",
            status: "OPEN",
            evidence: ["EVD-0501"],
            decision_basis: { corroboration_statement: "Corroboration statement." },
            investigation: {
              open_questions: [{ question: "An open question." }],
              path: { initial_signal: { summary: "Initial signal summary." } },
            },
          },
          ["EVD-0501"]
        )}
        problemId="PRB-0500"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: "Order fixture" });
    const main = document.querySelector(".record-detail-main")!;
    const sections = Array.from(main.querySelectorAll("section.problem-section")).map((section) => section.getAttribute("aria-label"));

    expect(sections).toEqual([
      "Estado atual",
      "O que sustenta esta leitura",
      "Evidência",
      "O que ainda não sabemos — e o que estamos a fazer",
      "Como chegámos a este problema",
    ]);
  });
});

describe("ProblemView — PI-02F1 dynamic reading index", () => {
  const INDEX_FIXTURE: RecordSummary[] = [
    { id: "PRB-0600", type: "PRB-", label: "Index fixture", file: "research/problems/PRB-0600.yaml", summaryFields: {} },
  ];

  function indexProvider(record: Record<string, unknown>): DataProvider {
    const detail: RecordDetail = {
      id: "PRB-0600",
      type: "PRB-",
      file: "research/problems/PRB-0600.yaml",
      record,
      outgoingEdges: [],
      incomingEdges: [],
    };
    return {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.resolve(INDEX_FIXTURE),
      getRecord: () => Promise.resolve(detail),
      getEdges: () => Promise.resolve([]),
    };
  }

  function railLabels() {
    return Array.from(screen.getByRole("navigation", { name: "Nesta página" }).querySelectorAll("a")).map((a) => a.textContent);
  }

  function compactLabels() {
    return Array.from(screen.getByRole("navigation", { name: "Nesta página (versão compacta)" }).querySelectorAll("a")).map((a) => a.textContent);
  }

  it("lists only Estado atual and Evidência when no optional section is authored, in canonical order, in both the rail and the compact index", async () => {
    render(
      <ProblemView
        dataProvider={indexProvider({ title: "Minimal problem", status: "OPEN" })}
        problemId="PRB-0600"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );
    await screen.findByRole("heading", { name: "Minimal problem" });

    expect(railLabels()).toEqual(["Estado atual", "Evidência"]);
    expect(compactLabels()).toEqual(["Estado atual", "Evidência"]);
  });

  it("adds 'O que sustenta esta leitura' to the index only when decision_basis authors corroboration_statement or independence_assessment", async () => {
    render(
      <ProblemView
        dataProvider={indexProvider({
          title: "Support-only problem",
          status: "OPEN",
          decision_basis: { corroboration_statement: "Corroborated by two threads." },
        })}
        problemId="PRB-0600"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );
    await screen.findByRole("heading", { name: "Support-only problem" });

    expect(railLabels()).toEqual(["Estado atual", "O que sustenta esta leitura", "Evidência"]);
  });

  it("adds 'O que ainda não sabemos — e o que estamos a fazer' to the index only when investigation.open_questions or decision_basis.contradiction_search is authored", async () => {
    render(
      <ProblemView
        dataProvider={indexProvider({
          title: "Open questions problem",
          status: "OPEN",
          investigation: { open_questions: [{ question: "An open question." }] },
        })}
        problemId="PRB-0600"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );
    await screen.findByRole("heading", { name: "Open questions problem" });

    expect(railLabels()).toEqual(["Estado atual", "Evidência", "O que ainda não sabemos — e o que estamos a fazer"]);
  });

  it("adds 'Como chegámos a este problema' to the index only when investigation.path has an authored stage", async () => {
    render(
      <ProblemView
        dataProvider={indexProvider({
          title: "Path problem",
          status: "OPEN",
          investigation: { path: { initial_signal: { summary: "The first signal." } } },
        })}
        problemId="PRB-0600"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );
    await screen.findByRole("heading", { name: "Path problem" });

    expect(railLabels()).toEqual(["Estado atual", "Evidência", "Como chegámos a este problema"]);
  });

  it("lists every section, in canonical order, when all optional sections are authored, matching both index and body order", async () => {
    render(
      <ProblemView
        dataProvider={indexProvider({
          title: "Full problem",
          status: "OPEN",
          decision_basis: { corroboration_statement: "Corroborated." },
          investigation: {
            open_questions: [{ question: "An open question." }],
            path: { initial_signal: { summary: "The first signal." } },
          },
        })}
        problemId="PRB-0600"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );
    await screen.findByRole("heading", { name: "Full problem" });

    const expected = [
      "Estado atual",
      "O que sustenta esta leitura",
      "Evidência",
      "O que ainda não sabemos — e o que estamos a fazer",
      "Como chegámos a este problema",
    ];
    expect(railLabels()).toEqual(expected);
    expect(compactLabels()).toEqual(expected);

    // Every listed anchor id must resolve to an actual rendered section in the document.
    for (const href of Array.from(screen.getByRole("navigation", { name: "Nesta página" }).querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    )) {
      expect(document.querySelector(href!)).toBeTruthy();
    }
  });

  it("never links to an absent section — omitted-section labels are not present anywhere in the index", async () => {
    render(
      <ProblemView
        dataProvider={indexProvider({ title: "Minimal problem", status: "OPEN" })}
        problemId="PRB-0600"
        onOpenGeneric={vi.fn()}
        onBackToRecords={vi.fn()}
        onBackToOverview={vi.fn()}
        onViewInGraph={vi.fn()}
      />
    );
    await screen.findByRole("heading", { name: "Minimal problem" });

    expect(railLabels()).not.toContain("O que sustenta esta leitura");
    expect(railLabels()).not.toContain("O que ainda não sabemos — e o que estamos a fazer");
    expect(railLabels()).not.toContain("Como chegámos a este problema");
    expect(document.getElementById("problem-sustentacao")).toBeNull();
    expect(document.getElementById("problem-questoes-abertas")).toBeNull();
    expect(document.getElementById("problem-percurso")).toBeNull();
  });
});

const GENERATED_DIR = path.resolve(__dirname, "..", "..", "generated");
const hasRealCorpus = fs.existsSync(path.join(GENERATED_DIR, "index.json"));

describe.skipIf(!hasRealCorpus)("ProblemView — real generated corpus regression", () => {
  function realCorpusProvider(): DataProvider {
    const index: RecordSummary[] = JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, "index.json"), "utf8"));
    return {
      getManifest: () => Promise.reject(new Error("not used")),
      listRecords: () => Promise.resolve(index),
      getRecord: (id: string) => Promise.resolve(JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, "record-detail", `${id}.json`), "utf8"))),
      getEdges: () => Promise.resolve([]),
    };
  }

  it("keeps EVD-000127's explicit CONTRADICTS contribution, observation, and source visible for PRB-0006", async () => {
    render(<ProblemView dataProvider={realCorpusProvider()} problemId="PRB-0006" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onBackToOverview={vi.fn()} onViewInGraph={vi.fn()} />);

    const evidenceSection = await screen.findByLabelText("Evidência");
    const evidenceButton = await within(evidenceSection).findByRole("button", { name: /EVD-000127/ });
    const evidenceItem = evidenceButton.closest("li")!;
    expect(within(evidenceItem).getByText("Contradiz")).toBeTruthy();
    expect(within(evidenceItem).getByText("Os SASUE consideram plenamente operacional o atual processo de candidatura a alojamento em residência. Referem que as necessidades de esclarecimento ou de alteração do processo que envolvam estudantes ou pessoal institucional são encaminhadas para os serviços de informática da Universidade, para que seja prestado o apoio ou efetuada a alteração adequada.")).toBeTruthy();
    expect(within(evidenceItem).getByText(/Open Évora/)).toBeTruthy();
  });
});
