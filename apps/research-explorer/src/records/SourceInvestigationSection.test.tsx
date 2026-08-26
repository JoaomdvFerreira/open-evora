import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceInvestigationSection } from "./SourceInvestigationSection";
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
  observation: {
    summary: "Uma experiência controlada em contexto real concluiu que a informação de disponibilidade reduziu o tempo de circulação.",
  },
  evidence_nature: "measurement",
  strength: "primary-authoritative",
  personal_data: { present: false, retained: false },
  notes:
    "Comparator/mechanism evidence, not Évora-specific. Transferability to PRB-0005 is limited. Use as mechanism evidence only (WU-D4-01 Model A).",
  analysis: {
    related_problems: ["PRB-0005"],
    contribution: ["REFINES"],
    friction_types: ["INFORMATION"],
    representativeness: "LIMITED",
    verification: "VERIFIED",
    temporal_relevance: "HISTORICAL",
  },
};

describe("SourceInvestigationSection", () => {
  it("1. one related problem renders section, count, PRB id and via-EVD id", () => {
    render(
      <SourceInvestigationSection
        relations={relations({ uniqueEvidenceCount: 1, relatedProblems: [{ problemId: "PRB-0001", viaEvidenceIds: ["EVD-1"] }] })}
      />
    );

    expect(screen.getByRole("heading", { name: "Na investigação" })).toBeTruthy();
    expect(screen.getByText("Observações relacionadas")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("PRB-0001")).toBeTruthy();
    expect(screen.getByText("Através de: EVD-1")).toBeTruthy();
  });

  it("2. multiple related problems render in supplied deterministic order", () => {
    render(
      <SourceInvestigationSection
        relations={relations({
          uniqueEvidenceCount: 3,
          relatedProblems: [
            { problemId: "PRB-0002", viaEvidenceIds: ["EVD-2"] },
            { problemId: "PRB-0001", viaEvidenceIds: ["EVD-1"] },
          ],
        })}
      />
    );

    const items = screen.getAllByText(/^PRB-000/);
    expect(items.map((el) => el.textContent)).toEqual(["PRB-0002", "PRB-0001"]);
  });

  it("3. multiple EVDs leading to the same PRB render as one entry with all via-EVD ids, no duplicate", () => {
    render(
      <SourceInvestigationSection
        relations={relations({
          uniqueEvidenceCount: 2,
          relatedProblems: [{ problemId: "PRB-0005", viaEvidenceIds: ["EVD-000101", "EVD-000106"] }],
        })}
      />
    );

    expect(screen.getAllByText("PRB-0005")).toHaveLength(1);
    expect(screen.getByText("Através de: EVD-000101, EVD-000106")).toBeTruthy();
  });

  it("4. zero related problems: entire section absent, no heading, no empty-state text", () => {
    render(<SourceInvestigationSection relations={relations({})} />);

    expect(screen.queryByRole("heading", { name: "Na investigação" })).toBeNull();
    expect(screen.queryByText(/investigação/i)).toBeNull();
  });

  it("5. related evidence exists but zero related problems: section absent", () => {
    const evd = evidenceDetail("EVD-1", { observation: { summary: "Resumo." } });
    render(<SourceInvestigationSection relations={relations({ primaryEvidence: [evd], uniqueEvidenceCount: 1, relatedProblems: [] })} />);

    expect(screen.queryByRole("heading", { name: "Na investigação" })).toBeNull();
  });

  it("6. SRC-0093 acceptance shape: count 1, PRB-0005, EVD-000106", () => {
    render(
      <SourceInvestigationSection
        relations={relations({ uniqueEvidenceCount: 1, relatedProblems: [{ problemId: "PRB-0005", viaEvidenceIds: ["EVD-000106"] }] })}
      />
    );

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("PRB-0005")).toBeTruthy();
    expect(screen.getByText("Através de: EVD-000106")).toBeTruthy();
  });

  it("7. observation.summary is not rendered", () => {
    render(
      <SourceInvestigationSection
        relations={relations({ uniqueEvidenceCount: 1, relatedProblems: [{ problemId: "PRB-0005", viaEvidenceIds: ["EVD-000106"] }] })}
      />
    );

    expect(screen.queryByText((EVD_000106.observation as { summary: string }).summary)).toBeNull();
  });

  it("8. notes / comparator / mechanism / research_role wording is not rendered", () => {
    render(
      <SourceInvestigationSection
        relations={relations({ uniqueEvidenceCount: 1, relatedProblems: [{ problemId: "PRB-0005", viaEvidenceIds: ["EVD-000106"] }] })}
      />
    );

    expect(screen.queryByText(/Comparator\/mechanism/)).toBeNull();
    expect(screen.queryByText(/Transferability/)).toBeNull();
    expect(screen.queryByText(/research_role/)).toBeNull();
  });

  it("9. no primary/additional provenance headings are repeated here", () => {
    render(
      <SourceInvestigationSection
        relations={relations({ uniqueEvidenceCount: 1, relatedProblems: [{ problemId: "PRB-0005", viaEvidenceIds: ["EVD-000106"] }] })}
      />
    );

    expect(screen.queryByText("Evidência retirada desta fonte")).toBeNull();
    expect(screen.queryByText("Evidência que também usa esta fonte")).toBeNull();
  });

  it("10. no PRB title/formulation/content is invented or fetched — only problemId text", () => {
    render(
      <SourceInvestigationSection
        relations={relations({ uniqueEvidenceCount: 1, relatedProblems: [{ problemId: "PRB-0005", viaEvidenceIds: ["EVD-000106"] }] })}
      />
    );

    const heading = screen.getByText("PRB-0005");
    expect(heading.textContent).toBe("PRB-0005");
  });

  it("11. uniqueEvidenceCount is rendered exactly as supplied, not recalculated", () => {
    render(
      <SourceInvestigationSection
        relations={relations({
          uniqueEvidenceCount: 42,
          relatedProblems: [{ problemId: "PRB-0005", viaEvidenceIds: ["EVD-000106"] }],
        })}
      />
    );

    expect(screen.getByText("42")).toBeTruthy();
  });
});
