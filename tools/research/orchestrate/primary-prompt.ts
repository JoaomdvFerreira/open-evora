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
    ENVELOPE_CONTRACT,
  ].filter((line): line is string => line !== undefined);
  return lines.join("\n");
}
