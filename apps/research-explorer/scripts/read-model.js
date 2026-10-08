#!/usr/bin/env node
/**
 * RE-01 core adapter logic: transforms an already-validated canonical
 * research tree (validateResearchTree()'s return value) into the Explorer
 * read model described in docs/explorerarchitecture.md.
 *
 * Pure/testable: performs no directory publishing itself (see atomic-write.js
 * for that) and only reads canonical file bytes (never writes/mutates them),
 * strictly to compute the corpus fingerprint.
 *
 * Schema-driven, no per-record-type branches: node discovery iterates every
 * schema prefix generically; edge discovery walks each schema's own
 * `references` array generically. A future schema-conforming record type
 * (any *.schema.json with prefix/directory/idField, optionally `references`
 * and `enums`) is represented correctly with no change to this file.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { getPath } = require("./validate-research-bridge.js");
const { canonicalYamlBytes } = require("./canonical-bytes.js");

const READ_MODEL_VERSION = "1.0.0";
const FINGERPRINT_SEPARATOR = "\0";

// Display convenience only (D2): tried in order per record, falls back to the
// record's own ID if none present. Not a schema requirement, so a future
// record type with none of these fields still renders (generically) as its ID.
// Shared with the browser-side full-text lookup (src/records/meaningField.ts)
// via ../shared/meaning-field-candidates.json, so the two never drift apart —
// this is the adapter's own truncated-`label` use of that same candidate list.
const LABEL_FALLBACKS = require("../shared/meaning-field-candidates.json");

// Bounded, schema-agnostic list of additional canonical/detail field paths
// (ODM-014) that are already legitimate for the public Explorer/detail
// projection but are not covered by LABEL_FALLBACKS (label is truncated to
// 80 chars) or buildSummaryFields() (enum-constrained fields only). Read by
// both this Node build script and the browser-side recordIndex.ts, so the
// two never drift apart.
const SEARCH_FIELD_CANDIDATES = require("../shared/search-field-candidates.json");

function toRepoRelativePosix(repoRoot, absPath) {
  return path.relative(repoRoot, absPath).split(path.sep).join("/");
}

function labelFor(record, id) {
  for (const field of LABEL_FALLBACKS) {
    const v = getPath(record, field);
    if (typeof v === "string" && v.trim() !== "") {
      return v.length > 80 ? v.slice(0, 77) + "..." : v;
    }
  }
  return id;
}

/**
 * Generic, schema-driven "useful for filtering" fields: every dotted path a
 * schema itself already declares as enum-constrained (research/schemas/*.schema.json
 * `enums`). This reuses metadata the schema already publishes rather than a
 * hardcoded per-record-type field list, so it generalizes to future schemas
 * automatically.
 */
function buildSummaryFields(schema, record) {
  const fields = {};
  for (const key of Object.keys(schema.enums || {})) {
    const v = getPath(record, key);
    if (v !== undefined && v !== null) fields[key] = v;
  }
  return fields;
}

/**
 * Additional untruncated canonical/detail text (ODM-014) for full-text
 * search only: every SEARCH_FIELD_CANDIDATES path present on this record,
 * string or string-list value, joined space-separated. Never includes
 * fields outside that bounded candidate list, so this stays a fixed
 * enrichment, not a general free-text index of the whole record.
 */
function buildSearchText(record) {
  const values = [];
  for (const field of SEARCH_FIELD_CANDIDATES) {
    const v = getPath(record, field);
    if (typeof v === "string" && v.trim() !== "") {
      values.push(v);
    } else if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && item.trim() !== "") values.push(item);
      }
    }
  }
  return values.join(" ");
}

function resolveReferenceTargets(record, ref) {
  const val = getPath(record, ref.field);
  if (val === undefined || val === null) return [];
  if (ref.isList) {
    if (!Array.isArray(val)) return [];
    return val
      .map((target, ordinal) => ({ ordinal, target: ref.itemField && target && typeof target === "object" && !Array.isArray(target) ? getPath(target, ref.itemField) : target }))
      .filter((x) => typeof x.target === "string" && x.target.trim() !== "");
  }
  return typeof val === "string" && val.trim() !== "" ? [{ ordinal: null, target: val }] : [];
}

/**
 * Edge identity accounts for source, target, the originating reference field,
 * and (for list references) the ordinal — so two distinct references between
 * the same pair of records (different field, or different list position)
 * never collapse into one edge.
 */
function edgeId(from, field, ordinal, to) {
  return `${from}::${field}::${ordinal === null ? "-" : ordinal}::${to}`;
}

function sortedPrefixes(parsedByDir) {
  return [...parsedByDir.keys()].sort();
}

function sortedParsedRecords(schema, parsed) {
  // Never rely on filesystem enumeration order: always re-sort by the
  // record's own ID, which collectRecordFiles()/fs.readdirSync() does not
  // guarantee.
  return [...parsed].sort((a, b) => {
    const idA = getPath(a.record, schema.idField);
    const idB = getPath(b.record, schema.idField);
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });
}

/**
 * Builds the full read model in memory. Throws on any integrity violation
 * (currently: dangling edges) rather than returning a partially-valid model —
 * callers must not publish a model this function threw while building.
 *
 * @param {object} opts
 * @param {string} opts.researchRoot - absolute path to research/
 * @param {string} opts.repoRoot - absolute path to the repository root
 * @param {{errors: string[], totalRecords: number, parsedByDir: Map}} opts.validation
 *   - the return value of validateResearchTree(researchRoot); caller must have
 *     already confirmed opts.validation.errors is empty.
 * @param {string} opts.generatedAt - ISO timestamp; operational metadata only,
 *   never contributes to corpusFingerprint or structural ordering.
 * @param {string|null} opts.sourceCommit - git revision, or null if unavailable;
 *   operational metadata only.
 */
function buildReadModel({ researchRoot, repoRoot, validation, generatedAt, sourceCommit }) {
  const { parsedByDir } = validation;
  const prefixes = sortedPrefixes(parsedByDir);

  const index = [];
  const detailById = new Map();
  const counts = {};
  const fingerprintHash = crypto.createHash("sha256");

  // Node discovery + fingerprint contribution: one pass, stable order
  // (prefix ascending, then id ascending) so structural output and the
  // fingerprint are both deterministic for identical canonical input.
  for (const prefix of prefixes) {
    const { schema, parsed } = parsedByDir.get(prefix);
    const ordered = sortedParsedRecords(schema, parsed);
    counts[prefix] = ordered.length;

    for (const { file, record } of ordered) {
      const id = getPath(record, schema.idField);
      const absFile = path.join(researchRoot, file);
      const relFile = toRepoRelativePosix(repoRoot, absFile);

      const canonicalBytes = canonicalYamlBytes(fs.readFileSync(absFile));
      fingerprintHash.update(prefix, "utf8");
      fingerprintHash.update(FINGERPRINT_SEPARATOR, "utf8");
      fingerprintHash.update(id, "utf8");
      fingerprintHash.update(FINGERPRINT_SEPARATOR, "utf8");
      fingerprintHash.update(canonicalBytes);
      fingerprintHash.update(FINGERPRINT_SEPARATOR, "utf8");

      index.push({
        id,
        type: prefix,
        label: labelFor(record, id),
        file: relFile,
        summaryFields: buildSummaryFields(schema, record),
        searchText: buildSearchText(record),
      });

      detailById.set(id, {
        id,
        type: prefix,
        file: relFile,
        record,
        outgoingEdges: [],
        incomingEdges: [],
      });
    }
  }

  const nodeIds = new Set(index.map((n) => n.id));

  // Edge discovery: walk each schema's own `references` array generically —
  // no SRC-/EVD-/PRB-/HYP- specific branches.
  const edges = [];
  for (const prefix of prefixes) {
    const { schema, parsed } = parsedByDir.get(prefix);
    const ordered = sortedParsedRecords(schema, parsed);
    for (const { record } of ordered) {
      const from = getPath(record, schema.idField);
      for (const ref of schema.references || []) {
        for (const { ordinal, target } of resolveReferenceTargets(record, ref)) {
          edges.push({
            id: edgeId(from, ref.field, ordinal, target),
            from,
            to: target,
            field: ref.field,
            ordinal,
            required: !!ref.required,
          });
        }
      }
    }
  }

  edges.sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.field !== b.field) return a.field < b.field ? -1 : 1;
    const oa = a.ordinal === null ? -1 : a.ordinal;
    const ob = b.ordinal === null ? -1 : b.ordinal;
    if (oa !== ob) return oa - ob;
    return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
  });

  const dangling = edges.filter((e) => !nodeIds.has(e.to));
  if (dangling.length > 0) {
    const err = new Error(
      `Refusing to build read model: ${dangling.length} dangling edge(s) found (e.g. "${dangling[0].from}" -[${dangling[0].field}]-> "${dangling[0].to}", target does not exist). ` +
        `This should be impossible after validateResearchTree() passes with no errors — treat as an adapter defect, not a data problem.`
    );
    err.danglingEdges = dangling;
    throw err;
  }

  for (const edge of edges) {
    const fromDetail = detailById.get(edge.from);
    if (fromDetail) fromDetail.outgoingEdges.push({ field: edge.field, ordinal: edge.ordinal, to: edge.to });
    const toDetail = detailById.get(edge.to);
    if (toDetail) toDetail.incomingEdges.push({ from: edge.from, field: edge.field, ordinal: edge.ordinal });
  }

  const recordDetails = [...detailById.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const corpusFingerprint = fingerprintHash.digest("hex");
  for (const detail of recordDetails) detail.corpusFingerprint = corpusFingerprint;

  const manifest = {
    readModelVersion: READ_MODEL_VERSION,
    generatedAt,
    generator: "apps/research-explorer/scripts/build-data.js",
    sourceCommit: sourceCommit || null,
    corpusFingerprint,
    totalRecords: validation.totalRecords,
    counts,
    schemaPrefixes: prefixes,
  };

  return { manifest, index, edges, recordDetails };
}

module.exports = { buildReadModel, READ_MODEL_VERSION, toRepoRelativePosix, labelFor, buildSummaryFields, buildSearchText };
