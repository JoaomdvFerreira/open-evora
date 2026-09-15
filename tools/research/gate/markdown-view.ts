/**
 * Renders the human-readable Markdown view of a Human Gate package (OD-C,
 * Option 3; docs/design/m013-launch-automation-contract.md §12). Generated
 * from the exact same validated in-memory HumanGatePackage object HIGH-2's
 * contentHash is computed over (content-hash.ts) — never a re-read or
 * re-derived copy, and never itself the hashed source of truth (the JSON is
 * — HIGH-2 step 4/§12).
 *
 * This is a pure, deterministic presentation function: given the same
 * package object it always produces the same Markdown text. It performs no
 * filesystem or Git access and computes no identity of its own.
 */
import { computeContentHash, shortFingerprint } from "./content-hash.ts";
import type { HumanGatePackage } from "./types.ts";

function heading(level: number, text: string): string {
  return `${"#".repeat(level)} ${text}`;
}

function bulletList(items: readonly string[]): string {
  return items.length === 0 ? "_None recorded._" : items.map((item) => `- ${item}`).join("\n");
}

function renderDeltas(pkg: HumanGatePackage): string {
  if (pkg.deltas.length === 0) return "_No deltas._";
  const rows = pkg.deltas.map((delta) => `| ${delta.recordFamily}${delta.id} | ${delta.action} |`);
  return ["| Record | Action |", "|---|---|", ...rows].join("\n");
}

function renderReadiness(pkg: HumanGatePackage): string {
  if (pkg.affectedProblemReadiness.length === 0) return "_No affected PRB-* readiness results (none of the affected problems currently exist in the canonical corpus)._";
  return pkg.affectedProblemReadiness
    .map((report) => {
      const eligibilityReasons = report.eligibility.reasons.map((r) => `  - ${r.code}${r.field ? ` (${r.field})` : ""}${r.detail ? `: ${r.detail}` : ""}`);
      const corroborationReasons = report.corroboration.reasons.map((r) => `  - ${r.code}${r.field ? ` (${r.field})` : ""}${r.detail ? `: ${r.detail}` : ""}`);
      return [
        `**${report.problem_id}**`,
        `- Eligibility: \`${report.eligibility.result}\``,
        ...eligibilityReasons,
        `- Corroboration: \`${report.corroboration.result}\``,
        ...corroborationReasons,
      ].join("\n");
    })
    .join("\n\n");
}

function renderContradictionAndOverlapAnalysis(pkg: HumanGatePackage): string {
  const findings = pkg.affectedProblemReadiness.flatMap((report) => [
    ...report.eligibility.reasons.filter((r) => r.code.includes("CONTRADICTION") || r.code.includes("OVERLAP")),
    ...report.corroboration.reasons.filter((r) => r.code.includes("CONTRADICTION")),
  ]);
  const admission = pkg.safetyAdmission.findings.filter((f) => f.code === "CONTRADICTION_VISIBLE");
  if (findings.length === 0 && admission.length === 0) return "_No contradiction/duplicate-overlap findings surfaced by readiness evaluation._";
  return bulletList([...findings.map((f) => `${f.code}${f.field ? ` (${f.field})` : ""}${f.detail ? `: ${f.detail}` : ""}`), ...admission.map((f) => `${f.code} (${f.subjectId}): ${f.summary}`)]);
}

function renderCandidateScope(pkg: HumanGatePackage): string {
  return bulletList(pkg.candidates.map((candidate) => `${candidate.recordFamily} record (fields: ${Object.keys(candidate.fields).join(", ")})`));
}

/** Renders the complete Markdown human-review view for `pkg`. */
export function renderHumanGateMarkdown(pkg: HumanGatePackage): string {
  const contentHash = computeContentHash(pkg);
  const fingerprint = shortFingerprint(contentHash);

  return [
    heading(1, "Human Gate Review — Not an Approval Until You Decide"),
    "",
    `**Package ID:** \`${pkg.packageId}\`  `,
    `**Short fingerprint (identity/audit only — not the binding mechanism):** \`${fingerprint}\`  `,
    `**Base Git SHA:** \`${pkg.baseGitSha}\`  `,
    `**Readiness (structural):** \`${pkg.researchChangeSet.readiness}\`  `,
    `**Independent AI review outcome:** \`${pkg.independentReview.outcome}\``,
    "",
    heading(2, "Investigation question"),
    pkg.investigationQuestion,
    "",
    heading(2, "Claim scope / candidate records"),
    renderCandidateScope(pkg),
    "",
    heading(2, "Proposed deltas"),
    renderDeltas(pkg),
    "",
    heading(2, "Provenance"),
    `Mode: \`${pkg.manifest.mode}\`${pkg.manifest.targetProblemId ? ` (target: ${pkg.manifest.targetProblemId})` : ""}  `,
    `Rationale: ${pkg.manifest.rationale}`,
    "",
    heading(2, "Inference limits"),
    "This package presents structural/deterministic results only. Neither prospective validation, readiness evaluation, nor the independent AI review makes a semantic research judgement (real-world truth, sufficiency, or civic importance) — those remain the reviewing human's own responsibility.",
    "",
    heading(2, "Affected existing PRBs"),
    pkg.affectedProblemIds.length === 0 ? "_None._" : bulletList(pkg.affectedProblemIds),
    "",
    heading(2, "Contradiction / duplicate-overlap analysis"),
    renderContradictionAndOverlapAnalysis(pkg),
    "",
    heading(2, "Prospective validation result"),
    `Errors: ${pkg.prospectiveValidation.errors.length}  `,
    pkg.prospectiveValidation.errors.length > 0 ? bulletList(pkg.prospectiveValidation.errors) : "_No validation errors._",
    "",
    heading(2, "Structured readiness result (readiness.ts)"),
    renderReadiness(pkg),
    "",
    heading(2, "Independent AI review"),
    `Outcome: \`${pkg.independentReview.outcome}\`  `,
    `Rationale: ${pkg.independentReview.rationale}`,
    "",
    heading(2, "Canonical integration plan"),
    pkg.integrationPlan === null
      ? "_No integration plan attached (package is not eligible for canonical promotion)._"
      : `Base SHA: \`${pkg.integrationPlan.baseGitSha}\`  \nOperations: ${pkg.integrationPlan.operations.length}`,
    "",
    heading(2, "Expected Explorer / public effect"),
    bulletList(pkg.expectedPublicEffect),
    "",
    heading(2, "Risks / unresolved uncertainties"),
    bulletList(pkg.risksAndUncertainties),
    "",
    heading(2, "Non-authoritative recommendation"),
    "> " + pkg.nonAuthoritativeRecommendation,
    "",
    "---",
    "",
    "**This document is a review aid, not a decision. AI-produced content above (including the independent review and the recommendation line) never constitutes approval. Only an explicit human decision, submitted and bound per the approval protocol, can approve this package.**",
    "",
  ].join("\n");
}
