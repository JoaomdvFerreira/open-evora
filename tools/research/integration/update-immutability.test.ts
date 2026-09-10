/**
 * Regression tests for the WU030 ODM-008 UPDATE/base invariant: a PRB
 * UPDATE candidate may not rewrite the canonical record's `created_at`.
 *
 * This is deliberately an integration-time rule rather than a record-schema
 * rule — a standalone PRB with any well-formed `created_at` remains valid on
 * its own, and only an UPDATE against a differing base is rejected.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { loadCorpusIndex } from "../core/corpus.ts";
import { validateCandidateSet } from "./prospective-validation.ts";
import type { CandidateRecord } from "./candidate-delta.ts";

const root = `${process.cwd()}/research`;

function prbCandidate(id: string, mutate: (fields: Record<string, any>) => void): CandidateRecord {
  const index = loadCorpusIndex(root);
  const fields = structuredClone(index.byPrefix.get("PRB-")!.byId.get(id)!.fields) as Record<string, any>;
  mutate(fields);
  return { recordFamily: "PRB-", fields };
}

test("ODM-008: an UPDATE that changes PRB created_at is rejected", () => {
  const index = loadCorpusIndex(root);
  const candidate = prbCandidate("PRB-0001", (fields) => {
    fields.created_at = "2026-01-01";
    fields.updated_at = "2026-09-10";
  });
  const result = validateCandidateSet(index, [candidate]);
  assert.equal(result.deltas[0]!.action, "UPDATE");
  const errors = result.validation.errors.join("\n");
  assert.match(errors, /field "created_at" is immutable on UPDATE/);
  assert.match(errors, /base "2026-08-28" cannot become "2026-01-01"/);
});

test("ODM-008: an UPDATE that leaves PRB created_at unchanged is accepted", () => {
  const index = loadCorpusIndex(root);
  const candidate = prbCandidate("PRB-0001", (fields) => { fields.updated_at = "2026-09-10"; });
  const result = validateCandidateSet(index, [candidate]);
  assert.equal(result.deltas[0]!.action, "UPDATE");
  assert.deepEqual(result.validation.errors, []);
});

test("ODM-008: re-quoting an unchanged created_at is a serialization change, not a mutation", () => {
  const index = loadCorpusIndex(root);
  const base = index.byPrefix.get("PRB-")!.byId.get("PRB-0001")!.fields as Record<string, any>;
  const authored = base.created_at instanceof Date
    ? base.created_at.toISOString().slice(0, 10)
    : String(base.created_at);
  const candidate = prbCandidate("PRB-0001", (fields) => {
    fields.created_at = authored;         // same date, explicitly a string
    fields.updated_at = "2026-09-10";
  });
  const errors = validateCandidateSet(index, [candidate]).validation.errors.join("\n");
  assert.doesNotMatch(errors, /immutable on UPDATE/);
});

test("ODM-008: dropping created_at entirely on UPDATE is rejected", () => {
  const index = loadCorpusIndex(root);
  const candidate = prbCandidate("PRB-0012", (fields) => { delete fields.created_at; });
  const errors = validateCandidateSet(index, [candidate]).validation.errors.join("\n");
  assert.match(errors, /field "created_at" is immutable on UPDATE/);
  assert.match(errors, /cannot become "\(absent\)"/);
});

test("ODM-008: immutability is an UPDATE rule only and does not fire for NO_CHANGE", () => {
  const index = loadCorpusIndex(root);
  const candidate = prbCandidate("PRB-0011", () => {});
  const result = validateCandidateSet(index, [candidate]);
  assert.equal(result.deltas[0]!.action, "NO_CHANGE");
  assert.deepEqual(result.validation.errors, []);
});
