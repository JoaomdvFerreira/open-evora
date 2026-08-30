import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { evdSectionIndex, EvdDetail, EvdReadingRail } from "./EvdDetail";
import type { RecordDetail, RecordSummary } from "../dataProvider/types";
import { DataLoadError } from "../dataProvider/types";
import type { EVDProblemUsesState } from "./useEvdProblemUses";
import type { EVDProblemUse } from "./evdRelations";

const GENERATED = path.resolve(__dirname, "..", "..", "generated", "record-detail");
const hasGeneratedData = fs.existsSync(GENERATED);
const detail = (id: string): RecordDetail => JSON.parse(fs.readFileSync(path.join(GENERATED, `${id}.json`), "utf8"));
const ready = (uses: EVDProblemUse[]): EVDProblemUsesState & { retry: () => void } => ({ status: "ready", uses, retry: vi.fn() });
const lookup = new Map<string, RecordSummary>([
  ["SRC-0002", { id: "SRC-0002", type: "SRC-", label: "Plano de Desenvolvimento Social de Évora 2024-2027", file: "", summaryFields: {} }],
  ["SRC-0093", { id: "SRC-0093", type: "SRC-", label: "Estudo OpenPark", file: "", summaryFields: {} }],
]);

describe.skipIf(!hasGeneratedData)("EVD Detail vNext — canonical regression cases", () => {
  it("EVD-000001 renders observation, scope, limits, source navigation and extracted date", () => {
    const onSelect = vi.fn(); const item = detail("EVD-000001");
    render(<EvdDetail detail={item} lookup={lookup} problemUses={ready([])} onSelect={onSelect} />);
    expect(screen.getByRole("heading", { name: (item.record.observation as Record<string, unknown>).summary as string })).toBeTruthy();
    expect(screen.getAllByText("Município de Évora").length).toBeGreaterThan(0);
    expect(screen.getByText("2024 — 2027")).toBeTruthy();
    expect(screen.getAllByText((item.record.inference_limits as string[])[0]).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Plano de Desenvolvimento Social/ }));
    expect(onSelect).toHaveBeenCalledWith("SRC-0002");
  });

  it("EVD-000114 exposes direct-engagement facts and claim authority", () => {
    const item = detail("EVD-000114");
    render(<EvdDetail detail={item} lookup={lookup} problemUses={ready([])} onSelect={vi.fn()} />);
    expect(screen.getAllByText("Facto").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Com autoridade").length).toBeGreaterThan(0);
    expect(screen.getAllByText("pessoas com deficiência").length).toBeGreaterThan(0);
  });

  it("EVD-000096 renders its multiple canonical Sources as peers and omits absent lineage", () => {
    const item = detail("EVD-000096");
    render(<EvdDetail detail={item} lookup={lookup} problemUses={ready([])} onSelect={vi.fn()} />);
    expect(screen.getAllByText("SRC-0081").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SRC-0053").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Linagem:/)).toBeNull();
  });

  it("EVD-000106 preserves comparative Seattle scope and shows only the PRB-owned mechanism role/effect", () => {
    const item = detail("EVD-000106"); const problem = detail("PRB-0005"); const onSelect = vi.fn();
    render(<EvdDetail detail={item} lookup={lookup} problemUses={ready([{ detail: problem, effects: ["REFINES"], researchRoles: ["COMPARATIVE_MECHANISM"], relationshipPath: "evidence[7]" }])} onSelect={onSelect} />);
    expect(screen.getAllByText("Belltown, Seattle, Washington, EUA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("O estudo não demonstra uma redução proporcional da distância total percorrida ou das emissões e não estabelece um efeito equivalente em Évora.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Refina").length).toBeGreaterThan(0); expect(screen.getAllByText("Mecanismo comparativo").length).toBeGreaterThan(0);
    const extractedAt = screen.getByText(/Extraída pela Open Évora em/);
    expect(extractedAt.querySelector("time")?.dateTime).toBe("2026-08-11");
    expect(extractedAt.textContent).toBe("Extraída pela Open Évora em 11/08/2026");
    fireEvent.click(screen.getByText("Inspeção técnica completa"));
    expect(screen.getByText("provenance.sources[0] → SRC-0093")).toBeTruthy();
    expect(screen.getByText("PRB-0005 → evidence[7]")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver Problema →" })); expect(onSelect).toHaveBeenCalledWith("PRB-0005");
  });

  it("EVD-000147 preserves month precision and the planned-response relationship", () => {
    const item = detail("EVD-000147"); const problem = detail("PRB-0008");
    render(<EvdDetail detail={item} lookup={lookup} problemUses={ready([{ detail: problem, effects: ["BOUNDS", "REFINES"], researchRoles: ["LOCAL_OBSERVATION", "PLANNED_RESPONSE"], relationshipPath: "evidence[5]" }])} onSelect={vi.fn()} />);
    expect(screen.getByText("outubro de 2026")).toBeTruthy(); expect(screen.getByText("Resposta planeada")).toBeTruthy();
  });

  it("EVD-000012 supports independently rendered multiple Problem uses and keeps technical inspection available", () => {
    const item = detail("EVD-000012"); const first = detail("PRB-0004"); const second = detail("PRB-0005");
    render(<EvdDetail detail={item} lookup={lookup} problemUses={ready([{ detail: first, effects: ["REFINES"], researchRoles: ["LOCAL_OBSERVATION"], relationshipPath: "evidence[3]" }, { detail: second, effects: ["BOUNDS", "REFINES"], researchRoles: ["LOCAL_OBSERVATION", "EXISTING_RESPONSE"], relationshipPath: "evidence[5]" }])} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: "Ver Problema →" })).toHaveLength(2);
    expect(screen.getByText("Inspeção técnica completa")).toBeTruthy();
    expect(screen.queryByText(/representativeness|analysis\./i)).toBeNull();
  });
});

describe("EVD relationship and technical FactList facts", () => {
  const base: RecordDetail = {
    id: "EVD-TEST",
    type: "EVD-",
    file: "research/evidence/EVD-TEST.yaml",
    outgoingEdges: [{ field: "provenance.sources", ordinal: 0, to: "SRC-0093" }],
    incomingEdges: [{ field: "evidence", ordinal: 3, from: "PRB-0005" }],
    record: {
      observation: { summary: "Observação de teste." },
      provenance: { sources: ["SRC-0093"] },
      lineage_id: "EVD-LEGACY-0001",
    },
  };
  const problem: RecordDetail = {
    id: "PRB-0005",
    type: "PRB-",
    file: "research/problems/PRB-0005.yaml",
    outgoingEdges: [],
    incomingEdges: [],
    record: { title: "Problema de teste" },
  };

  it("renders Efeito before Papel as one semantic FactList dl, preserving authored effect/role order and cardinality", () => {
    const { container } = render(
      <EvdDetail
        detail={base}
        lookup={lookup}
        problemUses={ready([{ detail: problem, effects: ["SUPPORTS", "BOUNDS"], researchRoles: ["CONTEXTUAL", "COMPARATIVE_RESPONSE"], relationshipPath: "evidence[3]" }])}
        onSelect={vi.fn()}
      />
    );

    const relationList = container.querySelector(".evd-problem-card dl.ui-fact-list");
    expect(relationList).toBeTruthy();
    const dtLabels = Array.from(relationList!.querySelectorAll("dt")).map((node) => node.textContent);
    expect(dtLabels).toEqual(["Efeito", "Papel"]);

    const dds = relationList!.querySelectorAll("dd");
    expect(dds[0].querySelectorAll(".evd-effect-tag")).toHaveLength(2);
    expect(dds[1].querySelectorAll(".research-role-tag")).toHaveLength(2);
    expect(screen.getAllByText("Sustenta")[0].compareDocumentPosition(screen.getAllByText("Delimita")[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("preserves the exact technical fact row order including optional lineage_id and relationship paths", () => {
    const { container } = render(<EvdDetail detail={base} lookup={lookup} problemUses={ready([])} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByText("Inspeção técnica completa"));

    const technicalList = container.querySelector("#evd-technical dl.ui-fact-list");
    expect(technicalList).toBeTruthy();
    const labels = Array.from(technicalList!.querySelectorAll("dt")).map((node) => node.textContent);
    expect(labels).toEqual(["Ficheiro canónico", "evidence_id", "lineage_id", "Caminhos de relação"]);
  });

  it("omits the optional lineage_id and relationship-path rows when absent", () => {
    const noLineage: RecordDetail = { ...base, outgoingEdges: [], incomingEdges: [], record: { observation: { summary: "Observação de teste." }, provenance: { sources: [] } } };
    const { container } = render(<EvdDetail detail={noLineage} lookup={lookup} problemUses={ready([])} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByText("Inspeção técnica completa"));

    const technicalList = container.querySelector("#evd-technical dl.ui-fact-list");
    const labels = Array.from(technicalList!.querySelectorAll("dt")).map((node) => node.textContent);
    expect(labels).toEqual(["Ficheiro canónico", "evidence_id"]);
  });
});

describe("EVD Detail DS-05I — EmptyState adoption for zero Problem uses", () => {
  const base: RecordDetail = {
    id: "EVD-TEST",
    type: "EVD-",
    file: "research/evidence/EVD-TEST.yaml",
    outgoingEdges: [],
    incomingEdges: [],
    record: { observation: { summary: "Observação de teste." }, provenance: { sources: [] } },
  };

  it("renders EmptyState with the exact copy once ready with zero Problem uses", () => {
    render(<EvdDetail detail={base} lookup={lookup} problemUses={ready([])} onSelect={vi.fn()} />);
    const message = screen.getByText("Esta evidência ainda não está ligada explicitamente a um Problema.");
    expect(message.className).toBe("ui-empty-state-message");
  });

  it("keeps loading as ProgressMessage, not EmptyState", () => {
    render(<EvdDetail detail={base} lookup={lookup} problemUses={{ status: "loading", retry: vi.fn() }} onSelect={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("A carregar usos nos Problemas…");
    expect(screen.queryByText("Esta evidência ainda não está ligada explicitamente a um Problema.")).toBeNull();
  });

  it("keeps error as ErrorNotice with retry, not EmptyState", () => {
    const retry = vi.fn();
    render(<EvdDetail detail={base} lookup={lookup} problemUses={{ status: "error", error: new DataLoadError("Falha.", "network"), retry }} onSelect={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("EVD section index", () => {
  const emptyLimits: RecordDetail = {
    id: "EVD-EMPTY-LIMITS",
    type: "EVD-",
    file: "research/evidence/EVD-EMPTY-LIMITS.yaml",
    outgoingEdges: [],
    incomingEdges: [],
    record: {
      observation: { summary: "Observação sem limites redigidos." },
      provenance: { sources: [] },
      inference_limits: [],
    },
  };

  it("omits an unrendered limits section from the shared compact and rail index", () => {
    expect(evdSectionIndex(emptyLimits.record).map((section) => section.sectionId)).not.toContain("limits");
    render(<><EvdDetail detail={emptyLimits} lookup={lookup} problemUses={ready([])} onSelect={vi.fn()} /><EvdReadingRail detail={emptyLimits} /></>);
    expect(screen.queryByRole("link", { name: "O que não permite concluir" })).toBeNull();
  });
});
