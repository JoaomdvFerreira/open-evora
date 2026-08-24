/**
 * Infrastructure-only contracts for the research corpus loader.
 *
 * These types describe the *shape of loading/indexing infrastructure*
 * (schema files, parsed record files, indexes) — never the canonical
 * research domain model. Field names, enums, and record semantics for
 * SRC/EVD/PRB/ASM remain owned by research/schemas/*.schema.json
 * (executable authority) and docs/datamodel.md (semantic authority).
 * See docs/datamodel.md §7 (Schema boundary).
 */

/** A parsed record's fields as loaded from YAML: untyped by design. */
export type RecordFields = Record<string, unknown>;

/** One parsed record file plus its path relative to the research root. */
export interface ParsedRecord {
  /** Path relative to the research root, e.g. "problems/PRB-0001.yaml". */
  file: string;
  fields: RecordFields;
}

/** A reference declared in a schema's "references" array. */
export interface SchemaReference {
  field: string;
  isList?: boolean;
  targetPrefix: string;
  targetDirectory: string;
  required?: boolean;
}

/**
 * Shape of a research/schemas/*.schema.json file, as consumed by the
 * loader. Mirrors only the keys the loader/indexer reads; validation rule
 * interpretation (required fields, enums, etc.) remains the executable
 * schema's authority and is not reinterpreted here.
 */
export interface RecordSchema {
  prefix: string;
  directory: string;
  idField: string;
  sourceModel?: string;
  notes?: string;
  requiredFields?: string[];
  optionalFields?: string[];
  optionalReferenceFields?: string[];
  booleanFields?: string[];
  enums?: Record<string, string[]>;
  references?: SchemaReference[];
}

/** All records of one schema-declared type, plus the schema that describes them. */
export interface RecordSet {
  schema: RecordSchema;
  records: ParsedRecord[];
}

/**
 * Deterministic index over one record type: insertion order preserved,
 * keyed by the schema's declared idField value.
 */
export interface RecordIndex {
  schema: RecordSchema;
  /** Records in the order they were read from disk (sorted by filename). */
  records: ParsedRecord[];
  /** id -> record, for records with a valid, unique id. */
  byId: ReadonlyMap<string, ParsedRecord>;
}

/** The four canonical record-type indexes, keyed by schema prefix (e.g. "SRC-"). */
export interface CorpusIndex {
  researchRoot: string;
  byPrefix: ReadonlyMap<string, RecordIndex>;
  totalRecords: number;
}
