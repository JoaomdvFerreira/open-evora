#!/usr/bin/env node
/**
 * Focused tests for the package-local generated-data precondition
 * (check-generated-data.js).
 *
 * Every test builds its own canonical fixture tree and generated/ output with
 * the real build-data.js pipeline inside a fresh temp directory, then
 * discards it — nothing here reads, touches or depends on the repository's
 * own research/ corpus (beyond copying its schemas) or apps/research-explorer/generated/.
 *
 * Usage: node apps/research-explorer/scripts/check-generated-data.test.js
 * Exit code 0 = all tests passed, 1 = at least one failure.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { buildReadModel } = require("./read-model.js");
const { run } = require("./build-data.js");
const { checkGeneratedData, formatFailure, RECOVERY_COMMAND } = require("./check-generated-data.js");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const REAL_SCHEMAS_DIR = path.join(REPO_ROOT, "research", "schemas");
const STANDARD_DIRS = ["sources", "evidence", "problems", "schemas"];

// ---- fixture helpers --------------------------------------------------------

function minimalSrc({ id = "SRC-9001" } = {}) {
  return `
source_id: ${id}
publisher: "Fixture Publisher"
name: "Fixture Source"
resource_type: webpage
scope:
  geography:
    level: city
    area: "Fixture area"
  domains: [example]
access:
  level: public
  availability: available
  machine_readable: false
acquisition:
  method: public_web
licensing:
  status: unknown
  reuse: unknown
temporal:
  last_checked_at: "2026-01-01"
`;
}

function minimalEvd({ id = "EVD-900101", sourceIds = ["SRC-9001"], summary = "Fixture observation summary." } = {}) {
  return `
evidence_id: ${id}
provenance:
  sources: [${sourceIds.join(", ")}]
  extracted_at: "2026-01-01"
observation:
  summary: "${summary}"
scope:
  geography:
    level: city
    area: "Fixture area"
  temporal:
    status: unknown
domains: [example]
evidence_nature: fact
claim_authority: unknown
inference_limits:
  - "Synthetic fixture only; it is not research evidence."
`;
}

/** A temp repo root with research/ (SRC + EVD, real schemas) and a freshly built generated/. */
function makeFixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "evora-generated-check-"));
  const researchRoot = path.join(repoRoot, "research");
  const generatedDir = path.join(repoRoot, "generated");
  for (const d of STANDARD_DIRS) fs.mkdirSync(path.join(researchRoot, d), { recursive: true });
  for (const f of fs.readdirSync(REAL_SCHEMAS_DIR)) fs.copyFileSync(path.join(REAL_SCHEMAS_DIR, f), path.join(researchRoot, "schemas", f));
  writeRecord(researchRoot, "sources", "SRC-9001.yaml", minimalSrc());
  writeRecord(researchRoot, "evidence", "EVD-900101.yaml", minimalEvd());
  const fixture = { repoRoot, researchRoot, generatedDir };
  build(fixture);
  return fixture;
}

function writeRecord(researchRoot, dir, filename, content) {
  fs.writeFileSync(path.join(researchRoot, dir, filename), content, "utf8");
}

function build({ repoRoot, researchRoot, generatedDir }, { now = "2026-01-01T00:00:00.000Z", sourceCommit = "fixture-commit" } = {}) {
  const result = run({ researchRoot, repoRoot, targetDir: generatedDir, now: () => now, sourceCommit: () => sourceCommit });
  assert.strictEqual(result.ok, true, result.error?.message ?? (result.errors || []).join("\n"));
}

function check({ repoRoot, researchRoot, generatedDir }, options = {}) {
  return checkGeneratedData({ repoRoot, researchRoot, generatedDir, ...options });
}

function snapshot(dir) {
  const out = {};
  const walk = (d, prefix) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(d, entry.name), rel);
      else out[rel] = fs.readFileSync(path.join(d, entry.name)).toString("base64");
    }
  };
  walk(dir, "");
  return out;
}

function editJson(file, edit) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  edit(data);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function assertStale(result, reasonPattern) {
  assert.strictEqual(result.ok, false, "expected the check to fail");
  assert.strictEqual(result.status, "stale", `expected stale, got ${result.status}: ${result.reason}`);
  assert.match(result.reason, reasonPattern);
}

function cleanup({ repoRoot }) {
  fs.rmSync(repoRoot, { recursive: true, force: true });
}

// ---- test runner -------------------------------------------------------------

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function withFixture(fn) {
  return () => {
    const fixture = makeFixture();
    try {
      fn(fixture);
    } finally {
      cleanup(fixture);
    }
  };
}

// ---- missing -------------------------------------------------------------------

test("absent generated/ is reported as missing", withFixture((fixture) => {
  fs.rmSync(fixture.generatedDir, { recursive: true, force: true });
  const result = check(fixture);
  assert.deepStrictEqual(result, { ok: false, status: "missing", reason: "generated/ does not exist" });
}));

test("a generated/ without its top-level read-model files is reported as missing", withFixture((fixture) => {
  for (const entry of ["manifest.json", "index.json", "edges.json", "record-detail"]) {
    const target = path.join(fixture.generatedDir, entry);
    const moved = `${target}.moved`;
    fs.renameSync(target, moved);
    try {
      const result = check(fixture);
      assert.strictEqual(result.status, "missing", entry);
      assert.strictEqual(result.reason, `generated/${entry} does not exist`);
    } finally {
      fs.renameSync(moved, target);
    }
  }
}));

// ---- fresh ---------------------------------------------------------------------

test("freshly built output passes and the check writes nothing", withFixture((fixture) => {
  const generatedBefore = snapshot(fixture.generatedDir);
  const researchBefore = snapshot(fixture.researchRoot);
  const result = check(fixture);
  assert.strictEqual(result.ok, true, result.reason);
  assert.strictEqual(result.manifest.totalRecords, 2);
  assert.deepStrictEqual(snapshot(fixture.generatedDir), generatedBefore);
  assert.deepStrictEqual(snapshot(fixture.researchRoot), researchBefore);
  assert.deepStrictEqual(fs.readdirSync(fixture.repoRoot).sort(), ["generated", "research"], "no temporary output is published");
}));

test("operational metadata alone (generatedAt, sourceCommit) never makes output stale", withFixture((fixture) => {
  build(fixture, { now: "2030-12-31T23:59:59.000Z", sourceCommit: null });
  assert.strictEqual(check(fixture).ok, true);
  editJson(path.join(fixture.generatedDir, "manifest.json"), (m) => {
    m.generatedAt = "1999-01-01T00:00:00.000Z";
    m.sourceCommit = "an-older-unrelated-commit";
  });
  const result = check(fixture);
  assert.strictEqual(result.ok, true, result.reason);
}));

// ---- stale canonical input -------------------------------------------------------

test("output built from corpus A is stale once canonical YAML becomes corpus B", withFixture((fixture) => {
  writeRecord(fixture.researchRoot, "evidence", "EVD-900101.yaml", minimalEvd({ summary: "Changed canonical observation." }));
  assertStale(check(fixture), /^manifest\.json corpusFingerprint /);
}));

test("a canonical record added after the build makes output stale", withFixture((fixture) => {
  writeRecord(fixture.researchRoot, "sources", "SRC-9002.yaml", minimalSrc({ id: "SRC-9002" }));
  assertStale(check(fixture), /^manifest\.json /);
}));

test("a canonical tree that no longer validates is reported distinctly", withFixture((fixture) => {
  writeRecord(fixture.researchRoot, "evidence", "EVD-900101.yaml", minimalEvd({ sourceIds: ["SRC-9999"] }));
  const result = check(fixture);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, "canonical-invalid");
  assert.match(result.reason, /canonical validation error/);
}));

// ---- stale projection / read-model adapter output ---------------------------------

test("tampered index, edges or record detail is stale even with an unchanged fingerprint", withFixture((fixture) => {
  const cases = [
    ["index.json", (index) => { index[0].label = "Tampered label"; }],
    ["edges.json", (edges) => { edges[0].required = !edges[0].required; }],
    ["record-detail/EVD-900101.json", (detail) => { detail.record.observation.summary = "Tampered"; }],
  ];
  for (const [rel, edit] of cases) {
    build(fixture);
    editJson(path.join(fixture.generatedDir, ...rel.split("/")), edit);
    assertStale(check(fixture), new RegExp(`^${rel.replace(/[.]/g, "\\.")} does not match`));
  }
}));

test("a read-model adapter change is detected without any canonical or on-disk change", withFixture((fixture) => {
  const changedAdapter = (opts) => {
    const model = buildReadModel(opts);
    model.index = model.index.map((node) => ({ ...node, label: `${node.label} (new projection)` }));
    return model;
  };
  assert.strictEqual(check(fixture).ok, true);
  assertStale(check(fixture, { buildModel: changedAdapter }), /^index\.json does not match/);
}));

test("a schema-driven projection change is detected", withFixture((fixture) => {
  // A newly enum-constrained field becomes an index summaryField; canonical YAML (and so the fingerprint) is unchanged.
  editJson(path.join(fixture.researchRoot, "schemas", "evidence.schema.json"), (schema) => {
    schema.enums = { ...schema.enums, "observation.summary": ["Fixture observation summary."] };
  });
  assertStale(check(fixture), /^index\.json does not match/);
}));

// ---- incomplete / corrupt output -------------------------------------------------

test("incomplete or corrupt generated output is stale", withFixture((fixture) => {
  const cases = [
    ["missing record detail", () => fs.rmSync(path.join(fixture.generatedDir, "record-detail", "SRC-9001.json")), /^record-detail\/SRC-9001\.json is missing$/],
    ["missing canonical copy", () => fs.rmSync(path.join(fixture.generatedDir, "canonical", "research", "evidence", "EVD-900101.yaml")), /^canonical\/research\/evidence\/EVD-900101\.yaml is missing$/],
    ["altered canonical copy", () => fs.appendFileSync(path.join(fixture.generatedDir, "canonical", "research", "sources", "SRC-9001.yaml"), "# drift\n"), /^canonical\/research\/sources\/SRC-9001\.yaml does not match/],
    ["unexpected leftover record", () => fs.writeFileSync(path.join(fixture.generatedDir, "record-detail", "EVD-000000.json"), "{}\n"), /^record-detail\/EVD-000000\.json is not part of the current read model$/],
    ["corrupt manifest", () => fs.writeFileSync(path.join(fixture.generatedDir, "manifest.json"), "{ not json"), /^manifest\.json is not valid JSON$/],
    ["truncated detail", () => fs.writeFileSync(path.join(fixture.generatedDir, "record-detail", "EVD-900101.json"), "{"), /^record-detail\/EVD-900101\.json does not match/],
  ];
  for (const [name, damage, reason] of cases) {
    build(fixture);
    damage();
    const result = check(fixture);
    assert.strictEqual(result.status, "stale", `${name}: expected stale, got ${result.status}`);
    assert.match(result.reason, reason, name);
  }
}));

// ---- error contract ---------------------------------------------------------------

test("failure messages name the condition and the recovery command without local paths", withFixture((fixture) => {
  writeRecord(fixture.researchRoot, "evidence", "EVD-900101.yaml", minimalEvd({ summary: "Changed." }));
  const stale = formatFailure(check(fixture));
  fs.rmSync(fixture.generatedDir, { recursive: true, force: true });
  const missing = formatFailure(check(fixture));

  assert.strictEqual(RECOVERY_COMMAND, "npm run build-data");
  assert.match(missing, /^Research Explorer generated data is missing\.$/m);
  assert.match(stale, /^Research Explorer generated data is stale\.$/m);
  for (const message of [missing, stale]) {
    assert.match(message, /^Run: npm run build-data$/m);
    assert.match(message, /npm run build-data --prefix apps\/research-explorer/);
    assert.ok(!message.includes(fixture.repoRoot), "message must not expose local absolute paths");
    assert.ok(message.split("\n").length <= 4, "message stays concise");
  }
}));

// ---- run -----------------------------------------------------------------------

function main() {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      fn();
      passed++;
      console.log(`  ok - ${name}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL - ${name}`);
      console.log(`    ${e.stack || e.message}`);
    }
  }
  console.log("");
  console.log(`${passed}/${tests.length} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
