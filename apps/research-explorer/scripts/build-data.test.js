#!/usr/bin/env node
/**
 * Focused tests for the RE-01 Research Explorer adapter
 * (read-model.js + atomic-write.js + build-data.js).
 *
 * Only Node's built-in assert/fs/os/path/crypto, plus the typed tools/research/
 * tooling via ./validate-research-bridge.js (see that file for why a thin
 * CommonJS bridge is used instead of a direct import). Fixtures are
 * generated into a fresh temp directory per test and discarded — nothing
 * here touches or contaminates the canonical research/ corpus.
 *
 * Usage: node apps/research-explorer/scripts/build-data.test.js
 * Exit code 0 = all tests passed, 1 = at least one failure.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { validateResearchTree } = require("./validate-research-bridge.js");
const { buildReadModel } = require("./read-model.js");
const { publishDirectoryAtomically } = require("./atomic-write.js");
const { run } = require("./build-data.js");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const REAL_SCHEMAS_DIR = path.join(REPO_ROOT, "research", "schemas");
const STANDARD_DIRS = ["sources", "evidence", "problems", "schemas"];

// ---- fixture helpers --------------------------------------------------------

function makeFixtureRoot(extraDirs = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evora-re01-"));
  for (const d of [...STANDARD_DIRS, ...extraDirs]) fs.mkdirSync(path.join(root, d), { recursive: true });
  for (const f of fs.readdirSync(REAL_SCHEMAS_DIR)) {
    fs.copyFileSync(path.join(REAL_SCHEMAS_DIR, f), path.join(root, "schemas", f));
  }
  return root;
}

function write(root, dir, filename, content) {
  fs.writeFileSync(path.join(root, dir, filename), content, "utf8");
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

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

function minimalEvd({ id = "EVD-900101", sourceIds = ["SRC-9001"] } = {}) {
  return `
evidence_id: ${id}
provenance:
  sources: [${sourceIds.join(", ")}]
  extracted_at: "2026-01-01"
observation:
  summary: "Fixture observation summary."
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

function minimalPrb({ id = "PRB-9001", evidence = [] } = {}) {
  return `
problem_id: ${id}
title: "Fixture problem"
domain: [example]
geography:
  level: city
affected_populations: [residents]
problem_statement: "Fixture statement for adapter testing."
evidence:${evidence.length ? `\n${evidence.map((evidenceId) => `  - evidence_id: ${evidenceId}\n    effects: [SUPPORTS]\n    research_roles: [LOCAL_OBSERVATION]`).join("\n")}` : " []"}
evidence_status: discovered
validation_status: unvalidated
digital_tractability: not_assessed
solution_landscape_status: not_assessed
status: OPEN
`;
}

const WIDGET_SCHEMA = {
  prefix: "WID-",
  directory: "widgets",
  idField: "widget_id",
  requiredFields: ["widget_id", "problem"],
  references: [{ field: "problem", isList: false, targetPrefix: "PRB-", targetDirectory: "problems", required: true }],
};

function minimalWidget({ id = "WID-0001", problem = "PRB-9001" } = {}) {
  return `
widget_id: ${id}
problem: ${problem}
`;
}

function buildFor(root) {
  const validation = validateResearchTree(root);
  assert.deepStrictEqual(validation.errors, [], `expected no validation errors, got:\n${validation.errors.join("\n")}`);
  return buildReadModel({
    researchRoot: root,
    repoRoot: REPO_ROOT,
    validation,
    generatedAt: "2026-01-01T00:00:00.000Z",
    sourceCommit: "deadbeef",
  });
}

// ---- test runner -------------------------------------------------------------

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ---- 1. valid corpus builds successfully -------------------------------------

test("valid minimal corpus builds a read model with matching counts", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "sources", "SRC-9001.yaml", minimalSrc());
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ evidence: ["EVD-900101"] }));
    const model = buildFor(root);
    assert.strictEqual(model.manifest.totalRecords, 3);
    assert.strictEqual(model.index.length, 3);
    assert.strictEqual(model.manifest.counts["SRC-"], 1);
    assert.strictEqual(model.manifest.counts["EVD-"], 1);
    assert.strictEqual(model.manifest.counts["PRB-"], 1);
  } finally {
    cleanup(root);
  }
});

// ---- 2. canonical validation failure causes build failure --------------------

test("canonical validation failure is surfaced, not swallowed", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", `problem_id: PRB-9001\ntitle: "Missing required fields"\n`);
    const validation = validateResearchTree(root);
    assert.ok(validation.errors.length > 0, "expected validation errors for an incomplete PRB record");
  } finally {
    cleanup(root);
  }
});

// ---- 3. missing referenced record fails closed --------------------------------

test("a reference to a non-existent record fails closed via validateResearchTree", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ evidence: ["EVD-999999"] }));
    const validation = validateResearchTree(root);
    assert.ok(
      validation.errors.some((e) => e.includes("EVD-999999")),
      `expected a dangling-reference error, got:\n${validation.errors.join("\n")}`
    );
  } finally {
    cleanup(root);
  }
});

// ---- 4. optional reference absent remains valid --------------------------------

test("an evidence provenance source produces the canonical source edge", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "sources", "SRC-9001.yaml", minimalSrc());
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ evidence: ["EVD-900101"] }));
    const model = buildFor(root);
    const sourceEdges = model.edges.filter((e) => e.field === "provenance.sources");
    assert.strictEqual(sourceEdges.length, 1);
    assert.strictEqual(sourceEdges[0].to, "SRC-9001");
  } finally {
    cleanup(root);
  }
});

// ---- 5. list reference produces the correct number of edges -------------------

test("a 3-item evidence list on a problem produces exactly 3 edges", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "sources", "SRC-9001.yaml", minimalSrc());
    write(root, "evidence", "EVD-900101.yaml", minimalEvd({ id: "EVD-900101" }));
    write(root, "evidence", "EVD-900102.yaml", minimalEvd({ id: "EVD-900102" }));
    write(root, "evidence", "EVD-900103.yaml", minimalEvd({ id: "EVD-900103" }));
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ evidence: ["EVD-900101", "EVD-900102", "EVD-900103"] }));
    const model = buildFor(root);
    const listEdges = model.edges.filter((e) => e.from === "PRB-9001" && e.field === "evidence");
    assert.strictEqual(listEdges.length, 3);
    assert.deepStrictEqual(
      listEdges.map((e) => e.ordinal).sort(),
      [0, 1, 2]
    );
  } finally {
    cleanup(root);
  }
});

// ---- 6. repeated provenance references retain their list position ---------

test("two provenance references to the same source are not deduplicated", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "sources", "SRC-9001.yaml", minimalSrc());
    write(
      root,
      "evidence",
      "EVD-900101.yaml",
      minimalEvd({ sourceIds: ["SRC-9001", "SRC-9001"] })
    );
    const model = buildFor(root);
    const toSameSource = model.edges.filter((e) => e.from === "EVD-900101" && e.to === "SRC-9001");
    assert.strictEqual(toSameSource.length, 2, "expected one edge per list position");
    const fields = toSameSource.map((e) => e.field).sort();
    assert.deepStrictEqual(fields, ["provenance.sources", "provenance.sources"]);
    const ids = new Set(toSameSource.map((e) => e.id));
    assert.strictEqual(ids.size, 2, "edge ids must be distinct");
  } finally {
    cleanup(root);
  }
});

// ---- 7. future schema-conforming record type gets generic representation ------

test("a future schema-conforming record type (WID-) is ingested generically, no adapter change", () => {
  const root = makeFixtureRoot(["widgets"]);
  try {
    fs.writeFileSync(path.join(root, "schemas", "widget.schema.json"), JSON.stringify(WIDGET_SCHEMA, null, 2));
    write(root, "problems", "PRB-9001.yaml", minimalPrb());
    write(root, "widgets", "WID-0001.yaml", minimalWidget());
    const model = buildFor(root);
    const widgetNode = model.index.find((n) => n.id === "WID-0001");
    assert.ok(widgetNode, "expected WID-0001 to appear as a node");
    assert.strictEqual(widgetNode.type, "WID-");
    // No title/name/etc. fallback field exists on the fixture widget record,
    // so the generic label fallback must degrade to the record's own ID.
    assert.strictEqual(widgetNode.label, "WID-0001");
    const widgetEdge = model.edges.find((e) => e.from === "WID-0001" && e.field === "problem");
    assert.ok(widgetEdge, "expected the widget's `problem` reference to become an edge");
    assert.strictEqual(widgetEdge.to, "PRB-9001");
  } finally {
    cleanup(root);
  }
});

// ---- 8. deterministic structural ordering --------------------------------------

test("structural output (index/edges order) is deterministic across repeated builds", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "sources", "SRC-9001.yaml", minimalSrc({ id: "SRC-9001" }));
    write(root, "evidence", "EVD-900103.yaml", minimalEvd({ id: "EVD-900103" }));
    write(root, "evidence", "EVD-900101.yaml", minimalEvd({ id: "EVD-900101" }));
    write(root, "evidence", "EVD-900102.yaml", minimalEvd({ id: "EVD-900102" }));
    write(
      root,
      "problems",
      "PRB-9001.yaml",
      minimalPrb({ evidence: ["EVD-900103", "EVD-900101", "EVD-900102"] })
    );

    const modelA = buildFor(root);
    const modelB = buildFor(root);

    assert.deepStrictEqual(modelA.index.map((n) => n.id), modelB.index.map((n) => n.id));
    assert.deepStrictEqual(modelA.edges, modelB.edges);
    // Written out of order on disk; ID-sorted regardless of file-write order.
    assert.deepStrictEqual(
      modelA.index.filter((n) => n.type === "EVD-").map((n) => n.id),
      ["EVD-900101", "EVD-900102", "EVD-900103"]
    );
  } finally {
    cleanup(root);
  }
});

// ---- 9. repository paths serialize with / and no absolute local paths ----------

test("record file paths are repo-relative, forward-slashed, and contain no drive letters", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "sources", "SRC-9001.yaml", minimalSrc());
    const model = buildFor(root);
    const node = model.index[0];
    assert.ok(!path.isAbsolute(node.file), `expected a relative path, got "${node.file}"`);
    assert.strictEqual(node.file.indexOf("\\"), -1, `expected no backslashes, got "${node.file}"`);
    assert.ok(!/^[A-Za-z]:/.test(node.file), `expected no Windows drive letter, got "${node.file}"`);
  } finally {
    cleanup(root);
  }
});

// ---- 10/11. atomic publish: failure preserves previous output, success replaces --

test("a failed publish preserves the previously published directory", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "evora-re01-atomic-"));
  const targetDir = path.join(parent, "generated");
  try {
    publishDirectoryAtomically(targetDir, (tmp) => {
      fs.writeFileSync(path.join(tmp, "manifest.json"), JSON.stringify({ ok: true }));
    });
    const before = fs.readFileSync(path.join(targetDir, "manifest.json"), "utf8");

    assert.throws(() => {
      publishDirectoryAtomically(targetDir, () => {
        throw new Error("simulated integrity failure");
      });
    }, /simulated integrity failure/);

    const after = fs.readFileSync(path.join(targetDir, "manifest.json"), "utf8");
    assert.strictEqual(after, before, "previous generated output must survive a failed build");

    const leftovers = fs.readdirSync(parent).filter((n) => n !== "generated");
    assert.deepStrictEqual(leftovers, [], `expected no leftover temp/backup directories, found: ${leftovers.join(", ")}`);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("a successful publish atomically replaces older generated output", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "evora-re01-atomic-"));
  const targetDir = path.join(parent, "generated");
  try {
    publishDirectoryAtomically(targetDir, (tmp) => {
      fs.writeFileSync(path.join(tmp, "manifest.json"), JSON.stringify({ version: 1 }));
    });
    publishDirectoryAtomically(targetDir, (tmp) => {
      fs.writeFileSync(path.join(tmp, "manifest.json"), JSON.stringify({ version: 2 }));
    });
    const content = JSON.parse(fs.readFileSync(path.join(targetDir, "manifest.json"), "utf8"));
    assert.strictEqual(content.version, 2);

    const leftovers = fs.readdirSync(parent).filter((n) => n !== "generated");
    assert.deepStrictEqual(leftovers, [], `expected no leftover temp/backup directories, found: ${leftovers.join(", ")}`);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ---- 12. zero dangling edges in published output --------------------------------

test("buildReadModel throws rather than publish a model with a dangling edge", () => {
  // validateResearchTree() already rejects broken references before the
  // adapter runs (test 3), so to exercise buildReadModel's own defense-in-depth
  // check directly, we hand it a validation object whose parsedByDir has been
  // tampered with after the fact to simulate a would-be dangling edge.
  const root = makeFixtureRoot();
  try {
    write(root, "sources", "SRC-9001.yaml", minimalSrc());
    write(root, "evidence", "EVD-900101.yaml", minimalEvd());
    const validation = validateResearchTree(root);
    assert.deepStrictEqual(validation.errors, []);

    // Tamper: point the evidence's provenance source at an ID that no longer exists
    // in parsedByDir, bypassing validateResearchTree's own check.
    const evdEntry = validation.parsedByDir.get("EVD-").parsed[0];
    evdEntry.record.provenance.sources[0] = "SRC-9999";

    assert.throws(
      () =>
        buildReadModel({
          researchRoot: root,
          repoRoot: REPO_ROOT,
          validation,
          generatedAt: "2026-01-01T00:00:00.000Z",
          sourceCommit: null,
        }),
      /dangling edge/i
    );
  } finally {
    cleanup(root);
  }
});

// ---- 13. readModelVersion is emitted correctly -----------------------------------

test("manifest carries the expected readModelVersion", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "sources", "SRC-9001.yaml", minimalSrc());
    const model = buildFor(root);
    assert.strictEqual(model.manifest.readModelVersion, "1.0.0");
  } finally {
    cleanup(root);
  }
});

// ---- 14. corpus fingerprint stability and change sensitivity ----------------------

test("corpusFingerprint is stable for identical input and changes when canonical input changes", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "sources", "SRC-9001.yaml", minimalSrc());
    const modelA = buildFor(root);
    const modelB = buildFor(root);
    assert.strictEqual(modelA.manifest.corpusFingerprint, modelB.manifest.corpusFingerprint);

    write(root, "sources", "SRC-9001.yaml", minimalSrc().replace("Fixture Source", "Changed Fixture Source"));
    const modelC = buildFor(root);
    assert.notStrictEqual(modelC.manifest.corpusFingerprint, modelA.manifest.corpusFingerprint);
  } finally {
    cleanup(root);
  }
});

test("corpusFingerprint does not depend on generatedAt or sourceCommit", () => {
  const root = makeFixtureRoot();
  try {
    write(root, "sources", "SRC-9001.yaml", minimalSrc());
    const validation = validateResearchTree(root);
    const modelA = buildReadModel({
      researchRoot: root,
      repoRoot: REPO_ROOT,
      validation,
      generatedAt: "2020-01-01T00:00:00.000Z",
      sourceCommit: "aaaa",
    });
    const modelB = buildReadModel({
      researchRoot: root,
      repoRoot: REPO_ROOT,
      validation,
      generatedAt: "2030-06-15T00:00:00.000Z",
      sourceCommit: "bbbb",
    });
    assert.strictEqual(modelA.manifest.corpusFingerprint, modelB.manifest.corpusFingerprint);
  } finally {
    cleanup(root);
  }
});

// ---- end-to-end: run() against fixture paths (no real repo paths touched) -------

test("run() end-to-end: valid corpus publishes and reports ok", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "evora-re01-e2e-"));
  const root = path.join(parent, "research");
  const targetDir = path.join(parent, "generated");
  try {
    for (const d of STANDARD_DIRS) fs.mkdirSync(path.join(root, d), { recursive: true });
    for (const f of fs.readdirSync(REAL_SCHEMAS_DIR)) {
      fs.copyFileSync(path.join(REAL_SCHEMAS_DIR, f), path.join(root, "schemas", f));
    }
    write(root, "sources", "SRC-9001.yaml", minimalSrc());

    const result = run({ researchRoot: root, repoRoot: parent, targetDir, now: () => "2026-01-01T00:00:00.000Z", sourceCommit: () => null });
    assert.strictEqual(result.ok, true);
    assert.ok(fs.existsSync(path.join(targetDir, "manifest.json")));
    assert.ok(fs.existsSync(path.join(targetDir, "index.json")));
    assert.ok(fs.existsSync(path.join(targetDir, "edges.json")));
    assert.ok(fs.existsSync(path.join(targetDir, "record-detail", "SRC-9001.json")));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("run() end-to-end: canonical validation failure aborts without publishing, previous output survives", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "evora-re01-e2e-"));
  const root = path.join(parent, "research");
  const targetDir = path.join(parent, "generated");
  try {
    for (const d of STANDARD_DIRS) fs.mkdirSync(path.join(root, d), { recursive: true });
    for (const f of fs.readdirSync(REAL_SCHEMAS_DIR)) {
      fs.copyFileSync(path.join(REAL_SCHEMAS_DIR, f), path.join(root, "schemas", f));
    }
    write(root, "sources", "SRC-9001.yaml", minimalSrc());

    const first = run({ researchRoot: root, repoRoot: parent, targetDir, now: () => "2026-01-01T00:00:00.000Z", sourceCommit: () => null });
    assert.strictEqual(first.ok, true);
    const before = fs.readFileSync(path.join(targetDir, "manifest.json"), "utf8");

    // Introduce a canonical validation failure (dangling reference).
    write(root, "problems", "PRB-9001.yaml", minimalPrb({ evidence: ["EVD-999999"] }));

    const second = run({ researchRoot: root, repoRoot: parent, targetDir, now: () => "2026-01-02T00:00:00.000Z", sourceCommit: () => null });
    assert.strictEqual(second.ok, false);
    assert.strictEqual(second.stage, "validate");
    assert.ok(second.errors.length > 0);

    const after = fs.readFileSync(path.join(targetDir, "manifest.json"), "utf8");
    assert.strictEqual(after, before, "previously published read model must survive a failed build");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

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
