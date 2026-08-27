/**
 * UX-E: a small, honest "Leitura rápida" built only from fields the read
 * model already exposes on `detail.record` — no inferred/generated text.
 * Each accessor returns null when its field is absent/malformed rather than
 * substituting a fallback claim (safety contract: never invent a fact).
 */
import { publicEnumLabel, publicFieldCaption } from "../presentation";

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export interface QuickReadItem {
  /** Canonical dotted field path, used only for the caption lookup and test targeting — never displayed raw. */
  field: string;
  label: string;
  value: string;
}

/**
 * EVD quick-read: observation summary is already the meaning-zone sentence
 * (findMeaningField), so it is deliberately not repeated here — this only
 * adds the fields UX-E lists that meaning zone does not already surface.
 */
export function evidenceQuickRead(record: Record<string, unknown>): QuickReadItem[] {
  const items: QuickReadItem[] = [];
  const nature = getString(record, "evidence_nature");
  if (nature) items.push({ field: "evidence_nature", label: publicFieldCaption("evidence_nature"), value: publicEnumLabel("evidence_nature", nature) });
  return items;
}

/** SRC quick-read: identity/publisher are already-canonical fields — no derived "trust score" or similar is computed. */
export function sourceQuickRead(record: Record<string, unknown>): QuickReadItem[] {
  const items: QuickReadItem[] = [];
  const publisher = getString(record, "publisher");
  if (publisher) items.push({ field: "publisher", label: "Editor", value: publisher });
  return items;
}

export function sourceName(record: Record<string, unknown>): string | null {
  return getString(record, "name");
}
