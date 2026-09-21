import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Overview desktop-fit correction (768px-1059px) — CSS-contract regression:
 * confirms the shared desktop-fit grid — one `--overview-fit-gutter` inset
 * applied to `.shell-frame--wide`, the single primitive Header, Hero,
 * discovery toolbar, category drawer, problem-row content, end-of-results
 * content, and Footer all already compose — lives inside the existing
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

  it("applies one shared fit-grid gutter to the primitive every gutted surface composes, plus the bounded Hero/toolbar geometry corrections, inside the existing intermediate band only", () => {
    for (const selector of [".shell-frame--wide", ".overview-hero", ".overview-toolbar", ".overview-toolbar-controls", ".overview-category-drawer"]) {
      expect(block).toContain(selector);
    }
    // The shared gutter is a single custom property set once on the shared
    // primitive — not restated per surface, which is what keeps every
    // gutted band (Header, Hero, toolbar, drawer, rows, end-of-results,
    // Footer) on the same left/right axes by construction rather than by
    // separately-maintained declarations that could drift apart.
    expect(block.match(/--overview-fit-gutter:/g)?.length ?? 0).toBe(1);
  });

  it("keeps the shared fit-grid gutter proportional to the viewport (clamp/vw-based), not a single fixed pixel value", () => {
    const gutterDeclaration = block.match(/--overview-fit-gutter:\s*([^;]+);/)?.[1] ?? "";
    expect(gutterDeclaration).toMatch(/clamp\(/);
    expect(gutterDeclaration).toMatch(/vw/);
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

  it("does not leak the fit-grid gutter to >=1060px — `.shell-frame--wide` is declared as a bare top-level rule only once, outside any media query", () => {
    const topLevelDeclarations = css.match(/^\.shell-frame--wide\s*\{/gm) ?? [];
    expect(topLevelDeclarations.length).toBe(1);
  });
});
