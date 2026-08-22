#!/usr/bin/env node
/**
 * Minimal, zero-dependency validator for research/{sources,evidence,problems,hypotheses,
 * assessments} records. Parses a small YAML subset (nested maps, scalars, block/inline
 * lists of scalars) sufficient for the schemas in research/schemas/*.schema.json.
 *
 * Usage: node tools/validate-research.js [--dir <researchRoot>]
 * Exit code 0 = all records valid, 1 = at least one problem found.
 *
 * Core parsing/validation functions are exported for reuse by tools/analyze-research.js
 * and by tests; see module.exports at the bottom of this file.
 */

const fs = require("fs");
const path = require("path");

function parseScalar(raw) {
  const v = raw.trim();
  if (v === "" || v === "~" || v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "[]") return [];
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((s) => parseScalar(s.trim()));
  }
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function stripComment(line) {
  // Only strips a trailing "#" comment when it is not inside a quoted scalar.
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble) {
      if (i === 0 || line[i - 1] === " ") return line.slice(0, i);
    }
  }
  return line;
}

function indentOf(line) {
  const m = line.match(/^ */);
  return m[0].length;
}

/**
 * Parses a restricted YAML subset into a plain JS object.
 * Supports: nested maps (2-space indent), scalars, inline lists,
 * and block lists of scalars ("- item").
 */
function parseYaml(text) {
  const rawLines = text.split(/\r?\n/);
  const lines = [];
  for (const raw of rawLines) {
    const stripped = stripComment(raw).replace(/\s+$/, "");
    if (stripped.trim() === "") continue;
    if (stripped.trim() === "---") continue;
    lines.push(stripped);
  }

  let pos = 0;

  function parseBlock(indent) {
    const node = {};
    while (pos < lines.length) {
      const line = lines[pos];
      const ind = indentOf(line);
      if (ind < indent) break;
      if (ind > indent) {
        throw new Error(`Unexpected indentation at line: "${line}"`);
      }
      const trimmed = line.slice(ind);
      if (trimmed.startsWith("- ") || trimmed === "-") {
        throw new Error(`Unexpected list item outside of a list context: "${line}"`);
      }
      const colonIdx = findKeyColon(trimmed);
      if (colonIdx === -1) {
        throw new Error(`Malformed mapping line: "${line}"`);
      }
      const key = trimmed.slice(0, colonIdx).trim();
      const rest = trimmed.slice(colonIdx + 1).trim();
      pos++;
      if (rest === "") {
        // Nested block: either a map or a list, determined by lookahead.
        if (pos < lines.length && indentOf(lines[pos]) > indent) {
          const nextTrimmed = lines[pos].slice(indentOf(lines[pos]));
          if (nextTrimmed.startsWith("- ") || nextTrimmed === "-") {
            node[key] = parseList(indentOf(lines[pos]));
          } else {
            node[key] = parseBlock(indentOf(lines[pos]));
          }
        } else {
          node[key] = null;
        }
      } else {
        node[key] = parseScalar(rest);
      }
    }
    return node;
  }

  function parseList(indent) {
    const items = [];
    while (pos < lines.length) {
      const line = lines[pos];
      const ind = indentOf(line);
      if (ind < indent) break;
      if (ind > indent) throw new Error(`Unexpected indentation in list: "${line}"`);
      const trimmed = line.slice(ind);
      if (!(trimmed.startsWith("- ") || trimmed === "-")) break;
      const itemRaw = trimmed === "-" ? "" : trimmed.slice(2);
      pos++;
      items.push(parseScalar(itemRaw));
    }
    return items;
  }

  function findKeyColon(s) {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (c === ":" && !inSingle && !inDouble) {
        if (i + 1 === s.length || s[i + 1] === " ") return i;
      }
    }
    return -1;
  }

  return parseBlock(0);
}

function getPath(obj, dotted) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function loadSchemas(researchRoot) {
  const schemasDir = path.join(researchRoot, "schemas");
  const files = fs
    .readdirSync(schemasDir)
    .filter((f) => f.endsWith(".schema.json"));
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(schemasDir, f), "utf8")));
}

function collectRecordFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f));
}

/**
 * Validates the ASM-* "critical_unknowns" keyed-map shape (dynamic keys, e.g. U1, U2,
 * ...), which the generic dotted-path requiredFields/enums mechanism cannot express
 * because the key names are not fixed. Structural shape only — no semantic
 * interpretation of question content.
 */
const CRITICAL_UNKNOWN_IMPACT_ENUM = ["HIGH", "MEDIUM", "LOW"];

function validateCriticalUnknowns(rel, record, errors) {
  const cu = record.critical_unknowns;
  if (cu === undefined || cu === null) return;
  if (typeof cu !== "object" || Array.isArray(cu)) {
    errors.push(`[${rel}] field "critical_unknowns" must be a keyed map (e.g. U1, U2, ...)`);
    return;
  }
  for (const [key, entry] of Object.entries(cu)) {
    const label = `critical_unknowns.${key}`;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`[${rel}] field "${label}" must be a map with question/decision_impact/target_phase`);
      continue;
    }
    if (typeof entry.question !== "string" || entry.question.trim() === "") {
      errors.push(`[${rel}] field "${label}.question" is required and must be a non-empty string`);
    }
    if (!CRITICAL_UNKNOWN_IMPACT_ENUM.includes(entry.decision_impact)) {
      errors.push(
        `[${rel}] field "${label}.decision_impact" has invalid value "${entry.decision_impact}" (expected one of: ${CRITICAL_UNKNOWN_IMPACT_ENUM.join(", ")})`
      );
    }
    if (typeof entry.target_phase !== "string" || entry.target_phase.trim() === "") {
      errors.push(`[${rel}] field "${label}.target_phase" is required and must be a non-empty string`);
    }
    if (entry.best_next_evidence !== undefined && entry.best_next_evidence !== null) {
      if (!Array.isArray(entry.best_next_evidence)) {
        errors.push(`[${rel}] field "${label}.best_next_evidence" must be a list when present`);
      } else if (entry.best_next_evidence.some((v) => typeof v !== "string")) {
        errors.push(`[${rel}] field "${label}.best_next_evidence" must be a list of strings`);
      }
    }
  }
}

/**
 * Loads and validates every schema-declared record type under researchRoot.
 * Returns { errors, totalRecords, parsedByDir } where parsedByDir maps
 * schema.prefix -> { schema, parsed: [{ file, record }] }.
 */
function validateResearchTree(researchRoot) {
  const schemaRoot = researchRoot;
  const schemas = loadSchemas(schemaRoot);
  const errors = [];
  const seenIds = new Map(); // id -> file
  const recordsByPrefix = new Map(); // prefix -> Set(ids)
  const parsedByDir = new Map();

  for (const schema of schemas) {
    const dir = path.join(researchRoot, schema.directory);
    const files = collectRecordFiles(dir);
    const ids = new Set();
    const parsed = [];

    for (const file of files) {
      const rel = path.relative(researchRoot, file);
      const text = fs.readFileSync(file, "utf8");
      let record;
      try {
        record = parseYaml(text);
      } catch (e) {
        errors.push(`[${rel}] malformed YAML: ${e.message}`);
        continue;
      }

      const id = getPath(record, schema.idField);
      if (typeof id !== "string" || id.trim() === "") {
        errors.push(`[${rel}] missing required field: ${schema.idField}`);
      } else {
        if (!id.startsWith(schema.prefix)) {
          errors.push(
            `[${rel}] ID "${id}" does not start with expected prefix "${schema.prefix}"`
          );
        }
        const base = path.basename(file).replace(/\.ya?ml$/, "");
        if (base !== id) {
          errors.push(`[${rel}] filename "${base}" does not match record ID "${id}"`);
        }
        if (seenIds.has(id)) {
          errors.push(`[${rel}] duplicate ID "${id}" also used in ${seenIds.get(id)}`);
        } else {
          seenIds.set(id, rel);
        }
        ids.add(id);
      }

      for (const reqField of schema.requiredFields || []) {
        const val = getPath(record, reqField);
        if (val === undefined || val === null || val === "") {
          errors.push(`[${rel}] missing required field: ${reqField}`);
        }
      }

      for (const [field, allowed] of Object.entries(schema.enums || {})) {
        const val = getPath(record, field);
        if (val === undefined || val === null) continue;
        const values = Array.isArray(val) ? val : [val];
        for (const v of values) {
          if (!allowed.includes(v)) {
            errors.push(
              `[${rel}] field "${field}" has invalid value "${v}" (expected one of: ${allowed.join(", ")})`
            );
          }
        }
      }

      for (const field of schema.booleanFields || []) {
        const val = getPath(record, field);
        if (val === undefined || val === null) continue;
        if (typeof val !== "boolean") {
          errors.push(`[${rel}] field "${field}" must be a boolean (true|false), got "${val}"`);
        }
      }

      if (schema.prefix === "ASM-") {
        validateCriticalUnknowns(rel, record, errors);
      }

      parsed.push({ file: rel, record });
    }

    recordsByPrefix.set(schema.prefix, ids);
    parsedByDir.set(schema.prefix, { schema, parsed });
  }

  // Cross-reference validation (broken references).
  for (const { schema, parsed } of parsedByDir.values()) {
    for (const ref of schema.references || []) {
      const targetIds = recordsByPrefix.get(ref.targetPrefix) || new Set();
      for (const { file, record } of parsed) {
        const val = getPath(record, ref.field);
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
          if (!targetIds.has(t)) {
            errors.push(
              `[${file}] field "${ref.field}" references non-existent ${ref.targetPrefix}* record "${t}"`
            );
          }
        }
      }
    }
  }

  const totalRecords = [...parsedByDir.values()].reduce(
    (sum, v) => sum + v.parsed.length,
    0
  );

  return { errors, totalRecords, parsedByDir };
}

function main() {
  const args = process.argv.slice(2);
  const dirFlagIdx = args.indexOf("--dir");
  const researchRoot =
    dirFlagIdx !== -1 && args[dirFlagIdx + 1]
      ? path.resolve(args[dirFlagIdx + 1])
      : path.resolve(__dirname, "..", "research");

  const { errors, totalRecords } = validateResearchTree(researchRoot);

  if (errors.length > 0) {
    console.error(`Validated ${totalRecords} record(s): ${errors.length} problem(s) found.\n`);
    for (const e of errors) console.error(" - " + e);
    process.exitCode = 1;
  } else {
    console.log(`Validated ${totalRecords} record(s): OK.`);
    process.exitCode = 0;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseYaml,
  getPath,
  loadSchemas,
  collectRecordFiles,
  validateResearchTree,
};
