import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadSourceVerifications,
  selectSourceVerificationContext,
  sourceVerificationEligibilityErrors,
  SourceVerificationError,
  sourceVerificationIneligibility,
  validateSourceVerifications,
  type SourceVerification,
} from "./source-verifications.ts";
import type { CorpusIndex, RecordFields, RecordSchema } from "./types.ts";
import { stringifyRecordYaml } from "./yaml.ts";
import { validateResearchRoot } from "../validation/validate.ts";

const REAL_SCHEMAS_DIR = fileURLToPath(new URL("../../../research/schemas/", import.meta.url));

const SOURCE_SCHEMA: RecordSchema = { prefix: "SRC-", directory: "sources", idField: "source_id" };

function publicSource(id: string, overrides: RecordFields = {}): RecordFields {
  return { source_id: id, resource_type: "document", access: { level: "public" }, licensing: { reuse: "unknown" }, ...overrides };
}

function indexOf(root: string, sources: RecordFields[]): CorpusIndex {
  const records = sources.map((fields) => ({ file: `sources/${fields.source_id}.yaml`, fields }));
  return {
    researchRoot: root,
    byPrefix: new Map([["SRC-", { schema: SOURCE_SCHEMA, records, byId: new Map(records.map((r) => [r.fields.source_id as string, r])) }]]),
    totalRecords: records.length,
  };
}

function support(sourceId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source_id: sourceId,
    retrieval: { retrieved_at: "2026-08-25", content_sha256: "0123456789abcdef".repeat(4), media_type: "application/pdf" },
    verified_claims: [
      { locator: "p. 4, quadro 2", statement: "A avaliação regista a ocupação média por quarteirão nas áreas-piloto entre 2011 e 2013." },
      { locator: "p. 12", statement: "O relatório descreve o ajuste periódico de preços em função da ocupação observada." },
    ],
    ...overrides,
  };
}

/** A research root containing only `source-verifications/` with the given files (name -> YAML text). */
function withSupportRoot(files: Record<string, string>, fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "open-evora-source-verifications-"));
  try {
    mkdirSync(join(root, "source-verifications"));
    for (const [name, text] of Object.entries(files)) writeFileSync(join(root, "source-verifications", name), text, "utf8");
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function errorsFor(document: Record<string, unknown> | string, source: RecordFields | null = publicSource("SRC-0001")): string[] {
  const text = typeof document === "string" ? document : stringifyRecordYaml(document);
  let errors: string[] = [];
  withSupportRoot({ "SRC-0001.yaml": text }, (root) => {
    errors = validateSourceVerifications(indexOf(root, source ? [source] : []));
  });
  return errors;
}

test("a valid support file loads with exactly its allowed keys and claims in file order", () => {
  const document = support("SRC-0001", { retrieval: { ...support("SRC-0001").retrieval as object, archive_reference: "Cópia arquivada em armazenamento do projeto, ref. 2026-08-25-a" } });
  withSupportRoot({ "SRC-0001.yaml": stringifyRecordYaml(document) }, (root) => {
    const loaded = loadSourceVerifications(indexOf(root, [publicSource("SRC-0001")]));
    assert.deepEqual(loaded.issues, []);
    assert.deepEqual(loaded.bySourceId.get("SRC-0001"), document);
  });
});

test("a missing support directory is an empty set, and absence of support is not a validation problem", () => {
  const root = mkdtempSync(join(tmpdir(), "open-evora-source-verifications-"));
  try {
    const loaded = loadSourceVerifications(indexOf(root, [publicSource("SRC-0001")]));
    assert.equal(loaded.bySourceId.size, 0);
    assert.deepEqual(loaded.issues, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("support must belong to an existing, eligible canonical SRC", () => {
  assert.ok(errorsFor(support("SRC-0001"), null).some((e) => e.includes("SRC-0001 does not exist as a canonical SRC record")));
  for (const level of ["restricted", "private", "unknown"]) {
    assert.ok(errorsFor(support("SRC-0001"), publicSource("SRC-0001", { access: { level } })).some((e) => e.includes(`access.level "${level}"`)), level);
  }
  assert.ok(errorsFor(support("SRC-0001"), publicSource("SRC-0001", { resource_type: "correspondence" })).some((e) => e.includes("is correspondence")));
  assert.ok(errorsFor(support("SRC-0001"), publicSource("SRC-0001", { licensing: { reuse: "prohibited" } })).some((e) => e.includes('licensing.reuse "prohibited"')));
});

test("eligibility is one rule: its reason categories and its validation errors agree, and correspondence is never eligible", () => {
  const cases: [RecordFields, string[]][] = [
    [publicSource("SRC-0001"), []],
    [publicSource("SRC-0001", { resource_type: "correspondence" }), ["CORRESPONDENCE"]],
    [publicSource("SRC-0001", { resource_type: "correspondence", access: { level: "private" } }), ["NON_PUBLIC", "CORRESPONDENCE"]],
    [publicSource("SRC-0001", { access: { level: "restricted" }, licensing: { reuse: "prohibited" } }), ["NON_PUBLIC", "REUSE_PROHIBITED"]],
  ];
  for (const [source, reasons] of cases) {
    assert.deepEqual(sourceVerificationIneligibility(source), reasons);
    assert.equal(sourceVerificationEligibilityErrors("SRC-0001", source).length, reasons.length);
    assert.equal(errorsFor(support("SRC-0001"), source).length, reasons.length);
  }
});

test("licensing.reuse unknown stays eligible because support carries no Source wording or bytes", () => {
  assert.deepEqual(errorsFor(support("SRC-0001"), publicSource("SRC-0001", { licensing: { status: "unknown", reuse: "unknown" } })), []);
});

test("the file is keyed by its Source: source_id must match the file name", () => {
  assert.ok(errorsFor(support("SRC-0002")).some((e) => e.includes('source_id must be "SRC-0001"')));
});

test("retrieval dates, digests and media types are checked", () => {
  const retrieval = support("SRC-0001").retrieval as Record<string, unknown>;
  const cases: [Record<string, unknown>, string][] = [
    [{ retrieved_at: "2026-02-30" }, "retrieval.retrieved_at must be a real calendar date"],
    [{ retrieved_at: "2026-08" }, "retrieval.retrieved_at must be a real calendar date"],
    [{ content_sha256: "0123456789ABCDEF".repeat(4) }, "retrieval.content_sha256 must be 64 lower-case hexadecimal characters"],
    [{ content_sha256: "0123456789abcdef".repeat(4).slice(1) }, "retrieval.content_sha256 must be 64 lower-case hexadecimal characters"],
    [{ media_type: "" }, "retrieval.media_type must be a lower-case type/subtype media type"],
    [{ media_type: "pdf" }, "retrieval.media_type must be a lower-case type/subtype media type"],
    [{ archive_reference: "" }, "retrieval.archive_reference must be a non-empty string"],
    [{ archive_reference: "a".repeat(501) }, "retrieval.archive_reference must be at most 500 characters"],
  ];
  for (const [change, expected] of cases) {
    const errors = errorsFor(support("SRC-0001", { retrieval: { ...retrieval, ...change } }));
    assert.ok(errors.some((e) => e.includes(expected)), `${JSON.stringify(change)}: ${errors.join("; ")}`);
  }
});

test("claim cardinality and field length caps are enforced", () => {
  const claim = (statement = "Uma afirmação factual limitada.", locator = "p. 1") => ({ locator, statement });
  assert.ok(errorsFor(support("SRC-0001", { verified_claims: [] })).some((e) => e.includes("verified_claims must be a list of 1-8 claims")));
  assert.ok(errorsFor(support("SRC-0001", { verified_claims: Array.from({ length: 9 }, () => claim()) })).some((e) => e.includes("1-8 claims")));
  assert.deepEqual(errorsFor(support("SRC-0001", { verified_claims: Array.from({ length: 8 }, () => claim()) })), []);
  assert.deepEqual(errorsFor(support("SRC-0001", { verified_claims: [claim("é".repeat(500), "l".repeat(200))] })), []);
  assert.ok(errorsFor(support("SRC-0001", { verified_claims: [claim("é".repeat(501))] })).some((e) => e.includes("verified_claims[0].statement must be at most 500 characters")));
  assert.ok(errorsFor(support("SRC-0001", { verified_claims: [claim(undefined, "l".repeat(201))] })).some((e) => e.includes("verified_claims[0].locator must be at most 200 characters")));
  assert.ok(errorsFor(support("SRC-0001", { verified_claims: [claim("  ")] })).some((e) => e.includes("verified_claims[0].statement must be a non-empty string")));
});

test("unexpected fields are rejected at every level, including free-form rationale", () => {
  const retrieval = support("SRC-0001").retrieval as Record<string, unknown>;
  const errors = [
    ...errorsFor(support("SRC-0001", { rationale: "Porque o autor considera relevante." })),
    ...errorsFor(support("SRC-0001", { retrieval: { ...retrieval, url: "https://example.invalid" } })),
    ...errorsFor(support("SRC-0001", { verified_claims: [{ locator: "p. 1", statement: "Afirmação.", quote: "texto original" }] })),
  ];
  assert.ok(errors.some((e) => e.includes('support file has unexpected field "rationale"')));
  assert.ok(errors.some((e) => e.includes('retrieval has unexpected field "url"')));
  assert.ok(errors.some((e) => e.includes('verified_claims[0] has unexpected field "quote"')));
});

test("parsing is deterministic: malformed YAML, duplicate keys and stray files are reported, never guessed", () => {
  assert.ok(errorsFor("source_id: [unclosed\n").some((e) => e.includes("malformed YAML")));
  assert.ok(errorsFor(`${stringifyRecordYaml(support("SRC-0001"))}source_id: SRC-0001\n`).some((e) => e.includes("malformed YAML")));
  withSupportRoot({ "SRC-0001.yml": stringifyRecordYaml(support("SRC-0001")), "notes.md": "# notas\n" }, (root) => {
    const errors = validateSourceVerifications(indexOf(root, [publicSource("SRC-0001")]));
    assert.deepEqual(errors, [
      "[source-verifications/SRC-0001.yml] only SRC-*.yaml support files are allowed in this directory",
      "[source-verifications/notes.md] only SRC-*.yaml support files are allowed in this directory",
    ]);
  });
});

test("selection returns only applicable support, sorted by SRC ID; absent support is simply absent", () => {
  withSupportRoot({
    "SRC-0003.yaml": stringifyRecordYaml(support("SRC-0003")),
    "SRC-0001.yaml": stringifyRecordYaml(support("SRC-0001")),
    "SRC-0009.yaml": stringifyRecordYaml(support("SRC-0009")),
  }, (root) => {
    const index = indexOf(root, ["SRC-0001", "SRC-0002", "SRC-0003", "SRC-0009"].map((id) => publicSource(id)));
    const set = loadSourceVerifications(index);
    const selected = selectSourceVerificationContext(set, ["SRC-0003", "SRC-0002", "SRC-0001", "SRC-0003"], index);
    assert.deepEqual(selected.map((entry: SourceVerification) => entry.source_id), ["SRC-0001", "SRC-0003"]);
    assert.deepEqual(selectSourceVerificationContext(set, [], index), []);
  });
});

test("invalid applicable support fails closed, while unrelated invalid support does not affect selection", () => {
  withSupportRoot({
    "SRC-0001.yaml": stringifyRecordYaml(support("SRC-0001", { verified_claims: [] })),
    "SRC-0002.yaml": stringifyRecordYaml(support("SRC-0002")),
  }, (root) => {
    const index = indexOf(root, [publicSource("SRC-0001"), publicSource("SRC-0002")]);
    const set = loadSourceVerifications(index);
    assert.throws(() => selectSourceVerificationContext(set, ["SRC-0001", "SRC-0002"], index), SourceVerificationError);
    assert.deepEqual(selectSourceVerificationContext(set, ["SRC-0002"], index).map((entry) => entry.source_id), ["SRC-0002"]);
  });
});

test("support stops applying when the prospective SRC is no longer eligible", () => {
  withSupportRoot({ "SRC-0001.yaml": stringifyRecordYaml(support("SRC-0001")) }, (root) => {
    const base = indexOf(root, [publicSource("SRC-0001")]);
    const set = loadSourceVerifications(base);
    const prospective = indexOf(root, [publicSource("SRC-0001", { access: { level: "restricted" } })]);
    assert.throws(() => selectSourceVerificationContext(set, ["SRC-0001"], prospective), /no longer eligible: .*access.level "restricted"/);
  });
});

test("research validation checks every support file against the corpus without counting it as a record", () => {
  const root = mkdtempSync(join(tmpdir(), "open-evora-source-verifications-"));
  try {
    for (const dir of ["sources", "evidence", "problems", "schemas", "source-verifications"]) mkdirSync(join(root, dir));
    for (const file of readdirSync(REAL_SCHEMAS_DIR)) copyFileSync(join(REAL_SCHEMAS_DIR, file), join(root, "schemas", file));
    writeFileSync(join(root, "sources", "SRC-9001.yaml"), [
      "source_id: SRC-9001", "publisher: Fixture", "name: Fixture Source", "resource_type: document",
      "scope:", "  geography:", "    level: municipality", "    area: Évora", "  domains: [MOB]",
      "access:", "  level: public", "  availability: available", "  machine_readable: false",
      "acquisition:", "  method: public_web", "licensing:", "  status: unknown", "  reuse: unknown",
      "temporal:", "  last_checked_at: 2026-08-11", "",
    ].join("\n"), "utf8");
    writeFileSync(join(root, "source-verifications", "SRC-9001.yaml"), stringifyRecordYaml(support("SRC-9001")), "utf8");
    assert.deepEqual(validateResearchRoot(root), { errors: [], totalRecords: 1 });

    writeFileSync(join(root, "source-verifications", "SRC-9002.yaml"), stringifyRecordYaml(support("SRC-9002")), "utf8");
    assert.deepEqual(validateResearchRoot(root).errors, ["[source-verifications/SRC-9002.yaml] SRC-9002 does not exist as a canonical SRC record"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
