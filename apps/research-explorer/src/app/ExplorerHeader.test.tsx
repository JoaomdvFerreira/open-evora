import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorerHeader } from "./ExplorerHeader";

/**
 * Compact Header disclosure (visual-completion compact pass, task §2/§18):
 * confirms the menu toggle's native disclosure semantics (collapsed by
 * default, `aria-expanded`, `aria-controls` resolving to a stable id, opens/
 * closes on click) and that the real nav/CTA markup stays present and
 * reachable — never removed from the DOM, never duplicated — regardless of
 * `menuOpen`. Not a CSS/visual-acceptance test: the compact-vs-desktop
 * *visibility* split is asserted separately by the CSS-contract test
 * (index.css.compactHeader.test.ts), since jsdom does not evaluate media
 * queries.
 */
function renderHeader() {
  const onProblemas = vi.fn();
  const onRegistos = vi.fn();
  render(<ExplorerHeader activeView="overview" onProblemas={onProblemas} onRegistos={onRegistos} />);
  return { onProblemas, onRegistos };
}

describe("ExplorerHeader — compact menu disclosure", () => {
  it("renders the menu toggle collapsed by default", () => {
    renderHeader();
    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("aria-controls resolves to a real, stable element id", () => {
    renderHeader();
    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    const controlsId = toggle.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    const controlled = document.getElementById(controlsId!);
    expect(controlled).not.toBeNull();
    expect(controlled?.className).toBe("explorer-chrome-menu");
  });

  it("the controlled menu is hidden (native `hidden` attribute) before the toggle is opened", () => {
    renderHeader();
    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    const controlled = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(controlled?.hidden).toBe(true);
  });

  it("opens on click: aria-expanded flips true, `hidden` is removed, and the accessible name updates", async () => {
    const user = userEvent.setup();
    renderHeader();
    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    await user.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Fechar menu" })).toBe(toggle);
    const controlled = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(controlled?.hidden).toBe(false);
  });

  it("closes again on a second click", async () => {
    const user = userEvent.setup();
    renderHeader();
    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Fechar menu" }));

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const controlled = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(controlled?.hidden).toBe(true);
  });

  it("is a native button (keyboard accessible, no custom key handling required) with no popup/dialog role", () => {
    renderHeader();
    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("type")).toBe("button");
    expect(toggle.getAttribute("aria-haspopup")).toBeNull();
  });

  it("keeps the real navigation and CTA present in the DOM even while collapsed — never removed, never duplicated", () => {
    renderHeader();
    // `hidden: true` includes the collapsed-by-default menu content —
    // structural presence, not a visibility assertion (CSS/media queries
    // are not evaluated by jsdom; see this file's own module doc).
    expect(screen.getAllByRole("button", { name: "Problemas", hidden: true })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Método", hidden: true })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Registos", hidden: true })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Sobre", hidden: true })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Contribuir com evidência", hidden: true })).toHaveLength(1);
  });

  it("nav actions still invoke the same callbacks/routing once the menu is open — no duplicated business logic", async () => {
    const user = userEvent.setup();
    const { onProblemas, onRegistos } = renderHeader();
    await user.click(screen.getByRole("button", { name: "Abrir menu" }));

    await user.click(screen.getByRole("button", { name: "Problemas" }));
    expect(onProblemas).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Registos" }));
    expect(onRegistos).toHaveBeenCalledTimes(1);
  });

  it("marks Problemas as the active page via aria-current, matching activeView (desktop markup/state semantics unaffected)", () => {
    renderHeader();
    const problemas = screen.getByRole("button", { name: "Problemas", hidden: true });
    expect(problemas.getAttribute("aria-current")).toBe("page");
  });

  it("marks Registos active for the whole Records area, whatever its filter or selection", () => {
    render(<ExplorerHeader activeView="records" onProblemas={vi.fn()} onRegistos={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Problemas", hidden: true }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("button", { name: "Registos", hidden: true }).getAttribute("aria-current")).toBe("page");
  });

  it("does not offer a Fontes entry — Sources are a filter inside Registos", () => {
    renderHeader();
    expect(screen.queryByRole("button", { name: "Fontes", hidden: true })).toBeNull();
  });
});
