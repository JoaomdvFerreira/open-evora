import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Structural regression for the Records "Como ler o Explorer" disclosure
 * overlapping the GlobalShell header (V2 corrective pass). Root cause: a
 * negative top margin on the shared `.reading-guide` rule pulled the
 * disclosure up into `.explorer-chrome`'s border-bottom region on every
 * surface that renders it (Records, Problem, Graph — anything but Overview).
 * This test parses the actual `.reading-guide` rule bodies out of the
 * production stylesheet and asserts no negative top margin is present,
 * rather than asserting any pixel position (which the implementation
 * contract explicitly asks unit tests not to do).
 */
const CSS_PATH = path.join(__dirname, "..", "index.css");

function ruleBodiesFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g");
  for (const match of css.matchAll(pattern)) {
    bodies.push(match[1]);
  }
  return bodies;
}

function hasNegativeTopMargin(body: string): boolean {
  const marginTop = body.match(/margin-top\s*:\s*(-[\d.]+)/);
  if (marginTop) return true;
  const margin = body.match(/margin\s*:\s*(-?[\d.]+\S*)/);
  if (margin && margin[1].startsWith("-")) return true;
  return false;
}

describe("reading-guide layout (Records header-overlap regression)", () => {
  it("never gives .reading-guide a negative top margin, in any rule body", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    const bodies = ruleBodiesFor(css, ".reading-guide");
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(hasNegativeTopMargin(body)).toBe(false);
    }
  });
});
