#!/usr/bin/env node
/**
 * CLI wrapper for analyze.ts. Equivalent to the legacy
 * tools/analyze-research.js CLI: same flags, same output format, same
 * exit codes. All analysis logic lives in analyze.ts; this file owns only
 * process.argv parsing, console output, and process.exitCode.
 *
 * Usage:
 *   node --experimental-strip-types tools/research/analysis/cli.ts --all
 *   node --experimental-strip-types tools/research/analysis/cli.ts --problem PRB-0007
 *   node --experimental-strip-types tools/research/analysis/cli.ts --gaps
 *   (optional: --dir <researchRoot> to point at a fixture tree instead of research/)
 *
 * Exit code 0 = report produced (even if it lists gaps); 1 = corpus fails
 * validation or usage error.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeCorpus, computeProblemAnalysis } from "./analyze.ts";
import type { ProblemAnalysis } from "./analyze.ts";
import { loadCorpusIndex } from "../core/corpus.ts";
import { validateCorpusIndex } from "../validation/validate.ts";
import type { CorpusIndex } from "../core/types.ts";

function printProblemReport(report: ProblemAnalysis): void {
  const { prbId, prb } = report;
  console.log(`${prbId} — ${prb.title}`);
  console.log(`  status: ${prb.status} | validation_status: ${prb.validation_status}`);
  console.log(`  linked EVD: ${report.linkedEvdCount}`);
  console.log(`  known unique lineage_id count: ${report.knownLineageCount}`);
  console.log(`  linked EVD with lineage unassessed: ${report.missingLineageCount}`);
}

function runAll(index: CorpusIndex): void {
  const result = analyzeCorpus(index);
  console.log(
    `Corpus: ${result.summary.sourceCount} SRC, ${result.summary.evidenceCount} EVD, ${result.summary.problemCount} PRB (${result.summary.totalRecords} total canonical records)`
  );
  console.log("");
  for (const prbId of result.problemIds) {
    const report = result.problems.get(prbId)!;
    console.log(
      `${prbId} | status=${report.prb.status} | linked_evd=${report.linkedEvdCount} | lineage_known=${report.knownLineageCount}`
    );
  }
}

function runProblem(index: CorpusIndex, prbId: string): void {
  const report = computeProblemAnalysis(index, prbId);
  if (!report) {
    console.error(`Unknown problem: "${prbId}" does not resolve to a canonical PRB-* record.`);
    process.exitCode = 1;
    return;
  }
  printProblemReport(report);
}

function runGaps(index: CorpusIndex): void {
  const result = analyzeCorpus(index);
  if (result.gaps.length === 0) {
    console.log("No explicit machine-detectable gaps found.");
    return;
  }
  console.log(`${result.gaps.length} gap(s) found:`);
  for (const g of result.gaps) console.log(" - " + g);
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
  const hasGaps = args.includes("--gaps");
  const hasProblem = problemFlagIdx !== -1;

  if (!hasAll && !hasGaps && !hasProblem) {
    console.error("Usage: node tools/research/analyze-cli.ts --all | --problem <PRB-ID> | --gaps [--dir <researchRoot>]");
    process.exitCode = 1;
    return;
  }

  const index = loadCorpusIndex(researchRoot);
  const { errors } = validateCorpusIndex(index);
  if (errors.length > 0) {
    console.error(
      `Cannot analyze: research corpus fails validation (${errors.length} problem(s)). Run node tools/research/validation/cli.ts for details.`
    );
    process.exitCode = 1;
    return;
  }

  if (hasAll) runAll(index);
  if (hasProblem) runProblem(index, args[problemFlagIdx + 1]);
  if (hasGaps) runGaps(index);
}

main();
