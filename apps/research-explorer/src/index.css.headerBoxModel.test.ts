import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Header/Overview box-model CSS-contract regression: the Header identity
 * (`<h1 className="explorer-identity">`, ExplorerHeader.tsx) must never carry
 * an unwanted top margin, and Header navigation actions
 * (`.explorer-navigation-action`) must carry no vertical padding while
 * keeping their horizontal padding — at both the base/desktop rule and the
 * 768px-1059px fit-range override — while the compact (<=767px) open menu
 * restores real vertical padding to its stacked actions. Also covers `.overview-propose-problem`'s
 * `box-sizing: border-box`, which keeps its mobile full-width CTA inside its
 * available layout width once padding/border are taken into account.
 * Deliberately structural only (declared property values, not rendered
 * pixels) — never pixel/visual-acceptance assertions.
 */
const CSS_PATH = path.resolve(__dirname, "index.css");
const css = fs.readFileSync(CSS_PATH, "utf8");

/** Extracts the declaration block of the (first) rule whose selector list
 * contains `selector` as one of its comma-separated members, scoped to the
 * given source. Fails if no such rule exists — same technique the other
 * index.css.*.test.ts CSS-contract files already use. */
function ruleBodyContaining(source: string, selector: string): string {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(withoutComments)) !== null) {
    const members = match[1].split(",").map((s) => s.trim());
    if (members.includes(selector)) return match[2];
  }
  expect.fail(`expected a rule targeting ${selector}`);
}

function intermediateFitBlock(): string {
  const start = css.indexOf("@media (min-width: 768px) and (max-width: 1059px)");
  expect(start).toBeGreaterThan(-1);
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

describe("index.css — Header identity top margin", () => {
  it(".explorer-identity declares margin-top: 0", () => {
    const body = ruleBodyContaining(css, ".explorer-identity");
    expect(body).toMatch(/margin-top:\s*0\b/);
  });
});

describe("index.css — Header navigation action vertical padding", () => {
  it("the base/desktop rule has no vertical padding and retains horizontal padding", () => {
    const body = ruleBodyContaining(css, ".explorer-navigation .explorer-navigation-action");
    expect(body).toMatch(/padding-block:\s*0\b/);
    expect(body).toMatch(/padding-inline:\s*0\.8rem\b/);
    expect(body).not.toMatch(/padding:\s*[\d.]+\S*\s+[\d.]+\S*;/);
  });

  it("the 768px-1059px fit-range override also has no vertical padding and retains horizontal padding", () => {
    const block = intermediateFitBlock();
    const body = ruleBodyContaining(block, ".explorer-navigation .explorer-navigation-action");
    expect(body).toMatch(/padding-block:\s*0\b/);
    expect(body).toMatch(/padding-inline:\s*0\.85rem\b/);
    expect(body).not.toMatch(/padding:\s*[\d.]+\S*\s+[\d.]+\S*;/);
  });
});

/** Every top-level `@media (max-width: 767px)` block, concatenated. */
function compactBlocks(): string {
  const prelude = "@media (max-width: 767px)";
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(prelude, from);
    if (start === -1) return blocks.join("\n");
    const openIndex = css.indexOf("{", start);
    let depth = 0;
    for (let i = openIndex; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      if (css[i] === "}" && --depth === 0) {
        blocks.push(css.slice(openIndex + 1, i));
        from = i + 1;
        break;
      }
    }
  }
}

describe("index.css — compact open-menu spacing", () => {
  it("gives the stacked nav actions vertical padding and a tap-size row at <=767px only", () => {
    const body = ruleBodyContaining(compactBlocks(), ".explorer-navigation .explorer-navigation-action");
    expect(body).toMatch(/padding-block:\s*0\.7rem\b/);
    expect(body).toMatch(/min-height:\s*var\(--target-min\)/);
    // Links and buttons must share one row height (links default to content-box).
    expect(body).toMatch(/box-sizing:\s*border-box\b/);
    // The unconditional (desktop) rule stays zero-block-padding with no min-height.
    const base = ruleBodyContaining(css, ".explorer-navigation .explorer-navigation-action");
    expect(base).toMatch(/padding-block:\s*0\b/);
    expect(base).not.toMatch(/min-height/);
  });

  it("separates the compact nav list from the menu's top rule and the CTA rule", () => {
    expect(ruleBodyContaining(compactBlocks(), ".explorer-navigation")).toMatch(/padding-block:\s*0\.4rem\b/);
  });
});

describe("index.css — mobile full-width CTA box sizing", () => {
  it(".overview-propose-problem uses border-box sizing", () => {
    const body = ruleBodyContaining(css, ".overview-propose-problem");
    expect(body).toMatch(/box-sizing:\s*border-box\b/);
  });
});
