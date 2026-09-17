/**
 * Approval/content-hash binding adversarial tests plus invalid
 * decision-combination coverage (failure-state coverage list:
 * "malformed/invalid RCS", "changed RCS after review rendering", "changed
 * contentHash", "invalid OD-D decision combination").
 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { gitFixture, loadIndexFor, syntheticHumanGatePackage, withTempDir } from "./test-fixtures.ts";
import { computeContentHash } from "./content-hash.ts";
import { isValidDecisionCombination, submitHumanGateDecision } from "./decision.ts";

function writePackage(cycleDir: string, pkg: unknown): string {
  const path = join(cycleDir, "human-gate-package.json");
  writeFileSync(path, JSON.stringify(pkg, null, 2), "utf8");
  return path;
}

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

test("OD-D: HOLD canonical + APPROVE publication is an invalid combination", () => {
  assert.equal(isValidDecisionCombination("HOLD_MORE_RESEARCH", "APPROVE"), false);
});

test("OD-D: REJECT canonical + APPROVE publication is an invalid combination", () => {
  assert.equal(isValidDecisionCombination("REJECT", "APPROVE"), false);
});

test("OD-D: APPROVE canonical + HOLD publication is a valid combination (private-hold path)", () => {
  assert.equal(isValidDecisionCombination("APPROVE", "HOLD"), true);
});

test("OD-D: APPROVE canonical + REJECT publication is a valid combination", () => {
  assert.equal(isValidDecisionCombination("APPROVE", "REJECT"), true);
});

test("OD-D: APPROVE canonical + APPROVE publication is the normal-path combined action", () => {
  assert.equal(isValidDecisionCombination("APPROVE", "APPROVE"), true);
});

test("invalid OD-D combination is rejected before any file is read (fails closed early)", () => {
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
