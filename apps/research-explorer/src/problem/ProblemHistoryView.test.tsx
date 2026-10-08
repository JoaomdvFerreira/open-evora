import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { composeStories } from "@storybook/react-vite";
import { ProblemHistoryView } from "./ProblemHistoryView";
import * as stories from "./ProblemHistoryView.stories";
import prb0005 from "../../generated/record-detail/PRB-0005.json";
import { DataLoadError, type DataProvider, type RecordDetail, type RecordSummary } from "../dataProvider/types";

const summaries: RecordSummary[] = [
  { id: "PRB-0010", type: "PRB-", label: "Pavimento", file: "research/problems/PRB-0010.yaml", summaryFields: {} },
  { id: "PRB-0001", type: "PRB-", label: "Sem histórico", file: "research/problems/PRB-0001.yaml", summaryFields: {} },
  { id: "PRB-0002", type: "PRB-", label: "Com transição", file: "research/problems/PRB-0002.yaml", summaryFields: {} },
  { id: "PRB-0003", type: "PRB-", label: "Três entradas", file: "research/problems/PRB-0003.yaml", summaryFields: {} },
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
  "PRB-0001": {
    id: "PRB-0001", type: "PRB-", file: "research/problems/PRB-0001.yaml", incomingEdges: [], outgoingEdges: [],
    record: { title: "Sem histórico", problem_statement: "Declaração canónica sem histórico.", domain: ["MOB"], updated_at: "2026-09-20" },
  },
  "PRB-0002": { id: "PRB-0002", type: "PRB-", file: "research/problems/PRB-0002.yaml", incomingEdges: [], outgoingEdges: [], record: { title: "Com transição", history: [{ date: "2026-08-27", summary: "Entrada anterior." }, { date: "2026-08-28", summary: "Mudança de estado.", state_changes: { status: { from: "OPEN", to: "NON_DIGITAL" } } }] } },
  "PRB-0003": {
    id: "PRB-0003", type: "PRB-", file: "research/problems/PRB-0003.yaml", incomingEdges: [], outgoingEdges: [],
    record: {
      title: "Tráfego e estacionamento",
      problem_statement: "Declaração canónica do problema.",
      domain: ["MOB", "URB", "ACC"],
      updated_at: "2026-09-25",
      history: [
        { date: "2026-08-31", summary: "Primeira alteração material." },
        { date: "2026-09-16", summary: "Segunda alteração material." },
        { date: "2026-09-25", summary: "Terceira alteração material." },
      ],
    },
  },
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
  dataProvider: provider(), onOpenGeneric: vi.fn(), onBackToRecords: vi.fn(), onBackToOverview: vi.fn(), onViewAsProblem: vi.fn(), onVerifyInDetails: vi.fn(),
};

/** Retired Problem View presentation classes Histórico must no longer render through. */
const RETIRED_PROBLEM_VIEW = ".problem-view, .problem-section, .open-question-list, .open-question-item, .problem-current-state-list";

it("uses the History skeleton for both index and record loading", async () => {
  const pendingIndex = { ...provider(), listRecords: () => new Promise<RecordSummary[]>(() => {}) };
  const first = render(<ProblemHistoryView {...props} dataProvider={pendingIndex} problemId="PRB-0003" />);
  expect(screen.getByTestId("prb-history-skeleton")).toBeTruthy();
  expect(screen.getAllByRole("status")).toHaveLength(1);
  first.unmount();

  const pendingDetail = { ...provider(), getRecord: () => new Promise<RecordDetail>(() => {}) };
  render(<ProblemHistoryView {...props} dataProvider={pendingDetail} problemId="PRB-0003" />);
  expect(await screen.findByText("A carregar histórico de PRB-0003…")).toBeTruthy();
  expect(screen.getByTestId("prb-history-skeleton")).toBeTruthy();
  expect(screen.getAllByRole("status")).toHaveLength(1);
});

describe("ProblemHistoryView — typed load recovery", () => {
  it("retries one transient detail failure and focuses the recovered title", async () => {
    const getRecord = vi.fn()
      .mockRejectedValueOnce(new DataLoadError("Falha temporária.", "network"))
      .mockResolvedValue(details["PRB-0003"]);
    render(<ProblemHistoryView {...props} dataProvider={{ ...provider(), getRecord }} problemId="PRB-0003" />);
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: "Falha ao carregar o Problema" })).toBeTruthy();
    expect(within(alert).getByText("Falha temporária.")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(alert));
    fireEvent.click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    const title = await screen.findByRole("heading", { name: "Tráfego e estacionamento" });
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(getRecord).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["not_found", "Problema não encontrado", "Voltar aos registos", "records"],
    ["invalid_id", "Identificador de Problema inválido", "Voltar aos registos", "records"],
    ["missing", "Modelo de leitura gerado não encontrado", "Voltar à visão geral", "overview"],
    ["malformed", "Registo mal formado", "Voltar à visão geral", "overview"],
    ["incompatible", "Versão do modelo de leitura incompatível", "Voltar à visão geral", "overview"],
  ] as const)("routes %s detail failures without another load", async (kind, title, action, destination) => {
    const getRecord = vi.fn(async () => { throw new DataLoadError("Typed failure", kind); });
    const onBackToRecords = vi.fn();
    const onBackToOverview = vi.fn();
    render(<ProblemHistoryView {...props} dataProvider={{ ...provider(), getRecord }} problemId="PRB-0003" onBackToRecords={onBackToRecords} onBackToOverview={onBackToOverview} />);
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: title })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(alert));
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
    fireEvent.click(within(alert).getByRole("button", { name: action }));
    expect(destination === "records" ? onBackToRecords : onBackToOverview).toHaveBeenCalledTimes(1);
    expect(destination === "records" ? onBackToOverview : onBackToRecords).not.toHaveBeenCalled();
    expect(getRecord).toHaveBeenCalledTimes(1);
  });

  it("requires activation to reload for a detail version mismatch", async () => {
    const originalLocation = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, reload } });
    try {
      const getRecord = vi.fn(async () => { throw new DataLoadError("Mismatch", "version_mismatch"); });
      render(<ProblemHistoryView {...props} dataProvider={{ ...provider(), getRecord }} problemId="PRB-0003" />);
      const action = await screen.findByRole("button", { name: "Recarregar página" });
      expect(reload).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
      fireEvent.click(action);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(getRecord).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    }
  });

  it("retries a transient record-index failure", async () => {
    const listRecords = vi.fn().mockRejectedValueOnce(new DataLoadError("Index failure", "network")).mockResolvedValue(summaries);
    render(<ProblemHistoryView {...props} dataProvider={{ ...provider(), listRecords }} problemId="PRB-0003" />);
    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { name: "Tráfego e estacionamento" })).toBeTruthy();
    expect(listRecords).toHaveBeenCalledTimes(2);
  });

  it.each(["missing", "malformed", "incompatible"] as const)("routes %s index failures to Overview without retry", async (kind) => {
    const listRecords = vi.fn(async () => { throw new DataLoadError("Index failure", kind); });
    const onBackToOverview = vi.fn();
    render(<ProblemHistoryView {...props} dataProvider={{ ...provider(), listRecords }} problemId="PRB-0003" onBackToOverview={onBackToOverview} />);
    fireEvent.click(await screen.findByRole("button", { name: "Voltar à visão geral" }));
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
    expect(onBackToOverview).toHaveBeenCalledTimes(1);
    expect(listRecords).toHaveBeenCalledTimes(1);
  });
});

describe("ProblemHistoryView — composition", () => {
  it("renders the dedicated PRB Histórico composition, not the retired Problem View presentation", async () => {
    render(<ProblemHistoryView {...props} problemId="PRB-0003" />);
    const title = await screen.findByRole("heading", { level: 2, name: "Tráfego e estacionamento" });
    const article = title.closest("article");
    expect(article?.className).toBe("prb-history-view");
    expect(article?.querySelector(".prb-header-band .prb-header")).not.toBeNull();
    expect(article?.querySelector("header.prb-identity")).not.toBeNull();
    const section = screen.getByRole("region", { name: "Histórico material" });
    expect(section.querySelector("h3")?.textContent).toBe("Histórico material");
    expect(section.querySelector("ol.prb-history-list")).not.toBeNull();
    expect(document.querySelector(RETIRED_PROBLEM_VIEW)).toBeNull();
  });

  it("focuses the PRB title heading once the record has loaded", async () => {
    render(<ProblemHistoryView {...props} problemId="PRB-0003" />);
    const title = await screen.findByRole("heading", { level: 2, name: "Tráfego e estacionamento" });
    await waitFor(() => expect(document.activeElement).toBe(title));
  });

  it("renders the shared identity hero from canonical title, problem_statement, topics and updated_at", async () => {
    render(<ProblemHistoryView {...props} problemId="PRB-0003" />);
    const hero = (await screen.findByRole("heading", { level: 2, name: "Tráfego e estacionamento" })).closest("header") as HTMLElement;
    expect(within(hero).getByText("Problema em investigação")).toBeTruthy();
    expect(within(hero).getByText("Declaração canónica do problema.")).toBeTruthy();
    expect(within(hero).getByLabelText("Temas").textContent).toBe("Mobilidade·Urbanismo·Acessibilidade");
    const updated = hero.querySelector(".prb-identity-updated");
    expect(updated?.textContent).toContain("Atualizado em");
    expect(updated?.querySelector("time")?.getAttribute("dateTime")).toBe("2026-09-25");
  });

  it("presents updated_at only as record-edit metadata — never as a history entry", async () => {
    render(<ProblemHistoryView {...props} problemId="PRB-0001" />);
    await screen.findByText("Não existe histórico material registado para este problema.");
    const times = Array.from(document.querySelectorAll("time"));
    expect(times).toHaveLength(1);
    expect(times[0].closest(".prb-identity-updated")).not.toBeNull();
    expect(document.querySelector(".prb-history-entry")).toBeNull();
  });
});

describe("ProblemHistoryView — shared PRB header", () => {
  it("renders Detalhes|Histórico as navigation with Histórico current, and Detalhes keeps the PRB identity", async () => {
    const onViewAsProblem = vi.fn();
    render(<ProblemHistoryView {...props} problemId="PRB-0001" onViewAsProblem={onViewAsProblem} />);
    const nav = await screen.findByRole("navigation", { name: "Vistas do problema" });
    expect(nav.textContent).toBe("DetalhesHistórico");
    expect(within(nav).getByText("Histórico").getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("tablist")).toBeNull();
    fireEvent.click(within(nav).getByRole("button", { name: "Detalhes" }));
    expect(onViewAsProblem).toHaveBeenCalledWith("PRB-0001");
  });

  it("routes Verificar to the same PRB's Detalhes audit section instead of a dead local anchor", async () => {
    const onVerifyInDetails = vi.fn();
    render(<ProblemHistoryView {...props} problemId="PRB-0001" onVerifyInDetails={onVerifyInDetails} />);
    const verify = await screen.findByRole("button", { name: "Verificar" });
    expect(document.querySelector('a[href="#prb-auditoria"]')).toBeNull();
    expect(document.getElementById("prb-auditoria")).toBeNull();
    fireEvent.click(verify);
    expect(onVerifyInDetails).toHaveBeenCalledWith("PRB-0001");
  });

  it("keeps Partilhar available", async () => {
    render(<ProblemHistoryView {...props} problemId="PRB-0001" />);
    const header = (await screen.findByRole("navigation", { name: "Vistas do problema" })).closest(".prb-header") as HTMLElement;
    expect(within(header).getByRole("button", { name: "Partilhar" })).toBeTruthy();
    expect(within(header).getByText("PRB-0001")).toBeTruthy();
  });
});

describe("ProblemHistoryView — material history", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders entries newest first with exact canonical date, relative age and verbatim summary", async () => {
    render(<ProblemHistoryView {...props} problemId="PRB-0003" />);
    await screen.findByText("Terceira alteração material.");
    const rows = Array.from(document.querySelectorAll(".prb-history-entry"));
    expect(rows.map((row) => row.querySelector(".prb-history-entry-summary")?.textContent)).toEqual([
      "Terceira alteração material.",
      "Segunda alteração material.",
      "Primeira alteração material.",
    ]);
    expect(rows.map((row) => row.querySelector("time")?.getAttribute("dateTime"))).toEqual(["2026-09-25", "2026-09-16", "2026-08-31"]);
    expect(rows[0].querySelector("time")?.textContent).toBe("25/09/2026");
    expect(rows.map((row) => row.querySelector(".prb-history-entry-age")?.textContent)).toEqual(["há 1 dia", "há 10 dias", "há 26 dias"]);
    // The exact date and its relative age stay one group.
    expect(rows[0].querySelector(".prb-history-entry-date .prb-history-entry-age")).not.toBeNull();
  });

  it("omits the relative age for a date that is not yet elapsed", async () => {
    vi.setSystemTime(new Date("2026-09-20T12:00:00.000Z"));
    render(<ProblemHistoryView {...props} problemId="PRB-0003" />);
    await screen.findByText("Terceira alteração material.");
    const rows = Array.from(document.querySelectorAll(".prb-history-entry"));
    expect(rows[0].querySelector("time")?.getAttribute("dateTime")).toBe("2026-09-25");
    expect(rows[0].querySelector(".prb-history-entry-age")).toBeNull();
    expect(rows[1].querySelector(".prb-history-entry-age")?.textContent).toBe("há 4 dias");
  });

  it("summarises the canonical entry count in the intro, with singular and plural", async () => {
    const { unmount } = render(<ProblemHistoryView {...props} problemId="PRB-0003" />);
    expect((await screen.findByText(/alterações à formulação/)).textContent).toBe(
      "3 alterações à formulação, ao âmbito ou à leitura da evidência. Correções de forma não entram aqui.",
    );
    unmount();
    render(<ProblemHistoryView {...props} problemId="PRB-0010" />);
    expect((await screen.findByText(/alteração à formulação/)).textContent).toMatch(/^1 alteração à formulação/);
  });

  it("renders optional authored state changes as a secondary line", async () => {
    render(<ProblemHistoryView {...props} problemId="PRB-0002" />);
    const latest = await screen.findByText("Mudança de estado.");
    const older = screen.getByText("Entrada anterior.");
    expect(latest.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const changes = screen.getByRole("definition").closest("dl") as HTMLElement;
    expect(changes.getAttribute("aria-label")).toBe("Alterações de estado");
    expect(within(changes).getByText("Estado")).toBeTruthy();
    expect(within(changes).getByText("Aberto → Não digital")).toBeTruthy();
    expect(document.querySelectorAll(".prb-history-entry-meta")).toHaveLength(1);
  });

  it("keeps authored evidence as keyboard-reachable generic-record navigation", async () => {
    const onOpenGeneric = vi.fn();
    render(<ProblemHistoryView {...props} problemId="PRB-0010" onOpenGeneric={onOpenGeneric} />);
    await screen.findByText(/Nova evidência oficial estabeleceu uma cronologia de resposta faseada/);
    const links = ["EVD-000154", "EVD-000155", "EVD-000156"].map((id) => screen.getByRole("button", { name: `Abrir ${id}` }));
    expect(links.every((link) => link.closest(".prb-history-entry-meta"))).toBe(true);
    fireEvent.click(links[0]);
    expect(onOpenGeneric).toHaveBeenCalledWith("EVD-000154");
  });

  it("uses a neutral empty state for a Problem with no authored history", async () => {
    render(<ProblemHistoryView {...props} problemId="PRB-0001" />);
    const empty = await screen.findByText("Não existe histórico material registado para este problema.");
    expect(empty.closest("section")?.id).toBe("prb-historico");
    expect(screen.queryByText(/alteraç(ão|ões) à formulação/)).toBeNull();
    expect(document.querySelector(".prb-history-list")).toBeNull();
  });

  it("introduces no entry-type or current/in-force labels absent from canonical history", async () => {
    render(<ProblemHistoryView {...props} problemId="PRB-0003" />);
    await screen.findByText("Terceira alteração material.");
    const text = document.body.textContent ?? "";
    for (const label of ["Formulação", "Contexto", "Desafio", "EM VIGOR", "Em vigor"]) expect(text).not.toContain(label);
  });
});

describe("Public/PRB Histórico / PRB0005 story", () => {
  const composed = composeStories(stories);

  it.each(Object.entries(composed))("%s renders the real shell and canonical PRB-0005 history newest first", async (_name, Story) => {
    const { container } = render(<Story />);
    expect(container.querySelector("main.explorer-shell header.explorer-chrome")).not.toBeNull();
    expect(container.querySelector("footer.public-footer")).not.toBeNull();

    const history = (prb0005.record as { history: { date: string; summary: string }[] }).history;
    await screen.findByText(history[0].summary);
    const rendered = Array.from(container.querySelectorAll(".prb-history-entry-summary")).map((node) => node.textContent);
    expect(rendered).toEqual([...history].reverse().map((entry) => entry.summary));
  });
});
