import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ODM-016B — CSS-contract regression: every real in-app fragment target must
 * carry the compact sticky-header scroll-margin-top offset, not just
 * Problem/Overview (the pre-existing F4 rule). Extends coverage to the EVD/SRC
 * `.evd-section`/`.src-section` ids and `#relacoes` (see EvdDetail.tsx,
 * SrcDetail.tsx, RecordDetailPanel.tsx) without introducing a new
 * mechanism — one rule, the same scroll-margin-top declaration.
 *
 * D01-020 — the same rule must also cover the real PRB fragment destinations:
 * `#prb-auditoria` (Âmbito metrics, header Verificar, Histórico → Detalhes)
 * and `#prb-questoes` (open-question metric), see PrbDetailsPresentation.tsx,
 * PrbPageHeader.tsx and Explorer.tsx.
 */
const css = fs.readFileSync(path.resolve(__dirname, "index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Parses the rule containing `anchorSelector`: its exact selector list, declarations, and enclosing at-rule prelude. */
function ruleFor(anchorSelector: string) {
  const stack: string[] = [];
  let preludeStart = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      const prelude = css.slice(preludeStart, i).trim();
      const selectors = prelude.split(",").map((s) => s.trim());
      if (selectors.includes(anchorSelector)) {
        const close = css.indexOf("}", i);
        return { selectors, body: css.slice(i + 1, close), enclosing: stack[stack.length - 1] ?? null };
      }
      stack.push(prelude);
      preludeStart = i + 1;
    } else if (ch === "}") {
      stack.pop();
      preludeStart = i + 1;
    } else if (ch === ";" && stack.length === 0) {
      preludeStart = i + 1;
    }
  }
  return null;
}

describe("index.css — compact sticky-header scroll-margin-top coverage (ODM-016B, D01-020)", () => {
  const rule = ruleFor("#overview-problemas");

  it("is a single rule inside the compact (<=767px) media block with the 108px offset", () => {
    expect(rule).toBeTruthy();
    expect(rule!.enclosing).toBe("@media (max-width: 767px)");
    expect(rule!.body).toMatch(/scroll-margin-top:\s*108px/);
  });

  it("covers #relacoes and the .evd-section/.src-section ids alongside the pre-existing #overview-problemas rule", () => {
    expect(rule!.selectors).toEqual(expect.arrayContaining(["#overview-problemas", ".evd-section", ".src-section", "#relacoes"]));
  });

  it("covers the real PRB fragment destinations #prb-auditoria and #prb-questoes (D01-020)", () => {
    expect(rule!.selectors).toEqual(expect.arrayContaining(["#prb-auditoria", "#prb-questoes"]));
  });
});
