import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { gitFixture } from "./test-fixtures.ts";
import { precheckRepositoryState } from "./repository-state.ts";

test("precheckRepositoryState succeeds when baseGitSha equals current HEAD and the tree is clean", () => {
  const fixture = gitFixture();
  try {
    const result = precheckRepositoryState(fixture.research, fixture.head());
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.head, fixture.head());
  } finally {
    fixture.cleanup();
  }
});

test("ADVERSARIAL: precheckRepositoryState aborts before any canonical write when baseGitSha is stale", () => {
  const fixture = gitFixture();
  try {
    const staleSha = fixture.head();
    writeFileSync(join(fixture.research, "sources", "SRC-EXTRA.yaml"), "source_id: SRC-EXTRA\nname: Extra\n", "utf8");
    fixture.commit("advance HEAD past the approved base");

    const result = precheckRepositoryState(fixture.research, staleSha);
    assert.equal(result.ok, false);
  } finally {
    fixture.cleanup();
  }
});

test("precheckRepositoryState fails closed on an unclean working tree even with a matching baseGitSha", () => {
  const fixture = gitFixture();
  try {
    const head = fixture.head();
    writeFileSync(join(fixture.research, "sources", "SRC-DIRTY.yaml"), "source_id: SRC-DIRTY\nname: Dirty\n", "utf8");
    const result = precheckRepositoryState(fixture.research, head);
    assert.equal(result.ok, false);
  } finally {
    fixture.cleanup();
  }
});

test("precheckRepositoryState never throws — reports failures as a result value so callers can abort deterministically", () => {
  const fixture = gitFixture();
  try {
    assert.doesNotThrow(() => precheckRepositoryState(fixture.research, "not-a-real-sha"));
  } finally {
    fixture.cleanup();
  }
});
