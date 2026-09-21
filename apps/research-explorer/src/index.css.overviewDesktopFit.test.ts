import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Overview desktop-fit correction (768px-1059px) — CSS-contract regression:
 * confirms the shared desktop-fit grid gives every gutted surface the same
 * viewport-relative content axis, rather than padding the generic
 * `.shell-frame--wide` primitive directly (which produced two different
 * axes, since not every `.shell-frame--wide` instance shares the same
 * containing block — Header/Hero/toolbar/drawer/Footer inners sit inside
 * the shell's own ~2rem outer padding, while the problem-row link and
 * end-of-results inner sit inside `.overview-results`, whose negative
 * margin cancels that outer padding so they start from the true viewport
 * edge instead). One `--overview-fit-content-inset` viewport-relative inset
 * is applied per containing context: the residual/additional amount for
 * shell-inset surfaces, the full amount for full-bleed result inners. Lives
 * inside the existing `@media (min-width: 768px) and (max-width: 1059px)`
 * band (no new product breakpoint introduced) and stays distinct from both
 * the approved >=1060px base rules and the separate <=767px compact block.
 * Deliberately does not assert on any specific pixel value (task scope) —
 * only on structural placement/isolation.
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

/** Extracts the declaration block belonging to the (first) rule whose
 * selector list contains `selector` as one of its comma-separated members,
 * scoped to the given source (the intermediate block). Fails if no such
 * rule exists. Strips `/* ... *\/` comments first (a selector-list capture
 * would otherwise run backward into a preceding comment's own prose, which
 * can itself mention selector-like text), then walks each top-level
 * `selector-list { body }` pair. */
function ruleBodyContaining(source: string, selector: string): string {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(withoutComments)) !== null) {
    const selectorList = match[1];
    const members = selectorList.split(",").map((s) => s.trim());
    if (members.includes(selector)) {
      return match[2];
    }
  }
  expect.fail(`expected a rule targeting ${selector} inside the intermediate block`);
}

describe("index.css — Overview desktop-fit fallback (768px-1059px) isolation", () => {
  const block = intermediateBlock();

  it("does not use `.shell-frame--wide` as the intermediate fit-gutter owner", () => {
    // The generic primitive must retain its normal (bare, top-level) meaning
    // — no page-specific responsive padding applied to it directly, which
    // is what previously produced two different viewport-relative axes
    // depending on which containing block each `.shell-frame--wide`
    // instance happened to sit in.
    expect(block).not.toMatch(/\.shell-frame--wide\s*\{[^}]*padding/);
  });

  it("defines one viewport-relative fit content-inset custom property in the intermediate block", () => {
    const declarations = block.match(/--overview-fit-content-inset:\s*([^;]+);/g) ?? [];
    expect(declarations.length).toBeGreaterThan(0);
    for (const declaration of declarations) {
      expect(declaration).toMatch(/clamp\(/);
      expect(declaration).toMatch(/vw/);
    }
  });

  it("gives normal shell-inset surfaces only the residual inset beyond the existing shell outer padding", () => {
    // Header, Hero, toolbar, category drawer, and Footer inners already sit
    // inside the shell's own ~2rem outer horizontal padding before reaching
    // their own `.shell-frame--wide` — they must receive `content inset -
    // shell outer inset`, not the full inset (which would double-count the
    // outer padding and shift them off the shared axis).
    for (const selector of [".explorer-chrome-inner", ".overview-toolbar", ".overview-category-drawer", ".public-footer-inner"]) {
      const body = ruleBodyContaining(block, selector);
      expect(body).toMatch(/--overview-fit-content-inset/);
      expect(body).toMatch(/padding-left:\s*calc\(var\(--overview-fit-content-inset\)\s*-\s*2rem\)/);
      expect(body).toMatch(/padding-right:\s*calc\(var\(--overview-fit-content-inset\)\s*-\s*2rem\)/);
    }
  });

  it("gives the Hero's own inner frame the residual inset, scoped to the Hero (not every `.shell-frame--wide` instance)", () => {
    const body = ruleBodyContaining(block, ".overview-hero > .shell-frame--wide");
    expect(body).toMatch(/--overview-fit-content-inset/);
    expect(body).toMatch(/padding-left:\s*calc\(var\(--overview-fit-content-inset\)\s*-\s*2rem\)/);
  });

  it("gives full-bleed result inners the FULL fit content inset, with no residual/subtracted term", () => {
    // `.overview-results` cancels the shell's outer padding via a negative
    // margin, so these inners start from the true viewport edge — they must
    // receive the whole inset, not `calc(... - 2rem)`.
    for (const selector of [".overview-problem-row-link", ".overview-end-of-results-inner"]) {
      const body = ruleBodyContaining(block, selector);
      expect(body).toMatch(/--overview-fit-content-inset/);
      expect(body).toMatch(/padding-left:\s*var\(--overview-fit-content-inset\)/);
      expect(body).toMatch(/padding-right:\s*var\(--overview-fit-content-inset\)/);
      expect(body).not.toMatch(/calc\(/);
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

  it("keeps the toolbar's controls group (Filtros + search + count) as one deterministic non-wrapping unit, so only the whole group — never the result count alone — can recompose onto its own row (768 boundary correction, task §2)", () => {
    const controlsBody = ruleBodyContaining(block, ".overview-toolbar-controls");
    expect(controlsBody).toMatch(/flex-wrap:\s*nowrap/);

    const countWrapperBody = ruleBodyContaining(block, ".overview-toolbar-controls > div[aria-live]");
    expect(countWrapperBody).toMatch(/flex-shrink:\s*0/);
  });

  it("scopes the search's narrower 768-boundary width to a `clamp()` reaching the existing ~320px 1024 ceiling, rather than one fixed smaller measure (task §3)", () => {
    const searchBody = ruleBodyContaining(block, ".overview-toolbar-controls .overview-search");
    expect(searchBody).toMatch(/max-width:\s*clamp\([^)]*320px\)/);
    expect(searchBody).toMatch(/min-width:\s*0/);
  });

  it("keeps the Footer in a horizontal desktop-fit composition at 768-1059 — identity narrows and inter-column gaps tighten, but nothing forces the stacked/column layout reserved for <=767px (task §6)", () => {
    expect(block).not.toMatch(/\.public-footer-inner\s*\{[^}]*flex-direction:\s*column/);

    const identityBody = ruleBodyContaining(block, ".public-footer-identity");
    expect(identityBody).toMatch(/max-width:\s*40ch/);

    const groupsBody = ruleBodyContaining(block, ".public-footer-groups");
    expect(groupsBody).toMatch(/gap:/);
  });

  it("leaves >=1060px generic `.shell-frame--wide` behaviour untouched — it is declared as a bare top-level rule only once, outside any media query", () => {
    const topLevelDeclarations = css.match(/^\.shell-frame--wide\s*\{/gm) ?? [];
    expect(topLevelDeclarations.length).toBe(1);
    const baseRuleMatch = css.match(/^\.shell-frame--wide\s*\{([^}]*)\}/m);
    expect(baseRuleMatch).toBeTruthy();
    expect(baseRuleMatch![1]).not.toMatch(/padding/);
  });
});
