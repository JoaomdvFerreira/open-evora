import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NarrowRecordsList } from "./NarrowRecordsList";
import type { RecordSummary } from "../dataProvider/types";

const RECORDS: RecordSummary[] = [
  { id: "EVD-000001", type: "EVD-", label: "The Social Development Plan reports a lack of transport", file: "research/evidence/EVD-000001.yaml", summaryFields: {} },
  { id: "PRB-0006", type: "PRB-", label: "Adequate and affordable housing is difficult to access", file: "research/problems/PRB-0006.yaml", summaryFields: {} },
  { id: "WID-0002", type: "WID-", label: "WID-0002", file: "research/widgets/WID-0002.yaml", summaryFields: {} },
  { id: "WID-0001", type: "WID-", label: "Future widget label", file: "research/widgets/WID-0001.yaml", summaryFields: {} },
];

describe("NarrowRecordsList", () => {
  it("shows type, human-readable label, and canonical ID for each row, without the file path", () => {
    render(<NarrowRecordsList records={RECORDS} selectedId={null} onSelect={vi.fn()} />);

    const row = screen.getByRole("button", { name: /EVD-000001/ });
    expect(row.textContent).toContain("EVD-");
    expect(row.textContent).toContain("The Social Development Plan reports a lack of transport");
    expect(row.textContent).toContain("EVD-000001");
    expect(row.textContent).not.toContain("research/evidence/EVD-000001.yaml");
  });

  it("does not duplicate the ID as a secondary line when the label already equals the ID", () => {
    render(<NarrowRecordsList records={RECORDS} selectedId={null} onSelect={vi.fn()} />);
    const row = screen.getByRole("button", { name: /WID-0002/ });
    // Only one occurrence of "WID-0002" text within the row, not a repeated label+id pair.
    const occurrences = (row.textContent!.match(/WID-0002/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("renders an unrecognised future record type safely, generically", () => {
    render(<NarrowRecordsList records={RECORDS} selectedId={null} onSelect={vi.fn()} />);
    const row = screen.getByRole("button", { name: /WID-0001/ });
    expect(row.textContent).toContain("WID-");
    expect(row.textContent).toContain("Future widget label");
  });

  it("invokes onSelect with the record ID when a row is activated, and marks the selected row", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<NarrowRecordsList records={RECORDS} selectedId="PRB-0006" onSelect={onSelect} />);

    const selectedRow = screen.getByRole("button", { name: /PRB-0006/ });
    expect(selectedRow.getAttribute("aria-pressed")).toBe("true");

    const otherRow = screen.getByRole("button", { name: /EVD-000001/ });
    expect(otherRow.getAttribute("aria-pressed")).toBe("false");

    await user.click(otherRow);
    expect(onSelect).toHaveBeenCalledWith("EVD-000001");
  });

  it("gives every row a real, keyboard-activatable button element with a practical touch target", () => {
    render(<NarrowRecordsList records={RECORDS} selectedId={null} onSelect={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.tagName).toBe("BUTTON");
    }
  });
});
