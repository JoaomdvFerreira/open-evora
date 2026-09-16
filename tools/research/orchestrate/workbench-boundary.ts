/**
 * Enforces that WU045 orchestration only ever reads/writes under the
 * existing gitignored, non-canonical, non-public research workbench
 * boundary (docs/design/m013-launch-automation-contract.md §8, §11). This
 * is a defense-in-depth structural check inside the orchestrator itself,
 * additional to (never a replacement for) .gitignore and the existing
 * workbench-boundary.test.ts regression test.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");

/**
 * Throws unless `cycleDir` (an absolute path) is itself ignored by Git.
 * Uses `git check-ignore` — the same mechanism the existing
 * workbench-boundary.test.ts regression test already relies on — rather
 * than a second, parallel path-prefix convention.
 */
export function assertWorkbenchBoundary(cycleDir: string): void {
  let output: string;
  try {
    output = execFileSync("git", ["check-ignore", "-v", "--", cycleDir], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } catch {
    throw new Error(
      `cycle directory is not covered by .gitignore: ${cycleDir}. ` +
      "WU045 must only operate under a gitignored, non-canonical location (e.g. .research-workbench/<cycle-name>)."
    );
  }
  if (!output.trim()) {
    throw new Error(`cycle directory is not covered by .gitignore: ${cycleDir}`);
  }
}
