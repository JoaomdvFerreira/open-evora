import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SourceFindingsSection } from "./SourceFindingsSection";
import type { RecordDetail } from "../dataProvider/types";
import type { SourceEvidenceRelations } from "./sourceEvidenceRelations";

function evidenceDetail(id: string, record: Record<string, unknown>): RecordDetail {
  return {
    id,
    type: "EVD-",
    file: `research/evidence/${id}.yaml`,
    record,
    outgoingEdges: [],
    incomingEdges: [],
  };
}

function relations(overrides: Partial<SourceEvidenceRelations>): SourceEvidenceRelations {
  return {
    primaryEvidence: [],
    additionalEvidence: [],
    uniqueEvidenceCount: 0,
    relatedProblems: [],
    ...overrides,
  };
}

/** Mirrors research/evidence/EVD-000106.yaml exactly (SRC-0093 acceptance shape). */
const EVD_000106: Record<string, unknown> = {
  evidence_id: "EVD-000106",
  type: "statistical",
  source: {
    source_id: "SRC-0093",
    publisher: "Scientific Reports (Springer Nature)",
    title: "Providing curb availability information to delivery drivers reduces cruising for parking",
    source_reference: "Scientific Reports, 2022",
    published_at: 2022,
    retrieved_at: "2026-08-11",
  },
  geography: {
    level: "city",
    area: "Seattle, WA — Belltown (10-block commercial/passenger loading study area)",
  },
  population: ["delivery drivers"],
  domain: ["MOB", "DIG"],
  observation: {
    summary:
      "Uma experiência controlada em contexto real (274 sensores embutidos junto ao passeio a alimentar informação de disponibilidade em tempo real no sistema OpenPark; 11 condutores, 33 percursos, 495 entregas simuladas; com e sem informação de disponibilidade) concluiu que a apresentação de informação sobre disponibilidade junto ao passeio reduziu em 27,9 % o tempo de circulação à procura de estacionamento e em 12,4 % a distância percorrida nessa procura.",
  },
  evidence_nature: "measurement",
  strength: "primary-authoritative",
  personal_data: { present: false, retained: false },
  notes:
    "Comparator/mechanism evidence, not Évora-specific. Strongest available evidence that availability information alone can reduce search behaviour where curb-availability uncertainty is causal. Transferability to PRB-0005 is limited. Use as mechanism evidence only, not proof of an equivalent Évora effect (WU-D4-01 Model A).",
  analysis: {
    related_problems: ["PRB-0005"],
    contribution: ["REFINES"],
    friction_types: ["INFORMATION"],
    lineage_id: "MOB-2022-SEATTLE-OPENPARK-SCIREPORTS-STUDY",
    representativeness: "LIMITED",
    verification: "VERIFIED",
    temporal_relevance: "HISTORICAL",
  },
};

describe("SourceFindingsSection", () => {
  it("1. primary-only case", () => {
    const evd = evidenceDetail("EVD-1", { observation: { summary: "Resumo primário." } });
    render(<SourceFindingsSection relations={relations({ primaryEvidence: [evd], uniqueEvidenceCount: 1 })} />);

    expect(screen.getByRole("heading", { name: "O que encontrámos" })).toBeTruthy();
    expect(screen.getByText("Evidência retirada desta fonte")).toBeTruthy();
    expect(screen.queryByText("Evidência que também usa esta fonte")).toBeNull();
  });

  it("2. additional-only case", () => {
    const evd = evidenceDetail("EVD-2", { observation: { summary: "Resumo adicional." } });
    render(<SourceFindingsSection relations={relations({ additionalEvidence: [evd], uniqueEvidenceCount: 1 })} />);

    expect(screen.getByText("Evidência que também usa esta fonte")).toBeTruthy();
    expect(screen.queryByText("Evidência retirada desta fonte")).toBeNull();
  });

  it("3. both categories", () => {
    const primary = evidenceDetail("EVD-1", { observation: { summary: "Resumo primário." } });
    const additional = evidenceDetail("EVD-2", { observation: { summary: "Resumo adicional." } });
    render(<SourceFindingsSection relations={relations({ primaryEvidence: [primary], additionalEvidence: [additional], uniqueEvidenceCount: 2 })} />);

    expect(screen.getByText("Evidência retirada desta fonte")).toBeTruthy();
    expect(screen.getByText("Evidência que também usa esta fonte")).toBeTruthy();
    expect(screen.getByText("Resumo primário.")).toBeTruthy();
    expect(screen.getByText("Resumo adicional.")).toBeTruthy();
  });

  it("4. zero-EVD case renders the exact informative empty-state wording", () => {
    render(<SourceFindingsSection relations={relations({})} />);

    expect(screen.getByText("Ainda não existem observações da investigação ligadas explicitamente a esta fonte.")).toBeTruthy();
    expect(screen.queryByText(/não tem evidência/)).toBeNull();
    expect(screen.queryByText(/Não existe evidência associada/)).toBeNull();
  });

  it("4b. zero-EVD case does not render a misleading zero-count 'Observações relacionadas' block", () => {
    render(<SourceFindingsSection relations={relations({})} />);

    expect(screen.queryByText("Observações relacionadas")).toBeNull();
  });

  it("14. SUI-03K3: related evidence renders 'Observações relacionadas' with uniqueEvidenceCount before the first evidence-group heading", () => {
    const primary = evidenceDetail("EVD-1", { observation: { summary: "Resumo primário." } });
    render(<SourceFindingsSection relations={relations({ primaryEvidence: [primary], uniqueEvidenceCount: 1 })} />);

    expect(screen.getByText("Observações relacionadas")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();

    const section = screen.getByRole("heading", { name: "O que encontrámos" }).closest("section")!;
    const countLabel = screen.getByText("Observações relacionadas");
    const groupHeading = screen.getByRole("heading", { name: "Evidência retirada desta fonte" });
    expect(section.contains(countLabel)).toBe(true);
    const position = countLabel.compareDocumentPosition(groupHeading);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("5. SRC-0093 acceptance-shaped relation renders EVD-000106 as primary with expected fields", () => {
    const evd = evidenceDetail("EVD-000106", EVD_000106);
    render(<SourceFindingsSection relations={relations({ primaryEvidence: [evd], uniqueEvidenceCount: 1 })} />);

    expect(screen.getByText("EVD-000106")).toBeTruthy();
    expect(screen.getByText((EVD_000106.observation as { summary: string }).summary)).toBeTruthy();
    expect(screen.getByText("Medição")).toBeTruthy();
    expect(screen.getByText("Seattle, WA — Belltown (10-block commercial/passenger loading study area)")).toBeTruthy();
    expect(screen.getByText("delivery drivers")).toBeTruthy();
    expect(screen.getByText(/Consultada pela Open Évora em/)).toBeTruthy();
    expect(screen.getByText(/11 de ago(\.|osto) de 2026|11\/08\/2026/)).toBeTruthy();
  });

  it("6. optional EVD fields absent renders no invented placeholders", () => {
    const evd = evidenceDetail("EVD-3", { observation: { summary: "Só o resumo." } });
    render(<SourceFindingsSection relations={relations({ primaryEvidence: [evd], uniqueEvidenceCount: 1 })} />);

    expect(screen.queryByText("Âmbito")).toBeNull();
    expect(screen.queryByText("População")).toBeNull();
    expect(screen.queryByText(/Consultada pela Open Évora em/)).toBeNull();
    expect(screen.queryByText("N/A")).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.queryByText("Não registado")).toBeNull();
  });

  it("7. notes containing comparator/mechanism wording are not rendered", () => {
    const evd = evidenceDetail("EVD-000106", EVD_000106);
    render(<SourceFindingsSection relations={relations({ primaryEvidence: [evd], uniqueEvidenceCount: 1 })} />);

    expect(screen.queryByText(/Comparator\/mechanism/)).toBeNull();
    expect(screen.queryByText(/Transferability/)).toBeNull();
  });

  it("8. analysis.related_problems present — PRB IDs/content are not rendered", () => {
    const evd = evidenceDetail("EVD-000106", EVD_000106);
    render(<SourceFindingsSection relations={relations({ primaryEvidence: [evd], uniqueEvidenceCount: 1 })} />);

    expect(screen.queryByText(/PRB-0005/)).toBeNull();
  });

  it("9. additional EVD is not described using the primary-group wording", () => {
    const additional = evidenceDetail("EVD-2", { observation: { summary: "Resumo adicional." } });
    render(<SourceFindingsSection relations={relations({ additionalEvidence: [additional], uniqueEvidenceCount: 1 })} />);

    expect(screen.queryByText("Evidência retirada desta fonte")).toBeNull();
  });

  it("10. SUI-03C2: EVD identifier renders as a button and invokes onSelect with the EVD id when provided", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const evd = evidenceDetail("EVD-000106", { observation: { summary: "Resumo primário." } });
    render(<SourceFindingsSection relations={relations({ primaryEvidence: [evd], uniqueEvidenceCount: 1 })} onSelect={onSelect} />);

    const button = screen.getByRole("button", { name: "EVD-000106" });
    await user.click(button);
    expect(onSelect).toHaveBeenCalledWith("EVD-000106");
  });

  it("11. SUI-03C2: without onSelect, the EVD identifier renders as plain text, not a button", () => {
    const evd = evidenceDetail("EVD-000106", { observation: { summary: "Resumo primário." } });
    render(<SourceFindingsSection relations={relations({ primaryEvidence: [evd], uniqueEvidenceCount: 1 })} />);

    expect(screen.queryByRole("button", { name: "EVD-000106" })).toBeNull();
    expect(screen.getByText("EVD-000106")).toBeTruthy();
  });

  it("12. SUI-03K2C: both group headings use the shared neutral nested-heading class", () => {
    const primary = evidenceDetail("EVD-1", { observation: { summary: "Resumo primário." } });
    const additional = evidenceDetail("EVD-2", { observation: { summary: "Resumo adicional." } });
    render(<SourceFindingsSection relations={relations({ primaryEvidence: [primary], additionalEvidence: [additional], uniqueEvidenceCount: 2 })} />);

    const primaryHeading = screen.getByRole("heading", { name: "Evidência retirada desta fonte" });
    const additionalHeading = screen.getByRole("heading", { name: "Evidência que também usa esta fonte" });
    expect(primaryHeading.tagName).toBe("H4");
    expect(primaryHeading.className).toBe("record-editorial-subheading");
    expect(additionalHeading.tagName).toBe("H4");
    expect(additionalHeading.className).toBe("record-editorial-subheading");
  });

  it("13. SUI-03K2C: an absent group renders no empty heading for that group", () => {
    const primary = evidenceDetail("EVD-1", { observation: { summary: "Resumo primário." } });
    render(<SourceFindingsSection relations={relations({ primaryEvidence: [primary], uniqueEvidenceCount: 1 })} />);

    expect(screen.queryByText("Evidência que também usa esta fonte")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(1);
  });
});
