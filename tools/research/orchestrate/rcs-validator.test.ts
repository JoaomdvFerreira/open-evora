import assert from "node:assert/strict";
import test from "node:test";

import { validateResearchChangeSet } from "./rcs-validator.ts";
import { sha256Hex } from "./fingerprint.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

function genuineManifest() {
  return {
    schemaVersion: "1" as const,
    mode: "daily-discovery" as const,
    investigationQuestion: "What changed for waste collection this week?",
    candidateFiles: ["SRC-NEW.yaml"],
    claimedRecordIds: ["SRC-NEW"],
    rationale: "Synthetic fixture rationale.",
  };
}

function genuineIndependentReview() {
  return { schemaVersion: "1" as const, outcome: "CONCUR" as const, rationale: "No disagreement found." };
}

/** Builds a genuinely valid RCS whose preparationFingerprint/packageId are actually correct. */
function genuineRcs() {
  const manifest = genuineManifest();
  const candidates = [{ recordFamily: "SRC-", fields: { source_id: "SRC-NEW", name: "Synthetic source" } }];
  const deltas = [{ recordFamily: "SRC-", id: "SRC-NEW", action: "CREATE" as const }];
  const validation = { errors: [] as string[], totalRecords: 1 };
  const readiness = "READY_FOR_INTEGRATION_GATE" as const;
  const independentReview = genuineIndependentReview();
  const integrationPlan = {
    baseGitSha: SHA,
    deltas,
    operations: [{ recordFamily: "SRC-", id: "SRC-NEW", action: "CREATE" as const, targetFile: "sources/SRC-NEW.yaml", yaml: "source_id: SRC-NEW\n" }],
  };

  const preparationFingerprint = sha256Hex({
    baseGitSha: SHA,
    manifest,
    candidates,
    deltas,
    validation,
    readiness,
    independentReview,
    integrationPlan,
  });
  const packageId = `RCS-${preparationFingerprint.slice(0, 16)}`;

  return {
    schemaVersion: "1",
    packageId,
    baseGitSha: SHA,
    manifest,
    candidates,
    deltas,
    validation,
    readiness,
    independentReview,
    integrationPlan,
    preparationFingerprint,
  };
}

test("a genuinely assembled RCS passes with zero errors", () => {
  assert.deepEqual(validateResearchChangeSet(genuineRcs()).errors, []);
});

test("a non-object value fails closed", () => {
  assert.deepEqual(validateResearchChangeSet(null).errors, ["research change set must be an object"]);
  assert.deepEqual(validateResearchChangeSet("nope").errors, ["research change set must be an object"]);
});

test("a fabricated independentReview.outcome fails the embedded validator, and the fingerprint check never masks it", () => {
  const rcs = genuineRcs();
  (rcs.independentReview as { outcome: string }).outcome = "FAKE_NEVER_VALIDATED";
  const { errors } = validateResearchChangeSet(rcs);
  assert.ok(errors.some((e) => e.includes("independentReview.") && e.includes("outcome must be one of")));
});

test("a missing independentReview fails closed", () => {
  const rcs = genuineRcs() as Record<string, unknown>;
  delete rcs.independentReview;
  const { errors } = validateResearchChangeSet(rcs);
  assert.ok(errors.some((e) => e.includes("independentReview.") && e.includes("is required")));
});

test("empty candidates fails closed", () => {
  const rcs = genuineRcs();
  (rcs as { candidates: unknown[] }).candidates = [];
  const { errors } = validateResearchChangeSet(rcs);
  assert.match(errors.join("\n"), /candidates must be a non-empty array/);
});

test("a hand-fabricated RCS with only a few top-level fields fails closed on multiple grounds", () => {
  const { errors } = validateResearchChangeSet({
    baseGitSha: SHA,
    manifest: { mode: "daily-discovery", investigationQuestion: "q" },
    packageId: "CORRUPTED",
  });
  assert.ok(errors.length > 3);
});

test("content tampered after fingerprint computation is detected: recomputed fingerprint does not match stored value", () => {
  const rcs = genuineRcs();
  (rcs.candidates[0].fields as Record<string, unknown>).name = "Tampered content";
  const { errors } = validateResearchChangeSet(rcs);
  assert.match(errors.join("\n"), /does not match a fingerprint recomputed/);
});

test("a stored packageId that doesn't match the recomputed fingerprint is detected", () => {
  const rcs = genuineRcs();
  rcs.packageId = "RCS-0000000000000000";
  const { errors } = validateResearchChangeSet(rcs);
  assert.match(errors.join("\n"), /packageId does not match/);
});

test("readiness other than READY_FOR_INTEGRATION_GATE fails closed", () => {
  const rcs = genuineRcs();
  (rcs as { readiness: string }).readiness = "REVIEW_REQUIRED";
  const { errors } = validateResearchChangeSet(rcs);
  assert.match(errors.join("\n"), /readiness must be exactly "READY_FOR_INTEGRATION_GATE"/);
});

test("a non-empty validation.errors array fails closed even if everything else is well-formed", () => {
  const rcs = genuineRcs();
  (rcs.validation as { errors: string[] }).errors = ["some structural problem"];
  const { errors } = validateResearchChangeSet(rcs);
  assert.match(errors.join("\n"), /validation\.errors must be empty/);
});

test("an invalid baseGitSha format fails closed", () => {
  const rcs = genuineRcs();
  (rcs as { baseGitSha: string }).baseGitSha = "not-a-sha";
  const { errors } = validateResearchChangeSet(rcs);
  assert.match(errors.join("\n"), /baseGitSha must be a full 40-character hexadecimal SHA/);
});

test("integrationPlan may be null", () => {
  const rcs = genuineRcs();
  (rcs as { integrationPlan: unknown }).integrationPlan = null;
  // Fingerprint was computed with a non-null plan, so this will fail the
  // recomputed-fingerprint check — but it must fail there, not on shape.
  const { errors } = validateResearchChangeSet(rcs);
  assert.equal(errors.some((e) => e.includes("integrationPlan must be null or an object")), false);
});
