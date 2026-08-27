import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  applyCanonicalIntegrationPlan,
  type CanonicalIntegrationPlan,
} from "./index.ts";
import { rollbackCanonicalPromotion } from "./canonical-promoter.ts";


function sourceYaml(id: string, name = "Synthetic source"): string {
  return `source_id: ${id}\nname: ${name}\nresource_type: document\nscope:\n  geography:\n    level: municipality\n    area: Évora\n  domains:\n    - MOB\naccess:\n  level: public\n  availability: available\n  machine_readable: false\nacquisition:\n  method: public_web\nlicensing:\n  status: unknown\n  reuse: unknown\ntemporal:\n  last_checked_at: 2026-08-27\n`;
}

interface Fixture {
  root: string;
  research: string;
  cleanup(): void;
  head(): string;
  commit(message: string): void;
}

function fixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "open-evora-promoter-test-"));
  const research = join(root, "research");
  mkdirSync(join(research, "sources"), { recursive: true });
  mkdirSync(join(research, "evidence"), { recursive: true });
  mkdirSync(join(research, "problems"), { recursive: true });
  const schemas = join(research, "schemas");
  mkdirSync(schemas);
  for (const name of ["source.schema.json", "evidence.schema.json", "problem.schema.json"]) {
    copyFileSync(join(process.cwd(), "research", "schemas", name), join(schemas, name));
  }
  writeFileSync(join(research, "sources", "SRC-BASE.yaml"), sourceYaml("SRC-BASE", "Before"));
  execFileSync("git", ["init", "--quiet", root]);
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "initial"]);
  return {
    root,
    research,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
    head: () => execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    commit: (message) => {
      execFileSync("git", ["-C", root, "add", "."]);
      execFileSync("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", message]);
    },
  };
}

function plan(baseGitSha: string, operations: CanonicalIntegrationPlan["operations"]): CanonicalIntegrationPlan {
  return {
    baseGitSha,
    deltas: operations.map(({ recordFamily, id, action }) => ({ recordFamily, id, action })),
    operations,
  };
}

function create(id: string, yaml = sourceYaml(id, "Created")) {
  return { recordFamily: "SRC-", id, action: "CREATE" as const, targetFile: `sources/${id}.yaml`, yaml };
}

function update(id: string, yaml = sourceYaml(id, "Updated")) {
  return { recordFamily: "SRC-", id, action: "UPDATE" as const, targetFile: `sources/${id}.yaml`, yaml };
}

test("matching HEAD, clean repository, and valid CREATE promotes exact approved bytes", () => {
  const current = fixture();
  try {
    const operation = create("SRC-CREATED", sourceYaml("SRC-CREATED", "Exact approved"));
    const result = applyCanonicalIntegrationPlan(current.research, plan(current.head(), [operation]));
    assert.equal(result.createCount, 1);
    assert.equal(result.postWriteValidation.errors.length, 0);
    assert.deepEqual(readFileSync(join(current.research, operation.targetFile)), Buffer.from(operation.yaml));
  } finally { current.cleanup(); }
});

test("UPDATE preserves the exact approved YAML bytes", () => {
  const current = fixture();
  try {
    const operation = update("SRC-BASE", sourceYaml("SRC-BASE", "Exact update"));
    const result = applyCanonicalIntegrationPlan(current.research, plan(current.head(), [operation]));
    assert.equal(result.updateCount, 1);
    assert.deepEqual(readFileSync(join(current.research, operation.targetFile)), Buffer.from(operation.yaml));
  } finally { current.cleanup(); }
});

test("mixed CREATE, UPDATE, and NO_CHANGE applies only the writes", () => {
  const current = fixture();
  try {
    const unchangedPath = join(current.research, "sources", "SRC-UNCHANGED.yaml");
    writeFileSync(unchangedPath, sourceYaml("SRC-UNCHANGED", "Untouched"));
    current.commit("add unchanged source");
    const unchanged = readFileSync(unchangedPath);
    const operation = create("SRC-CREATED");
    const result = applyCanonicalIntegrationPlan(current.research, plan(current.head(), [
      operation,
      update("SRC-BASE", sourceYaml("SRC-BASE", "Updated once")),
      { recordFamily: "SRC-", id: "SRC-UNCHANGED", action: "NO_CHANGE" },
    ]));
    assert.deepEqual([result.createCount, result.updateCount, result.noChangeCount], [1, 1, 1]);
    assert.deepEqual(readFileSync(unchangedPath), unchanged);
  } finally { current.cleanup(); }
});

test("NO_CHANGE produces no filesystem change", () => {
  const current = fixture();
  try {
    const before = readFileSync(join(current.research, "sources", "SRC-BASE.yaml"));
    const result = applyCanonicalIntegrationPlan(current.research, plan(current.head(), [{ recordFamily: "SRC-", id: "SRC-BASE", action: "NO_CHANGE" }]));
    assert.equal(result.noChangeCount, 1);
    assert.deepEqual(readFileSync(join(current.research, "sources", "SRC-BASE.yaml")), before);
  } finally { current.cleanup(); }
});

test("stale base SHA, dirty repository, and invalid existing corpus fail before writes", () => {
  const stale = fixture();
  const dirty = fixture();
  const invalid = fixture();
  try {
    assert.throws(() => applyCanonicalIntegrationPlan(stale.research, plan("0000000000000000000000000000000000000000", [create("SRC-STALE")])), /baseGitSha/);
    assert.equal(existsSync(join(stale.research, "sources", "SRC-STALE.yaml")), false);

    writeFileSync(join(dirty.root, "unrelated.txt"), "dirty");
    assert.throws(() => applyCanonicalIntegrationPlan(dirty.research, plan(dirty.head(), [create("SRC-DIRTY")])), /working tree must be clean/);
    assert.equal(existsSync(join(dirty.research, "sources", "SRC-DIRTY.yaml")), false);

    writeFileSync(join(invalid.research, "sources", "SRC-BASE.yaml"), "source_id: SRC-BASE\n");
    invalid.commit("invalid corpus");
    assert.throws(() => applyCanonicalIntegrationPlan(invalid.research, plan(invalid.head(), [create("SRC-INVALID")])), /corpus has validation errors/);
    assert.equal(existsSync(join(invalid.research, "sources", "SRC-INVALID.yaml")), false);
  } finally { stale.cleanup(); dirty.cleanup(); invalid.cleanup(); }
});

test("tampered targets, duplicate targets, and mismatched YAML IDs are rejected", () => {
  const current = fixture();
  try {
    assert.throws(() => applyCanonicalIntegrationPlan(current.research, plan(current.head(), [{ ...create("SRC-CREATE"), targetFile: "sources/other.yaml" }])), /target does not match/);
    assert.throws(() => applyCanonicalIntegrationPlan(current.research, plan(current.head(), [{ ...update("SRC-BASE"), targetFile: "sources/not-base.yaml" }])), /target does not match/);
    assert.throws(() => applyCanonicalIntegrationPlan(current.research, plan(current.head(), [create("SRC-ONE"), { ...create("SRC-TWO"), targetFile: "sources/SRC-ONE.yaml" }])), /duplicate write target/);
    assert.throws(() => applyCanonicalIntegrationPlan(current.research, plan(current.head(), [create("SRC-ID", sourceYaml("SRC-OTHER"))])), /canonical ID/);
  } finally { current.cleanup(); }
});

test("a prospective staged validation failure leaves canonical files unchanged", () => {
  const current = fixture();
  try {
    const before = readFileSync(join(current.research, "sources", "SRC-BASE.yaml"));
    assert.throws(() => applyCanonicalIntegrationPlan(current.research, plan(current.head(), [update("SRC-BASE", "source_id: SRC-BASE\n")])), /would produce/);
    assert.deepEqual(readFileSync(join(current.research, "sources", "SRC-BASE.yaml")), before);
  } finally { current.cleanup(); }
});

test("the bounded rollback helper restores only touched update and create targets", () => {
  const current = fixture();
  try {
    const updatePath = join(current.research, "sources", "SRC-BASE.yaml");
    const createPath = join(current.research, "sources", "SRC-TEMP.yaml");
    const original = readFileSync(updatePath);
    writeFileSync(updatePath, sourceYaml("SRC-BASE", "Touched"));
    writeFileSync(createPath, sourceYaml("SRC-TEMP"));
    assert.equal(rollbackCanonicalPromotion([
      { action: "UPDATE", targetPath: updatePath, original },
      { action: "CREATE", targetPath: createPath },
    ]), true);
    assert.deepEqual(readFileSync(updatePath), original);
    assert.equal(existsSync(createPath), false);
  } finally { current.cleanup(); }
});
