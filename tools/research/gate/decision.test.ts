/**
 * Approval/content-hash binding adversarial tests plus invalid
 * decision-combination coverage: malformed/invalid RCS, an RCS changed after
 * review rendering, a changed contentHash, and an invalid canonical
 * acceptance / publication decision combination.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { gitFixture, loadIndexFor, semanticHumanGatePackage, syntheticHumanGatePackage, withTempDir, type SemanticReviewScenario } from "./test-fixtures.ts";
import { computeContentHash } from "./content-hash.ts";
import { isValidDecisionCombination, submitHumanGateDecision } from "./decision.ts";
import { decisionRecordPath } from "./decision-record.ts";
import type { CanonicalAcceptanceDecision, HumanGatePackage, PublicExplorerPublicationDecision } from "./types.ts";

function writePackage(cycleDir: string, pkg: unknown): string {
  const path = join(cycleDir, "human-gate-package.json");
  writeFileSync(path, JSON.stringify(pkg, null, 2), "utf8");
  return path;
}

function decideOn(
  pkg: HumanGatePackage,
  canonicalAcceptance: CanonicalAcceptanceDecision,
  publicExplorerPublication: PublicExplorerPublicationDecision,
  onDisk: unknown = pkg
) {
  return withTempDir((cycleDir) =>
    submitHumanGateDecision(writePackage(cycleDir, onDisk), {
      packageId: pkg.packageId,
      contentHash: computeContentHash(pkg),
      baseGitSha: pkg.baseGitSha,
      actor: "owner@example.invalid",
      canonicalAcceptance,
      publicExplorerPublication,
    })
  );
}

const BLOCKING_OUTCOMES: readonly SemanticReviewScenario[] = ["DISAGREEMENT_FOUND", "INSUFFICIENT_EVIDENCE"];

test("canonical APPROVE is recorded for a package whose semantic review outcome is CONCUR", () => {
  const pkg = semanticHumanGatePackage("CONCUR");
  for (const publication of ["APPROVE", "HOLD", "REJECT"] as const) {
    const outcome = decideOn(pkg, "APPROVE", publication);
    assert.equal(outcome.status, "RECORDED");
    if (outcome.status === "RECORDED") assert.equal(outcome.record.canonicalAcceptance, "APPROVE");
  }
});

test("canonical APPROVE is rejected as a semantic-review blocker whenever the review outcome is not CONCUR, whatever the publication decision", () => {
  for (const scenario of BLOCKING_OUTCOMES) {
    const pkg = semanticHumanGatePackage(scenario);
    for (const publication of ["APPROVE", "HOLD", "REJECT"] as const) {
      const outcome = decideOn(pkg, "APPROVE", publication);
      assert.equal(outcome.status, "REJECTED_SEMANTIC_REVIEW_BLOCKER", `${scenario} + APPROVE/${publication}`);
      if (outcome.status !== "REJECTED_SEMANTIC_REVIEW_BLOCKER") continue;
      assert.match(outcome.message, new RegExp(`outcome is ${scenario}, not CONCUR`));
      assert.match(outcome.message, /until a new compliant candidate\/review\/package cycle reaches CONCUR/);
    }
  }
});

test("REJECT and HOLD_MORE_RESEARCH remain recordable when the semantic review blocks approval", () => {
  for (const scenario of BLOCKING_OUTCOMES) {
    const pkg = semanticHumanGatePackage(scenario);
    for (const [canonical, publication] of [["REJECT", "REJECT"], ["REJECT", "HOLD"], ["HOLD_MORE_RESEARCH", "HOLD"], ["HOLD_MORE_RESEARCH", "REJECT"]] as const) {
      const outcome = decideOn(pkg, canonical, publication);
      assert.equal(outcome.status, "RECORDED", `${scenario} + ${canonical}/${publication}`);
      if (outcome.status === "RECORDED") assert.equal(outcome.record.canonicalAcceptance, canonical);
    }
  }
});

test("public APPROVE cannot bypass canonical-acceptance rules on a semantically blocked package", () => {
  const pkg = semanticHumanGatePackage("DISAGREEMENT_FOUND");
  for (const canonical of ["REJECT", "HOLD_MORE_RESEARCH"] as const) {
    assert.equal(decideOn(pkg, canonical, "APPROVE").status, "REJECTED_INVALID_COMBINATION");
  }
});

test("ADVERSARIAL: a tampered blocked package fails the content-hash binding before any semantic-review evaluation", () => {
  const pkg = semanticHumanGatePackage("DISAGREEMENT_FOUND");
  const mutated = { ...pkg, nonAuthoritativeRecommendation: `${pkg.nonAuthoritativeRecommendation} (mutated after render)` };
  assert.equal(decideOn(pkg, "APPROVE", "APPROVE", mutated).status, "ABORTED_CONTENT_MISMATCH");
});

test("ADVERSARIAL: a Gate review projection rewritten to CONCUR over a blocking RCS review is an invalid package, never an approval", () => {
  const pkg = semanticHumanGatePackage("DISAGREEMENT_FOUND");
  const concur = semanticHumanGatePackage("CONCUR");
  const forged = { ...pkg, independentReview: concur.independentReview };
  const outcome = decideOn(forged, "APPROVE", "APPROVE");
  assert.equal(outcome.status, "ABORTED_INVALID_PACKAGE");
  if (outcome.status === "ABORTED_INVALID_PACKAGE") assert.match(outcome.message, /package\.independentReview must equal package\.researchChangeSet\.independentReview/);
});

test("the gate CLI rejects a semantically blocked canonical APPROVE and writes no decision record", () => {
  const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));
  withTempDir((cycleDir) => {
    const pkg = semanticHumanGatePackage("INSUFFICIENT_EVIDENCE");
    writePackage(cycleDir, pkg);
    const run = (canonical: string, publication: string) => spawnSync(process.execPath, [
      "--experimental-strip-types", cli, "decide",
      "--cycle-dir", cycleDir,
      "--actor", "owner@example.invalid",
      "--content-hash", computeContentHash(pkg),
      "--canonical-acceptance", canonical,
      "--public-publication", publication,
    ], { encoding: "utf8" });

    const rejected = run("APPROVE", "HOLD");
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /FAILED \[REJECTED_SEMANTIC_REVIEW_BLOCKER\]/);
    assert.equal(existsSync(decisionRecordPath(cycleDir)), false);

    const held = run("HOLD_MORE_RESEARCH", "HOLD");
    assert.equal(held.status, 0, held.stderr);
    assert.equal(existsSync(decisionRecordPath(cycleDir)), true);
  });
});

test("a valid, unmutated package produces a RECORDED decision bound to the shown hash", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      const path = writePackage(cycleDir, pkg);
      const shownHash = computeContentHash(pkg);

      const outcome = submitHumanGateDecision(path, {
        packageId: pkg.packageId,
        contentHash: shownHash,
        baseGitSha: pkg.baseGitSha,
        actor: "owner@example.invalid",
        canonicalAcceptance: "APPROVE",
        publicExplorerPublication: "APPROVE",
      });

      assert.equal(outcome.status, "RECORDED");
      if (outcome.status !== "RECORDED") return;
      assert.equal(outcome.record.contentHash, shownHash);
      assert.equal(outcome.record.packageId, pkg.packageId);
      assert.equal(outcome.record.baseGitSha, pkg.baseGitSha);
    });
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: mutating the on-disk package after the hash was shown aborts and never records a decision", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      const path = writePackage(cycleDir, pkg);
      const shownHash = computeContentHash(pkg);

      // Mutate the file on disk after the hash was captured/shown, before
      // decision submission — e.g. a malicious or buggy process editing
      // the non-authoritative recommendation to look more favorable.
      const mutated = { ...pkg, nonAuthoritativeRecommendation: pkg.nonAuthoritativeRecommendation + " (mutated after render)" };
      writeFileSync(path, JSON.stringify(mutated, null, 2), "utf8");

      const outcome = submitHumanGateDecision(path, {
        packageId: pkg.packageId,
        contentHash: shownHash,
        baseGitSha: pkg.baseGitSha,
        actor: "owner@example.invalid",
        canonicalAcceptance: "APPROVE",
        publicExplorerPublication: "APPROVE",
      });

      assert.equal(outcome.status, "ABORTED_CONTENT_MISMATCH");
    });
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: a decision submitted with a hash for a different package is rejected as content mismatch", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      const path = writePackage(cycleDir, pkg);

      const outcome = submitHumanGateDecision(path, {
        packageId: pkg.packageId,
        contentHash: "0".repeat(64),
        baseGitSha: pkg.baseGitSha,
        actor: "owner@example.invalid",
        canonicalAcceptance: "APPROVE",
        publicExplorerPublication: "APPROVE",
      });

      assert.equal(outcome.status, "ABORTED_CONTENT_MISMATCH");
    });
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: a decision claiming a different packageId than what is on disk is rejected", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      const path = writePackage(cycleDir, pkg);
      const shownHash = computeContentHash(pkg);

      const outcome = submitHumanGateDecision(path, {
        packageId: "RCS-deadbeefdeadbeef",
        contentHash: shownHash,
        baseGitSha: pkg.baseGitSha,
        actor: "owner@example.invalid",
        canonicalAcceptance: "APPROVE",
        publicExplorerPublication: "APPROVE",
      });

      assert.equal(outcome.status, "ABORTED_CONTENT_MISMATCH");
    });
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: a decision claiming a stale baseGitSha is rejected", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      const path = writePackage(cycleDir, pkg);
      const shownHash = computeContentHash(pkg);

      const outcome = submitHumanGateDecision(path, {
        packageId: pkg.packageId,
        contentHash: shownHash,
        baseGitSha: "1".repeat(40),
        actor: "owner@example.invalid",
        canonicalAcceptance: "APPROVE",
        publicExplorerPublication: "APPROVE",
      });

      assert.equal(outcome.status, "ABORTED_CONTENT_MISMATCH");
    });
  } finally {
    fixture.cleanup();
  }
});

test("malformed/invalid package JSON on disk aborts decision submission", () => {
  withTempDir((cycleDir) => {
    const path = join(cycleDir, "human-gate-package.json");
    writeFileSync(path, "{ this is not valid json", "utf8");

    const outcome = submitHumanGateDecision(path, {
      packageId: "RCS-deadbeefdeadbeef",
      contentHash: "0".repeat(64),
      baseGitSha: "1".repeat(40),
      actor: "owner@example.invalid",
      canonicalAcceptance: "APPROVE",
      publicExplorerPublication: "APPROVE",
    });

    assert.equal(outcome.status, "ABORTED_INVALID_PACKAGE");
  });
});

test("structurally invalid (schema-violating) package JSON aborts decision submission", () => {
  withTempDir((cycleDir) => {
    const path = join(cycleDir, "human-gate-package.json");
    writeFileSync(path, JSON.stringify({ schemaVersion: "1" }), "utf8");

    const outcome = submitHumanGateDecision(path, {
      packageId: "RCS-deadbeefdeadbeef",
      contentHash: "0".repeat(64),
      baseGitSha: "1".repeat(40),
      actor: "owner@example.invalid",
      canonicalAcceptance: "APPROVE",
      publicExplorerPublication: "APPROVE",
    });

    assert.equal(outcome.status, "ABORTED_INVALID_PACKAGE");
  });
});

test("HOLD canonical + APPROVE publication is an invalid combination", () => {
  assert.equal(isValidDecisionCombination("HOLD_MORE_RESEARCH", "APPROVE"), false);
});

test("REJECT canonical + APPROVE publication is an invalid combination", () => {
  assert.equal(isValidDecisionCombination("REJECT", "APPROVE"), false);
});

test("APPROVE canonical + HOLD publication is a valid combination (private-hold path)", () => {
  assert.equal(isValidDecisionCombination("APPROVE", "HOLD"), true);
});

test("APPROVE canonical + REJECT publication is a valid combination", () => {
  assert.equal(isValidDecisionCombination("APPROVE", "REJECT"), true);
});

test("APPROVE canonical + APPROVE publication is the normal-path combined action", () => {
  assert.equal(isValidDecisionCombination("APPROVE", "APPROVE"), true);
});

test("an invalid canonical-acceptance/publication combination is rejected before any file is read (fails closed early)", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      const path = writePackage(cycleDir, pkg);
      const shownHash = computeContentHash(pkg);

      const outcome = submitHumanGateDecision(path, {
        packageId: pkg.packageId,
        contentHash: shownHash,
        baseGitSha: pkg.baseGitSha,
        actor: "owner@example.invalid",
        canonicalAcceptance: "REJECT",
        publicExplorerPublication: "APPROVE",
      });

      assert.equal(outcome.status, "REJECTED_INVALID_COMBINATION");
    });
  } finally {
    fixture.cleanup();
  }
});

test("an empty/whitespace actor is rejected", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      const path = writePackage(cycleDir, pkg);
      const shownHash = computeContentHash(pkg);

      const outcome = submitHumanGateDecision(path, {
        packageId: pkg.packageId,
        contentHash: shownHash,
        baseGitSha: pkg.baseGitSha,
        actor: "   ",
        canonicalAcceptance: "APPROVE",
        publicExplorerPublication: "APPROVE",
      });

      assert.equal(outcome.status, "ABORTED_INVALID_PACKAGE");
    });
  } finally {
    fixture.cleanup();
  }
});

test("REJECT canonical decision is recorded and never treated as approval", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      const path = writePackage(cycleDir, pkg);
      const shownHash = computeContentHash(pkg);

      const outcome = submitHumanGateDecision(path, {
        packageId: pkg.packageId,
        contentHash: shownHash,
        baseGitSha: pkg.baseGitSha,
        actor: "owner@example.invalid",
        canonicalAcceptance: "REJECT",
        publicExplorerPublication: "REJECT",
      });

      assert.equal(outcome.status, "RECORDED");
      if (outcome.status !== "RECORDED") return;
      assert.equal(outcome.record.canonicalAcceptance, "REJECT");
    });
  } finally {
    fixture.cleanup();
  }
});

test("HOLD_MORE_RESEARCH canonical decision is recorded and never treated as approval", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      const path = writePackage(cycleDir, pkg);
      const shownHash = computeContentHash(pkg);

      const outcome = submitHumanGateDecision(path, {
        packageId: pkg.packageId,
        contentHash: shownHash,
        baseGitSha: pkg.baseGitSha,
        actor: "owner@example.invalid",
        canonicalAcceptance: "HOLD_MORE_RESEARCH",
        publicExplorerPublication: "HOLD",
      });

      assert.equal(outcome.status, "RECORDED");
      if (outcome.status !== "RECORDED") return;
      assert.equal(outcome.record.canonicalAcceptance, "HOLD_MORE_RESEARCH");
    });
  } finally {
    fixture.cleanup();
  }
});

test("re-reading the same unmutated file twice always yields the same recorded contentHash (no hidden nondeterminism)", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      const path = writePackage(cycleDir, pkg);
      const shownHash = computeContentHash(pkg);

      const first = submitHumanGateDecision(path, {
        packageId: pkg.packageId, contentHash: shownHash, baseGitSha: pkg.baseGitSha,
        actor: "a", canonicalAcceptance: "APPROVE", publicExplorerPublication: "APPROVE",
      });
      const second = submitHumanGateDecision(path, {
        packageId: pkg.packageId, contentHash: shownHash, baseGitSha: pkg.baseGitSha,
        actor: "a", canonicalAcceptance: "APPROVE", publicExplorerPublication: "APPROVE",
      });
      assert.equal(first.status, "RECORDED");
      assert.equal(second.status, "RECORDED");
      if (first.status === "RECORDED" && second.status === "RECORDED") {
        assert.equal(first.record.contentHash, second.record.contentHash);
      }
    });
  } finally {
    fixture.cleanup();
  }
});
