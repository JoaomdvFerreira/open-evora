/**
 * SRC-V2C — executable stress test for the frozen SRC v2 candidate contract
 * (docs/datamodel.md §1.1-§1.2).
 *
 * This encodes the documented SRC v2 shape as a synthetic "SXT-" schema
 * (never the real "SRC-" prefix) using only the five generic declarative
 * capabilities added in SRC-V2B (allowedFields, fieldTypes, patterns,
 * conditionalRequired, exclusiveFieldSets) plus the existing
 * requiredFields/enums mechanisms. The goal is to prove those generic
 * capabilities can express the full v2 contract before
 * research/schemas/source.schema.json or any real SRC-* record is
 * migrated. No real schema or record is read, written, or referenced here.
 *
 * Run with Node's built-in test runner: node --test tools/research (recursively)
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { validateResearchRoot } from "./validate.ts";

const DIRS = ["sources-v2-candidate", "schemas"];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "evora-src-v2-stress-"));
  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, "schemas", "src-v2-candidate.schema.json"), JSON.stringify(SRC_V2_CANDIDATE_SCHEMA, null, 2), "utf8");
  return root;
}

/** Writes one fixture record into a fresh root, validates, then cleans up the root. */
function writeSource(root: string, filename: string, content: string): string[] {
  try {
    writeFileSync(join(root, "sources-v2-candidate", filename), content, "utf8");
    const result = validateResearchRoot(root);
    return result.errors;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const PARTIAL_DATE = "\\d{4}(?:-\\d{2}(?:-\\d{2})?)?";
const FULL_DATE = "\\d{4}-\\d{2}-\\d{2}";

/**
 * Synthetic declarative schema encoding the documented SRC v2 candidate
 * shape (docs/datamodel.md §1.1). Uses prefix "SXT-" (never "SRC-") and a
 * dedicated synthetic directory so this can never be mistaken for, or
 * accidentally validate against, the real SRC corpus.
 */
const SRC_V2_CANDIDATE_SCHEMA = {
  prefix: "SXT-",
  directory: "sources-v2-candidate",
  idField: "source_id",
  sourceModel: "docs/datamodel.md §1.1 (synthetic SRC-V2C stress test — not the executable SRC schema)",

  requiredFields: [
    "source_id",
    "name",
    "resource_type",
    "scope",
    "scope.geography",
    "scope.geography.level",
    "scope.domains",
    "access",
    "access.level",
    "access.availability",
    "access.machine_readable",
    "acquisition",
    "acquisition.method",
    "licensing",
    "licensing.status",
    "licensing.reuse",
    "temporal",
    "temporal.last_checked_at",
  ],

  allowedFields: [
    "source_id",
    "publisher",
    "creators",
    "name",
    "resource_type",

    "identity",
    "identity.persistent_identifier",
    "identity.persistent_identifier.scheme",
    "identity.persistent_identifier.value",
    "identity.version",
    "identity.snapshot_reference",

    "scope",
    "scope.geography",
    "scope.geography.level",
    "scope.geography.area",
    "scope.temporal",
    "scope.temporal.as_of",
    "scope.temporal.start",
    "scope.temporal.end",
    "scope.domains",

    "access",
    "access.level",
    "access.availability",
    "access.machine_readable",
    "access.method",
    "access.format",

    "acquisition",
    "acquisition.method",
    "acquisition.obtained_at",

    "canonical_reference",

    "licensing",
    "licensing.status",
    "licensing.licence",
    "licensing.reuse",
    "licensing.attribution",

    "temporal",
    "temporal.published_at",
    "temporal.updated_at",
    "temporal.last_checked_at",
    "temporal.update_frequency",

    "caveats",
  ],

  enums: {
    resource_type: ["webpage", "document", "dataset", "database", "service", "correspondence", "other", "unknown"],
    "scope.geography.level": [
      "site",
      "local_area",
      "parish",
      "city",
      "municipality",
      "intermunicipal",
      "regional",
      "national",
      "international",
      "non_geographic",
      "unknown",
    ],
    "access.level": ["public", "restricted", "private", "unknown"],
    "access.availability": ["available", "unavailable", "unknown"],
    "access.method": ["browser", "download", "api", "feed", "gis_service", "direct", "other", "unknown"],
    "access.format": ["html", "pdf", "csv", "json", "xml", "xlsx", "kml", "geojson", "image", "video", "text", "other", "unknown"],
    "acquisition.method": ["public_web", "direct_contact", "direct_submission", "api", "archive", "other", "unknown"],
    "licensing.status": ["known", "unknown"],
    "licensing.reuse": ["permitted", "restricted", "prohibited", "unknown"],
    "temporal.update_frequency": ["one_off", "daily", "weekly", "monthly", "quarterly", "annual", "irregular", "unknown"],
  },

  fieldTypes: {
    source_id: ["string"],
    publisher: ["string"],
    creators: ["array"],
    name: ["string"],
    resource_type: ["string"],

    identity: ["object"],
    "identity.persistent_identifier": ["object"],
    "identity.persistent_identifier.scheme": ["string"],
    "identity.persistent_identifier.value": ["string"],
    "identity.version": ["string"],
    "identity.snapshot_reference": ["string"],

    scope: ["object"],
    "scope.geography": ["object"],
    "scope.geography.level": ["string"],
    "scope.geography.area": ["string"],
    "scope.temporal": ["object"],
    "scope.domains": ["array"],

    access: ["object"],
    "access.level": ["string"],
    "access.availability": ["string"],
    // access.machine_readable is boolean OR the canonical string "unknown".
    "access.machine_readable": ["boolean", "string"],
    "access.method": ["string"],
    "access.format": ["string"],

    acquisition: ["object"],
    "acquisition.method": ["string"],
    "acquisition.obtained_at": ["string"],

    canonical_reference: ["string"],

    licensing: ["object"],
    "licensing.status": ["string"],
    "licensing.licence": ["string", "null"],
    "licensing.reuse": ["string"],
    "licensing.attribution": ["string", "null"],

    temporal: ["object"],
    "temporal.published_at": ["string"],
    "temporal.updated_at": ["string"],
    "temporal.last_checked_at": ["string"],
    "temporal.update_frequency": ["string"],

    caveats: ["array"],
  },

  patterns: {
    // access.machine_readable is boolean OR the single canonical string
    // "unknown" (never an arbitrary string) — this pattern only applies
    // when the value is a string (validatePatterns skips non-strings), so
    // it constrains the string branch of the fieldTypes union above
    // without touching the boolean branch.
    "access.machine_readable": "unknown",
    "scope.temporal.as_of": PARTIAL_DATE,
    "scope.temporal.start": PARTIAL_DATE,
    "scope.temporal.end": PARTIAL_DATE,
    "temporal.published_at": PARTIAL_DATE,
    "temporal.updated_at": PARTIAL_DATE,
    "temporal.last_checked_at": FULL_DATE,
    "acquisition.obtained_at": FULL_DATE,
  },

  conditionalRequired: [
    {
      field: "scope.geography.level",
      notIn: ["non_geographic", "unknown"],
      requires: ["scope.geography.area"],
    },
    {
      field: "acquisition.method",
      in: ["direct_contact", "direct_submission", "archive"],
      requires: ["acquisition.obtained_at"],
    },
  ],

  exclusiveFieldSets: [
    {
      path: "scope.temporal",
      sets: [["as_of"], ["start", "end"]],
    },
  ],
};

describe("SRC-V2C stress test: valid fixtures", () => {
  test("1. public municipal webpage in Évora", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-1001.yaml",
      `
source_id: SXT-1001
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

  test("2. Seattle local-area academic document with DOI/version identity metadata", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-1002.yaml",
      `
source_id: SXT-1002
publisher: University of Washington
creators: ["Jane Doe", "John Smith"]
name: Local Housing Policy Study
resource_type: document
identity:
  persistent_identifier:
    scheme: doi
    value: "10.1234/example.5678"
  version: "v2"
scope:
  geography:
    level: local_area
    area: Seattle
  temporal:
    as_of: "2024"
  domains: [housing]
access:
  level: public
  availability: available
  machine_readable: false
  method: download
  format: pdf
acquisition:
  method: public_web
licensing:
  status: known
  reuse: permitted
temporal:
  published_at: "2024-03"
  last_checked_at: "2026-08-11"
`
    );
    assert.deepEqual(errors, []);
  });

  test("3. public machine-readable dataset/API source", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-1003.yaml",
      `
source_id: SXT-1003
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
`
    );
    assert.deepEqual(errors, []);
  });

  test("4. direct-contact correspondence with private/restricted access and mandatory obtained_at", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-1004.yaml",
      `
source_id: SXT-1004
publisher: Junta de Freguesia
name: "Email correspondence re: parish boundary"
resource_type: correspondence
scope:
  geography:
    level: parish
    area: "Malagueira e Horta das Figueiras"
  domains: [governance]
access:
  level: private
  availability: available
  machine_readable: false
acquisition:
  method: direct_contact
  obtained_at: "2026-07-01"
licensing:
  status: unknown
  reuse: restricted
temporal:
  last_checked_at: "2026-08-11"
`
    );
    assert.deepEqual(errors, []);
  });

  test("5. non-geographic source", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-1005.yaml",
      `
source_id: SXT-1005
name: National open-data methodology guide
resource_type: document
scope:
  geography:
    level: non_geographic
  domains: [methodology]
access:
  level: public
  availability: available
  machine_readable: false
  format: pdf
acquisition:
  method: public_web
licensing:
  status: known
  reuse: permitted
temporal:
  last_checked_at: "2026-08-11"
`
    );
    assert.deepEqual(errors, []);
  });

  test("6. historical/versioned archived source using optional identity metadata", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-1006.yaml",
      `
source_id: SXT-1006
publisher: Arquivo Distrital de Évora
name: Historical cadastral map (1950 snapshot)
resource_type: dataset
identity:
  snapshot_reference: "archive.org/web/19500101000000/example"
  version: "1950-ed"
scope:
  geography:
    level: city
    area: Évora
  temporal:
    start: "1948"
    end: "1952"
  domains: [cartography]
access:
  level: restricted
  availability: available
  machine_readable: unknown
  method: direct
  format: image
acquisition:
  method: archive
  obtained_at: "2026-06-15"
licensing:
  status: unknown
  reuse: unknown
temporal:
  last_checked_at: "2026-08-11"
caveats: ["Scan quality is low in the southern quadrant"]
`
    );
    assert.deepEqual(errors, []);
  });
});

describe("SRC-V2C stress test: invalid fixtures", () => {
  test("rejects an unknown field at a nested level", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2001.yaml",
      `
source_id: SXT-2001
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

  test("rejects missing geographic area for a geographic level", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2002.yaml",
      `
source_id: SXT-2002
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

  test("geographic area is not required for non_geographic", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2003.yaml",
      `
source_id: SXT-2003
name: Non-geographic, no area
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
    assert.deepEqual(errors, []);
  });

  test("rejects direct_contact without obtained_at", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2004.yaml",
      `
source_id: SXT-2004
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

  test("rejects an invalid partial date", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2005.yaml",
      `
source_id: SXT-2005
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

  test("rejects an invalid full date", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2006.yaml",
      `
source_id: SXT-2006
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

  test("rejects mixed scope.temporal forms (as_of + interval)", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2007.yaml",
      `
source_id: SXT-2007
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

  test("rejects a partial interval (start only)", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2008.yaml",
      `
source_id: SXT-2008
name: Partial interval
resource_type: document
scope:
  geography:
    level: non_geographic
  temporal:
    start: "2020"
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

  test("rejects an invalid enum value", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2009.yaml",
      `
source_id: SXT-2009
name: Bad enum
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
  reuse: permitted
temporal:
  last_checked_at: "2026-08-11"
`
    );
    assert.ok(errors.some((e) => e.includes('field "resource_type" has invalid value "spreadsheet"')));
  });

  test("rejects a wrong field type (number where string is required)", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2010.yaml",
      `
source_id: SXT-2010
name: 12345
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
    assert.ok(errors.some((e) => e.includes('field "name" has type "number"')));
  });

  test("rejects an arbitrary string for access.machine_readable (only boolean or the literal \"unknown\" string is allowed)", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2012.yaml",
      `
source_id: SXT-2012
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
    assert.ok(errors.some((e) => e.includes('field "access.machine_readable" value "maybe" does not match required pattern')));
  });

  test("rejects retired v1 fields (authority, freshness, canonical_source, api_candidate, notes)", () => {
    const errors = writeSource(
      makeRoot(),
      "SXT-2011.yaml",
      `
source_id: SXT-2011
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
});
