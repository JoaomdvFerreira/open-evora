import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyInitialFragment } from "./applyInitialFragment";

/**
 * ODM-016A regression: a direct deep link's fragment must be re-applied once
 * its target exists, without requiring the browser's (already-run) native
 * on-load fragment scroll.
 */
describe("applyInitialFragment", () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  });

  afterEach(() => {
    window.location.hash = "";
    document.body.innerHTML = "";
  });

  it("scrolls to and focuses the fragment target once it exists", () => {
    document.body.innerHTML = '<section id="evd-limits">Limits</section>';
    window.location.hash = "#evd-limits";

    applyInitialFragment();

    const target = document.getElementById("evd-limits")!;
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(target);
    expect(target.getAttribute("tabindex")).toBe("-1");
  });

  it("does nothing when there is no fragment", () => {
    document.body.innerHTML = '<section id="evd-limits">Limits</section>';
    window.location.hash = "";

    applyInitialFragment();

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("does nothing when the fragment target does not exist (not yet mounted)", () => {
    document.body.innerHTML = "";
    window.location.hash = "#evd-limits";

    expect(() => applyInitialFragment()).not.toThrow();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("preserves an existing tabindex rather than overwriting it", () => {
    document.body.innerHTML = '<section id="relacoes" tabindex="0">Relações</section>';
    window.location.hash = "#relacoes";

    applyInitialFragment();

    expect(document.getElementById("relacoes")?.getAttribute("tabindex")).toBe("0");
  });
});
