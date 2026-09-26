import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Public PRB views layout — CSS contract. Structural only (selector
 * presence, declared values, scoping); never pixel/visual acceptance. Covers
 * PRB Details (the relationship between the terminal audit band,
 * `main.explorer-shell` and the global PublicFooter, the full-width band
 * gutter bleed, and the Estado da investigação / Âmbito six-column grid) and
 * PRB Histórico (its shared header/hero token contract, material-history
 * band and responsive rows), and proves the PRB-scoped treatment leaves the
 * shared primitives (and Overview's own terminal treatment) untouched for
 * every other surface.
 */
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");
const prbCss = stripComments(fs.readFileSync(path.resolve(__dirname, "prb-details.css"), "utf8"));
const indexCss = stripComments(fs.readFileSync(path.resolve(__dirname, "..", "index.css"), "utf8"));
const historyCss = stripComments(fs.readFileSync(path.resolve(__dirname, "prb-history.css"), "utf8"));

/** Brace-balanced top-level blocks of `source` whose prelude is exactly `prelude`. */
function mediaBlocks(source: string, prelude: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf(prelude, from);
    if (start === -1) return blocks;
    const open = source.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      if (source[i] === "}" && --depth === 0) {
        blocks.push(source.slice(open + 1, i));
        from = i + 1;
        break;
      }
    }
  }
}

/** Removes every `@media … { … }` block, leaving only unconditional rules. */
function withoutMedia(source: string): string {
  let out = source;
  for (;;) {
    const start = out.indexOf("@media");
    if (start === -1) return out;
    const open = out.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < out.length; i += 1) {
      if (out[i] === "{") depth += 1;
      if (out[i] === "}" && --depth === 0) {
        out = out.slice(0, start) + out.slice(i + 1);
        break;
      }
    }
  }
}

/** Declaration bodies of every flat rule in `source` whose selector list contains `selector`. */
function ruleBodies(source: string, selector: string): string[] {
  const bodies: string[] = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(source)) !== null) {
    // A preceding `@import …;` statement has no braces of its own; keep only the selector list.
    const prelude = match[1].split(";").pop() ?? "";
    if (prelude.split(",").map((s) => s.trim()).includes(selector)) bodies.push(match[2]);
  }
  return bodies;
}

function onlyRuleBody(source: string, selector: string): string {
  const bodies = ruleBodies(source, selector);
  expect(bodies, `expected exactly one rule for ${selector}`).toHaveLength(1);
  return bodies[0];
}

const bothSheets = `${prbCss}\n${indexCss}`;
const prbBase = withoutMedia(prbCss);
const indexBase = withoutMedia(indexCss);
const indexCompact = mediaBlocks(indexCss, "@media (max-width: 767px)").join("\n");
const prbCompact = mediaBlocks(prbCss, "@media (max-width: 767px)").join("\n");
const prbTablet = mediaBlocks(prbCss, "@media (min-width: 768px) and (max-width: 1023px)").join("\n");
const prbFit = mediaBlocks(prbCss, "@media (min-width: 1024px) and (max-width: 1439px)").join("\n");
const historyBase = withoutMedia(historyCss);
const historyCompact = mediaBlocks(historyCss, "@media (max-width: 767px)").join("\n");
const historyTablet = mediaBlocks(historyCss, "@media (min-width: 768px) and (max-width: 1023px)").join("\n");

/** The PRB Details bands whose surface/rules span the page and therefore bleed through the shell gutter. */
const FULL_WIDTH_BANDS = [".prb-header-band", ".prb-state-scope-band", ".prb-path-section", ".prb-audit-section"];
const BAND_BLEED_SELECTOR = FULL_WIDTH_BANDS.join(",\n");

describe("PRB Details terminal composition — vertical spacing ownership", () => {
  it("suppresses the Explorer shell's bottom padding only while PRB Details is rendered", () => {
    expect(onlyRuleBody(prbBase, "body:has(.prb-details-view) main.explorer-shell")).toMatch(/^\s*padding-bottom:\s*0;\s*$/);
  });

  it("suppresses the PublicFooter's top margin only while PRB Details is rendered", () => {
    expect(onlyRuleBody(prbBase, "body:has(.prb-details-view) .public-footer")).toMatch(/^\s*margin-top:\s*0;\s*$/);
  });

  it("never resets the shared shell/footer spacing unscoped from the PRB stylesheet", () => {
    expect(ruleBodies(prbCss, "main.explorer-shell")).toHaveLength(0);
    expect(ruleBodies(prbCss, ".public-footer")).toHaveLength(0);
  });

  it("keeps the generic shell bottom padding and footer top margin for every other surface", () => {
    expect(onlyRuleBody(indexBase, "main.explorer-shell")).toMatch(/padding:\s*0 var\(--explorer-shell-gutter\) 3rem;/);
    expect(onlyRuleBody(indexCompact, "main.explorer-shell")).toMatch(/padding:\s*0 var\(--explorer-shell-gutter\) 2rem;/);
    expect(onlyRuleBody(indexBase, ".public-footer")).toMatch(/margin:\s*2rem 0 0;/);
  });

  it("leaves the audit band's own bottom spacing as the sole breathing room before the footer (88px desktop, 40px compact)", () => {
    expect(onlyRuleBody(prbBase, ".prb-details-view")).toMatch(/--prb-audit-pad-bottom:\s*88px;/);
    expect(onlyRuleBody(prbCompact, ".prb-details-view")).toMatch(/--prb-audit-pad-bottom:\s*40px;/);
    expect(onlyRuleBody(prbBase, ".prb-audit-section .prb-section-frame")).toMatch(
      /padding:\s*var\(--prb-audit-pad-top\) 0 var\(--prb-audit-pad-bottom\);/,
    );
    for (const body of ruleBodies(prbCss, ".prb-details-view")) expect(body).not.toMatch(/padding/);
  });

  it("keeps Overview's own terminal zero-gap treatment intact", () => {
    expect(onlyRuleBody(indexBase, "body:has(.public-overview) main.explorer-shell")).toMatch(/^\s*padding-bottom:\s*0;\s*$/);
    expect(onlyRuleBody(indexBase, "body:has(.public-overview) .public-footer")).toMatch(/^\s*margin-top:\s*0;\s*$/);
  });
});

describe("PRB Details full-width bands — gutter bleed", () => {
  it("defines the Explorer shell inline gutter once per breakpoint and pads the shell with it (2rem desktop, 1rem compact)", () => {
    expect(onlyRuleBody(indexBase, "main.explorer-shell")).toMatch(/--explorer-shell-gutter:\s*2rem;/);
    expect(onlyRuleBody(indexCompact, "main.explorer-shell")).toMatch(/--explorer-shell-gutter:\s*1rem;/);
  });

  it("bleeds every full-width band through the shell gutter with one shared rule and restores its content box with matching padding", () => {
    const rules = prbBase.match(/[^{}]+\{[^{}]*\}/g) ?? [];
    const shared = rules.filter((rule) => rule.split("{")[0].trim() === BAND_BLEED_SELECTOR);
    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatch(/margin-inline:\s*calc\(-1 \* var\(--explorer-shell-gutter, 0px\)\);/);
    expect(shared[0]).toMatch(/padding-inline:\s*var\(--explorer-shell-gutter, 0px\);/);
  });

  it("declares the bleed after the generic .prb-section margin reset, so the reset cannot cancel it", () => {
    const reset = prbBase.search(/(^|\n)\.prb-section\s*\{/);
    expect(reset).toBeGreaterThan(-1);
    expect(prbBase.indexOf(BAND_BLEED_SELECTOR)).toBeGreaterThan(reset);
  });

  it("keeps the audit band's own terminal surface (top rule + background)", () => {
    const body = ruleBodies(prbBase, ".prb-audit-section").find((rule) => /background:/.test(rule));
    expect(body).toMatch(/border-top:\s*1px solid/);
  });

  it("tracks the compact gutter through the shared token rather than a restated per-breakpoint number", () => {
    for (const band of FULL_WIDTH_BANDS) {
      for (const body of ruleBodies(bothSheets, band)) {
        expect(body).not.toMatch(/(margin|padding)(-inline|-left|-right)?:\s*-?\d/);
      }
      expect(ruleBodies(prbCompact, band)).toHaveLength(0);
    }
  });

  it("keeps each band's inner shell-frame--wide as the content-alignment owner (no horizontal inset on the frame)", () => {
    const tsx = fs.readFileSync(path.resolve(__dirname, "..", "problem", "PrbDetailsPresentation.tsx"), "utf8");
    const headerTsx = fs.readFileSync(path.resolve(__dirname, "..", "problem", "PrbPageHeader.tsx"), "utf8");
    expect(tsx).toMatch(/className="prb-section prb-audit-section">\s*<div className="shell-frame shell-frame--wide prb-section-frame">/);
    expect(headerTsx).toMatch(/className="prb-header-band">\s*<div className="shell-frame shell-frame--wide">/);
    expect(tsx).toMatch(/className="prb-state-scope-band">\s*<div className="shell-frame shell-frame--wide prb-state-scope-row">/);
    expect(onlyRuleBody(prbBase, ".prb-audit-section .prb-section-frame")).not.toMatch(/padding-(left|right|inline)|margin/);
    expect(onlyRuleBody(prbBase, ".prb-state-scope-row")).not.toMatch(/padding|margin/);
  });

  it("bleeds only the PRB full-width bands — no other PRB rule or shell/footer primitive consumes the gutter token", () => {
    const consumers = prbCss.match(/[^{}]+\{[^{}]*var\(--explorer-shell-gutter[^{}]*\}/g) ?? [];
    expect(consumers.map((rule) => rule.split("{")[0].trim())).toEqual([BAND_BLEED_SELECTOR]);
  });

  it("never uses viewport-width geometry for the bleed", () => {
    expect(prbCss).not.toMatch(/100vw/);
  });

  it("never introduces an overflow-x: hidden workaround on html/body/main", () => {
    for (const selector of ["html", "body", "main", "main.explorer-shell"]) {
      const escaped = selector.replace(/\./g, "\\.");
      expect(bothSheets).not.toMatch(new RegExp(`(^|[^-\\w.])${escaped}\\s*\\{[^}]*overflow-x:\\s*hidden`, "m"));
    }
  });
});

describe("PRB Details Estado da investigação / Âmbito band — six-column grid", () => {
  it("lays both groups on one six-column grid: group headings over columns 1–3 and 4–6, six data cells below", () => {
    expect(onlyRuleBody(prbBase, ".prb-state-scope-row")).toMatch(/grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\);/);
    expect(onlyRuleBody(prbBase, ".prb-state-block > .detail-panel-label")).toMatch(/grid-column:\s*1 \/ 4;/);
    expect(onlyRuleBody(prbBase, ".prb-scope-block > .detail-panel-label")).toMatch(/grid-column:\s*4 \/ 7;/);
    const groups = ruleBodies(prbBase, ".prb-state-grid").find((rule) => /grid-row:\s*2;/.test(rule));
    expect(groups).toMatch(/grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
    expect(ruleBodies(prbBase, ".prb-scope-metrics")).toContain(groups);
  });

  it("keeps the group wrappers out of the box tree only for layout, so markup order stays heading → values", () => {
    const body = ruleBodies(prbBase, ".prb-state-block").find((rule) => /display:/.test(rule));
    expect(body).toMatch(/display:\s*contents;/);
    expect(ruleBodies(prbBase, ".prb-scope-block")).toContain(body);
  });

  it("draws the heading/data separator across the band's full width from the band's own box", () => {
    const band = ruleBodies(prbBase, ".prb-state-scope-band").find((rule) => /position:/.test(rule));
    expect(band).toMatch(/position:\s*relative;/);
    expect(band).not.toMatch(/background/);
    const separator = onlyRuleBody(prbBase, ".prb-state-grid::before");
    expect(separator).toMatch(/position:\s*absolute;/);
    expect(separator).toMatch(/left:\s*0;/);
    expect(separator).toMatch(/right:\s*0;/);
    expect(separator).not.toMatch(/(^|[\s;])(top|width):/);
  });

  it("closes the band with a bottom rule only — it declares no top border of its own", () => {
    const bands = ruleBodies(prbCss, ".prb-state-scope-band");
    expect(bands.some((rule) => /border-bottom:\s*1px solid var\(--color-separator-standard\);/.test(rule))).toBe(true);
    for (const rule of bands) expect(rule).not.toMatch(/border-top/);
  });

  it("separates every data cell but the first with a vertical rule", () => {
    const cell = ruleBodies(prbBase, ".prb-state-item").find((rule) => /border-left:\s*1px/.test(rule));
    expect(cell).toMatch(/border-left:\s*1px solid var\(--color-separator-standard\);/);
    expect(ruleBodies(prbBase, ".prb-scope-metric")).toContain(cell);
    expect(onlyRuleBody(prbBase, ".prb-state-item:first-child")).toMatch(/border-left:\s*0;/);
  });

  it("keeps six columns at tablet width (no restacking), tightening only the cell tokens", () => {
    expect(ruleBodies(prbTablet, ".prb-state-scope-row")).toHaveLength(0);
    expect(ruleBodies(prbTablet, ".prb-state-block")).toHaveLength(0);
    expect(onlyRuleBody(prbTablet, ".prb-details-view")).toMatch(/--prb-state-cell-pad-x:/);
  });

  it("recomposes the band at compact width instead of forcing six columns", () => {
    expect(onlyRuleBody(prbCompact, ".prb-state-scope-row")).toMatch(/display:\s*block;/);
    expect(prbCompact).not.toMatch(/repeat\(6,/);
    expect(onlyRuleBody(prbCompact, ".prb-state-grid::before")).toMatch(/content:\s*none;/);
    expect(onlyRuleBody(prbCompact, ".prb-scope-block::before")).toMatch(/position:\s*absolute;/);
  });
});

describe("PRB Histórico — shared header/hero contract and material-history layout", () => {
  it("resolves the same header/hero/section token blocks as PRB Details at every breakpoint", () => {
    for (const block of [prbBase, prbFit, prbTablet, prbCompact]) {
      const tokens = onlyRuleBody(block, ".prb-details-view");
      expect(ruleBodies(block, ".prb-history-view")).toEqual([tokens]);
      expect(tokens).toMatch(/--prb-hero-title-size:/);
    }
  });

  it("owns no competing copy of the shared header/hero rules", () => {
    expect(historyCss).not.toMatch(/\.prb-(header|identity)/);
  });

  it("scopes its terminal zero-gap treatment to the Histórico root only", () => {
    expect(onlyRuleBody(historyBase, "body:has(.prb-history-view) main.explorer-shell")).toMatch(/^\s*padding-bottom:\s*0;\s*$/);
    expect(onlyRuleBody(historyBase, "body:has(.prb-history-view) .public-footer")).toMatch(/^\s*margin-top:\s*0;\s*$/);
    expect(ruleBodies(historyCss, "main.explorer-shell")).toHaveLength(0);
    expect(ruleBodies(historyCss, ".public-footer")).toHaveLength(0);
    expect(onlyRuleBody(historyBase, ".prb-history-section .prb-section-frame")).toMatch(/padding-bottom:\s*var\(--prb-history-pad-bottom\);/);
  });

  it("bleeds the material-history band through the shell gutter token, never viewport-width geometry or overflow hiding", () => {
    const band = onlyRuleBody(historyBase, ".prb-history-view .prb-history-section");
    expect(band).toMatch(/margin-inline:\s*calc\(-1 \* var\(--explorer-shell-gutter, 0px\)\);/);
    expect(band).toMatch(/padding-inline:\s*var\(--explorer-shell-gutter, 0px\);/);
    expect(band).toMatch(/border-top:\s*1px solid/);
    expect(historyCss).not.toMatch(/100vw/);
    expect(historyCss).not.toMatch(/overflow-x:\s*hidden/);
    expect(historyCss).not.toMatch(/(margin|padding)(-inline|-left|-right)?:\s*-\d/);
  });

  it("keeps a date column + content column per entry down to tablet width", () => {
    expect(onlyRuleBody(historyBase, ".prb-history-entry")).toMatch(/grid-template-columns:\s*var\(--prb-history-date-col\) minmax\(0, 1fr\);/);
    expect(ruleBodies(historyTablet, ".prb-history-entry")).toHaveLength(0);
  });

  it("stacks each entry at compact width, keeping exact date and relative age grouped on one line", () => {
    expect(onlyRuleBody(historyCompact, ".prb-history-entry")).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(onlyRuleBody(historyCompact, ".prb-history-entry-date")).toMatch(/flex-direction:\s*row;/);
    expect(onlyRuleBody(historyCompact, ".prb-history-entry-date")).toMatch(/flex-wrap:\s*wrap;/);
  });

  it("separates entries with restrained horizontal rules only — no cards or timeline markers", () => {
    expect(onlyRuleBody(historyBase, ".prb-history-entry")).toMatch(/border-top:\s*1px solid var\(--color-separator-standard\);/);
    expect(onlyRuleBody(historyBase, ".prb-history-entry:first-child")).toMatch(/border-top:\s*0;/);
    expect(historyCss).not.toMatch(/border-radius|box-shadow|::before|::after/);
  });
});
