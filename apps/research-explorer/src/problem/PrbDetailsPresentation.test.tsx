import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PrbDetailsPresentation } from "./PrbDetailsPresentation";
import { buildPrbDetailsData, knownEvidenceStatements } from "./prbDetailsProjection";
import type { RecordDetail } from "../dataProvider/types";
import type { EvidenceWithSources, ProblemProjection } from "./problemProjection";

function evd(id: string, summary: string, effects: string[] = [], researchRoles: string[] = [], sourcePublishers: string[] = []): EvidenceWithSources {
  const detail: RecordDetail = { id, type: "EVD-", file: "", outgoingEdges: [], incomingEdges: [], record: { observation: { summary } } };
  const sources: RecordDetail[] = sourcePublishers.map((publisher, index) => ({
    id: `SRC-${id}-${index}`, type: "SRC-", file: "", outgoingEdges: [], incomingEdges: [], record: { publisher },
  }));
  return { detail, sources, effects, researchRoles };
}

function baseProjection(record: Record<string, unknown>, evidence: EvidenceWithSources[]): ProblemProjection {
  return { problem: { id: "PRB-9999", type: "PRB-", file: "research/problems/PRB-9999.yaml", record, outgoingEdges: [], incomingEdges: [] }, evidence };
}

/** `container.querySelector` returns `Element`; `within()` requires `HTMLElement`. Every selector here targets an element this suite itself renders as HTML. */
function requireElement(container: ParentNode, selector: string): HTMLElement {
  const element = container.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`requireElement: no HTMLElement matched "${selector}"`);
  return element;
}

const noop = vi.fn();
const handlers = { onOpenGeneric: noop, onBackToOverview: noop, onViewHistory: noop };

function renderPrb(record: Record<string, unknown>, evidence: EvidenceWithSources[] = [], knownEvidenceIds?: string[]) {
  const projection = baseProjection(record, evidence);
  const data = buildPrbDetailsData(projection);
  const knownEvidence = knownEvidenceStatements(projection, knownEvidenceIds);
  return render(<PrbDetailsPresentation data={data} knownEvidence={knownEvidence} {...handlers} />);
}

describe("PrbDetailsPresentation — generic PRB Details composition", () => {
  it("renders the canonical title and statement exactly as authored", () => {
    renderPrb({ title: "Título canónico do problema", problem_statement: "Formulação canónica delimitada." });
    expect(screen.getByRole("heading", { name: "Título canónico do problema" })).toBeTruthy();
    expect(screen.getByText("Formulação canónica delimitada.")).toBeTruthy();
  });

  it("renders state/evidence/validation labels only when their canonical field is present", () => {
    renderPrb({ title: "T", status: "OPEN", evidence_status: "discovered", validation_status: "unvalidated" });
    expect(screen.getByText("Aberto")).toBeTruthy();
    expect(screen.getByText("Identificada")).toBeTruthy();
    expect(screen.getByText("Por validar")).toBeTruthy();
  });

  it("omits state dimension items entirely when their canonical field is absent, never a placeholder", () => {
    renderPrb({ title: "T", status: "OPEN" });
    expect(screen.queryByText("Evidência", { selector: "dt" })).toBeNull();
    expect(screen.queryByText("Validação", { selector: "dt" })).toBeNull();
  });

  it("shows singular/plural scope labels driven by the actual count", () => {
    const record = { title: "T", investigation: { open_questions: [{ question: "Única questão?" }] } };
    const { container } = renderPrb(record, [evd("EVD-1", "Obs", ["SUPPORTS"])]);
    const scope = requireElement(container, ".prb-scope-metrics");
    expect(within(scope).getByText("questão aberta")).toBeTruthy();
    expect(within(scope).getByText("registo")).toBeTruthy();
    expect(within(scope).getByText("efeito")).toBeTruthy();
  });

  it("shows plural scope labels when counts exceed one", () => {
    const record = {
      title: "T",
      investigation: { open_questions: [{ question: "Q1?" }, { question: "Q2?" }] },
    };
    const { container } = renderPrb(record, [evd("EVD-1", "Obs", ["SUPPORTS", "REFINES"]), evd("EVD-2", "Obs2", ["BOUNDS"])]);
    const scope = requireElement(container, ".prb-scope-metrics");
    expect(within(scope).getByText("questões abertas")).toBeTruthy();
    expect(within(scope).getByText("registos")).toBeTruthy();
    expect(within(scope).getByText("efeitos")).toBeTruthy();
  });

  it("renders multiple effects, multiple research roles, and multiple sources on one evidence statement", () => {
    const record = { title: "T" };
    const evidence = [evd("EVD-1", "Afirmação com múltiplos efeitos.", ["REFINES", "BOUNDS"], ["LOCAL_OBSERVATION", "EXISTING_RESPONSE"], ["Município de Évora", "ODigital"])];
    const { container } = renderPrb(record, evidence, ["EVD-1"]);
    const known = requireElement(container, ".prb-known-evidence-list");
    expect(within(known).getByText("Refina")).toBeTruthy();
    expect(within(known).getByText("Delimita")).toBeTruthy();
    expect(within(known).getByText("Observação local")).toBeTruthy();
    expect(within(known).getByText("Resposta existente")).toBeTruthy();
    expect(within(known).getByText("Município de Évora · ODigital")).toBeTruthy();
  });

  it("uses plural meta captions (Efeitos/Papéis/Fontes) only when more than one value is present", () => {
    const record = { title: "T" };
    const single = [evd("EVD-1", "Uma afirmação.", ["SUPPORTS"], ["LOCAL_OBSERVATION"], ["Fonte Única"])];
    const { container, unmount } = renderPrb(record, single, ["EVD-1"]);
    const singleKnown = requireElement(container, ".prb-known-evidence-list");
    expect(within(singleKnown).getByText("Efeito")).toBeTruthy();
    expect(within(singleKnown).getByText("Papel")).toBeTruthy();
    expect(within(singleKnown).getByText("Fonte")).toBeTruthy();
    unmount();

    const multiple = [evd("EVD-2", "Outra afirmação.", ["REFINES", "BOUNDS"], ["LOCAL_OBSERVATION", "EXISTING_RESPONSE"], ["Fonte A", "Fonte B"])];
    const { container: container2 } = renderPrb(record, multiple, ["EVD-2"]);
    const multiKnown = requireElement(container2, ".prb-known-evidence-list");
    expect(within(multiKnown).getByText("Efeitos")).toBeTruthy();
    expect(within(multiKnown).getByText("Papéis")).toBeTruthy();
    expect(within(multiKnown).getByText("Fontes")).toBeTruthy();
  });

  it("renders dynamic question/evidence/effect counts matching what is actually authored", () => {
    const record = {
      title: "T",
      investigation: {
        open_questions: [{ question: "Q1?" }, { question: "Q2?" }, { question: "Q3?" }],
      },
    };
    renderPrb(record, [evd("EVD-1", "Obs", ["SUPPORTS"])]);
    expect(screen.getByText("3", { selector: ".prb-scope-metric-value" })).toBeTruthy();
    expect(screen.getAllByText("Questão 1")[0]).toBeTruthy();
    expect(screen.getByText(/Questão 2/)).toBeTruthy();
    expect(screen.getByText(/Questão 3/)).toBeTruthy();
  });

  it("never renders WATCH or Acompanhar for a question whose canonical current_action does not contain them", () => {
    const record = {
      title: "T",
      investigation: {
        open_questions: [
          {
            question: "A falta de informação é causa material?",
            why_open: "Motivo detalhado.",
            current_action: "Não é proporcional prosseguir desafio de deslocação no âmbito atual.",
          },
        ],
      },
    };
    renderPrb(record, []);
    expect(screen.queryByText("WATCH")).toBeNull();
    expect(screen.queryByText("Acompanhar")).toBeNull();
    expect(screen.getByText("Não é proporcional prosseguir desafio de deslocação no âmbito atual.")).toBeTruthy();
  });

  it("omits the Ação atual block entirely for a question with no canonical current_action, never a fallback", () => {
    const record = {
      title: "T",
      investigation: { open_questions: [{ question: "Questão sem ação registada?", why_open: "Motivo." }] },
    };
    renderPrb(record, []);
    expect(screen.queryByText("Ação atual")).toBeNull();
  });

  it("does not attribute a shared publisher to related evidence beyond each item's own resolved sources", () => {
    const record = { title: "T" };
    const evidence = [evd("EVD-1", "Primeira afirmação.", ["SUPPORTS"], [], ["Fonte A"]), evd("EVD-2", "Segunda afirmação.", ["REFINES"], [], ["Fonte B"])];
    renderPrb(record, evidence, ["EVD-1", "EVD-2"]);
    const items = screen.getAllByRole("listitem").filter((item) => item.className.includes("prb-known-evidence-item"));
    expect(within(items[0]).getByText("Fonte A")).toBeTruthy();
    expect(within(items[0]).queryByText("Fonte B")).toBeNull();
    expect(within(items[1]).getByText("Fonte B")).toBeTruthy();
    expect(within(items[1]).queryByText("Fonte A")).toBeNull();
  });

  it("presents investigation-path stages as a neutral sequence, with no completion/current/pending indicator", () => {
    const record = {
      title: "T",
      investigation: { path: { initial_signal: { summary: "Sinal inicial." }, development: { summary: "Desenvolvimento." } } },
    };
    const { container } = renderPrb(record, []);
    const path = requireElement(container, ".prb-path-stage-list");
    expect(within(path).getByText("Sinal inicial.")).toBeTruthy();
    expect(within(path).getByText("Desenvolvimento.")).toBeTruthy();
    expect(path.querySelector('[class*="complete"]')).toBeNull();
    expect(path.querySelector('[class*="current"]')).toBeNull();
    expect(path.querySelector('[class*="pending"]')).toBeNull();
  });

  it("renders no runtime-summary or fabricated audit narrative beyond already-authored effect/count values", () => {
    const record = { title: "T" };
    const evidence = [evd("EVD-1", "Obs", ["SUPPORTS"]), evd("EVD-2", "Obs2", ["REFINES", "BOUNDS"])];
    renderPrb(record, evidence);
    expect(screen.getByText("Verificar esta investigação")).toBeTruthy();
    expect(screen.getByText("2", { selector: "strong" })).toBeTruthy();
  });

  it("keeps compact/mobile content complete — every section renders regardless of viewport-only CSS", () => {
    const record = {
      title: "Título completo",
      problem_statement: "Formulação completa.",
      status: "OPEN",
      investigation: {
        open_questions: [{ question: "Questão aberta?", current_action: "Ação registada." }],
        path: { initial_signal: { summary: "Sinal inicial registado." } },
      },
    };
    renderPrb(record, [evd("EVD-1", "Afirmação conhecida.", ["SUPPORTS"])], ["EVD-1"]);
    expect(screen.getByText("Título completo")).toBeTruthy();
    expect(screen.getByText("Formulação completa.")).toBeTruthy();
    expect(screen.getByText("Afirmação conhecida.")).toBeTruthy();
    expect(screen.getByText("Questão aberta?")).toBeTruthy();
    expect(screen.getByText("Ação registada.")).toBeTruthy();
    expect(screen.getByText("Sinal inicial registado.")).toBeTruthy();
    expect(screen.getByText("Verificar esta investigação")).toBeTruthy();
  });
});
