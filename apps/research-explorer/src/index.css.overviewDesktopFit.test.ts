import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Overview desktop-fit correction (768px-1059px) — CSS-contract regression:
 * confirms the intermediate geometry-only fallback that hardens Overview's
 * Hero/toolbar/drawer/row/end-of-results gutters lives inside the existing
 * `@media (min-width: 768px) and (max-width: 1059px)` band (no new product
 * breakpoint introduced), and that it stays distinct from both the approved
 * >=1060px base rules and the separate <=767px compact block. Deliberately
 * does not assert on any specific pixel value (task scope) — only on
 * structural placement/isolation.
 */
const CSS_PATH = path.resolve(__dirname, "index.css");
const css = fs.readFileSync(CSS_PATH, "utf8");

function intermediateBlock(): string {
  const start = css.indexOf("@media (min-width: 768px) and (max-width: 1059px)");
  expect(start).toBeGreaterThan(-1);
  // Balance braces from the media query's own opening `{` to find its real
  // close, rather than the first `}` (nested rule blocks contain their own).
  const openIndex = css.indexOf("{", start);
  let depth = 0;
  for (let i = openIndex; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error("Unbalanced @media block");
}

describe("index.css — Overview desktop-fit fallback (768px-1059px) isolation", () => {
  const block = intermediateBlock();

  it("hardens Hero/toolbar/drawer/row/end-of-results geometry inside the existing intermediate band only", () => {
    for (const selector of [
      ".overview-hero > .shell-frame--wide",
      ".overview-toolbar",
      ".overview-category-drawer",
      ".overview-problem-row-link",
      ".overview-end-of-results-inner",
    ]) {
      expect(block).toContain(selector);
    }
  });

  it("does not introduce a new product breakpoint — only one 768px-1059px media query exists", () => {
    const occurrences = css.split("@media (min-width: 768px) and (max-width: 1059px)").length - 1;
    expect(occurrences).toBe(1);
  });

  it("never restates >=1060px base Overview selectors' full property set inside the intermediate block (base rules stay the sole source of truth for anything not explicitly overridden here)", () => {
    // The intermediate block is expected to override a bounded, explicit set
    // of properties (padding/gutter, flex-wrap, min-width, etc.) — it must
    // never redeclare unrelated base-rule concerns like colour/typography
    // tokens for these selectors, which would risk visually diverging from
    // the approved >=1060px desktop outside this task's scope.
    expect(block).not.toMatch(/\.overview-hero-headline\s*{[^}]*font-size:\s*clamp/);
    expect(block).not.toMatch(/\.overview-problem-row-link\s*{[^}]*color:/);
  });

  it("stays isolated from the separate <=767px compact block (no compact-only selectors leak into the intermediate band)", () => {
    expect(block).not.toContain(".overview-search-shortcut");
    expect(block).not.toContain("main.explorer-shell");
  });
});
