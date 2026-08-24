#!/usr/bin/env node
/**
 * CLI wrapper for readiness.ts. Equivalent to the legacy
 * tools/evaluate-research-decisions.js CLI: same flags, same output
 * format, same exit codes. All readiness logic lives in readiness.ts; this
 * file owns only process.argv parsing, console output, and
 * process.exitCode.
 *
 * Usage:
 *   node --experimental-strip-types tools/research/readiness/cli.ts --problem PRB-0007
 *   node --experimental-strip-types tools/research/readiness/cli.ts --all
 *   (optional: --dir <researchRoot> to point at a fixture tree instead of research/)
 *   (optional: --json for machine-readable output)
 *
 * Exit code 0 = report produced; 1 = corpus fails validation or usage error.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateCorpus, evaluateProblem } from "./readiness.ts";
import type { ReadinessFinding, ReadinessReport } from "./readiness.ts";
import { loadCorpusIndex } from "../core/corpus.ts";
import { validateCorpusIndex } from "../validation/validate.ts";
import type { CorpusIndex } from "../core/types.ts";

function formatReasons(reasons: ReadinessFinding[]): string {
  return reasons
    .map((r) => (r.field ? `${r.code} [${r.field}]${r.detail ? ` — ${r.detail}` : ""}` : `${r.code}${r.detail ? ` — ${r.detail}` : ""}`))
    .join("; ");
}

function printReport(report: ReadinessReport): void {
  console.log(report.problem_id);
  const elig = report.eligibility;
  const corr = report.corroboration;
  console.log(`  eligibility:    ${elig.result}`);
  if (elig.reasons.length > 0) console.log(`    ${formatReasons(elig.reasons)}`);
  console.log(`  corroboration:  ${corr.result}`);
  if (corr.reasons.length > 0) console.log(`    ${formatReasons(corr.reasons)}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const dirFlagIdx = args.indexOf("--dir");
  const researchRoot =
    dirFlagIdx !== -1 && args[dirFlagIdx + 1]
      ? resolve(args[dirFlagIdx + 1])
      : resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "research");

  const problemFlagIdx = args.indexOf("--problem");
  const hasAll = args.includes("--all");
  const hasProblem = problemFlagIdx !== -1;
  const asJson = args.includes("--json");

  if (!hasAll && !hasProblem) {
    console.error(
      "Usage: node tools/research/readiness/cli.ts --problem <PRB-ID> | --all [--dir <researchRoot>] [--json]"
    );
    process.exitCode = 1;
    return;
  }

  const index: CorpusIndex = loadCorpusIndex(researchRoot);
  const { errors } = validateCorpusIndex(index);
  if (errors.length > 0) {
    console.error(
      `Cannot evaluate: research corpus fails validation (${errors.length} problem(s)). Run node tools/research/validation/cli.ts for details.`
    );
    process.exitCode = 1;
    return;
  }

  let reports: ReadinessReport[];
  if (hasAll) {
    reports = evaluateCorpus(index);
  } else {
    const prbId = args[problemFlagIdx + 1];
    const report = evaluateProblem(prbId, index);
    if (!report) {
      console.error(`Unknown problem: "${prbId}" does not resolve to a canonical PRB-* record.`);
      process.exitCode = 1;
      return;
    }
    reports = [report];
  }

  if (asJson) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    for (const report of reports) {
      printReport(report);
      console.log("");
    }
  }
}

main();
