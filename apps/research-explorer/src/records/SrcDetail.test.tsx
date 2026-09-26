import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SRC_AUDIT_ANCHOR_ID, SrcDetail } from "./SrcDetail";
import type { RecordDetail, RecordSummary } from "../dataProvider/types";
import { DataLoadError } from "../dataProvider/types";
import type { SourceEvidenceRelations, SourceRelatedProblem } from "./sourceEvidenceRelations";
import type { SourceEvidenceRelationsState } from "./useSourceEvidenceRelations";

const GENERATED = path.resolve(__dirname, "..", "..", "generated");
const hasGeneratedData = fs.existsSync(path.join(GENERATED, "record-detail"));
const detail = (id: string): RecordDetail => JSON.parse(fs.readFileSync(path.join(GENERATED, "record-detail", `${id}.json`), "utf8"));
const corpusLookup = (): Map<string, RecordSummary> =>
  new Map((JSON.parse(fs.readFileSync(path.join(GENERATED, "index.json"), "utf8")) as RecordSummary[]).map((summary) => [summary.id, summary]));

type RelationsState = SourceEvidenceRelationsState & { retry: () => void };
const ready = (relations: SourceEvidenceRelations): RelationsState => ({ status: "ready", relations, retry: vi.fn() });

/** Resolves a Source's relation set from the generated read model, the way `loadSourceEvidenceRelations` does. */
function corpusRelations(sourceId: string): SourceEvidenceRelations {
  const evidenceIds = [...new Set(detail(sourceId).incomingEdges.filter((edge) => edge.field === "provenance.sources").map((edge) => edge.from!))];
  const evidence = evidenceIds.map(detail);
  const problems = new Map<string, SourceRelatedProblem>();
  for (const item of evidence) {
    for (const problemId of new Set(item.incomingEdges.filter((edge) => edge.field === "evidence").map((edge) => edge.from!))) {
      const existing = problems.get(problemId);
      if (existing) existing.viaEvidenceIds.push(item.id);
      else problems.set(problemId, { problemId, viaEvidenceIds: [item.id] });
    }
  }
  const relatedProblems = [...problems.values()];
  const problemDomainCodes = Object.fromEntries(relatedProblems.map(({ problemId }) => [problemId, (detail(problemId).record.domain as string[] | undefined) ?? []]));
  return { evidence, uniqueEvidenceCount: evidenceIds.length, relatedProblems, problemDomainCodes };
}

function renderSrc(item: RecordDetail, overrides: Partial<{ relations: RelationsState; lookup: Map<string, RecordSummary>; onSelect: (id: string) => void; onViewAsProblem: (id: string) => void; onBackToRecords: () => void }> = {}) {
  const props = {
    relations: overrides.relations ?? ready(corpusRelations(item.id)),
    lookup: overrides.lookup ?? corpusLookup(),
    onSelect: vi.fn(),
    onViewAsProblem: vi.fn(),
    onBackToRecords: vi.fn(),
    ...overrides,
  };
  const view = render(<SrcDetail detail={item} {...props} />);
  return { ...view, ...props };
}

/** The six public metadata facts, as rendered label → value pairs. */
function metadata(container: HTMLElement): Record<string, string> {
  return Object.fromEntries(Array.from(container.querySelectorAll(".src-meta-cell")).map((cell) => [cell.querySelector("dt")!.textContent, cell.querySelector("dd")!.textContent]));
}

const auditRegion = () => screen.getByRole("region", { name: "Acesso e auditoria" });

describe.skipIf(!hasGeneratedData)("SRC Detail — canonical regression cases", () => {
  it("SRC-0002 renders its identity hero from canonical fields and a relation-derived summary", () => {
    renderSrc(detail("SRC-0002"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Plano de Desenvolvimento Social de Évora 2024-2027");
    expect(screen.getByText("Fonte · Documento")).toBeTruthy();
    expect(screen.getByText("Município de Évora / Rede Social")).toBeTruthy();
    const checked = screen.getByText(/^Verificada em/);
    expect(checked.textContent).toBe("Verificada em 10 ago 2026");
    expect(checked.querySelector("time")?.dateTime).toBe("2026-08-10");
    expect(screen.getByText("A Open Évora extraiu desta fonte 7 observações, usadas em 5 problemas em investigação.")).toBeTruthy();
  });

  it("SRC-0002 maps the six public metadata facts from canonical data and the one relation state", () => {
    const { container } = renderSrc(detail("SRC-0002"));
    expect(metadata(container)).toEqual({
      Onde: "Município de Évora",
      Período: "2024–2027",
      Temas: "8 temas",
      Acesso: "Público · PDF",
      Reutilização: "Desconhecida",
      Observações: "7 · 5 problemas",
    });
  });

  it("SRC-0002 lists every citing observation with its scope, other Sources and the Problems that use it", () => {
    const { onSelect, onViewAsProblem } = renderSrc(detail("SRC-0002"));
    const findings = screen.getByRole("region", { name: "O que encontrámos" });
    expect(within(findings).getByText("7 observações")).toBeTruthy();
    const items = findings.querySelectorAll(".src-finding");
    expect(items).toHaveLength(7);

    const first = items[0] as HTMLElement;
    expect(within(first).getByText("Mobilidade")).toBeTruthy();
    expect(within(first).getByText((detail("EVD-000001").record.observation as { summary: string }).summary)).toBeTruthy();
    expect(within(first).queryByText("Também em")).toBeNull();
    fireEvent.click(within(first).getByRole("button", { name: "Abrir EVD-000001" }));
    fireEvent.click(within(first).getByRole("button", { name: "Ver problema PRB-0001" }));
    expect(onSelect).toHaveBeenCalledWith("EVD-000001");
    expect(onViewAsProblem).toHaveBeenCalledWith("PRB-0001");

    // "Também em" names only the other canonical Sources, never this one.
    const shared = Array.from(items).find((item) => item.textContent?.includes("EVD-000033")) as HTMLElement;
    const also = within(shared).getByText("Também em").nextElementSibling!;
    expect(also.textContent).not.toContain("SRC-0002");
    expect(also.textContent).toContain("SRC-0029");
  });

  it("SRC-0002 groups Problems once each, with every EVD that connects them", () => {
    const { onViewAsProblem } = renderSrc(detail("SRC-0002"));
    const investigation = screen.getByRole("region", { name: "Na investigação" });
    const rows = investigation.querySelectorAll(".src-problem");
    expect(Array.from(rows).map((row) => row.querySelector(".rec-identifier")?.textContent)).toEqual(["PRB-0001", "PRB-0003", "PRB-0006", "PRB-0007", "PRB-0008"]);
    const housing = Array.from(rows).find((row) => row.textContent?.includes("PRB-0006")) as HTMLElement;
    expect(housing.querySelector(".src-problem-via")?.textContent).toBe("através de EVD-000031, EVD-000033");
    fireEvent.click(within(housing).getByRole("button", { name: "Habitação · Social · Educação" }));
    expect(onViewAsProblem).toHaveBeenCalledWith("PRB-0006");
  });

  it("SRC-0002 labels each Problem by its canonical domains' shared topic labels, never the truncated index title", () => {
    renderSrc(detail("SRC-0002"));
    const rows = screen.getByRole("region", { name: "Na investigação" }).querySelectorAll(".src-problem");
    const labels = Array.from(rows).map((row) => row.querySelector(".src-problem-title")?.textContent);
    expect(labels).toEqual(["Mobilidade", "Acessibilidade · Mobilidade · Urbanismo", "Habitação · Social · Educação", "Social · Saúde", "Emprego · Educação · Economia"]);
    for (const label of labels) expect(label).not.toContain("…");
  });

  it("falls back to the index Problem label when no canonical domain is available", () => {
    const evidence: RecordDetail = { id: "EVD-1", type: "EVD-", file: "", outgoingEdges: [], incomingEdges: [], record: { observation: { summary: "Obs." } } };
    const relations = ready({ evidence: [evidence], uniqueEvidenceCount: 1, relatedProblems: [{ problemId: "PRB-1", viaEvidenceIds: ["EVD-1"] }], problemDomainCodes: { "PRB-1": [] } });
    const lookup = new Map<string, RecordSummary>([["PRB-1", { id: "PRB-1", type: "PRB-", label: "Título do problema", file: "", summaryFields: {} }]]);
    renderSrc(detail("SRC-0002"), { lookup, relations });
    const row = screen.getByRole("region", { name: "Na investigação" }).querySelector(".src-problem") as HTMLElement;
    expect(row.querySelector(".src-problem-title")?.textContent).toBe("Título do problema");
    expect(row.querySelector(".src-problem-via")?.textContent).toBe("através de EVD-1");
  });

  it("SRC-0002 renders its caveat as a numbered limit and its domains as topics", () => {
    renderSrc(detail("SRC-0002"));
    const caveats = screen.getByRole("region", { name: "Limitações" });
    expect(within(caveats).getByText("1 limite registado")).toBeTruthy();
    expect(within(caveats).getByText("Limite 1")).toBeTruthy();
    const topics = screen.getByRole("region", { name: "Temas" });
    expect(within(topics).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Mobilidade", "Acessibilidade", "Social", "Habitação", "Saúde", "Emprego", "Economia", "Educação"]);
  });

  it("SRC-0002 audit band states access and unknown reuse without inferring a publisher declaration", () => {
    renderSrc(detail("SRC-0002"));
    const audit = auditRegion();
    expect(audit.id).toBe(SRC_AUDIT_ANCHOR_ID);
    expect(within(audit).getByRole("heading", { name: "Consultar o documento" })).toBeTruthy();
    expect(within(audit).getByText(/^A fonte é pública/).textContent).toBe("A fonte é pública e está disponível para transferência. Os direitos de reutilização não são conhecidos.");
    const facts = Object.fromEntries(Array.from(audit.querySelectorAll(".src-audit-facts > div")).map((row) => [row.querySelector("dt")!.textContent, row.querySelector("dd")!.textContent]));
    expect(facts).toEqual({
      Publicação: "janeiro de 2024",
      "Última verificação": "10 de agosto de 2026",
      Disponibilidade: "Disponível · Público",
      Consulta: "Transferência · PDF · sem leitura automática",
      Endereço: "cm-evora.pt/wp-content/uploads/2024/01/PDS-Evora_FINAL_VF.pdf",
    });
    expect(within(audit).getByRole("link", { name: "cm-evora.pt/wp-content/uploads/2024/01/PDS-Evora_FINAL_VF.pdf" }).getAttribute("href")).toBe("https://www.cm-evora.pt/wp-content/uploads/2024/01/PDS-Evora_FINAL_VF.pdf");
    expect(within(audit).getByText("Estado desconhecido.").closest("p")!.textContent).toBe("Estado desconhecido. Pode ser lida e citada; a reutilização do conteúdo requer confirmação junto do editor.");
    expect(within(audit).getByRole("link", { name: "Ler o método →" }).getAttribute("href")).toBe("/methodology");
  });

  it("SRC-0002 offers the original document in the header and audit band, and its canonical YAML as a same-origin download", () => {
    renderSrc(detail("SRC-0002"));
    const original = "https://www.cm-evora.pt/wp-content/uploads/2024/01/PDS-Evora_FINAL_VF.pdf";
    expect(screen.getByRole("link", { name: "Abrir fonte original (abre numa nova janela)" }).getAttribute("href")).toBe(original);
    expect(within(auditRegion()).getByRole("link", { name: /^Abrir fonte/ }).getAttribute("href")).toBe(original);
    expect(screen.getByRole("link", { name: "Verificar esta fonte" }).getAttribute("href")).toBe(`#${SRC_AUDIT_ANCHOR_ID}`);
    const download = within(auditRegion()).getByRole("link", { name: /Descarregar YAML/ });
    expect(download.getAttribute("href")).toBe("/canonical/research/sources/SRC-0002.yaml");
    expect(download.getAttribute("download")).toBe("SRC-0002.yaml");
    expect(within(auditRegion()).getByText("research/sources/SRC-0002.yaml")).toBeTruthy();
    expect(screen.queryByText(/linhagem/)).toBeNull();
  });

  it("SRC-0093 presents known licensing verbatim, with its attribution and permitted reuse", () => {
    const { container } = renderSrc(detail("SRC-0093"));
    expect(metadata(container).Reutilização).toBe("Permitida");
    expect(container.querySelector(".src-reuse--attention")).toBeNull();
    const licensing = within(auditRegion()).getByText("CC BY 4.0.").closest("p")!;
    expect(licensing.textContent).toBe("CC BY 4.0. A reutilização do conteúdo é permitida. Atribuição: Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari e Anne Goodchild");
  });

  it("SRC-0120 reads its as_of coverage as a single date", () => {
    const { container } = renderSrc(detail("SRC-0120"));
    expect(metadata(container)).toMatchObject({ Onde: "Município de Évora", Data: "19 de fevereiro de 2026" });
  });

  it("SRC-0130, private correspondence without a canonical reference, offers no external action and never calls itself public", () => {
    renderSrc(detail("SRC-0130"));
    expect(screen.getByText("Fonte · Correspondência")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
    const audit = auditRegion();
    expect(within(audit).getByRole("heading", { name: "Consultar a fonte" })).toBeTruthy();
    expect(within(audit).getByText(/^A fonte é privada/)).toBeTruthy();
    expect(within(audit).getByText("Estado desconhecido.").closest("p")!.textContent).toBe("Estado desconhecido. A reutilização do conteúdo requer confirmação junto do editor.");
    expect(screen.queryByRole("region", { name: "Limitações" })).toBeNull();
  });

  it("SRC-0027, cited by no observation, states that plainly and renders no investigation section", () => {
    const { container } = renderSrc(detail("SRC-0027"));
    expect(screen.getByText("A Open Évora ainda não extraiu observações desta fonte.")).toBeTruthy();
    expect(screen.getByText("Ainda não existem observações da investigação ligadas explicitamente a esta fonte.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Na investigação" })).toBeNull();
    expect(metadata(container).Observações).toBe("0 · 0 problemas");
    expect(within(auditRegion()).getByRole("heading", { name: "Consultar a página" })).toBeTruthy();
  });
});

describe("SRC Detail — relation state", () => {
  const src: RecordDetail = {
    id: "SRC-1",
    type: "SRC-",
    file: "research/sources/SRC-1.yaml",
    outgoingEdges: [],
    incomingEdges: [],
    record: {
      name: "Fonte",
      resource_type: "dataset",
      scope: { geography: { level: "non_geographic" }, domains: ["DIG"] },
      access: { level: "public", availability: "available", machine_readable: true, method: "api" },
      acquisition: { method: "api" },
      canonical_reference: "ftp://example.org/data",
      licensing: { status: "unknown", reuse: "unknown" },
      temporal: { last_checked_at: "2026-08-25" },
    },
  };
  const lookup = new Map<string, RecordSummary>();

  it("shows loading in findings and the Observações cell, and no summary or investigation section yet", () => {
    const { container } = renderSrc(src, { lookup, relations: { status: "loading", id: "SRC-1", retry: vi.fn() } });
    expect(screen.getByText("A carregar observações da investigação…")).toBeTruthy();
    expect(container.querySelector(".src-meta-cell--usage dd [aria-label='A carregar']")).toBeTruthy();
    expect(container.querySelector(".src-hero-summary")).toBeNull();
    expect(screen.queryByRole("region", { name: "Na investigação" })).toBeNull();
  });

  it("on relation failure offers a retry and marks the Observações cell unavailable", () => {
    const retry = vi.fn();
    const { container } = renderSrc(src, { lookup, relations: { status: "error", id: "SRC-1", error: new DataLoadError("x", "network"), retry } });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalled();
    expect(metadata(container).Observações).toBe("Indisponível");
  });

  it("never links a non-HTTP(S) reference and reads unregistered facts as 'Não registado'", () => {
    const { container } = renderSrc(src, { lookup, relations: ready({ evidence: [], uniqueEvidenceCount: 0, relatedProblems: [], problemDomainCodes: {} }) });
    expect(screen.queryByRole("link", { name: /Abrir fonte/ })).toBeNull();
    expect(within(auditRegion()).getByText("ftp://example.org/data").tagName).toBe("SPAN");
    expect(metadata(container)).toMatchObject({ Onde: "Sem âmbito geográfico", Período: "Não registado", Acesso: "Público" });
    expect(within(auditRegion()).getByText(/^A fonte é pública/).textContent).toBe("A fonte é pública e está disponível para consulta por API. Os direitos de reutilização não são conhecidos.");
  });

  it("says 'em investigação' only when every related Problem is canonically OPEN", () => {
    const evidence: RecordDetail = { id: "EVD-1", type: "EVD-", file: "", outgoingEdges: [], incomingEdges: [], record: { observation: { summary: "Obs." } } };
    const relations = ready({ evidence: [evidence], uniqueEvidenceCount: 1, relatedProblems: [{ problemId: "PRB-1", viaEvidenceIds: ["EVD-1"] }, { problemId: "PRB-2", viaEvidenceIds: ["EVD-1"] }], problemDomainCodes: {} });
    const mixed = new Map<string, RecordSummary>([
      ["PRB-1", { id: "PRB-1", type: "PRB-", label: "Um", file: "", summaryFields: { status: "OPEN" } }],
      ["PRB-2", { id: "PRB-2", type: "PRB-", label: "Dois", file: "", summaryFields: { status: "REJECTED" } }],
    ]);
    const { unmount } = renderSrc(src, { lookup: mixed, relations });
    expect(screen.getByText("A Open Évora extraiu desta fonte 1 observação, usada em 2 problemas.")).toBeTruthy();
    unmount();
    mixed.set("PRB-2", { ...mixed.get("PRB-2")!, summaryFields: { status: "OPEN" } });
    renderSrc(src, { lookup: mixed, relations });
    expect(screen.getByText("A Open Évora extraiu desta fonte 1 observação, usada em 2 problemas em investigação.")).toBeTruthy();
  });
});
