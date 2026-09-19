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

const props = { onExploreProblem: vi.fn(), onViewRecords: vi.fn() };

describe("Overview — Problem investigation-state dimensions", () => {
  // The editorial problem-list row (Overview visual-completion) shows two of
  // the three investigation-state dimensions inline: evidenceStatus via the
  // existing restrained `reading` chip, lifecycleStatus as plain secondary
  // text (no caption prefix, no chip — the row's own position already reads
  // as "this Problem's state"). validationStatus is deliberately not
  // repeated per row: it remains available through the canonical VALIDAÇÃO
  // filter rail (Overview.test.tsx's filter-rail assertions cover it), never
  // merged into either of the other two dimensions.
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
    // Scoped to the row itself — the page-wide "Aberto" text in the ESTADO
    // filter rail's own always-rendered option (filter-rail correction pass
    // §3, complete vocabulary regardless of this Problem's own lifecycle
    // status) is unrelated to this assertion.
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
    // Plain string comparison ("PRB-10" < "PRB-2" < "PRB-9") — the point under
    // test is that rendered order always matches ID.localeCompare, never
    // fetch/resolution order, not that it is numeric.
    expect(titles).toEqual(["Problema dez", "Problema dois", "Problema nove"]);
  });

  it("labels the citizen search control per the approved copy", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const input = (await screen.findByLabelText("Pesquisar problemas")) as HTMLInputElement;
    expect(input.placeholder).toBe("Pesquisar problemas em Évora…");
  });

  it("labels the Hero primary action with the canonical Problem count and points it at the in-page Problem list", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema um", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema dois", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const cta = await screen.findByRole("link", { name: "Ver os 2 problemas" });
    expect(cta.getAttribute("href")).toBe("#overview-problemas");
  });

  it("announces the result-count and empty-state meaning through a polite live region as search state changes", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema digital", file: "", summaryFields: {} },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);

    const resultsCount = await screen.findByText("2 de 2 problemas");
    const liveRegion = resultsCount.closest('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute("aria-atomic")).toBe("true");

    const input = screen.getByLabelText("Pesquisar problemas");
    await user.type(input, "inexistente");

    const emptyState = await within(liveRegion as HTMLElement).findByText(
      "Nenhum problema corresponde à pesquisa."
    );
    expect(emptyState.closest('[aria-live="polite"]')).toBe(liveRegion);
  });

  it("keeps Problem rows outside the atomic result announcement and names each row's primary action by title", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema digital", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    // The whole row is the primary click action (Overview visual-completion —
    // editorial list redesign), named by the Problem's title, same as the
    // former dedicated "Explorar →" action was.
    const firstAction = await screen.findByRole("button", { name: "Explorar Problema de mobilidade" });
    expect(screen.getByRole("button", { name: "Explorar Problema digital" })).toBeTruthy();
    expect(firstAction.closest('[aria-live="polite"]')).toBeNull();
  });
});

describe("Overview — filter rail vocabulary (filter-rail correction pass)", () => {
  // The rail must expose the complete project filter vocabulary, not only
  // values present in the currently visible/loaded result subset — this is a
  // single-Problem fixture, deliberately carrying only one value per
  // dimension, so every other canonical option below is provable as present
  // with a genuinely zero count rather than merely absent from the fixture.
  const singleProblemProvider = () =>
    makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema único", file: "", summaryFields: { status: "OPEN", validation_status: "validated", evidence_status: "corroborated" } },
    ]);

  it("shows every canonical evidence_status/validation_status option, zero-filled, not only the value present on loaded Problems", async () => {
    render(<Overview dataProvider={singleProblemProvider()} {...props} />);
    await screen.findByText("Problema único");

    const evidenceGroup = screen.getByRole("group", { name: "Evidência" });
    expect(within(evidenceGroup).getByRole("button", { name: /Identificada/ }).textContent).toMatch(/0$/);
    expect(within(evidenceGroup).getByRole("button", { name: /Corroborada/ }).textContent).toMatch(/1$/);

    const validationGroup = screen.getByRole("group", { name: "Validação" });
    expect(within(validationGroup).getByRole("button", { name: /Por validar/ }).textContent).toMatch(/0$/);
    expect(within(validationGroup).getByRole("button", { name: /Parcialmente validada/ }).textContent).toMatch(/0$/);
    expect(within(validationGroup).getByRole("button", { name: /Validada/ }).textContent).toMatch(/1$/);
  });

  it("exposes ESTADO as only Aberto/Fechado, never a raw lifecycle status or an evidence/validation concept", async () => {
    render(<Overview dataProvider={singleProblemProvider()} {...props} />);
    await screen.findByText("Problema único");

    const estadoGroup = screen.getByRole("group", { name: "Estado" });
    const options = within(estadoGroup).getAllByRole("button").map((button) => button.textContent?.replace(/\s+/g, " ").trim());
    expect(options).toEqual(["Aberto 1", "Fechado 0"]);
    expect(within(estadoGroup).queryByText(/Evidência insuficiente/)).toBeNull();
  });

  // Filter-rail correction pass §3: EVIDÊNCIA/VALIDAÇÃO/ESTADO no longer show
  // a visible "Todos" reset row (their internal no-filter state stays reachable
  // by clicking the active option again — see the "clears" test below); TEMA
  // keeps its visible "Todos" as the explicit topic-filter reset.
  it("shows no visible 'Todos' option in Evidência/Validação/Estado, while Tema keeps it", async () => {
    render(<Overview dataProvider={singleProblemProvider()} {...props} />);
    await screen.findByText("Problema único");

    expect(within(screen.getByRole("group", { name: "Tema" })).getByRole("button", { name: /^Todos/ })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Evidência" })).queryByRole("button", { name: /^Todos/ })).toBeNull();
    expect(within(screen.getByRole("group", { name: "Validação" })).queryByRole("button", { name: /^Todos/ })).toBeNull();
    expect(within(screen.getByRole("group", { name: "Estado" })).queryByRole("button", { name: /^Todos/ })).toBeNull();
  });

  it("clicking the already-selected Evidência/Validação/Estado option clears that dimension back to its internal no-filter state, leaving no option selected", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema aberto corroborado", file: "", summaryFields: { status: "OPEN", validation_status: "validated", evidence_status: "corroborated" } },
      { id: "PRB-2", type: "PRB-", label: "Problema fechado por validar", file: "", summaryFields: { status: "REJECTED", validation_status: "unvalidated", evidence_status: "discovered" } },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);
    await screen.findByText("Problema aberto corroborado");

    const estadoGroup = screen.getByRole("group", { name: "Estado" });
    const aberto = within(estadoGroup).getByRole("button", { name: /Aberto/ });
    await user.click(aberto);
    expect(aberto.getAttribute("aria-pressed")).toBe("true");
    expect(await screen.findByText("1 de 2 problemas")).toBeTruthy();

    await user.click(aberto);
    expect(aberto.getAttribute("aria-pressed")).toBe("false");
    expect(within(estadoGroup).getAllByRole("button").every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(await screen.findByText("2 de 2 problemas")).toBeTruthy();
  });

  it("composes the ESTADO group filter with search/other rail filters, matching every closed status, not just the one loaded", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema aberto", file: "", summaryFields: { status: "OPEN" } },
      { id: "PRB-2", type: "PRB-", label: "Problema rejeitado", file: "", summaryFields: { status: "REJECTED" } },
    ]);
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);
    await screen.findByText("Problema rejeitado");

    const estadoGroup = screen.getByRole("group", { name: "Estado" });
    await user.click(within(estadoGroup).getByRole("button", { name: /Fechado/ }));

    expect(await screen.findByText("1 de 2 problemas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explorar Problema rejeitado" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Explorar Problema aberto" })).toBeNull();
  });
});

describe("Overview — Hero category shortcut filtering", () => {
  // Root cause regression: the Hero "Ou entre por:" shortcuts used to be
  // plain in-page anchors with no filter side effect at all. Clicking one
  // must now drive the exact same canonical TEMA/topic filter state the
  // rail's own TEMA group owns — never a second, parallel category-filter
  // implementation — so the two controls always agree on the result set.
  it("clicking a Hero category shortcut selects the matching TEMA option, filters to that canonical topic, and updates the results count and active-filter summary", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema de espaço público", file: "", summaryFields: {} },
    ]);
    provider.getRecord = async (id) => ({
      id,
      type: "PRB-",
      file: "",
      record: { title: id === "PRB-1" ? "Problema de mobilidade" : "Problema de espaço público", domain: id === "PRB-1" ? ["MOB"] : ["PUB"] },
      outgoingEdges: [],
      incomingEdges: [],
    });
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);
    await screen.findByText("Problema de mobilidade");

    const shortcut = screen.getByRole("link", { name: /Mobilidade/ });
    await user.click(shortcut);

    // Same canonical TEMA option in the rail is now selected.
    const temaGroup = screen.getByRole("group", { name: "Tema" });
    expect(within(temaGroup).getByRole("button", { name: /Mobilidade/ }).getAttribute("aria-pressed")).toBe("true");

    // Only the matching-topic Problem remains visible; the header count and
    // active-filter summary both update accordingly.
    expect(await screen.findByText("1 de 2 problemas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explorar Problema de mobilidade" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Explorar Problema de espaço público" })).toBeNull();
    expect(screen.getByText("Mobilidade", { selector: ".overview-results-filter-summary" })).toBeTruthy();
  });

  it("produces the same visible result set as selecting the same topic directly in the TEMA rail", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema de mobilidade", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema de espaço público", file: "", summaryFields: {} },
    ]);
    provider.getRecord = async (id) => ({
      id,
      type: "PRB-",
      file: "",
      record: { title: id === "PRB-1" ? "Problema de mobilidade" : "Problema de espaço público", domain: id === "PRB-1" ? ["MOB"] : ["PUB"] },
      outgoingEdges: [],
      incomingEdges: [],
    });
    const user = userEvent.setup();

    const viaShortcut = render(<Overview dataProvider={provider} {...props} />);
    await screen.findByText("Problema de mobilidade");
    await user.click(screen.getByRole("link", { name: /Mobilidade/ }));
    const viaShortcutIds = (await screen.findAllByRole("button", { name: /^Explorar/ })).map((button) => button.getAttribute("aria-label"));
    viaShortcut.unmount();

    const viaRail = render(<Overview dataProvider={provider} {...props} />);
    await screen.findByText("Problema de mobilidade");
    const temaGroup = screen.getByRole("group", { name: "Tema" });
    await user.click(within(temaGroup).getByRole("button", { name: /Mobilidade/ }));
    const viaRailIds = (await screen.findAllByRole("button", { name: /^Explorar/ })).map((button) => button.getAttribute("aria-label"));
    viaRail.unmount();

    expect(viaShortcutIds).toEqual(["Explorar Problema de mobilidade"]);
    expect(viaShortcutIds).toEqual(viaRailIds);
  });

  it("composes the Hero category shortcut's TEMA filter with search, Evidência, Validação, and Estado", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Mobilidade corroborada aberta", file: "", summaryFields: { status: "OPEN", evidence_status: "corroborated" } },
      { id: "PRB-2", type: "PRB-", label: "Mobilidade discovered fechada", file: "", summaryFields: { status: "REJECTED", evidence_status: "discovered" } },
      { id: "PRB-3", type: "PRB-", label: "Espaço público corroborado aberto", file: "", summaryFields: { status: "OPEN", evidence_status: "corroborated" } },
    ]);
    provider.getRecord = async (id) => {
      const domain = id === "PRB-3" ? ["PUB"] : ["MOB"];
      const title = id === "PRB-1" ? "Mobilidade corroborada aberta" : id === "PRB-2" ? "Mobilidade discovered fechada" : "Espaço público corroborado aberto";
      return { id, type: "PRB-", file: "", record: { title, domain, status: id === "PRB-2" ? "REJECTED" : "OPEN", evidence_status: id === "PRB-2" ? "discovered" : "corroborated" }, outgoingEdges: [], incomingEdges: [] };
    };
    const user = userEvent.setup();
    render(<Overview dataProvider={provider} {...props} />);
    await screen.findByText("Mobilidade corroborada aberta");

    await user.click(screen.getByRole("link", { name: /Mobilidade/ }));
    const evidenceGroup = screen.getByRole("group", { name: "Evidência" });
    await user.click(within(evidenceGroup).getByRole("button", { name: /Corroborada/ }));

    expect(await screen.findByText("1 de 3 problemas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explorar Mobilidade corroborada aberta" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Explorar Mobilidade discovered fechada" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Explorar Espaço público corroborado aberto" })).toBeNull();
  });
});

describe("Overview — results-footer removal", () => {
  // The former visual "X de Y" footer under the problem list was redundant
  // with the results header's own count (`overview-results-count`) and has
  // been removed outright (filter-rail correction pass §1); the header count
  // remains the sole result-count surface.
  it("does not render a results-footer count below the problem list", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema um", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema dois", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("2 de 2 problemas");
    expect(document.querySelector(".overview-results-footer")).toBeNull();
    expect(document.querySelectorAll(".overview-results-count").length).toBe(1);
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

describe("Overview — material-change timeline", () => {
  it("renders the neutral no-history state in the Hero recent-updates panel only after every Problem detail loads", async () => {
    render(<Overview dataProvider={makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }])} {...props} />);

    await screen.findByText("Atualizado recentemente");
    expect(screen.getByText("Ainda não existem alterações materiais registadas para apresentar.")).toBeTruthy();
    expect(screen.queryByText(/nunca mudou/i)).toBeNull();
  });
});

describe("Overview — metrics value/label separation", () => {
  it("renders each count metric's numeric value and PT-PT label as separate elements", async () => {
    const provider = makeProvider([
      { id: "PRB-1", type: "PRB-", label: "Problema um", file: "", summaryFields: {} },
      { id: "PRB-2", type: "PRB-", label: "Problema dois", file: "", summaryFields: {} },
    ]);
    render(<Overview dataProvider={provider} {...props} />);

    const problemMetric = (await screen.findByText("2", { selector: ".overview-metric-value" })).closest(".overview-metric");
    expect(problemMetric?.querySelector(".overview-metric-label")?.textContent).toBe("Problemas acompanhados");

    const evidenceValue = screen.getAllByText("0", { selector: ".overview-metric-value" })[0];
    expect(evidenceValue.closest(".overview-metric")?.querySelector(".overview-metric-label")?.textContent).toBe("Registos de evidência");
  });
});

describe("Overview — Hero recent-updates preview", () => {
  it("shows at most 4 authored material-change entries, each with its PRB id, canonical last-updated date, and topic", async () => {
    // updated_at deliberately differs from the authored history entry's own
    // date, so a passing assertion on "08/04/2026" proves the canonical
    // updatedAt is what renders here, not MaterialChangeEntry.date.
    const provider: DataProvider = {
      ...makeProvider([
        { id: "PRB-1", type: "PRB-", label: "Problema um", file: "", summaryFields: {} },
        { id: "PRB-2", type: "PRB-", label: "Problema dois", file: "", summaryFields: {} },
        { id: "PRB-3", type: "PRB-", label: "Problema três", file: "", summaryFields: {} },
        { id: "PRB-4", type: "PRB-", label: "Problema quatro", file: "", summaryFields: {} },
        { id: "PRB-5", type: "PRB-", label: "Problema cinco", file: "", summaryFields: {} },
        { id: "PRB-6", type: "PRB-", label: "Problema seis", file: "", summaryFields: {} },
      ]),
      getRecord: async (id) => ({
        id,
        type: "PRB-",
        file: "",
        record: { title: `Problema ${id}`, domain: ["MOB"], updated_at: "2026-04-08", history: [{ date: "2026-01-01", summary: "Alteração material registada." }] },
        outgoingEdges: [],
        incomingEdges: [],
      }),
    };
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Atualizado recentemente");
    const recentList = document.querySelector(".overview-hero-recent-list") as HTMLElement;
    const items = recentList.querySelectorAll("li");
    expect(items.length).toBe(4);

    const firstItem = items[0];
    expect(within(firstItem as HTMLElement).getByText("PRB-1")).toBeTruthy();
    expect(within(firstItem as HTMLElement).getByText("08/04/2026").tagName).toBe("TIME");
    expect(within(firstItem as HTMLElement).getByText(/Mobilidade/)).toBeTruthy();

    expect(screen.queryByRole("link", { name: "Ver tudo" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Abrir o explorador" })).toBeNull();
  });

  it("renders a Problem with multiple material-change entries once, using its newest entry, without crowding out other distinct Problems", async () => {
    // PRB-0007 authored two material-change entries (newest 2026-04-08, older
    // 2026-02-01); PRB-0003/0002/0001 authored one each. The panel must show
    // 4 distinct PRBs — PRB-0007 once, at its newest date — never PRB-0007
    // twice at the expense of a fifth distinct Problem.
    const histories: Record<string, { date: string; summary: string }[]> = {
      "PRB-0007": [
        { date: "2026-04-08", summary: "PRB-0007 mais recente." },
        { date: "2026-02-01", summary: "PRB-0007 mais antiga." },
      ],
      "PRB-0003": [{ date: "2026-03-01", summary: "PRB-0003 alteração." }],
      "PRB-0002": [{ date: "2026-02-15", summary: "PRB-0002 alteração." }],
      "PRB-0001": [{ date: "2026-01-01", summary: "PRB-0001 alteração." }],
    };
    const provider: DataProvider = {
      ...makeProvider(
        Object.keys(histories).map((id) => ({ id, type: "PRB-", label: `Problema ${id}`, file: "", summaryFields: {} }))
      ),
      getRecord: async (id) => ({
        id,
        type: "PRB-",
        file: "",
        record: { title: `Problema ${id}`, history: histories[id] },
        outgoingEdges: [],
        incomingEdges: [],
      }),
    };
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Atualizado recentemente");
    const recentList = document.querySelector(".overview-hero-recent-list") as HTMLElement;
    const items = recentList.querySelectorAll("li");
    expect(items.length).toBe(4);

    const renderedIds = [...items].map((item) => item.querySelector(".technical-id")?.textContent);
    expect(renderedIds).toEqual(["PRB-0007", "PRB-0003", "PRB-0002", "PRB-0001"]);
    // Newest entry retained, not the older one, for the deduplicated PRB.
    expect(within(items[0] as HTMLElement).getByText("Problema PRB-0007")).toBeTruthy();
  });

  it("opens Records from the recent-updates panel's 'Ver tudo' action, alongside the heading", async () => {
    const onViewRecords = vi.fn();
    render(
      <Overview
        dataProvider={makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }])}
        onExploreProblem={vi.fn()}
        onViewRecords={onViewRecords}
      />
    );

    const heading = await screen.findByText("Atualizado recentemente");
    const viewAll = screen.getByRole("button", { name: "Ver tudo" });
    expect(heading.closest(".overview-hero-recent-header")).toBe(viewAll.closest(".overview-hero-recent-header"));

    await userEvent.setup().click(viewAll);
    expect(onViewRecords).toHaveBeenCalledTimes(1);
  });

  it("omits the date rather than fabricating one when the canonical updatedAt is genuinely unavailable", async () => {
    const provider: DataProvider = {
      ...makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]),
      getRecord: async (id) => ({
        id,
        type: "PRB-",
        file: "",
        record: { title: "Problema sem updated_at", history: [{ date: "2026-04-08", summary: "Alteração material registada." }] },
        outgoingEdges: [],
        incomingEdges: [],
      }),
    };
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Atualizado recentemente");
    const recentList = document.querySelector(".overview-hero-recent-list") as HTMLElement;
    expect(within(recentList).getByText("PRB-1")).toBeTruthy();
    expect(recentList.querySelector("time")).toBeNull();
  });

  it("exposes the existing incomplete-history meaning when a Problem detail failed to load", async () => {
    const provider: DataProvider = {
      listRecords: async () => [
        { id: "PRB-1", type: "PRB-", label: "Problema um", file: "", summaryFields: {} },
        { id: "PRB-2", type: "PRB-", label: "Problema dois", file: "", summaryFields: {} },
      ],
      getManifest: async () => { throw new Error("unused"); },
      getEdges: async () => [],
      getRecord: async (id) => {
        if (id === "PRB-2") throw new Error("falha ao carregar PRB-2");
        return { id, type: "PRB-", file: "", record: { title: "Problema um", updated_at: "2026-04-08", history: [{ date: "2026-04-08", summary: "Alteração material registada." }] }, outgoingEdges: [], incomingEdges: [] };
      },
    };
    render(<Overview dataProvider={provider} {...props} />);

    await screen.findByText("Atualizado recentemente");
    expect(screen.getByText(/Histórico recente incompleto/)).toBeTruthy();
  });

  it("opens a recent-update item's owning Problem", async () => {
    const onExploreProblem = vi.fn();
    const provider: DataProvider = {
      ...makeProvider([{ id: "PRB-1", type: "PRB-", label: "Problema", file: "", summaryFields: {} }]),
      getRecord: async (id) => ({
        id,
        type: "PRB-",
        file: "",
        record: { title: "Problema do histórico", history: [{ date: "2026-04-08", summary: "Alteração material registada." }] },
        outgoingEdges: [],
        incomingEdges: [],
      }),
    };
    render(<Overview dataProvider={provider} onExploreProblem={onExploreProblem} onViewRecords={vi.fn()} />);

    const recentList = await screen.findByText("Atualizado recentemente").then(() => document.querySelector(".overview-hero-recent-list") as HTMLElement);
    const item = within(recentList).getByText("Problema do histórico");
    await userEvent.setup().click(item);
    expect(onExploreProblem).toHaveBeenCalledWith("PRB-1");
  });
});
