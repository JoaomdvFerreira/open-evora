import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceFindingsSection } from "./SourceFindingsSection";
import type { SourceEvidenceRelations } from "./sourceEvidenceRelations";

const relations: SourceEvidenceRelations = { evidence: [{ id: "EVD-1", type: "EVD-", file: "", outgoingEdges: [], incomingEdges: [], record: { observation: { summary: "Observação de teste." }, scope: { geography: { area: "Évora" }, populations: ["pessoas residentes"] }, provenance: { sources: ["SRC-1"] } } }], uniqueEvidenceCount: 1, relatedProblems: [] };
describe("SourceFindingsSection vNext", () => {
  it("renders canonical provenance-backed observations", () => { render(<SourceFindingsSection relations={relations} />); expect(screen.getByText("Observação de teste.")).toBeTruthy(); expect(screen.getByText("SRC-1")).toBeTruthy(); });

  it("renders the section-level count and per-finding facts as separate semantic FactList dl elements with preserved order", () => {
    const { container } = render(<SourceFindingsSection relations={relations} />);

    const lists = container.querySelectorAll("dl.ui-fact-list");
    expect(lists).toHaveLength(2);
    expect(Array.from(lists[0].querySelectorAll("dt")).map((node) => node.textContent)).toEqual(["Observações relacionadas"]);
    expect(lists[0].querySelector("dd")?.textContent).toBe("1");
    expect(Array.from(lists[1].querySelectorAll("dt")).map((node) => node.textContent)).toEqual(["Âmbito", "Populações", "Fontes de proveniência"]);
  });

  it("omits the fact list entirely when the established-empty branch renders", () => {
    const empty: SourceEvidenceRelations = { evidence: [], uniqueEvidenceCount: 0, relatedProblems: [] };
    const { container } = render(<SourceFindingsSection relations={empty} />);

    expect(container.querySelectorAll("dl.ui-fact-list")).toHaveLength(0);
    expect(screen.getByText("Ainda não existem observações da investigação ligadas explicitamente a esta fonte.")).toBeTruthy();
  });
});
