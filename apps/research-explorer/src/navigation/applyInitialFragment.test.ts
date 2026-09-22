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

  it("scrolls to and focuses the fragment target once it exists, and reports it applied", () => {
    document.body.innerHTML = '<section id="evd-limits">Limits</section>';
    window.location.hash = "#evd-limits";

    const applied = applyInitialFragment();

    const target = document.getElementById("evd-limits")!;
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(target);
    expect(target.getAttribute("tabindex")).toBe("-1");
    expect(applied).toBe(true);
  });

  it("does nothing and reports false when there is no fragment", () => {
    document.body.innerHTML = '<section id="evd-limits">Limits</section>';
    window.location.hash = "";

    const applied = applyInitialFragment();

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(applied).toBe(false);
  });

  it("does nothing and reports false when the fragment target does not exist (not yet mounted)", () => {
    document.body.innerHTML = "";
    window.location.hash = "#evd-limits";

    let applied: boolean | undefined;
    expect(() => { applied = applyInitialFragment(); }).not.toThrow();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(applied).toBe(false);
  });

  it("fails safely and reports false on a malformed hash, without throwing", () => {
    document.body.innerHTML = '<section id="evd-limits">Limits</section>';
    // %E0(%A4%A — an invalid percent-encoding sequence decodeURIComponent
    // throws on, matching the "malformed hash" degradation case.
    window.location.hash = "#%E0%A4%A";

    let applied: boolean | undefined;
    expect(() => { applied = applyInitialFragment(); }).not.toThrow();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(applied).toBe(false);
  });

  it("preserves an existing tabindex rather than overwriting it", () => {
    document.body.innerHTML = '<section id="relacoes" tabindex="0">Relações</section>';
    window.location.hash = "#relacoes";

    const applied = applyInitialFragment();

    expect(document.getElementById("relacoes")?.getAttribute("tabindex")).toBe("0");
    expect(applied).toBe(true);
  });
});
