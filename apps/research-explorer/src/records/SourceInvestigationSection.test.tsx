import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceInvestigationSection } from "./SourceInvestigationSection";
describe("SourceInvestigationSection vNext", () => { it("presents only explicitly linked PRBs", () => { render(<SourceInvestigationSection relations={{ evidence: [], uniqueEvidenceCount: 0, relatedProblems: [{ problemId: "PRB-1", viaEvidenceIds: ["EVD-1"] }] }} />); expect(screen.getByText("PRB-1")).toBeTruthy(); expect(screen.getByText(/EVD-1/)).toBeTruthy(); }); });
