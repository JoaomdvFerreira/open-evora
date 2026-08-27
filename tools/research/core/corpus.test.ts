/**
 * Focused tests for the TC-01 research tooling core foundation: the
 * shared corpus/schema loading and indexing layer under tools/research/.
 * Run with Node's built-in test runner: node --test tools/research/core/corpus.test.ts
 *
 * Fixtures are generated into a temporary directory per test and discarded
 * — nothing here touches or reads the canonical research/ corpus, except
 * the dedicated real-corpus test at the bottom, which only asserts
 * structural/deterministic loader properties (never record semantics).
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { loadCorpusIndex } from "./corpus.ts";
import { loadSchemas } from "./schemas.ts";
import { parseRecordYaml } from "./yaml.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REAL_RESEARCH_ROOT = join(__dirname, "..", "..", "..", "research");
const REAL_SCHEMAS_DIR = join(REAL_RESEARCH_ROOT, "schemas");
const DIRS = ["sources", "evidence", "problems", "schemas"];

function makeFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "evora-tc01-"));
  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  for (const f of readdirSync(REAL_SCHEMAS_DIR)) {
    writeFileSync(join(root, "schemas", f), readFileSync(join(REAL_SCHEMAS_DIR, f), "utf8"));
  }
  return root;
}

function write(root: string, dir: string, filename: string, content: string): void {
  writeFileSync(join(root, dir, filename), content, "utf8");
}

const MINIMAL_SRC = `
source_id: SRC-9001
publisher: "Fixture Publisher"
name: "Fixture Source"
resource_type: webpage
scope:
  geography:
    level: municipality
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
  last_checked_at: "2026-08-11"
`;

const MINIMAL_EVD = `
evidence_id: EVD-900101
provenance:
  sources: [SRC-9001]
  extracted_at: "2026-08-11"
observation:
  summary: "Fixture observation."
scope:
  geography:
    level: municipality
    area: "Fixture area"
  temporal:
    status: unknown
domains: [example]
evidence_nature: claim
claim_authority: unknown
inference_limits:
  - "Synthetic fixture only; it is not research evidence."
`;

const MINIMAL_PRB = `
problem_id: PRB-9001
title: "Fixture problem"
domain: [example]
geography:
  level: municipality
affected_populations: [residents]
problem_statement: "Fixture statement for loader/indexer testing."
evidence:
  - evidence_id: EVD-900101
    effects: [SUPPORTS]
    research_roles: [LOCAL_OBSERVATION]
evidence_status: discovered
validation_status: unvalidated
digital_tractability: not_assessed
solution_landscape_status: not_assessed
status: OPEN
`;

describe("parseRecordYaml", () => {
  test("parses nested maps, lists, scalars, and booleans", () => {
    const fields = parseRecordYaml(MINIMAL_PRB);
    assert.equal(fields.problem_id, "PRB-9001");
    assert.deepEqual(fields.domain, ["example"]);
    assert.equal((fields.geography as Record<string, unknown>).level, "municipality");
    assert.equal(fields.status, "OPEN");
  });

  test("empty document parses to an empty object", () => {
    assert.deepEqual(parseRecordYaml(""), {});
  });

  test("non-mapping root document throws", () => {
    assert.throws(() => parseRecordYaml("- one\n- two\n"));
  });
});

describe("loadSchemas", () => {
  test("loads the three canonical schema files, with expected prefixes", () => {
    const schemas = loadSchemas(REAL_RESEARCH_ROOT);
    const prefixes = schemas.map((s) => s.prefix).sort();
    assert.deepEqual(prefixes, ["EVD-", "PRB-", "SRC-"]);
  });
});

describe("loadCorpusIndex (fixture corpus)", () => {
  let root: string;

  before(() => {
    root = makeFixtureRoot();
    write(root, "sources", "SRC-9001.yaml", MINIMAL_SRC);
    write(root, "evidence", "EVD-900101.yaml", MINIMAL_EVD);
    write(root, "problems", "PRB-9001.yaml", MINIMAL_PRB);
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test("indexes exactly one record per canonical type", () => {
    const index = loadCorpusIndex(root);
    assert.equal(index.totalRecords, 3);
    assert.equal(index.byPrefix.get("SRC-")?.records.length, 1);
    assert.equal(index.byPrefix.get("EVD-")?.records.length, 1);
    assert.equal(index.byPrefix.get("PRB-")?.records.length, 1);
  });

  test("byId resolves each record by its schema-declared idField", () => {
    const index = loadCorpusIndex(root);
    const prb = index.byPrefix.get("PRB-")?.byId.get("PRB-9001");
    assert.ok(prb);
    assert.equal(prb?.fields.title, "Fixture problem");

    const evd = index.byPrefix.get("EVD-")?.byId.get("EVD-900101");
    assert.ok(evd);

    const src = index.byPrefix.get("SRC-")?.byId.get("SRC-9001");
    assert.ok(src);
  });

  test("record file paths are relative and forward-slashed", () => {
    const index = loadCorpusIndex(root);
    const prb = index.byPrefix.get("PRB-")?.records[0];
    assert.equal(prb?.file, "problems/PRB-9001.yaml");
  });

  test("an empty sources directory yields zero SRC records without error", () => {
    const emptyRoot = makeFixtureRoot();
    try {
      write(emptyRoot, "problems", "PRB-9001.yaml", MINIMAL_PRB);
      write(emptyRoot, "evidence", "EVD-900101.yaml", MINIMAL_EVD);
      const index = loadCorpusIndex(emptyRoot);
      assert.equal(index.byPrefix.get("SRC-")?.records.length, 0);
      assert.equal(index.byPrefix.get("SRC-")?.byId.size, 0);
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  test("loading is deterministic across repeated calls (stable order and content)", () => {
    const first = loadCorpusIndex(root);
    const second = loadCorpusIndex(root);
    const firstIds = first.byPrefix.get("PRB-")?.records.map((r) => r.fields.problem_id);
    const secondIds = second.byPrefix.get("PRB-")?.records.map((r) => r.fields.problem_id);
    assert.deepEqual(firstIds, secondIds);
  });

  test("multiple records of one type are read in sorted filename order", () => {
    const multiRoot = makeFixtureRoot();
    try {
      write(multiRoot, "problems", "PRB-9002.yaml", MINIMAL_PRB.replace("PRB-9001", "PRB-9002"));
      write(multiRoot, "problems", "PRB-9001.yaml", MINIMAL_PRB);
      const index = loadCorpusIndex(multiRoot);
      const ids = index.byPrefix.get("PRB-")?.records.map((r) => r.fields.problem_id);
      assert.deepEqual(ids, ["PRB-9001", "PRB-9002"]);
    } finally {
      rmSync(multiRoot, { recursive: true, force: true });
    }
  });
});

describe("loadCorpusIndex (real canonical corpus)", () => {
  test("reads the current research/ corpus and constructs all three indexes without throwing", () => {
    const index = loadCorpusIndex(REAL_RESEARCH_ROOT);
    assert.ok(index.totalRecords > 0);
    for (const prefix of ["SRC-", "EVD-", "PRB-"]) {
      assert.ok(index.byPrefix.has(prefix), `expected an index for prefix ${prefix}`);
    }
  });

  test("every PRB record in the real corpus resolves via byId using problem_id", () => {
    const index = loadCorpusIndex(REAL_RESEARCH_ROOT);
    const prbIndex = index.byPrefix.get("PRB-");
    assert.ok(prbIndex);
    for (const record of prbIndex!.records) {
      const id = record.fields.problem_id;
      if (typeof id === "string" && id.trim() !== "") {
        assert.equal(prbIndex!.byId.get(id), record);
      }
    }
  });
});
