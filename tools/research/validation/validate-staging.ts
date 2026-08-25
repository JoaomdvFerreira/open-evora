/**
 * SRC-V2D2 — staging validation for the SRC v2 migration workstream.
 *
 * Validates YAML files staged under research/sources-v2-staging/ against
 * the candidate SRC v2 schema (research/schemas/source-v2.schema.json)
 * using the same rule engine as the active corpus validator
 * (validateCorpusIndex in ./validate.ts) — this module adds no new
 * validation rules of its own.
 *
 * The candidate schema file is deliberately keyed with a temporary
 * "SRC2-" prefix and a "sources-v2-candidate" directory (see
 * source-v2.schema.json's own `notes`) so that merely having it present
 * in research/schemas/ never perturbs the active research/sources SRC-*
 * corpus (loadSchemas/loadCorpusIndex key everything by schema.prefix).
 * Staged records, however, must keep their real canonical IDs (SRC-xxxx)
 * — D6's atomic cutover swaps the candidate schema's prefix/directory to
 * "SRC-"/"sources" in place, and staged files must already look like the
 * post-cutover corpus.
 *
 * To reconcile the two without touching source-v2.schema.json itself,
 * this module loads that schema file and validates staged records against
 * a shallow override of it: prefix "SRC-" and directory
 * "sources-v2-staging" instead of the file's own "SRC2-" /
 * "sources-v2-candidate". Every other declared rule (requiredFields,
 * allowedFields, enums, fieldTypes, patterns, conditionalRequired,
 * exclusiveFieldSets) is used exactly as authored in the candidate file.
 *
 * This never reads or writes research/sources/*, research/schemas/
 * source.schema.json, or any EVD/PRB record, and is entirely independent
 * of loadCorpusIndex's view of the active corpus (which still sees the
 * candidate schema's own on-disk "SRC2-" prefix, not the override applied
 * here).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { validateCorpusIndex } from "./validate.ts";
import type { MalformedRecordFile } from "../core/corpus.ts";
import { parseRecordYaml } from "../core/yaml.ts";
import type { CorpusIndex, ParsedRecord, RecordSchema } from "../core/types.ts";
import type { ValidationResult } from "./validate.ts";

const CANDIDATE_SCHEMA_FILE = "source-v2.schema.json";
const STAGING_PREFIX = "SRC-";
const STAGING_DIRECTORY = "sources-v2-staging";

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

/**
 * Loads research/schemas/source-v2.schema.json and returns a copy with
 * `prefix` and `directory` overridden for staging validation. The file on
 * disk, and its own "SRC2-"/"sources-v2-candidate" isolation keys, are
 * left untouched — only this in-memory copy differs.
 */
function loadStagingSchema(researchRoot: string): RecordSchema {
  const schemaPath = join(researchRoot, "schemas", CANDIDATE_SCHEMA_FILE);
  const candidate = JSON.parse(readFileSync(schemaPath, "utf8")) as RecordSchema;
  return { ...candidate, prefix: STAGING_PREFIX, directory: STAGING_DIRECTORY };
}

/**
 * Reads and parses every *.yaml/*.yml file directly under
 * researchRoot/<schema.directory>, tolerating per-file YAML parse
 * failures the same way corpus.ts's loader does (collected into `issues`
 * and skipped, rather than aborting the whole staged batch).
 */
function loadStagedRecords(
  researchRoot: string,
  schema: RecordSchema,
  issues: MalformedRecordFile[]
): CorpusIndex {
  const dir = join(researchRoot, schema.directory);
  const filenames = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
        .sort()
    : [];

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

  return {
    researchRoot,
    byPrefix: new Map([[schema.prefix, { schema, records, byId }]]),
    totalRecords: records.length,
  };
}

/**
 * Validates every YAML file in research/sources-v2-staging/ against the
 * candidate SRC v2 schema (with real "SRC-" IDs, not the schema file's own
 * temporary "SRC2-" isolation prefix). Tolerates malformed YAML the same
 * way validateResearchRoot does: a parse failure is reported as an error
 * for that file rather than aborting the whole run.
 *
 * Returns the same shape as validateResearchRoot: `errors` are
 * `[file] reason` strings carrying the staged record's file path (which
 * includes its source ID via the SRC-xxxx.yaml filename convention) and,
 * where the failing rule is field-level, the specific field and reason
 * — e.g. `[sources-v2-staging/SRC-0002.yaml] missing required field:
 * licensing.reuse`. `totalRecords` counts only the staged files actually
 * read; this never touches or counts records in research/sources/.
 */
export function validateStaging(researchRoot: string): ValidationResult {
  const schema = loadStagingSchema(researchRoot);
  const issues: MalformedRecordFile[] = [];
  const index = loadStagedRecords(researchRoot, schema, issues);

  const parseErrors = issues.map((failure) => `[${failure.file}] malformed YAML: ${failure.message}`);
  const result = validateCorpusIndex(index);
  return { errors: [...parseErrors, ...result.errors], totalRecords: result.totalRecords };
}
