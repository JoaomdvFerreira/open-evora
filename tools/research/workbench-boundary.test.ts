import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

test("the local research workbench remains ignored by Git", () => {
  const output = execFileSync("git", ["check-ignore", "-v", "--", ".research-workbench/probe"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.match(output, /\.gitignore:\d+:\/\.research-workbench\//);
});
