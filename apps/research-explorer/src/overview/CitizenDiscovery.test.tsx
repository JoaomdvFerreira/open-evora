import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryShortcuts, FilterRailGroup, ProblemRow, SortControl, TopicFilterGroup } from "./CitizenDiscovery";
import type { CitizenProblem } from "./overviewStats";

/**
 * `TopicFilterGroup` is a reusable filter control (not currently rendered by
 * Overview — see Overview delta removing topic filters from that surface)
 * kept available for a dedicated search/exploration page. These tests
 * protect its own durable rendering behaviour independent of any one caller.
 */
describe("TopicFilterGroup", () => {
  it("renders Todos first, then the topic codes in the order given by the caller (relevantTopicCodes owns sort order)", () => {
    render(<TopicFilterGroup topicCodes={["DIG", "ECO"]} activeTopic={null} onChange={vi.fn()} />);

    const group = screen.getByRole("group", { name: "Filtrar por tema" });
    const labels = within(group).getAllByRole("button").map((button) => button.textContent);
    expect(labels).toEqual(["Todos", "Digital", "Economia"]);
  });

  it("marks the active topic filter with aria-pressed, exclusively, and toggles it off on repeat click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<TopicFilterGroup topicCodes={["DIG", "ECO"]} activeTopic={null} onChange={onChange} />);

    const todos = screen.getByRole("button", { name: "Todos" });
    const digital = screen.getByRole("button", { name: "Digital" });
    expect(todos.getAttribute("aria-pressed")).toBe("true");
    expect(digital.getAttribute("aria-pressed")).toBe("false");

    await user.click(digital);
    expect(onChange).toHaveBeenCalledWith("DIG");

    rerender(<TopicFilterGroup topicCodes={["DIG", "ECO"]} activeTopic="DIG" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Todos" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Digital" }).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Digital" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders nothing when there are no topic codes to filter by", () => {
    const { container } = render(<TopicFilterGroup topicCodes={[]} activeTopic={null} onChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

/**
 * `CategoryShortcuts` is the Hero's lightweight category-shortcut affordance
 * (Overview visual-completion delta §4) — distinct from `TopicFilterGroup`
 * above, which stays the full reusable filter control. It renders whatever
 * ranked categories the caller passes (`topCategoryCounts` in
 * overviewStats.ts owns count/order); these tests protect only its own
 * rendering contract.
 */
describe("CategoryShortcuts", () => {
  it("renders each category's PT-PT label and count, in the order given by the caller", () => {
    render(<CategoryShortcuts categories={[{ code: "MOB", count: 3 }, { code: "PUB", count: 2 }]} />);

    const list = screen.getByRole("list", { name: "Atalhos por tema" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.textContent?.replace(/\s+/g, " ").trim())).toEqual(["Mobilidade 3", "Espaço público 2"]);
  });

  it("links each shortcut to the in-page problem list rather than applying a filter itself", () => {
    render(<CategoryShortcuts categories={[{ code: "MOB", count: 1 }]} />);
    expect(screen.getByRole("link", { name: /Mobilidade/ }).getAttribute("href")).toBe("#overview-problemas");
  });

  it("introduces the shortcuts with an 'Ou entre por:' label", () => {
    render(<CategoryShortcuts categories={[{ code: "MOB", count: 1 }]} />);
    expect(screen.getByText("Ou entre por:")).toBeTruthy();
  });

  it("renders nothing when there are no categories to show", () => {
    const { container } = render(<CategoryShortcuts categories={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

/**
 * `FilterRailGroup` is the shared rendering for every filter-rail group
 * (TEMA/EVIDÊNCIA/VALIDAÇÃO/ESTADO — Overview visual-completion editorial
 * list redesign). It holds no field-specific logic itself, so these tests
 * protect only its own generic rendering/toggle contract; which canonical
 * field backs a given group is `OverviewPresentation.tsx`'s responsibility.
 */
describe("FilterRailGroup", () => {
  it("renders the group label, an always-present 'Todos' option with the total count, and each option with its own count", () => {
    render(
      <FilterRailGroup
        label="Estado"
        options={[{ value: "OPEN", text: "Aberto", count: 8 }, { value: "REJECTED", text: "Rejeitado", count: 1 }]}
        totalCount={9}
        activeValue={null}
        onChange={vi.fn()}
      />
    );

    const group = screen.getByRole("group", { name: "Estado" });
    expect(within(group).getByText("Estado")).toBeTruthy();
    const options = within(group).getAllByRole("button").map((button) => button.textContent?.replace(/\s+/g, " ").trim());
    expect(options).toEqual(["Todos 9", "Aberto 8", "Rejeitado 1"]);
  });

  it("marks the active option with aria-pressed, exclusively, and toggles it off on repeat click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <FilterRailGroup label="Estado" options={[{ value: "OPEN", text: "Aberto", count: 1 }]} totalCount={1} activeValue={null} onChange={onChange} />
    );

    const todos = screen.getByRole("button", { name: /Todos/ });
    const aberto = screen.getByRole("button", { name: /Aberto/ });
    expect(todos.getAttribute("aria-pressed")).toBe("true");
    expect(aberto.getAttribute("aria-pressed")).toBe("false");

    await user.click(aberto);
    expect(onChange).toHaveBeenCalledWith("OPEN");

    rerender(<FilterRailGroup label="Estado" options={[{ value: "OPEN", text: "Aberto", count: 1 }]} totalCount={1} activeValue="OPEN" onChange={onChange} />);
    expect(screen.getByRole("button", { name: /Todos/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /Aberto/ }).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: /Aberto/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders nothing when there are no options for this dimension", () => {
    const { container } = render(<FilterRailGroup label="Estado" options={[]} totalCount={0} activeValue={null} onChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("SortControl", () => {
  it("offers the deterministic PRB-ID order and the updatedAt order, never labelled 'última alteração'", () => {
    render(<SortControl value="id" onChange={vi.fn()} />);
    const select = screen.getByLabelText("Ordenar por") as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((option) => option.textContent);
    expect(optionLabels).toEqual(["identificador", "última atualização"]);
    expect(optionLabels).not.toContain("última alteração");
  });

  it("reflects the given order as selected and reports a change", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SortControl value="id" onChange={onChange} />);

    const select = screen.getByLabelText("Ordenar por") as HTMLSelectElement;
    expect(select.value).toBe("id");

    await user.selectOptions(select, "última atualização");
    expect(onChange).toHaveBeenCalledWith("updatedAt");
  });
});

const rowProblem: CitizenProblem = {
  id: "PRB-EXEMPLO", title: "Percursos diários no centro de Évora",
  problemStatement: "Algumas deslocações entre serviços exigem percursos difíceis de completar a pé.",
  domainCodes: ["MOB"], affectedPopulations: [], geographyArea: "Évora",
  lifecycleStatus: "OPEN", validationStatus: "unvalidated", evidenceStatus: "corroborated", updatedAt: "2026-04-08",
};

/**
 * `ProblemRow` is the editorial list's per-Problem row (replaces the former
 * card grid). These tests protect its own durable rendering/interaction
 * contract — the three-dimension status semantics it reuses
 * (ProblemLifecycleStatus/ValidationStatus/EvidenceStatus) are already
 * covered end-to-end by Overview.test.tsx's dedicated describe block.
 */
describe("ProblemRow", () => {
  it("renders as a single named primary action covering the whole row", async () => {
    const onExplore = vi.fn();
    const user = userEvent.setup();
    render(<ul><ProblemRow problem={rowProblem} onExplore={onExplore} /></ul>);

    const action = screen.getByRole("button", { name: "Explorar Percursos diários no centro de Évora" });
    await user.click(action);
    expect(onExplore).toHaveBeenCalledWith("PRB-EXEMPLO");
  });

  it("shows the PRB id and the canonical updatedAt date, omitting the date when it is genuinely unavailable", () => {
    const { rerender } = render(<ul><ProblemRow problem={rowProblem} onExplore={vi.fn()} /></ul>);
    expect(screen.getByText("PRB-EXEMPLO")).toBeTruthy();
    expect(screen.getByText("08/04/2026").tagName).toBe("TIME");

    rerender(<ul><ProblemRow problem={{ ...rowProblem, updatedAt: null }} onExplore={vi.fn()} /></ul>);
    expect(screen.queryByText("08/04/2026")).toBeNull();
  });

  it("omits the problem statement and topic list when the Problem carries none", () => {
    render(<ul><ProblemRow problem={{ ...rowProblem, problemStatement: null, domainCodes: [] }} onExplore={vi.fn()} /></ul>);
    expect(screen.queryByText(rowProblem.problemStatement!)).toBeNull();
  });

  it("shows evidenceStatus as the restrained reading chip and lifecycleStatus as plain secondary text, never concatenated", () => {
    render(<ul><ProblemRow problem={rowProblem} onExplore={vi.fn()} /></ul>);

    const evidenceChip = screen.getByText("Evidência:").closest(".prb-status-chip");
    expect(evidenceChip?.textContent).toMatch(/Evidência:\s*Corroborada/);
    expect(screen.getByText("Aberto").className).toBe("overview-problem-row-lifecycle");
    // validationStatus is never repeated in the row.
    expect(screen.queryByText(/Validação/)).toBeNull();
  });

  it("renders every canonical topic label as quiet inline text, not TopicBadge chip UI", () => {
    render(<ul><ProblemRow problem={{ ...rowProblem, domainCodes: ["MOB", "PUB"] }} onExplore={vi.fn()} /></ul>);

    const topics = screen.getByText("Mobilidade, Espaço público");
    expect(topics.tagName).toBe("P");
    expect(topics.querySelector(".topic-badge")).toBeNull();
  });
});
