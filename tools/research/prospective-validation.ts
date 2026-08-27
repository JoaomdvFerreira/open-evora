/**
 * Read-only prospective validation for already-parsed candidate records.
 *
 * This module deliberately has no candidate filesystem/package contract.
 * It overlays parsed fields onto a fresh in-memory CorpusIndex and delegates
 * every structural and cross-reference decision to validateCorpusIndex().
 */
import { classifyCandidateDelta, type CandidateDelta, type CandidateRecord } from "./candidate-delta.ts";
import type { CorpusIndex, ParsedRecord, RecordFields, RecordIndex } from "./core/types.ts";
import { validateCorpusIndex, type ValidationResult } from "./validation/validate.ts";

/** The prospective index and deterministic deltas used to construct it. */
export interface ProspectiveCorpusOverlay {
  index: CorpusIndex;
  deltas: CandidateDelta[];
}

/** Result of validating every candidate against one complete prospective corpus. */
export interface CandidateSetValidationResult {
  deltas: CandidateDelta[];
  validation: ValidationResult;
}

interface ClassifiedCandidate {
  candidate: CandidateRecord;
  delta: CandidateDelta;
}

function getPath(fields: RecordFields, dotted: string): unknown {
  let current: unknown = fields;
  for (const part of dotted.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current) || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function compareTargets(left: ClassifiedCandidate, right: ClassifiedCandidate): number {
  return left.delta.recordFamily.localeCompare(right.delta.recordFamily) || left.delta.id.localeCompare(right.delta.id);
}

function syntheticFile(recordIndex: RecordIndex, id: string): string {
  return `${recordIndex.schema.directory}/${id}.yaml`;
}

function candidateRecord(recordIndex: RecordIndex, candidate: CandidateRecord, id: string): ParsedRecord {
  return {
    // Parsed YAML fields are plain data. Cloning lets the returned index be
    // independently inspected without exposing either input for mutation.
    fields: structuredClone(candidate.fields),
    file: syntheticFile(recordIndex, id),
  };
}

function canonicalRecord(record: ParsedRecord): ParsedRecord {
  return { file: record.file, fields: structuredClone(record.fields) };
}

function indexRecords(recordIndex: RecordIndex, records: ParsedRecord[]): ReadonlyMap<string, ParsedRecord> {
  const byId = new Map<string, ParsedRecord>();
  for (const record of records) {
    const id = getPath(record.fields, recordIndex.schema.idField);
    if (typeof id === "string" && id.trim() !== "" && !byId.has(id)) byId.set(id, record);
  }
  return byId;
}

function classifyCandidateSet(index: CorpusIndex, candidates: readonly CandidateRecord[]): ClassifiedCandidate[] {
  if (!Array.isArray(candidates)) throw new Error("candidate set must be an array");

  const classified = candidates.map((candidate) => ({ candidate, delta: classifyCandidateDelta(index, candidate) }));
  const targets = new Set<string>();
  for (const { delta } of classified) {
    const target = `${delta.recordFamily}\u0000${delta.id}`;
    if (targets.has(target)) {
      throw new Error(`candidate set contains more than one candidate targeting ${delta.recordFamily}${delta.id}`);
    }
    targets.add(target);
  }

  return classified.sort(compareTargets);
}

function buildOverlay(index: CorpusIndex, candidates: readonly CandidateRecord[]): ProspectiveCorpusOverlay {
  const classified = classifyCandidateSet(index, candidates);
  const candidatesByFamily = new Map<string, Map<string, ClassifiedCandidate>>();
  for (const item of classified) {
    let family = candidatesByFamily.get(item.delta.recordFamily);
    if (!family) {
      family = new Map();
      candidatesByFamily.set(item.delta.recordFamily, family);
    }
    family.set(item.delta.id, item);
  }

  const byPrefix = new Map<string, RecordIndex>();
  let totalRecords = 0;
  for (const [prefix, canonicalIndex] of index.byPrefix) {
    const familyCandidates = candidatesByFamily.get(prefix);
    const records = canonicalIndex.records.map((canonical) => {
      const id = getPath(canonical.fields, canonicalIndex.schema.idField);
      const replacement = typeof id === "string" ? familyCandidates?.get(id) : undefined;
      return replacement?.delta.action === "UPDATE"
        ? candidateRecord(canonicalIndex, replacement.candidate, replacement.delta.id)
        : canonicalRecord(canonical);
    });

    for (const item of familyCandidates?.values() ?? []) {
      if (item.delta.action === "CREATE") {
        records.push(candidateRecord(canonicalIndex, item.candidate, item.delta.id));
      }
    }

    byPrefix.set(prefix, {
      schema: canonicalIndex.schema,
      records,
      byId: indexRecords(canonicalIndex, records),
    });
    totalRecords += records.length;
  }

  return {
    index: { researchRoot: index.researchRoot, byPrefix, totalRecords },
    deltas: classified.map(({ delta }) => delta),
  };
}

/**
 * Builds the in-memory corpus that would result from integrating candidates.
 * CREATE records are appended to their schema-declared family, UPDATE
 * records replace their canonical target, and NO_CHANGE records retain the
 * canonical representation. No input object or filesystem path is changed.
 */
export function buildProspectiveCorpusIndex(index: CorpusIndex, candidates: readonly CandidateRecord[]): CorpusIndex {
  return buildOverlay(index, candidates).index;
}

/**
 * Classifies a whole candidate set, overlays it in memory, then runs the
 * canonical corpus validator exactly once against the complete result.
 */
export function validateCandidateSet(
  index: CorpusIndex,
  candidates: readonly CandidateRecord[]
): CandidateSetValidationResult {
  const overlay = buildOverlay(index, candidates);
  return { deltas: overlay.deltas, validation: validateCorpusIndex(overlay.index) };
}
