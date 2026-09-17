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
  it("renders both Validação and Evidência when both are canonically present", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema com ambas as dimensões", file: "", summaryFields: { validation_status: "unvalidated", evidence_status: "corroborated" } },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const caption = await screen.findByText("Validação:");
    const row = caption.closest(".overview-statuses");
    expect(row?.textContent).toMatch(/Validação:\s*Por validar/);
    expect(row?.textContent).toMatch(/Evidência:\s*Corroborada/);
  });

  it("omits only the evidence dimension when evidence_status is null", async () => {
    const provider = makeProvider([
      { id: "PRB-2", type: "PRB-", label: "Problema sem evidência", file: "", summaryFields: { validation_status: "unvalidated" } },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const caption = await screen.findByText("Validação:");
    const row = caption.closest(".overview-statuses");
    expect(row?.textContent).toMatch(/Validação:\s*Por validar/);
    expect(screen.queryByText("Evidência:")).toBeNull();
  });

  it("omits only the validation dimension when validation_status is null", async () => {
    const provider = makeProvider([
      { id: "PRB-3", type: "PRB-", label: "Problema sem validação", file: "", summaryFields: { evidence_status: "corroborated" } },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const caption = await screen.findByText("Evidência:");
    const row = caption.closest(".overview-statuses");
    expect(row?.textContent).toMatch(/Evidência:\s*Corroborada/);
    expect(screen.queryByText("Validação:")).toBeNull();
  });

  it("omits the whole status row when both dimensions are null", async () => {
    const provider = makeProvider([
      { id: "PRB-4", type: "PRB-", label: "Problema sem dimensões", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("PRB-4");
    expect(screen.queryByText("Validação:")).toBeNull();
    expect(screen.queryByText("Evidência:")).toBeNull();
    expect(document.querySelector(".overview-statuses")).toBeNull();
  });
});

describe("Overview — WU054 delta: ordering transparency, search control, topic-filter order", () => {
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
