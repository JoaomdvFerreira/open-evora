import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Overview } from "./Overview";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

function makeProvider(index: RecordSummary[]): DataProvider {
  const details: Record<string, RecordDetail> = Object.fromEntries(
    index.map((summary) => [summary.id, { id: summary.id, type: summary.type, file: summary.file, record: { title: summary.label }, outgoingEdges: [], incomingEdges: [] }])
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
