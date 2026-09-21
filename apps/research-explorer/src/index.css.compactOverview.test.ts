import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Overview compact visual-completion pass (<=767px) — CSS-contract
 * regression. Deliberately structural only (selector presence, declared
 * property values, block placement) — never pixel/visual-acceptance
 * assertions (task §18/§19).
 */
const CSS_PATH = path.resolve(__dirname, "index.css");
const css = fs.readFileSync(CSS_PATH, "utf8");

/** Every top-level `@media (max-width: 767px) { ... }` block in the file,
 * brace-balanced from each match's own `{` rather than the first `}` (rule
 * bodies inside a block contain their own closing braces). There is more
 * than one such block in this file (Header/Overview/Footer alongside
 * Records/Problem View/Record Detail compact rules living in separate
 * blocks) — this collects all of them rather than assuming a single one. */
function compactBlocks(): string[] {
  const blocks: string[] = [];
  const needle = "@media (max-width: 767px)";
  let searchFrom = 0;
  for (;;) {
    const start = css.indexOf(needle, searchFrom);
    if (start === -1) break;
    const openIndex = css.indexOf("{", start);
    let depth = 0;
    for (let i = openIndex; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(css.slice(start, i + 1));
          searchFrom = i + 1;
          break;
        }
      }
    }
  }
  expect(blocks.length).toBeGreaterThan(0);
  return blocks;
}

/** Extracts the declaration block of the (first) rule whose selector list
 * contains `selector` as one of its comma-separated members, scoped to the
 * given source. Fails if no such rule exists — same technique
 * index.css.overviewDesktopFit.test.ts already uses. */
function ruleBodyContaining(source: string, selector: string): string {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(withoutComments)) !== null) {
    const members = match[1].split(",").map((s) => s.trim());
    if (members.includes(selector)) return match[2];
  }
  expect.fail(`expected a rule targeting ${selector} inside a <=767px compact block`);
}

/** True if any compact block contains a rule targeting `selector`. */
function anyBlockHasRuleFor(blocks: string[], selector: string): boolean {
  return blocks.some((block) => {
    try {
      ruleBodyContaining(block, selector);
      return true;
    } catch {
      return false;
    }
  });
}

function bodyFromAnyBlock(blocks: string[], selector: string): string {
  for (const block of blocks) {
    try {
      return ruleBodyContaining(block, selector);
    } catch {
      // try the next block
    }
  }
  return expect.fail(`expected a rule targeting ${selector} in some <=767px compact block`) as never;
}

describe("index.css — compact Header disclosure (<=767px, task §2)", () => {
  const blocks = compactBlocks();

  it("hides the graphic compact mark and shows the textual wordmark identity", () => {
    expect(anyBlockHasRuleFor(blocks, ".explorer-logo--compact.explorer-logo--compact")).toBe(true);
    const compactMarkBody = bodyFromAnyBlock(blocks, ".explorer-logo--compact.explorer-logo--compact");
    expect(compactMarkBody).toMatch(/display:\s*none/);

    const wordmarkBody = bodyFromAnyBlock(blocks, ".explorer-logo--full.explorer-logo--full");
    expect(wordmarkBody).toMatch(/display:\s*inline-flex/);
  });

  it("the menu toggle is a hidden-at-rest disclosure target with a real hover/focus-visible treatment", () => {
    const toggleBody = bodyFromAnyBlock(blocks, ".explorer-menu-toggle");
    expect(toggleBody).toMatch(/display:\s*inline-flex/);
    expect(css).toMatch(/\.explorer-menu-toggle:focus-visible\s*\{[^}]*outline/);
  });

  it("the menu toggle is display:none at >=768px (desktop never renders it)", () => {
    const withoutCompactBlocks = blocks.reduce((acc, block) => acc.replace(block, ""), css);
    const baseBody = ruleBodyContaining(withoutCompactBlocks, ".explorer-menu-toggle");
    expect(baseBody).toMatch(/display:\s*none/);
  });

  it("`.explorer-chrome-menu[hidden]` is forced back to `display: none` inside the compact block (native `hidden` attribute is the sole visibility switch)", () => {
    const hiddenBody = bodyFromAnyBlock(blocks, ".explorer-chrome-menu[hidden]");
    expect(hiddenBody).toMatch(/display:\s*none/);
  });

  it("desktop base rule keeps `.explorer-chrome-menu` visible regardless of the `hidden` attribute (author CSS overrides the UA [hidden] default)", () => {
    const withoutCompactBlocks = blocks.reduce((acc, block) => acc.replace(block, ""), css);
    const baseBody = ruleBodyContaining(withoutCompactBlocks, ".explorer-chrome-menu");
    expect(baseBody).toMatch(/display:\s*flex/);
  });
});

describe("index.css — compact Hero gutter/density (<=767px, task §3/§4)", () => {
  const blocks = compactBlocks();

  it("Hero has no horizontal padding of its own at compact — only vertical", () => {
    const heroBody = bodyFromAnyBlock(blocks, ".overview-hero");
    const paddingDeclarations = heroBody.match(/padding:\s*([^;]+);/g) ?? [];
    expect(paddingDeclarations.length).toBeGreaterThan(0);
    for (const declaration of paddingDeclarations) {
      // A `padding` shorthand with a horizontal component would need either
      // 4 values (top/right/bottom/left, right != 0) or a 1-2 value form
      // with a non-zero second/only term. This pass's Hero rule always
      // writes an explicit `0` horizontal term.
      expect(declaration).toMatch(/padding:\s*\S+\s+0(\s|;)/);
    }
  });
});

describe("index.css — compact metrics as a vertical technical list (<=767px, task §6)", () => {
  const blocks = compactBlocks();

  it("stacks the four Hero metrics as a column, not the desktop inline-wrap row", () => {
    const metricsBody = bodyFromAnyBlock(blocks, ".overview-metrics");
    expect(metricsBody).toMatch(/flex-direction:\s*column/);
  });
});

describe("index.css — compact discovery grid (<=767px, task §7/§9)", () => {
  const blocks = compactBlocks();

  it("lays the toolbar out as an explicit grid with search on its own row and Filtros/count/sort sharing the next", () => {
    const toolbarBody = bodyFromAnyBlock(blocks, ".overview-toolbar");
    expect(toolbarBody).toMatch(/display:\s*grid/);
    expect(toolbarBody).toMatch(/grid-template-areas:\s*\n?\s*"search search search"\s*\n?\s*"filtros count sort"/);
  });

  it("unwraps the controls/meta wrapper divs via display:contents rather than a markup restructure", () => {
    expect(bodyFromAnyBlock(blocks, ".overview-toolbar-controls")).toMatch(/display:\s*contents/);
    expect(bodyFromAnyBlock(blocks, ".overview-toolbar-meta")).toMatch(/display:\s*contents/);
  });

  it("places Filtros, the live count, and sort onto their own named grid areas", () => {
    expect(bodyFromAnyBlock(blocks, ".overview-filtros-toggle")).toMatch(/grid-area:\s*filtros/);
    expect(bodyFromAnyBlock(blocks, ".overview-toolbar-controls > div[aria-live]")).toMatch(/grid-area:\s*count/);
    expect(bodyFromAnyBlock(blocks, ".overview-sort-control")).toMatch(/grid-area:\s*sort/);
  });

  /** Regression for the row-2 "[Filtros]  6 problemasÚltima atualização ↓"
   * collision defect: Filtros and the count must each own an intrinsic-width
   * (`auto`) column, and sort must be the sole `1fr` track that actually
   * yields when space is tight, never sharing an ambiguous flexible column
   * with the count beside it (visual-convergence pass, task §8). */
  it("gives Filtros and the count their own intrinsic-width columns and sort the sole flexible column — never `auto 1fr auto` sharing sort's growth with count", () => {
    const toolbarBody = bodyFromAnyBlock(blocks, ".overview-toolbar");
    expect(toolbarBody).toMatch(/grid-template-columns:\s*auto\s+auto\s+1fr/);
  });

  it("keeps the result count nowrap and the sort control's own box boundable, so neither can grow into the other", () => {
    expect(bodyFromAnyBlock(blocks, ".overview-results-count")).toMatch(/white-space:\s*nowrap/);
    const sortControlBody = bodyFromAnyBlock(blocks, ".overview-sort-control");
    expect(sortControlBody).toMatch(/min-width:\s*0/);
    const sortSelectBody = bodyFromAnyBlock(blocks, ".overview-sort-control select");
    expect(sortSelectBody).toMatch(/max-width:\s*100%/);
  });

  /** Regression for the accidental-ellipsis compact sort label (visual-
   * convergence pass, task §3): the compact box is still bounded (nowrap +
   * max-width, above) but no longer relies on CSS `text-overflow: ellipsis`
   * to shorten the visible text — SortControl.tsx now renders a deliberately
   * short option string ("alteração ↓"/"ID ↑") at this width instead. */
  it("does not truncate the compact sort select with text-overflow: ellipsis", () => {
    const sortSelectBody = bodyFromAnyBlock(blocks, ".overview-sort-control select");
    expect(sortSelectBody).not.toMatch(/text-overflow:\s*ellipsis/);
  });
});

describe("index.css — compact category rail (<=767px, task §10)", () => {
  const blocks = compactBlocks();

  it("is nowrap (never wraps chips into multiple rows) and locally scrollable", () => {
    const drawerBody = bodyFromAnyBlock(blocks, ".overview-category-drawer");
    expect(drawerBody).toMatch(/flex-wrap:\s*nowrap/);
    expect(drawerBody).toMatch(/overflow-x:\s*auto/);
  });

  it("chip options keep their intrinsic width (flex: 0 0 auto) rather than shrinking/growing", () => {
    const optionBody = bodyFromAnyBlock(blocks, ".overview-category-drawer-option");
    expect(optionBody).toMatch(/flex:\s*0\s+0\s+auto/);
  });

  it("never solves the rail's overflow with overflow-x: hidden on body/html/main (task §15)", () => {
    for (const selector of ["html", "body", "main", "main.explorer-shell"]) {
      const combined = blocks.join("\n");
      const escaped = selector.replace(/\./g, "\\.");
      const re = new RegExp(`(^|[^-\\w])${escaped}\\s*\\{[^}]*overflow-x:\\s*hidden`, "m");
      expect(combined).not.toMatch(re);
    }
  });
});

describe("index.css — compact category-rail scrollbar is scoped to the rail only (<=767px, task §12)", () => {
  const blocks = compactBlocks();

  it("restrains the rail's own scrollbar (progressive scrollbar-width/color + WebKit selectors)", () => {
    const drawerBody = bodyFromAnyBlock(blocks, ".overview-category-drawer");
    expect(drawerBody).toMatch(/scrollbar-width:\s*thin/);
    expect(anyBlockHasRuleFor(blocks, ".overview-category-drawer::-webkit-scrollbar")).toBe(true);
  });

  it("never applies WebKit scrollbar restraint to an unrelated selector (scoped strictly to the rail)", () => {
    const combined = blocks.join("\n");
    const webkitScrollbarSelectors = combined.match(/[^\n{}]*::-webkit-scrollbar[^\n{}]*\{/g) ?? [];
    expect(webkitScrollbarSelectors.length).toBeGreaterThan(0);
    for (const selector of webkitScrollbarSelectors) {
      expect(selector).toMatch(/\.overview-category-drawer::-webkit-scrollbar/);
    }
  });
});

describe("index.css — compact row content has an inner gutter while the row band stays full-bleed (<=767px, task §13)", () => {
  const blocks = compactBlocks();

  it("insets row CONTENT with the shared compact 1rem gutter", () => {
    const linkBody = bodyFromAnyBlock(blocks, ".overview-problem-row-link");
    expect(linkBody).toMatch(/padding:\s*\S+\s+1rem/);
  });

  it("never gives the row BAND (`.overview-problem-row`/`--changed`) a compact horizontal inset of its own — only the full-bleed `.overview-results` negative-margin bleed applies", () => {
    for (const selector of [".overview-problem-row", ".overview-problem-row--changed"]) {
      expect(anyBlockHasRuleFor(blocks, selector)).toBe(false);
    }
  });

  it("keeps the end-of-results content on the same compact gutter as row content", () => {
    const endOfResultsBody = bodyFromAnyBlock(blocks, ".overview-end-of-results-inner");
    expect(endOfResultsBody).toMatch(/padding:\s*\S+\s+1rem/);
  });
});

describe("index.css — compact Footer stacks PROJETO/DADOS vertically (<=767px, task §14)", () => {
  const blocks = compactBlocks();

  it("keeps `.public-footer-inner` vertical (pre-existing) and also stacks `.public-footer-groups`", () => {
    const innerBody = bodyFromAnyBlock(blocks, ".public-footer-inner");
    expect(innerBody).toMatch(/flex-direction:\s*column/);

    const groupsBody = bodyFromAnyBlock(blocks, ".public-footer-groups");
    expect(groupsBody).toMatch(/flex-direction:\s*column/);
  });
});

describe("index.css — the >=768px desktop-fit band remains untouched by this pass (task §16)", () => {
  it("still declares exactly one 768px-1059px desktop-fit media query", () => {
    const occurrences = css.split("@media (min-width: 768px) and (max-width: 1059px)").length - 1;
    expect(occurrences).toBe(1);
  });

  it("the desktop-fit band does not contain any compact-only selector introduced by this pass", () => {
    const start = css.indexOf("@media (min-width: 768px) and (max-width: 1059px)");
    const openIndex = css.indexOf("{", start);
    let depth = 0;
    let end = openIndex;
    for (let i = openIndex; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    const fitBlock = css.slice(start, end + 1);
    expect(fitBlock).not.toContain(".explorer-menu-toggle");
    expect(fitBlock).not.toContain(".explorer-chrome-menu");
    expect(fitBlock).not.toContain("grid-template-areas");
    expect(fitBlock).not.toContain(".overview-category-drawer-option {");
  });
});
