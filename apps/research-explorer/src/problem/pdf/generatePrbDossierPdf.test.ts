// @vitest-environment node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { prb0005DataProvider } from "../prb0005Fixture";
import { loadProblemProjection } from "../problemProjection";
import { buildPrbDossierData, type PrbDossierData } from "../prbDossierProjection";
import { woffToSfnt } from "./dossierFonts";
import { generatePrbDossierPdf } from "./generatePrbDossierPdf";

/**
 * End-to-end PDF generation through the production path — real React-PDF
 * layout, the Explorer's bundled fonts and the real PRB-0005 projection —
 * run under Node. Bundled font URLs are served from the app's own
 * node_modules; nothing leaves the machine.
 */

const APP_ROOT = new URL("../../../", import.meta.url);
vi.stubGlobal("fetch", async (url: string) => new Response(await readFile(fileURLToPath(new URL(`.${url}`, APP_ROOT)))));

let dossier: PrbDossierData;
let pdf: string;

beforeAll(async () => {
  const lookup = new Map((await prb0005DataProvider.listRecords()).map((summary) => [summary.id, summary]));
  dossier = buildPrbDossierData(await loadProblemProjection(prb0005DataProvider, lookup, "PRB-0005"));
  const blob = await generatePrbDossierPdf(dossier, { generatedAt: new Date("2026-09-27T10:30:00Z"), sourceCommit: "full-source-commit", corpusFingerprint: "full-corpus-fingerprint" });
  expect(blob.type).toBe("application/pdf");
  pdf = new TextDecoder("latin1").decode(await blob.arrayBuffer());
}, 60_000);

describe("PRB dossier PDF generation", () => {
  it("produces a multi-page A4 portrait PDF", () => {
    expect(pdf.startsWith("%PDF-")).toBe(true);
    const pages = pdf.match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThan(2);
    const mediaBoxes = pdf.match(/\/MediaBox \[[^\]]*\]/g) ?? [];
    expect(mediaBoxes).toHaveLength(pages.length);
    for (const box of mediaBoxes) expect(box).toBe("/MediaBox [0 0 595.280029 841.890015]");
  });

  it("embeds the Explorer typefaces for selectable text, never needing a standard-font fallback glyph", () => {
    const fonts = new Set(pdf.match(/\/BaseFont \/[A-Za-z+-]+/g));
    expect([...fonts].some((font) => font.includes("SourceSerif"))).toBe(true);
    expect([...fonts].some((font) => font.includes("PublicSans"))).toBe(true);
    expect([...fonts].some((font) => font.includes("IBMPlexMono"))).toBe(true);
    expect(pdf).toMatch(/\/FontFile2/);
    expect(pdf).toMatch(/\/ToUnicode/);
    expect([...fonts].some((font) => /Helvetica|Times|Courier/.test(font))).toBe(false);
  });

  it("carries clickable canonical source references and in-document destinations", () => {
    for (const source of dossier.sources) {
      if (source.canonicalReference?.startsWith("http")) expect(pdf).toContain(`/URI (${source.canonicalReference})`);
    }
    expect(pdf).toMatch(/\/Dests <</);
  });

  it("declares document metadata and Portuguese language", () => {
    expect(pdf).toContain("/Lang (pt-PT)");
    expect(pdf).toMatch(/\/Title \d+ 0 R/);
    expect(pdf).toMatch(/\/Author /);
    expect(pdf).toMatch(/\/CreationDate /);
  });
});

describe("dossier font unpacking", () => {
  it("unpacks a bundled WOFF file into the TrueType font it wraps", async () => {
    const file = await readFile(fileURLToPath(new URL("node_modules/@fontsource/public-sans/files/public-sans-latin-400-normal.woff", APP_ROOT)));
    const woff = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    const sfnt = await woffToSfnt(woff);
    const view = new DataView(sfnt.buffer);
    expect(view.getUint32(0)).toBe(new DataView(woff).getUint32(4));
    expect(view.getUint16(4)).toBe(new DataView(woff).getUint16(12));
    expect(sfnt.length).toBe(new DataView(woff).getUint32(16));
    await expect(woffToSfnt(new ArrayBuffer(64))).rejects.toThrow("Not a WOFF 1.0 font");
  });
});
