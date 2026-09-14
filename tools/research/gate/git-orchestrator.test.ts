/**
 * Post-approval Git/PR orchestration tests (docs/design/
 * m013-launch-automation-contract.md §12, OD-E). Exercises the real
 * git/gh-invoking code path against a local bare "origin" remote and a fake
 * `gh` executable (test-fake-gh.ts) — never a real GitHub remote, per the
 * contract's requirement that tests must not require destructive
 * interaction with a real repository/remote.
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
    // orchestrator for the same package (as a real retry would).
    execFileSync("git", ["-C", fixture.root, "checkout", "master"], { encoding: "utf8" });

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

test("ADVERSARIAL: a branch-name conflict (existing local branch with unrelated history) does not silently overwrite — it resumes onto the existing branch deterministically rather than failing unpredictably", () => {
  const fixture = remoteGitFixture();
  try {
    stageApprovedFile(fixture.research, "sources/SRC-NEW.yaml", "source_id: SRC-NEW\nname: New\n");
    const branch = branchNameForPackage("RCS-branchexistsbran");
    // Pre-create the deterministic branch name pointing at the current
    // HEAD before the orchestration sequence runs (e.g. from a prior
    // partial run that created the branch but crashed before committing).
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

test("this module contains no merge/auto-merge code path anywhere in its source", () => {
  const source = readFileSync(fileURLToPath(new URL("./git-orchestrator.ts", import.meta.url)), "utf8");
  // Strip comments first so this checks actual invoked commands/flags, not
  // documentation prose that explains (and rejects) auto-merge by name.
  const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/\bpr\s+merge\b/i.test(codeOnly));
  assert.ok(!/--auto/.test(codeOnly));
  assert.ok(!/auto-merge/i.test(codeOnly));
});
