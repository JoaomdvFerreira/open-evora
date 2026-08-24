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

/**
 * Loads and parses every record file for one schema-declared record type,
 * then indexes it by the schema's declared idField. Deterministic: files
 * are read in sorted filename order, and byId reflects that same order.
 *
 * This mirrors tools/validate-research.js's file-discovery convention
 * (research/<schema.directory>/*.yaml) without reusing its bespoke YAML
 * parser or its validation-rule interpretation — this loader only reads
 * and indexes; it makes no PASS/FAIL judgement about record shape.
 */
function loadRecordSet(researchRoot: string, schema: RecordSchema): RecordIndex {
  const dir = join(researchRoot, schema.directory);
  const filenames = collectRecordFiles(dir);

  const records: ParsedRecord[] = [];
  const byId = new Map<string, ParsedRecord>();

  for (const filename of filenames) {
    const absPath = join(dir, filename);
    const file = relative(researchRoot, absPath).split("\\").join("/");
    const text = readFileSync(absPath, "utf8");
    const fields = parseRecordYaml(text);
    const record: ParsedRecord = { file, fields };
    records.push(record);

    const id = getPath(fields, schema.idField);
    if (typeof id === "string" && id.trim() !== "" && !byId.has(id)) {
      byId.set(id, record);
    }
  }

  return { schema, records, byId };
}

/**
 * Builds the deterministic SRC/EVD/PRB/ASM corpus index for researchRoot
 * (defaults to the repository's research/ directory). One shared
 * loading/indexing layer for research tooling built on top of it (TC-01
 * scope) — this performs no validation and no semantic interpretation; it
 * only reads, parses, and indexes what research/schemas/* declares.
 */
export function loadCorpusIndex(researchRoot: string): CorpusIndex {
  const schemas = loadSchemas(researchRoot);
  const byPrefix = new Map<string, RecordIndex>();
  let totalRecords = 0;

  for (const schema of schemas) {
    const recordIndex = loadRecordSet(researchRoot, schema);
    byPrefix.set(schema.prefix, recordIndex);
    totalRecords += recordIndex.records.length;
  }

  return { researchRoot, byPrefix, totalRecords };
}
