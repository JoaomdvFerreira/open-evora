import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");
const appCss = read("index.css");
const evdCss = read("styles/evd-detail.css");
const tokensCss = read("styles/tokens.css");
const productionEntry = read("main.tsx");
const storybookEntry = read("../.storybook/preview.ts");
const evdStory = read("records/EvdDetail.stories.tsx");

function ruleBody(source: string, selector: string): string {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rules.exec(css)) !== null) {
    if (match[1].split(",").map((part) => part.trim()).includes(selector)) return match[2];
  }
  throw new Error(`Missing CSS rule for ${selector}`);
}

const expectedFontImports = [
  "ibm-plex-mono/latin-400.css",
  "ibm-plex-mono/latin-ext-400.css",
  "ibm-plex-mono/latin-500.css",
  "ibm-plex-mono/latin-ext-500.css",
  "public-sans/latin-400.css",
  "public-sans/latin-ext-400.css",
  "public-sans/latin-600.css",
  "public-sans/latin-ext-600.css",
  "source-serif-4/latin-400.css",
  "source-serif-4/latin-ext-400.css",
  "source-serif-4/latin-600.css",
  "source-serif-4/latin-ext-600.css",
  "source-serif-4/latin-700.css",
  "source-serif-4/latin-ext-700.css",
].sort();

function fontImports(source: string): string[] {
  return [...source.matchAll(/@fontsource\/([^"']+\.css)/g)].map((match) => match[1]).sort();
}

describe("production and Storybook visual runtime contracts", () => {
  it("bounds the compact EVD audit actions using the same box model in both runtimes", () => {
    const actionRule = ruleBody(evdCss, ".evd-audit-primary-cta");
    const sharedActionRule = ruleBody(evdCss, ".evd-audit-secondary-cta");
    expect(sharedActionRule).toMatch(/box-sizing:\s*border-box\s*;/);
    expect(actionRule).toMatch(/box-sizing:\s*border-box\s*;/);
    expect(evdCss).toMatch(/\.evd-audit-secondary-cta,\s*\.evd-audit-primary-cta\s*\{[^}]*box-sizing:\s*border-box/);
    expect(evdCss).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*?\.evd-audit-primary-cta\s*\{[^}]*width:\s*100%/);
    expect(productionEntry).toContain('import "./styles/evd-detail.css";');
    expect(evdStory).toContain('import "../styles/evd-detail.css";');
  });

  it("lets the adopted interface typography token control the production body", () => {
    expect(ruleBody(appCss, "body")).toMatch(/font-family:\s*var\(--font-interface\)\s*;/);
    expect(ruleBody(appCss, "body")).not.toMatch(/system-ui/);
    expect(tokensCss).toMatch(/--font-interface:\s*var\(--p-font-sans\)\s*;/);
    expect(tokensCss).toMatch(/--p-font-sans:\s*"Public Sans"/);
  });

  it("loads the same required Latin and Latin Extended font weights in production and Storybook", () => {
    expect(fontImports(productionEntry)).toEqual(expectedFontImports);
    expect(fontImports(storybookEntry)).toEqual(expectedFontImports);
    expect(productionEntry + storybookEntry).not.toMatch(/@fontsource\/inter\//);
  });
});
