import { Font } from "@react-pdf/renderer";
import serifLatin400 from "@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff?url";
import serifLatin700 from "@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff?url";
import serifLatinExt400 from "@fontsource/source-serif-4/files/source-serif-4-latin-ext-400-normal.woff?url";
import serifLatinExt700 from "@fontsource/source-serif-4/files/source-serif-4-latin-ext-700-normal.woff?url";
import sansLatin400 from "@fontsource/public-sans/files/public-sans-latin-400-normal.woff?url";
import sansLatin600 from "@fontsource/public-sans/files/public-sans-latin-600-normal.woff?url";
import sansLatinExt400 from "@fontsource/public-sans/files/public-sans-latin-ext-400-normal.woff?url";
import sansLatinExt600 from "@fontsource/public-sans/files/public-sans-latin-ext-600-normal.woff?url";
import monoLatin400 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff?url";
import monoLatinExt400 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-400-normal.woff?url";

/**
 * The dossier's typefaces are the Explorer's own — Source Serif 4, Public
 * Sans and IBM Plex Mono — taken from the same self-hosted @fontsource
 * files the site ships (bundled local assets; no font service is contacted).
 *
 * Each family registers its Latin subset first and its Latin Extended
 * subset as a per-glyph fallback, so Portuguese text (á à â ã ç é ê í ó ô
 * õ ú, «», –, —) and wider authored Latin characters resolve to real
 * glyphs. English hyphenation is disabled so Portuguese words are never
 * split at wrong syllable breaks.
 *
 * React-PDF's font engine (fontkit) cannot subset WOFF2 and misreads some
 * WOFF 1.0 tables, so each WOFF file is unpacked into the plain TrueType
 * font it wraps (WOFF 1.0 is per-table zlib compression of an SFNT) and
 * registered as a data URL.
 */

export const DOSSIER_FONT_FAMILIES = {
  serif: ["DossierSerif", "DossierSerifExt"],
  sans: ["DossierSans", "DossierSansExt"],
  mono: ["DossierMono", "DossierMonoExt"],
};

const FONT_FILES: { family: string; weight: number; file: string }[] = [
  { family: "DossierSerif", weight: 400, file: serifLatin400 },
  { family: "DossierSerif", weight: 700, file: serifLatin700 },
  { family: "DossierSerifExt", weight: 400, file: serifLatinExt400 },
  { family: "DossierSerifExt", weight: 700, file: serifLatinExt700 },
  { family: "DossierSans", weight: 400, file: sansLatin400 },
  { family: "DossierSans", weight: 600, file: sansLatin600 },
  { family: "DossierSansExt", weight: 400, file: sansLatinExt400 },
  { family: "DossierSansExt", weight: 600, file: sansLatinExt600 },
  { family: "DossierMono", weight: 400, file: monoLatin400 },
  { family: "DossierMonoExt", weight: 400, file: monoLatinExt400 },
];

async function inflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Unpacks a WOFF 1.0 file into the SFNT (TrueType/OpenType) font it wraps: same tables, same checksums, 4-byte aligned. */
export async function woffToSfnt(woff: ArrayBuffer): Promise<Uint8Array> {
  const input = new DataView(woff);
  if (input.getUint32(0) !== 0x774f4646) throw new Error("Not a WOFF 1.0 font");
  const flavor = input.getUint32(4);
  const numTables = input.getUint16(12);
  const tables = await Promise.all(
    Array.from({ length: numTables }, async (_, index) => {
      const entry = 44 + index * 20;
      const offset = input.getUint32(entry + 4);
      const compLength = input.getUint32(entry + 8);
      const origLength = input.getUint32(entry + 12);
      const raw = new Uint8Array(woff, offset, compLength);
      const data = compLength < origLength ? await inflate(raw) : raw;
      if (data.length !== origLength) throw new Error("Corrupt WOFF table");
      return { tag: input.getUint32(entry), checksum: input.getUint32(entry + 16), data };
    }),
  );

  const directoryEnd = 12 + numTables * 16;
  const size = tables.reduce((total, table) => total + ((table.data.length + 3) & ~3), directoryEnd);
  const sfnt = new Uint8Array(size);
  const output = new DataView(sfnt.buffer);
  const entrySelector = Math.floor(Math.log2(numTables));
  const searchRange = 2 ** entrySelector * 16;
  output.setUint32(0, flavor);
  output.setUint16(4, numTables);
  output.setUint16(6, searchRange);
  output.setUint16(8, entrySelector);
  output.setUint16(10, numTables * 16 - searchRange);
  let offset = directoryEnd;
  tables.forEach((table, index) => {
    const entry = 12 + index * 16;
    output.setUint32(entry, table.tag);
    output.setUint32(entry + 4, table.checksum);
    output.setUint32(entry + 8, offset);
    output.setUint32(entry + 12, table.data.length);
    sfnt.set(table.data, offset);
    offset += (table.data.length + 3) & ~3;
  });
  return sfnt;
}

function dataUrl(font: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < font.length; index += 0x8000) binary += String.fromCharCode(...font.subarray(index, index + 0x8000));
  return `data:font/ttf;base64,${btoa(binary)}`;
}

let registration: Promise<void> | null = null;

/** Loads and registers every dossier face once per session; a failed attempt is forgotten so a later generation can retry. */
export function registerDossierFonts(): Promise<void> {
  registration ??= (async () => {
    const faces = await Promise.all(
      FONT_FILES.map(async ({ family, weight, file }) => {
        const response = await fetch(file);
        if (!response.ok) throw new Error(`Font unavailable: ${file}`);
        return { family, weight, src: dataUrl(await woffToSfnt(await response.arrayBuffer())) };
      }),
    );
    for (const family of new Set(faces.map((face) => face.family))) {
      Font.register({ family, fonts: faces.filter((face) => face.family === family).map(({ src, weight }) => ({ src, fontWeight: weight })) });
    }
    Font.registerHyphenationCallback((word) => [word]);
  })().catch((error: unknown) => {
    registration = null;
    throw error;
  });
  return registration;
}
