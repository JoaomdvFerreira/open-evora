/**
 * SRC-V2D1 — focused tests proving research/schemas/source-v2.schema.json
 * itself (the real candidate file, not a synthetic restatement of it) is
 * wired correctly: loadable by loadSchemas, and its declared rules
 * (allowedFields, fieldTypes, patterns, enums, conditionalRequired,
 * exclusiveFieldSets) are enforced as documented in
 * SRC_V2_CANONICAL_CONTRACT.md.
 *
 * The candidate schema is deliberately inactive: prefix "SRC2-" and
 * directory "sources-v2-candidate" (not "SRC-"/"sources"), so it never
 * matches the real SRC-* corpus in research/sources. These tests exercise
 * it by writing SRC2-* fixtures into a throwaway
 * research/sources-v2-candidate/ directory inside the *real* repo research
 * root (so the real research/schemas/source-v2.schema.json is the one
 * being loaded), then deleting that directory afterwards. The active
 * research/schemas/source.schema.json and the real research/sources/*
 * corpus are never touched.
 *
 * This intentionally does not re-derive the full SRC-V2C synthetic stress
 * matrix (see src-v2-stress.test.ts) — it proves the shipped file is wired,
 * not that the generic capabilities work (already covered elsewhere).
 *
 * Run with Node's built-in test runner: node --test tools/research (recursively)
 */
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";

import { validateResearchRoot } from "./validate.ts";

const RESEARCH_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "research");
const CANDIDATE_DIR = join(RESEARCH_ROOT, "sources-v2-candidate");

function withFixture(filename: string, content: string, run: () => void): void {
  mkdirSync(CANDIDATE_DIR, { recursive: true });
  try {
    writeFileSync(join(CANDIDATE_DIR, filename), content, "utf8");
    run();
  } finally {
    rmSync(CANDIDATE_DIR, { recursive: true, force: true });
  }
}

function errorsFor(filename: string, content: string): string[] {
  let result!: { errors: string[] };
  withFixture(filename, content, () => {
    result = validateResearchRoot(RESEARCH_ROOT);
  });
  return result.errors.filter((e) => e.includes(filename));
}

describe("source-v2.schema.json (SRC-V2D1 candidate) is wired correctly", () => {
  test("real active corpus (research/sources/*, SRC-*) still validates clean with the candidate schema present", () => {
    // No SRC2-* fixture written: this proves the mere presence of
    // source-v2.schema.json in research/schemas/ does not perturb the
    // real 236-record active corpus.
    const result = validateResearchRoot(RESEARCH_ROOT);
    assert.deepEqual(result.errors, []);
  });

  test("accepts a representative valid SRC v2 fixture", () => {
    const errors = errorsFor(
      "SRC2-0001.yaml",
      `
source_id: SRC2-0001
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
      "SRC2-0002.yaml",
      `
source_id: SRC2-0002
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
      "SRC2-0003.yaml",
      `
source_id: SRC2-0003
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
      "SRC2-0004.yaml",
      `
source_id: SRC2-0004
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
      "SRC2-0005.yaml",
      `
source_id: SRC2-0005
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
      "SRC2-0006.yaml",
      `
source_id: SRC2-0006
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
      "SRC2-0007.yaml",
      `
source_id: SRC2-0007
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
      "SRC2-0008.yaml",
      `
source_id: SRC2-0008
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
      "SRC2-0009.yaml",
      `
source_id: SRC2-0009
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
      "SRC2-0010.yaml",
      `
source_id: SRC2-0010
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
