import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordsTable } from "./RecordsTable";
import type { RecordSummary } from "../dataProvider/types";

function setInnerWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
}

const ORIGINAL_WIDTH = window.innerWidth;

afterEach(() => {
  setInnerWidth(ORIGINAL_WIDTH);
});

const BASE_RECORDS: RecordSummary[] = Array.from({ length: 30 }, (_, i) => ({
  id: `EVD-${String(i + 1).padStart(6, "0")}`,
  type: "EVD-",
  label: `Fixture evidence label ${i + 1}`,
  file: `research/evidence/EVD-${String(i + 1).padStart(6, "0")}.yaml`,
  summaryFields: {},
}));

const RECORDS: RecordSummary[] = [
  ...BASE_RECORDS,
  { id: "PRB-0006", type: "PRB-", label: "Adequate and affordable housing is difficult to access for some population groups", file: "research/problems/PRB-0006.yaml", summaryFields: {} },
  { id: "WID-0001", type: "WID-", label: "Future widget label", file: "research/widgets/WID-0001.yaml", summaryFields: {} },
];

function renderTable(overrides: Partial<Parameters<typeof RecordsTable>[0]> = {}) {
  const props = {
    records: RECORDS,
    selectedId: null,
    onSelect: vi.fn(),
    query: "",
    onQueryChange: vi.fn(),
    typeFilter: "all",
    onTypeFilterChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<RecordsTable {...props} />), props };
}

describe("RecordsTable — desktop (default jsdom width, above the 767px breakpoint)", () => {
  it("renders a meaning-first list, not the narrow list or technical table", () => {
    renderTable();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("list", { name: "Registos" })).toBeTruthy();
    expect(screen.getByText("Fixture evidence label 1")).toBeTruthy();
    expect(screen.queryByText(/research\/evidence\/EVD-000001\.yaml/)).toBeNull();
  });

  it("selecting a row's ID button invokes onSelect with that ID", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderTable({ onSelect });
    await user.click(screen.getByRole("button", { name: /EVD-000001/ }));
    expect(onSelect).toHaveBeenCalledWith("EVD-000001");
  });
});

describe("RecordsTable — narrow (~360px, at/below the existing breakpoint)", () => {
  it("renders the adapted single-column record list instead of a table", () => {
    setInnerWidth(360);
    renderTable();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("list", { name: "Registos" })).toBeTruthy();
  });

  it("shares the same filtered result set as desktop (query is applied identically)", () => {
    setInnerWidth(360);
    renderTable({ query: "housing" });
    expect(screen.getByRole("button", { name: /PRB-0006/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /EVD-000001/ })).toBeNull();
  });

  it("shares the same type filter as desktop", () => {
    setInnerWidth(360);
    renderTable({ typeFilter: "PRB-" });
    expect(screen.getByRole("button", { name: /PRB-0006/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /EVD-000001/ })).toBeNull();
  });

  it("preserves the existing page-size contract (25 per page) and pagination controls", () => {
    setInnerWidth(360);
    renderTable();
    // 30 EVD- fixtures + PRB-0006 + WID-0001 = 32 records, page size 25 -> first page has 25 rows.
    expect(screen.getAllByRole("button", { name: /EVD-|PRB-|WID-/ }).length).toBe(25);
    expect(screen.getByText(/Página 1 de 2/)).toBeTruthy();
  });

  it("selecting a narrow row invokes the same onSelect callback as desktop", async () => {
    setInnerWidth(360);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderTable({ onSelect });
    await user.click(screen.getByRole("button", { name: /EVD-000001/ }));
    expect(onSelect).toHaveBeenCalledWith("EVD-000001");
  });

  it("does not render the file path inside the narrow scanning row", () => {
    setInnerWidth(360);
    renderTable();
    expect(screen.queryByText(/research\/evidence\/EVD-000001\.yaml/)).toBeNull();
  });

  it("renders a long label without introducing a wide/non-wrapping element", () => {
    setInnerWidth(360);
    renderTable({ typeFilter: "PRB-" });
    const row = screen.getByRole("button", { name: /PRB-0006/ });
    expect(row.textContent).toContain("Adequate and affordable housing is difficult to access for some population groups");
    expect(row.querySelector(".narrow-record-label")?.className).not.toMatch(/nowrap/);
  });

  it("renders an unrecognised future record type safely", () => {
    setInnerWidth(360);
    renderTable({ typeFilter: "WID-" });
    expect(screen.getByRole("button", { name: /WID-0001/ })).toBeTruthy();
  });
});

describe("RecordsTable — width-independent behavior", () => {
  it("shows 'Nenhum resultado.' identically regardless of width when the filtered set is empty", () => {
    setInnerWidth(360);
    renderTable({ query: "no-such-record-anywhere" });
    expect(screen.getByText("Nenhum resultado.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("list", { name: "Registos" })).toBeNull();
  });

  it("DS-05I: renders the zero-result state as EmptyState with the exact copy, and keeps the result-count live region intact", () => {
    renderTable({ query: "no-such-record-anywhere" });
    const message = screen.getByText("Nenhum resultado.");
    expect(message.className).toBe("ui-empty-state-message");
    const liveRegion = screen.getByText(/registos encontrados\.$/);
    expect(liveRegion.getAttribute("aria-live")).toBe("polite");
    expect(liveRegion.textContent).toBe("0 registos encontrados.");
  });
});
