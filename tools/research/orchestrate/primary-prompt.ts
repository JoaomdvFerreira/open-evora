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
- Optional fields stay optional: omit them when not explicitly supported; do not invent values to fill them.`;

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
    PRB_SEMANTIC_GUARDRAILS,
    "",
    ENVELOPE_CONTRACT,
  ].filter((line): line is string => line !== undefined);
  return lines.join("\n");
}
