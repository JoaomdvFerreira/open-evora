import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getRecordField } from "./record-fields.ts";

describe("getRecordField", () => {
  const fields = {
    title: "Authored title",
    scope: { geography: { area: "Évora" } },
    absent: null,
    scalar: "value",
    list: [{ id: "item" }],
    authoredFalse: false,
    authoredZero: 0,
    authoredEmpty: "",
  };

  test("returns top-level and nested authored fields", () => {
    assert.equal(getRecordField(fields, "title"), "Authored title");
    assert.equal(getRecordField(fields, "scope.geography.area"), "Évora");
  });

  test("returns undefined for missing paths and non-traversable values", () => {
    assert.equal(getRecordField(fields, "scope.geography.country"), undefined);
    assert.equal(getRecordField(fields, "absent.value"), undefined);
    assert.equal(getRecordField(fields, "scalar.value"), undefined);
    assert.equal(getRecordField(fields, "list.id"), undefined);
  });

  test("returns authored false, zero, and empty-string values unchanged", () => {
    assert.strictEqual(getRecordField(fields, "authoredFalse"), false);
    assert.strictEqual(getRecordField(fields, "authoredZero"), 0);
    assert.strictEqual(getRecordField(fields, "authoredEmpty"), "");
  });
});
