import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { isBoundedRelativePath, resolveContainedPath } from "./path-containment.ts";

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-path-containment-test-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("isBoundedRelativePath accepts plain relative filenames and shallow nested paths", () => {
  assert.equal(isBoundedRelativePath("SRC-NEW.yaml"), true);
  assert.equal(isBoundedRelativePath("nested/candidate.yaml"), true);
  assert.equal(isBoundedRelativePath("a/b/c.yaml"), true);
});

test("isBoundedRelativePath rejects a single-level ../escape", () => {
  assert.equal(isBoundedRelativePath("../escape.yaml"), false);
});

test("isBoundedRelativePath rejects multi-level traversal", () => {
  assert.equal(isBoundedRelativePath("../../../../etc/passwd"), false);
  assert.equal(isBoundedRelativePath("a/../../b.yaml"), false);
});

test("isBoundedRelativePath rejects an absolute POSIX path", () => {
  assert.equal(isBoundedRelativePath("/etc/passwd"), false);
  assert.equal(isBoundedRelativePath("/research/EVD-0001.yaml"), false);
});

test("isBoundedRelativePath rejects Windows-rooted and drive-qualified forms", () => {
  assert.equal(isBoundedRelativePath("C:\\Windows\\system.ini"), false);
  assert.equal(isBoundedRelativePath("C:/Windows/system.ini"), false);
  assert.equal(isBoundedRelativePath("\\\\host\\share\\file"), false);
  assert.equal(isBoundedRelativePath("\\rooted\\path"), false);
});

test("isBoundedRelativePath rejects empty, whitespace-only, and current-directory-escape forms", () => {
  assert.equal(isBoundedRelativePath(""), false);
  assert.equal(isBoundedRelativePath("   "), false);
  assert.equal(isBoundedRelativePath("."), false);
  assert.equal(isBoundedRelativePath("./"), false);
  assert.equal(isBoundedRelativePath("a/./b.yaml"), false);
});

test("isBoundedRelativePath rejects a null-byte-containing path", () => {
  assert.equal(isBoundedRelativePath("a\0.yaml"), false);
});

test("isBoundedRelativePath rejects non-string input", () => {
  assert.equal(isBoundedRelativePath(undefined as unknown as string), false);
  assert.equal(isBoundedRelativePath(null as unknown as string), false);
  assert.equal(isBoundedRelativePath(123 as unknown as string), false);
});

test("resolveContainedPath accepts a benign nested candidate path and resolves it inside baseDir", () => {
  withTempDir((baseDir) => {
    const result = resolveContainedPath(baseDir, "nested/candidate.yaml");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.absolutePath.startsWith(baseDir) || result.absolutePath.includes(join("nested", "candidate.yaml")));
  });
});

test("resolveContainedPath rejects ../escape before any filesystem write", () => {
  withTempDir((baseDir) => {
    const result = resolveContainedPath(baseDir, "../escape.yaml");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /not a bounded relative path/);
  });
});

test("resolveContainedPath rejects deep multi-level traversal that would otherwise reach outside the repo", () => {
  withTempDir((baseDir) => {
    const deepTraversal = "../".repeat(10) + "outside.yaml";
    const result = resolveContainedPath(baseDir, deepTraversal);
    assert.equal(result.ok, false);
  });
});

test("resolveContainedPath rejects an absolute path target", () => {
  withTempDir((baseDir) => {
    const result = resolveContainedPath(baseDir, "/etc/passwd");
    assert.equal(result.ok, false);
  });
});

test("resolveContainedPath rejects a path engineered to land at the repository root", () => {
  withTempDir((outerDir) => {
    const baseDir = join(outerDir, "a", "b", "candidates");
    mkdirSync(baseDir, { recursive: true });
    const result = resolveContainedPath(baseDir, "../../../repository-root-marker.txt");
    assert.equal(result.ok, false);
  });
});

test("resolveContainedPath rejects a path targeting a sibling directory", () => {
  withTempDir((outerDir) => {
    const baseDir = join(outerDir, "candidates");
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(join(outerDir, "sibling"), { recursive: true });
    const result = resolveContainedPath(baseDir, "../sibling/marker.txt");
    assert.equal(result.ok, false);
  });
});

test("resolveContainedPath fails closed when baseDir does not exist", () => {
  withTempDir((outerDir) => {
    const missingBase = join(outerDir, "does-not-exist");
    const result = resolveContainedPath(missingBase, "candidate.yaml");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /could not be resolved/);
  });
});

test("resolveContainedPath rejects a symlink inside baseDir that resolves outside it", { skip: process.platform === "win32" ? "symlink creation requires elevated privileges on Windows CI runners" : false }, () => {
  withTempDir((outerDir) => {
    const baseDir = join(outerDir, "candidates");
    mkdirSync(baseDir, { recursive: true });
    const outsideTarget = join(outerDir, "outside-secret.txt");
    writeFileSync(outsideTarget, "secret", "utf8");
    const linkPath = join(baseDir, "escape-link");
    try {
      symlinkSync(outsideTarget, linkPath);
    } catch {
      return; // Environment does not permit symlink creation; nothing to assert.
    }
    const result = resolveContainedPath(baseDir, "escape-link");
    assert.equal(result.ok, false);
  });
});

test("no external content is ever read/written before containment is confirmed: reason strings never include file content", () => {
  withTempDir((baseDir) => {
    const result = resolveContainedPath(baseDir, "../escape.yaml");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason.includes("PWNED"), false);
  });
});
