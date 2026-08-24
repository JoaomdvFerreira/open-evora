#!/usr/bin/env node
/**
 * CLI wrapper for analyze.ts. Equivalent to the legacy
 * tools/analyze-research.js CLI: same flags, same output format, same
 * exit codes. All analysis logic lives in analyze.ts; this file owns only
 * process.argv parsing, console output, and process.exitCode.
 *
 * Usage:
 *   node --experimental-strip-types tools/research/analyze-cli.ts --all
 *   node --experimental-strip-types tools/research/analyze-cli.ts --problem PRB-0007
 *   node --experimental-strip-types tools/research/analyze-cli.ts --gaps
 *   (optional: --dir <researchRoot> to point at a fixture tree instead of research/)
 *
 * Exit code 0 = report produced (even if it lists gaps); 1 = corpus fails
 * validation or usage error.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeCorpus, computeProblemAnalysis } from "./analyze.ts";
import type { Distribution, ProblemAnalysis } from "./analyze.ts";
import { loadCorpusIndex } from "./corpus.ts";
import { validateCorpusIndex } from "./validate.ts";
import type { CorpusIndex, RecordFields } from "./types.ts";

function formatDistribution(entries: Distribution): string {
  if (entries.length === 0) return "(none recorded)";
  return entries.map(([k, n]) => `${k}=${n}`).join(", ");
}

function printProblemReport(report: ProblemAnalysis): void {
  const { prbId, prb } = report;
  console.log(`${prbId} — ${prb.title}`);
  console.log(`  status: ${prb.status} | validation_status: ${prb.validation_status}`);
  console.log(`  linked EVD: ${report.linkedEvdCount}`);
  console.log(`  EVD with analysis metadata: ${report.evdWithAnalysisCount}/${report.linkedEvdCount}`);
  console.log(`  known unique lineage_id count: ${report.knownLineageCount}`);
  console.log(`  linked EVD with lineage unassessed: ${report.missingLineageCount}`);
  console.log(`  contribution distribution: ${formatDistribution(report.contributionDistribution)}`);
  console.log(`  friction_types distribution: ${formatDistribution(report.frictionTypeDistribution)}`);
  console.log(`  verification distribution: ${formatDistribution(report.verificationDistribution)}`);
  console.log(`  temporal_relevance distribution: ${formatDistribution(report.temporalRelevanceDistribution)}`);
  console.log(`  representativeness distribution: ${formatDistribution(report.representativenessDistribution)}`);
  console.log(`  public_signal_class distribution: ${formatDistribution(report.publicSignalClassDistribution)}`);

  if (report.asmRecords.length === 0) {
    console.log("  ASM: none found");
  } else if (report.currentAsm) {
    const asm = report.currentAsm as RecordFields;
    const gateEntries = Object.entries((asm.decision_gates as Record<string, unknown>) || {});
    const gateSummary = gateEntries.map(([k, v]) => `${k}=${v}`).join(", ");
    const unknownCount = Object.keys((asm.critical_unknowns as Record<string, unknown>) || {}).length;
    console.log(`  ASM: ${asm.assessment_id} (CURRENT, as_of ${asm.as_of})`);
    console.log(`    decision_gates: ${gateSummary || "(none)"}`);
    console.log(`    critical_unknowns: ${unknownCount}`);
    console.log(`    triage: ${asm.triage} | next_action: ${asm.next_action ? asm.next_action : "(empty)"}`);
  } else {
    const others = report.asmRecords.map((a) => `${a.assessment_id}(${a.assessment_status})`).join(", ");
    console.log(`  ASM: ${report.asmRecords.length} record(s) found, none with assessment_status=CURRENT (${others})`);
  }
}

function runAll(index: CorpusIndex): void {
  const result = analyzeCorpus(index);
  console.log(
    `Corpus: ${result.summary.sourceCount} SRC, ${result.summary.evidenceCount} EVD, ${result.summary.problemCount} PRB, ${result.summary.assessmentCount} ASM (${result.summary.totalRecords} total canonical records)`
  );
  console.log("");
  for (const prbId of result.problemIds) {
    const report = result.problems.get(prbId)!;
    const currentAsm = report.currentAsm;
    const triage = currentAsm ? currentAsm.triage : "—";
    console.log(
      `${prbId} | status=${report.prb.status} | linked_evd=${report.linkedEvdCount} | evd_with_analysis=${report.evdWithAnalysisCount}/${report.linkedEvdCount} | current_asm=${currentAsm ? currentAsm.assessment_id : "no"} | triage=${triage}`
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
      : resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "research");

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
      `Cannot analyze: research corpus fails validation (${errors.length} problem(s)). Run node tools/research/validate-cli.ts for details.`
    );
    process.exitCode = 1;
    return;
  }

  if (hasAll) runAll(index);
  if (hasProblem) runProblem(index, args[problemFlagIdx + 1]);
  if (hasGaps) runGaps(index);
}

main();
