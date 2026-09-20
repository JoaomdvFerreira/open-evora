import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Overview } from "./Overview";
import { DataLoadError, type DataProvider, type RecordDetail, type RecordSummary } from "../dataProvider/types";

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

  it("renders exactly the three intended Hero metric concepts — problems, evidence records, primary sources", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema um", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema dois", file: "", summaryFields: {} },
      { id: "EVD-1", type: "EVD-", label: "Evidência um", file: "", summaryFields: {} },
      { id: "EVD-2", type: "EVD-", label: "Evidência dois", file: "", summaryFields: {} },
      { id: "EVD-3", type: "EVD-", label: "Evidência três", file: "", summaryFields: {} },
      { id: "SRC-1", type: "SRC-", label: "Fonte", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const problemMetric = (await screen.findByText("2", { selector: ".overview-metric-value" })).closest(".overview-metric");
    expect(problemMetric?.querySelector(".overview-metric-label")?.textContent).toBe("Problemas acompanhados");

    const evidenceMetric = screen.getByText("3", { selector: ".overview-metric-value" }).closest(".overview-metric");
    expect(evidenceMetric?.querySelector(".overview-metric-label")?.textContent).toBe("Registos de evidência");

    const sourceMetric = screen.getByText("1", { selector: ".overview-metric-value" }).closest(".overview-metric");
    expect(sourceMetric?.querySelector(".overview-metric-label")?.textContent).toBe("Fonte primária");

    expect(document.querySelectorAll(".overview-metric").length).toBe(3);
    expect(screen.queryByText(/Registo total|Registos totais/)).toBeNull();
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

  it("renders the complete canonical topic vocabulary with real, unfiltered counts, not only topics present on loaded Problems", async () => {
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
    // A topic absent from the loaded Problems is still rendered, with a genuinely zero count.
    expect(within(drawer).getByRole("button", { name: /^Digital/ }).textContent).toMatch(/0$/);
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
    const problems = Array.from({ length: 15 }, (_, index) => {
      const id = `PRB-${String(index + 1).padStart(4, "0")}`;
      return { id, type: "PRB-" as const, label: `Problema ${String(index + 1).padStart(2, "0")}`, file: "", summaryFields: {} };
    });
    render(<Overview dataProvider={makeProvider(problems)} {...props} />);

    // 15 filtered results, even though only 10 rows render on page 1.
    expect(await screen.findByText("15 problemas")).toBeTruthy();
    expect(screen.getAllByRole("listitem").filter((item) => item.classList.contains("overview-problem-row")).length).toBe(10);
  });

  it("does not render the former active-filter-summary text line", async () => {
    const provider = makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Problema");
    expect(screen.queryByText("sem filtros ativos")).toBeNull();
    expect(document.querySelector(".overview-results-filter-summary")).toBeNull();
  });

  it("still applies the existing sort ordering via the toolbar sort control", async () => {
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
    await user.selectOptions(screen.getByLabelText("Ordenar por"), "última atualização");

    const titles = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
    expect(titles).toEqual(["Problema dois", "Problema um"]);
  });
});

describe("Overview — problem-list pagination", () => {
  function makeManyProblems(count: number, overrides: (index: number) => Partial<RecordSummary["summaryFields"]> = () => ({})) {
    return Array.from({ length: count }, (_, index) => {
      const id = `PRB-${String(index + 1).padStart(4, "0")}`;
      return { id, type: "PRB-" as const, label: `Problema ${String(index + 1).padStart(2, "0")}`, file: "", summaryFields: overrides(index) };
    });
  }

  it("renders at most 10 problem rows on page 1 even when more results are available", async () => {
    render(<Overview dataProvider={makeProvider(makeManyProblems(25))} {...props} />);

    await screen.findByText("25 problemas");
    expect(screen.getAllByRole("listitem").filter((item) => item.classList.contains("overview-problem-row")).length).toBe(10);
  });

  it("renders the remaining problems when moving to page 2", async () => {
    const user = userEvent.setup();
    render(<Overview dataProvider={makeProvider(makeManyProblems(25))} {...props} />);

    await screen.findByText("25 problemas");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));

    expect(await screen.findByText("Problema 11")).toBeTruthy();
    expect(screen.queryByText("Problema 01")).toBeNull();
    expect(screen.getAllByRole("listitem").filter((item) => item.classList.contains("overview-problem-row")).length).toBe(10);
  });

  it("paginates the already filtered and sorted result set, not the full unfiltered corpus", async () => {
    const problems = makeManyProblems(15);
    const user = userEvent.setup();
    render(<Overview dataProvider={makeProvider(problems)} {...props} />);

    await screen.findByText("15 problemas");
    await user.type(screen.getByLabelText("Pesquisar problemas"), "Problema 0");

    expect(await screen.findByText("9 problemas")).toBeTruthy();
    expect(screen.getAllByRole("listitem").filter((item) => item.classList.contains("overview-problem-row")).length).toBe(9);
  });

  it("resets to page 1 when the search query changes", async () => {
    const user = userEvent.setup();
    render(<Overview dataProvider={makeProvider(makeManyProblems(25))} {...props} />);

    await screen.findByText("25 problemas");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));
    await screen.findByText("Página 2 de 3");

    await user.type(screen.getByLabelText("Pesquisar problemas"), "Problema");
    await screen.findByText("Página 1 de 3");
  });

  it("resets to page 1 when the topic filter changes", async () => {
    const provider = makeProvider(makeManyProblems(25));
    provider.getRecord = async (id) => ({ id, type: "PRB-", file: "", record: { title: id, domain: ["MOB"] }, outgoingEdges: [], incomingEdges: [] });
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("25 problemas");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));
    await screen.findByText("Página 2 de 3");

    await user.click(openDrawer());
    const drawer = screen.getByRole("group", { name: "Filtrar por tema" });
    await user.click(within(drawer).getByRole("button", { name: /^Mobilidade/ }));
    await screen.findByText("Página 1 de 3");
  });

  it("resets to page 1 when the sort order changes", async () => {
    const user = userEvent.setup();
    render(<Overview dataProvider={makeProvider(makeManyProblems(25))} {...props} />);

    await screen.findByText("25 problemas");
    await user.click(screen.getByRole("button", { name: "Seguinte" }));
    await screen.findByText("Página 2 de 3");

    await user.selectOptions(screen.getByLabelText("Ordenar por"), "última atualização");
    await screen.findByText("Página 1 de 3");
  });

  it("keeps the toolbar count as the total filtered count, not the current page's row count", async () => {
    render(<Overview dataProvider={makeProvider(makeManyProblems(25))} {...props} />);

    expect(await screen.findByText("25 problemas")).toBeTruthy();
  });

  it("renders no pagination footer when the result set fits on one page", async () => {
    render(<Overview dataProvider={makeProvider(makeManyProblems(10))} {...props} />);

    await screen.findByText("10 problemas");
    expect(document.querySelector(".overview-pagination-footer")).toBeNull();
  });

  it("renders the pagination footer only once there are more than 10 results", async () => {
    render(<Overview dataProvider={makeProvider(makeManyProblems(11))} {...props} />);

    await screen.findByText("11 problemas");
    expect(document.querySelector(".overview-pagination-footer")).not.toBeNull();
    expect(screen.getByText("Página 1 de 2")).toBeTruthy();
  });

  it("disables Anterior on the first page and Seguinte on the final page", async () => {
    const user = userEvent.setup();
    render(<Overview dataProvider={makeProvider(makeManyProblems(11))} {...props} />);

    await screen.findByText("11 problemas");
    const previous = screen.getByRole("button", { name: "Anterior" }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "Seguinte" }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    await user.click(next);
    await screen.findByText("Página 2 de 2");
    expect((screen.getByRole("button", { name: "Anterior" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Seguinte" }) as HTMLButtonElement).disabled).toBe(true);
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
