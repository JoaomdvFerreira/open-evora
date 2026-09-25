/**
 * Builds the bounded prompt delivered to the INDEPENDENT_REVIEWER AI
 * invocation over stdin (WU045-B01 remediation; contract §9 OD-B point 6,
 * §6 "independent review contract"). Combines the fixed structured-result
 * contract with the frozen reviewer input package (reviewer-input.ts) —
 * never anything else. This is the only text the reviewer process receives;
 * there is no separate channel by which additional context could reach it.
 */
const RESULT_CONTRACT = `Respond with a single JSON object on stdout matching exactly this shape (schemaVersion "1"):
{
  "schemaVersion": "1",
  "outcome": "CONCUR" | "DISAGREEMENT_FOUND" | "INSUFFICIENT_EVIDENCE",
  "rationale": "<string>"
}
Do not emit anything on stdout other than this JSON object.`;

/**
 * `frozenReviewerInputJson` must be exactly the canonical JSON string
 * produced by buildReviewerInput() — this function does not re-derive or
 * reformat it, so the text the reviewer actually sees is provably identical
 * to what was frozen for it.
 */
export function buildReviewerPrompt(frozenReviewerInputJson: string): string {
  return [
    "You are performing an independent review of the following already-authored",
    "research candidate package. You did not author it. Evaluate only the",
    "material below, including the deterministic validation/readiness results",
    "it contains. Assess whether:",
    "- claims are adequately supported by the linked Evidence;",
    "- Evidence inference limits are respected;",
    "- candidates are internally consistent;",
    "- contradictions and boundaries are represented faithfully;",
    "- unresolved contradiction is explicitly bounded where relevant;",
    "- no unsupported certainty (causal strength, currentness, prevalence, effectiveness) was introduced.",
    "A faithfully preserved, bounded unresolved contradiction is legitimate",
    "research state, not a defect: on its own it is not grounds for",
    "DISAGREEMENT_FOUND or INSUFFICIENT_EVIDENCE.",
    "",
    "REVIEW INPUT (immutable, JSON):",
    frozenReviewerInputJson,
    "",
    RESULT_CONTRACT,
  ].join("\n");
}
