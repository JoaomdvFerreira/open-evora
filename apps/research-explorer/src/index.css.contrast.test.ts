import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ODM-017 — deterministic contrast regression (WU032/WU033 contract): a pure
 * computation over the actual --ink-faintest/background token pair values
 * read from index.css, so a future edit to either token cannot silently
 * regress below WCAG 2.1 AA (4.5:1) without failing this test. No browser
 * needed — see docs/explorerarchitecture.md §6 for when rendered contrast
 * measurement is additionally required.
 */
const CSS_PATH = path.resolve(__dirname, "index.css");
const css = fs.readFileSync(CSS_PATH, "utf8");

function readToken(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`Token --${name} not found in index.css`);
  return match[1];
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const WCAG_AA_TEXT = 4.5;

describe("index.css — --ink-faintest contrast (ODM-017)", () => {
  const inkFaintest = readToken("ink-faintest");
  const backgrounds: [string, string][] = [
    ["canvas", readToken("canvas")],
    ["surface", readToken("surface")],
    ["surface-muted", readToken("surface-muted")],
    ["surface-chip", readToken("surface-chip")],
  ];

  it.each(backgrounds)("meets WCAG 2.1 AA (>=4.5:1) against --%s", (_name, bgHex) => {
    expect(contrastRatio(inkFaintest, bgHex)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});
