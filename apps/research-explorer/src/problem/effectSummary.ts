import type { EvidenceWithSources } from "./problemProjection";

export interface EffectOccurrence {
  value: string;
  count: number;
}

export interface EffectSummary {
  itemCount: number;
  occurrenceCount: number;
  occurrences: EffectOccurrence[];
}

const EFFECT_ORDER = ["SUPPORTS", "REFINES", "BOUNDS", "CONTRADICTS"];

/** Tallies the PRB-owned `effects[]` values without deriving any research judgement. */
export function summarizeEffects(evidence: EvidenceWithSources[]): EffectSummary {
  const counts = new Map<string, number>();
  for (const item of evidence) {
    for (const value of item.effects ?? []) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const ordered = [...EFFECT_ORDER.filter((value) => counts.has(value)), ...[...counts.keys()].filter((value) => !EFFECT_ORDER.includes(value))];
  const occurrences = ordered.map((value) => ({ value, count: counts.get(value)! }));
  return { itemCount: evidence.length, occurrenceCount: occurrences.reduce((sum, occurrence) => sum + occurrence.count, 0), occurrences };
}
