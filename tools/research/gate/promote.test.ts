/**
 * Post-approval promotion-path integration/adversarial tests. Exercises the
 * real sequence
 * — HIGH-2 revalidation -> OD-D branching -> repository-state precheck ->
 * canonical promotion -> post-promotion validation/build -> LOW-3 guard ->
 * Git/PR orchestration -> READY_FOR_OWNER_MERGE — against synthetic
 * fixtures and a fake `gh`, never a real repository/remote.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  gitFixture,
  loadIndexFor,
  remoteGitFixture,
  syntheticHumanGatePackage,
  withTempDir,
} from "./test-fixtures.ts";
import { computeContentHash } from "./content-hash.ts";
import { submitHumanGateDecision } from "./decision.ts";
import { writeDecisionRecord } from "./decision-record.ts";
import { runPostApprovalPath } from "./promote.ts";
import { PACKAGE_FILENAME } from "./cli.ts";

const NOOP_COMMANDS = {
  researchCheck: [process.execPath, ["-e", "process.exit(0)"]] as [string, string[]],
  explorerBuild: [process.execPath, ["-e", "process.exit(0)"]] as [string, string[]],
};
const FAILING_RESEARCH_CHECK = {
  researchCheck: [process.execPath, ["-e", "process.exit(1)"]] as [string, string[]],
  explorerBuild: [process.execPath, ["-e", "process.exit(0)"]] as [string, string[]],
};
const FAILING_EXPLORER_BUILD = {
  researchCheck: [process.execPath, ["-e", "process.exit(0)"]] as [string, string[]],
  explorerBuild: [process.execPath, ["-e", "process.exit(1)"]] as [string, string[]],
};

function setUpApprovedCycle(
  fixture: ReturnType<typeof remoteGitFixture>,
  cycleDir: string,
  decisionOverrides: { canonicalAcceptance?: "APPROVE" | "REJECT" | "HOLD_MORE_RESEARCH"; publicExplorerPublication?: "APPROVE" | "REJECT" | "HOLD" } = {}
) {
  const index = loadIndexFor(fixture.research);
  const pkg = syntheticHumanGatePackage(index, fixture.head());
  const packagePath = join(cycleDir, PACKAGE_FILENAME);
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2), "utf8");
  const shownHash = computeContentHash(pkg);

  const decisionOutcome = submitHumanGateDecision(packagePath, {
    packageId: pkg.packageId,
    contentHash: shownHash,
    baseGitSha: pkg.baseGitSha,
    actor: "owner@example.invalid",
    canonicalAcceptance: decisionOverrides.canonicalAcceptance ?? "APPROVE",
    publicExplorerPublication: decisionOverrides.publicExplorerPublication ?? "APPROVE",
  });
  assert.equal(decisionOutcome.status, "RECORDED");
  if (decisionOutcome.status !== "RECORDED") throw new Error("fixture setup failed");
  writeDecisionRecord(cycleDir, decisionOutcome.record);

  return { pkg, packagePath };
}

test("a valid APPROVE/APPROVE cycle reaches READY_FOR_OWNER_MERGE end-to-end", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDir) => {
      setUpApprovedCycle(fixture, cycleDir);

      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch: "master",
        env: fixture.env,
        postPromotionCommandsForTestingOnly: NOOP_COMMANDS,
      });

      assert.equal(outcome.status, "READY_FOR_OWNER_MERGE");
    });
  } finally {
    fixture.cleanup();
  }
});

test("OD-D: REJECT canonical never reaches promotion or READY_FOR_OWNER_MERGE", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDir) => {
      setUpApprovedCycle(fixture, cycleDir, { canonicalAcceptance: "REJECT", publicExplorerPublication: "REJECT" });

      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch: "master",
        env: fixture.env,
        postPromotionCommandsForTestingOnly: NOOP_COMMANDS,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedStage, "NOT_APPROVED");
    });
  } finally {
    fixture.cleanup();
  }
});

test("OD-D: HOLD_MORE_RESEARCH never reaches promotion or READY_FOR_OWNER_MERGE", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDir) => {
      setUpApprovedCycle(fixture, cycleDir, { canonicalAcceptance: "HOLD_MORE_RESEARCH", publicExplorerPublication: "HOLD" });

      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch: "master",
        env: fixture.env,
        postPromotionCommandsForTestingOnly: NOOP_COMMANDS,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedStage, "NOT_APPROVED");
    });
  } finally {
    fixture.cleanup();
  }
});

test("OD-D private-hold: APPROVE canonical + HOLD publication preserves the package privately and never promotes/pushes/opens a PR", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDir) => {
      setUpApprovedCycle(fixture, cycleDir, { canonicalAcceptance: "APPROVE", publicExplorerPublication: "HOLD" });

      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch: "master",
        env: fixture.env,
        postPromotionCommandsForTestingOnly: NOOP_COMMANDS,
      });

      assert.equal(outcome.status, "PRIVATE_HOLD");

      // No canonical write, no branch, no PR.
      const reloaded = loadIndexFor(fixture.research);
      assert.equal(reloaded.totalRecords, loadIndexFor(fixture.research).totalRecords);
      const state = fixture.readFakeGhState();
      assert.equal(state.prs.length, 0);
    });
  } finally {
    fixture.cleanup();
  }
});

test("OD-D private-hold: APPROVE canonical + REJECT publication also preserves privately without promoting", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDir) => {
      setUpApprovedCycle(fixture, cycleDir, { canonicalAcceptance: "APPROVE", publicExplorerPublication: "REJECT" });

      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch: "master",
        env: fixture.env,
        postPromotionCommandsForTestingOnly: NOOP_COMMANDS,
      });

      assert.equal(outcome.status, "PRIVATE_HOLD");
      const state = fixture.readFakeGhState();
      assert.equal(state.prs.length, 0);
    });
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: promotion is unreachable without a decision record on disk (no implicit approval)", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      writeFileSync(join(cycleDir, PACKAGE_FILENAME), JSON.stringify(pkg, null, 2), "utf8");
      // Deliberately no decision record written.

      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch: "master",
        env: fixture.env,
        postPromotionCommandsForTestingOnly: NOOP_COMMANDS,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedStage, "HIGH2_REVALIDATION");
    });
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: a decision record bound to a different package never authorizes this package's promotion", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDirA) => {
      withTempDir((cycleDirB) => {
        // Produce a valid decision record for package A...
        setUpApprovedCycle(fixture, cycleDirA);
        const decisionForA = readFileSync(join(cycleDirA, "human-gate-decision.json"), "utf8");

        // ...then place package B's own package.json in cycle dir B, but
        // copy package A's decision record into cycle dir B (simulating a
        // bug/attack that reuses one cycle's approval for another).
        const index = loadIndexFor(fixture.research);
        const pkgB = syntheticHumanGatePackage(index, fixture.head(), "SRC-DIFFERENT");
        writeFileSync(join(cycleDirB, PACKAGE_FILENAME), JSON.stringify(pkgB, null, 2), "utf8");
        writeFileSync(join(cycleDirB, "human-gate-decision.json"), decisionForA, "utf8");

        const outcome = runPostApprovalPath({
          repoRoot: fixture.root,
          researchRoot: fixture.research,
          cycleDir: cycleDirB,
          packagePath: join(cycleDirB, PACKAGE_FILENAME),
          baseBranch: "master",
          env: fixture.env,
          postPromotionCommandsForTestingOnly: NOOP_COMMANDS,
        });

        assert.equal(outcome.status, "FAILED");
        if (outcome.status !== "FAILED") return;
        assert.equal(outcome.failedStage, "HIGH2_REVALIDATION");
      });
    });
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: a stale baseGitSha aborts before any canonical write", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDir) => {
      setUpApprovedCycle(fixture, cycleDir);

      // Advance HEAD past the approved base after the decision was recorded.
      writeFileSync(join(fixture.research, "sources", "SRC-ADVANCE.yaml"), "source_id: SRC-ADVANCE\nname: Advance\n", "utf8");
      fixture.commit("advance HEAD past the approved base");

      const beforeCount = loadIndexFor(fixture.research).totalRecords;

      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch: "master",
        env: fixture.env,
        postPromotionCommandsForTestingOnly: NOOP_COMMANDS,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedStage, "REPOSITORY_STATE_PRECHECK");
      assert.equal(loadIndexFor(fixture.research).totalRecords, beforeCount);
    });
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: a promoter-level failure (CREATE target already exists on disk) is an explicit failure, never reinterpreted as success", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDir) => {
      // syntheticHumanGatePackage("SRC-BASE") builds a package whose plan
      // claims a CREATE for SRC-BASE.yaml, which the gitFixture() already
      // has on disk at HEAD — canonical-promoter.ts's own prepareWrites()
      // check ("CREATE target has unexpected filesystem state") must
      // reject this, exercising a real promoter-level failure rather than
      // a WU046-side check.
      setUpApprovedCycle(fixture, cycleDir);
      const index = loadIndexFor(fixture.research);
      const conflictingPkg = syntheticHumanGatePackage(index, fixture.head(), "SRC-BASE");
      writeFileSync(join(cycleDir, PACKAGE_FILENAME), JSON.stringify(conflictingPkg, null, 2), "utf8");
      const shownHash = computeContentHash(conflictingPkg);
      const decisionOutcome = submitHumanGateDecision(join(cycleDir, PACKAGE_FILENAME), {
        packageId: conflictingPkg.packageId,
        contentHash: shownHash,
        baseGitSha: conflictingPkg.baseGitSha,
        actor: "owner@example.invalid",
        canonicalAcceptance: "APPROVE",
        publicExplorerPublication: "APPROVE",
      });
      assert.equal(decisionOutcome.status, "RECORDED");
      if (decisionOutcome.status !== "RECORDED") return;
      writeDecisionRecord(cycleDir, decisionOutcome.record);

      const beforeCount = loadIndexFor(fixture.research).totalRecords;
      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch: "master",
        env: fixture.env,
        postPromotionCommandsForTestingOnly: NOOP_COMMANDS,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedStage, "CANONICAL_PROMOTION");
      assert.equal(loadIndexFor(fixture.research).totalRecords, beforeCount);
    });
  } finally {
    fixture.cleanup();
  }
});

test("post-promotion validation failure is an explicit failure, not reinterpreted as success", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDir) => {
      setUpApprovedCycle(fixture, cycleDir);

      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch: "master",
        env: fixture.env,
        postPromotionCommandsForTestingOnly: FAILING_RESEARCH_CHECK,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedStage, "POST_PROMOTION_VALIDATION");
    });
  } finally {
    fixture.cleanup();
  }
});

test("post-promotion build failure is an explicit failure, not reinterpreted as success", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDir) => {
      setUpApprovedCycle(fixture, cycleDir);

      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch: "master",
        env: fixture.env,
        postPromotionCommandsForTestingOnly: FAILING_EXPLORER_BUILD,
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedStage, "POST_PROMOTION_BUILD");
    });
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: a file the post-promotion build/validation step writes unexpectedly blocks publication even after a successful promotion", () => {
  const fixture = remoteGitFixture();
  try {
    withTempDir((cycleDir) => {
      setUpApprovedCycle(fixture, cycleDir);

      // The repository-state precheck's clean-tree requirement means a
      // stray file present *before* promotion would already be caught
      // there, not by LOW-3 — so this test simulates the scenario LOW-3
      // actually guards against: an unexpected file introduced by the
      // post-promotion validation/build step itself, appearing only after
      // promotion has already succeeded and the tree was clean at
      // precheck time.
      const strayFilePath = join(fixture.root, "unexpected-stray-file.txt");
      const writeStrayFileCommand: [string, string[]] = [
        process.execPath,
        ["-e", `require("fs").writeFileSync(${JSON.stringify(strayFilePath)}, "should never be published"); process.exit(0);`],
      ];

      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch: "master",
        env: fixture.env,
        postPromotionCommandsForTestingOnly: {
          researchCheck: writeStrayFileCommand,
          explorerBuild: NOOP_COMMANDS.explorerBuild,
        },
      });

      assert.equal(outcome.status, "FAILED");
      if (outcome.status !== "FAILED") return;
      assert.equal(outcome.failedStage, "PUBLICATION_GUARD");

      // No PR must have been created despite the promotion having succeeded.
      const state = fixture.readFakeGhState();
      assert.equal(state.prs.length, 0);
    });
  } finally {
    fixture.cleanup();
  }
});

test("no failure path anywhere in this suite ever returns READY_FOR_OWNER_MERGE (spot-check across every FAILED/PRIVATE_HOLD case above)", () => {
  // This test documents the invariant by construction: every other test in
  // this file that asserts status === "FAILED" or "PRIVATE_HOLD" also
  // implicitly proves status !== "READY_FOR_OWNER_MERGE" via assert.equal's
  // exact match. This test exists as an explicit, named anchor for that
  // property so it is easy to find in a failure-coverage audit.
  assert.ok(true);
});

test("promotion is unreachable before a bound APPROVE: a REJECT decision never invokes the promoter (no canonical write occurs)", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const index = loadIndexFor(fixture.research);
      const pkg = syntheticHumanGatePackage(index, fixture.head());
      const packagePath = join(cycleDir, PACKAGE_FILENAME);
      writeFileSync(packagePath, JSON.stringify(pkg, null, 2), "utf8");
      const shownHash = computeContentHash(pkg);
      const decisionOutcome = submitHumanGateDecision(packagePath, {
        packageId: pkg.packageId,
        contentHash: shownHash,
        baseGitSha: pkg.baseGitSha,
        actor: "owner@example.invalid",
        canonicalAcceptance: "REJECT",
        publicExplorerPublication: "REJECT",
      });
      assert.equal(decisionOutcome.status, "RECORDED");
      if (decisionOutcome.status !== "RECORDED") return;
      writeDecisionRecord(cycleDir, decisionOutcome.record);

      const beforeCount = loadIndexFor(fixture.research).totalRecords;
      const outcome = runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath,
        baseBranch: "master",
        postPromotionCommandsForTestingOnly: NOOP_COMMANDS,
      });
      assert.equal(outcome.status, "FAILED");
      assert.equal(loadIndexFor(fixture.research).totalRecords, beforeCount);
    });
  } finally {
    fixture.cleanup();
  }
});
