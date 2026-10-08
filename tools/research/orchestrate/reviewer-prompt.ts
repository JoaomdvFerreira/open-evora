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
 * Citizen Language & Evidence Contract semantic review criteria (canonical
 * policy: docs/investigationstrategy.md §12). Findings are expressed through
 * the existing outcome and rationale; this adds no result fields.
 */
const CLEC_REVIEW_CRITERIA = `Citizen Language & Evidence Contract (CLEC) semantic review.
Core rule: Never make a statement stronger, broader, more certain or more causal in order to make it simpler.
Compare each authored claim with its supporting evidence as represented in the package — PRB text with its linked EVD, EVD text with its Source, SRC text with the published Source identity. Reading the text in isolation is not semantic review. Assess each of the 10 CLEC dimensions against that evidence:
1. Clarity — is the wording plain for a non-specialist without weakening any other dimension?
2. Specificity — is a concrete service, place, population, condition or mechanism replaced by a vaguer or more general category?
3. Explicit scope — is scope hidden, unstated or wider than supported (place, population, period, conditions)?
4. Supported quantity — do quantity, frequency or prevalence terms exceed the evidence? Discussion volume is not prevalence.
5. Attribution — has a reported experience, claim, opinion, measurement or recommendation lost its attribution and become unattributed fact?
6. Supported causality — does causal wording exceed what the evidence supports, or turn sequence, association or a reported cause into an established cause?
7. Temporal precision — has the text drifted in time: historical presented as current, planned or announced presented as implemented, or no stated period?
8. Visible uncertainty — are qualifiers, unknowns, contradictions or limits hidden or dropped? UNKNOWN is not NO.
9. Neutral wording — is there biased, evaluative, emotive or advocacy framing, blame, intensifiers or rhetoric?
10. Evidence fidelity — is each statement traceable to, and no stronger than, its supporting evidence? Check Source→EVD fidelity: an EVD observation that loses the Source's meaning, attribution, qualifications or inference limits is a fidelity loss. Check that no translation or paraphrase strengthens, broadens or resolves the Source, and that no simplification changes evidential meaning.
Record-specific emphasis: PRB — strictest neutrality, scope and causality; synthesis never broader, stronger or more causal than its EVD and their inference_limits. EVD — strictest fidelity to the Source. SRC — provenance and published identity preserved; no evaluative statement about what the Source proves or how strong it is.
Challenge vague or loaded wording contextually. Terms such as "vários", "zonas-chave", "significativo", "muitos", "sempre" or "causa" are signals to examine, not banned words and not automatic violations: the evidence and its context decide whether the same wording is supported or unsupported.
A CLEC defect that makes a statement stronger, broader, more certain or more causal than its evidence, or that changes evidential meaning, is grounds for DISAGREEMENT_FOUND. If the package lacks the evidence needed to compare a claim, that is grounds for INSUFFICIENT_EVIDENCE. In the rationale, name each such issue with its record, field and CLEC dimension.`;

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
    CLEC_REVIEW_CRITERIA,
    "",
    "REVIEW INPUT (immutable, JSON):",
    frozenReviewerInputJson,
    "",
    RESULT_CONTRACT,
  ].join("\n");
}
