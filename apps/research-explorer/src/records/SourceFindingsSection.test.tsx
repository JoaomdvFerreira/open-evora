import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceFindingsSection } from "./SourceFindingsSection";
import type { SourceEvidenceRelations } from "./sourceEvidenceRelations";

const relations: SourceEvidenceRelations = { evidence: [{ id: "EVD-1", type: "EVD-", file: "", outgoingEdges: [], incomingEdges: [], record: { observation: { summary: "Observação de teste." }, scope: { geography: { area: "Évora" }, populations: ["pessoas residentes"] }, provenance: { sources: ["SRC-1"] } } }], uniqueEvidenceCount: 1, relatedProblems: [] };
describe("SourceFindingsSection vNext", () => { it("renders canonical provenance-backed observations", () => { render(<SourceFindingsSection relations={relations} />); expect(screen.getByText("Observação de teste.")).toBeTruthy(); expect(screen.getByText("SRC-1")).toBeTruthy(); }); });
