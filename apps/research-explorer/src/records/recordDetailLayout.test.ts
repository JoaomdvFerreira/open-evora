import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Structural regression for the V2 Record Detail desktop centering defect,
 * corrected again under UX-C: the top-level Record Detail composition now
 * owns the shared 980px outer frame (`.record-detail-layout.shell-frame`),
 * so Breadcrumb, ContextTabs, and the two-column content share one frame
 * instead of each capping/centering itself independently (which is exactly
 * the drift this test previously caught). This test parses the actual rule
 * bodies out of the production stylesheet and asserts the ownership split
 * holds, rather than asserting any pixel position (which the implementation
 * contract explicitly asks unit tests not to do).
 */
const CSS_PATH = path.join(__dirname, "..", "index.css");
const READING_LAYOUT_CSS_PATH = path.join(__dirname, "..", "styles", "reading-layout.css");

function ruleBodiesFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g");
  for (const match of css.matchAll(pattern)) {
    bodies.push(match[1]);
  }
  return bodies;
}

function hasAutoInlineCentering(body: string): boolean {
  if (/margin\s*:\s*[^;]*\bauto\b/.test(body)) return true;
  if (/margin-inline\s*:\s*auto/.test(body)) return true;
  if (/margin-left\s*:\s*auto/.test(body) && /margin-right\s*:\s*auto/.test(body)) return true;
  return false;
}

function hasWidthCap(body: string): boolean {
  const maxWidth = body.match(/max-width\s*:\s*([^;]+);/);
  return maxWidth !== undefined && maxWidth !== null && maxWidth[1].trim() !== "100%" && maxWidth[1].trim() !== "none";
}

describe("record-detail layout (shell-frame ownership, UX-C)", () => {
  it("RecordDetailContent's top-level wrapper carries shell-frame, the single owner of the 980px outer frame", () => {
    const source = readFileSync(path.join(__dirname, "RecordDetailPanel.tsx"), "utf-8");
    expect(source).toMatch(/className="record-detail-layout shell-frame"/);
  });

  it("does not give .lyt-reading its own independent width cap now that the parent frame owns it", () => {
    const css = readFileSync(READING_LAYOUT_CSS_PATH, "utf-8");
    const desktopBodies = ruleBodiesFor(css, ".lyt-reading");
    expect(desktopBodies.length).toBeGreaterThan(0);
    for (const body of desktopBodies) {
      expect(hasWidthCap(body)).toBe(false);
    }
  });

  it("does not give .detail-breadcrumb its own independent width cap now that the parent frame owns it", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    const bodies = ruleBodiesFor(css, ".detail-breadcrumb");
    for (const body of bodies) {
      expect(hasWidthCap(body)).toBe(false);
    }
  });

  it(".shell-frame itself centers whenever it caps width — the one place this responsibility lives", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    const bodies = ruleBodiesFor(css, ".shell-frame");
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      if (hasWidthCap(body)) {
        expect(hasAutoInlineCentering(body)).toBe(true);
      }
    }
  });
});

/**
 * DS-05J: Record Detail and Problem View now adopt the canonical
 * ReadingLayout (`.lyt-reading`/`-main`/`-rail`, styles/reading-layout.css)
 * for their outer reading geometry, replacing the superseded
 * `.record-detail-columns`/`-rail` implementation. `.record-detail-main`
 * remains in production JSX only as a domain/style hook — the active
 * descendant selectors below (`.record-meaning-zone`, `.record-meaning`,
 * `.record-role-fields`, `.record-provenance`) still depend on it — but it
 * no longer carries reading geometry itself.
 */
describe("ReadingLayout production adoption (DS-05J)", () => {
  const recordDetailSource = readFileSync(path.join(__dirname, "RecordDetailPanel.tsx"), "utf-8");
  const problemViewSource = readFileSync(path.join(__dirname, "..", "problem", "ProblemView.tsx"), "utf-8");
  const indexCss = readFileSync(CSS_PATH, "utf-8");
  const readingLayoutCss = readFileSync(READING_LAYOUT_CSS_PATH, "utf-8");

  it("Record Detail's outer reading layout uses lyt-reading with data-rail=\"present\"", () => {
    expect(recordDetailSource).toMatch(/className="lyt-reading" data-rail="present"/);
  });

  it("Record Detail's main column carries lyt-reading-main alongside the retained record-detail-main domain hook", () => {
    expect(recordDetailSource).toMatch(/className="record-detail-main lyt-reading-main"/);
  });

  it("Record Detail's supporting <aside> carries lyt-reading-rail", () => {
    expect(recordDetailSource).toMatch(/<aside className="lyt-reading-rail" aria-label="Mais ações">/);
  });

  it("Record Detail production JSX no longer uses record-detail-columns or record-detail-rail", () => {
    expect(recordDetailSource).not.toMatch(/record-detail-columns/);
    expect(recordDetailSource).not.toMatch(/className="record-detail-rail/);
  });

  it("Problem View uses the same lyt-reading / data-rail=\"present\" / lyt-reading-main composition", () => {
    expect(problemViewSource).toMatch(/className="lyt-reading" data-rail="present"/);
    expect(problemViewSource).toMatch(/className="record-detail-main lyt-reading-main"/);
  });

  it("ProblemReadingRail's <aside> carries lyt-reading-rail problem-reading-rail", () => {
    expect(problemViewSource).toMatch(/<aside className="lyt-reading-rail problem-reading-rail">/);
  });

  it("Problem View production JSX no longer uses problem-view-columns", () => {
    expect(problemViewSource).not.toMatch(/problem-view-columns/);
  });

  it("reading-layout.css owns the 720/44/216 geometry tokens", () => {
    expect(readingLayoutCss).toMatch(/--layout-reading-main:\s*720px/);
    expect(readingLayoutCss).toMatch(/--layout-reading-gap:\s*44px/);
    expect(readingLayoutCss).toMatch(/--layout-reading-rail:\s*216px/);
  });

  it("reading-layout.css owns the sticky rail rule", () => {
    const bodies = ruleBodiesFor(readingLayoutCss, ".lyt-reading-rail");
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0]).toMatch(/position\s*:\s*sticky/);
  });

  it("reading-layout.css owns exactly the existing 768-1059px fallback for .lyt-reading/-main/-rail", () => {
    const mediaMatch = readingLayoutCss.match(/@media \(min-width: 768px\) and \(max-width: 1059px\) \{([\s\S]*?)\n\}/);
    expect(mediaMatch).not.toBeNull();
    const body = mediaMatch![1];
    expect(body).toMatch(/\.lyt-reading\s*\{[^}]*flex-direction:\s*column/);
    expect(body).toMatch(/\.lyt-reading-main\s*\{[^}]*max-width:\s*var\(--layout-reading-main\)/);
    expect(body).toMatch(/\.lyt-reading-rail\s*\{[^}]*position:\s*static/);
  });

  it("reading-layout.css owns <=767px compact recomposition for .lyt-reading/-main/-rail", () => {
    const mediaMatch = readingLayoutCss.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/);
    expect(mediaMatch).not.toBeNull();
    const body = mediaMatch![1];
    expect(body).toMatch(/\.lyt-reading\s*\{[^}]*flex-direction:\s*column/);
    expect(body).toMatch(/\.lyt-reading-main\s*\{[^}]*max-width:\s*100%/);
    expect(body).toMatch(/\.lyt-reading-rail\s*\{[^}]*position:\s*static/);
  });

  it("index.css contains no .record-detail-columns rule", () => {
    expect(ruleBodiesFor(indexCss, ".record-detail-columns").length).toBe(0);
  });

  it("index.css contains no direct .record-detail-rail geometry rule", () => {
    expect(ruleBodiesFor(indexCss, ".record-detail-rail")).toEqual([]);
  });

  it("index.css contains no direct .record-detail-main geometry rule (flex/min-width/max-width on the bare class)", () => {
    const bareBodies = ruleBodiesFor(indexCss, ".record-detail-main");
    for (const body of bareBodies) {
      expect(body).not.toMatch(/flex\s*:/);
      expect(body).not.toMatch(/min-width\s*:/);
      expect(body).not.toMatch(/max-width\s*:/);
    }
  });

  it("--detail-gap is absent from index.css (no consumer remains)", () => {
    expect(indexCss).not.toMatch(/--detail-gap/);
  });

  it("index.css has no .problem-view-columns rule (retirement note text aside)", () => {
    expect(ruleBodiesFor(indexCss, ".problem-view-columns")).toEqual([]);
  });

  function bodiesInMediaBlock(css: string, mediaSelector: string, ruleSelector: string): string[] {
    const escapedMedia = mediaSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const mediaPattern = new RegExp(`@media\\s*${escapedMedia}\\s*\\{`, "g");
    const bodies: string[] = [];
    for (const match of css.matchAll(mediaPattern)) {
      const start = match.index! + match[0].length;
      let depth = 1;
      let i = start;
      while (i < css.length && depth > 0) {
        if (css[i] === "{") depth++;
        else if (css[i] === "}") depth--;
        i++;
      }
      const blockBody = css.slice(start, i - 1);
      bodies.push(...ruleBodiesFor(blockBody, ruleSelector));
    }
    return bodies;
  }

  it(".problem-reading-rail remains hidden in both the 768-1059px and <=767px bands, with compact indexes shown", () => {
    for (const mediaSelector of ["(min-width: 768px) and (max-width: 1059px)", "(max-width: 767px)"]) {
      const railBodies = bodiesInMediaBlock(indexCss, mediaSelector, ".problem-reading-rail");
      expect(railBodies.some((body) => /display\s*:\s*none/.test(body))).toBe(true);

      const problemCompactBodies = bodiesInMediaBlock(indexCss, mediaSelector, ".problem-compact-section-index");
      const sourceCompactBodies = bodiesInMediaBlock(indexCss, mediaSelector, ".source-compact-section-index");
      const evdCompactBodies = bodiesInMediaBlock(indexCss, mediaSelector, ".evd-compact-section-index");
      expect(problemCompactBodies.some((body) => /display\s*:\s*block/.test(body))).toBe(true);
      expect(sourceCompactBodies.some((body) => /display\s*:\s*block/.test(body))).toBe(true);
      expect(evdCompactBodies.some((body) => /display\s*:\s*block/.test(body))).toBe(true);
    }
  });

  /**
   * DS-05J remediation: ProblemReadingRail's own `<aside>` carries both
   * `lyt-reading-rail` and `problem-reading-rail` on the SAME element
   * (unlike Source/EVD, where `.problem-reading-rail` wraps a nested child
   * inside the outer `.lyt-reading-rail` aside). At equal specificity
   * (single class each), CSS source order — not media-query nesting —
   * decides the cascade: reading-layout.css's unconditional
   * `.lyt-reading-rail { display: flex }` base rule would otherwise beat
   * index.css's media-scoped `.problem-reading-rail { display: none }`
   * override if reading-layout.css were imported after index.css. main.tsx
   * must import reading-layout.css BEFORE index.css so the domain-owned
   * visibility rule always wins.
   */
  it("main.tsx imports styles/reading-layout.css before index.css (cascade order for .problem-reading-rail vs .lyt-reading-rail)", () => {
    const mainSource = readFileSync(path.join(__dirname, "..", "main.tsx"), "utf-8");
    const readingLayoutImportIndex = mainSource.indexOf('"./styles/reading-layout.css"');
    const indexCssImportIndex = mainSource.indexOf('"./index.css"');
    expect(readingLayoutImportIndex).toBeGreaterThan(-1);
    expect(indexCssImportIndex).toBeGreaterThan(-1);
    expect(readingLayoutImportIndex).toBeLessThan(indexCssImportIndex);
  });
});

/**
 * SUI-03J2B: characterizes the CSS-driven (never JS/viewport) responsive
 * contract governing the SRC "Nesta fonte" desktop rail index
 * (`.problem-reading-rail`, reused verbatim from Problem View's own desktop
 * reading rail) vs. the compact in-flow index (`.source-compact-section-index`,
 * following the same pattern as `.problem-help-section-index`). Parses raw
 * rule bodies rather than asserting pixel geometry, mirroring the layout
 * characterization style above.
 */
describe("Source View 'Nesta fonte' index responsive contract (SUI-03J2B, reuses Problem View pattern)", () => {
  const css = readFileSync(CSS_PATH, "utf-8");

  function bodiesInMediaBlock(mediaSelector: string, ruleSelector: string): string[] {
    const escapedMedia = mediaSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const mediaPattern = new RegExp(`@media\\s*${escapedMedia}\\s*\\{`, "g");
    const bodies: string[] = [];
    for (const match of css.matchAll(mediaPattern)) {
      const start = match.index! + match[0].length;
      // Find the matching closing brace for this @media block by depth count.
      let depth = 1;
      let i = start;
      while (i < css.length && depth > 0) {
        if (css[i] === "{") depth++;
        else if (css[i] === "}") depth--;
        i++;
      }
      const blockBody = css.slice(start, i - 1);
      bodies.push(...ruleBodiesFor(blockBody, ruleSelector));
    }
    return bodies;
  }

  it("no JS viewport detection is used to drive this visibility (window.innerWidth/matchMedia/resize) in RecordDetailPanel", () => {
    const source = readFileSync(path.join(__dirname, "RecordDetailPanel.tsx"), "utf-8");
    expect(source).not.toMatch(/window\.innerWidth/);
    expect(source).not.toMatch(/matchMedia/);
    expect(source).not.toMatch(/addEventListener\(\s*["']resize["']/);
  });

  it("desktop-band (>=1060px, no override media query applies): the rail nav is visible by default and the compact index is hidden by default", () => {
    // Base (non-media) rule for `.source-compact-section-index` hides it.
    const baseCompactBodies = ruleBodiesFor(css, ".source-compact-section-index");
    expect(baseCompactBodies.length).toBeGreaterThan(0);
    expect(baseCompactBodies[0]).toMatch(/display\s*:\s*none/);

    // `.problem-reading-rail` (reused by the SRC rail nav) carries no rule at
    // all outside the two narrower-band overrides below — it is visible by
    // ordinary flow/flex display at >=1060px purely because nothing hides it
    // there, matching Problem View's own precedent.
    const allRailBodies = ruleBodiesFor(css, ".problem-reading-rail");
    const outsideMediaBodies = allRailBodies.filter((body) => !bodiesInMediaBlock("(min-width: 768px) and (max-width: 1059px)", ".problem-reading-rail").includes(body) && !bodiesInMediaBlock("(max-width: 767px)", ".problem-reading-rail").includes(body));
    expect(outsideMediaBodies.length).toBe(0);
  });

  it("compact/non-lateral-rail bands (768-1059px and <=767px): the rail nav is hidden and the compact index is shown", () => {
    for (const mediaSelector of ["(min-width: 768px) and (max-width: 1059px)", "(max-width: 767px)"]) {
      const railBodies = bodiesInMediaBlock(mediaSelector, ".problem-reading-rail");
      expect(railBodies.some((body) => /display\s*:\s*none/.test(body))).toBe(true);

      const compactBodies = bodiesInMediaBlock(mediaSelector, ".source-compact-section-index");
      expect(compactBodies.some((body) => /display\s*:\s*block/.test(body))).toBe(true);
    }
  });

  it("the compact index visibility rules reuse the exact same media queries as .problem-compact-section-index (Problem View's own compact-index pattern) — no new Source-specific breakpoint", () => {
    for (const mediaSelector of ["(min-width: 768px) and (max-width: 1059px)", "(max-width: 767px)"]) {
      const problemCompactBodies = bodiesInMediaBlock(mediaSelector, ".problem-compact-section-index");
      const sourceCompactBodies = bodiesInMediaBlock(mediaSelector, ".source-compact-section-index");
      expect(problemCompactBodies.length).toBeGreaterThan(0);
      expect(sourceCompactBodies.length).toBeGreaterThan(0);
    }
  });

  it("no declared band shows both the rail nav and the compact index simultaneously", () => {
    const bands = ["(min-width: 768px) and (max-width: 1059px)", "(max-width: 767px)"];
    for (const mediaSelector of bands) {
      const railBodies = bodiesInMediaBlock(mediaSelector, ".problem-reading-rail");
      const compactBodies = bodiesInMediaBlock(mediaSelector, ".source-compact-section-index");
      const railHiddenHere = railBodies.some((body) => /display\s*:\s*none/.test(body));
      const compactShownHere = compactBodies.some((body) => /display\s*:\s*block/.test(body));
      // In every band this index appears in, exactly one of the two is visible.
      expect(railHiddenHere && compactShownHere).toBe(true);
    }
    // Outside those bands (desktop, >=1060px): rail visible by default, compact hidden by default (asserted above).
  });
});

/**
 * SUI-03K3: characterizes the CSS-driven (never JS/viewport) responsive
 * contract governing the "Abrir fonte original ↗" desktop rail copy
 * (`.source-original-link-rail`) vs. the compact in-flow copy
 * (`.source-original-link-inline`), reusing the exact same media queries as
 * the "Nesta fonte" rail/compact-index pair above.
 */
describe("Source View 'Abrir fonte original' responsive contract (SUI-03K3)", () => {
  const css = readFileSync(CSS_PATH, "utf-8");

  function bodiesInMediaBlock(mediaSelector: string, ruleSelector: string): string[] {
    const escapedMedia = mediaSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const mediaPattern = new RegExp(`@media\\s*${escapedMedia}\\s*\\{`, "g");
    const bodies: string[] = [];
    for (const match of css.matchAll(mediaPattern)) {
      const start = match.index! + match[0].length;
      let depth = 1;
      let i = start;
      while (i < css.length && depth > 0) {
        if (css[i] === "{") depth++;
        else if (css[i] === "}") depth--;
        i++;
      }
      const blockBody = css.slice(start, i - 1);
      bodies.push(...ruleBodiesFor(blockBody, ruleSelector));
    }
    return bodies;
  }

  it("no JS viewport detection is used to drive this visibility (window.innerWidth/matchMedia/resize) in RecordDetailPanel", () => {
    const source = readFileSync(path.join(__dirname, "RecordDetailPanel.tsx"), "utf-8");
    expect(source).not.toMatch(/window\.innerWidth/);
    expect(source).not.toMatch(/matchMedia/);
    expect(source).not.toMatch(/addEventListener\(\s*["']resize["']/);
  });

  it("desktop-band (>=1060px, no override media query applies): the rail copy is visible by default and the inline copy is hidden by default", () => {
    const baseInlineBodies = ruleBodiesFor(css, ".source-original-link-inline");
    expect(baseInlineBodies.length).toBeGreaterThan(0);
    expect(baseInlineBodies[0]).toMatch(/display\s*:\s*none/);

    const allRailBodies = ruleBodiesFor(css, ".source-original-link-rail");
    const outsideMediaBodies = allRailBodies.filter(
      (body) =>
        !bodiesInMediaBlock("(min-width: 768px) and (max-width: 1059px)", ".source-original-link-rail").includes(body) &&
        !bodiesInMediaBlock("(max-width: 767px)", ".source-original-link-rail").includes(body)
    );
    expect(outsideMediaBodies.length).toBe(0);
  });

  it("compact/non-lateral-rail bands (768-1059px and <=767px): the rail copy is hidden and the inline copy is shown", () => {
    for (const mediaSelector of ["(min-width: 768px) and (max-width: 1059px)", "(max-width: 767px)"]) {
      const railBodies = bodiesInMediaBlock(mediaSelector, ".source-original-link-rail");
      expect(railBodies.some((body) => /display\s*:\s*none/.test(body))).toBe(true);

      const inlineBodies = bodiesInMediaBlock(mediaSelector, ".source-original-link-inline");
      expect(inlineBodies.some((body) => /display\s*:\s*block/.test(body))).toBe(true);
    }
  });

  it("reuses the exact same media queries as the 'Nesta fonte' rail/compact-index pair — no new Source-specific breakpoint", () => {
    for (const mediaSelector of ["(min-width: 768px) and (max-width: 1059px)", "(max-width: 767px)"]) {
      const railIndexBodies = bodiesInMediaBlock(mediaSelector, ".problem-reading-rail");
      const ctaRailBodies = bodiesInMediaBlock(mediaSelector, ".source-original-link-rail");
      expect(railIndexBodies.length).toBeGreaterThan(0);
      expect(ctaRailBodies.length).toBeGreaterThan(0);
    }
  });

  it("no declared band shows both the rail copy and the inline copy simultaneously", () => {
    const bands = ["(min-width: 768px) and (max-width: 1059px)", "(max-width: 767px)"];
    for (const mediaSelector of bands) {
      const railBodies = bodiesInMediaBlock(mediaSelector, ".source-original-link-rail");
      const inlineBodies = bodiesInMediaBlock(mediaSelector, ".source-original-link-inline");
      const railHiddenHere = railBodies.some((body) => /display\s*:\s*none/.test(body));
      const inlineShownHere = inlineBodies.some((body) => /display\s*:\s*block/.test(body));
      expect(railHiddenHere && inlineShownHere).toBe(true);
    }
  });
});

/**
 * SUI-03K2B: Source View top-level sections reuse the exact PRB editorial
 * section rhythm (`.problem-section` — SUI-03K2A's confirmed root cause of
 * the compressed Source rhythm) via one neutral shared class,
 * `.record-editorial-section`, rather than a Source-specific spacing rule or
 * direct coupling to the PRB-branded `.problem-section` class name. Parses
 * the actual rule bodies out of the production stylesheet — no pixel
 * geometry assertions, matching this file's existing characterization style.
 */
describe("shared editorial-section rhythm (.record-editorial-section, SUI-03K2B)", () => {
  const css = readFileSync(CSS_PATH, "utf-8");

  function ruleBodiesForRawPattern(pattern: RegExp): string[] {
    return [...css.matchAll(pattern)].map((match) => match[1]);
  }

  it("1+2. .record-editorial-section shares .problem-section's exact margin-bottom: var(--space-8) rule", () => {
    const bodies = ruleBodiesForRawPattern(/\.problem-section,\s*\n?\s*\.record-editorial-section\s*\{([^}]*)\}/g);
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0]).toMatch(/margin-bottom\s*:\s*var\(--space-8\)\s*;/);
  });

  it("3. .record-editorial-section .detail-panel-label shares .problem-section .detail-panel-label's exact margin-bottom: var(--space-3) rule", () => {
    const bodies = ruleBodiesForRawPattern(/\.problem-section \.detail-panel-label,\s*\n?\s*\.record-editorial-section \.detail-panel-label\s*\{([^}]*)\}/g);
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0]).toMatch(/margin-bottom\s*:\s*var\(--space-3\)\s*;/);
  });

  it("10. .problem-section's own rule/value is unchanged (still exactly margin-bottom: var(--space-8))", () => {
    const bodies = ruleBodiesForRawPattern(/\.problem-section,\s*\n?\s*\.record-editorial-section\s*\{([^}]*)\}/g);
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0].trim()).toBe("margin-bottom: var(--space-8);");
  });

  it("11. no Source-specific margin value was introduced for these sections (no .source-*-section margin/margin-bottom rule outside .record-editorial-section)", () => {
    const sourceSectionClasses = [
      "source-overview-section",
      "source-findings-section",
      "source-coverage-section",
      "source-dates-access-section",
      "source-licensing-section",
      "source-caveats-section",
      "source-technical-section",
    ];
    for (const className of sourceSectionClasses) {
      const bodies = ruleBodiesFor(css, `\\.${className}`);
      for (const body of bodies) {
        expect(body).not.toMatch(/margin(-bottom)?\s*:/);
      }
    }
  });
});

/**
 * SUI-03K2C: Source nested `<h4>` headings (SourceFindingsSection's evidence
 * group headings, SourceInvestigationSection's "Problemas relacionados")
 * reuse the exact PRB nested-heading visual contract
 * (`.problem-current-state-item h4`) via one neutral shared class,
 * `.record-editorial-subheading`, rather than a Source-specific rule or
 * direct coupling to the PRB-branded `.problem-current-state-item` class.
 * Parses the actual rule bodies out of the production stylesheet — no pixel
 * geometry assertions, matching this file's existing characterization style.
 */
describe("shared nested-heading treatment (.record-editorial-subheading, SUI-03K2C)", () => {
  const css = readFileSync(CSS_PATH, "utf-8");

  function ruleBodiesForRawPattern(pattern: RegExp): string[] {
    return [...css.matchAll(pattern)].map((match) => match[1]);
  }

  const SHARED_RULE_PATTERN = /\.problem-current-state-item h4,\s*\n?\s*\.record-editorial-subheading\s*\{([^}]*)\}/g;

  it("1+5+6. .record-editorial-subheading shares .problem-current-state-item h4's exact typography values", () => {
    const bodies = ruleBodiesForRawPattern(SHARED_RULE_PATTERN);
    expect(bodies.length).toBeGreaterThan(0);
    const body = bodies[0];
    expect(body).toMatch(/margin\s*:\s*0 0 var\(--space-2\)\s*;/);
    expect(body).toMatch(/color\s*:\s*var\(--ink-faint\)\s*;/);
    expect(body).toMatch(/font-family\s*:\s*var\(--ui\)\s*;/);
    expect(body).toMatch(/font-size\s*:\s*12px\s*;/);
    expect(body).toMatch(/font-weight\s*:\s*600\s*;/);
    expect(body).toMatch(/text-transform\s*:\s*uppercase\s*;/);
    expect(body).toMatch(/letter-spacing\s*:\s*0\.03em\s*;/);
  });

  it("2. SourceFindingsSection group h4 headings use .record-editorial-subheading", () => {
    const source = readFileSync(path.join(__dirname, "SourceFindingsSection.tsx"), "utf-8");
    expect(source).toMatch(/<h4 className="record-editorial-subheading">Observações com esta fonte de proveniência<\/h4>/);
  });

  it("3+4. SourceInvestigationSection 'Problemas relacionados' uses .record-editorial-subheading as an h4 under the h3 'Na investigação' section", () => {
    const source = readFileSync(path.join(__dirname, "SourceInvestigationSection.tsx"), "utf-8");
    expect(source).toMatch(/<h4 className="record-editorial-subheading">Problemas relacionados<\/h4>/);
    expect(source).toMatch(/<h3 className="detail-panel-label">Na investigação<\/h3>/);
  });

  it("7. no Source top-level h3 (.detail-panel-label) receives the nested-heading class", () => {
    expect(css).not.toMatch(/\.detail-panel-label[^{]*\.record-editorial-subheading/);
    const findingsSource = readFileSync(path.join(__dirname, "SourceFindingsSection.tsx"), "utf-8");
    const investigationSource = readFileSync(path.join(__dirname, "SourceInvestigationSection.tsx"), "utf-8");
    expect(findingsSource).not.toMatch(/<h3 className="[^"]*record-editorial-subheading/);
    expect(investigationSource).not.toMatch(/<h3 className="[^"]*record-editorial-subheading/);
  });

  it("12. .record-editorial-section spacing rule is unchanged (still exactly margin-bottom: var(--space-8))", () => {
    const bodies = ruleBodiesForRawPattern(/\.problem-section,\s*\n?\s*\.record-editorial-section\s*\{([^}]*)\}/g);
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0].trim()).toBe("margin-bottom: var(--space-8);");
  });
});

/**
 * DS-05H remediation F1: the canonical presentation/CompactSectionIndex
 * deliberately owns `margin: 0` (no composition spacing) — the previous
 * `margin: 0 0 var(--space-6)` separation from following Source/EVD content
 * (formerly supplied by the legacy records/CompactSectionIndex root, which
 * also carried `.problem-help`) must be restored at the domain-owned
 * `.source-compact-section-index`/`.evd-compact-section-index` wrappers
 * instead, not on the generic component.
 */
describe("Source/EVD compact-index composition spacing (DS-05H remediation F1)", () => {
  const css = readFileSync(CSS_PATH, "utf-8");

  function ruleBodiesForRawPattern(pattern: RegExp): string[] {
    return [...css.matchAll(pattern)].map((match) => match[1]);
  }

  it("both .source-compact-section-index and .evd-compact-section-index carry margin: 0 0 var(--space-6)", () => {
    const bodies = ruleBodiesForRawPattern(/\.source-compact-section-index,\s*\n?\s*\.evd-compact-section-index\s*\{([^}]*)\}/g);
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0]).toMatch(/margin\s*:\s*0\s+0\s+var\(--space-6\)\s*;/);
  });

  it("the canonical .ui-section-index-compact recipe remains margin: 0 (composition spacing stays domain-owned)", () => {
    const sectionIndexCss = readFileSync(path.join(__dirname, "..", "styles", "section-index.css"), "utf-8");
    const bodies = ruleBodiesFor(sectionIndexCss, ".ui-section-index-compact");
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0]).toMatch(/margin\s*:\s*0\s*;/);
    expect(bodies[0]).not.toMatch(/var\(--space-6\)/);
  });
});
