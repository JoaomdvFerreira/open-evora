import { CANONICAL_CONTRIBUTION_ORDER } from "../records/ContributionChip";
import type { EvidenceWithSources } from "./problemProjection";

export interface ContributionOccurrence {
  value: string;
  count: number;
}

export interface ContributionSummary {
  itemCount: number;
  occurrenceCount: number;
  occurrences: ContributionOccurrence[];
}

function contributionsOf(evidence: EvidenceWithSources): string[] {
  const record = evidence.detail.record as Record<string, unknown>;
  const analysis = record.analysis;
  if (analysis === null || typeof analysis !== "object" || Array.isArray(analysis)) return [];
  const contribution = (analysis as Record<string, unknown>).contribution;
  return Array.isArray(contribution) ? contribution.filter((value): value is string => typeof value === "string") : [];
}

/**
 * Tallies contribution *occurrences* across an evidence list — not an
 * evidence-item count, and not an invented score. One evidence record may
 * legitimately carry more than one contribution value, so occurrenceCount
 * can exceed itemCount; callers must present both explicitly rather than
 * implying they are the same number.
 * Known canonical values are ordered first (schema order); any unrecognised
 * value that reaches here is still tallied and returned, appended after.
 */
export function summarizeContributions(evidence: EvidenceWithSources[]): ContributionSummary {
  const counts = new Map<string, number>();
  for (const item of evidence) {
    for (const value of contributionsOf(item)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const orderedKnown = CANONICAL_CONTRIBUTION_ORDER.filter((value) => counts.has(value));
  const unknownExtra = [...counts.keys()].filter((value) => !CANONICAL_CONTRIBUTION_ORDER.includes(value));
  const occurrences = [...orderedKnown, ...unknownExtra].map((value) => ({ value, count: counts.get(value)! }));
  const occurrenceCount = occurrences.reduce((sum, occurrence) => sum + occurrence.count, 0);

  return { itemCount: evidence.length, occurrenceCount, occurrences };
}
