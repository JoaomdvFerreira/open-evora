import { afterEach, describe, expect, it, vi } from "vitest";
import { useReducer } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordsTable } from "./RecordsTable";
import { initialRecordsControllerState, recordsControllerReducer } from "./recordsController";
import type { RecordSummary } from "../dataProvider/types";

function setInnerWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
}

const ORIGINAL_WIDTH = window.innerWidth;

afterEach(() => {
  setInnerWidth(ORIGINAL_WIDTH);
});

const EVIDENCE: RecordSummary[] = Array.from({ length: 30 }, (_, i) => ({
  id: `EVD-${String(i + 1).padStart(6, "0")}`,
  type: "EVD-",
  label: `Fixture evidence label ${i + 1}`,
  file: `research/evidence/EVD-${String(i + 1).padStart(6, "0")}.yaml`,
  summaryFields: {},
}));

const RECORDS: RecordSummary[] = [
  ...EVIDENCE,
  { id: "PRB-0006", type: "PRB-", label: "Adequate and affordable housing is difficult to access for some population groups", file: "research/problems/PRB-0006.yaml", summaryFields: {} },
  { id: "SRC-0003", type: "SRC-", label: "Plano de Urbanização de Évora — material da 4.ª revisão", file: "research/sources/SRC-0003.yaml", summaryFields: {} },
  { id: "SRC-0011", type: "SRC-", label: "NERE", file: "research/sources/SRC-0011.yaml", summaryFields: {} },
  { id: "WID-0001", type: "WID-", label: "Future widget label", file: "research/widgets/WID-0001.yaml", summaryFields: {} },
  { id: "WID-0002", type: "WID-", label: "WID-0002", file: "research/widgets/WID-0002.yaml", summaryFields: {} },
];

type TableProps = Omit<Parameters<typeof RecordsTable>[0], "controllerState" | "dispatchController">;

/** Owns the ODM-015 controller state the way RecordsExplorer does, so these tests exercise real sort/page behaviour. */
function ControlledRecordsTable(props: TableProps) {
  const [controllerState, dispatchController] = useReducer(recordsControllerReducer, initialRecordsControllerState);
  return <RecordsTable {...props} controllerState={controllerState} dispatchController={dispatchController} />;
}

function renderTable(overrides: Partial<TableProps> = {}) {
  const props: TableProps = {
    records: RECORDS,
    onSelect: vi.fn(),
    query: "",
    onQueryChange: vi.fn(),
    typeFilter: "all",
    onTypeFilterChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<ControlledRecordsTable {...props} />), props };
}

function filterGroup() {
  return screen.getByRole("group", { name: "Tipo de registo" });
}

function rowIds(): string[] {
  return within(screen.getByRole("list", { name: "Registos" }))
    .getAllByRole("button")
    .map((row) => row.querySelector(".records-row-id")?.textContent ?? "");
}

function pagination() {
  return screen.getByRole("navigation", { name: "Paginação dos registos" });
}

describe("RecordsTable — page composition", () => {
  it("renders the corpus intro with the Registos page heading", () => {
    renderTable();
    expect(screen.getByText("Corpus de investigação")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Registos" })).toBeTruthy();
  });

  it("offers no type <select> and no Tipo/Rótulo/Ficheiro columns", () => {
    renderTable();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Tipo")).toBeNull();
    expect(screen.queryByText("Rótulo")).toBeNull();
    expect(screen.queryByText("Ficheiro")).toBeNull();
    expect(screen.queryByText(/research\/evidence\/EVD-000001\.yaml/)).toBeNull();
  });
});

describe("RecordsTable — type filters", () => {
  it("lists Todos, then Problemas/Fontes/Evidências, then any other loaded type, each with a count derived from the loaded index", () => {
    renderTable();
    const labels = within(filterGroup()).getAllByRole("button").map((button) => button.textContent);
    expect(labels).toEqual(["Todos 35", "Problemas 1", "Fontes 2", "Evidências 30", "WID 2"]);
  });

  it("marks the active filter with aria-pressed, defaulting to Todos", () => {
    renderTable();
    const pressed = within(filterGroup()).getAllByRole("button").filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed.map((button) => button.textContent)).toEqual(["Todos 35"]);
  });

  it("counts follow the active search", () => {
    renderTable({ query: "évora" });
    const labels = within(filterGroup()).getAllByRole("button").map((button) => button.textContent);
    expect(labels).toEqual(["Todos 1", "Problemas 0", "Fontes 1", "Evidências 0", "WID 0"]);
  });

  it("selecting a filter reports its type value to the caller", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();
    await user.click(within(filterGroup()).getByRole("button", { name: /^Fontes/ }));
    expect(props.onTypeFilterChange).toHaveBeenCalledWith("SRC-");
    await user.click(within(filterGroup()).getByRole("button", { name: /^Todos/ }));
    expect(props.onTypeFilterChange).toHaveBeenCalledWith("all");
  });

  it("filters the list to the active type", () => {
    renderTable({ typeFilter: "SRC-" });
    expect(rowIds()).toEqual(["SRC-0003", "SRC-0011"]);
  });

  it("degrades a type filter absent from the loaded index to Todos", () => {
    renderTable({ typeFilter: "NOPE-" });
    expect(within(filterGroup()).getByRole("button", { name: /^Todos/ }).getAttribute("aria-pressed")).toBe("true");
    expect(rowIds()).toHaveLength(25);
  });
});

describe("RecordsTable — search", () => {
  it("uses a placeholder that names the active filter", () => {
    const { rerender } = renderTable();
    const search = () => screen.getByLabelText("Pesquisar") as HTMLInputElement;
    expect(search().placeholder).toBe("Pesquisar por ID ou título");
    const cases: [string, string][] = [
      ["PRB-", "Pesquisar problemas por ID ou título"],
      ["SRC-", "Pesquisar fontes por ID ou título"],
      ["EVD-", "Pesquisar evidências por ID ou título"],
      ["WID-", "Pesquisar por ID ou título"],
    ];
    for (const [typeFilter, placeholder] of cases) {
      rerender(<ControlledRecordsTable records={RECORDS} onSelect={vi.fn()} query="" onQueryChange={vi.fn()} typeFilter={typeFilter} onTypeFilterChange={vi.fn()} />);
      expect(search().placeholder).toBe(placeholder);
    }
  });

  it("shortens the placeholder at the compact width", () => {
    setInnerWidth(360);
    renderTable({ typeFilter: "SRC-" });
    expect((screen.getByLabelText("Pesquisar") as HTMLInputElement).placeholder).toBe("ID ou título");
  });

  it("reports typing to the caller (the URL-synced query owner)", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();
    await user.type(screen.getByLabelText("Pesquisar"), "N");
    expect(props.onQueryChange).toHaveBeenCalledWith("N");
  });

  it("shows the empty state, and announces the zero count, when nothing matches", () => {
    renderTable({ query: "no-such-record-anywhere" });
    expect(screen.getByText("Nenhum resultado.").className).toBe("ui-empty-state-message");
    expect(screen.queryByRole("list", { name: "Registos" })).toBeNull();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("0 registos");
  });
});

describe("RecordsTable — record rows", () => {
  it("shows the canonical ID and the label as the row title, and the whole row selects the record", async () => {
    const user = userEvent.setup();
    const { props } = renderTable({ typeFilter: "PRB-" });
    const row = screen.getByRole("button", { name: /PRB-0006/ });
    expect(row.textContent).toContain("Adequate and affordable housing is difficult to access for some population groups");
    expect(row.tagName).toBe("BUTTON");
    await user.click(row);
    expect(props.onSelect).toHaveBeenCalledWith("PRB-0006");
  });

  it("renders the label after its first em dash as secondary text, keeping the full label verbatim", () => {
    renderTable({ typeFilter: "SRC-" });
    const row = screen.getByRole("button", { name: /SRC-0003/ });
    expect(row.querySelector(".records-row-title")?.textContent).toBe("Plano de Urbanização de Évora — material da 4.ª revisão");
    expect(row.querySelector(".records-row-title-primary")?.textContent).toBe("Plano de Urbanização de Évora");
    expect(row.querySelector(".records-row-title-secondary")?.textContent).toBe(" — material da 4.ª revisão");
  });

  it("renders a label without an em dash entirely as primary text", () => {
    renderTable({ typeFilter: "SRC-" });
    const row = screen.getByRole("button", { name: /SRC-0011/ });
    expect(row.querySelector(".records-row-title-primary")?.textContent).toBe("NERE");
    expect(row.querySelector(".records-row-title-secondary")).toBeNull();
  });

  it("does not repeat the ID as a title when the label is only the ID", () => {
    renderTable({ typeFilter: "WID-" });
    const row = screen.getByRole("button", { name: /WID-0002/ });
    expect((row.textContent!.match(/WID-0002/g) ?? []).length).toBe(1);
  });
});

describe("RecordsTable — sorting", () => {
  it("opens sorted by ID ascending", () => {
    renderTable();
    const idSort = screen.getByRole("button", { name: /^ID/ });
    expect(idSort.getAttribute("aria-pressed")).toBe("true");
    expect(idSort.textContent).toContain("↑");
    expect(rowIds().slice(0, 2)).toEqual(["EVD-000001", "EVD-000002"]);
  });

  it("toggles ID between ascending and descending without an unsorted state", async () => {
    const user = userEvent.setup();
    renderTable();
    const idSort = screen.getByRole("button", { name: /^ID/ });
    await user.click(idSort);
    expect(idSort.textContent).toContain("↓");
    expect(rowIds()[0]).toBe("WID-0002");
    await user.click(idSort);
    expect(idSort.textContent).toContain("↑");
    expect(rowIds()[0]).toBe("EVD-000001");
  });

  it("can sort by title instead", async () => {
    const user = userEvent.setup();
    renderTable({ typeFilter: "SRC-" });
    await user.click(screen.getByRole("button", { name: /^Título/ }));
    expect(screen.getByRole("button", { name: /^Título/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^ID/ }).getAttribute("aria-pressed")).toBe("false");
    expect(rowIds()).toEqual(["SRC-0011", "SRC-0003"]);
  });

  it("the compact toolbar reports the count and reverses the active sort", async () => {
    const user = userEvent.setup();
    renderTable({ typeFilter: "SRC-" });
    expect(document.querySelector(".records-compact-count")?.textContent).toBe("2 fontes");
    const compactSort = screen.getByRole("button", { name: /^Ordenar: ID/ });
    expect(compactSort.textContent).toContain("↑");
    await user.click(compactSort);
    expect(screen.getByRole("button", { name: /^Ordenar: ID/ }).textContent).toContain("↓");
    expect(rowIds()).toEqual(["SRC-0011", "SRC-0003"]);
  });
});

describe("RecordsTable — pagination", () => {
  it("keeps the 25-record page size and summarises range, page and count in each responsive form", () => {
    renderTable({ typeFilter: "EVD-" });
    expect(rowIds()).toHaveLength(25);
    const nav = pagination();
    expect(nav.querySelector(".records-pagination-range")?.textContent).toBe("1–25 de 30 evidências");
    expect(nav.querySelector(".records-pagination-status-full")?.textContent).toBe("Página 1 de 2 · 30 evidências");
    expect(nav.querySelector(".records-pagination-status-short")?.textContent).toBe("1 / 2");
  });

  it("marks the current page, disables Anterior on the first page, and moves with Seguinte / page numbers", async () => {
    const user = userEvent.setup();
    renderTable();
    const nav = pagination();
    expect(within(nav).getByRole("button", { name: "Página 1" }).getAttribute("aria-current")).toBe("page");
    expect((within(nav).getByRole("button", { name: "Anterior" }) as HTMLButtonElement).disabled).toBe(true);
    expect(nav.hasAttribute("data-first-page")).toBe(true);

    await user.click(within(nav).getByRole("button", { name: "Seguinte" }));
    expect(within(nav).getByRole("button", { name: "Página 2" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("button", { name: "Página 1" }).getAttribute("aria-current")).toBeNull();
    expect((within(nav).getByRole("button", { name: "Seguinte" }) as HTMLButtonElement).disabled).toBe(true);
    expect(nav.hasAttribute("data-first-page")).toBe(false);
    expect(nav.querySelector(".records-pagination-range")?.textContent).toBe("26–35 de 35 registos");

    await user.click(within(nav).getByRole("button", { name: "Página 1" }));
    expect(rowIds()[0]).toBe("EVD-000001");
  });

  it("omits page steps when every result fits on one page", () => {
    renderTable({ typeFilter: "SRC-" });
    const nav = pagination();
    expect(within(nav).queryByRole("button")).toBeNull();
    expect(nav.querySelector(".records-pagination-range")?.textContent).toBe("1–2 de 2 fontes");
  });

  it("uses singular nouns for a single result", () => {
    renderTable({ typeFilter: "PRB-" });
    expect(pagination().querySelector(".records-pagination-range")?.textContent).toBe("1–1 de 1 problema");
  });
});
