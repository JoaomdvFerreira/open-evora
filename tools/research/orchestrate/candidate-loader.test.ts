import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { CorpusIndex, RecordSchema } from "../core/types.ts";
import { loadCandidates } from "./candidate-loader.ts";

const SOURCE_SCHEMA: RecordSchema = { prefix: "SRC-", directory: "sources", idField: "source_id" };

function emptyIndex(): CorpusIndex {
  return {
    researchRoot: "/synthetic",
    byPrefix: new Map([["SRC-", { schema: SOURCE_SCHEMA, records: [], byId: new Map() }]]),
    totalRecords: 0,
  };
}

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-candidate-loader-test-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("loads a well-formed candidate and infers its record family from the schema idField", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, "SRC-NEW.yaml"), "source_id: SRC-NEW\nname: Synthetic source\n", "utf8");
    const { candidates, failures } = loadCandidates(emptyIndex(), dir, ["SRC-NEW.yaml"]);
    assert.deepEqual(failures, []);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].recordFamily, "SRC-");
    assert.equal(candidates[0].fields.source_id, "SRC-NEW");
  });
});

test("a missing candidate file is reported as a failure, not thrown", () => {
  withTempDir((dir) => {
    const { candidates, failures } = loadCandidates(emptyIndex(), dir, ["MISSING.yaml"]);
    assert.deepEqual(candidates, []);
    assert.equal(failures.length, 1);
    assert.match(failures[0].message, /could not read candidate file/);
  });
});

test("malformed YAML is reported as a failure, not thrown", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, "BROKEN.yaml"), "source_id: [unterminated\n", "utf8");
    const { failures } = loadCandidates(emptyIndex(), dir, ["BROKEN.yaml"]);
    assert.equal(failures.length, 1);
    assert.match(failures[0].message, /could not parse candidate YAML/);
  });
});

test("a candidate with no ID matching any known record family is reported as a failure", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, "UNKNOWN.yaml"), "source_id: UNRECOGNIZED-0001\n", "utf8");
    const { failures } = loadCandidates(emptyIndex(), dir, ["UNKNOWN.yaml"]);
    assert.equal(failures.length, 1);
    assert.match(failures[0].message, /does not resolve to a known canonical record family/);
  });
});

test("multiple candidate files are all loaded in the order given", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, "SRC-A.yaml"), "source_id: SRC-A\n", "utf8");
    writeFileSync(join(dir, "SRC-B.yaml"), "source_id: SRC-B\n", "utf8");
    const { candidates, failures } = loadCandidates(emptyIndex(), dir, ["SRC-A.yaml", "SRC-B.yaml"]);
    assert.deepEqual(failures, []);
    assert.deepEqual(candidates.map((c) => c.fields.source_id), ["SRC-A", "SRC-B"]);
  });
});

// A manifest's candidateFiles entry is untrusted AI-authored input; a
// traversal/absolute entry must fail closed as a load failure, never
// actually read the target.
test("a ../escape entry never reads a file outside candidatesDir", () => {
  withTempDir((outerDir) => {
    const dir = join(outerDir, "candidates");
    mkdirSync(dir, { recursive: true });
    const secretPath = join(outerDir, "secret-outside.yaml");
    writeFileSync(secretPath, "source_id: SRC-LEAKED\nname: should never load\n", "utf8");
    const { candidates, failures } = loadCandidates(emptyIndex(), dir, ["../secret-outside.yaml"]);
    assert.deepEqual(candidates, []);
    assert.equal(failures.length, 1);
    assert.match(failures[0].message, /refusing to read candidate file/);
  });
});

test("a deep multi-level traversal entry fails closed without reading anything", () => {
  withTempDir((dir) => {
    const traversal = "../".repeat(10) + "outside.yaml";
    const { candidates, failures } = loadCandidates(emptyIndex(), dir, [traversal]);
    assert.deepEqual(candidates, []);
    assert.equal(failures.length, 1);
    assert.match(failures[0].message, /refusing to read candidate file/);
  });
});

test("an absolute path entry fails closed without reading anything", () => {
  withTempDir((dir) => {
    const { candidates, failures } = loadCandidates(emptyIndex(), dir, ["/etc/passwd"]);
    assert.deepEqual(candidates, []);
    assert.equal(failures.length, 1);
    assert.match(failures[0].message, /refusing to read candidate file/);
  });
});
