#!/usr/bin/env node
/**
 * RE-05 adapter-stage benchmark: generates a synthetic corpus at a given
 * scale, runs the real RE-01 adapter transform (validateResearchTree() +
 * buildReadModel(), the exact functions build-data.js calls) against it, and
 * measures transform time + generated-output size. Writes:
 *   - benchmark/output/<scale>/generated/   (plain, non-atomic write of the
 *     real adapter's in-memory output — read by uiScale.bench.test.ts for the
 *     in-app-code-path measurements. Skips build-data.js's atomic
 *     rename-publish dance deliberately: that dance exists for safe
 *     concurrent production publishes, not for a disposable benchmark
 *     directory recreated on every run, and this machine's antivirus/indexer
 *     transiently EPERMs same-second directory renames in a way that would
 *     otherwise pollute the timing with unrelated filesystem-lock jitter.)
 *   - benchmark/output/<scale>/adapter-results.json
 *
 * Fully disposable: never touches research/** or apps/research-explorer/generated/.
 *
 * Usage: node run-adapter-benchmark.js <scale>
 */

const fs = require("fs");
const path = require("path");

const { generate } = require("./generate-corpus.js");
const { validateResearchTree } = require("../scripts/validate-research-bridge.js");
const { buildReadModel } = require("../scripts/read-model.js");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const BENCH_ROOT = __dirname;

function dirSizeBytes(dir) {
  let total = 0;
  let files = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = dirSizeBytes(p);
      total += sub.bytes;
      files += sub.files;
    } else {
      total += fs.statSync(p).size;
      files += 1;
    }
  }
  return { bytes: total, files };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function writeGeneratedOutput(targetDir, readModel) {
  fs.mkdirSync(targetDir, { recursive: true, maxRetries: 10, retryDelay: 300 });
  writeJson(path.join(targetDir, "manifest.json"), readModel.manifest);
  writeJson(path.join(targetDir, "index.json"), readModel.index);
  writeJson(path.join(targetDir, "edges.json"), readModel.edges);
  for (const detail of readModel.recordDetails) {
    writeJson(path.join(targetDir, "record-detail", `${detail.id}.json`), detail);
  }
}

function benchmarkScale(scale) {
  const fixtureDir = path.join(BENCH_ROOT, "fixtures", String(scale));
  const outputDir = path.join(BENCH_ROOT, "output", String(scale));
  const generatedDir = path.join(outputDir, "generated");

  console.log(`\n=== scale ${scale} ===`);

  console.log("generating synthetic corpus...");
  const counts = generate(scale, fixtureDir);
  console.log("  ", JSON.stringify(counts));

  fs.rmSync(outputDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  fs.mkdirSync(outputDir, { recursive: true });

  // validate+build reruns are cheap-ish at 250/2500 but potentially costly at
  // 10000; run 3x at the two smaller scales for a median, once at 10000 (the
  // wall-time itself is the risk-review's named concern, not a jitter study).
  const runs = scale >= 10000 ? 1 : 3;
  const validateTimes = [];
  const buildTimes = [];
  const writeTimes = [];
  let lastReadModel = null;
  let lastValidation = null;

  for (let i = 0; i < runs; i++) {
    const t0 = process.hrtime.bigint();
    const validation = validateResearchTree(fixtureDir);
    const t1 = process.hrtime.bigint();
    if (validation.errors.length > 0) {
      console.error("VALIDATION FAILED:", validation.errors.slice(0, 10));
      process.exitCode = 1;
      return null;
    }
    const readModel = buildReadModel({
      researchRoot: fixtureDir,
      repoRoot: REPO_ROOT,
      validation,
      generatedAt: new Date().toISOString(),
      sourceCommit: null,
    });
    const t2 = process.hrtime.bigint();

    validateTimes.push(Number(t1 - t0) / 1e6);
    buildTimes.push(Number(t2 - t1) / 1e6);
    lastReadModel = readModel;
    lastValidation = validation;

    if (i === runs - 1) {
      const memBefore = process.memoryUsage().heapUsed;
      const w0 = process.hrtime.bigint();
      fs.rmSync(generatedDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
      writeGeneratedOutput(generatedDir, readModel);
      const w1 = process.hrtime.bigint();
      writeTimes.push(Number(w1 - w0) / 1e6);
      global.__writeHeapDeltaMB = (process.memoryUsage().heapUsed - memBefore) / (1024 * 1024);
    }
  }

  const { bytes: totalBytes, files: totalFiles } = dirSizeBytes(generatedDir);
  const indexBytes = fs.statSync(path.join(generatedDir, "index.json")).size;
  const edgesBytes = fs.statSync(path.join(generatedDir, "edges.json")).size;
  const manifestBytes = fs.statSync(path.join(generatedDir, "manifest.json")).size;

  const results = {
    scale,
    recordCounts: counts,
    totalRecords: lastValidation.totalRecords,
    totalEdges: lastReadModel.edges.length,
    validateMs: { runs: validateTimes, medianMs: median(validateTimes) },
    buildReadModelMs: { runs: buildTimes, medianMs: median(buildTimes) },
    validateAndBuildMedianMs: median(validateTimes) + median(buildTimes),
    writeToDiskMs: writeTimes[0],
    writeHeapDeltaMB: global.__writeHeapDeltaMB,
    generatedOutput: {
      totalBytes,
      totalFiles,
      indexJsonBytes: indexBytes,
      edgesJsonBytes: edgesBytes,
      manifestJsonBytes: manifestBytes,
      recordDetailBytes: totalBytes - indexBytes - edgesBytes - manifestBytes,
    },
  };

  fs.writeFileSync(path.join(outputDir, "adapter-results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(`  validate+buildReadModel median: ${results.validateAndBuildMedianMs.toFixed(1)}ms (n=${runs}); write-to-disk: ${results.writeToDiskMs.toFixed(1)}ms`);
  console.log(`  generated output: ${(totalBytes / 1024).toFixed(0)} KB total, index.json ${(indexBytes / 1024).toFixed(0)} KB, edges.json ${(edgesBytes / 1024).toFixed(0)} KB`);
  return results;
}

function main() {
  const scales = process.argv.slice(2).map(Number);
  const targets = scales.length > 0 ? scales : [250, 2500, 10000];
  for (const scale of targets) benchmarkScale(scale);
}

if (require.main === module) main();

module.exports = { benchmarkScale, dirSizeBytes, median };
