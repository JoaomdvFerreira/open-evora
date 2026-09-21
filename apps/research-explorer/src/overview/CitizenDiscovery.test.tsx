import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryDrawer, CitizenSearchControl, FiltrosToggle, ProblemRow, SortControl, TopicFilterGroup } from "./CitizenDiscovery";
import type { CitizenProblem, MaterialChangeEntry } from "./overviewStats";

/**
 * `CitizenSearchControl`'s real Cmd/Ctrl+K focus shortcut (Overview
 * visual-completion, task §6/§16). Covers: both modifier keys focus the
 * input; the current query is preserved (never cleared/reset); the
 * shortcut does not hijack another unrelated editable field; and the
 * `keydown` listener is torn down on unmount (no leaked global handler).
 * `fireEvent` targets `window` directly since the listener is attached
 * there, matching CitizenDiscovery.tsx's own implementation.
 */
describe("CitizenSearchControl — Cmd/Ctrl+K shortcut", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("focuses the search input on Ctrl+K, preventing the browser default", () => {
    render(<CitizenSearchControl value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText("Pesquisar problemas") as HTMLInputElement;
    input.blur();
    expect(document.activeElement).not.toBe(input);

    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
    const prevented = !window.dispatchEvent(event);

    expect(document.activeElement).toBe(input);
    expect(prevented).toBe(true);
  });

  it("focuses the search input on Meta+K (macOS Cmd+K)", () => {
    render(<CitizenSearchControl value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText("Pesquisar problemas") as HTMLInputElement;

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true }));

    expect(document.activeElement).toBe(input);
  });

  it("preserves the current query — focusing never clears or alters value", () => {
    render(<CitizenSearchControl value="iluminação" onChange={vi.fn()} />);
    const input = screen.getByLabelText("Pesquisar problemas") as HTMLInputElement;

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }));

    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("iluminação");
  });

  it("does not hijack the shortcut while a foreign input/textarea/select/contenteditable is focused", () => {
    render(
      <div>
        <CitizenSearchControl value="" onChange={vi.fn()} />
        <input aria-label="Outro campo" />
      </div>
    );
    const searchInput = screen.getByLabelText("Pesquisar problemas") as HTMLInputElement;
    const otherInput = screen.getByLabelText("Outro campo") as HTMLInputElement;
    otherInput.focus();
    expect(document.activeElement).toBe(otherInput);

    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: otherInput, enumerable: true });
    const prevented = !window.dispatchEvent(event);

    // The shortcut leaves the foreign field alone: focus stays put and the
    // browser default (e.g. a native "find" binding) is not suppressed.
    expect(document.activeElement).toBe(otherInput);
    expect(document.activeElement).not.toBe(searchInput);
    expect(prevented).toBe(false);
  });

  it("still honours the shortcut when the Overview search input itself already has focus", () => {
    render(<CitizenSearchControl value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText("Pesquisar problemas") as HTMLInputElement;
    input.focus();

    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: input, enumerable: true });
    const prevented = !window.dispatchEvent(event);

    expect(document.activeElement).toBe(input);
    expect(prevented).toBe(true);
  });

  it("cleans up its keydown listener on unmount — no focus, no preventDefault, after the component is gone", () => {
    const { unmount } = render(<CitizenSearchControl value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText("Pesquisar problemas") as HTMLInputElement;
    input.blur();
    unmount();

    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
    const prevented = !window.dispatchEvent(event);

    expect(prevented).toBe(false);
  });
});

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
// Shared defaults for the `Alterados esta semana` shortcut props — most
// `CategoryDrawer` tests below exercise normal-topic behaviour and are
// unconcerned with the shortcut itself, which gets its own dedicated tests
// further down.
const drawerShortcutDefaults = { alteredThisWeekSelected: false, alteredThisWeekCount: 0, onAlteredThisWeekChange: vi.fn() };

describe("CategoryDrawer", () => {
  it("renders Todos with the given total count, then each category with its own real count, then the Alterados esta semana shortcut, in that order", () => {
    render(
      <CategoryDrawer
        id="drawer-1"
        hidden={false}
        categories={[{ code: "MOB", count: 3 }, { code: "PUB", count: 2 }]}
        activeTopic={null}
        onChange={vi.fn()}
        totalCount={5}
        {...drawerShortcutDefaults}
        alteredThisWeekCount={4}
      />
    );

    const group = screen.getByRole("group", { name: "Filtrar por tema" });
    const options = within(group).getAllByRole("button").map((button) => button.textContent?.replace(/\s+/g, " ").trim());
    expect(options).toEqual(["Todos 5", "Mobilidade 3", "Espaço público 2", "Alterados esta semana 4"]);
  });

  it("marks Todos active when no topic is selected, and the matching category active otherwise, exclusively", () => {
    const { rerender } = render(
      <CategoryDrawer id="drawer-1" hidden={false} categories={[{ code: "MOB", count: 1 }]} activeTopic={null} onChange={vi.fn()} totalCount={1} {...drawerShortcutDefaults} />
    );
    expect(screen.getByRole("button", { name: /^Todos/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Mobilidade/ }).getAttribute("aria-pressed")).toBe("false");

    rerender(<CategoryDrawer id="drawer-1" hidden={false} categories={[{ code: "MOB", count: 1 }]} activeTopic="MOB" onChange={vi.fn()} totalCount={1} {...drawerShortcutDefaults} />);
    expect(screen.getByRole("button", { name: /^Todos/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /Mobilidade/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onChange with the canonical domain code, never the PT-PT display label, on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CategoryDrawer id="drawer-1" hidden={false} categories={[{ code: "MOB", count: 1 }]} activeTopic={null} onChange={onChange} totalCount={1} {...drawerShortcutDefaults} />);

    await user.click(screen.getByRole("button", { name: /Mobilidade/ }));
    expect(onChange).toHaveBeenCalledWith("MOB");
  });

  it("clicking the already-selected category clears TEMA back to null (Todos)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CategoryDrawer id="drawer-1" hidden={false} categories={[{ code: "MOB", count: 1 }]} activeTopic="MOB" onChange={onChange} totalCount={1} {...drawerShortcutDefaults} />);

    await user.click(screen.getByRole("button", { name: /Mobilidade/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("clicking Todos clears TEMA to null", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CategoryDrawer id="drawer-1" hidden={false} categories={[{ code: "MOB", count: 1 }]} activeTopic="MOB" onChange={onChange} totalCount={1} {...drawerShortcutDefaults} />);

    await user.click(screen.getByRole("button", { name: /^Todos/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders every canonical category the caller passes, even one with a genuinely zero count", () => {
    render(
      <CategoryDrawer
        id="drawer-1"
        hidden={false}
        categories={[{ code: "MOB", count: 0 }]}
        activeTopic={null}
        onChange={vi.fn()}
        totalCount={0}
        {...drawerShortcutDefaults}
      />
    );
    expect(screen.getByRole("button", { name: /Mobilidade/ }).textContent).toMatch(/0$/);
  });

  it("stays mounted at its stable id when hidden, using the native hidden attribute rather than unmounting", () => {
    const { rerender } = render(
      <CategoryDrawer id="drawer-1" hidden={true} categories={[{ code: "MOB", count: 1 }]} activeTopic={null} onChange={vi.fn()} totalCount={1} {...drawerShortcutDefaults} />
    );

    // Collapsed: present in the DOM at its stable id, but hidden — absent
    // from the accessibility tree and not keyboard-focusable — and never
    // visible (this is what makes FiltrosToggle's aria-controls always
    // resolve to a real element, per the disclosure contract).
    const collapsed = document.getElementById("drawer-1");
    expect(collapsed).not.toBeNull();
    expect(collapsed?.hidden).toBe(true);
    expect(screen.queryByRole("group", { name: "Filtrar por tema" })).toBeNull();

    rerender(<CategoryDrawer id="drawer-1" hidden={false} categories={[{ code: "MOB", count: 1 }]} activeTopic={null} onChange={vi.fn()} totalCount={1} {...drawerShortcutDefaults} />);

    // Open: the same element, now unhidden and back in normal document flow.
    const open = document.getElementById("drawer-1");
    expect(open).toBe(collapsed);
    expect(open?.hidden).toBe(false);
    expect(screen.getByRole("group", { name: "Filtrar por tema" })).toBeTruthy();
  });
});

/**
 * `Alterados esta semana` (Overview final redesign, Phase 2, §5/§6) —
 * `CategoryDrawer`'s own rendering/toggle contract for the shortcut option.
 * Overview.tsx's mutual-exclusivity wiring (selecting it clears the normal
 * topic filter and vice versa) is covered end-to-end in Overview.test.tsx.
 */
describe("CategoryDrawer — Alterados esta semana shortcut", () => {
  it("always renders the shortcut, including at a truthful count of 0", () => {
    render(
      <CategoryDrawer id="drawer-1" hidden={false} categories={[]} activeTopic={null} onChange={vi.fn()} totalCount={0} {...drawerShortcutDefaults} alteredThisWeekCount={0} />
    );
    const shortcut = screen.getByRole("button", { name: /Alterados esta semana/ });
    expect(shortcut.textContent?.replace(/\s+/g, " ").trim()).toBe("Alterados esta semana 0");
  });

  it("reflects aria-pressed from alteredThisWeekSelected", () => {
    const { rerender } = render(
      <CategoryDrawer id="drawer-1" hidden={false} categories={[]} activeTopic={null} onChange={vi.fn()} totalCount={0} {...drawerShortcutDefaults} />
    );
    expect(screen.getByRole("button", { name: /Alterados esta semana/ }).getAttribute("aria-pressed")).toBe("false");

    rerender(
      <CategoryDrawer id="drawer-1" hidden={false} categories={[]} activeTopic={null} onChange={vi.fn()} totalCount={0} {...drawerShortcutDefaults} alteredThisWeekSelected={true} />
    );
    expect(screen.getByRole("button", { name: /Alterados esta semana/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onAlteredThisWeekChange(true) on click when unselected, and onAlteredThisWeekChange(false) when already selected", async () => {
    const onAlteredThisWeekChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <CategoryDrawer id="drawer-1" hidden={false} categories={[]} activeTopic={null} onChange={vi.fn()} totalCount={0} {...drawerShortcutDefaults} onAlteredThisWeekChange={onAlteredThisWeekChange} />
    );
    await user.click(screen.getByRole("button", { name: /Alterados esta semana/ }));
    expect(onAlteredThisWeekChange).toHaveBeenCalledWith(true);

    rerender(
      <CategoryDrawer id="drawer-1" hidden={false} categories={[]} activeTopic={null} onChange={vi.fn()} totalCount={0} {...drawerShortcutDefaults} alteredThisWeekSelected={true} onAlteredThisWeekChange={onAlteredThisWeekChange} />
    );
    await user.click(screen.getByRole("button", { name: /Alterados esta semana/ }));
    expect(onAlteredThisWeekChange).toHaveBeenCalledWith(false);
  });

  it("marks Todos as not pressed while the shortcut is selected, even though activeTopic is also null", () => {
    render(
      <CategoryDrawer id="drawer-1" hidden={false} categories={[]} activeTopic={null} onChange={vi.fn()} totalCount={3} {...drawerShortcutDefaults} alteredThisWeekSelected={true} />
    );
    expect(screen.getByRole("button", { name: /^Todos/ }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("SortControl", () => {
  it("offers the deterministic PRB-ID order and the updatedAt order, never labelled 'última alteração'", () => {
    render(<SortControl value="id" onChange={vi.fn()} />);
    const select = screen.getByLabelText("Ordenar por") as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((option) => option.textContent);
    expect(optionLabels).toEqual(["Identificador ↑", "Última atualização ↓"]);
    expect(optionLabels).not.toContain("última alteração");
    expect(optionLabels?.every((label) => !label?.toLowerCase().includes("última alteração"))).toBe(true);
  });

  it("reflects the given order as selected and reports a change", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SortControl value="id" onChange={onChange} />);

    const select = screen.getByLabelText("Ordenar por") as HTMLSelectElement;
    expect(select.value).toBe("id");

    await user.selectOptions(select, "Última atualização ↓");
    expect(onChange).toHaveBeenCalledWith("updatedAt");
  });

  /**
   * Compact (<=767px) presentation — visual-convergence pass, task §3/§20.
   * `useNarrowViewport` tracks `window.innerWidth` directly (no matchMedia
   * in jsdom), so these cases set it the same way
   * `useNarrowViewport.test.ts` already does, rather than resizing an
   * actual viewport.
   */
  describe("at <=767px", () => {
    function setInnerWidth(width: number) {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
    }
    const ORIGINAL_WIDTH = window.innerWidth;

    afterEach(() => {
      setInnerWidth(ORIGINAL_WIDTH);
    });

    it("renders a deliberately short label — never the desktop text truncated — while still selecting the updatedAt order", async () => {
      setInnerWidth(360);
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<SortControl value="id" onChange={onChange} />);

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      const optionLabels = Array.from(select.options).map((option) => option.textContent);
      expect(optionLabels).toEqual(["ID ↑", "alteração ↓"]);
      // Never a truncated fragment of the full desktop text (e.g. "Última atua...").
      expect(optionLabels.some((label) => label?.includes("…") || label?.includes("..."))).toBe(false);

      await user.selectOptions(select, "alteração ↓");
      expect(onChange).toHaveBeenCalledWith("updatedAt");
    });

    it("keeps Identifier selectable by its short compact label", async () => {
      setInnerWidth(360);
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<SortControl value="updatedAt" onChange={onChange} />);

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      await user.selectOptions(select, "ID ↑");
      expect(onChange).toHaveBeenCalledWith("id");
    });

    it("preserves the full accessible order name via aria-label even though the visible option text is short", () => {
      setInnerWidth(360);
      render(<SortControl value="updatedAt" onChange={vi.fn()} />);
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.getAttribute("aria-label")).toMatch(/Última atualização/);
    });
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

  it("shows the PRB id and the canonical updatedAt date in TARGET's compact DD/MM form, with the full YYYY-MM-DD value in dateTime, omitting the date when it is genuinely unavailable", () => {
    const { rerender } = render(<ul><ProblemRow problem={rowProblem} onExplore={vi.fn()} /></ul>);
    expect(screen.getByText("PRB-EXEMPLO")).toBeTruthy();
    const rowDate = screen.getByText("08/04");
    expect(rowDate.tagName).toBe("TIME");
    expect(rowDate.getAttribute("dateTime")).toBe("2026-04-08");

    rerender(<ul><ProblemRow problem={{ ...rowProblem, updatedAt: null }} onExplore={vi.fn()} /></ul>);
    expect(screen.queryByText("08/04")).toBeNull();
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

const rowLatestChange: MaterialChangeEntry = {
  problemId: "PRB-EXEMPLO", problemTitle: rowProblem.title, date: "2026-08-31", summary: "Alteração registada.", domainCodes: ["MOB"],
};

/**
 * The row-level material-change treatment (Overview final redesign, Phase
 * 2, §3/§4) — the changed-row variant and its compact marker. Membership
 * (whether a Problem has a `latestChange`) is decided entirely by the
 * caller; these tests protect only `ProblemRow`'s own rendering contract for
 * whatever it is given.
 */
describe("ProblemRow — material-change treatment", () => {
  it("gets no changed-row variant or marker when latestChange is not given", () => {
    render(<ul><ProblemRow problem={rowProblem} onExplore={vi.fn()} /></ul>);

    expect(document.querySelector(".overview-problem-row--changed")).toBeNull();
    expect(screen.queryByText("ALTERAÇÃO REGISTADA")).toBeNull();
  });

  it("gets the changed-row variant and renders the marker when latestChange is given", () => {
    render(<ul><ProblemRow problem={rowProblem} onExplore={vi.fn()} latestChange={rowLatestChange} /></ul>);

    const row = document.querySelector(".overview-problem-row--changed");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("ALTERAÇÃO REGISTADA")).toBeTruthy();
  });

  it("renders the marker using the authored material-change date, compactly, distinct from the row's own updatedAt date", () => {
    render(<ul><ProblemRow problem={rowProblem} onExplore={vi.fn()} latestChange={rowLatestChange} /></ul>);

    const marker = screen.getByText("ALTERAÇÃO REGISTADA").closest(".overview-problem-row-change-marker");
    const markerDate = marker?.querySelector("time");
    expect(markerDate?.textContent).toBe("31/08");
    expect(markerDate?.getAttribute("dateTime")).toBe("2026-08-31");
    // The row's own updatedAt date remains a separate element, also compact
    // (TARGET) but with the full canonical value in dateTime — never
    // overwritten or merged with the marker's own date.
    const rowDate = screen.getByText("08/04");
    expect(rowDate.tagName).toBe("TIME");
    expect(rowDate.getAttribute("dateTime")).toBe("2026-04-08");
  });

  it("preserves the row's single full-row click target and primary action when changed", async () => {
    const onExplore = vi.fn();
    const user = userEvent.setup();
    render(<ul><ProblemRow problem={rowProblem} onExplore={onExplore} latestChange={rowLatestChange} /></ul>);

    const action = screen.getByRole("button", { name: "Explorar Percursos diários no centro de Évora" });
    await user.click(action);
    expect(onExplore).toHaveBeenCalledWith("PRB-EXEMPLO");
  });
});
