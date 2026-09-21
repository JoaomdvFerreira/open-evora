import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Overview } from "./Overview";
import { DataLoadError, type DataProvider, type RecordDetail, type RecordSummary } from "../dataProvider/types";
import { getLisbonCivilDate, isDateInCivilWeekOf } from "./overviewStats";

function makeProvider(index: RecordSummary[]): DataProvider {
  const details: Record<string, RecordDetail> = Object.fromEntries(
    index.map((summary) => [
      summary.id,
      {
        id: summary.id,
        type: summary.type,
        file: summary.file,
        record: {
          title: summary.label,
          status: summary.summaryFields.status,
          validation_status: summary.summaryFields.validation_status,
          evidence_status: summary.summaryFields.evidence_status,
        },
        outgoingEdges: [],
        incomingEdges: [],
      },
    ])
  );
  return {
    getManifest: async () => { throw new Error("unused"); },
    listRecords: async () => index,
    getEdges: async () => [],
    getRecord: async (id) => details[id],
  };
}

const props = { onExploreProblem: vi.fn() };

function openDrawer() {
  return screen.getByRole("button", { name: /^Filtros/ });
}

/** Mirrors overviewStats.ts's `formatOverviewCompactDate` (compact PT-PT `DD/MM`) for asserting a row marker's rendered date against a `YYYY-MM-DD` fixture. */
function formatMarkerDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

/**
 * `YYYY-MM-DD` one calendar day before `date`, via whole-day UTC-anchored
 * arithmetic — used only to walk backward from today's Lisbon civil date to
 * find that week's Monday below. Carries no timezone meaning of its own,
 * matching the same neutral UTC-anchored axis `overviewStats.ts`'s internal
 * `parseCivilDay` already uses for civil-date arithmetic.
 */
function previousCivilDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

/**
 * The Monday of the civil week containing the real current `Europe/Lisbon`
 * civil date (Lisbon-date-boundary hardening, §3) — replaces a former
 * `Date.getDay()`/host-local-calendar helper that made these fixtures depend
 * on the machine/CI timezone. Walks backward from today's Lisbon civil date
 * one day at a time using only the production `getLisbonCivilDate`/
 * `isDateInCivilWeekOf` helpers (never a second, test-local timezone
 * interpretation) until the previous day falls outside the current civil
 * week — that day is Monday, the unique lower boundary `isDateInCivilWeekOf`
 * already enforces.
 */
function thisWeekMonday(): string {
  const today = getLisbonCivilDate();
  let monday = today;
  while (isDateInCivilWeekOf(previousCivilDate(monday), today)) {
    monday = previousCivilDate(monday);
  }
  return monday;
}

describe("Overview — Problem investigation-state dimensions", () => {
  // The editorial problem-list row (Overview visual-completion) shows two of
  // the three investigation-state dimensions inline: evidenceStatus via the
  // existing restrained `reading` chip, lifecycleStatus as plain secondary
  // text (no caption prefix, no chip — the row's own position already reads
  // as "this Problem's state"). validationStatus is not shown on the row or
  // anywhere else in Overview (Overview final redesign, Phase 1 removes
  // non-topic filtering, including validation, outright).
  it("renders evidenceStatus (chip) and lifecycleStatus (plain text) independently when both are canonically present", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema com todas as dimensões", file: "", summaryFields: { status: "OPEN", validation_status: "unvalidated", evidence_status: "corroborated" } },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const row = (await screen.findByText("PRB-1")).closest(".overview-problem-row-meta");
    expect(row?.querySelector(".prb-status-chip")?.textContent).toMatch(/Evidência:\s*Corroborada/);
    expect(within(row as HTMLElement).getByText("Aberto")).toBeTruthy();
    // Never the concatenated caption+value adjacency the row used to render.
    expect(row?.textContent).not.toMatch(/Estado do problema\s*Aberto/);
    expect(row?.textContent).not.toMatch(/Validação:/);
  });

  it("omits only the lifecycle text when status is null", async () => {
    const provider = makeProvider([
      { id: "PRB-2", type: "PRB-", label: "Problema sem estado de ciclo de vida", file: "", summaryFields: { validation_status: "unvalidated", evidence_status: "corroborated" } },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const row = (await screen.findByText("PRB-2")).closest(".overview-problem-row-meta");
    expect(row?.querySelector(".prb-status-chip")?.textContent).toMatch(/Evidência:\s*Corroborada/);
    expect(within(row as HTMLElement).queryByText("Aberto")).toBeNull();
  });

  it("omits only the evidence chip when evidence_status is null", async () => {
    const provider = makeProvider([
      { id: "PRB-4", type: "PRB-", label: "Problema sem evidência", file: "", summaryFields: { status: "OPEN", validation_status: "unvalidated" } },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const row = (await screen.findByText("PRB-4")).closest(".overview-problem-row-meta");
    expect(within(row as HTMLElement).getByText("Aberto")).toBeTruthy();
    expect(row?.querySelector(".prb-status-chip")).toBeNull();
  });

  it("omits both the evidence chip and lifecycle text when both dimensions are null", async () => {
    const provider = makeProvider([
      { id: "PRB-4", type: "PRB-", label: "Problema sem dimensões", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const row = (await screen.findByText("PRB-4")).closest(".overview-problem-row-meta");
    expect(row?.querySelector(".prb-status-chip")).toBeNull();
    expect(row?.querySelector(".overview-problem-row-lifecycle")).toBeNull();
  });
});

describe("Overview — final Hero", () => {
  it("renders the final eyebrow, headline, and supporting copy", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    expect(screen.getByText("Projeto independente — não oficial")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Problemas práticos que afetam Évora." })).toBeTruthy();
    expect(screen.getByText("O que sabemos, o que falta saber, e a fonte de cada afirmação.")).toBeTruthy();
  });

  it("renders exactly the four intended Hero metric concepts — problems, evidence records, sources, total corpus records", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema um", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema dois", file: "", summaryFields: {} },
      { id: "EVD-1", type: "EVD-", label: "Evidência um", file: "", summaryFields: {} },
      { id: "EVD-2", type: "EVD-", label: "Evidência dois", file: "", summaryFields: {} },
      { id: "EVD-3", type: "EVD-", label: "Evidência três", file: "", summaryFields: {} },
      { id: "SRC-1", type: "SRC-", label: "Fonte", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    // Compact inline metric presentation (visual-convergence pass): value
    // and label share one line, e.g. "2 PROBLEMAS" — no separate stacked
    // label element. Problem label is uppercase (owner request).
    const problemMetric = (await screen.findByText("2", { selector: ".overview-metric-value" })).closest(".overview-metric");
    expect(problemMetric?.textContent).toBe("2 PROBLEMAS");

    const evidenceMetric = screen.getByText("3", { selector: ".overview-metric-value" }).closest(".overview-metric");
    expect(evidenceMetric?.textContent).toBe("3 Registos de evidência");

    const sourceMetric = screen.getByText("1", { selector: ".overview-metric-value" }).closest(".overview-metric");
    expect(sourceMetric?.textContent).toBe("1 Fonte");

    // Total corpus record count (owner request) — every record in the
    // loaded index regardless of type: 2 PRB + 3 EVD + 1 SRC = 6.
    const totalMetric = screen.getByText("6", { selector: ".overview-metric-value" }).closest(".overview-metric");
    expect(totalMetric?.textContent).toBe("6 Total de registos");

    expect(document.querySelectorAll(".overview-metric").length).toBe(4);
  });

  it("does not render the removed Hero recent-updates surface", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    expect(screen.queryByText("Atualizado recentemente")).toBeNull();
    expect(document.querySelector(".overview-hero-recent")).toBeNull();
  });

  it("does not render search inside the Hero", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    expect(document.querySelector(".overview-hero .overview-search")).toBeNull();
    // Search still renders, in the toolbar.
    expect(screen.getByLabelText("Pesquisar problemas")).toBeTruthy();
  });

  it("does not render the old Hero category shortcuts", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    expect(screen.queryByText("Ou entre por:")).toBeNull();
    expect(document.querySelector(".overview-category-shortcuts")).toBeNull();
  });
});

describe("Overview — permanent filter rail and non-topic filters removed", () => {
  it("does not render the permanent filter rail", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    expect(document.querySelector(".overview-filter-rail")).toBeNull();
    expect(screen.queryByRole("group", { name: "Evidência" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Validação" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Estado" })).toBeNull();
  });

  it("does not render evidence/validation/lifecycle filter controls anywhere, including inside the open category drawer", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    await user.click(openDrawer());

    expect(screen.queryByRole("button", { name: /Aberto/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Corroborada/ })).toBeNull();
  });
});

describe("Overview — Problem ordering transparency and citizen discovery controls", () => {
  it("orders Problem cards by ascending PRB ID string order, neutrally, regardless of load order", async () => {
    const provider = makeProvider([
      { id: "PRB-9", type: "PRB-", label: "Problema nove", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema dois", file: "", summaryFields: {} },
      { id: "PRB-10", type: "PRB-", label: "Problema dez", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema dois");
    const titles = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
    expect(titles).toEqual(["Problema dez", "Problema dois", "Problema nove"]);
  });

  it("labels the toolbar search control per the approved copy", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    render(<Overview dataProvider={provider} {...props} />);

    const input = (await screen.findByLabelText("Pesquisar problemas")) as HTMLInputElement;
    expect(input.placeholder).toBe("Pesquisar problemas em Évora…");
  });

  it("announces the toolbar result count and empty-state meaning as search state changes", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema digital", file: "", summaryFields: {} },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    const resultsCount = await screen.findByText("2 problemas");
    const liveRegion = resultsCount.closest('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute("aria-atomic")).toBe("true");

    const input = screen.getByLabelText("Pesquisar problemas");
    await user.type(input, "inexistente");

    await within(liveRegion as HTMLElement).findByText("0 problemas");
    const emptyState = await screen.findByText("Nenhum problema corresponde à pesquisa.");
    expect(emptyState).toBeTruthy();
  });

  it("keeps Problem rows outside the atomic result announcement and names each row's primary action by title", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema digital", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const firstAction = await screen.findByRole("button", { name: "Explorar Problema de mobilidade" });
    expect(screen.getByRole("button", { name: "Explorar Problema digital" })).toBeTruthy();
    expect(firstAction.closest('[aria-live="polite"]')).toBeNull();
  });
});

describe("Overview — Filtros disclosure and category drawer", () => {
  it("starts collapsed, with Filtros exposing aria-expanded=false", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    expect(openDrawer().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Filtrar por tema" })).toBeNull();
  });

  it("keeps aria-controls resolving to a real, stably-mounted element even while collapsed (hidden, not absent)", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    const toggle = openDrawer();
    const controlsId = toggle.getAttribute("aria-controls");
    expect(controlsId).not.toBeNull();

    // The controlled element exists in the DOM while collapsed — never
    // conditionally unmounted — and is hidden via the native `hidden`
    // attribute rather than being absent.
    const controlled = document.getElementById(controlsId as string);
    expect(controlled).not.toBeNull();
    expect(controlled?.hidden).toBe(true);
  });

  it("opens the drawer on click, exposing aria-expanded=true, and closes it on a second click", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    const toggle = openDrawer();
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("group", { name: "Filtrar por tema" })).toBeTruthy();

    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Filtrar por tema" })).toBeNull();
  });

  it("renders only topics with a real, unfiltered count greater than zero, with their real counts", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} },
    ]);
    provider.getRecord = async (id) => ({
      id, type: "PRB-", file: "", record: { title: "Problema de mobilidade", domain: ["MOB"] }, outgoingEdges: [], incomingEdges: [],
    });
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema de mobilidade");
    await user.click(openDrawer());

    const drawer = screen.getByRole("group", { name: "Filtrar por tema" });
    expect(within(drawer).getByRole("button", { name: /^Mobilidade/ }).textContent).toMatch(/1$/);
    // A canonical topic with a genuinely zero current count is not rendered
    // (visual-convergence pass, delta §5) — the vocabulary reduction is
    // presentation-only, not a canonical-data change: `topCategoryCounts`
    // itself still returns every audited topic with its real count (see
    // overviewStats.test.ts).
    expect(within(drawer).queryByRole("button", { name: /^Digital/ })).toBeNull();
  });

  it("selecting Todos clears the topic filter (topicFilter === null)", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema de espaço público", file: "", summaryFields: {} },
    ]);
    provider.getRecord = async (id) => ({
      id, type: "PRB-", file: "",
      record: { title: id === "PRB-1" ? "Problema de mobilidade" : "Problema de espaço público", domain: id === "PRB-1" ? ["MOB"] : ["PUB"] },
      outgoingEdges: [], incomingEdges: [],
    });
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema de mobilidade");
    await user.click(openDrawer());
    const drawer = screen.getByRole("group", { name: "Filtrar por tema" });
    await user.click(within(drawer).getByRole("button", { name: /^Mobilidade/ }));
    expect(await screen.findByText("1 problemas")).toBeTruthy();

    await user.click(within(drawer).getByRole("button", { name: /^Todos/ }));
    expect(await screen.findByText("2 problemas")).toBeTruthy();
  });

  it("selecting a category filters correctly and leaves the drawer open", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema de espaço público", file: "", summaryFields: {} },
    ]);
    provider.getRecord = async (id) => ({
      id, type: "PRB-", file: "",
      record: { title: id === "PRB-1" ? "Problema de mobilidade" : "Problema de espaço público", domain: id === "PRB-1" ? ["MOB"] : ["PUB"] },
      outgoingEdges: [], incomingEdges: [],
    });
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema de mobilidade");
    const toggle = openDrawer();
    await user.click(toggle);
    const drawer = screen.getByRole("group", { name: "Filtrar por tema" });
    await user.click(within(drawer).getByRole("button", { name: /^Mobilidade/ }));

    expect(await screen.findByText("1 problemas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explorar Problema de mobilidade" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Explorar Problema de espaço público" })).toBeNull();
    // The drawer stays open.
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("group", { name: "Filtrar por tema" })).toBeTruthy();
  });

  it("gives Filtros a restrained active state and exposes the active category in its accessible name when the drawer is closed", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} }]);
    provider.getRecord = async (id) => ({
      id, type: "PRB-", file: "", record: { title: "Problema de mobilidade", domain: ["MOB"] }, outgoingEdges: [], incomingEdges: [],
    });
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema de mobilidade");
    const toggle = openDrawer();
    await user.click(toggle);
    const drawer = screen.getByRole("group", { name: "Filtrar por tema" });
    await user.click(within(drawer).getByRole("button", { name: /^Mobilidade/ }));
    await user.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: /Filtros — Mobilidade/ })).toBeTruthy();
  });

  it("composes search, category selection, and sort together", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Mobilidade corroborada aberta", file: "", summaryFields: { status: "OPEN", evidence_status: "corroborated" } },
      { id: "PRB-2", type: "PRB-", label: "Mobilidade discovered fechada", file: "", summaryFields: { status: "REJECTED", evidence_status: "discovered" } },
      { id: "PRB-3", type: "PRB-", label: "Espaço público corroborado aberto", file: "", summaryFields: { status: "OPEN", evidence_status: "corroborated" } },
    ]);
    provider.getRecord = async (id) => {
      const domain = id === "PRB-3" ? ["PUB"] : ["MOB"];
      const title = id === "PRB-1" ? "Mobilidade corroborada aberta" : id === "PRB-2" ? "Mobilidade discovered fechada" : "Espaço público corroborado aberto";
      return { id, type: "PRB-", file: "", record: { title, domain, status: id === "PRB-2" ? "REJECTED" : "OPEN" }, outgoingEdges: [], incomingEdges: [] };
    };
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);
    await screen.findByText("Mobilidade corroborada aberta");

    await user.click(openDrawer());
    const drawer = screen.getByRole("group", { name: "Filtrar por tema" });
    await user.click(within(drawer).getByRole("button", { name: /^Mobilidade/ }));
    await user.type(screen.getByLabelText("Pesquisar problemas"), "corroborada");

    expect(await screen.findByText("1 problemas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explorar Mobilidade corroborada aberta" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Explorar Mobilidade discovered fechada" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Explorar Espaço público corroborado aberto" })).toBeNull();
  });

  it("renders every category option as an individually wrappable inline control (no fixed-width overflow container)", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    provider.getRecord = async (id) => ({
      id, type: "PRB-", file: "", record: { title: "Problema", domain: ["MOB"] }, outgoingEdges: [], incomingEdges: [],
    });
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    await user.click(openDrawer());
    const drawer = document.querySelector(".overview-category-drawer") as HTMLElement;
    // The drawer's CSS (`.overview-category-drawer { flex-wrap: wrap }`,
    // index.css) provides the actual narrow-width wrapping behaviour; this
    // asserts the DOM contract that CSS relies on — every option (Todos plus
    // each canonical topic) is its own sibling element, never pre-joined
    // into one unbreakable string.
    expect(drawer.children.length).toBeGreaterThan(1);
    expect([...drawer.children].every((child) => child.tagName === "BUTTON")).toBe(true);
  });
});

describe("Overview — toolbar result count and sort", () => {
  it("shows the filtered total in the toolbar's compact presentation", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema um", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema dois", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    expect(await screen.findByText("2 problemas")).toBeTruthy();
  });

  it("reflects visibleProblems.length, never the paginated slice length", async () => {
    const problems = Array.from({ length: 25 }, (_, index) => {
      const id = `PRB-${String(index + 1).padStart(4, "0")}`;
      return { id, type: "PRB-" as const, label: `Problema ${String(index + 1).padStart(2, "0")}`, file: "", summaryFields: {} };
    });
    render(<Overview dataProvider={makeProvider(problems)} {...props} />);

    // 25 filtered results, even though only 20 rows render on page 1.
    expect(await screen.findByText("25 problemas")).toBeTruthy();
    expect(screen.getAllByRole("listitem").filter((item) => item.classList.contains("overview-problem-row")).length).toBe(20);
  });

  it("does not render the former active-filter-summary text line", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    expect(screen.queryByText("sem filtros ativos")).toBeNull();
    expect(document.querySelector(".overview-results-filter-summary")).toBeNull();
  });

  it("defaults to updatedAt descending (Overview visual-convergence pass)", async () => {
    const provider: DataProvider = {
      ...makeProvider([
        { id: "PRB-1", type: "PRB-", label: "Problema um", file: "", summaryFields: {} },
        { id: "PRB-2", type: "PRB-", label: "Problema dois", file: "", summaryFields: {} },
      ]),
      getRecord: async (id) => ({
        id, type: "PRB-", file: "",
        record: { title: id === "PRB-1" ? "Problema um" : "Problema dois", updated_at: id === "PRB-1" ? "2026-01-01" : "2026-06-01" },
        outgoingEdges: [], incomingEdges: [],
      }),
    };
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema um");
    expect((screen.getByLabelText("Ordenar por") as HTMLSelectElement).value).toBe("updatedAt");
    const titles = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
    expect(titles).toEqual(["Problema dois", "Problema um"]);
  });

  it("still applies the identifier order via the toolbar sort control", async () => {
    const provider: DataProvider = {
      ...makeProvider([
        { id: "PRB-1", type: "PRB-", label: "Problema um", file: "", summaryFields: {} },
        { id: "PRB-2", type: "PRB-", label: "Problema dois", file: "", summaryFields: {} },
      ]),
      getRecord: async (id) => ({
        id, type: "PRB-", file: "",
        record: { title: id === "PRB-1" ? "Problema um" : "Problema dois", updated_at: id === "PRB-1" ? "2026-01-01" : "2026-06-01" },
        outgoingEdges: [], incomingEdges: [],
      }),
    };
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema um");
    await user.selectOptions(screen.getByLabelText("Ordenar por"), "Identificador ↑");

    const titles = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
    expect(titles).toEqual(["Problema um", "Problema dois"]);
  });
});

describe("Overview — problem-list pagination", () => {
  function makeManyProblems(count: number, overrides: (index: number) => Partial<RecordSummary["summaryFields"]> = () => ({})) {
    return Array.from({ length: count }, (_, index) => {
      const id = `PRB-${String(index + 1).padStart(4, "0")}`;
      return { id, type: "PRB-" as const, label: `Problema ${String(index + 1).padStart(2, "0")}`, file: "", summaryFields: overrides(index) };
    });
  }

  it("renders at most 20 problem rows on page 1 even when more results are available", async () => {
    render(<Overview dataProvider={makeProvider(makeManyProblems(45))} {...props} />);

    await screen.findByText("45 problemas");
    expect(screen.getAllByRole("listitem").filter((item) => item.classList.contains("overview-problem-row")).length).toBe(20);
  });

  it("renders the remaining problems when moving to page 2", async () => {
    const user = userEvent.setup();
    render(<Overview dataProvider={makeProvider(makeManyProblems(45))} {...props} />);

    await screen.findByText("45 problemas");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));

    expect(await screen.findByText("Problema 21")).toBeTruthy();
    expect(screen.queryByText("Problema 01")).toBeNull();
    expect(screen.getAllByRole("listitem").filter((item) => item.classList.contains("overview-problem-row")).length).toBe(20);
  });

  it("paginates the already filtered and sorted result set, not the full unfiltered corpus", async () => {
    const problems = makeManyProblems(25);
    const user = userEvent.setup();
    render(<Overview dataProvider={makeProvider(problems)} {...props} />);

    await screen.findByText("25 problemas");
    await user.type(screen.getByLabelText("Pesquisar problemas"), "Problema 0");

    expect(await screen.findByText("9 problemas")).toBeTruthy();
    expect(screen.getAllByRole("listitem").filter((item) => item.classList.contains("overview-problem-row")).length).toBe(9);
  });

  it("resets to page 1 when the search query changes", async () => {
    const user = userEvent.setup();
    render(<Overview dataProvider={makeProvider(makeManyProblems(45))} {...props} />);

    await screen.findByText("45 problemas");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));
    await screen.findByText(/^Página 2 de 3/);

    await user.type(screen.getByLabelText("Pesquisar problemas"), "Problema");
    await screen.findByText(/^Página 1 de 3/);
  });

  it("resets to page 1 when the topic filter changes", async () => {
    const provider = makeProvider(makeManyProblems(45));
    provider.getRecord = async (id) => ({ id, type: "PRB-", file: "", record: { title: id, domain: ["MOB"] }, outgoingEdges: [], incomingEdges: [] });
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("45 problemas");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));
    await screen.findByText(/^Página 2 de 3/);

    await user.click(openDrawer());
    const drawer = screen.getByRole("group", { name: "Filtrar por tema" });
    await user.click(within(drawer).getByRole("button", { name: /^Mobilidade/ }));
    await screen.findByText(/^Página 1 de 3/);
  });

  it("resets to page 1 when the sort order changes", async () => {
    const user = userEvent.setup();
    render(<Overview dataProvider={makeProvider(makeManyProblems(45))} {...props} />);

    await screen.findByText("45 problemas");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));
    await screen.findByText(/^Página 2 de 3/);

    // Default order is already updatedAt (Overview visual-convergence
    // pass), so this must switch to the other order (id) to genuinely
    // exercise a sort-order change.
    await user.selectOptions(screen.getByLabelText("Ordenar por"), "Identificador ↑");
    await screen.findByText(/^Página 1 de 3/);
  });

  it("keeps the toolbar count as the total filtered count, not the current page's row count", async () => {
    render(<Overview dataProvider={makeProvider(makeManyProblems(45))} {...props} />);

    expect(await screen.findByText("45 problemas")).toBeTruthy();
  });

  it("renders no pagination controls when the filtered result set fits on one page (<=20 results)", async () => {
    render(<Overview dataProvider={makeProvider(makeManyProblems(20))} {...props} />);

    await screen.findByText("20 problemas");
    expect(document.querySelector(".overview-pagination-actions")).toBeNull();
  });

  it("still paginates once the filtered result set exceeds 20 results", async () => {
    render(<Overview dataProvider={makeProvider(makeManyProblems(21))} {...props} />);

    await screen.findByText("21 problemas");
    expect(document.querySelector(".overview-pagination-actions")).not.toBeNull();
    expect(screen.getByText("Página 1 de 2 · 21 problemas")).toBeTruthy();
  });

  it("disables Anterior on the first page and Seguinte on the final page", async () => {
    const user = userEvent.setup();
    render(<Overview dataProvider={makeProvider(makeManyProblems(21))} {...props} />);

    await screen.findByText("21 problemas");
    const previous = screen.getByRole("button", { name: "Anterior" }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "Seguinte" }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    await user.click(next);
    await screen.findByText("Página 2 de 2 · 21 problemas");
    expect((screen.getByRole("button", { name: "Anterior" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Seguinte" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Overview — end-of-results row", () => {
  function makeManyProblems(count: number) {
    return Array.from({ length: count }, (_, index) => {
      const id = `PRB-${String(index + 1).padStart(4, "0")}`;
      return { id, type: "PRB-" as const, label: `Problema ${String(index + 1).padStart(2, "0")}`, file: "", summaryFields: {} };
    });
  }

  it("renders the truthful N de N problemas status for a single-page result set", async () => {
    render(<Overview dataProvider={makeProvider(makeManyProblems(6))} {...props} />);

    await screen.findByText("6 problemas");
    expect(screen.getByText("6 de 6 problemas")).toBeTruthy();
  });

  it("renders no end-of-results row when there are zero results", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    await user.type(screen.getByLabelText("Pesquisar problemas"), "inexistente");

    await screen.findByText("Nenhum problema corresponde à pesquisa.");
    expect(document.querySelector(".overview-end-of-results")).toBeNull();
  });

  it("links Propor um problema to /contact in the end-of-results row", async () => {
    render(<Overview dataProvider={makeProvider(makeManyProblems(6))} {...props} />);

    await screen.findByText("6 problemas");
    const link = screen.getByRole("link", { name: "Propor um problema" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/contact");
  });

  it("keeps Propor um problema available on a multi-page result set alongside the paginator", async () => {
    render(<Overview dataProvider={makeProvider(makeManyProblems(21))} {...props} />);

    await screen.findByText("21 problemas");
    expect(screen.getByRole("link", { name: "Propor um problema" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Seguinte" })).toBeTruthy();
  });
});

/**
 * Material-change integration (Overview final redesign, Phase 2;
 * weekly-emphasis correction). Overview derives both the row-level changed
 * treatment and the `Alterados esta semana` shortcut from the same canonical
 * PRB `history[]` reads it already performs for `CitizenProblem` projection
 * — no second fetch, no `updated_at` fallback — and, since the correction,
 * from the same `Europe/Lisbon` civil-week membership: a Problem only gets
 * the changed-row treatment when it also qualifies for the shortcut.
 * `overviewStats.test.ts` covers the underlying pure helpers directly; these
 * tests protect the end-to-end wiring and the drawer/filter composition
 * rules.
 */
describe("Overview — material-change row treatment", () => {
  function providerWithHistory(problems: { id: string; label: string; history?: { date: string; summary: string }[]; domain?: string[] }[]): DataProvider {
    const index: RecordSummary[] = problems.map((p) => ({ id: p.id, type: "PRB-", label: p.label, file: "", summaryFields: {} }));
    return {
      getManifest: async () => { throw new Error("unused"); },
      listRecords: async () => index,
      getEdges: async () => [],
      getRecord: async (id) => {
        const p = problems.find((entry) => entry.id === id)!;
        return { id, type: "PRB-", file: "", record: { title: p.label, domain: p.domain ?? [], history: p.history }, outgoingEdges: [], incomingEdges: [] };
      },
    };
  }

  it("gives a Problem changed this civil week the changed-row variant and a marker with the authored date", async () => {
    const monday = thisWeekMonday();
    const provider = providerWithHistory([
      { id: "PRB-1", label: "Problema com alteração", history: [{ date: monday, summary: "Alteração registada." }] },
      { id: "PRB-2", label: "Problema sem alteração" },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema com alteração");
    const changedRow = screen.getByText("Problema com alteração").closest(".overview-problem-row");
    expect(changedRow?.classList.contains("overview-problem-row--changed")).toBe(true);
    expect(within(changedRow as HTMLElement).getByText("ALTERAÇÃO REGISTADA")).toBeTruthy();

    const unchangedRow = screen.getByText("Problema sem alteração").closest(".overview-problem-row");
    expect(unchangedRow?.classList.contains("overview-problem-row--changed")).toBe(false);
    expect(within(unchangedRow as HTMLElement).queryByText("ALTERAÇÃO REGISTADA")).toBeNull();
  });

  it("renders a Problem whose only history entry is outside the current civil week on the normal neutral row path", async () => {
    // A genuinely historical material change — weeks in the past relative to
    // any real "now" this suite runs under — must not receive the changed-row
    // treatment or marker (weekly-emphasis correction, §1): row emphasis is
    // "changed this week", not "has ever had a canonical history entry".
    const provider = providerWithHistory([
      { id: "PRB-1", label: "Problema com histórico antigo", history: [{ date: "2020-01-06", summary: "Alteração histórica." }] },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema com histórico antigo");
    const row = screen.getByText("Problema com histórico antigo").closest(".overview-problem-row");
    expect(row?.classList.contains("overview-problem-row--changed")).toBe(false);
    expect(within(row as HTMLElement).queryByText("ALTERAÇÃO REGISTADA")).toBeNull();
  });

  it("uses the newest qualifying (this-week) history entry when a Problem has several, never an older one", async () => {
    const monday = thisWeekMonday();
    const provider = providerWithHistory([
      {
        id: "PRB-1",
        label: "Problema com várias alterações",
        history: [
          { date: "2020-01-06", summary: "Muito antiga, fora da semana." },
          { date: monday, summary: "Mais recente qualificável." },
        ],
      },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema com várias alterações");
    const row = screen.getByText("Problema com várias alterações").closest(".overview-problem-row");
    expect(row?.classList.contains("overview-problem-row--changed")).toBe(true);
    expect(within(row as HTMLElement).getByText(formatMarkerDate(monday))).toBeTruthy();
  });

  it("does not block or drop a Problem from the normal list when its detail read fails", async () => {
    const provider = providerWithHistory([{ id: "PRB-1", label: "Problema saudável" }]);
    provider.getRecord = async (id) => {
      if (id === "PRB-2") throw new Error("falha ao ler PRB-2");
      return { id, type: "PRB-", file: "", record: { title: "Problema saudável" }, outgoingEdges: [], incomingEdges: [] };
    };
    provider.listRecords = async () => [
      { id: "PRB-1", type: "PRB-", label: "Problema saudável", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema com falha de leitura", file: "", summaryFields: {} },
    ];
    render(<Overview dataProvider={provider} {...props} />);

    // Both Problems remain in the list; the failed one just never gets the
    // changed-row treatment (its fallback empty record carries no history).
    await screen.findByText("Problema saudável");
    expect(screen.getByText("2 problemas")).toBeTruthy();
    const failedRow = screen.getByText("Problema com falha de leitura").closest(".overview-problem-row");
    expect(failedRow?.classList.contains("overview-problem-row--changed")).toBe(false);
  });
});

describe("Overview — Alterados esta semana shortcut", () => {
  function providerWithHistory(problems: { id: string; label: string; history?: { date: string; summary: string }[]; domain?: string[] }[]): DataProvider {
    const index: RecordSummary[] = problems.map((p) => ({ id: p.id, type: "PRB-", label: p.label, file: "", summaryFields: {} }));
    return {
      getManifest: async () => { throw new Error("unused"); },
      listRecords: async () => index,
      getEdges: async () => [],
      getRecord: async (id) => {
        const p = problems.find((entry) => entry.id === id)!;
        return { id, type: "PRB-", file: "", record: { title: p.label, domain: p.domain ?? [], history: p.history }, outgoingEdges: [], incomingEdges: [] };
      },
    };
  }

  it("always renders the shortcut in the open drawer, including at a truthful count of 0", async () => {
    const provider = providerWithHistory([{ id: "PRB-1", label: "Problema sem alterações" }]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema sem alterações");
    await user.click(openDrawer());

    const shortcut = screen.getByRole("button", { name: /^Alterados esta semana/ });
    expect(shortcut.textContent?.replace(/\s+/g, " ").trim()).toBe("Alterados esta semana 0");
  });

  it("counts distinct Problems with a qualifying entry this civil week, not raw entry count", async () => {
    const monday = thisWeekMonday();
    const provider = providerWithHistory([
      { id: "PRB-1", label: "Duas alterações esta semana", history: [{ date: monday, summary: "Primeira." }, { date: monday, summary: "Segunda." }] },
      { id: "PRB-2", label: "Sem alterações" },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Duas alterações esta semana");
    await user.click(openDrawer());

    expect(screen.getByRole("button", { name: /^Alterados esta semana/ }).textContent).toMatch(/1$/);
  });

  it("agrees exactly with the number of changed-row-variant rows rendered (weekly-emphasis correction)", async () => {
    const monday = thisWeekMonday();
    const provider = providerWithHistory([
      { id: "PRB-1", label: "Alterado esta semana", history: [{ date: monday, summary: "Alteração." }] },
      { id: "PRB-2", label: "Histórico antigo", history: [{ date: "2020-01-06", summary: "Alteração histórica." }] },
      { id: "PRB-3", label: "Nunca alterado" },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Alterado esta semana");
    await user.click(openDrawer());

    const shortcutCount = screen.getByRole("button", { name: /^Alterados esta semana/ }).textContent?.match(/(\d+)$/)?.[1];
    expect(shortcutCount).toBe("1");

    const changedRows = document.querySelectorAll(".overview-problem-row--changed");
    expect(changedRows.length).toBe(1);
    expect(screen.getByText("Alterado esta semana").closest(".overview-problem-row")).toBe(changedRows[0]);
  });

  it("renders zero changed-row variants when the shortcut truthfully reports 0", async () => {
    const provider = providerWithHistory([
      { id: "PRB-1", label: "Histórico antigo", history: [{ date: "2020-01-06", summary: "Alteração histórica." }] },
      { id: "PRB-2", label: "Nunca alterado" },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Histórico antigo");
    await user.click(openDrawer());

    const shortcut = screen.getByRole("button", { name: /^Alterados esta semana/ });
    expect(shortcut.textContent?.replace(/\s+/g, " ").trim()).toBe("Alterados esta semana 0");
    expect(document.querySelectorAll(".overview-problem-row--changed").length).toBe(0);
    expect(screen.queryByText("ALTERAÇÃO REGISTADA")).toBeNull();
  });

  it("selecting the shortcut filters to only qualifying Problems and composes with search", async () => {
    const monday = thisWeekMonday();
    const provider = providerWithHistory([
      { id: "PRB-1", label: "Mobilidade alterada", history: [{ date: monday, summary: "Alteração." }] },
      { id: "PRB-2", label: "Mobilidade sem alteração" },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Mobilidade alterada");
    await user.click(openDrawer());
    await user.click(screen.getByRole("button", { name: /^Alterados esta semana/ }));

    expect(await screen.findByText("1 problemas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explorar Mobilidade alterada" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Explorar Mobilidade sem alteração" })).toBeNull();

    await user.type(screen.getByLabelText("Pesquisar problemas"), "inexistente");
    expect(await screen.findByText("0 problemas")).toBeTruthy();
  });

  it("selecting a normal topic clears the shortcut selection", async () => {
    const monday = thisWeekMonday();
    const provider = providerWithHistory([
      { id: "PRB-1", label: "Problema alterado", domain: ["MOB"], history: [{ date: monday, summary: "Alteração." }] },
      { id: "PRB-2", label: "Outro problema", domain: ["PUB"] },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema alterado");
    await user.click(openDrawer());
    await user.click(screen.getByRole("button", { name: /^Alterados esta semana/ }));
    expect(screen.getByRole("button", { name: /^Alterados esta semana/ }).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: /^Mobilidade/ }));
    expect(screen.getByRole("button", { name: /^Alterados esta semana/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /^Mobilidade/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("selecting the shortcut clears the normal topic selection", async () => {
    const monday = thisWeekMonday();
    const provider = providerWithHistory([
      { id: "PRB-1", label: "Problema alterado", domain: ["MOB"], history: [{ date: monday, summary: "Alteração." }] },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema alterado");
    await user.click(openDrawer());
    await user.click(screen.getByRole("button", { name: /^Mobilidade/ }));
    expect(screen.getByRole("button", { name: /^Mobilidade/ }).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: /^Alterados esta semana/ }));
    expect(screen.getByRole("button", { name: /^Mobilidade/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /^Alterados esta semana/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("selecting Todos clears both the topic filter and the shortcut", async () => {
    const monday = thisWeekMonday();
    const provider = providerWithHistory([
      { id: "PRB-1", label: "Problema alterado", domain: ["MOB"], history: [{ date: monday, summary: "Alteração." }] },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema alterado");
    await user.click(openDrawer());
    await user.click(screen.getByRole("button", { name: /^Alterados esta semana/ }));
    expect(screen.getByRole("button", { name: /^Alterados esta semana/ }).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: /^Todos/ }));
    expect(screen.getByRole("button", { name: /^Alterados esta semana/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /^Todos/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("sort continues to compose with the shortcut selection", async () => {
    const monday = thisWeekMonday();
    const provider = providerWithHistory([
      { id: "PRB-1", label: "Problema A", history: [{ date: monday, summary: "Alteração." }] },
      { id: "PRB-2", label: "Problema B", history: [{ date: monday, summary: "Alteração." }] },
    ]);
    provider.getRecord = async (id) => {
      const base = id === "PRB-1"
        ? { title: "Problema A", history: [{ date: monday, summary: "Alteração." }], updated_at: "2026-01-01" }
        : { title: "Problema B", history: [{ date: monday, summary: "Alteração." }], updated_at: "2026-06-01" };
      return { id, type: "PRB-", file: "", record: base, outgoingEdges: [], incomingEdges: [] };
    };
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema A");
    await user.click(openDrawer());
    await user.click(screen.getByRole("button", { name: /^Alterados esta semana/ }));
    await user.selectOptions(screen.getByLabelText("Ordenar por"), "Última atualização ↓");

    const titles = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
    expect(titles).toEqual(["Problema B", "Problema A"]);
  });

  it("resets to page 1 when the shortcut selection changes", async () => {
    const monday = thisWeekMonday();
    const problems = Array.from({ length: 45 }, (_, index) => {
      const id = `PRB-${String(index + 1).padStart(4, "0")}`;
      return { id, label: `Problema ${String(index + 1).padStart(2, "0")}`, history: [{ date: monday, summary: "Alteração." }] };
    });
    const provider = providerWithHistory(problems);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("45 problemas");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));
    await screen.findByText(/^Página 2 de 3/);

    await user.click(openDrawer());
    await user.click(screen.getByRole("button", { name: /^Alterados esta semana/ }));
    await screen.findByText(/^Página 1 de 3/);
  });

  it("gives Filtros the restrained active state and names the shortcut in its accessible name when selected and the drawer is closed", async () => {
    const monday = thisWeekMonday();
    const provider = providerWithHistory([{ id: "PRB-1", label: "Problema alterado", history: [{ date: monday, summary: "Alteração." }] }]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema alterado");
    const toggle = openDrawer();
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: /^Alterados esta semana/ }));
    await user.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Filtros — Alterados esta semana" })).toBeTruthy();
    expect(toggle.getAttribute("data-active")).toBe("true");
  });
});

/**
 * Lisbon civil-date-boundary hardening: Overview owns exactly one current
 * `Europe/Lisbon` civil-date value (`useLisbonCivilDate`) and derives both
 * the row-level changed treatment and the `Alterados esta semana`
 * shortcut/count from that same value, rather than each calling
 * `new Date()`/`getLisbonCivilDate()` independently. These tests protect
 * that shared-input agreement and the boundary-crossing refresh behaviour;
 * `overviewStats.test.ts` covers the underlying civil-date-input helpers
 * directly.
 */
describe("Overview — Lisbon civil-date-boundary hardening", () => {
  function providerWithHistory(problems: { id: string; label: string; history?: { date: string; summary: string }[]; domain?: string[] }[]): DataProvider {
    const index: RecordSummary[] = problems.map((p) => ({ id: p.id, type: "PRB-", label: p.label, file: "", summaryFields: {} }));
    return {
      getManifest: async () => { throw new Error("unused"); },
      listRecords: async () => index,
      getEdges: async () => [],
      getRecord: async (id) => {
        const p = problems.find((entry) => entry.id === id)!;
        return { id, type: "PRB-", file: "", record: { title: p.label, domain: p.domain ?? [], history: p.history }, outgoingEdges: [], incomingEdges: [] };
      },
    };
  }

  it("keeps the shortcut count and the changed-row count in agreement across a Sunday-to-Monday civil-week boundary", async () => {
    // A material change dated the Sunday immediately before this week's
    // Monday: outside the current civil week, so both projections must agree
    // it does not qualify — proving they are being evaluated against the
    // same reference civil date, not two independently-resolved ones that
    // could disagree right at the boundary.
    const monday = thisWeekMonday();
    const previousSunday = previousCivilDate(monday);
    const provider = providerWithHistory([
      { id: "PRB-1", label: "Alterado no domingo anterior", history: [{ date: previousSunday, summary: "Antes da semana atual." }] },
      { id: "PRB-2", label: "Alterado na segunda-feira desta semana", history: [{ date: monday, summary: "Nesta semana." }] },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Alterado na segunda-feira desta semana");
    await user.click(openDrawer());

    const shortcutCount = screen.getByRole("button", { name: /^Alterados esta semana/ }).textContent?.match(/(\d+)$/)?.[1];
    expect(shortcutCount).toBe("1");

    const changedRows = document.querySelectorAll(".overview-problem-row--changed");
    expect(changedRows.length).toBe(1);
    expect(screen.getByText("Alterado na segunda-feira desta semana").closest(".overview-problem-row")).toBe(changedRows[0]);

    const sundayRow = screen.getByText("Alterado no domingo anterior").closest(".overview-problem-row");
    expect(sundayRow?.classList.contains("overview-problem-row--changed")).toBe(false);
  });

  it("refreshes the weekly projection when the Lisbon civil date crosses into a new day, without remounting", async () => {
    const monday = thisWeekMonday();
    // One civil week forward from this week's Monday, via the same
    // whole-day UTC-anchored arithmetic `previousCivilDate` already uses
    // (carries no timezone meaning of its own).
    const [year, month, day] = monday.split("-").map(Number);
    const followingMonday = new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10);

    const provider = providerWithHistory([
      { id: "PRB-1", label: "Problema com alteração futura", history: [{ date: followingMonday, summary: "Alteração da próxima semana." }] },
    ]);

    // Fake timers are enabled before mount, so the interval timer
    // `useLisbonCivilDate` registers on mount is itself the fake one (a
    // real timer registered before `vi.useFakeTimers()` would keep running
    // on the real clock and never fire from `advanceTimersByTimeAsync`
    // below). Fake timers do not block microtasks/Promises, so the
    // component's async provider reads still resolve normally. `fireEvent`
    // (not `userEvent`) is used throughout once fake timers are active,
    // since `userEvent`'s own internal delay simulation depends on a
    // running clock.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(`${monday}T12:00:00.000Z`));
      render(<Overview dataProvider={provider} {...props} />);
      // The provider's reads resolve via microtasks, not timers, so a plain
      // `act`-flush (no time advance) is enough to settle the initial data
      // load under fake timers — `screen.findByText`'s own internal polling
      // uses `setTimeout` and would otherwise stall with the clock frozen.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText("Problema com alteração futura")).toBeTruthy();
      fireEvent.click(openDrawer());

      // Still this week's Monday: the following week's entry does not
      // qualify yet.
      expect(screen.getByRole("button", { name: /^Alterados esta semana/ }).textContent).toMatch(/0$/);
      expect(document.querySelectorAll(".overview-problem-row--changed").length).toBe(0);

      // Advance wall-clock time to the following Monday and let the
      // interval timer inside `useLisbonCivilDate` observe the change — the
      // component itself is never remounted or re-rendered by this call
      // alone; only the timer firing triggers the state update. Wrapped in
      // `act` so the resulting `setState` inside the timer callback is
      // flushed into a render before the assertions below read the DOM.
      vi.setSystemTime(new Date(`${followingMonday}T12:00:00.000Z`));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      expect(screen.getByRole("button", { name: /^Alterados esta semana/ }).textContent).toMatch(/1$/);
      const changedRow = screen.getByText("Problema com alteração futura").closest(".overview-problem-row");
      expect(changedRow?.classList.contains("overview-problem-row--changed")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Overview — error state retry (ODM-021)", () => {
  it("retries a failed listRecords load and recovers", async () => {
    let attempts = 0;
    const provider: DataProvider = {
      getManifest: async () => { throw new Error("unused"); },
      listRecords: () =>
        attempts++ === 0
          ? Promise.reject(new DataLoadError("falha temporária", "network"))
          : Promise.resolve([{ id: "PRB-9", type: "PRB-", label: "Problema recuperado", file: "", summaryFields: {} }]),
      getEdges: async () => [],
      getRecord: async (id) => ({ id, type: "PRB-", file: "", record: { title: "Problema recuperado" }, outgoingEdges: [], incomingEdges: [] }),
    };
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("falha temporária");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByText("PRB-9");
    expect(attempts).toBe(2);
  });
});
