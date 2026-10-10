/**
 * Builds the bounded prompt delivered to the PRIMARY_AUTHOR AI invocation
 * over stdin (WU045-B01 remediation; contract §4 "normal path must start
 * from the trigger", §5 "primary authoring contract"). This module performs
 * no research itself — it only frames the accepted trigger plus the exact
 * structured-output contract the AI process must satisfy, so deterministic
 * tooling can validate what comes back.
 */
import type { ResearchTrigger } from "./types.ts";

const ENVELOPE_CONTRACT = `Respond with a single JSON object on stdout matching exactly this shape (schemaVersion "1"):
{
  "schemaVersion": "1",
  "manifest": {
    "schemaVersion": "1",
    "mode": "daily-discovery" | "problem-refresh",
    "targetProblemId": "<required only when mode is problem-refresh>",
    "investigationQuestion": "<string>",
    "candidateFiles": ["<relative filename>", ...],
    "claimedRecordIds": ["<canonical record ID>", ...],
    "rationale": "<string>"
  },
  "candidateFiles": [
    { "path": "<matches a manifest.candidateFiles entry>", "yaml": "<complete candidate record YAML>" },
    ...
  ]
}
Do not write any file. Do not emit anything on stdout other than this JSON object.
candidateFiles and claimedRecordIds must have the same length and correspond
one-to-one. Every candidateFiles[].path in the top-level array must exactly
match one entry in manifest.candidateFiles.`;

/**
 * Citizen Language & Evidence Contract applied to authoring (canonical
 * policy: docs/investigationstrategy.md §12; EVD wording: docs/datamodel.md
 * "Observation wording and inference limits"). This operationalizes the
 * contract for the author; it is not a second version of it.
 */
const CLEC_AUTHORING_CONTRACT = `Citizen Language & Evidence Contract (CLEC) — applies to all authored text in PRB, EVD and SRC candidates, including simplified, paraphrased or translated text:
Core rule: Never make a statement stronger, broader, more certain or more causal in order to make it simpler.
Language: citizen-facing authored prose is PT-PT. Exceptions: official names, proper nouns, URLs, IDs, schema keys and canonical enum values; enum values stay in English. Citizen-facing prose that is not PT-PT, and internal process jargon in citizen-facing text (workflow, gate, lane, tooling, work-unit or review-process terms), are BLOCKING CLEC violations.
Write so a non-specialist citizen can follow. Prefer the shortest wording that preserves evidential meaning; keep longer wording only where simplifying it would alter scope, attribution, time, uncertainty, causality or other material meaning — then accuracy wins.
1. Clarity: plain, direct wording — short sentences, concrete words, each acronym explained at its first occurrence — never achieved by weakening any other dimension.
2. Specificity: name the concrete service, place, population, condition or mechanism the evidence concerns; do not replace it with a vaguer or more general category.
3. Explicit scope: state the place, population, period and conditions a statement applies to; silence must not imply wider scope.
4. Supported quantity: quantity, frequency and prevalence words (all, most, many, often, always, increasing) go no further than the evidence; prefer the evidence's own figures or ranges. Discussion volume is not prevalence.
5. Attribution: reported experiences, claims, opinions, measurements and recommendations stay attributed to who reports, claims, measures or recommends them; never turn them into unattributed fact.
6. Supported causality: causal wording (causes, leads to, because of, results in) only as far as the evidence supports; sequence, association or a reported cause stays expressed as such.
7. Temporal precision: state when a statement applies; historical is not current, planned or announced is not implemented.
8. Visible uncertainty: keep qualifiers, unknowns, contradictions and limits visible; UNKNOWN is not NO.
9. Neutral wording: descriptive, non-evaluative, non-emotive; no advocacy, blame, intensifiers or rhetorical framing.
10. Evidence fidelity: every statement is traceable to, and neither materially stronger nor materially weaker than, its supporting evidence — PRB text to its linked EVD, EVD text to its Source.
Symmetric fidelity: documented is not unknown, just as UNKNOWN is not NO. Do not materially strengthen or weaken the Evidence, and do not omit materially relevant linked Evidence where that omission makes the current PRB reading misleading.
Simplification must never change evidential meaning. Paraphrase and translation (including into PT-PT) must preserve qualifiers, attribution, scope, temporal markers and uncertainty, and must not strengthen, broaden or resolve what the original leaves qualified or uncertain.
Record-specific emphasis:
- PRB: strictest neutrality, scope and causality. Problem-level synthesis is neutral and scoped, and never broader, stronger or more causal than its supporting EVD and their inference_limits. The linked EVD is the complete evidential boundary for PRB wording: SRC content and Source Verification Support cannot justify PRB wording beyond it.
- EVD: strictest fidelity to the Source. observation.summary preserves the Source's meaning, attribution, qualifications and the observation's inference limits; a translation or paraphrase must not strengthen the Source. Non-factual observations (reported experience, claim, opinion, recommendation) are attributed, not stated as fact.
- SRC: strictest preservation and provenance. Record the Source's provenance and published identity as published; add no evaluative statement about what the Source proves or how strong it is.
Checking your own wording against these dimensions is expected, but author self-review does not substitute for the independent semantic review every canonical research text change requires.`;

/**
 * Bounded PRB semantic guardrails (docs/datamodel.md §3 "Problem reading and
 * investigation semantics"). Existing corpus wording is not a sufficient
 * template, so the distinctions are stated here rather than left implicit.
 */
const PRB_SEMANTIC_GUARDRAILS = `PRB semantic guardrails (existing corpus wording is not a template that licenses a claim):
- Claim strength: problem_statement and causal_reading must not assert more causal strength than the linked Evidence and its inference_limits support. causal_reading is a bounded interpretation, not a proven cause; do not build it by selecting or ranking a convenient subset of Evidence.
- investigation.open_questions[] fields are distinct: latest_result = current result/knowledge for that question; why_open = why it remains unresolved; resolution_condition = evidential/decision condition to resolve or reopen it; current_action = current investigation activity. Do not merge or substitute one for another.
- current_action is free text: a token such as WATCH carries no structured posture meaning.
- evidence[] on a question or relationship does not license stronger wording; never link Evidence merely to rescue unsupported wording.
- Currentness: updated_at is edit metadata. Do not infer or assert currentness from updated_at, Source/Evidence dates, or absence of contradiction.
- investigation.path is a narrative of how the formulation was reached, not a progress/completion/pending state.
- PRB evidence[].effects and evidence[].research_roles are independent: choose each on its own terms.
- Preserve unresolved or contradictory Evidence with its boundary stated; do not suppress it or resolve it by wording.
- Optional fields stay optional: omit them when not explicitly supported; do not invent values to fill them.
- Framing: frame the Problem around the documented manifestation or condition first; keep unresolved causality or consequence as an open question.
- Every resolution_condition must be realistically reachable by the project's supported investigation methods: (1) relevant public information, prioritising competent or claim-authoritative Sources, with secondary, public, social or contextual Sources in their bounded role (discovery, context, reported experience, corroboration); (2) contact with relevant institutions, operators or companies for clarification, follow-up or direct challenge. Contact is not itself Evidence; non-response is not Evidence.
- Before writing that current state is not established, make a proportionate check for current public primary or claim-authoritative information where that check is realistically possible. If this run cannot perform that check, do not write or imply that it was performed.`;

/**
 * Builds the complete bounded stdin payload for the primary invocation. The
 * trigger's `request` field frames the investigation; everything else in
 * this prompt is the fixed structural contract, not free-form guidance the
 * AI process could reinterpret to skip the envelope.
 */
export function buildPrimaryAuthoringPrompt(trigger: ResearchTrigger): string {
  const lines = [
    `Research mode: ${trigger.mode}`,
    trigger.targetProblemId ? `Target problem: ${trigger.targetProblemId}` : undefined,
    `Research request: ${trigger.request}`,
    "",
    "Author complete, schema-valid candidate records for this request using the",
    "canonical record shape already in use in this repository's research corpus.",
    "Do not invent fields. Do not modify canonical records; author new/updated",
    "candidates only.",
    "",
    CLEC_AUTHORING_CONTRACT,
    "",
    PRB_SEMANTIC_GUARDRAILS,
    "",
    ENVELOPE_CONTRACT,
  ].filter((line): line is string => line !== undefined);
  return lines.join("\n");
}
