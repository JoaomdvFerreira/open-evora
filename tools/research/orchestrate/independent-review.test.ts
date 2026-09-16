import assert from "node:assert/strict";
import test from "node:test";

import { validateIndependentReview } from "./independent-review.ts";

function validReview(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "1",
    outcome: "CONCUR",
    rationale: "Independent reviewer found no disagreement with the authored candidates.",
    ...overrides,
  };
}

test("a well-formed CONCUR review passes with zero errors", () => {
  assert.deepEqual(validateIndependentReview(validReview()).errors, []);
});

test("DISAGREEMENT_FOUND and INSUFFICIENT_EVIDENCE are both valid outcomes", () => {
  assert.deepEqual(validateIndependentReview(validReview({ outcome: "DISAGREEMENT_FOUND" })).errors, []);
  assert.deepEqual(validateIndependentReview(validReview({ outcome: "INSUFFICIENT_EVIDENCE" })).errors, []);
});

test("a missing independent review result fails closed (§14 case 19)", () => {
  assert.match(validateIndependentReview(undefined).errors.join("\n"), /is required and must not be absent/);
  assert.match(validateIndependentReview(null).errors.join("\n"), /is required and must not be absent/);
});

test("a non-object review fails closed", () => {
  assert.deepEqual(validateIndependentReview("CONCUR").errors, ["independent review result must be an object"]);
  assert.deepEqual(validateIndependentReview(["CONCUR"]).errors, ["independent review result must be an object"]);
});

test("an invalid enum outcome fails closed", () => {
  const { errors } = validateIndependentReview(validReview({ outcome: "LOOKS_FINE" }));
  assert.match(errors.join("\n"), /outcome must be one of/);
});

test("the generator's own self-assessment shape alone (no outcome field) fails closed", () => {
  const { errors } = validateIndependentReview({ schemaVersion: "1", rationale: "looks good to me" });
  assert.match(errors.join("\n"), /outcome must be one of/);
});

test("a missing rationale fails closed", () => {
  const { errors } = validateIndependentReview(validReview({ rationale: "" }));
  assert.match(errors.join("\n"), /rationale must be a non-empty string/);
});

test("wrong schemaVersion fails closed", () => {
  const { errors } = validateIndependentReview(validReview({ schemaVersion: 1 }));
  assert.match(errors.join("\n"), /schemaVersion must be exactly "1"/);
});
