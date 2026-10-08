#!/usr/bin/env node
/**
 * Package-local generated-data precondition (D01-021).
 *
 * Package `npm run test` and `npm run typecheck` import files straight from
 * the gitignored `generated/` read model. This check runs first and fails
 * fast, with the recovery command, when that output is missing or no longer
 * what `build-data.js` would publish for the current checkout.
 *
 * Freshness is semantic, not operational: the expected read model is built
 * in memory from the current canonical research/ tree, schemas and
 * read-model.js — the same validateResearchTree() + buildReadModel() path
 * build-data.js uses — and compared byte-for-byte with every file on disk.
 * The manifest's own `generatedAt`/`sourceCommit` are reused for the
 * expected model, so neither a new timestamp nor an unrelated commit makes
 * otherwise-identical output stale. Nothing is written: not generated/, not
 * a temporary copy, not research/.
 *
 * Usage: node apps/research-explorer/scripts/check-generated-data.js
 */

const fs = require("fs");
const path = require("path");

const { validateResearchTree } = require("./validate-research-bridge.js");
const { buildReadModel } = require("./read-model.js");
const { canonicalYamlBytes } = require("./canonical-bytes.js");
const {
  jsonText,
  publishesCanonicalFile,
  CANONICAL_DIR,
  DEFAULT_REPO_ROOT,
  DEFAULT_RESEARCH_ROOT,
  DEFAULT_TARGET_DIR,
} = require("./build-data.js");

const REQUIRED_ENTRIES = ["manifest.json", "index.json", "edges.json", "record-detail"];
const RECOVERY_COMMAND = "npm run build-data";
const ROOT_RECOVERY_COMMAND = "npm run build-data --prefix apps/research-explorer";

/** Every file build-data.js would publish for `readModel`, as generated-relative POSIX path -> bytes. */
function expectedFiles(readModel, repoRoot) {
  const files = new Map([
    ["manifest.json", Buffer.from(jsonText(readModel.manifest))],
    ["index.json", Buffer.from(jsonText(readModel.index))],
    ["edges.json", Buffer.from(jsonText(readModel.edges))],
  ]);
  for (const detail of readModel.recordDetails) {
    files.set(`record-detail/${detail.id}.json`, Buffer.from(jsonText(detail)));
  }
  for (const detail of readModel.recordDetails.filter(publishesCanonicalFile)) {
    files.set(`${CANONICAL_DIR}/${detail.file}`, canonicalYamlBytes(fs.readFileSync(path.join(repoRoot, ...detail.file.split("/")))));
  }
  return files;
}

function listFiles(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

function firstManifestDifference(actualBytes, expected) {
  let actual;
  try {
    actual = JSON.parse(actualBytes.toString("utf8"));
  } catch {
    return "manifest.json is not valid JSON";
  }
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual ?? {})])];
  const key = keys.find((k) => JSON.stringify(actual?.[k]) !== JSON.stringify(expected[k]));
  return key ? `manifest.json ${key} does not match the current corpus/read model` : "manifest.json differs from the current read model";
}

/**
 * Checks `generatedDir` against the read model the current canonical tree
 * would produce. Pure apart from reads; never throws for an expected failure.
 *
 * Returns `{ ok: true, manifest }` or `{ ok: false, status, reason }`, where
 * `status` is "missing" (no usable generated output), "stale" (output exists
 * but differs from what build-data.js would now publish) or
 * "canonical-invalid" (the current canonical tree does not validate, so
 * build-data.js itself would refuse to publish). `reason` names a
 * generated-relative path, never an absolute one.
 */
function checkGeneratedData({
  researchRoot = DEFAULT_RESEARCH_ROOT,
  repoRoot = DEFAULT_REPO_ROOT,
  generatedDir = DEFAULT_TARGET_DIR,
  buildModel = buildReadModel,
} = {}) {
  if (!fs.existsSync(generatedDir)) {
    return { ok: false, status: "missing", reason: "generated/ does not exist" };
  }
  const absent = REQUIRED_ENTRIES.find((entry) => !fs.existsSync(path.join(generatedDir, entry)));
  if (absent) {
    return { ok: false, status: "missing", reason: `generated/${absent} does not exist` };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(generatedDir, "manifest.json"), "utf8"));
  } catch {
    return { ok: false, status: "stale", reason: "manifest.json is not valid JSON" };
  }

  const validation = validateResearchTree(researchRoot);
  if (validation.errors.length > 0) {
    return { ok: false, status: "canonical-invalid", reason: `${validation.errors.length} canonical validation error(s)` };
  }

  let expectedModel;
  try {
    expectedModel = buildModel({
      researchRoot,
      repoRoot,
      validation,
      generatedAt: manifest?.generatedAt,
      sourceCommit: manifest?.sourceCommit,
    });
  } catch (e) {
    return { ok: false, status: "canonical-invalid", reason: `read-model construction failed: ${e.message}` };
  }

  const expected = expectedFiles(expectedModel, repoRoot);
  const actual = new Set(listFiles(generatedDir));

  for (const [rel, bytes] of expected) {
    if (!actual.has(rel)) return { ok: false, status: "stale", reason: `${rel} is missing` };
    const onDisk = fs.readFileSync(path.join(generatedDir, ...rel.split("/")));
    if (!onDisk.equals(bytes)) {
      const reason = rel === "manifest.json" ? firstManifestDifference(onDisk, expectedModel.manifest) : `${rel} does not match the current corpus/read model`;
      return { ok: false, status: "stale", reason };
    }
  }
  const unexpected = [...actual].sort().find((rel) => !expected.has(rel));
  if (unexpected) {
    return { ok: false, status: "stale", reason: `${unexpected} is not part of the current read model` };
  }

  return { ok: true, manifest: expectedModel.manifest };
}

const HEADLINES = {
  missing: "Research Explorer generated data is missing.",
  stale: "Research Explorer generated data is stale.",
  "canonical-invalid": "Research Explorer generated data cannot be rebuilt: the canonical research corpus does not validate.",
};

/** The concise, stable developer-facing message for a failed check. */
function formatFailure(result) {
  return [
    HEADLINES[result.status],
    `  ${result.reason}.`,
    `Run: ${RECOVERY_COMMAND}`,
    `  (from the repository root: ${ROOT_RECOVERY_COMMAND})`,
  ].join("\n");
}

function main() {
  const result = checkGeneratedData();
  if (!result.ok) {
    console.error(formatFailure(result));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Research Explorer generated data is fresh: ${result.manifest.totalRecords} records, corpusFingerprint ${result.manifest.corpusFingerprint.slice(0, 12)}.`
  );
}

if (require.main === module) {
  main();
}

module.exports = { checkGeneratedData, formatFailure, RECOVERY_COMMAND };
