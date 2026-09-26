import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RecordDetailPanel } from "./RecordDetailPanel";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

const index: RecordSummary[] = [
  { id: "EVD-1", type: "EVD-", label: "Evidência", file: "", summaryFields: {} },
  { id: "SRC-1", type: "SRC-", label: "Fonte", file: "", summaryFields: {} },
  { id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} },
  { id: "PRB-2", type: "PRB-", label: "Problema relacionado", file: "", summaryFields: {} },
];
const evd: RecordDetail = {
  id: "EVD-1", type: "EVD-", file: "", outgoingEdges: [{ field: "provenance.sources", ordinal: 0, to: "SRC-1" }],
  incomingEdges: [{ field: "evidence", ordinal: 0, from: "PRB-1" }],
  record: {
    observation: { summary: "Observação delimitada." },
    scope: { geography: { level: "municipality", area: "Évora" }, populations: ["pessoas residentes"], temporal: { as_of: "2026" } },
    provenance: { sources: ["SRC-1"] },
    inference_limits: ["Sem inferência adicional."],
  },
};
const records: Record<string, RecordDetail> = {
  "EVD-1": evd,
  "SRC-1": { id: "SRC-1", type: "SRC-", file: "", record: { name: "Fonte" }, outgoingEdges: [], incomingEdges: [] },
  "PRB-1": { id: "PRB-1", type: "PRB-", file: "", record: { title: "Problema", evidence: [{ evidence_id: "EVD-1", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] }] }, outgoingEdges: [], incomingEdges: [] },
  "PRB-2": { id: "PRB-2", type: "PRB-", file: "", record: { title: "Problema relacionado" }, outgoingEdges: [], incomingEdges: [] },
};
const provider: DataProvider = { getManifest: async () => { throw Error("unused"); }, listRecords: async () => index, getEdges: async () => [], getRecord: async (id) => records[id] };
const lookup = new Map(index.map((item) => [item.id, item]));
const renderDetail = (detail = evd, onSelect = vi.fn(), onViewAsProblem = vi.fn(), selectedId = "EVD-1") => {
  const fixture: DataProvider = { ...provider, getRecord: async (id) => id === selectedId ? detail : records[id] };
  render(<RecordDetailPanel dataProvider={fixture} lookup={lookup} selectedId={selectedId} onBackToRecords={vi.fn()} onSelect={onSelect} onViewAsProblem={onViewAsProblem} onViewInGraph={vi.fn()} />);
  return { onSelect, onViewAsProblem };
};

describe("RecordDetailPanel vNext", () => {
  it("renders EVD as its own public page, without the generic reading rail", async () => {
    renderDetail();
    expect(await screen.findByRole("heading", { level: 1, name: "Observação delimitada." })).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Mais ações" })).toBeNull();
    expect(document.querySelector(".detail-rail-file")).toBeNull();
  });

  it("renders bounded observation, scope, inference limits and provenance", async () => {
    renderDetail();
    expect((await screen.findAllByText("Observação delimitada.")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Évora").length).toBeGreaterThan(0);
    expect(screen.getAllByText("pessoas residentes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sem inferência adicional.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Abrir fonte SRC-1" })).toBeTruthy();
  });

  it("navigates to the resolved Source, and routes 'Ver Problema' to the Problem experience, not technical Detail (ODM-019)", async () => {
    const { onSelect, onViewAsProblem } = renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir fonte SRC-1" }));
    expect(onSelect).toHaveBeenCalledWith("SRC-1");

    fireEvent.click(await screen.findByRole("button", { name: "Ver problema PRB-1" }));
    expect(onViewAsProblem).toHaveBeenCalledWith("PRB-1");
    expect(onSelect).not.toHaveBeenCalledWith("PRB-1");
  });

  it("omits absent optional vNext fields without fabricating a value", async () => {
    const sparse: RecordDetail = { ...evd, record: { observation: { summary: "Só observação." }, provenance: { sources: ["SRC-1"] } } };
    renderDetail(sparse);
    expect((await screen.findAllByText("Só observação.")).length).toBeGreaterThan(0);
    expect(screen.queryByText("pessoas residentes")).toBeNull();
    expect(screen.queryByText("Sem inferência adicional.")).toBeNull();
  });

  it("omits the PRB corpus-relations section when no incoming records exist", async () => {
    renderDetail(records["PRB-1"], vi.fn(), vi.fn(), "PRB-1");
    await screen.findByText("Estrutura técnica completa");
    expect(screen.queryByText("Relações no corpus")).toBeNull();
    expect(screen.queryByText("← Referenciado por")).toBeNull();
  });

  it("renders deduplicated incoming PRB relations and preserves their navigation target", async () => {
    const prbWithDuplicateIncomingPaths: RecordDetail = {
      ...records["PRB-1"],
      incomingEdges: [
        { field: "decision_basis.overlap_check.related_problems", ordinal: 0, from: "PRB-2" },
        { field: "decision_basis.overlap_check.related_problems", ordinal: 1, from: "PRB-2" },
      ],
    };
    const onSelect = vi.fn();
    renderDetail(prbWithDuplicateIncomingPaths, onSelect, vi.fn(), "PRB-1");

    expect(await screen.findByText("Relações no corpus")).toBeTruthy();
    expect(screen.getByText("← Referenciado por")).toBeTruthy();
    expect(screen.getByText("Problema relacionado")).toBeTruthy();
    const relatedButton = screen.getByRole("button", { name: "Abrir PRB-2" });
    fireEvent.click(relatedButton);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("PRB-2");
  });
});

describe("RecordDetailPanel — initial deep-link fragment (ODM-016A)", () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("re-applies a fragment present at initial load once the async detail content mounts", async () => {
    window.location.hash = "#evd-limits";
    renderDetail();

    const section = await waitFor(() => {
      const el = document.getElementById("evd-limits");
      if (!el) throw new Error("evd-limits section not yet mounted");
      return el;
    });
    expect(scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(section);
  });
});

describe("RecordDetailPanel DS-05I — EmptyState adoption", () => {
  it("renders EmptyState with the exact copy when a generic (non-PRB/SRC/EVD) record has zero related-record relations", async () => {
    const zeroRelations: RecordDetail = { id: "WID-1", type: "WID-", file: "", outgoingEdges: [], incomingEdges: [], record: { name: "Widget isolado." } };
    renderDetail(zeroRelations, vi.fn(), vi.fn(), "WID-1");
    const message = await screen.findByText("Nenhum registo relacionado.");
    expect(message.className).toBe("ui-empty-state-message");
  });

  it("renders EmptyState with the exact copy when a PRB record has zero derived canonical references", async () => {
    const prbNoReferences: RecordDetail = { id: "PRB-1", type: "PRB-", file: "", record: { title: "Problema" }, outgoingEdges: [], incomingEdges: [] };
    renderDetail(prbNoReferences, vi.fn(), vi.fn(), "PRB-1");
    const message = await screen.findByText("Nenhuma referência canónica registada.");
    expect(message.className).toBe("ui-empty-state-message");
  });

  it("offers PRB technical inspection one explicit 'Ver página do problema' action instead of PRB-local navigation", async () => {
    const { onViewAsProblem } = renderDetail(records["PRB-1"], vi.fn(), vi.fn(), "PRB-1");
    const action = await screen.findByRole("button", { name: "Ver página do problema" });
    expect(screen.queryByRole("navigation", { name: "Vistas do problema" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Histórico" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Detalhes" })).toBeNull();
    fireEvent.click(action);
    expect(onViewAsProblem).toHaveBeenCalledWith("PRB-1");
  });

  it("does not offer 'Ver página do problema' for a non-PRB record", async () => {
    renderDetail();
    await screen.findByRole("heading", { level: 1, name: "Observação delimitada." });
    expect(screen.queryByRole("button", { name: "Ver página do problema" })).toBeNull();
  });

  it("keeps a missing PRB inspector value as field-empty, not EmptyState", async () => {
    renderDetail(records["PRB-1"], vi.fn(), vi.fn(), "PRB-1");
    const values = await screen.findAllByText("Não registado");
    expect(values.length).toBeGreaterThan(0);
    values.forEach((value) => expect(value.className).toBe("field-empty"));
  });

  it("keeps a missing record title/meaning as non-EmptyState field-empty copy", async () => {
    const noMeaning: RecordDetail = { id: "WID-1", type: "WID-", file: "", record: {}, outgoingEdges: [], incomingEdges: [] };
    renderDetail(noMeaning, vi.fn(), vi.fn(), "WID-1");
    const meaning = await screen.findByText("WID-1 — sem campo de significado canónico identificado para este tipo de registo.");
    expect(meaning.className).toContain("field-empty");
  });
});

describe("RecordDetailPanel — SRC public page and relation authority", () => {
  const src: RecordDetail = {
    id: "SRC-1",
    type: "SRC-",
    file: "research/sources/SRC-1.yaml",
    outgoingEdges: [],
    incomingEdges: [{ field: "provenance.sources", ordinal: 0, from: "EVD-1" }],
    record: {
      name: "Fonte mínima",
      resource_type: "webpage",
      scope: { geography: { level: "non_geographic" }, domains: ["DIG"] },
      access: { level: "unknown", availability: "unknown", machine_readable: "unknown" },
      acquisition: { method: "unknown" },
      licensing: { status: "unknown", reuse: "unknown" },
      temporal: { last_checked_at: "2026-08-25" },
    },
  };

  it("renders SRC as its own public page, without the generic reading rail or section index", async () => {
    renderDetail(src, vi.fn(), vi.fn(), "SRC-1");
    expect(await screen.findByRole("heading", { level: 1, name: "Fonte mínima" })).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Mais ações" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Nesta fonte" })).toBeNull();
  });

  it("loads SRC → EVD → PRB once through the provider and shares it between the summary, the Observações cell, findings and Na investigação", async () => {
    renderDetail(src, vi.fn(), vi.fn(), "SRC-1");
    const investigation = await screen.findByRole("region", { name: "Na investigação" });
    expect(within(investigation).getByRole("button", { name: "Ver problema PRB-1" })).toBeTruthy();
    expect(within(investigation).getByText("EVD-1")).toBeTruthy();
    expect(document.querySelector(".src-meta-cell--usage dd")?.textContent).toBe("1 · 1 problema");
    expect(screen.getByText("A Open Évora extraiu desta fonte 1 observação, usada em 1 problema.")).toBeTruthy();
    const findings = screen.getByRole("region", { name: "O que encontrámos" });
    expect(within(findings).getByText("Observação delimitada.")).toBeTruthy();
  });
});

describe("RecordDetailPanel — EVD Problem-use relation authority", () => {
  it("loads the EVD's Problem uses through the provider and shares them between the metadata count and Como é usada", async () => {
    renderDetail();
    const uses = await screen.findByRole("region", { name: "Como é usada" });
    expect(await within(uses).findByRole("button", { name: "Problema" })).toBeTruthy();
    const problemsCell = document.querySelector(".evd-meta-cell--problems dd");
    expect(problemsCell?.textContent).toBe("1");
  });

  it("omits the limits section when inference_limits is empty", async () => {
    const noLimits: RecordDetail = { ...evd, record: { ...evd.record, inference_limits: [] } };
    renderDetail(noLimits);
    await screen.findByRole("region", { name: "Como é usada" });
    expect(screen.queryByRole("region", { name: "O que não permite concluir" })).toBeNull();
  });
});
