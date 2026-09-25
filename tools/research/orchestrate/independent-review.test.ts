import assert from "node:assert/strict";
import test from "node:test";

import { validateIndependentReview } from "./independent-review.ts";
import { buildReviewerPrompt } from "./reviewer-prompt.ts";

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

const FROZEN_INPUT = '{"frozen":"REVIEW_INPUT_SENTINEL"}';
const REVIEWER_PROMPT = buildReviewerPrompt(FROZEN_INPUT);

test("the reviewer prompt does not require candidates to be free of unresolved contradiction", () => {
  assert.doesNotMatch(REVIEWER_PROMPT, /free of unresolved contradiction/i);
});

test("the reviewer prompt permits a faithfully preserved, bounded unresolved contradiction", () => {
  assert.match(REVIEWER_PROMPT, /faithfully preserved, bounded unresolved contradiction is legitimate/);
  assert.match(REVIEWER_PROMPT, /on its own it is not grounds for\sDISAGREEMENT_FOUND or INSUFFICIENT_EVIDENCE/);
});

test("the reviewer prompt assesses support, inference limits, faithful contradiction and unsupported certainty", () => {
  assert.match(REVIEWER_PROMPT, /claims are adequately supported/);
  assert.match(REVIEWER_PROMPT, /inference limits are respected/);
  assert.match(REVIEWER_PROMPT, /contradictions and boundaries are represented faithfully/);
  assert.match(REVIEWER_PROMPT, /unresolved contradiction is explicitly bounded where relevant/);
  assert.match(REVIEWER_PROMPT, /no unsupported certainty/);
});

test("the reviewer prompt embeds the frozen input verbatim and states exactly the outcomes the validator accepts", () => {
  assert.ok(REVIEWER_PROMPT.includes(`REVIEW INPUT (immutable, JSON):\n${FROZEN_INPUT}\n`));
  assert.match(REVIEWER_PROMPT, /"outcome": "CONCUR" \| "DISAGREEMENT_FOUND" \| "INSUFFICIENT_EVIDENCE"/);
  for (const outcome of ["CONCUR", "DISAGREEMENT_FOUND", "INSUFFICIENT_EVIDENCE"]) {
    assert.deepEqual(validateIndependentReview({ schemaVersion: "1", outcome, rationale: "r" }).errors, []);
  }
  assert.match(REVIEWER_PROMPT, /matching exactly this shape \(schemaVersion "1"\)/);
  assert.match(REVIEWER_PROMPT, /"rationale": "<string>"/);
  assert.ok(REVIEWER_PROMPT.endsWith("Do not emit anything on stdout other than this JSON object."));
});
