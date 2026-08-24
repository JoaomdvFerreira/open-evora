#!/usr/bin/env node
/**
 * Deterministic, zero-dependency analyzer over the canonical research/ corpus.
 * See docs/datamodel.md for record semantics and docs/investigationstrategy.md
 * for the analytical/decision rules this never itself makes.
 *
 * Allowed: counts, known-lineage counts, metadata completeness, state distributions,
 * explicit contradiction/gate/unknown reporting.
 *
 * Forbidden: semantic inference, automatic causality, prevalence inference, automatic
 * triage, any numeric confidence/problem score. This script never infers analytical
 * metadata from `notes`/free text, and never ranks or scores problems — every report
 * below is either a raw count/distribution or a verbatim field already recorded on a
 * canonical PRB, EVD, or ASM record.
 *
 * Usage:
 *   node tools/analyze-research.js --all
 *   node tools/analyze-research.js --problem PRB-0007
 *   node tools/analyze-research.js --gaps
 *   (optional: --dir <researchRoot> to point at a fixture tree instead of research/)
 *
 * Exit code 0 = report produced (even if it lists gaps); 1 = corpus fails validation
 * or usage error.
 */

const path = require("path");
const { validateResearchTree } = require("./validate-research.js");

const ACTIVE_STATUS = "OPEN";

function tally(items) {
  const counts = new Map();
  for (const it of items) {
    if (it === undefined || it === null) continue;
    counts.set(it, (counts.get(it) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function formatDistribution(entries) {
  if (entries.length === 0) return "(none recorded)";
  return entries.map(([k, n]) => `${k}=${n}`).join(", ");
}

function loadCorpus(researchRoot) {
  const { errors, totalRecords, parsedByDir } = validateResearchTree(researchRoot);
  if (errors.length > 0) {
    console.error(
      `Cannot analyze: research corpus fails validation (${errors.length} problem(s)). Run node tools/validate-research.js for details.`
    );
    process.exitCode = 1;
    return null;
  }

  const problems = (parsedByDir.get("PRB-") || { parsed: [] }).parsed;
  const evidence = (parsedByDir.get("EVD-") || { parsed: [] }).parsed;
  const assessments = (parsedByDir.get("ASM-") || { parsed: [] }).parsed;
  const sources = (parsedByDir.get("SRC-") || { parsed: [] }).parsed;

  const problemsById = new Map(problems.map((p) => [p.record.problem_id, p]));
  const evidenceById = new Map(evidence.map((e) => [e.record.evidence_id, e]));
  const assessmentsByProblem = new Map();
  for (const a of assessments) {
    const pid = a.record.problem;
    if (!assessmentsByProblem.has(pid)) assessmentsByProblem.set(pid, []);
    assessmentsByProblem.get(pid).push(a);
  }

  return {
    totalRecords,
    problems,
    evidence,
    assessments,
    sources,
    problemsById,
    evidenceById,
    assessmentsByProblem,
  };
}

function computeProblemReport(prbId, corpus) {
  const prbEntry = corpus.problemsById.get(prbId);
  if (!prbEntry) return null;
  const prb = prbEntry.record;

  const linkedEvdIds = Array.isArray(prb.evidence) ? prb.evidence : [];
  const linkedEvds = linkedEvdIds
    .map((id) => corpus.evidenceById.get(id))
    .filter(Boolean)
    .map((e) => e.record);

  const withAnalysis = linkedEvds.filter((e) => e.analysis);
  const lineageIds = withAnalysis
    .map((e) => e.analysis.lineage_id)
    .filter((v) => typeof v === "string" && v.trim() !== "");
  const knownLineageCount = new Set(lineageIds).size;
  const missingLineageCount = linkedEvds.length - lineageIds.length;

  const contributionAll = [];
  const frictionAll = [];
  const verificationAll = [];
  const temporalAll = [];
  const representativenessAll = [];
  const signalClassAll = [];
  for (const e of withAnalysis) {
    const a = e.analysis;
    if (Array.isArray(a.contribution)) contributionAll.push(...a.contribution);
    if (Array.isArray(a.friction_types)) frictionAll.push(...a.friction_types);
    if (a.verification != null) verificationAll.push(a.verification);
    if (a.temporal_relevance != null) temporalAll.push(a.temporal_relevance);
    if (a.representativeness != null) representativenessAll.push(a.representativeness);
    if (a.public_signal_class != null) signalClassAll.push(a.public_signal_class);
  }

  const asmRecords = (corpus.assessmentsByProblem.get(prbId) || []).map((a) => a.record);
  const currentAsm = asmRecords.find((a) => a.assessment_status === "CURRENT") || null;

  return {
    prbId,
    prb,
    linkedEvdCount: linkedEvdIds.length,
    evdWithAnalysisCount: withAnalysis.length,
    knownLineageCount,
    missingLineageCount,
    contributionDistribution: tally(contributionAll),
    frictionTypeDistribution: tally(frictionAll),
    verificationDistribution: tally(verificationAll),
    temporalRelevanceDistribution: tally(temporalAll),
    representativenessDistribution: tally(representativenessAll),
    publicSignalClassDistribution: tally(signalClassAll),
    asmRecords,
    currentAsm,
  };
}

function printProblemReport(report) {
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
    const asm = report.currentAsm;
    const gateEntries = Object.entries(asm.decision_gates || {});
    const gateSummary = gateEntries.map(([k, v]) => `${k}=${v}`).join(", ");
    const unknownCount = Object.keys(asm.critical_unknowns || {}).length;
    console.log(`  ASM: ${asm.assessment_id} (CURRENT, as_of ${asm.as_of})`);
    console.log(`    decision_gates: ${gateSummary || "(none)"}`);
    console.log(`    critical_unknowns: ${unknownCount}`);
    console.log(`    triage: ${asm.triage} | next_action: ${asm.next_action ? asm.next_action : "(empty)"}`);
  } else {
    const others = report.asmRecords.map((a) => `${a.assessment_id}(${a.assessment_status})`).join(", ");
    console.log(`  ASM: ${report.asmRecords.length} record(s) found, none with assessment_status=CURRENT (${others})`);
  }
}

function runAll(corpus) {
  console.log(
    `Corpus: ${corpus.sources.length} SRC, ${corpus.evidence.length} EVD, ${corpus.problems.length} PRB, ${corpus.assessments.length} ASM (${corpus.totalRecords} total canonical records)`
  );
  console.log("");
  const prbIds = [...corpus.problemsById.keys()].sort();
  for (const prbId of prbIds) {
    const report = computeProblemReport(prbId, corpus);
    const currentAsm = report.currentAsm;
    const triage = currentAsm ? currentAsm.triage : "—";
    console.log(
      `${prbId} | status=${report.prb.status} | linked_evd=${report.linkedEvdCount} | evd_with_analysis=${report.evdWithAnalysisCount}/${report.linkedEvdCount} | current_asm=${currentAsm ? currentAsm.assessment_id : "no"} | triage=${triage}`
    );
  }
}

function runProblem(corpus, prbId) {
  const report = computeProblemReport(prbId, corpus);
  if (!report) {
    console.error(`Unknown problem: "${prbId}" does not resolve to a canonical PRB-* record.`);
    process.exitCode = 1;
    return;
  }
  printProblemReport(report);
}

function runGaps(corpus) {
  const gaps = [];

  const activePrbIds = corpus.problems
    .filter((p) => p.record.status === ACTIVE_STATUS)
    .map((p) => p.record.problem_id)
    .sort();

  for (const prbId of activePrbIds) {
    const asmRecords = corpus.assessmentsByProblem.get(prbId) || [];
    if (asmRecords.length === 0) {
      gaps.push(`active ${prbId} has no ASM record`);
    } else if (!asmRecords.some((a) => a.record.assessment_status === "CURRENT")) {
      gaps.push(`active ${prbId} has ASM record(s) but none with assessment_status=CURRENT`);
    }
  }

  for (const prbId of activePrbIds) {
    const report = computeProblemReport(prbId, corpus);
    const missing = report.linkedEvdCount - report.evdWithAnalysisCount;
    if (missing > 0) {
      gaps.push(`${prbId}: ${missing}/${report.linkedEvdCount} linked EVD missing analytical metadata (analysis block absent)`);
    }
  }

  for (const a of corpus.assessments) {
    const asm = a.record;
    const gateEntries = Object.entries(asm.decision_gates || {});
    const unresolved = gateEntries.filter(([, v]) => v === "UNKNOWN" || v === "NOT_ASSESSED");
    if (unresolved.length > 0) {
      gaps.push(`${asm.assessment_id}: ${unresolved.length} decision gate(s) UNKNOWN/NOT_ASSESSED (${unresolved.map(([k, v]) => `${k}=${v}`).join(", ")})`);
    }
    const unknownCount = Object.keys(asm.critical_unknowns || {}).length;
    if (unknownCount > 0) {
      gaps.push(`${asm.assessment_id}: ${unknownCount} critical unknown(s) recorded`);
    }
    if (asm.triage === "DEEPEN" && (!asm.next_action || String(asm.next_action).trim() === "")) {
      gaps.push(`${asm.assessment_id}: triage=DEEPEN without a usable next_action`);
    }
  }

  if (gaps.length === 0) {
    console.log("No explicit machine-detectable gaps found.");
    return;
  }
  console.log(`${gaps.length} gap(s) found:`);
  for (const g of gaps) console.log(" - " + g);
}

function main() {
  const args = process.argv.slice(2);
  const dirFlagIdx = args.indexOf("--dir");
  const researchRoot =
    dirFlagIdx !== -1 && args[dirFlagIdx + 1]
      ? path.resolve(args[dirFlagIdx + 1])
      : path.resolve(__dirname, "..", "research");

  const problemFlagIdx = args.indexOf("--problem");
  const hasAll = args.includes("--all");
  const hasGaps = args.includes("--gaps");
  const hasProblem = problemFlagIdx !== -1;

  if (!hasAll && !hasGaps && !hasProblem) {
    console.error("Usage: node tools/analyze-research.js --all | --problem <PRB-ID> | --gaps [--dir <researchRoot>]");
    process.exitCode = 1;
    return;
  }

  const corpus = loadCorpus(researchRoot);
  if (!corpus) return; // loadCorpus already set exitCode and printed errors

  if (hasAll) runAll(corpus);
  if (hasProblem) runProblem(corpus, args[problemFlagIdx + 1]);
  if (hasGaps) runGaps(corpus);
}

if (require.main === module) {
  main();
}

module.exports = { loadCorpus, computeProblemReport, tally };
