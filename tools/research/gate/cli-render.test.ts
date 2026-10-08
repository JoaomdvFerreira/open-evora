/**
 * `gate render` base-binding integration tests. The repository-state checks
 * themselves are owned by repository-state.test.ts; these only prove that
 * render consults that authority against the RCS baseGitSha before it loads
 * the corpus, and fails closed without writing any Gate artifacts.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { gitFixture, loadIndexFor, sourceYaml, syntheticResearchChangeSet, withTempDir } from "./test-fixtures.ts";
import { MARKDOWN_FILENAME, PACKAGE_FILENAME } from "./cli.ts";
import { DECISION_RECORD_FILENAME } from "./decision-record.ts";

const CLI = fileURLToPath(new URL("./cli.ts", import.meta.url));
const RCS_FILENAME = "research-change-set.json";
const DECISION_SENTINEL = "{\"sentinel\":\"pre-existing decision record\"}\n";

function render(cycleDir: string, researchRoot: string) {
  return spawnSync(process.execPath, [
    "--experimental-strip-types", CLI, "render",
    "--cycle-dir", cycleDir,
    "--dir", researchRoot,
  ], { encoding: "utf8" });
}

function writeRcs(cycleDir: string, researchRoot: string, baseGitSha: string): string {
  const changeSet = syntheticResearchChangeSet(loadIndexFor(researchRoot), baseGitSha);
  const raw = `${JSON.stringify(changeSet, null, 2)}\n`;
  writeFileSync(join(cycleDir, RCS_FILENAME), raw, "utf8");
  return raw;
}

function gitStatus(root: string): string {
  return execFileSync("git", ["-C", root, "status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" });
}

function assertFailedClosedWithoutMutation(
  cycleDir: string,
  result: ReturnType<typeof render>,
  expected: { reason: RegExp; rcs: string; head: string; status: string },
  fixture: ReturnType<typeof gitFixture>
): void {
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /FAILED \[RCS_BASE_STATE_MISMATCH\]/);
  assert.match(result.stderr, expected.reason);
  assert.doesNotMatch(result.stdout, /READY_FOR_HUMAN_REVIEW/);
  assert.equal(existsSync(join(cycleDir, PACKAGE_FILENAME)), false);
  assert.equal(existsSync(join(cycleDir, MARKDOWN_FILENAME)), false);
  assert.equal(readFileSync(join(cycleDir, RCS_FILENAME), "utf8"), expected.rcs);
  assert.equal(readFileSync(join(cycleDir, DECISION_RECORD_FILENAME), "utf8"), DECISION_SENTINEL);
  assert.equal(fixture.head(), expected.head);
  assert.equal(gitStatus(fixture.root), expected.status);
}

test("gate render succeeds against a clean canonical checkout at exactly the RCS baseGitSha", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const head = fixture.head();
      writeRcs(cycleDir, fixture.research, head);

      const result = render(cycleDir, fixture.research);

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /READY_FOR_HUMAN_REVIEW/);
      const pkg = JSON.parse(readFileSync(join(cycleDir, PACKAGE_FILENAME), "utf8")) as { baseGitSha: string };
      assert.equal(pkg.baseGitSha, head);
      assert.equal(existsSync(join(cycleDir, MARKDOWN_FILENAME)), true);
    });
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: gate render fails closed before package creation when HEAD has moved past the RCS baseGitSha", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const staleSha = fixture.head();
      const rcs = writeRcs(cycleDir, fixture.research, staleSha);
      writeFileSync(join(cycleDir, DECISION_RECORD_FILENAME), DECISION_SENTINEL, "utf8");
      writeFileSync(join(fixture.research, "sources", "SRC-EXTRA.yaml"), sourceYaml("SRC-EXTRA", "Extra"), "utf8");
      fixture.commit("advance HEAD past the RCS base");
      const head = fixture.head();
      const status = gitStatus(fixture.root);

      const result = render(cycleDir, fixture.research);

      assertFailedClosedWithoutMutation(cycleDir, result, { reason: /does not match the current Git HEAD/, rcs, head, status }, fixture);
    });
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: gate render fails closed on a dirty canonical checkout even at the RCS baseGitSha", () => {
  const fixture = gitFixture();
  try {
    withTempDir((cycleDir) => {
      const head = fixture.head();
      const rcs = writeRcs(cycleDir, fixture.research, head);
      writeFileSync(join(cycleDir, DECISION_RECORD_FILENAME), DECISION_SENTINEL, "utf8");
      writeFileSync(join(fixture.research, "sources", "SRC-DIRTY.yaml"), sourceYaml("SRC-DIRTY", "Dirty"), "utf8");
      const status = gitStatus(fixture.root);

      const result = render(cycleDir, fixture.research);

      assertFailedClosedWithoutMutation(cycleDir, result, { reason: /working tree must be clean/, rcs, head, status }, fixture);
      assert.equal(readFileSync(join(fixture.research, "sources", "SRC-DIRTY.yaml"), "utf8"), sourceYaml("SRC-DIRTY", "Dirty"));
    });
  } finally {
    fixture.cleanup();
  }
});
