/**
 * Contract regressions for repository-owned synthetic research fixtures.
 *
 * They deliberately run the public tools/research API against disposable
 * corpus roots: examples live outside research/{sources,evidence,problems},
 * and the benchmark generator must never write to the canonical corpus merely
 * to prove compatibility.
 */
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const RESEARCH_ROOT = path.join(REPO_ROOT, "research");
const GENERATOR = path.join(__dirname, "generate-corpus.js");

function validateCorpus(root) {
  return require(path.join(REPO_ROOT, "tools", "research", "index.ts")).validateResearchRoot(root);
}

function fixtureRoot(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function copyExampleCorpus(root) {
  for (const [from, to] of [
    [path.join(RESEARCH_ROOT, "schemas"), path.join(root, "schemas")],
    ...["sources", "evidence", "problems"].map((directory) => [
      path.join(RESEARCH_ROOT, "examples", directory),
      path.join(root, directory),
    ]),
  ]) {
    mkdirSync(to, { recursive: true });
    for (const filename of readdirSync(from)) {
      writeFileSync(path.join(to, filename), readFileSync(path.join(from, filename)));
    }
  }
}

function corpusBytes(root) {
  const files = {};
  for (const directory of ["sources", "evidence", "problems"]) {
    for (const filename of readdirSync(path.join(root, directory)).sort()) {
      files[`${directory}/${filename}`] = readFileSync(path.join(root, directory, filename), "utf8");
    }
  }
  return files;
}

function generateCorpus(scale, root) {
  execFileSync(process.execPath, [GENERATOR, String(scale), root], { encoding: "utf8" });
}

function run(name, fn) {
  try {
    fn();
    console.log(`  ok - ${name}`);
  } catch (error) {
    console.error(`  FAIL - ${name}`);
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

run("RE-05 generator emits a deterministic small corpus accepted by the canonical validator", () => {
  const parent = fixtureRoot("evora-generator-contract-");
  const first = path.join(parent, "first");
  const second = path.join(parent, "second");
  const scale = 25;
  try {
    const expected = { src: 10, evd: 10, prb: 5 };
    generateCorpus(scale, first);
    const validation = validateCorpus(first);

    assert.equal(validation.totalRecords, scale);
    assert.deepEqual(validation.errors, []);
    assert.equal(readdirSync(path.join(first, "sources")).length, expected.src);
    assert.equal(readdirSync(path.join(first, "evidence")).length, expected.evd);
    assert.equal(readdirSync(path.join(first, "problems")).length, expected.prb);

    generateCorpus(scale, second);
    assert.deepEqual(corpusBytes(second), corpusBytes(first));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

run("synthetic SRC/EVD/PRB examples validate together against the current schemas", () => {
  const root = fixtureRoot("evora-example-contract-");
  try {
    copyExampleCorpus(root);
    const validation = validateCorpus(root);
    assert.equal(validation.totalRecords, 3);
    assert.deepEqual(validation.errors, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
