import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Overview } from "./Overview";
import { DataLoadError, type DataProvider, type RecordDetail, type RecordSummary } from "../dataProvider/types";

function makeProvider(index: RecordSummary[]): DataProvider {
  const details: Record<string, RecordDetail> = Object.fromEntries(
    index.map((summary) => [
      summary.id,
      {
        id: summary.id,
        type: summary.type,
        file: summary.file,
        record: {
          title: summary.label,
          status: summary.summaryFields.status,
          validation_status: summary.summaryFields.validation_status,
          evidence_status: summary.summaryFields.evidence_status,
        },
        outgoingEdges: [],
        incomingEdges: [],
      },
    ])
  );
  return {
    getManifest: async () => { throw new Error("unused"); },
    listRecords: async () => index,
    getEdges: async () => [],
    getRecord: async (id) => details[id],
  };
}

const props = { onExploreProblem: vi.fn(), onViewRecords: vi.fn() };

describe("Overview — Problem investigation-state dimensions", () => {
  it("renders lifecycle, validation, and evidence separately when all are canonically present", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema com todas as dimensões", file: "", summaryFields: { status: "OPEN", validation_status: "unvalidated", evidence_status: "corroborated" } },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const caption = await screen.findByText("Estado do problema");
    const row = caption.closest(".overview-statuses");
    expect(row?.textContent).toMatch(/Estado do problema\s*Aberto/);
    expect(row?.textContent).toMatch(/Validação:\s*Por validar/);
    expect(row?.textContent).toMatch(/Evidência:\s*Corroborada/);
    expect(row?.textContent).not.toMatch(/Estado da investigação/);
    expect(row?.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it("omits only the lifecycle dimension when status is null", async () => {
    const provider = makeProvider([
      { id: "PRB-2", type: "PRB-", label: "Problema sem estado de ciclo de vida", file: "", summaryFields: { validation_status: "unvalidated", evidence_status: "corroborated" } },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const caption = await screen.findByText("Validação:");
    const row = caption.closest(".overview-statuses");
    expect(row?.textContent).toMatch(/Validação:\s*Por validar/);
    expect(row?.textContent).toMatch(/Evidência:\s*Corroborada/);
    expect(screen.queryByText("Estado do problema")).toBeNull();
    expect(row?.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it("omits only the validation dimension when validation_status is null", async () => {
    const provider = makeProvider([
      { id: "PRB-3", type: "PRB-", label: "Problema sem validação", file: "", summaryFields: { status: "OPEN", evidence_status: "corroborated" } },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const caption = await screen.findByText("Estado do problema");
    const row = caption.closest(".overview-statuses");
    expect(row?.textContent).toMatch(/Estado do problema\s*Aberto/);
    expect(row?.textContent).toMatch(/Evidência:\s*Corroborada/);
    expect(screen.queryByText("Validação:")).toBeNull();
    expect(row?.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it("omits only the evidence dimension when evidence_status is null", async () => {
    const provider = makeProvider([
      { id: "PRB-4", type: "PRB-", label: "Problema sem evidência", file: "", summaryFields: { status: "OPEN", validation_status: "unvalidated" } },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const caption = await screen.findByText("Estado do problema");
    const row = caption.closest(".overview-statuses");
    expect(row?.textContent).toMatch(/Estado do problema\s*Aberto/);
    expect(row?.textContent).toMatch(/Validação:\s*Por validar/);
    expect(screen.queryByText("Evidência:")).toBeNull();
    expect(row?.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it("omits the whole status row when all dimensions are null", async () => {
    const provider = makeProvider([
      { id: "PRB-4", type: "PRB-", label: "Problema sem dimensões", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("PRB-4");
    expect(screen.queryByText("Estado do problema")).toBeNull();
    expect(screen.queryByText("Validação:")).toBeNull();
    expect(screen.queryByText("Evidência:")).toBeNull();
    expect(document.querySelector(".overview-statuses")).toBeNull();
  });
});

describe("Overview — Problem ordering transparency and citizen discovery controls", () => {
  it("shows the ordering transparency note, distinct from the corpus-coverage caveat", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    expect(screen.getByText("Ordenados por identificador — a ordem não representa prioridade ou relevância.")).toBeTruthy();
    expect(screen.getByText(/Não constituem um inventário completo/)).toBeTruthy();
  });

  it("labels the citizen search control per the approved copy", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const input = (await screen.findByLabelText("Pesquisar problemas")) as HTMLInputElement;
    expect(input.placeholder).toBe("Pesquisar problemas em Évora…");
  });

  it("orders topic filters alphabetically by PT-PT label, with Todos first", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de economia", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema digital", file: "", summaryFields: {} },
    ]);
    const detailsProvider: DataProvider = {
      ...provider,
      getRecord: async (id) =>
        id === "PRB-1"
          ? { id, type: "PRB-", file: "", record: { title: "Problema de economia", domain: ["ECO"] }, outgoingEdges: [], incomingEdges: [] }
          : { id, type: "PRB-", file: "", record: { title: "Problema digital", domain: ["DIG"] }, outgoingEdges: [], incomingEdges: [] },
    };
    render(<Overview dataProvider={detailsProvider} {...props} />);

    const group = await screen.findByRole("group", { name: "Filtrar por tema" });
    const labels = within(group).getAllByRole("button").map((button) => button.textContent);
    // Digital before Economia alphabetically, and Todos always leads.
    expect(labels).toEqual(["Todos", "Digital", "Economia"]);
  });

  it("marks the active topic filter with aria-pressed, exclusively", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de economia", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema digital", file: "", summaryFields: {} },
    ]);
    const detailsProvider: DataProvider = {
      ...provider,
      getRecord: async (id) =>
        id === "PRB-1"
          ? { id, type: "PRB-", file: "", record: { title: "Problema de economia", domain: ["ECO"] }, outgoingEdges: [], incomingEdges: [] }
          : { id, type: "PRB-", file: "", record: { title: "Problema digital", domain: ["DIG"] }, outgoingEdges: [], incomingEdges: [] },
    };
    const user = userEvent.setup();
    render(<Overview dataProvider={detailsProvider} {...props} />);

    const group = await screen.findByRole("group", { name: "Filtrar por tema" });
    const todos = within(group).getByRole("button", { name: "Todos" });
    const digital = within(group).getByRole("button", { name: "Digital" });
    expect(todos.getAttribute("aria-pressed")).toBe("true");
    expect(digital.getAttribute("aria-pressed")).toBe("false");

    await user.click(digital);

    expect(todos.getAttribute("aria-pressed")).toBe("false");
    expect(digital.getAttribute("aria-pressed")).toBe("true");
  });

  it("announces the result-count and empty-state meaning through a polite live region as search/filter state changes", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema digital", file: "", summaryFields: {} },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    const resultsCount = await screen.findByText("2 de 2 problemas");
    const liveRegion = resultsCount.closest('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute("aria-atomic")).toBe("true");

    const input = screen.getByLabelText("Pesquisar problemas");
    await user.type(input, "inexistente");

    const emptyState = await within(liveRegion as HTMLElement).findByText(
      "Nenhum problema corresponde à pesquisa ou ao filtro selecionado."
    );
    expect(emptyState.closest('[aria-live="polite"]')).toBe(liveRegion);
  });

  it("keeps Problem cards outside the atomic result announcement and names their actions by title", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema digital", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const firstAction = await screen.findByRole("button", { name: "Explorar Problema de mobilidade" });
    expect(screen.getByRole("button", { name: "Explorar Problema digital" })).toBeTruthy();
    expect(firstAction.textContent).toBe("Explorar →");
    expect(firstAction.closest('[aria-live="polite"]')).toBeNull();
  });
});

describe("Overview — error state retry (ODM-021)", () => {
  it("retries a failed listRecords load and recovers", async () => {
    let attempts = 0;
    const provider: DataProvider = {
      getManifest: async () => { throw new Error("unused"); },
      listRecords: () =>
        attempts++ === 0
          ? Promise.reject(new DataLoadError("falha temporária", "network"))
          : Promise.resolve([{ id: "PRB-9", type: "PRB-", label: "Problema recuperado", file: "", summaryFields: {} }]),
      getEdges: async () => [],
      getRecord: async (id) => ({ id, type: "PRB-", file: "", record: { title: "Problema recuperado" }, outgoingEdges: [], incomingEdges: [] }),
    };
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("falha temporária");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByText("PRB-9");
    expect(attempts).toBe(2);
  });
});

describe("Overview — material-change timeline", () => {
  it("renders the neutral no-history state only after every Problem detail loads", async () => {
    render(<Overview dataProvider={makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }])} {...props} />);

    expect(await screen.findByText("Ainda não existem alterações materiais registadas para apresentar.")).toBeTruthy();
    expect(screen.queryByText(/nunca mudou/i)).toBeNull();
  });

  it("does not present missing detail reads as a no-history result", async () => {
    const provider: DataProvider = {
      ...makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema indisponível", file: "", summaryFields: {} }]),
      getRecord: async () => { throw new DataLoadError("detalhe indisponível", "network"); },
    };
    render(<Overview dataProvider={provider} {...props} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar todo o histórico material");
    expect(screen.queryByText("Ainda não existem alterações materiais registadas para apresentar.")).toBeNull();
  });

  it("marks a timeline from partially loaded Problems as incomplete", async () => {
    const provider: DataProvider = {
      ...makeProvider([
        { id: "PRB-1", type: "PRB-", label: "Problema carregado", file: "", summaryFields: {} },
        { id: "PRB-2", type: "PRB-", label: "Problema indisponível", file: "", summaryFields: {} },
      ]),
      getRecord: async (id) => {
        if (id === "PRB-2") throw new DataLoadError("detalhe indisponível", "network");
        return { id, type: "PRB-", file: "", record: { title: "Problema carregado", history: [{ date: "2026-04-08", summary: "Alteração carregada." }] }, outgoingEdges: [], incomingEdges: [] };
      },
    };
    render(<Overview dataProvider={provider} {...props} />);

    expect((await screen.findByRole("alert")).textContent).toContain("podem estar incompletas");
    expect(screen.getByText("Alteração carregada.")).toBeTruthy();
    expect(screen.queryByText("Ainda não existem alterações materiais registadas para apresentar.")).toBeNull();
  });

  it("renders authored history and opens its owning Problem", async () => {
    const onExploreProblem = vi.fn();
    const provider: DataProvider = {
      ...makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema do histórico", file: "", summaryFields: {} }]),
      getRecord: async (id) => ({ id, type: "PRB-", file: "", record: { title: "Problema do histórico", updated_at: "2099-12-31", history: [{ date: "2026-04-08", summary: "Alteração material redigida." }] }, outgoingEdges: [], incomingEdges: [] }),
    };
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} onExploreProblem={onExploreProblem} onViewRecords={vi.fn()} />);

    const date = await screen.findByText("08/04/2026");
    expect(date.tagName).toBe("TIME");
    expect(screen.getByText("Alteração material redigida.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Abrir problema Problema do histórico" }));
    expect(onExploreProblem).toHaveBeenCalledWith("PRB-1");
  });
});
