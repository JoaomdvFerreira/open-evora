import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProblemView } from "./ProblemView";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

const INDEX: RecordSummary[] = [
  { id: "PRB-0005", type: "PRB-", label: "Parking pressure", file: "research/problems/PRB-0005.yaml", summaryFields: {} },
  { id: "ASM-0005", type: "ASM-", label: "ASM-0005", file: "research/assessments/ASM-0005.yaml", summaryFields: {} },
  { id: "EVD-0001", type: "EVD-", label: "Evidence one", file: "research/evidence/EVD-0001.yaml", summaryFields: {} },
  { id: "SRC-0001", type: "SRC-", label: "Source one", file: "research/sources/SRC-0001.yaml", summaryFields: {} },
  { id: "WID-0001", type: "WID-", label: "Future widget", file: "research/widgets/WID-0001.yaml", summaryFields: {} },
];

const DETAILS: Record<string, RecordDetail> = {
  "PRB-0005": {
    id: "PRB-0005",
    type: "PRB-",
    file: "research/problems/PRB-0005.yaml",
    record: { title: "Parking pressure", status: "OPEN", problem_statement: "Traffic and parking conflict with pedestrian space." },
    outgoingEdges: [{ field: "evidence", ordinal: 0, to: "EVD-0001" }],
    incomingEdges: [{ field: "problem", ordinal: null, from: "ASM-0005" }],
  },
  "ASM-0005": {
    id: "ASM-0005",
    type: "ASM-",
    file: "research/assessments/ASM-0005.yaml",
    record: {
      assessment_id: "ASM-0005",
      problem: "PRB-0005",
      triage: "DEEPEN",
      assessment_status: "CURRENT",
      remaining_gap: "PARTIAL",
      critical_unknowns: { U1: { question: "Existe uma fricção significativa na procura?", decision_impact: "HIGH", target_phase: "D5", best_next_evidence: ["observação delimitada do percurso"] }, U2: { question: "A informação atual é suficiente?", decision_impact: "MEDIUM", target_phase: "D3", best_next_evidence: ["validação com utilizadores"] } },
    },
    outgoingEdges: [{ field: "problem", ordinal: null, to: "PRB-0005" }],
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
    render(<ProblemView dataProvider={fakeProvider()} problemId={null} onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByText("Nenhum Problema selecionado.");
  });

  it("shows a redirect message when the selected record is not a Problem", async () => {
    const onOpenGeneric = vi.fn();
    render(<ProblemView dataProvider={fakeProvider()} problemId="EVD-0001" onOpenGeneric={onOpenGeneric} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/não pode ser aberto/)).toBeTruthy();
    const user = userEvent.setup();
    await user.click(within(alert).getByRole("button", { name: "Ver detalhe genérico" }));
    expect(onOpenGeneric).toHaveBeenCalledWith("EVD-0001");
  });

  it("surfaces identity, current state, assessment, evidence, sources, unknowns, and (absent) hypotheses for a real problem shape", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);

    await screen.findByRole("heading", { name: "Parking pressure" });
    expect(screen.getByText(/Traffic and parking conflict/)).toBeTruthy();

    const assessmentSection = screen.getByLabelText("Avaliação");
    expect(within(assessmentSection).getByText(/ASM-0005/)).toBeTruthy();
    expect(within(assessmentSection).getByText("Aprofundar")).toBeTruthy();

    const evidenceSection = screen.getByLabelText("Evidência");
    expect(within(evidenceSection).getByText(/EVD-0001/)).toBeTruthy();
    expect(within(evidenceSection).getByText(/SRC-0001/)).toBeTruthy();

    const unknownsSection = screen.getByLabelText("Incertezas e lacunas");
    expect(within(unknownsSection).getByText("Lacuna remanescente:")).toBeTruthy();
    expect(within(unknownsSection).getByText("Incertezas")).toBeTruthy();
    expect(within(unknownsSection).getAllByText("Questão em aberto:").length).toBe(2);
    expect(within(unknownsSection).getAllByText("Próxima evidência:").length).toBe(2);
    expect(within(unknownsSection).getByText("Parcial")).toBeTruthy();
    expect(within(unknownsSection).getByText("Elevado")).toBeTruthy();
    expect(within(unknownsSection).getByText("Médio")).toBeTruthy();
    expect(within(unknownsSection).getByText("D3")).toBeTruthy();
    expect(within(unknownsSection).getByText("D5")).toBeTruthy();
    expect(within(unknownsSection).getByText("Existe uma fricção significativa na procura?")).toBeTruthy();
    expect(within(unknownsSection).getByText("observação delimitada do percurso")).toBeTruthy();
    for (const raw of ["remaining_gap", "critical_unknowns", "PARTIAL", "HIGH", "MEDIUM", "decision_impact", "target_phase"]) {
      expect(within(unknownsSection).queryByText(raw)).toBeNull();
    }

    const hypothesesSection = screen.getByLabelText("Hipóteses");
    expect(within(hypothesesSection).getByText("Nenhuma hipótese associada.")).toBeTruthy();
  });

  it("only surfaces SRC- typed targets as Sources, and does not crash when evidence links a non-source future type", async () => {
    // EVD-0001 links WID-0001 (a future type) via `additional_sources` too;
    // the Sources section is specifically about SRC- provenance, so a
    // non-SRC- target is correctly excluded from it rather than mislabelled
    // as a "source" — and its presence must not crash the projection or the
    // render.
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);
    const evidenceSection = await screen.findByLabelText("Evidência");
    await within(evidenceSection).findByText(/EVD-0001/);
    expect(within(evidenceSection).getByText(/SRC-0001/)).toBeTruthy();
    expect(within(evidenceSection).queryByText(/WID-0001/)).toBeNull();
  });

  it("clicking an evidence or source ID calls onOpenGeneric with that ID", async () => {
    const onOpenGeneric = vi.fn();
    const user = userEvent.setup();
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={onOpenGeneric} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);

    const sourceButton = await screen.findByRole("button", { name: /SRC-0001/ });
    await user.click(sourceButton);
    expect(onOpenGeneric).toHaveBeenCalledWith("SRC-0001");
  });

  it("shows explicit canonical evidence contributions as distinct chips, observation, and provenance context", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);
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
    render(<ProblemView dataProvider={provider} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);

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
    render(<ProblemView dataProvider={provider} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);

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
    render(<ProblemView dataProvider={provider} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);

    const evidenceSection = await screen.findByLabelText("Evidência");
    expect(within(evidenceSection.querySelector("ul")!).getByText("FUTURE-VALUE")).toBeTruthy();
  });

  it("shows a contribution occurrence summary distinguishing occurrences from evidence-item count", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);
    const evidenceSection = await screen.findByLabelText("Evidência");
    // 1 evidence item, 2 contributions (CONFIRMS, REFINES) — occurrenceCount (2) must not be presented as the item count (1).
    expect(within(evidenceSection).getByText(/1 item de evidência/)).toBeTruthy();
    expect(within(evidenceSection).getByText(/2 ocorrências de contribuição/)).toBeTruthy();
    expect(within(evidenceSection).getByText(/não correspondem ao número de itens de evidência/)).toBeTruthy();
  });

  it("shows localized Estado atual values without inventing a corroborated-independence claim", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);
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
    render(<ProblemView dataProvider={provider} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByRole("heading", { name: "Parking pressure" });

    const stateSection = screen.getByLabelText("Estado atual");
    // An unknown future value remains visible as the safe fallback.
    expect(within(stateSection).getByText("FUTURE_STATUS")).toBeTruthy();
    // ...and the help disclosure surfaces the same raw value rather than a manufactured label/explanation.
    const details = screen.getByText("O que é um Problema, e o que significam os estados abaixo?").closest("details")!;
    expect(within(details).getAllByText(/FUTURE_STATUS/).length).toBeGreaterThan(0);
  });

  it("exposes a collapsed-by-default point-of-use Problem help disclosure", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByRole("heading", { name: "Parking pressure" });
    const details = screen.getByText("O que é um Problema, e o que significam os estados abaixo?").closest("details");
    expect(details).toBeTruthy();
    expect(details!.hasAttribute("open")).toBe(false);
    expect(within(details!).getByRole("link", { name: /Orientação completa do Explorer/ }).getAttribute("href")).toBe("#reading-guide");
  });

  it("shows a PRB-scoped Detalhe/Problema/Grafo context switcher with Problema active and correct navigation calls", async () => {
    const onOpenGeneric = vi.fn();
    const onViewInGraph = vi.fn();
    const user = userEvent.setup();
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={onOpenGeneric} onBackToRecords={vi.fn()} onViewInGraph={onViewInGraph} />);
    await screen.findByRole("heading", { name: "Parking pressure" });

    const switcher = screen.getByRole("navigation", { name: /PRB-0005/ });
    const problemaButton = within(switcher).getByRole("button", { name: "Problema" });
    expect(problemaButton.getAttribute("aria-current")).toBe("page");

    await user.click(within(switcher).getByRole("button", { name: "Detalhe" }));
    expect(onOpenGeneric).toHaveBeenCalledWith("PRB-0005");

    await user.click(within(switcher).getByRole("button", { name: "Grafo" }));
    expect(onViewInGraph).toHaveBeenCalledWith("PRB-0005");
  });

  it("exposes 'Nesta página' section-index anchors that target every major Problem View section", async () => {
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByRole("heading", { name: "Parking pressure" });

    const expectedSections = [
      { id: "problem-estado-atual", label: "Estado atual" },
      { id: "problem-avaliacao", label: "Avaliação" },
      { id: "problem-evidencia", label: "Evidência" },
      { id: "problem-incertezas", label: "Incertezas e lacunas" },
      { id: "problem-hipoteses", label: "Hipóteses" },
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
    render(<ProblemView dataProvider={fakeProvider()} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);
    await screen.findByRole("heading", { name: "Parking pressure" });

    // The compact-substitute index (inside ProblemHelpDisclosure) is a
    // second, independent nav carrying the same anchors — CSS alone decides
    // which of the two is visible at a given width, so both must exist and
    // link correctly regardless of which one compact/desktop actually shows.
    const compactIndex = screen.getByRole("navigation", { name: "Nesta página (versão compacta)" });
    expect(within(compactIndex).getByRole("link", { name: "Evidência" }).getAttribute("href")).toBe("#problem-evidencia");
    expect(within(compactIndex).getByRole("link", { name: "Hipóteses" }).getAttribute("href")).toBe("#problem-hipoteses");
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
    render(<ProblemView dataProvider={provider} problemId="PRB-0005" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/temporary evidence failure/)).toBeTruthy();
    expect(screen.queryByLabelText("Evidência")).toBeNull();
    await user.click(within(alert).getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByLabelText("Evidência")).toBeTruthy();
    expect(evidenceAttempts).toBeGreaterThanOrEqual(2);
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
    render(<ProblemView dataProvider={realCorpusProvider()} problemId="PRB-0006" onOpenGeneric={vi.fn()} onBackToRecords={vi.fn()} onViewInGraph={vi.fn()} />);

    const evidenceButton = await screen.findByRole("button", { name: /EVD-000127/ });
    const evidenceItem = evidenceButton.closest("li")!;
    expect(within(evidenceItem).getByText("Contradiz")).toBeTruthy();
    expect(within(evidenceItem).getByText("Os SASUE consideram plenamente operacional o atual processo de candidatura a alojamento em residência. Referem que as necessidades de esclarecimento ou de alteração do processo que envolvam estudantes ou pessoal institucional são encaminhadas para os serviços de informática da Universidade, para que seja prestado o apoio ou efetuada a alteração adequada.")).toBeTruthy();
    expect(within(evidenceItem).getByText(/Open Évora/)).toBeTruthy();
  });
});
