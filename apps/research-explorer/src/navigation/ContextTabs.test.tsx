import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ContextTabs } from "./ContextTabs";

function renderTabs(active: "details" | "history") {
  const onViewDetails = vi.fn();
  const onViewHistory = vi.fn();
  render(<ContextTabs prbId="PRB-0005" active={active} onViewDetails={onViewDetails} onViewHistory={onViewHistory} />);
  return { nav: screen.getByRole("navigation", { name: "Vistas do problema" }), onViewDetails, onViewHistory };
}

describe("ContextTabs — PRB-local Detalhes|Histórico navigation", () => {
  it("renders ordinary navigation with exactly Detalhes and Histórico, never ARIA tabs", () => {
    const { nav } = renderTabs("details");
    expect(nav.tagName).toBe("NAV");
    expect(nav.textContent).toBe("DetalhesHistórico");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(within(nav).queryByText("Detalhe")).toBeNull();
    expect(within(nav).queryByText("Problema")).toBeNull();
    expect(within(nav).queryByText(/Grafo/)).toBeNull();
  });

  it("marks Detalhes as the current page and navigates to Histórico for the same PRB id", () => {
    const { nav, onViewDetails, onViewHistory } = renderTabs("details");
    expect(within(nav).getByText("Detalhes").getAttribute("aria-current")).toBe("page");
    expect(within(nav).queryByRole("button", { name: "Detalhes" })).toBeNull();
    const history = within(nav).getByRole("button", { name: "Histórico" });
    expect(history.getAttribute("aria-current")).toBeNull();
    fireEvent.click(history);
    expect(onViewHistory).toHaveBeenCalledWith("PRB-0005");
    expect(onViewDetails).not.toHaveBeenCalled();
  });

  it("marks Histórico as the current page and navigates to Detalhes for the same PRB id", () => {
    const { nav, onViewDetails, onViewHistory } = renderTabs("history");
    expect(within(nav).getByText("Histórico").getAttribute("aria-current")).toBe("page");
    expect(within(nav).queryByRole("button", { name: "Histórico" })).toBeNull();
    fireEvent.click(within(nav).getByRole("button", { name: "Detalhes" }));
    expect(onViewDetails).toHaveBeenCalledWith("PRB-0005");
    expect(onViewHistory).not.toHaveBeenCalled();
  });

  it("uses the approved PRB view-selector appearance, not the legacy context-tabs row", () => {
    const { nav } = renderTabs("details");
    expect(nav.className).toBe("prb-view-selector");
    expect(within(nav).getByText("Detalhes").className).toBe("prb-view-selector-item prb-view-selector-item--active");
    expect(within(nav).getByText("Histórico").className).toBe("prb-view-selector-item");
  });
});
