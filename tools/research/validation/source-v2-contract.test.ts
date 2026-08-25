/**
 * SRC-V2D6B — focused tests proving the active
 * research/schemas/source.schema.json (the canonical SRC v2 contract) is
 * wired correctly: loadable by loadSchemas, and its declared rules
 * (allowedFields, fieldTypes, patterns, enums, conditionalRequired,
 * exclusiveFieldSets) are enforced as documented in
 * SRC_V2_CANONICAL_CONTRACT.md.
 *
 * Fixtures are written into a temporary research root (schemas copied
 * verbatim from the real research/schemas/) under sources/, using real
 * "SRC-" IDs — the active corpus and schema files are never touched.
 *
 * This intentionally does not re-derive the full SRC-V2C synthetic stress
 * matrix (see src-v2-stress.test.ts) — it proves the shipped schema is
 * wired, not that the generic capabilities work (already covered
 * elsewhere).
 *
 * Run with Node's built-in test runner: node --test tools/research (recursively)
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, test } from "node:test";

import { validateResearchRoot } from "./validate.ts";

const REAL_RESEARCH_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "research");
const REAL_SCHEMAS_DIR = join(REAL_RESEARCH_ROOT, "schemas");
const DIRS = ["sources", "evidence", "problems", "schemas"];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "evora-src-v2-contract-"));
  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  for (const f of readdirSync(REAL_SCHEMAS_DIR)) {
    writeFileSync(join(root, "schemas", f), readFileSync(join(REAL_SCHEMAS_DIR, f), "utf8"));
  }
  return root;
}

function errorsFor(filename: string, content: string): string[] {
  const root = makeRoot();
  try {
    writeFileSync(join(root, "sources", filename), content, "utf8");
    const result = validateResearchRoot(root);
    return result.errors.filter((e) => e.includes(filename));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("source.schema.json (active SRC v2 contract) is wired correctly", () => {
  test("accepts a representative valid SRC v2 fixture", () => {
    const errors = errorsFor(
      "SRC-0001.yaml",
      `
source_id: SRC-0001
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
`
    );
    assert.deepEqual(errors, []);
  });

  test("rejects retired v1 fields (authority, freshness, canonical_source, api_candidate, notes)", () => {
    const errors = errorsFor(
      "SRC-0002.yaml",
      `
source_id: SRC-0002
name: Retired v1 fields
resource_type: document
authority: authoritative
freshness:
  status: CURRENT
canonical_source: true
api_candidate: false
notes: "some free text"
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
    for (const field of ["authority", "freshness", "canonical_source", "api_candidate", "notes"]) {
      assert.ok(
        errors.some((e) => e.includes(`field "${field}" is not an allowed field`)),
        `expected rejection of retired v1 field "${field}"`
      );
    }
  });

  test("rejects an unknown nested field", () => {
    const errors = errorsFor(
      "SRC-0003.yaml",
      `
source_id: SRC-0003
name: Bad nested field
resource_type: webpage
scope:
  geography:
    level: non_geographic
    trust_rank: high
  domains: [housing]
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
    assert.ok(errors.some((e) => e.includes('field "scope.geography.trust_rank" is not an allowed field')));
  });

  test("enforces scope.geography.area for a geographic level", () => {
    const errors = errorsFor(
      "SRC-0004.yaml",
      `
source_id: SRC-0004
name: Missing area
resource_type: webpage
scope:
  geography:
    level: municipality
  domains: [housing]
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
    assert.ok(
      errors.some((e) => e.includes('field "scope.geography.area" is required when "scope.geography.level" is "municipality"'))
    );
  });

  test("enforces the scope.temporal XOR rule (as_of vs start+end)", () => {
    const errors = errorsFor(
      "SRC-0005.yaml",
      `
source_id: SRC-0005
name: Mixed temporal forms
resource_type: document
scope:
  geography:
    level: non_geographic
  temporal:
    as_of: "2026"
    start: "2020"
    end: "2024"
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
    assert.ok(errors.some((e) => e.includes('field "scope.temporal" must author exactly one of')));
  });

  test("enforces acquisition.obtained_at for direct_contact", () => {
    const errors = errorsFor(
      "SRC-0006.yaml",
      `
source_id: SRC-0006
name: Missing obtained_at
resource_type: correspondence
scope:
  geography:
    level: non_geographic
  domains: [governance]
access:
  level: private
  availability: available
  machine_readable: false
acquisition:
  method: direct_contact
licensing:
  status: unknown
  reuse: restricted
temporal:
  last_checked_at: "2026-08-11"
`
    );
    assert.ok(
      errors.some((e) => e.includes('field "acquisition.obtained_at" is required when "acquisition.method" is "direct_contact"'))
    );
  });

  test("enforces full-date pattern on temporal.last_checked_at", () => {
    const errors = errorsFor(
      "SRC-0007.yaml",
      `
source_id: SRC-0007
name: Bad full date
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
  last_checked_at: "2026-08"
`
    );
    assert.ok(
      errors.some((e) => e.includes('field "temporal.last_checked_at" value "2026-08" does not match required pattern'))
    );
  });

  test("enforces partial-date pattern on scope.temporal.as_of", () => {
    const errors = errorsFor(
      "SRC-0008.yaml",
      `
source_id: SRC-0008
name: Bad partial date
resource_type: document
scope:
  geography:
    level: non_geographic
  temporal:
    as_of: "2026/08"
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
    assert.ok(errors.some((e) => e.includes('field "scope.temporal.as_of" value "2026/08" does not match required pattern')));
  });

  test("access.machine_readable accepts boolean and the literal string \"unknown\", rejects other strings", () => {
    const okErrors = errorsFor(
      "SRC-0009.yaml",
      `
source_id: SRC-0009
name: Unknown machine_readable
resource_type: document
scope:
  geography:
    level: non_geographic
  domains: [methodology]
access:
  level: public
  availability: available
  machine_readable: unknown
acquisition:
  method: public_web
licensing:
  status: known
  reuse: permitted
temporal:
  last_checked_at: "2026-08-11"
`
    );
    assert.deepEqual(okErrors, []);

    const badErrors = errorsFor(
      "SRC-0010.yaml",
      `
source_id: SRC-0010
name: Bad machine_readable value
resource_type: document
scope:
  geography:
    level: non_geographic
  domains: [methodology]
access:
  level: public
  availability: available
  machine_readable: maybe
acquisition:
  method: public_web
licensing:
  status: known
  reuse: permitted
temporal:
  last_checked_at: "2026-08-11"
`
    );
    assert.ok(badErrors.some((e) => e.includes('field "access.machine_readable" value "maybe" does not match required pattern')));
  });
});
