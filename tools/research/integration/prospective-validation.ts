/**
 * Read-only prospective validation for already-parsed candidate records.
 *
 * This module deliberately has no candidate filesystem/package contract.
 * It overlays parsed fields onto a fresh in-memory CorpusIndex and delegates
 * every structural and cross-reference decision to validateCorpusIndex().
 */
import { classifyCandidateDelta, type CandidateDelta, type CandidateRecord } from "./candidate-delta.ts";
import { getRecordField } from "../core/record-fields.ts";
import type { CorpusIndex, ParsedRecord, RecordIndex } from "../core/types.ts";
import { validateCorpusIndex, type ValidationResult } from "../validation/validate.ts";

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
    const id = getRecordField(record.fields, recordIndex.schema.idField);
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
      const id = getRecordField(canonical.fields, canonicalIndex.schema.idField);
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
    records.sort((left, right) => left.file < right.file ? -1 : left.file > right.file ? 1 : 0);

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
 * Fields that an UPDATE may never change relative to its canonical base
 * record, keyed by schema-declared record family (ODM-008).
 *
 * This is an integration/UPDATE invariant, not a pure record-schema rule: a
 * standalone PRB carrying any well-formed `created_at` is valid on its own,
 * and only becomes invalid when offered as an UPDATE that would rewrite the
 * canonical record's original creation date. Encoding it in the record
 * schema would therefore be semantically wrong.
 */
const UPDATE_IMMUTABLE_FIELDS: ReadonlyMap<string, readonly string[]> = new Map([
  ["PRB-", ["created_at"]],
]);

/**
 * Compares one immutable field between an UPDATE candidate and its canonical
 * base. YAML may surface a date as a Date or a string depending on quoting,
 * so both sides are normalized to their authored `YYYY-MM-DD` form before
 * comparison: re-quoting a date is a serialization change, not a mutation.
 */
function immutableFieldValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/**
 * Rejects an UPDATE candidate that would change a field the integration
 * contract holds immutable against the canonical base record.
 */
function validateUpdateImmutability(
  index: CorpusIndex,
  candidates: readonly CandidateRecord[],
  deltas: readonly CandidateDelta[],
  errors: string[]
): void {
  for (const delta of deltas) {
    if (delta.action !== "UPDATE") continue;
    const immutable = UPDATE_IMMUTABLE_FIELDS.get(delta.recordFamily);
    if (!immutable) continue;
    const recordIndex = index.byPrefix.get(delta.recordFamily);
    const base = recordIndex?.byId.get(delta.id);
    if (!recordIndex || !base) continue;
    const candidate = candidates.find((entry) => {
      if (entry.recordFamily !== delta.recordFamily) return false;
      return getRecordField(entry.fields, recordIndex.schema.idField) === delta.id;
    });
    if (!candidate) continue;

    for (const field of immutable) {
      const baseValue = immutableFieldValue(getRecordField(base.fields, field));
      const candidateValue = immutableFieldValue(getRecordField(candidate.fields, field));
      if (baseValue === candidateValue) continue;
      errors.push(
        `[${syntheticFile(recordIndex, delta.id)}] field "${field}" is immutable on UPDATE: `
        + `base "${baseValue ?? "(absent)"}" cannot become "${candidateValue ?? "(absent)"}"`
      );
    }
  }
}

/**
 * Classifies a whole candidate set, overlays it in memory, then runs the
 * canonical corpus validator exactly once against the complete result.
 *
 * Structural validity is the corpus validator's decision; this additionally
 * enforces the UPDATE-only invariants that are only meaningful relative to a
 * canonical base record and therefore cannot live in the record schema.
 */
export function validateCandidateSet(
  index: CorpusIndex,
  candidates: readonly CandidateRecord[]
): CandidateSetValidationResult {
  const overlay = buildOverlay(index, candidates);
  const validation = validateCorpusIndex(overlay.index);
  const errors = [...validation.errors];
  validateUpdateImmutability(index, candidates, overlay.deltas, errors);
  return { deltas: overlay.deltas, validation: { ...validation, errors } };
}
