#!/usr/bin/env node
/**
 * Thin CommonJS bridge onto the public tools/research/ API.
 *
 * Research Explorer's build/spike/benchmark scripts are plain CommonJS and
 * historically depended on the legacy zero-dependency tools/validate-research.js
 * for both its `validateResearchTree()` corpus loader+validator and its
 * `getPath()` dotted-field helper (see read-model.js). That legacy module has
 * been retired in favor of the typed tools/research/ tooling (TC-01..TC-04);
 * this file is the smallest robust way to keep consuming it from CommonJS
 * without duplicating any validation or loading logic here.
 *
 * `require()` of an ESM/native-TypeScript module works synchronously on
 * Node 24 (synchronous ESM interop + unflagged .ts type-stripping), so this
 * stays a same-shape drop-in for every existing call site — no async
 * refactor of build-data.js/read-model.js/tests required.
 *
 * The only work this file does is *shape adaptation*: validateCorpusIndex()
 * returns { errors, totalRecords } over a CorpusIndex ({ byPrefix: Map<prefix,
 * { schema, records: {file, fields}[] }> }); the legacy shape callers here
 * still expect is { errors, totalRecords, parsedByDir: Map<prefix, { schema,
 * parsed: {file, record}[] }> }. Renaming byPrefix -> parsedByDir and
 * records/fields -> parsed/record is not a reimplementation of validation —
 * no rule, schema interpretation, or research semantics lives in this file.
 */
const path = require("path");

const RESEARCH_TOOLING_INDEX = path.join(__dirname, "..", "..", "..", "tools", "research", "index.ts");
const { loadCorpusIndexTolerant, validateCorpusIndex } = require(RESEARCH_TOOLING_INDEX);

/**
 * Same contract as the legacy tools/validate-research.js#validateResearchTree:
 * loads + validates researchRoot and returns { errors, totalRecords, parsedByDir }.
 */
function validateResearchTree(researchRoot) {
  const { index, issues } = loadCorpusIndexTolerant(researchRoot);
  const malformed = issues.map((issue) => `[${issue.file}] malformed YAML: ${issue.message}`);
  const { errors: validationErrors, totalRecords } = validateCorpusIndex(index);

  const parsedByDir = new Map();
  for (const [prefix, { schema, records }] of index.byPrefix.entries()) {
    parsedByDir.set(prefix, {
      schema,
      parsed: records.map(({ file, fields }) => ({ file, record: fields })),
    });
  }

  return { errors: [...malformed, ...validationErrors], totalRecords, parsedByDir };
}

/**
 * Same dotted-path getter as the legacy tools/validate-research.js#getPath.
 * Pure plumbing (no validation/research semantics) — tools/research/'s own
 * modules each keep an identical private copy of this helper rather than
 * sharing one (see core/corpus.ts, validation/validate.ts, analysis/analyze.ts);
 * this mirrors that existing convention instead of introducing a new shared
 * export.
 */
function getPath(record, dotted) {
  let cur = record;
  for (const part of dotted.split(".")) {
    if (cur === null || typeof cur !== "object" || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

module.exports = { validateResearchTree, getPath };
