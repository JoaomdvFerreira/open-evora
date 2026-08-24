import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { loadSchemas } from "./schemas.ts";
import type { CorpusIndex, ParsedRecord, RecordIndex, RecordSchema } from "./types.ts";
import { parseRecordYaml } from "./yaml.ts";

function getPath(fields: Record<string, unknown>, dotted: string): unknown {
  let cur: unknown = fields;
  for (const part of dotted.split(".")) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur) || !(part in cur)) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function collectRecordFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();
}

/** A record file that failed to parse as YAML, keyed by its research-root-relative path. */
export interface MalformedRecordFile {
  file: string;
  message: string;
}

/** Result of a tolerant corpus load: the index built from every file that did parse, plus every one that didn't. */
export interface CorpusLoadResult {
  index: CorpusIndex;
  issues: MalformedRecordFile[];
}

/**
 * Loads and parses every record file for one schema-declared record type,
 * then indexes it by the schema's declared idField. Deterministic: files
 * are read in sorted filename order, and byId reflects that same order.
 *
 * This mirrors tools/validate-research.js's file-discovery convention
 * (research/<schema.directory>/*.yaml) without reusing its bespoke YAML
 * parser or its validation-rule interpretation — this loader only reads
 * and indexes; it makes no PASS/FAIL judgement about record shape.
 *
 * When `tolerant` is true, a file that fails to parse is collected into
 * `issues` and skipped instead of thrown, so one bad file does not abort
 * loading the rest of the record set.
 */
function loadRecordSet(researchRoot: string, schema: RecordSchema, tolerant: boolean, issues: MalformedRecordFile[]): RecordIndex {
  const dir = join(researchRoot, schema.directory);
  const filenames = collectRecordFiles(dir);

  const records: ParsedRecord[] = [];
  const byId = new Map<string, ParsedRecord>();

  for (const filename of filenames) {
    const absPath = join(dir, filename);
    const file = relative(researchRoot, absPath).split("\\").join("/");
    const text = readFileSync(absPath, "utf8");

    let fields;
    try {
      fields = parseRecordYaml(text);
    } catch (e) {
      if (!tolerant) throw e;
      issues.push({ file, message: (e as Error).message });
      continue;
    }

    const record: ParsedRecord = { file, fields };
    records.push(record);

    const id = getPath(fields, schema.idField);
    if (typeof id === "string" && id.trim() !== "" && !byId.has(id)) {
      byId.set(id, record);
    }
  }

  return { schema, records, byId };
}

function buildCorpusIndex(researchRoot: string, tolerant: boolean, issues: MalformedRecordFile[]): CorpusIndex {
  const schemas = loadSchemas(researchRoot);
  const byPrefix = new Map<string, RecordIndex>();
  let totalRecords = 0;

  for (const schema of schemas) {
    const recordIndex = loadRecordSet(researchRoot, schema, tolerant, issues);
    byPrefix.set(schema.prefix, recordIndex);
    totalRecords += recordIndex.records.length;
  }

  return { researchRoot, byPrefix, totalRecords };
}

/**
 * Builds the deterministic SRC/EVD/PRB/ASM corpus index for researchRoot
 * (defaults to the repository's research/ directory). One shared
 * loading/indexing layer for research tooling built on top of it (TC-01
 * scope) — this performs no validation and no semantic interpretation; it
 * only reads, parses, and indexes what research/schemas/* declares.
 *
 * Strict: throws on the first malformed record file. See
 * loadCorpusIndexTolerant to instead collect parse failures and continue
 * loading the rest of the corpus.
 */
export function loadCorpusIndex(researchRoot: string): CorpusIndex {
  return buildCorpusIndex(researchRoot, false, []);
}

/**
 * Like loadCorpusIndex, but a record file that fails to parse is collected
 * into `issues` and skipped instead of aborting the load — used by
 * validators that must report every problem in one pass rather than
 * stopping at the first one.
 */
export function loadCorpusIndexTolerant(researchRoot: string): CorpusLoadResult {
  const issues: MalformedRecordFile[] = [];
  const index = buildCorpusIndex(researchRoot, true, issues);
  return { index, issues };
}
