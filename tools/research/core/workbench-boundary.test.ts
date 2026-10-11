import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { assertWorkbenchBoundary } from "./workbench-boundary.ts";

const repoRoot = resolve(process.cwd());

test("a path under the gitignored .research-workbench/ boundary is accepted", () => {
  assert.doesNotThrow(() =>
    assertWorkbenchBoundary(resolve(repoRoot, ".research-workbench", "orchestrate-boundary-test-probe"))
  );
});

test("a path under tools/research/ (a tracked location) is rejected", () => {
  assert.throws(
    () => assertWorkbenchBoundary(resolve(repoRoot, "tools", "research", "orchestrate")),
    /not covered by \.gitignore/
  );
});

test("a path under research/ (canonical, tracked) is rejected", () => {
  assert.throws(() => assertWorkbenchBoundary(resolve(repoRoot, "research")), /not covered by \.gitignore/);
});
