import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryDrawer, FiltrosToggle, ProblemRow, SortControl, TopicFilterGroup } from "./CitizenDiscovery";
import type { CitizenProblem } from "./overviewStats";

/**
 * `TopicFilterGroup` is a reusable filter control kept available for a
 * dedicated search/exploration page — Overview's own TEMA filtering renders
 * through `CategoryDrawer` below instead (Overview final redesign, Phase 1).
 * These tests protect its own durable rendering behaviour independent of any
 * one caller.
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
 * `FiltrosToggle` is the toolbar's disclosure trigger for the category
 * drawer (Overview final redesign, Phase 1 — delta §4). These tests protect
 * only its own disclosure contract; `OverviewPresentation.tsx` owns whether
 * the drawer it controls is actually rendered open/closed.
 */
describe("FiltrosToggle", () => {
  it("starts collapsed, exposing aria-expanded=false and aria-controls pointing at the drawer id", () => {
    render(<FiltrosToggle expanded={false} onToggle={vi.fn()} controlsId="drawer-1" activeTopicLabel={null} />);

    const button = screen.getByRole("button", { name: "Filtros" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe("drawer-1");
  });

  it("reflects aria-expanded=true and calls onToggle on click", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<FiltrosToggle expanded={true} onToggle={onToggle} controlsId="drawer-1" activeTopicLabel={null} />);

    const button = screen.getByRole("button", { name: "Filtros" });
    expect(button.getAttribute("aria-expanded")).toBe("true");

    await user.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("folds the active TEMA label into its own accessible name, without a separate visible badge", () => {
    render(<FiltrosToggle expanded={false} onToggle={vi.fn()} controlsId="drawer-1" activeTopicLabel="Mobilidade" />);

    expect(screen.getByRole("button", { name: "Filtros — Mobilidade" })).toBeTruthy();
    // Visible label stays the plain "Filtros" text; the active topic is not
    // rendered as a separate visible chip/badge (TARGET has none).
    expect(screen.queryByText("Mobilidade")).toBeNull();
  });

  it("takes a restrained active data-state when a topic is active, distinct from aria-expanded", () => {
    const { rerender } = render(<FiltrosToggle expanded={false} onToggle={vi.fn()} controlsId="drawer-1" activeTopicLabel={null} />);
    expect(screen.getByRole("button", { name: "Filtros" }).getAttribute("data-active")).toBe("false");

    rerender(<FiltrosToggle expanded={false} onToggle={vi.fn()} controlsId="drawer-1" activeTopicLabel="Mobilidade" />);
    expect(screen.getByRole("button", { name: "Filtros — Mobilidade" }).getAttribute("data-active")).toBe("true");
  });
});

/**
 * `CategoryDrawer` is the drawer's contents — `Todos` plus the complete
 * canonical TEMA vocabulary, each with a real count (Overview final
 * redesign, Phase 1 — delta §5). It renders whatever categories the caller
 * passes (`allTopicCodes`/`topCategoryCounts` in overviewStats.ts own the
 * complete vocabulary and real counts); these tests protect only its own
 * rendering/toggle contract.
 */
describe("CategoryDrawer", () => {
  it("renders Todos with the given total count, then each category with its own real count, in the order given by the caller", () => {
    render(
      <CategoryDrawer
        id="drawer-1"
        categories={[{ code: "MOB", count: 3 }, { code: "PUB", count: 2 }]}
        activeTopic={null}
        onChange={vi.fn()}
        totalCount={5}
      />
    );

    const group = screen.getByRole("group", { name: "Filtrar por tema" });
    const options = within(group).getAllByRole("button").map((button) => button.textContent?.replace(/\s+/g, " ").trim());
    expect(options).toEqual(["Todos 5", "Mobilidade 3", "Espaço público 2"]);
  });

  it("marks Todos active when no topic is selected, and the matching category active otherwise, exclusively", () => {
    const { rerender } = render(
      <CategoryDrawer id="drawer-1" categories={[{ code: "MOB", count: 1 }]} activeTopic={null} onChange={vi.fn()} totalCount={1} />
    );
    expect(screen.getByRole("button", { name: /^Todos/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Mobilidade/ }).getAttribute("aria-pressed")).toBe("false");

    rerender(<CategoryDrawer id="drawer-1" categories={[{ code: "MOB", count: 1 }]} activeTopic="MOB" onChange={vi.fn()} totalCount={1} />);
    expect(screen.getByRole("button", { name: /^Todos/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /Mobilidade/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onChange with the canonical domain code, never the PT-PT display label, on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CategoryDrawer id="drawer-1" categories={[{ code: "MOB", count: 1 }]} activeTopic={null} onChange={onChange} totalCount={1} />);

    await user.click(screen.getByRole("button", { name: /Mobilidade/ }));
    expect(onChange).toHaveBeenCalledWith("MOB");
  });

  it("clicking the already-selected category clears TEMA back to null (Todos)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CategoryDrawer id="drawer-1" categories={[{ code: "MOB", count: 1 }]} activeTopic="MOB" onChange={onChange} totalCount={1} />);

    await user.click(screen.getByRole("button", { name: /Mobilidade/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("clicking Todos clears TEMA to null", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CategoryDrawer id="drawer-1" categories={[{ code: "MOB", count: 1 }]} activeTopic="MOB" onChange={onChange} totalCount={1} />);

    await user.click(screen.getByRole("button", { name: /^Todos/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders every canonical category the caller passes, even one with a genuinely zero count", () => {
    render(
      <CategoryDrawer
        id="drawer-1"
        categories={[{ code: "MOB", count: 0 }]}
        activeTopic={null}
        onChange={vi.fn()}
        totalCount={0}
      />
    );
    expect(screen.getByRole("button", { name: /Mobilidade/ }).textContent).toMatch(/0$/);
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
