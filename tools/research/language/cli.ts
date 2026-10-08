#!/usr/bin/env node
/**
 * CLI wrapper for signals.ts: prints advisory CLEC language signals. All
 * detection logic lives in signals.ts; this file owns only process.argv
 * parsing, the Git changed-file lookup, console output, and process.exitCode.
 *
 * Usage:
 *   node tools/research/language/cli.ts --all
 *   node tools/research/language/cli.ts --changed-since <git-ref>
 *   (optional: --dir <researchRoot> to point at a fixture tree instead of research/)
 *   (optional: --json for machine-readable output)
 *
 * --changed-since inspects only canonical records whose files differ from
 * <git-ref> in the working tree (committed, uncommitted, or untracked).
 *
 * Signals are review prompts, never failures: exit code 0 = report produced,
 * whatever it contains; 1 = usage error, unreadable corpus, or Git failure.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { detectLanguageSignals, subjectIdsForFiles } from "./signals.ts";
import type { LanguageSignal } from "./signals.ts";
import { loadCorpusIndex } from "../core/corpus.ts";

const USAGE = "Usage: node tools/research/language/cli.ts --all | --changed-since <git-ref> [--dir <researchRoot>] [--json]";

function git(researchRoot: string, args: string[]): string {
  return execFileSync("git", args, { cwd: researchRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Research-root-relative paths changed against `ref`, including untracked files. */
function changedFiles(researchRoot: string, ref: string): string[] {
  git(researchRoot, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  const lines = (out: string) => out.split("\n").map((l) => l.trim()).filter(Boolean);
  return [
    ...lines(git(researchRoot, ["diff", "--name-only", "--relative", ref, "--", "."])),
    ...lines(git(researchRoot, ["ls-files", "--others", "--exclude-standard", "--", "."])),
  ];
}

function printSignal(s: LanguageSignal): void {
  console.log(`${s.subjectId} ${s.field} ${s.code} [${s.dimension}] ${s.severity}`);
  if (s.match !== undefined) console.log(`  match:   ${JSON.stringify(s.match)}`);
  console.log(`  excerpt: ${JSON.stringify(s.excerpt)}`);
  if (s.evidenceReferences) console.log(`  review against: ${s.evidenceReferences.join(", ")}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const dirFlagIdx = args.indexOf("--dir");
  const researchRoot =
    dirFlagIdx !== -1 && args[dirFlagIdx + 1]
      ? resolve(args[dirFlagIdx + 1])
      : resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "research");

  const changedFlagIdx = args.indexOf("--changed-since");
  const ref = changedFlagIdx !== -1 ? args[changedFlagIdx + 1] : undefined;
  const hasAll = args.includes("--all");
  const asJson = args.includes("--json");

  if (hasAll === (changedFlagIdx !== -1) || (changedFlagIdx !== -1 && (!ref || ref.startsWith("-")))) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const index = loadCorpusIndex(researchRoot);
  let subjectIds: Set<string> | undefined;
  if (ref !== undefined) {
    try {
      subjectIds = subjectIdsForFiles(index, changedFiles(researchRoot, ref));
    } catch {
      console.error(`Cannot resolve changed records against Git ref "${ref}".`);
      process.exitCode = 1;
      return;
    }
  }

  const signals = detectLanguageSignals(index, { subjectIds });
  const mode = ref === undefined ? "corpus" : "changed";

  if (asJson) {
    console.log(JSON.stringify({ mode, ...(ref !== undefined ? { base: ref, subjects: [...subjectIds!].sort() } : {}), signals }, null, 2));
    return;
  }

  const scope = ref === undefined ? "canonical corpus" : `${subjectIds!.size} record(s) changed since ${ref}`;
  console.log(`CLEC language signals (advisory) — ${scope}`);
  console.log("Signals are review prompts for evidence-aware semantic review, not wording violations.");
  console.log("");
  for (const s of signals) printSignal(s);

  const byCode = new Map<string, number>();
  for (const s of signals) byCode.set(s.code, (byCode.get(s.code) ?? 0) + 1);
  const records = new Set(signals.map((s) => s.subjectId));
  console.log("");
  console.log(`${signals.length} advisory signal(s) across ${records.size} record(s).`);
  for (const [code, count] of [...byCode].sort(([a], [b]) => a.localeCompare(b))) console.log(`  ${code}: ${count}`);
}

main();
