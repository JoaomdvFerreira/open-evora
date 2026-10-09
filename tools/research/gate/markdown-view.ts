/**
 * Renders the human-readable Markdown view of a Human Gate package (OD-C,
 * Option 3). Generated
 * from the exact same validated in-memory HumanGatePackage object the
 * contentHash is computed over (content-hash.ts) — never a re-read or
 * re-derived copy, and never itself the hashed source of truth (the JSON is).
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
  return bulletList([...findings.map((f) => `${f.code}${f.field ? ` (${f.field})` : ""}${f.detail ? `: ${f.detail}` : ""}`), ...admission.map((f) => `${f.code} (${f.subjectId}): ${f.summary}${f.evidenceReferences?.length ? ` [${f.evidenceReferences.join(", ")}]` : ""}`)]);
}

function code(value: string): string {
  return `\`${value}\``;
}

function idList(ids: readonly string[] | undefined): string {
  return ids && ids.length > 0 ? ids.map(code).join(", ") : "_none_";
}

/** Verbatim authored text as a blockquote; every line is kept, nothing is rewritten. */
function quote(text: string): string {
  return text.split("\n").map((line) => `  > ${line}`).join("\n");
}

const DISPOSITION_ORDER = ["SUPPORTED", "VIOLATION", "NOT_APPLICABLE", "INSUFFICIENT_EVIDENCE"] as const;

function renderReviewSummary(pkg: HumanGatePackage): string {
  const review = pkg.independentReview;
  const counts = DISPOSITION_ORDER.map((value) => `${value} ${review.signalDispositions.filter((d) => d.disposition === value).length}`);
  const lines = [
    `Outcome: ${code(review.outcome)}  `,
    `Rationale: ${review.rationale}  `,
    `Findings: ${review.findings.length}  `,
    `Reviewed signals: ${pkg.reviewSignals.length}  `,
    `Signal dispositions: ${counts.join(" · ")}`,
    "",
  ];
  if (review.outcome !== "CONCUR") {
    lines.push(
      `**Canonical APPROVE is unavailable for this package:** the independent semantic review outcome is ${code(review.outcome)}, not ${code("CONCUR")}. ` +
      "A blocking finding or evidence gap cannot be approved by acknowledgement; it requires a new compliant candidate/review/package cycle that reaches CONCUR. " +
      "REJECT or HOLD_MORE_RESEARCH remain the reviewing human's own decision.",
      ""
    );
  }
  lines.push("Deterministic CLEC signals are review prompts, not violations; only the reviewer's dispositions and findings below judge the wording against the supplied evidence. `UNKNOWN` is not `NO`.");
  return lines.join("\n");
}

function renderFindings(pkg: HumanGatePackage): string {
  const findings = pkg.independentReview.findings;
  if (findings.length === 0) return "_No findings: the independent review recorded 0 findings._";
  return findings
    .map((finding) => [
      heading(4, `${finding.findingId} — ${finding.kind} (${finding.severity})`),
      ...(finding.kind === "INSUFFICIENT_EVIDENCE"
        ? ["_Evidence gap: the supplied evidence context cannot decide whether this wording is supported._", ""]
        : []),
      `- Record: ${code(finding.recordId)}`,
      `- Field: ${code(finding.field)}`,
      `- CLEC dimension: ${code(finding.dimension)}`,
      `- Kind: ${code(finding.kind)}`,
      `- Severity: ${code(finding.severity)}`,
      "- Claim (verbatim):",
      quote(finding.claim),
      `- Reason: ${finding.reason}`,
      `- Evidence references: ${idList(finding.evidenceReferences)}`,
      `- Correction direction: ${finding.correctionDirection}`,
      `- Related signals: ${idList(finding.relatedSignalIds)}`,
    ].join("\n"))
    .join("\n\n");
}

function renderSignalDispositions(pkg: HumanGatePackage): string {
  if (pkg.reviewSignals.length === 0) return "_No deterministic CLEC signals were supplied to the independent reviewer for these candidates._";
  const dispositions = new Map(pkg.independentReview.signalDispositions.map((d) => [d.signalId, d]));
  return pkg.reviewSignals
    .map(({ signalId, signal }) => {
      const disposition = dispositions.get(signalId);
      return [
        heading(4, `${signalId} — ${signal.code} → ${disposition ? disposition.disposition : "NO DISPOSITION"}`),
        `- Signal code: ${code(signal.code)}`,
        `- CLEC dimension: ${code(signal.dimension)}`,
        `- Subject record: ${code(signal.subjectId)}`,
        `- Field: ${code(signal.field)}`,
        ...(signal.match !== undefined ? [`- Matched text: ${code(signal.match)}`] : []),
        ...(signal.evidenceReferences !== undefined ? [`- Signal evidence references: ${idList(signal.evidenceReferences)}`] : []),
        "- Excerpt (verbatim):",
        quote(signal.excerpt),
        ...(disposition
          ? [
            `- Disposition: ${code(disposition.disposition)}`,
            `- Disposition reason: ${disposition.reason}`,
            `- Disposition evidence references: ${idList(disposition.evidenceReferences)}`,
            `- Related findings: ${idList(disposition.relatedFindingIds)}`,
          ]
          : ["- Disposition: _none recorded_"]),
      ].join("\n");
    })
    .join("\n\n");
}

function renderEvidenceContext(pkg: HumanGatePackage): string {
  const records = pkg.reviewEvidenceContext.length === 0
    ? "_No non-candidate records were in the reviewer's evidence context._"
    : bulletList(pkg.reviewEvidenceContext.map((record) => `${code(record.id)} (${record.recordFamily})`));
  return [
    "The Human Gate package JSON is the source of truth and carries these bounded review-context records in full (`reviewEvidenceContext`). " +
    "Canonical SRC- records carry provenance and metadata, not the Source body; no Source content was fetched or reproduced.",
    "",
    records,
  ].join("\n");
}

function renderSourceVerificationSupport(pkg: HumanGatePackage): string {
  const support = pkg.reviewSourceVerificationContext ?? [];
  const entries = support.length === 0
    ? "_No Source Verification Support was supplied to the independent reviewer._"
    : support
      .map((entry) => [
        `- ${code(entry.source_id)} — retrieved ${entry.retrieval.retrieved_at}, ${code(entry.retrieval.media_type)}, sha256 ${code(entry.retrieval.content_sha256)}` +
          (entry.retrieval.archive_reference !== undefined ? `, archive: ${entry.retrieval.archive_reference}` : ""),
        ...entry.verified_claims.map((claim) => `  - ${code(claim.locator)}: ${claim.statement}`),
      ].join("\n"))
      .join("\n");
  return [
    "Review support, not canonical Evidence and not Source text: bounded factual paraphrases verified upstream against captured Source bytes, read from the review base. " +
    "It does not establish completeness — a Source or claim without support is `UNKNOWN`, never `NO`. " +
    "The Human Gate package JSON carries it in full (`reviewSourceVerificationContext`).",
    "",
    entries,
  ].join("\n");
}

function renderSemanticReview(pkg: HumanGatePackage): string {
  return [
    heading(2, "Independent semantic review (CLEC)"),
    renderReviewSummary(pkg),
    "",
    heading(3, "Findings"),
    renderFindings(pkg),
    "",
    heading(3, "Signal dispositions"),
    renderSignalDispositions(pkg),
    "",
    heading(3, "Review evidence context"),
    renderEvidenceContext(pkg),
    "",
    heading(3, "Source Verification Support (review context, not Evidence)"),
    renderSourceVerificationSupport(pkg),
  ].join("\n");
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
    renderSemanticReview(pkg),
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
