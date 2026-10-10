/**
 * Builds the bounded prompt delivered to the INDEPENDENT_REVIEWER AI
 * invocation over stdin (WU045-B01 remediation; contract §9 OD-B point 6,
 * §6 "independent review contract"). Combines the fixed structured-result
 * contract with the frozen reviewer input package (reviewer-input.ts) —
 * never anything else. This is the only text the reviewer process receives;
 * there is no separate channel by which additional context could reach it.
 */
import { CLEC_DIMENSION } from "../language/signals.ts";
import { reviewSourceEligibility, type ReviewerInputPackage } from "./reviewer-input.ts";

const DIMENSION_VALUES = Object.values(CLEC_DIMENSION).map((dimension) => `"${dimension}"`).join(" | ");

/**
 * The structured v2 result contract. Its rules mirror the deterministic
 * checks in independent-review.ts, which reject any result that breaks them.
 */
const RESULT_CONTRACT = `Respond with a single JSON object on stdout matching exactly this shape (schemaVersion "2"), with no other fields:
{
  "schemaVersion": "2",
  "outcome": "CONCUR" | "DISAGREEMENT_FOUND" | "INSUFFICIENT_EVIDENCE",
  "rationale": "<string>",
  "findings": [
    {
      "findingId": "CLEC-FND-0001",
      "recordId": "<candidate record ID>",
      "field": "<dotted path of an authored text field of that candidate; list items indexed, e.g. inference_limits[0]>",
      "claim": "<exact verbatim excerpt of that field's text>",
      "dimension": ${DIMENSION_VALUES},
      "kind": "CLEC_VIOLATION" | "INSUFFICIENT_EVIDENCE",
      "severity": "BLOCKING" | "ADVISORY",
      "reason": "<string>",
      "evidenceReferences": ["<record ID present in the review input>"],
      "correctionDirection": "<what must be corrected — never replacement text>",
      "relatedSignalIds": ["CLEC-SIG-0001"]
    }
  ],
  "signalDispositions": [
    {
      "signalId": "CLEC-SIG-0001",
      "disposition": "SUPPORTED" | "VIOLATION" | "NOT_APPLICABLE" | "INSUFFICIENT_EVIDENCE",
      "reason": "<string>",
      "evidenceReferences": ["<record ID present in the review input>"],
      "relatedFindingIds": ["CLEC-FND-0001"]
    }
  ]
}
Structured result rules:
- Give every entry of the input "signals" exactly one disposition, by its signalId. A signal is a prompt to examine, never an automatic violation and never a pass.
- SUPPORTED: the flagged wording is relevant and the supplied evidence supports it; name that evidence in evidenceReferences. Never SUPPORTED by assumption.
- VIOLATION: the flagged wording is relevant and semantic review confirms a CLEC defect; link at least one CLEC_VIOLATION finding.
- NOT_APPLICABLE: the signal is contextually irrelevant or a false positive for its CLEC dimension. Never use it for missing evidence.
- INSUFFICIENT_EVIDENCE: the signal is relevant but the supplied review input lacks the evidence to decide support versus violation; link at least one INSUFFICIENT_EVIDENCE finding. Never call it a VIOLATION merely because evidence is unavailable.
- PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE, PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE and PRB_TEMPORAL_TERM_NOT_IN_LINKED_EVIDENCE: SUPPORTED is valid only when evidenceReferences cite an EVD the PRB links whose observation.summary or scope contains the term. An SRC record, Source Verification Support, an EVD the PRB does not link, or a mention only in inference_limits never supports the term; tooling rejects any other SUPPORTED. In a coherent package SUPPORTED is not expected for these signals: the signal is emitted only because no linked EVD carries the exact term. Use NOT_APPLICABLE when the match is a lexical false positive or the linked EVD states the same scope in equivalent words (contextual equivalence). VIOLATION and INSUFFICIENT_EVIDENCE keep their meanings above.
- SUPPORTED and NOT_APPLICABLE dispositions link no findings. Every link is mutual: a finding lists the signal in relatedSignalIds exactly when that signal's disposition lists the finding in relatedFindingIds, and the finding's recordId is the signal's subjectId.
- Report semantic defects as findings even where no signal flagged them (relatedSignalIds []). A finding quotes the authored candidate text verbatim in claim and cites the review-input records it was judged against in evidenceReferences.
- Every finding must have at least one evidenceReferences entry; evidenceReferences: [] is invalid. Every cited record ID must exist in the immutable review input (as a candidate or in evidenceContext).
- When judging a finding against another EVD or SRC, cite the relevant EVD or SRC record. For an intrinsic inconsistency in a candidate record where no separate evidence record applies, the candidate recordId itself may be cited. For an evidence-gap finding, cite the record whose supplied context is insufficient.
- An INSUFFICIENT_EVIDENCE finding is always BLOCKING. A CLEC_VIOLATION finding is BLOCKING when it makes a statement stronger, broader, more certain or more causal than its evidence, materially weakens it, or otherwise changes evidential meaning; when it is citizen-facing prose that is not PT-PT; or when it puts internal process jargon in citizen-facing text. Otherwise it is ADVISORY.
- Outcome: DISAGREEMENT_FOUND if any BLOCKING CLEC_VIOLATION finding or VIOLATION disposition exists; otherwise INSUFFICIENT_EVIDENCE if any INSUFFICIENT_EVIDENCE finding or disposition exists; otherwise CONCUR. Keep every evidence-gap finding even when the outcome is DISAGREEMENT_FOUND.
- Do not rewrite canonical records: correctionDirection says what must change, not the replacement wording.
- Before emitting stdout, self-check the complete JSON against this result contract, including every finding, evidenceReferences entry, signal disposition, and cross-link.
Do not emit anything on stdout other than this JSON object.`;

/**
 * Citizen Language & Evidence Contract semantic review criteria (canonical
 * policy: docs/investigationstrategy.md §12). Findings are expressed as
 * structured findings and signal dispositions (RESULT_CONTRACT).
 */
const CLEC_REVIEW_CRITERIA = `Citizen Language & Evidence Contract (CLEC) semantic review.
Core rule: Never make a statement stronger, broader, more certain or more causal in order to make it simpler.
Compare each authored claim with its supporting evidence as represented in the package — PRB text with its linked EVD, EVD text with its Source, SRC text with the published Source identity. Reading the text in isolation is not semantic review. Assess each of the 10 CLEC dimensions against that evidence:
1. Clarity — is the wording plain for a non-specialist without weakening any other dimension: short sentences, concrete words, each acronym explained at its first occurrence? The shortest wording that preserves evidential meaning is preferred; longer wording is justified only where simplifying it would alter scope, attribution, time, uncertainty, causality or other material meaning.
2. Specificity — is a concrete service, place, population, condition or mechanism replaced by a vaguer or more general category?
3. Explicit scope — is scope hidden, unstated or wider than supported (place, population, period, conditions)?
4. Supported quantity — do quantity, frequency or prevalence terms exceed the evidence? Discussion volume is not prevalence.
5. Attribution — has a reported experience, claim, opinion, measurement or recommendation lost its attribution and become unattributed fact?
6. Supported causality — does causal wording exceed what the evidence supports, or turn sequence, association or a reported cause into an established cause?
7. Temporal precision — has the text drifted in time: historical presented as current, planned or announced presented as implemented, or no stated period?
8. Visible uncertainty — are qualifiers, unknowns, contradictions or limits hidden or dropped? UNKNOWN is not NO.
9. Neutral wording — is there biased, evaluative, emotive or advocacy framing, blame, intensifiers or rhetoric?
10. Evidence fidelity — is each statement traceable to, and neither materially stronger nor materially weaker than, its supporting evidence? Check Source→EVD fidelity: an EVD observation that loses the Source's meaning, attribution, qualifications or inference limits is a fidelity loss. Check that no translation or paraphrase strengthens, broadens or resolves the Source, and that no simplification changes evidential meaning.
Symmetric fidelity: documented is not unknown, just as UNKNOWN is not NO. Wording must not materially strengthen or weaken the Evidence: presenting what the Evidence documents as unknown, absent or smaller is a fidelity defect just as overstatement is. Omitting materially relevant linked Evidence is a defect when that omission makes the current PRB reading misleading; judge this from the package (no tool detects omission).
Language: citizen-facing authored prose must be PT-PT. Exceptions: official names, proper nouns, URLs, IDs, schema keys and canonical enum values; enum values stay in English. Citizen-facing prose that is not PT-PT, and internal process jargon in citizen-facing text (workflow, gate, lane, tooling, work-unit or review-process terms), are BLOCKING CLEC_VIOLATION findings under the clarity dimension.
Record-specific emphasis: PRB — strictest neutrality, scope and causality; synthesis never broader, stronger or more causal than its EVD and their inference_limits. EVD — strictest fidelity to the Source. SRC — provenance and published identity preserved; no evaluative statement about what the Source proves or how strong it is.
PRB framing: the Problem is framed around the documented manifestation or condition first; unresolved causality or consequence stays an open question rather than part of the Problem's framing. Every resolution_condition must be realistically reachable by the project's supported investigation methods: (1) relevant public information, prioritising competent or claim-authoritative Sources, with secondary, public, social or contextual Sources in their bounded role (discovery, context, reported experience, corroboration); (2) contact with relevant institutions, operators or companies for clarification, follow-up or direct challenge. Contact is not itself Evidence, and non-response is not Evidence: wording that treats either as Evidence is a fidelity defect. A statement that current state is not established, or that a currentness check was performed, is a claim judged against the package like any other; nothing in the package shows a check was performed unless the package contains its result.
Challenge vague or loaded wording contextually. Terms such as "vários", "zonas-chave", "significativo", "muitos", "sempre" or "causa" are signals to examine, not banned words and not automatic violations: the evidence and its context decide whether the same wording is supported or unsupported.
Judge from the supplied evidence and context, not from wording alone. The input's "evidenceContext" holds the existing EVD/SRC records the candidates rely on. SRC records hold provenance and metadata, not the Source's content: where a judgement needs Source content the package does not contain, report it as insufficient evidence — never guess, and never fill the gap from outside the package. PRB synthesis never needs Source content: review boundary 1 below makes the linked EVD its complete evidential boundary.
Source Verification Support: the input may carry "sourceVerificationContext", only for Sources referenced by EVDs this package creates or updates, at most one entry per such SRC record, each listing bounded "verified_claims" (a locator and a factual statement). It is a prior, governed verification context — each statement was verified by a human against captured Source bytes before this review. It is not Source text, not a quotation and not an EVD. Use it only to judge Source→EVD fidelity of those created or updated EVDs, and only for the bounded factual claims it explicitly contains; it never justifies PRB wording. It does not establish completeness: silence is not absence, and a fact it does not state stays UNKNOWN, never NO. Never infer beyond it. When candidate Source-derived wording exceeds both the canonical SRC metadata and the supplied verified claims, report INSUFFICIENT_EVIDENCE. Do not judge the authenticity of the support (authenticity and publication safety were decided by humans upstream) and do not CLEC-review its statements: they are review context, not candidate text. Findings and dispositions that rely on it cite the associated SRC-* ID in evidenceReferences.
Review boundaries. Every SRC record in the input is classified, deterministically and by tooling, in the SOURCE VERIFICATION ELIGIBILITY section after the review input: SOURCE_VERIFICATION_ELIGIBLE, or SOURCE_VERIFICATION_INELIGIBLE with a reason category (NON_PUBLIC, CORRESPONDENCE, REUSE_PROHIBITED). Use that classification; do not re-derive it.
1. PRB → linked EVD. For PRB synthesis, an unchanged linked EVD is the complete evidential boundary. An EVD in "evidenceContext" is existing canonical Evidence already admitted into the base and unchanged by this package: it is the bounded review artifact for PRB synthesis. Compare PRB wording against that EVD's observation, scope, inference_limits and authority/nature metadata only. SRC content and Source Verification Support cannot justify PRB wording beyond that EVD, and the absence of its Source's body or support is never on its own grounds for INSUFFICIENT_EVIDENCE, whatever the Source's eligibility. Where the PRB links an EVD this package creates or updates, judge the PRB against that candidate EVD; the PRB still never exceeds it.
2. Changed EVD → Source. An EVD candidate is created or updated by this package. Source→EVD fidelity remains mandatory for it whatever its Sources' eligibility: where judging it needs Source content the package does not contain, report INSUFFICIENT_EVIDENCE.
3. Eligible Source. For a SOURCE_VERIFICATION_ELIGIBLE Source of an EVD this package creates or updates, Source Verification Support is the governed path to Source content; where judging that EVD's fidelity needs Source content that neither the SRC metadata nor its support supplies, report INSUFFICIENT_EVIDENCE.
4. Support-ineligible provenance. Source-body re-verification is not available for a SOURCE_VERIFICATION_INELIGIBLE Source: the review package can never carry its content or Source Verification Support. For an unchanged evidenceContext EVD, the absence of that Source's body or support is therefore not itself an evidentiary defect and never on its own grounds for INSUFFICIENT_EVIDENCE: judge the PRB against the canonical EVD. This does not make the EVD, its Source or correspondence true, verified or stronger, and it never relaxes PRB→EVD fidelity. Do not infer beyond the EVD: PRB wording that exceeds the EVD's observation, drops or weakens an inference limit, broadens place, population or period, increases certainty or causality, or misstates attribution remains a CLEC defect, and a PRB claim the EVD itself does not support remains INSUFFICIENT_EVIDENCE or a violation on the EVD's own terms.
A CLEC defect that makes a statement stronger, broader, more certain or more causal than its evidence, or that changes evidential meaning, is grounds for DISAGREEMENT_FOUND. If the package lacks the evidence needed to compare a claim, that is grounds for INSUFFICIENT_EVIDENCE. Record each such issue as a structured finding with its record, field, verbatim claim and CLEC dimension.`;

/**
 * The deterministic SOURCE VERIFICATION ELIGIBILITY section: one line per SRC
 * record in the frozen input, derived by reviewSourceEligibility() from that
 * input alone. It carries only SRC IDs and reason categories, never Source
 * content or further metadata.
 */
function sourceEligibilitySection(frozenReviewerInputJson: string): string[] {
  const input = JSON.parse(frozenReviewerInputJson) as Partial<ReviewerInputPackage>;
  const entries = reviewSourceEligibility({ candidates: input.candidates ?? [], deltas: input.deltas ?? [], evidenceContext: input.evidenceContext ?? [] });
  return [
    "SOURCE VERIFICATION ELIGIBILITY (deterministic, derived from the canonical SRC metadata in the review input):",
    ...(entries.length === 0
      ? ["- (no SRC records in the review input)"]
      : entries.map(({ sourceId, ineligibility }) =>
          ineligibility.length === 0 ? `- ${sourceId}: SOURCE_VERIFICATION_ELIGIBLE` : `- ${sourceId}: SOURCE_VERIFICATION_INELIGIBLE (${ineligibility.join(", ")})`
        )),
  ];
}

/**
 * `frozenReviewerInputJson` must be exactly the canonical JSON string
 * produced by serializeReviewerInput() — this function does not re-derive or
 * reformat it, so the text the reviewer actually sees is provably identical
 * to what was frozen for it. The eligibility section that follows it is a
 * pure function of that same string.
 */
export function buildReviewerPrompt(frozenReviewerInputJson: string): string {
  return [
    "You are performing an independent review of the following already-authored",
    "research candidate package. You did not author it. Evaluate only the",
    "material below, including the evidence context, the deterministic CLEC",
    "signals and the deterministic validation/readiness results it contains.",
    "Assess whether:",
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
    ...sourceEligibilitySection(frozenReviewerInputJson),
    "",
    RESULT_CONTRACT,
  ].join("\n");
}

/** Procedural feedback only: the original prompt, including its frozen input, is unchanged. */
export function buildReviewerStructuralRetryPrompt(originalPrompt: string, validationErrors: readonly string[]): string {
  return [
    originalPrompt,
    "",
    "STRUCTURAL RETRY: Your previous JSON parsed but failed deterministic result validation:",
    ...validationErrors.map((error) => `- ${error}`),
    "Return a complete replacement JSON review object under the original result contract.",
    "Use the same immutable REVIEW INPUT above. Do not add research facts, evidence, or interpretation from this feedback.",
    "Self-check the entire replacement object before emitting stdout. Output only that JSON object.",
  ].join("\n");
}
