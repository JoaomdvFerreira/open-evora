/**
 * Regression tests for the WU030 mechanical validation hardening.
 *
 * ODM-007 (provenance/list element discipline) and ODM-008 (calendar-valid
 * dates) reproduce failures the pre-WU030 validator accepted. These checks are
 * structural only: they never decide evidential adequacy, which stays human
 * (AGENTS.md "Human-owned decisions").
 */
import assert from "node:assert/strict";
import test from "node:test";

import { loadCorpusIndex } from "../core/corpus.ts";
import { validateCorpusIndex } from "./validate.ts";

const root = `${process.cwd()}/research`;

function errorsAfter(mutate: (index: ReturnType<typeof loadCorpusIndex>) => void): string {
  const index = loadCorpusIndex(root);
  mutate(index);
  return validateCorpusIndex(index).errors.join("\n");
}

function evd(index: ReturnType<typeof loadCorpusIndex>, id = "EVD-000001"): Record<string, any> {
  return index.byPrefix.get("EVD-")!.byId.get(id)!.fields as Record<string, any>;
}

function src(index: ReturnType<typeof loadCorpusIndex>, id = "SRC-0017"): Record<string, any> {
  return index.byPrefix.get("SRC-")!.byId.get(id)!.fields as Record<string, any>;
}

function prb(index: ReturnType<typeof loadCorpusIndex>, id = "PRB-0001"): Record<string, any> {
  return index.byPrefix.get("PRB-")!.byId.get(id)!.fields as Record<string, any>;
}

test("ODM-007: the unmodified canonical corpus still validates cleanly", () => {
  const result = validateCorpusIndex(loadCorpusIndex(root));
  assert.deepEqual(result.errors, []);
  assert.equal(result.totalRecords, 274);
});

test("ODM-007: provenance.sources rejects an empty list where the schema requires one", () => {
  const errors = errorsAfter((index) => { evd(index).provenance.sources = []; });
  assert.match(errors, /field "provenance\.sources" must not be empty/);
});

test("ODM-007: provenance.sources rejects non-string and invalid SRC elements", () => {
  const nonString = errorsAfter((index) => { evd(index).provenance.sources = [42]; });
  assert.match(nonString, /field "provenance\.sources\[0\]" must be a string/);
  assert.match(nonString, /contains a non-string reference entry/);

  const nested = errorsAfter((index) => { evd(index).provenance.sources = [{ id: "SRC-0017" }]; });
  assert.match(nested, /field "provenance\.sources\[0\]" must be a string/);

  const dangling = errorsAfter((index) => { evd(index).provenance.sources = ["SRC-9999"]; });
  assert.match(dangling, /references non-existent SRC-\* record "SRC-9999"/);

  const notASource = errorsAfter((index) => { evd(index).provenance.sources = ["EVD-000001"]; });
  assert.match(notASource, /references non-existent SRC-\* record "EVD-000001"/);
});

test("ODM-007: inference_limits accepts [] structurally but rejects non-string items", () => {
  const empty = errorsAfter((index) => { evd(index).inference_limits = []; });
  assert.doesNotMatch(empty, /inference_limits/);

  const nonString = errorsAfter((index) => { evd(index).inference_limits = ["ok", 7]; });
  assert.match(nonString, /field "inference_limits\[1\]" must be a string/);

  const nested = errorsAfter((index) => { evd(index).inference_limits = [["nested"]]; });
  assert.match(nested, /field "inference_limits\[0\]" must be a string/);
});

test("ODM-007: element-type discipline covers the other declared string lists", () => {
  const populations = errorsAfter((index) => { evd(index).scope.populations = [1]; });
  assert.match(populations, /field "scope\.populations\[0\]" must be a string/);

  const caveats = errorsAfter((index) => { src(index).caveats = [true]; });
  assert.match(caveats, /field "caveats\[0\]" must be a string/);

  const affected = errorsAfter((index) => { prb(index).affected_populations = [null, "ok"]; });
  assert.match(affected, /field "affected_populations\[0\]" must be a string/);
});

test("ODM-008: full YYYY-MM-DD values must be real calendar dates", () => {
  const impossibleDay = errorsAfter((index) => { evd(index).provenance.extracted_at = "2026-02-30"; });
  assert.match(impossibleDay, /field "provenance\.extracted_at" value "2026-02-30" is not a valid calendar date/);

  const impossibleBoth = errorsAfter((index) => { evd(index).provenance.extracted_at = "2026-99-99"; });
  assert.match(impossibleBoth, /"2026-99-99" is not a valid calendar date/);

  const nonLeap = errorsAfter((index) => { evd(index).provenance.extracted_at = "2025-02-29"; });
  assert.match(nonLeap, /"2025-02-29" is not a valid calendar date/);

  const leap = errorsAfter((index) => { evd(index).provenance.extracted_at = "2024-02-29"; });
  assert.doesNotMatch(leap, /provenance\.extracted_at/);
});

test("ODM-008: supported reduced precision remains valid where the schema allows it", () => {
  const year = errorsAfter((index) => { evd(index).scope.temporal = { as_of: "2025" }; });
  assert.doesNotMatch(year, /scope\.temporal\.as_of/);

  const yearMonth = errorsAfter((index) => { evd(index).scope.temporal = { as_of: "2025-06" }; });
  assert.doesNotMatch(yearMonth, /scope\.temporal\.as_of/);

  const fullValid = errorsAfter((index) => { evd(index).scope.temporal = { as_of: "2025-06-15" }; });
  assert.doesNotMatch(fullValid, /scope\.temporal\.as_of/);

  const fullInvalid = errorsAfter((index) => { evd(index).scope.temporal = { as_of: "2025-06-31" }; });
  assert.match(fullInvalid, /field "scope\.temporal\.as_of" value "2025-06-31" is not a valid calendar date/);
});

test("ODM-008: PRB created_at/updated_at are calendar-checked", () => {
  const created = errorsAfter((index) => { prb(index).created_at = "2026-04-31"; });
  assert.match(created, /field "created_at" value "2026-04-31" is not a valid calendar date/);

  const updated = errorsAfter((index) => { prb(index).updated_at = "2026-13-01"; });
  assert.match(updated, /field "updated_at" value "2026-13-01" is not a valid calendar date/);
});
