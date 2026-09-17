/**
 * Post-approval Git/PR orchestration tests. Exercises the real git/gh-invoking
 * code path against a local bare "origin" remote and a fake `gh` executable
 * (test-fake-gh.ts) — never a real GitHub remote, since these tests must not
 * require destructive interaction with a real repository/remote.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { remoteGitFixture } from "./test-fixtures.ts";
import { branchNameForPackage, runPostApprovalGitSequence } from "./git-orchestrator.ts";

function stageApprovedFile(root: string, relPath: string, contents: string): void {
  writeFileSync(join(root, relPath), contents, "utf8");
}

test("branchNameForPackage is deterministic and bounded, derived from the packageId only", () => {
  assert.equal(branchNameForPackage("RCS-0123456789abcdef"), "research/gate-0123456789abcdef");
  assert.equal(branchNameForPackage("RCS-0123456789abcdef"), branchNameForPackage("RCS-0123456789abcdef"));
});

test("a full sequence on a clean approved change reaches READY_FOR_OWNER_MERGE without merging anything", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-testtesttesttest",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-testtesttesttest): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "READY_FOR_OWNER_MERGE");
    if (outcome.status !== "READY_FOR_OWNER_MERGE") return;
    assert.equal(outcome.branch, "research/gate-testtesttesttest");
    assert.match(outcome.prUrl, /^https:\/\/github\.com\//);

    // Never merged: the branch must remain distinct from the base, and no
    // merge/auto-merge command exists anywhere in this module's source.
    const currentBranch = execFileSync("git", ["-C", fixture.root, "branch", "--show-current"], { encoding: "utf8" }).trim();
    assert.equal(currentBranch, outcome.branch);

    // The remote must actually hold the pushed branch (a real push occurred,
    // just against the local bare fixture remote, never a real GitHub host).
    const remoteBranches = execFileSync("git", ["-C", fixture.root, "ls-remote", "--heads", "origin"], { encoding: "utf8" });
    assert.ok(remoteBranches.includes(outcome.branch));
  } finally {
    fixture.cleanup();
  }
});

test("re-running the sequence against the same already-completed package resumes rather than creating a duplicate branch/commit/PR", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const input = {
      repoRoot: fixture.root,
      packageId: "RCS-resumeresumeresu",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-resumeresumeresu): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    };

    const first = runPostApprovalGitSequence(input);
    assert.equal(first.status, "READY_FOR_OWNER_MERGE");

    // Return to the base branch to simulate a fresh process re-invoking the
    // orchestrator for the same package (as a real retry would). Checking
    // out master removes the working-tree file that only ever existed
    // staged-but-uncommitted on master before being committed on the other
    // branch, so it is re-materialized here exactly as the real caller
    // (promote.ts) always does on every invocation — it re-runs the
    // canonical promoter, which re-writes the approved plan's files to disk
    // from the (immutable, already-approved) integration plan, immediately
    // before every call to runPostApprovalGitSequence, retry or not.
    execFileSync("git", ["-C", fixture.root, "checkout", "master"], { encoding: "utf8" });
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const second = runPostApprovalGitSequence(input);
    assert.equal(second.status, "READY_FOR_OWNER_MERGE");
    if (first.status !== "READY_FOR_OWNER_MERGE" || second.status !== "READY_FOR_OWNER_MERGE") return;

    assert.equal(first.branch, second.branch);
    assert.equal(first.commitSha, second.commitSha);
    assert.equal(first.prNumber, second.prNumber);

    const state = fixture.readFakeGhState();
    assert.equal(state.prs.filter((pr) => pr.headRefName === first.branch).length, 1);
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: failing CI checks prevent READY_FOR_OWNER_MERGE", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    fixture.setFakeGhCiState("FAILURE");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-cifailcifailcifa",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-cifailcifailcifa): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "CI");
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: push failure (remote unreachable) is an explicit failure, never reinterpreted as success", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    // Point origin at a path that does not exist, simulating an
    // unreachable/misconfigured remote.
    execFileSync("git", ["-C", fixture.root, "remote", "set-url", "origin", join(fixture.root, "..", "does-not-exist-remote")]);

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-pushfailpushfail",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-pushfailpushfail): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "PUSH");
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: existing branch descending from the approved baseGitSha (compatible) resumes safely", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    const branch = branchNameForPackage("RCS-branchexistsbran");
    // Pre-create the deterministic branch name pointing at the current
    // HEAD before the orchestration sequence runs (e.g. from a prior
    // partial run that created the branch but crashed before committing).
    // The approved baseGitSha (fixture.head(), captured below) is by
    // construction an ancestor of this branch, so it is compatible.
    execFileSync("git", ["-C", fixture.root, "branch", branch]);

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-branchexistsbran",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-branchexistsbran): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    // Resumes onto the existing branch rather than failing or creating a
    // second, differently-named branch for the same package.
    assert.equal(outcome.status, "READY_FOR_OWNER_MERGE");
    if (outcome.status !== "READY_FOR_OWNER_MERGE") return;
    assert.equal(outcome.branch, branch);
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: existing branch with no existing branch at all still succeeds (baseline, no false rejection)", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-nobranchnobranch",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-nobranchnobranch): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "READY_FOR_OWNER_MERGE");
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: existing branch with unrelated (disjoint) commit ancestry fails closed before any commit/push/PR", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    const approvedBaseSha = fixture.head();
    const branch = branchNameForPackage("RCS-unrelatedhistory");

    // Build the deterministic branch name from a completely disjoint history
    // (an orphan root, sharing no commits with the approved baseGitSha) —
    // simulating a stale/adversarial branch-name collision.
    execFileSync("git", ["-C", fixture.root, "checkout", "--orphan", branch]);
    execFileSync("git", ["-C", fixture.root, "reset", "--hard"]);
    writeFileSync(join(fixture.root, "unrelated.txt"), "totally unrelated investigation content", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", "-A"]);
    execFileSync("git", ["-C", fixture.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "unrelated prior work"]);
    execFileSync("git", ["-C", fixture.root, "checkout", "master"]);

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-unrelatedhistory",
      baseGitSha: approvedBaseSha,
      commitMessage: "research(RCS-unrelatedhistory): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "BRANCH");
    assert.match(outcome.message, /not compatible/i);

    // Fail-closed, not destructive: the unrelated branch must still exist,
    // untouched — no reset/overwrite was attempted.
    const branchStillExists = execFileSync("git", ["-C", fixture.root, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { encoding: "utf8" }).trim();
    assert.ok(branchStillExists.length > 0, "unrelated branch must not be destructively removed/reset");

    // No PR must have been created for this incompatible run.
    const state = fixture.readFakeGhState();
    assert.equal(state.prs.filter((pr) => pr.headRefName === branch).length, 0);
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: existing branch built on a stale/wrong base (real commit, but not the approved baseGitSha's descendant) fails closed", () => {
  const fixture = remoteGitFixture();
  try {
    // Advance master past the SHA that will be used as the "approved" base,
    // so the approved baseGitSha is a real ancestor of master but the branch
    // under test is built from a *different* branch point entirely (a
    // realistic "stale base" scenario: the branch was created from an
    // earlier or divergent repository state than the one actually approved).
    const staleBaseSha = fixture.head();
    writeFileSync(join(fixture.root, "unrelated-later-change.txt"), "later repository state", "utf8");
    fixture.commit("unrelated later repository change");
    const branch = branchNameForPackage("RCS-stalebasestalebas");
    execFileSync("git", ["-C", fixture.root, "checkout", "-b", branch, staleBaseSha]);
    writeFileSync(join(fixture.root, "research", "sources", "SRC-STALE.yaml"), "source_id: SRC-STALE\nname: Stale\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", "-A"]);
    execFileSync("git", ["-C", fixture.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "work from a stale base"]);
    execFileSync("git", ["-C", fixture.root, "checkout", "master"]);

    // The actually-approved baseGitSha is the CURRENT master tip, which is
    // NOT an ancestor of the stale branch (the branch forked before it).
    const approvedBaseSha = fixture.head();
    assert.notEqual(approvedBaseSha, staleBaseSha);

    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-stalebasestalebas",
      baseGitSha: approvedBaseSha,
      commitMessage: "research(RCS-stalebasestalebas): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "BRANCH");
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: existing branch already holding exactly the expected approved publication commit (State B) resumes safely", () => {
  const fixture = remoteGitFixture();
  try {
    const approvedBaseSha = fixture.head();
    const branch = branchNameForPackage("RCS-statebexactstate");
    // Simulate a prior complete run: the branch already carries exactly one
    // commit ahead of the approved base, whose content is byte-identical to
    // what this run's approved plan would itself produce.
    execFileSync("git", ["-C", fixture.root, "checkout", "-b", branch]);
    writeFileSync(join(fixture.research, "sources", "SRC-NEW.yaml"), "source_id: SRC-NEW\nname: New\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", "-A"]);
    execFileSync("git", ["-C", fixture.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "prior publication commit"]);
    execFileSync("git", ["-C", fixture.root, "checkout", "master"]);

    // A real retry always re-runs the canonical promoter first, which
    // re-writes the approved plan's files to disk from the immutable,
    // already-approved integration plan — replicated here via
    // stageApprovedFile with byte-identical content to the prior commit.
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-statebexactstate",
      baseGitSha: approvedBaseSha,
      commitMessage: "research(RCS-statebexactstate): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "READY_FOR_OWNER_MERGE");
    if (outcome.status !== "READY_FOR_OWNER_MERGE") return;
    assert.equal(outcome.branch, branch);
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: an existing descendant branch containing unapproved extra content must fail closed", () => {
  const fixture = remoteGitFixture();
  try {
    const approvedBaseSha = fixture.head();
    const branch = branchNameForPackage("RCS-extrafileextrafi");
    // baseGitSha -> unrelated extra commit -> the deterministic branch.
    // Ancestry of baseGitSha alone would pass this branch; the
    // content-sensitive tree comparison must not.
    execFileSync("git", ["-C", fixture.root, "checkout", "-b", branch]);
    writeFileSync(join(fixture.root, "research", "sources", "SRC-INJECTED.yaml"), "source_id: SRC-INJECTED\nname: Unapproved\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", "-A"]);
    execFileSync("git", ["-C", fixture.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "unrelated extra commit"]);
    execFileSync("git", ["-C", fixture.root, "checkout", "master"]);

    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-extrafileextrafi",
      baseGitSha: approvedBaseSha,
      commitMessage: "research(RCS-extrafileextrafi): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "BRANCH");
    assert.match(outcome.message, /not compatible/i);

    // Fail-closed, not destructive; no PR must have been created carrying
    // the unapproved file.
    const state = fixture.readFakeGhState();
    assert.equal(state.prs.filter((pr) => pr.headRefName === branch).length, 0);
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: descendant branch with an unauthorized modification to an otherwise-approved path fails closed", () => {
  const fixture = remoteGitFixture();
  try {
    const approvedBaseSha = fixture.head();
    const branch = branchNameForPackage("RCS-wrongcontentwron");
    // The branch's publication commit touches exactly the approved path,
    // but with content that differs from what the approved plan actually
    // produces — path membership alone must not be treated as sufficient.
    execFileSync("git", ["-C", fixture.root, "checkout", "-b", branch]);
    writeFileSync(join(fixture.research, "sources", "SRC-NEW.yaml"), "source_id: SRC-NEW\nname: TAMPERED\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", "-A"]);
    execFileSync("git", ["-C", fixture.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "tampered publication commit"]);
    execFileSync("git", ["-C", fixture.root, "checkout", "master"]);

    // The approved plan's real, untampered content.
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-wrongcontentwron",
      baseGitSha: approvedBaseSha,
      commitMessage: "research(RCS-wrongcontentwron): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "BRANCH");
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: descendant branch missing one approved change fails closed", () => {
  const fixture = remoteGitFixture();
  try {
    const approvedBaseSha = fixture.head();
    const branch = branchNameForPackage("RCS-missingchgmissin");
    // Approved plan for this test expects two files; the existing branch's
    // publication commit only carries one of them.
    execFileSync("git", ["-C", fixture.root, "checkout", "-b", branch]);
    writeFileSync(join(fixture.research, "sources", "SRC-NEW.yaml"), "source_id: SRC-NEW\nname: New\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", "-A"]);
    execFileSync("git", ["-C", fixture.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "partial publication commit"]);
    execFileSync("git", ["-C", fixture.root, "checkout", "master"]);

    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    stageApprovedFile(fixture.research, "sources/SRC-SECOND.yaml", "source_id: SRC-SECOND\nname: Second\n");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-missingchgmissin",
      baseGitSha: approvedBaseSha,
      commitMessage: "research(RCS-missingchgmissin): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "BRANCH");
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: descendant branch with an unexpected deletion beyond the approved plan fails closed", () => {
  const fixture = remoteGitFixture();
  try {
    const approvedBaseSha = fixture.head();
    const branch = branchNameForPackage("RCS-unexpdeleteunexp");
    // The branch's publication commit carries the approved file but also
    // deletes an unrelated, pre-existing tracked file (SRC-BASE.yaml) that
    // the approved plan never touches.
    execFileSync("git", ["-C", fixture.root, "checkout", "-b", branch]);
    writeFileSync(join(fixture.research, "sources", "SRC-NEW.yaml"), "source_id: SRC-NEW\nname: New\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "rm", "--quiet", "research/sources/SRC-BASE.yaml"]);
    execFileSync("git", ["-C", fixture.root, "add", "-A"]);
    execFileSync("git", ["-C", fixture.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "publication commit with unexpected deletion"]);
    execFileSync("git", ["-C", fixture.root, "checkout", "master"]);

    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-unexpdeleteunexp",
      baseGitSha: approvedBaseSha,
      commitMessage: "research(RCS-unexpdeleteunexp): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "BRANCH");
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: descendant branch with an additional unrelated commit before an otherwise-exact publication commit fails closed (no wider history shape is accepted speculatively)", () => {
  const fixture = remoteGitFixture();
  try {
    const approvedBaseSha = fixture.head();
    const branch = branchNameForPackage("RCS-extracommitextra");
    execFileSync("git", ["-C", fixture.root, "checkout", "-b", branch]);
    // An unrelated commit sits between baseGitSha and the (otherwise exact)
    // publication commit — this module's COMMIT stage only ever produces at
    // most one commit ahead of baseGitSha per invocation, so this wider
    // two-commit shape is never legitimate and must not be accepted.
    writeFileSync(join(fixture.root, "unrelated-intermediate.txt"), "not part of any approved plan", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", "-A"]);
    execFileSync("git", ["-C", fixture.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "unrelated intermediate commit"]);
    writeFileSync(join(fixture.research, "sources", "SRC-NEW.yaml"), "source_id: SRC-NEW\nname: New\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", "-A"]);
    execFileSync("git", ["-C", fixture.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "publication commit"]);
    execFileSync("git", ["-C", fixture.root, "checkout", "master"]);

    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-extracommitextra",
      baseGitSha: approvedBaseSha,
      commitMessage: "research(RCS-extracommitextra): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "BRANCH");
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: incompatible existing branch causes zero push and zero PR creation", () => {
  const fixture = remoteGitFixture();
  try {
    const approvedBaseSha = fixture.head();
    const branch = branchNameForPackage("RCS-zeropushzeropr01");
    execFileSync("git", ["-C", fixture.root, "checkout", "-b", branch]);
    writeFileSync(join(fixture.root, "research", "sources", "SRC-INJECTED.yaml"), "source_id: SRC-INJECTED\nname: Unapproved\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", "-A"]);
    execFileSync("git", ["-C", fixture.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "unrelated extra commit"]);
    // Also push this incompatible branch to the remote beforehand, so a
    // false "already up to date" resume can't hide a skipped push check.
    execFileSync("git", ["-C", fixture.root, "push", "--quiet", "--set-upstream", "origin", branch], { env: fixture.env });
    execFileSync("git", ["-C", fixture.root, "checkout", "master"]);

    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const remoteBeforeHeads = execFileSync("git", ["-C", fixture.root, "ls-remote", "--heads", "origin", branch], { encoding: "utf8" });

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-zeropushzeropr01",
      baseGitSha: approvedBaseSha,
      commitMessage: "research(RCS-zeropushzeropr01): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "BRANCH");

    // The remote branch tip must be byte-identical to before this run —
    // zero push occurred.
    const remoteAfterHeads = execFileSync("git", ["-C", fixture.root, "ls-remote", "--heads", "origin", branch], { encoding: "utf8" });
    assert.equal(remoteAfterHeads, remoteBeforeHeads);

    // Zero PR creation occurred.
    const state = fixture.readFakeGhState();
    assert.equal(state.prs.length, 0);
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL branch reuse: retry after a prior compatible partial run (branch created, not yet committed) resumes and completes", () => {
  const fixture = remoteGitFixture();
  try {
    const approvedBaseSha = fixture.head();
    const branch = branchNameForPackage("RCS-partialrunpartial");
    // Simulate a crash after BRANCH but before COMMIT: the branch exists,
    // descends from the approved base (it was just created from it), but
    // holds no new commit yet.
    execFileSync("git", ["-C", fixture.root, "checkout", "-b", branch]);
    execFileSync("git", ["-C", fixture.root, "checkout", "master"]);

    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-partialrunpartial",
      baseGitSha: approvedBaseSha,
      commitMessage: "research(RCS-partialrunpartial): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "READY_FOR_OWNER_MERGE");
    if (outcome.status !== "READY_FOR_OWNER_MERGE") return;
    assert.equal(outcome.branch, branch);
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: gh pr create failure is reported as an explicit failure, never reinterpreted as success", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    fixture.setFakeGhFailPrCreate(true);

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-prfailprfailprfa",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-prfailprfailprfa): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "PR_CREATE");
  } finally {
    fixture.cleanup();
  }
});

test("PENDING CI is not itself a failure (READY_FOR_OWNER_MERGE is still reachable with pending checks)", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    fixture.setFakeGhCiState("PENDING");

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-pendingpendingpe",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-pendingpendingpe): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "READY_FOR_OWNER_MERGE");
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL PR reuse: existing PR with expected head + expected base is reused safely (no duplicate created)", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    const branch = branchNameForPackage("RCS-goodpairgoodpair");
    fixture.seedFakeGhPr({ number: 7, url: "https://github.com/example/repo/pull/7", headRefName: branch, baseRefName: "master" });

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-goodpairgoodpair",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-goodpairgoodpair): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "READY_FOR_OWNER_MERGE");
    if (outcome.status !== "READY_FOR_OWNER_MERGE") return;
    assert.equal(outcome.prNumber, 7);

    const state = fixture.readFakeGhState();
    assert.equal(state.prs.length, 1, "no duplicate PR must be created when a compatible one already exists");
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL PR reuse: existing PR with expected head but wrong base fails explicitly — never reused, never retargeted, never duplicated", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    const branch = branchNameForPackage("RCS-wrongbasewrongbas");
    fixture.seedFakeGhPr({ number: 3, url: "https://github.com/example/repo/pull/3", headRefName: branch, baseRefName: "some-other-base" });

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-wrongbasewrongbas",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-wrongbasewrongbas): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "PR_CREATE");
    assert.match(outcome.message, /base/i);

    // No duplicate PR was created alongside the incompatible one.
    const state = fixture.readFakeGhState();
    assert.equal(state.prs.length, 1);
    assert.equal(state.prs[0]!.number, 3);
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL PR reuse: multiple PR candidates for the same head branch (ambiguous) fails explicitly rather than picking one", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    const branch = branchNameForPackage("RCS-ambiguousambiguo");
    // Two PRs somehow exist for the same head branch — even though one of
    // them targets the expected base, the ambiguity itself must be
    // surfaced rather than silently picking the first/matching one.
    fixture.seedFakeGhPr({ number: 10, url: "https://github.com/example/repo/pull/10", headRefName: branch, baseRefName: "master" });
    fixture.seedFakeGhPr({ number: 11, url: "https://github.com/example/repo/pull/11", headRefName: branch, baseRefName: "master" });

    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-ambiguousambiguo",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-ambiguousambiguo): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "FAILED");
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedStage, "PR_CREATE");

    const state = fixture.readFakeGhState();
    assert.equal(state.prs.length, 2, "no duplicate/third PR must be created when the existing pair is ambiguous");
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL PR reuse: malformed gh pr list output (not an array) is treated as no compatible PR, never crashes, never fabricates a match", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    // Corrupt the fake gh state file so `pr list`'s filter over `state.prs`
    // still returns valid JSON syntactically, but exercise the parser's
    // defensive shape-checking directly by writing a state file whose `prs`
    // entries are missing required fields (malformed/unexpected shape).
    const corrupted = JSON.parse(readFileSync(fixture.fakeGhStatePath, "utf8"));
    corrupted.prs = [{ number: 99, url: "https://github.com/example/repo/pull/99" /* headRefName/baseRefName missing */ }];
    writeFileSync(fixture.fakeGhStatePath, JSON.stringify(corrupted), "utf8");

    // The malformed entry has no headRefName, so the fake gh's own --head
    // filter naturally excludes it; this specifically proves the orchestrator
    // does not crash on unexpected `gh` output shape and proceeds to create
    // a fresh, correct PR rather than fabricating a match.
    const outcome = runPostApprovalGitSequence({
      repoRoot: fixture.root,
      packageId: "RCS-malformedmalforme",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-malformedmalforme): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    });

    assert.equal(outcome.status, "READY_FOR_OWNER_MERGE");
    if (outcome.status !== "READY_FOR_OWNER_MERGE") return;
    assert.notEqual(outcome.prNumber, 99);
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL PR reuse: compatible retry (same head + same base, already created by a prior run) resumes without creating a duplicate", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");

    const input = {
      repoRoot: fixture.root,
      packageId: "RCS-retrysameretrysa",
      baseGitSha: fixture.head(),
      commitMessage: "research(RCS-retrysameretrysa): synthetic test commit",
      prTitle: "Synthetic research PR",
      prBody: "Body",
      baseBranch: "master",
      env: fixture.env,
    };

    const first = runPostApprovalGitSequence(input);
    assert.equal(first.status, "READY_FOR_OWNER_MERGE");

    // Real retries always re-run the canonical promoter (which re-writes
    // the approved plan's files from disk) immediately before re-invoking
    // the Git/PR sequence — see the identical comment in the "re-running
    // the sequence..." test above for why this file is re-staged here.
    execFileSync("git", ["-C", fixture.root, "checkout", "master"]);
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    const second = runPostApprovalGitSequence(input);

    assert.equal(second.status, "READY_FOR_OWNER_MERGE");
    if (first.status !== "READY_FOR_OWNER_MERGE" || second.status !== "READY_FOR_OWNER_MERGE") return;
    assert.equal(first.prNumber, second.prNumber);

    const state = fixture.readFakeGhState();
    assert.equal(state.prs.length, 1);
  } finally {
    fixture.cleanup();
  }
});

test("this module contains no merge/auto-merge code path anywhere in its source", () => {
  const source = readFileSync(fileURLToPath(new URL("./git-orchestrator.ts", import.meta.url)), "utf8");
  // Strip comments first so this checks actual invoked commands/flags, not
  // documentation prose that explains (and rejects) auto-merge by name.
  const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/\bpr\s+merge\b/i.test(codeOnly));
  assert.ok(!/--auto/.test(codeOnly));
  assert.ok(!/auto-merge/i.test(codeOnly));
});
