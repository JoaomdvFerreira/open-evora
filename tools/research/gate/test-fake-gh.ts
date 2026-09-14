/**
 * A fake `gh` CLI used only by git-orchestrator.test.ts / promote.test.ts to
 * exercise the real orchestration code path (spawnSync("gh", ...)) without
 * ever touching the real GitHub API, per the contract's requirement that
 * tests must not require destructive interaction with a real remote.
 *
 * State is kept in a JSON file at $FAKE_GH_STATE (set by the test), so
 * multiple invocations across one orchestration run (pr list, pr create,
 * pr checks) see a consistent, evolving fake PR/CI state.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

interface FakeGhState {
  prs: Array<{ number: number; url: string; headRefName: string; baseRefName: string }>;
  ciState: "SUCCESS" | "FAILURE" | "PENDING" | "NONE";
  nextPrNumber: number;
  failPrCreate?: boolean;
}

function loadState(path: string): FakeGhState {
  if (!existsSync(path)) return { prs: [], ciState: "SUCCESS", nextPrNumber: 1 };
  return JSON.parse(readFileSync(path, "utf8")) as FakeGhState;
}

function saveState(path: string, state: FakeGhState): void {
  writeFileSync(path, JSON.stringify(state, null, 2), "utf8");
}

function main(): void {
  const statePath = process.env.FAKE_GH_STATE;
  if (!statePath) {
    console.error("FAKE_GH_STATE not set");
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const state = loadState(statePath);

  if (args[0] === "pr" && args[1] === "list") {
    const headIdx = args.indexOf("--head");
    const head = headIdx !== -1 ? args[headIdx + 1] : undefined;
    const matches = state.prs.filter((pr) => pr.headRefName === head);
    console.log(JSON.stringify(matches));
    process.exit(0);
  }

  if (args[0] === "pr" && args[1] === "create") {
    if (state.failPrCreate) {
      console.error("simulated gh pr create failure");
      process.exit(1);
    }
    // Validate --body-file resolves to a real, readable file, matching the
    // real gh CLI's contract — a missing/unreadable body file should be a
    // usage error, not silently ignored.
    const bodyFileIdx = args.indexOf("--body-file");
    if (bodyFileIdx !== -1) {
      const bodyFilePath = args[bodyFileIdx + 1];
      if (!bodyFilePath || !existsSync(bodyFilePath)) {
        console.error(`fake gh: --body-file path does not exist: ${bodyFilePath}`);
        process.exit(1);
      }
      readFileSync(bodyFilePath, "utf8");
    }
    const headIdx = args.indexOf("--head");
    const head = headIdx !== -1 ? args[headIdx + 1] : "unknown-branch";
    const baseIdx = args.indexOf("--base");
    const base = baseIdx !== -1 ? args[baseIdx + 1] : "unknown-base";
    const number = state.nextPrNumber;
    const pr = { number, url: `https://github.com/example/repo/pull/${number}`, headRefName: head, baseRefName: base };
    state.prs.push(pr);
    state.nextPrNumber += 1;
    saveState(statePath, state);
    console.log(pr.url);
    process.exit(0);
  }

  if (args[0] === "pr" && args[1] === "checks") {
    if (state.ciState === "NONE") {
      console.log(JSON.stringify([]));
      process.exit(0);
    }
    console.log(JSON.stringify([{ state: state.ciState }]));
    process.exit(0);
  }

  console.error(`fake gh: unhandled command: ${args.join(" ")}`);
  process.exit(1);
}

main();
