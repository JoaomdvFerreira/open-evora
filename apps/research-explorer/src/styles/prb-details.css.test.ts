import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PRB Details terminal composition — CSS contract. Structural only
 * (selector presence, declared values, scoping); never pixel/visual
 * acceptance. Covers the relationship between the terminal audit band,
 * `main.explorer-shell` and the global PublicFooter, and proves the
 * PRB-scoped treatment leaves the shared primitives (and Overview's own
 * terminal treatment) untouched for every other surface.
 */
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");
const prbCss = stripComments(fs.readFileSync(path.resolve(__dirname, "prb-details.css"), "utf8"));
const indexCss = stripComments(fs.readFileSync(path.resolve(__dirname, "..", "index.css"), "utf8"));

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

describe("PRB Details terminal composition — audit band gutter bleed", () => {
  it("defines the Explorer shell inline gutter once per breakpoint and pads the shell with it (2rem desktop, 1rem compact)", () => {
    expect(onlyRuleBody(indexBase, "main.explorer-shell")).toMatch(/--explorer-shell-gutter:\s*2rem;/);
    expect(onlyRuleBody(indexCompact, "main.explorer-shell")).toMatch(/--explorer-shell-gutter:\s*1rem;/);
  });

  it("bleeds the audit band's outer surface through the shell gutter and restores its content box with matching padding", () => {
    const body = onlyRuleBody(prbBase, ".prb-audit-section");
    expect(body).toMatch(/margin-inline:\s*calc\(-1 \* var\(--explorer-shell-gutter, 0px\)\);/);
    expect(body).toMatch(/padding-inline:\s*var\(--explorer-shell-gutter, 0px\);/);
    expect(body).toMatch(/border-top:\s*1px solid/);
    expect(body).toMatch(/background:/);
  });

  it("tracks the compact gutter through the shared token rather than a restated per-breakpoint number", () => {
    for (const body of ruleBodies(bothSheets, ".prb-audit-section")) {
      expect(body).not.toMatch(/(margin|padding)(-inline|-left|-right)?:\s*-?\d/);
    }
    expect(ruleBodies(prbCompact, ".prb-audit-section")).toHaveLength(0);
  });

  it("keeps the inner shell-frame--wide as the audit content-alignment owner (no horizontal inset on the frame)", () => {
    const tsx = fs.readFileSync(path.resolve(__dirname, "..", "problem", "PrbDetailsPresentation.tsx"), "utf8");
    expect(tsx).toMatch(/className="prb-section prb-audit-section">\s*<div className="shell-frame shell-frame--wide prb-section-frame">/);
    expect(onlyRuleBody(prbBase, ".prb-audit-section .prb-section-frame")).not.toMatch(/padding-(left|right|inline)|margin/);
  });

  it("bleeds only the audit band — no other PRB band or shell/footer primitive consumes the gutter token", () => {
    const consumers = prbCss.match(/[^{}]+\{[^{}]*var\(--explorer-shell-gutter[^{}]*\}/g) ?? [];
    expect(consumers.map((rule) => rule.split("{")[0].trim())).toEqual([".prb-audit-section"]);
  });

  it("never introduces an overflow-x: hidden workaround on html/body/main", () => {
    for (const selector of ["html", "body", "main", "main.explorer-shell"]) {
      const escaped = selector.replace(/\./g, "\\.");
      expect(bothSheets).not.toMatch(new RegExp(`(^|[^-\\w.])${escaped}\\s*\\{[^}]*overflow-x:\\s*hidden`, "m"));
    }
  });
});
