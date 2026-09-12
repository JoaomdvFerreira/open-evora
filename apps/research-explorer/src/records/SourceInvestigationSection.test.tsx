import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { SourceInvestigationSection } from "./SourceInvestigationSection";
import type { SourceEvidenceRelations } from "./sourceEvidenceRelations";

const zeroRelations: SourceEvidenceRelations = { evidence: [], uniqueEvidenceCount: 0, relatedProblems: [] };
const oneRelations: SourceEvidenceRelations = { evidence: [], uniqueEvidenceCount: 0, relatedProblems: [{ problemId: "PRB-1", viaEvidenceIds: ["EVD-1"] }] };
const multiRelations: SourceEvidenceRelations = {
  evidence: [],
  uniqueEvidenceCount: 0,
  relatedProblems: [
    { problemId: "PRB-3", viaEvidenceIds: ["EVD-4", "EVD-6"] },
    { problemId: "PRB-4", viaEvidenceIds: ["EVD-5", "EVD-140", "EVD-141"] },
    { problemId: "PRB-5", viaEvidenceIds: ["EVD-7", "EVD-8", "EVD-142"] },
  ],
};

describe("SourceInvestigationSection vNext", () => {
  it("presents only explicitly linked PRBs", () => {
    render(<SourceInvestigationSection relations={oneRelations} />);
    expect(screen.getByText("PRB-1")).toBeTruthy();
    expect(screen.getByText(/EVD-1/)).toBeTruthy();
  });
});

describe("SourceInvestigationSection AR-05 CR-2 — broadened coverage", () => {
  it("renders an EmptyState and no 'Problemas relacionados' group when there are zero related Problems", () => {
    render(<SourceInvestigationSection relations={zeroRelations} />);
    expect(screen.getByText("Ainda não existem Problemas da investigação ligados explicitamente a esta fonte.")).toBeTruthy();
    expect(screen.queryByText("Problemas relacionados")).toBeNull();
  });

  it("renders every related Problem with correct per-PRB viaEvidenceIds attribution when there are multiple", () => {
    render(<SourceInvestigationSection relations={multiRelations} />);
    expect(screen.getByText("PRB-3")).toBeTruthy();
    expect(screen.getByText("Através de: EVD-4, EVD-6")).toBeTruthy();
    expect(screen.getByText("PRB-4")).toBeTruthy();
    expect(screen.getByText("Através de: EVD-5, EVD-140, EVD-141")).toBeTruthy();
    expect(screen.getByText("PRB-5")).toBeTruthy();
    expect(screen.getByText("Através de: EVD-7, EVD-8, EVD-142")).toBeTruthy();
  });

  it("renders each related Problem as an action (button) when onSelect is supplied, calling it with the correct problemId", () => {
    const onSelect = vi.fn();
    render(<SourceInvestigationSection relations={oneRelations} onSelect={onSelect} />);
    const button = screen.getByRole("button", { name: "Abrir PRB-1" });
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith("PRB-1");
  });

  it("renders each related Problem as plain text (no action) when onSelect is absent", () => {
    render(<SourceInvestigationSection relations={oneRelations} />);
    expect(screen.queryByRole("button", { name: "Abrir PRB-1" })).toBeNull();
    expect(screen.getByText("PRB-1")).toBeTruthy();
  });
});
