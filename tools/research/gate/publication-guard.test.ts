/**
 * LOW-3 deterministic publication guard adversarial tests (docs/design/
 * m013-launch-automation-contract.md §12, independent-review finding
 * LOW-3; WU048 failure-state coverage: "LOW-3 unexpected path"). These
 * demonstrate that an unexpected staged/tracked/untracked file prevents
 * publication, and that the guard is enforced at the Git-publication
 * boundary itself rather than relying only on .gitignore.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { gitFixture } from "./test-fixtures.ts";
import { checkPublicationGuard } from "./publication-guard.ts";
import type { CanonicalIntegrationPlan } from "../integration/canonical-integration-plan.ts";

function planFor(baseGitSha: string, targetFile: string): CanonicalIntegrationPlan {
  return {
    baseGitSha,
    deltas: [{ recordFamily: "SRC-", id: "SRC-NEW", action: "CREATE" }],
    operations: [{ recordFamily: "SRC-", id: "SRC-NEW", action: "CREATE", targetFile, yaml: "source_id: SRC-NEW\nname: New\n" }],
  };
}

test("the guard passes when only the approved plan's exact target file is staged", () => {
  const fixture = gitFixture();
  try {
    const targetFile = "research/sources/SRC-NEW.yaml";
    writeFileSync(join(fixture.root, targetFile), "source_id: SRC-NEW\nname: New\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", targetFile]);

    const result = checkPublicationGuard(fixture.root, planFor(fixture.head(), "sources/SRC-NEW.yaml"));
    assert.equal(result.ok, true);
    assert.deepEqual(result.unexpectedPaths, []);
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: an unexpected staged file outside the approved plan fails the guard closed", () => {
  const fixture = gitFixture();
  try {
    const targetFile = "research/sources/SRC-NEW.yaml";
    writeFileSync(join(fixture.root, targetFile), "source_id: SRC-NEW\nname: New\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", targetFile]);

    // An unexpected file sneaks into the staging area alongside the
    // approved write — e.g. a stray debug file or an accidental `git add -A`.
    const unexpectedFile = "unexpected-secret.txt";
    writeFileSync(join(fixture.root, unexpectedFile), "should never be published", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", unexpectedFile]);

    const result = checkPublicationGuard(fixture.root, planFor(fixture.head(), "sources/SRC-NEW.yaml"));
    assert.equal(result.ok, false);
    assert.ok(result.unexpectedPaths.includes(unexpectedFile));
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: a staged .research-workbench/** path fails the guard even though it is gitignored elsewhere", () => {
  const fixture = gitFixture();
  try {
    const targetFile = "research/sources/SRC-NEW.yaml";
    writeFileSync(join(fixture.root, targetFile), "source_id: SRC-NEW\nname: New\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", targetFile]);

    // Simulate a workbench candidate file that ended up staged despite
    // .gitignore (e.g. force-added, or .gitignore not present in this
    // synthetic fixture repo) — the guard must not rely on .gitignore alone.
    mkdirSync(join(fixture.root, ".research-workbench", "cycle-1"), { recursive: true });
    const workbenchFile = ".research-workbench/cycle-1/research-change-set.json";
    writeFileSync(join(fixture.root, workbenchFile), "{}", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", "-f", workbenchFile]);

    const result = checkPublicationGuard(fixture.root, planFor(fixture.head(), "sources/SRC-NEW.yaml"));
    assert.equal(result.ok, false);
    assert.ok(result.unexpectedPaths.some((p) => p.startsWith(".research-workbench/")));
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: an untracked file present but not staged still fails the guard (guard inspects working-tree state, not only the index)", () => {
  const fixture = gitFixture();
  try {
    const targetFile = "research/sources/SRC-NEW.yaml";
    writeFileSync(join(fixture.root, targetFile), "source_id: SRC-NEW\nname: New\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", targetFile]);

    // An untracked file sits in the working tree without being staged.
    writeFileSync(join(fixture.root, "stray-untracked.txt"), "oops", "utf8");

    const result = checkPublicationGuard(fixture.root, planFor(fixture.head(), "sources/SRC-NEW.yaml"));
    assert.equal(result.ok, false);
    assert.ok(result.unexpectedPaths.includes("stray-untracked.txt"));
  } finally {
    fixture.cleanup();
  }
});

test("the guard does not loosen the approved-path set to accommodate an unrelated modified tracked file", () => {
  const fixture = gitFixture();
  try {
    const targetFile = "research/sources/SRC-NEW.yaml";
    writeFileSync(join(fixture.root, targetFile), "source_id: SRC-NEW\nname: New\n", "utf8");
    execFileSync("git", ["-C", fixture.root, "add", targetFile]);

    // Modify an already-tracked file that is not part of the approved plan.
    writeFileSync(join(fixture.root, "research", "sources", "SRC-BASE.yaml"), "source_id: SRC-BASE\nname: Tampered\n", "utf8");

    const result = checkPublicationGuard(fixture.root, planFor(fixture.head(), "sources/SRC-NEW.yaml"));
    assert.equal(result.ok, false);
    assert.ok(result.unexpectedPaths.includes("research/sources/SRC-BASE.yaml"));
  } finally {
    fixture.cleanup();
  }
});
