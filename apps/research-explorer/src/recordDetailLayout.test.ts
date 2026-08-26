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
const CSS_PATH = path.join(__dirname, "index.css");

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
    const source = readFileSync(path.join(__dirname, "records", "RecordDetailPanel.tsx"), "utf-8");
    expect(source).toMatch(/className="record-detail-layout shell-frame"/);
  });

  it("does not give .record-detail-columns its own independent width cap now that the parent frame owns it", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    const desktopBodies = ruleBodiesFor(css, ".record-detail-columns");
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
    const source = readFileSync(path.join(__dirname, "records", "RecordDetailPanel.tsx"), "utf-8");
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

  it("the compact index visibility rules reuse the exact same media queries as .problem-help-section-index (Problem View's own compact-index pattern) — no new Source-specific breakpoint", () => {
    for (const mediaSelector of ["(min-width: 768px) and (max-width: 1059px)", "(max-width: 767px)"]) {
      const problemHelpBodies = bodiesInMediaBlock(mediaSelector, ".problem-help-section-index");
      const sourceCompactBodies = bodiesInMediaBlock(mediaSelector, ".source-compact-section-index");
      expect(problemHelpBodies.length).toBeGreaterThan(0);
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
