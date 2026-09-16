import assert from "node:assert/strict";
import test from "node:test";

import { gitFixture, loadIndexFor, syntheticHumanGatePackage, syntheticResearchChangeSet } from "./test-fixtures.ts";
import { buildHumanGatePackage } from "./package-builder.ts";
import { validateHumanGatePackage } from "./package-validator.ts";

test("a valid RCS assembles into a Human Gate package exposing every contractually required element", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());

    assert.equal(pkg.schemaVersion, "1");
    assert.ok(pkg.packageId.startsWith("RCS-"));
    assert.equal(pkg.baseGitSha, fixture.head());
    assert.ok(pkg.investigationQuestion.length > 0);
    assert.equal(pkg.candidates.length, 1);
    assert.equal(pkg.deltas.length, 1);
    assert.deepEqual(pkg.prospectiveValidation.errors, []);
    assert.equal(pkg.independentReview.outcome, "CONCUR");
    assert.ok(pkg.integrationPlan);
    assert.ok(Array.isArray(pkg.affectedProblemReadiness));
    assert.ok(Array.isArray(pkg.affectedProblemIds));
    assert.ok(Array.isArray(pkg.expectedPublicEffect) && pkg.expectedPublicEffect.length > 0);
    assert.ok(Array.isArray(pkg.risksAndUncertainties));
    assert.ok(pkg.nonAuthoritativeRecommendation.startsWith("[NON-AUTHORITATIVE"));

    // The package must itself pass its own structural validator.
    assert.deepEqual(validateHumanGatePackage(pkg).errors, []);
  } finally {
    fixture.cleanup();
  }
});

test("the recommendation field is visually/structurally distinguished from a decision (never presented as one)", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const pkg = syntheticHumanGatePackage(index, fixture.head());
    assert.match(pkg.nonAuthoritativeRecommendation, /^\[NON-AUTHORITATIVE — DOES NOT CONSTITUTE APPROVAL\]/);
  } finally {
    fixture.cleanup();
  }
});

test("problem-refresh mode includes the target PRB in affectedProblemIds even with no PRB delta", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const changeSet = syntheticResearchChangeSet(index, fixture.head(), "SRC-NEW", {
      manifest: { mode: "problem-refresh", targetProblemId: "PRB-0001" },
    });
    const built = buildHumanGatePackage(index, changeSet);
    assert.deepEqual(built.errors, []);
    assert.ok(built.pkg);
    assert.ok(built.pkg!.affectedProblemIds.includes("PRB-0001"));
  } finally {
    fixture.cleanup();
  }
});

test("readiness.ts is invoked read-only: building a package performs no canonical/public write", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const changeSet = syntheticResearchChangeSet(index, fixture.head());
    buildHumanGatePackage(index, changeSet);
    // The canonical SRC-NEW.yaml must not exist on disk — building a
    // package never writes canonical research, only the readiness
    // machinery's existing evaluateProblem() is invoked, read-only.
    const reloaded = loadIndexFor(fixture.research);
    assert.equal(reloaded.totalRecords, index.totalRecords);
  } finally {
    fixture.cleanup();
  }
});

test("independent-review DISAGREEMENT_FOUND is surfaced as a risk rather than silently dropped", () => {
  const fixture = gitFixture();
  try {
    const index = loadIndexFor(fixture.research);
    const changeSet = syntheticResearchChangeSet(index, fixture.head(), "SRC-NEW", {
      independentReview: { outcome: "DISAGREEMENT_FOUND", rationale: "Synthetic disagreement for test coverage." },
    });
    const built = buildHumanGatePackage(index, changeSet);
    assert.deepEqual(built.errors, []);
    assert.ok(built.pkg);
    assert.ok(built.pkg!.risksAndUncertainties.some((r) => r.includes("DISAGREEMENT_FOUND")));
  } finally {
    fixture.cleanup();
  }
});
