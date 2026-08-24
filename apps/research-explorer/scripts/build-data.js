#!/usr/bin/env node
/**
 * RE-01 production adapter.
 *
 *   canonical research/ -> validateResearchTree() -> read-model.js -> generated/
 *
 * Fails closed at every stage:
 *   - canonical validation errors abort before any read-model construction;
 *   - a read-model integrity failure (e.g. a dangling edge) aborts before any
 *     file is written;
 *   - a post-write integrity check re-reads the freshly written temp
 *     directory and aborts (leaving the previous generated/ untouched) if
 *     anything looks wrong on disk, not just in memory.
 *
 * See docs/explorerarchitecture.md for the accepted design this implements.
 *
 * Usage: node apps/research-explorer/scripts/build-data.js
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { validateResearchTree } = require("./validate-research-bridge.js");
const { buildReadModel } = require("./read-model.js");
const { publishDirectoryAtomically } = require("./atomic-write.js");

const DEFAULT_REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEFAULT_RESEARCH_ROOT = path.join(DEFAULT_REPO_ROOT, "research");
const DEFAULT_TARGET_DIR = path.join(__dirname, "..", "generated");

function getSourceCommit(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // Git unavailable, or repoRoot is not a git checkout: operational
    // metadata only, must never fail an otherwise-valid build.
    return null;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Re-reads what was just written to `tmpDir` and re-checks the same
 * invariants the in-memory build already checked, against the actual bytes
 * on disk. Throws (aborting the publish, per atomic-write.js) on any
 * mismatch.
 */
function verifyGeneratedOutput(tmpDir, readModel) {
  const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, "manifest.json"), "utf8"));
  const index = JSON.parse(fs.readFileSync(path.join(tmpDir, "index.json"), "utf8"));
  const edges = JSON.parse(fs.readFileSync(path.join(tmpDir, "edges.json"), "utf8"));

  if (index.length !== manifest.totalRecords) {
    throw new Error(
      `Generated-data integrity check failed: index.json has ${index.length} entries but manifest.totalRecords is ${manifest.totalRecords}.`
    );
  }

  const ids = new Set(index.map((n) => n.id));
  if (ids.size !== index.length) {
    throw new Error("Generated-data integrity check failed: index.json contains duplicate record IDs.");
  }

  const dangling = edges.filter((e) => !ids.has(e.to));
  if (dangling.length > 0) {
    throw new Error(
      `Generated-data integrity check failed: ${dangling.length} dangling edge(s) found in edges.json on disk.`
    );
  }

  for (const node of index) {
    const detailPath = path.join(tmpDir, "record-detail", `${node.id}.json`);
    if (!fs.existsSync(detailPath)) {
      throw new Error(`Generated-data integrity check failed: missing record-detail file for "${node.id}".`);
    }
  }

  if (readModel.edges.length !== edges.length) {
    throw new Error(
      `Generated-data integrity check failed: in-memory edge count (${readModel.edges.length}) does not match written edges.json (${edges.length}).`
    );
  }
}

/**
 * Runs the full build pipeline against an explicit set of paths, with no
 * process-exit side effects — this is what both `main()` (real repo paths)
 * and the test suite (fixture paths) call.
 *
 * Returns `{ ok: true, readModel }` on success or `{ ok: false, stage, error }`
 * on any failure. Never throws for an expected failure mode (bad canonical
 * data, integrity check failure); does not swallow programmer errors it
 * doesn't recognize.
 */
function run({
  researchRoot = DEFAULT_RESEARCH_ROOT,
  repoRoot = DEFAULT_REPO_ROOT,
  targetDir = DEFAULT_TARGET_DIR,
  now = () => new Date().toISOString(),
  sourceCommit = () => getSourceCommit(repoRoot),
} = {}) {
  const validation = validateResearchTree(researchRoot);

  if (validation.errors.length > 0) {
    return { ok: false, stage: "validate", errors: validation.errors };
  }

  let readModel;
  try {
    readModel = buildReadModel({
      researchRoot,
      repoRoot,
      validation,
      generatedAt: now(),
      sourceCommit: sourceCommit(),
    });
  } catch (e) {
    return { ok: false, stage: "build", error: e };
  }

  try {
    publishDirectoryAtomically(targetDir, (tmpDir) => {
      writeJson(path.join(tmpDir, "manifest.json"), readModel.manifest);
      writeJson(path.join(tmpDir, "index.json"), readModel.index);
      writeJson(path.join(tmpDir, "edges.json"), readModel.edges);
      for (const detail of readModel.recordDetails) {
        writeJson(path.join(tmpDir, "record-detail", `${detail.id}.json`), detail);
      }
      verifyGeneratedOutput(tmpDir, readModel);
    });
  } catch (e) {
    return { ok: false, stage: "publish", error: e };
  }

  return { ok: true, readModel, targetDir };
}

function main() {
  const result = run();

  if (!result.ok) {
    if (result.stage === "validate") {
      console.error(
        `Research Explorer build aborted: ${result.errors.length} canonical validation error(s). ` +
          `No read model was published; any previously generated output is unchanged.\n`
      );
      for (const e of result.errors) console.error(" - " + e);
    } else {
      const label = result.stage === "build" ? "read-model construction" : "publishing the generated read model";
      console.error(
        `Research Explorer build aborted: ${label} failed. ` +
          "Any previously generated output is unchanged.\n"
      );
      console.error(" - " + result.error.message);
    }
    process.exitCode = 1;
    return;
  }

  const { readModel, targetDir } = result;
  console.log(
    `Research Explorer read model published: ${readModel.manifest.totalRecords} records, ${readModel.edges.length} edges, 0 dangling.`
  );
  console.log(`  readModelVersion: ${readModel.manifest.readModelVersion}`);
  console.log(`  corpusFingerprint: ${readModel.manifest.corpusFingerprint}`);
  console.log(`  sourceCommit: ${readModel.manifest.sourceCommit || "(unavailable)"}`);
  console.log(`  output: ${path.relative(DEFAULT_REPO_ROOT, targetDir).split(path.sep).join("/")}/`);
}

if (require.main === module) {
  main();
}

module.exports = { main, run, verifyGeneratedOutput };
