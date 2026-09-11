import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordsExplorer } from "./RecordsExplorer";
import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";

/**
 * ODM-015 regression: sort and pagination state must survive selecting a
 * record from the Records list and returning (RecordsExplorer owns the
 * controller state, not the unmounted-on-selection RecordsTable — see
 * recordsController.ts and RecordsTable.tsx).
 */
const RECORDS: RecordSummary[] = Array.from({ length: 30 }, (_, i) => ({
  id: `EVD-${String(i + 1).padStart(6, "0")}`,
  type: "EVD-",
  label: `Fixture evidence label ${String(i + 1).padStart(2, "0")}`,
  file: `research/evidence/EVD-${String(i + 1).padStart(6, "0")}.yaml`,
  summaryFields: {},
}));

const DETAILS: Record<string, RecordDetail> = Object.fromEntries(
  RECORDS.map((r) => [r.id, { id: r.id, type: r.type, file: r.file, record: { title: r.label }, outgoingEdges: [], incomingEdges: [] }])
);

function makeProvider(): DataProvider {
  return {
    getManifest: async () => { throw new Error("unused"); },
    listRecords: async () => RECORDS,
    getEdges: async () => [],
    getRecord: async (id: string) => DETAILS[id],
  };
}

/** Mirrors how Explorer.tsx wires RecordsExplorer: selectedId lives in the caller, above RecordsExplorer/RecordsTable. */
function Harness() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <RecordsExplorer
      dataProvider={makeProvider()}
      selectedId={selectedId}
      onSelect={setSelectedId}
      query=""
      onQueryChange={vi.fn()}
      typeFilter="all"
      onTypeFilterChange={vi.fn()}
      onViewAsProblem={vi.fn()}
      onViewInGraph={vi.fn()}
      onViewHistory={vi.fn()}
      onBackToRecords={() => setSelectedId(null)}
    />
  );
}

function pageIndicatorText(): string | null {
  const nextButton = screen.getByRole("button", { name: "Seguinte" });
  const indicator = nextButton.parentElement?.querySelector("span[aria-live='polite']");
  return indicator ? indicator.textContent?.replace(/\s+/g, " ").trim() ?? null : null;
}

async function expectPageTwoOfTwo() {
  await screen.findByText(/Página/);
  expect(pageIndicatorText()).toBe("Página 2 de 2");
}

describe("RecordsExplorer — sort/page persistence across select-then-return (ODM-015)", () => {
  it("keeps the chosen sort direction and page index after selecting a record and returning to Records", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await screen.findByText("Fixture evidence label 01");

    // Sort by ID descending, then move to page 2.
    const sortButton = screen.getByRole("button", { name: /^ID/ });
    await user.click(sortButton);
    await user.click(sortButton);
    expect(sortButton.getAttribute("aria-pressed")).toBe("true");
    expect(sortButton.textContent).toContain("▼");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));
    await expectPageTwoOfTwo();
    const [firstRowOnPage2] = screen.getAllByText(/Fixture evidence label/);
    const firstLabelOnPage2 = firstRowOnPage2.textContent;

    // Select a record (unmounts RecordsTable in favour of RecordDetailPanel).
    await user.click(firstRowOnPage2.closest("button")!);
    await screen.findByRole("button", { name: "Registos" });

    // Return to Records via the detail breadcrumb.
    await user.click(screen.getByRole("button", { name: "Registos" }));

    // Sort direction and page position must be exactly as left.
    const sortButtonAgain = await screen.findByRole("button", { name: /^ID/ });
    expect(sortButtonAgain.getAttribute("aria-pressed")).toBe("true");
    expect(sortButtonAgain.textContent).toContain("▼");
    await expectPageTwoOfTwo();
    const [firstRowAfterReturn] = screen.getAllByText(/Fixture evidence label/);
    expect(firstRowAfterReturn.textContent).toBe(firstLabelOnPage2);
  });

  it("does not reset the page merely from selecting a record and returning", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await screen.findByText("Fixture evidence label 01");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));
    await expectPageTwoOfTwo();

    const [firstRow] = screen.getAllByText(/Fixture evidence label/);
    await user.click(firstRow.closest("button")!);
    await screen.findByRole("button", { name: "Registos" });
    await user.click(screen.getByRole("button", { name: "Registos" }));

    await expectPageTwoOfTwo();
  });
});
