import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ODM-016B — CSS-contract regression: every real in-app fragment target must
 * carry the compact sticky-header scroll-margin-top offset, not just
 * Problem/Overview (the pre-existing F4 rule). Extends coverage to the EVD/SRC
 * `.record-editorial-section` ids and `#relacoes` (see EvdDetail.tsx,
 * sourceSectionIndex.ts, RecordDetailPanel.tsx) without introducing a new
 * mechanism — one rule, the same scroll-margin-top declaration.
 */
const css = fs.readFileSync(path.resolve(__dirname, "index.css"), "utf8");

function ruleFor(selectorFragment: string): string | null {
  const compactMediaStart = css.indexOf("@media (max-width: 767px)");
  const scoped = css.slice(compactMediaStart);
  const selectorIndex = scoped.indexOf(selectorFragment);
  if (selectorIndex === -1) return null;
  const blockEnd = scoped.indexOf("}", selectorIndex);
  return scoped.slice(selectorIndex, blockEnd);
}

describe("index.css — compact sticky-header scroll-margin-top coverage (ODM-016B)", () => {
  it("covers #relacoes and .record-editorial-section alongside the pre-existing .problem-section/#overview-problemas rule", () => {
    const block = ruleFor("#overview-problemas");
    expect(block).toBeTruthy();
    expect(block).toContain(".problem-section");
    expect(block).toContain(".record-editorial-section");
    expect(block).toContain("#relacoes");
    expect(block).toContain("scroll-margin-top: 108px");
  });
});
