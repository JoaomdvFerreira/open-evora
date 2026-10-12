#!/usr/bin/env node
/** Pre-publication path audit used by `research:check` and CI. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { assertResearchPublicationPaths, gitChangedPaths } from "./publication-safety.ts";
import { pullRequestBase, resolveCommit } from "./review/review-unit.ts";

interface GitHubEvent {
  pull_request?: { base?: { sha?: unknown }; head?: { sha?: unknown } };
  before?: unknown;
  after?: unknown;
}

function localBase(repoRoot: string): string {
  for (const candidate of [process.env.RESEARCH_PUBLICATION_BASE, "origin/main", "main"]) {
    if (!candidate) continue;
    try {
      return resolveCommit(repoRoot, candidate);
    } catch {
      // Try the next stable local reference.
    }
  }
  throw new Error("cannot resolve a publication-safety base; set RESEARCH_PUBLICATION_BASE or fetch origin/main");
}

function main(): void {
  const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    const event = JSON.parse(readFileSync(eventPath, "utf8")) as GitHubEvent;
    if (typeof event.pull_request?.base?.sha === "string" && typeof event.pull_request.head?.sha === "string") {
      const head = resolveCommit(repoRoot, event.pull_request.head.sha);
      const base = pullRequestBase(repoRoot, resolveCommit(repoRoot, event.pull_request.base.sha), head);
      const paths = gitChangedPaths(repoRoot, base, head);
      assertResearchPublicationPaths(paths);
      console.log(`PASS: publication paths checked for ${paths.length} pull-request change(s).`);
      return;
    }
    if (typeof event.before === "string" && typeof event.after === "string" && /^[0-9a-f]{40}$/.test(event.before)) {
      const base = resolveCommit(repoRoot, event.before);
      const head = resolveCommit(repoRoot, event.after);
      const paths = gitChangedPaths(repoRoot, base, head);
      assertResearchPublicationPaths(paths);
      console.log(`PASS: publication paths checked for ${paths.length} pushed change(s).`);
      return;
    }
  }

  const base = localBase(repoRoot);
  const paths = gitChangedPaths(repoRoot, base);
  assertResearchPublicationPaths(paths);
  console.log(`PASS: publication paths checked for ${paths.length} local change(s) against ${base}.`);
}

try {
  main();
} catch (error) {
  console.error(`FAILED [PUBLICATION_PATH_SAFETY]: ${(error as Error).message}`);
  process.exitCode = 1;
}
