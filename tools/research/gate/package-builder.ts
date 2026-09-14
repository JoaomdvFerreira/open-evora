/**
 * Assembles the WU046 Human Gate package (OD-C, Option 3; docs/design/
 * m013-launch-automation-contract.md §12) from an already-validated WU045
 * Research Change Set plus a read-only invocation of the existing
 * readiness.ts machinery (EVT-301 WU046 scope transfer).
 *
 * This module performs pre-Gate analysis only:
 *  - it never writes canonical/public research;
 *  - it never generates new research/candidate material;
 *  - it invokes evaluateEligibility()/evaluateCorroboration() exactly as
 *    they exist today (readiness.ts, imported via ../index.ts), with no
 *    reimplementation of eligibility/corroboration logic and no change to
 *    ReasonCodes or readiness rules.
 *
 * The returned HumanGatePackage is the exact validated in-memory object
 * both the Markdown view (markdown-view.ts) and the HIGH-2 contentHash
 * (content-hash.ts) are derived from — this module is the single assembly
 * point so those two consumers can never silently diverge.
 */
import { evaluateProblem } from "../readiness/readiness.ts";
import type { ReadinessReport } from "../readiness/readiness.ts";
import type { CorpusIndex } from "../core/types.ts";
import type { ResearchChangeSet } from "../orchestrate/types.ts";
import { validateHumanGatePackage } from "./package-validator.ts";
import type { HumanGatePackage } from "./types.ts";

export interface BuildHumanGatePackageResult {
  errors: string[];
  pkg?: HumanGatePackage;
}

/**
 * Affected PRB-* IDs: every PRB-* delta target in this package, plus the
 * manifest's targetProblemId when the cycle was a problem-refresh (a
 * refresh cycle may leave a PRB's own record unchanged (NO_CHANGE) while
 * still substantively concerning it via new/updated SRC-/EVD- evidence).
 * This is a structural derivation over already-computed deltas/manifest
 * fields only — it asserts no new relationship and performs no semantic
 * judgement.
 */
function deriveAffectedProblemIds(changeSet: ResearchChangeSet): string[] {
  const ids = new Set<string>();
  for (const delta of changeSet.deltas) {
    if (delta.recordFamily === "PRB-") ids.add(delta.id);
  }
  if (changeSet.manifest.mode === "problem-refresh" && changeSet.manifest.targetProblemId) {
    ids.add(changeSet.manifest.targetProblemId);
  }
  return [...ids].sort();
}

/**
 * Read-only readiness invocation for every affected PRB-* that already
 * exists in the canonical index (evaluateProblem() returns null for a
 * PRB-* that does not yet resolve in `index` — e.g. one this very package
 * proposes to CREATE — which is not itself an error: a not-yet-canonical
 * PRB has no prior readiness state to report, and its own delta/validation
 * result is already exposed elsewhere in the package).
 */
function evaluateAffectedProblems(index: CorpusIndex, affectedProblemIds: readonly string[]): ReadinessReport[] {
  const reports: ReadinessReport[] = [];
  for (const problemId of affectedProblemIds) {
    const report = evaluateProblem(problemId, index);
    if (report) reports.push(report);
  }
  return reports;
}

function deriveExpectedPublicEffect(changeSet: ResearchChangeSet): string[] {
  const creates = changeSet.deltas.filter((delta) => delta.action === "CREATE");
  const updates = changeSet.deltas.filter((delta) => delta.action === "UPDATE");
  const noChange = changeSet.deltas.filter((delta) => delta.action === "NO_CHANGE");
  const lines: string[] = [];
  if (creates.length > 0) {
    lines.push(`${creates.length} new canonical record(s) would be created: ${creates.map((d) => `${d.recordFamily}${d.id}`).join(", ")}`);
  }
  if (updates.length > 0) {
    lines.push(`${updates.length} existing canonical record(s) would be updated: ${updates.map((d) => `${d.recordFamily}${d.id}`).join(", ")}`);
  }
  if (noChange.length > 0) {
    lines.push(`${noChange.length} candidate(s) resolve to NO_CHANGE and would not alter the canonical corpus.`);
  }
  if (changeSet.integrationPlan === null) {
    lines.push("No integration plan is attached; canonical promotion is not available for this package.");
  }
  return lines;
}

function deriveRisksAndUncertainties(changeSet: ResearchChangeSet, affectedProblemReadiness: readonly ReadinessReport[]): string[] {
  const risks: string[] = [];
  if (changeSet.independentReview.outcome === "DISAGREEMENT_FOUND") {
    risks.push(`Independent AI review found DISAGREEMENT_FOUND: ${changeSet.independentReview.rationale}`);
  }
  if (changeSet.independentReview.outcome === "INSUFFICIENT_EVIDENCE") {
    risks.push(`Independent AI review found INSUFFICIENT_EVIDENCE: ${changeSet.independentReview.rationale}`);
  }
  for (const report of affectedProblemReadiness) {
    if (report.eligibility.result === "REVIEW_REQUIRED") {
      risks.push(`${report.problem_id}: eligibility REVIEW_REQUIRED (${report.eligibility.reasons.map((r) => r.code).join(", ") || "no reasons recorded"})`);
    }
    if (report.corroboration.result === "REVIEW_REQUIRED") {
      risks.push(`${report.problem_id}: corroboration REVIEW_REQUIRED (${report.corroboration.reasons.map((r) => r.code).join(", ") || "no reasons recorded"})`);
    }
  }
  if (changeSet.validation.errors.length > 0) {
    risks.push(`Prospective validation reported ${changeSet.validation.errors.length} error(s).`);
  }
  return risks;
}

function deriveNonAuthoritativeRecommendation(changeSet: ResearchChangeSet, risksAndUncertainties: readonly string[]): string {
  const base = changeSet.readiness === "READY_FOR_INTEGRATION_GATE" && changeSet.independentReview.outcome === "CONCUR" && risksAndUncertainties.length === 0
    ? "Structural checks and independent review raise no flags; this is a non-authoritative observation only, not an approval."
    : "One or more structural/readiness/independent-review flags were raised; review the details below before deciding. This is a non-authoritative observation only, not an approval.";
  return `[NON-AUTHORITATIVE — DOES NOT CONSTITUTE APPROVAL] ${base}`;
}

/**
 * Builds and validates a Human Gate package from an already-validated
 * Research Change Set. `index` must be the same canonical CorpusIndex the
 * caller used to load/validate the corpus at baseGitSha (readiness.ts
 * assumes an already-validated index — see its own module doc).
 */
export function buildHumanGatePackage(index: CorpusIndex, changeSet: ResearchChangeSet): BuildHumanGatePackageResult {
  const affectedProblemIds = deriveAffectedProblemIds(changeSet);
  const affectedProblemReadiness = evaluateAffectedProblems(index, affectedProblemIds);
  const risksAndUncertainties = deriveRisksAndUncertainties(changeSet, affectedProblemReadiness);

  const pkg: HumanGatePackage = {
    schemaVersion: "1",
    packageId: changeSet.packageId,
    baseGitSha: changeSet.baseGitSha,
    researchChangeSet: changeSet,
    investigationQuestion: changeSet.manifest.investigationQuestion,
    candidates: changeSet.candidates,
    deltas: changeSet.deltas,
    prospectiveValidation: changeSet.validation,
    independentReview: changeSet.independentReview,
    integrationPlan: changeSet.integrationPlan,
    manifest: changeSet.manifest,
    affectedProblemReadiness,
    affectedProblemIds,
    expectedPublicEffect: deriveExpectedPublicEffect(changeSet),
    risksAndUncertainties,
    nonAuthoritativeRecommendation: deriveNonAuthoritativeRecommendation(changeSet, risksAndUncertainties),
  };

  const validation = validateHumanGatePackage(pkg);
  if (validation.errors.length > 0) {
    return { errors: validation.errors };
  }
  return { errors: [], pkg };
}
