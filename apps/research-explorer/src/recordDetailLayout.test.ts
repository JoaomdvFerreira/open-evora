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
