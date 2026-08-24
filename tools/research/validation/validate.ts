/**
 * Pure validation logic for the canonical SRC/EVD/PRB research corpus.
 *
 * Built on the shared TC-01 loading/indexing layer (corpus.ts) instead of
 * re-walking research/schemas/* or research/<dir>/*.yaml directly.
 * research/schemas/* remains the executable structural authority
 * (docs/datamodel.md §7) — this module interprets it, it does not restate
 * it.
 *
 * No process/console/exit-code handling here; see validate-cli.ts for the
 * CLI wrapper. This module performs structural validation only: it makes
 * no semantic research judgement (docs/datamodel.md §6, AGENTS.md
 * "Human-owned decisions").
 */
import { loadCorpusIndexTolerant } from "../core/corpus.ts";
import type { CorpusIndex, ParsedRecord, RecordFields, RecordIndex, RecordSchema } from "../core/types.ts";

export interface ValidationResult {
  errors: string[];
  totalRecords: number;
}

function getPath(fields: RecordFields, dotted: string): unknown {
  let cur: unknown = fields;
  for (const part of dotted.split(".")) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur) || !(part in cur)) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function validateIdAndFilename(
  file: string,
  record: RecordFields,
  schema: RecordSchema,
  seenIds: Map<string, string>,
  errors: string[]
): void {
  const id = getPath(record, schema.idField);
  if (typeof id !== "string" || id.trim() === "") {
    errors.push(`[${file}] missing required field: ${schema.idField}`);
    return;
  }
  if (!id.startsWith(schema.prefix)) {
    errors.push(`[${file}] ID "${id}" does not start with expected prefix "${schema.prefix}"`);
  }
  const base = file.split("/").pop()!.replace(/\.ya?ml$/, "");
  if (base !== id) {
    errors.push(`[${file}] filename "${base}" does not match record ID "${id}"`);
  }
  if (seenIds.has(id)) {
    errors.push(`[${file}] duplicate ID "${id}" also used in ${seenIds.get(id)}`);
  } else {
    seenIds.set(id, file);
  }
}

function validateRequiredFields(file: string, record: RecordFields, schema: RecordSchema, errors: string[]): void {
  for (const reqField of schema.requiredFields || []) {
    const val = getPath(record, reqField);
    if (val === undefined || val === null || val === "") {
      errors.push(`[${file}] missing required field: ${reqField}`);
    }
  }
}

function validateEnums(file: string, record: RecordFields, schema: RecordSchema, errors: string[]): void {
  for (const [field, allowed] of Object.entries(schema.enums || {})) {
    const val = getPath(record, field);
    if (val === undefined || val === null) continue;
    const values = Array.isArray(val) ? val : [val];
    for (const v of values) {
      if (!allowed.includes(v as string)) {
        errors.push(
          `[${file}] field "${field}" has invalid value "${v}" (expected one of: ${allowed.join(", ")})`
        );
      }
    }
  }
}

function validateBooleanFields(file: string, record: RecordFields, schema: RecordSchema, errors: string[]): void {
  for (const field of schema.booleanFields || []) {
    const val = getPath(record, field);
    if (val === undefined || val === null) continue;
    if (typeof val !== "boolean") {
      errors.push(`[${file}] field "${field}" must be a boolean (true|false), got "${val}"`);
    }
  }
}

function validateReferences(recordIndexes: RecordIndex[], errors: string[]): void {
  const idsByPrefix = new Map<string, ReadonlyMap<string, ParsedRecord>>();
  for (const { schema, byId } of recordIndexes) {
    idsByPrefix.set(schema.prefix, byId);
  }

  for (const { schema, records } of recordIndexes) {
    for (const ref of schema.references || []) {
      const targetIds = idsByPrefix.get(ref.targetPrefix);
      for (const { file, fields } of records) {
        const val = getPath(fields, ref.field);
        if (val === undefined || val === null) {
          if (ref.required) {
            errors.push(`[${file}] missing required reference field: ${ref.field}`);
          }
          continue;
        }
        const targets = ref.isList ? (Array.isArray(val) ? val : [val]) : [val];
        for (const t of targets) {
          if (typeof t !== "string") continue;
          if (t.trim() === "") {
            if (ref.isList) {
              errors.push(
                `[${file}] field "${ref.field}" contains an empty reference entry (expected a ${ref.targetPrefix}* ID)`
              );
            }
            continue;
          }
          if (!targetIds || !targetIds.has(t)) {
            errors.push(
              `[${file}] field "${ref.field}" references non-existent ${ref.targetPrefix}* record "${t}"`
            );
          }
        }
      }
    }
  }
}

/**
 * Validates an already-loaded CorpusIndex against its declared schemas.
 * Preserves the legacy tools/validate-research.js rule set exactly: ID
 * presence/prefix/filename match, duplicate-ID detection, required
 * fields, enums, boolean fields, and cross-reference integrity.
 *
 * Note: byId dedupes silently on first-seen (see corpus.ts), so duplicate
 * detection here re-derives duplicates from `records` (insertion order),
 * not from byId.
 */
export function validateCorpusIndex(index: CorpusIndex): ValidationResult {
  const errors: string[] = [];
  const seenIds = new Map<string, string>();
  const recordIndexes = [...index.byPrefix.values()];

  for (const { schema, records } of recordIndexes) {
    for (const { file, fields } of records) {
      validateIdAndFilename(file, fields, schema, seenIds, errors);
      validateRequiredFields(file, fields, schema, errors);
      validateEnums(file, fields, schema, errors);
      validateBooleanFields(file, fields, schema, errors);
    }
  }

  validateReferences(recordIndexes, errors);

  return { errors, totalRecords: index.totalRecords };
}

/**
 * Loads the corpus at researchRoot (tolerating malformed YAML files, which
 * are reported as validation errors rather than aborting the load — this
 * matches the legacy validator's per-file try/catch) and validates it.
 */
export function validateResearchRoot(researchRoot: string): ValidationResult {
  const { index, issues } = loadCorpusIndexTolerant(researchRoot);
  const errors = issues.map((failure) => `[${failure.file}] malformed YAML: ${failure.message}`);
  const result = validateCorpusIndex(index);
  return { errors: [...errors, ...result.errors], totalRecords: result.totalRecords };
}
