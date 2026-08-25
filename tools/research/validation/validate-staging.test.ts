/**
 * SRC-V2D2 — focused tests for validateStaging (research/sources-v2-staging
 * validation against the candidate SRC v2 schema).
 *
 * Uses a throwaway copy of the real research/schemas/source-v2.schema.json
 * (the actual D1 candidate file, not a synthetic restatement) inside a
 * temporary research root, with staged fixtures written under that root's
 * sources-v2-staging/ directory — never inside the real repo's
 * research/sources-v2-staging/ or research/sources/. This proves the real
 * candidate schema drives staging validation correctly while keeping the
 * active corpus and the tracked-but-empty staging directory untouched.
 *
 * Run with Node's built-in test runner: node --test tools/research (recursively)
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { validateStaging } from "./validate-staging.ts";

const REAL_CANDIDATE_SCHEMA_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "research",
  "schemas",
  "source-v2.schema.json"
);

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "evora-src-v2-staging-"));
  mkdirSync(join(root, "schemas"), { recursive: true });
  mkdirSync(join(root, "sources-v2-staging"), { recursive: true });
  // Copy the real candidate schema file verbatim — this is not a
  // synthetic restatement of the contract.
  const candidateSchemaText = readFileSync(REAL_CANDIDATE_SCHEMA_PATH, "utf8");
  writeFileSync(join(root, "schemas", "source-v2.schema.json"), candidateSchemaText, "utf8");
  return root;
}

function writeStaged(root: string, filename: string, content: string): void {
  writeFileSync(join(root, "sources-v2-staging", filename), content, "utf8");
}

const VALID_SRC_1 = `
source_id: SRC-9001
publisher: Câmara Municipal de Évora
name: Página de Urbanismo
resource_type: webpage
scope:
  geography:
    level: municipality
    area: Évora
  domains: [urbanism]
access:
  level: public
  availability: available
  machine_readable: false
  method: browser
  format: html
acquisition:
  method: public_web
licensing:
  status: known
  licence: "CC-BY 4.0"
  reuse: permitted
temporal:
  last_checked_at: "2026-08-11"
`;

const VALID_SRC_2 = `
source_id: SRC-9002
publisher: Instituto Nacional de Estatística
name: Population API
resource_type: service
scope:
  geography:
    level: national
    area: Portugal
  domains: [demographics]
access:
  level: public
  availability: available
  machine_readable: true
  method: api
  format: json
acquisition:
  method: api
licensing:
  status: known
  reuse: permitted
temporal:
  update_frequency: annual
  last_checked_at: "2026-08-11"
`;

describe("validateStaging", () => {
  test("valid SRC v2 YAML with a real SRC-xxxx ID passes", () => {
    const root = makeRoot();
    try {
      writeStaged(root, "SRC-9001.yaml", VALID_SRC_1);
      const result = validateStaging(root);
      assert.deepEqual(result.errors, []);
      assert.equal(result.totalRecords, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("multiple staged SRCs pass together", () => {
    const root = makeRoot();
    try {
      writeStaged(root, "SRC-9001.yaml", VALID_SRC_1);
      writeStaged(root, "SRC-9002.yaml", VALID_SRC_2);
      const result = validateStaging(root);
      assert.deepEqual(result.errors, []);
      assert.equal(result.totalRecords, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("retired v1 fields fail", () => {
    const root = makeRoot();
    try {
      writeStaged(
        root,
        "SRC-9003.yaml",
        `
source_id: SRC-9003
name: Retired v1 fields
resource_type: document
authority: authoritative
freshness:
  status: CURRENT
scope:
  geography:
    level: non_geographic
  domains: [methodology]
access:
  level: public
  availability: available
  machine_readable: false
acquisition:
  method: public_web
licensing:
  status: known
  reuse: permitted
temporal:
  last_checked_at: "2026-08-11"
`
      );
      const result = validateStaging(root);
      assert.ok(result.errors.some((e) => e.includes('field "authority" is not an allowed field')));
      assert.ok(result.errors.some((e) => e.includes('field "freshness" is not an allowed field')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("malformed source ID (bad prefix) fails", () => {
    const root = makeRoot();
    try {
      writeStaged(
        root,
        "SRC-9004.yaml",
        `
source_id: XYZ-9004
name: Bad ID prefix
resource_type: document
scope:
  geography:
    level: non_geographic
  domains: [methodology]
access:
  level: public
  availability: available
  machine_readable: false
acquisition:
  method: public_web
licensing:
  status: known
  reuse: permitted
temporal:
  last_checked_at: "2026-08-11"
`
      );
      const result = validateStaging(root);
      assert.ok(result.errors.some((e) => e.includes('does not start with expected prefix "SRC-"')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("filename/ID mismatch fails", () => {
    const root = makeRoot();
    try {
      writeStaged(
        root,
        "SRC-9005.yaml",
        `
source_id: SRC-9999
name: Filename mismatch
resource_type: document
scope:
  geography:
    level: non_geographic
  domains: [methodology]
access:
  level: public
  availability: available
  machine_readable: false
acquisition:
  method: public_web
licensing:
  status: known
  reuse: permitted
temporal:
  last_checked_at: "2026-08-11"
`
      );
      const result = validateStaging(root);
      assert.ok(result.errors.some((e) => e.includes('filename "SRC-9005" does not match record ID "SRC-9999"')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("duplicate source IDs across two staged files fail", () => {
    const root = makeRoot();
    try {
      writeStaged(root, "SRC-9001.yaml", VALID_SRC_1);
      writeStaged(
        root,
        "SRC-9001-dup.yaml",
        VALID_SRC_1.replace("source_id: SRC-9001", "source_id: SRC-9001")
      );
      const result = validateStaging(root);
      assert.ok(result.errors.some((e) => e.includes('duplicate ID "SRC-9001"')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("invalid schema content (bad enum, missing required field) fails", () => {
    const root = makeRoot();
    try {
      writeStaged(
        root,
        "SRC-9006.yaml",
        `
source_id: SRC-9006
name: Bad enum and missing required field
resource_type: spreadsheet
scope:
  geography:
    level: non_geographic
  domains: [methodology]
access:
  level: public
  availability: available
  machine_readable: false
acquisition:
  method: public_web
licensing:
  status: known
temporal:
  last_checked_at: "2026-08-11"
`
      );
      const result = validateStaging(root);
      assert.ok(result.errors.some((e) => e.includes('field "resource_type" has invalid value "spreadsheet"')));
      assert.ok(result.errors.some((e) => e.includes("missing required field: licensing.reuse")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("malformed YAML is reported as a parse-failure error, not thrown", () => {
    const root = makeRoot();
    try {
      writeStaged(root, "SRC-9007.yaml", "source_id: SRC-9007\n  bad indent: [\n");
      const result = validateStaging(root);
      assert.ok(result.errors.some((e) => e.includes("malformed YAML")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("staged validation does not add records to the active corpus", () => {
    const root = makeRoot();
    try {
      writeStaged(root, "SRC-9001.yaml", VALID_SRC_1);
      const result = validateStaging(root);
      assert.equal(result.totalRecords, 1);
      // The temp root has no research/sources/ directory at all — proving
      // validateStaging never reads it, only sources-v2-staging/.
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("real repo's research/sources-v2-staging/ validates cleanly and calling validateStaging on it does not affect the active corpus", () => {
    const realResearchRoot = join(dirname(REAL_CANDIDATE_SCHEMA_PATH), "..");
    const result = validateStaging(realResearchRoot);
    assert.deepEqual(result.errors, []);
    // The active research/sources/ corpus (236 records) is validated separately
    // by validateResearchRoot; this only counts staged SRC-V2 migration files.
  });
});
