/**
 * The Lane B semantic-review receipt: the pull-request-body carrier of an
 * independent CLEC review for a direct change to canonical research
 * (docs/investigationstrategy.md §12). The receipt is transient governance
 * material, never canonical research state, and is never committed.
 *
 * The receipt embeds the F00-F IndependentReviewResult unchanged and binds
 * it to the exact base commit, the exact changed record files (by Git blob
 * ID) and the fingerprint of the exact reviewer input. Verification rebuilds
 * all three from Git (review-unit.ts) — the receipt's own claims are only
 * compared, never trusted — and judges the review with the existing
 * context-aware validateIndependentReview().
 *
 * A verified CONCUR receipt makes a change eligible for human review only.
 * It is not an approval. Advisory signal presence alone never fails it; a
 * context-free CLEC blocker in the review unit always does, receipt or not.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { AiInvoker } from "../orchestrate/ai-invoker.ts";
import { CONTEXT_FREE_BLOCK, contextFreeBlockers, describeContextFreeBlockers } from "../language/signals.ts";
import { canonicalJsonStringify } from "../orchestrate/fingerprint.ts";
import { asValidatedIndependentReview, validateIndependentReview } from "../orchestrate/independent-review.ts";
import { serializeReviewerInput } from "../orchestrate/reviewer-input.ts";
import { buildReviewerPrompt } from "../orchestrate/reviewer-prompt.ts";
import type { IndependentReviewResult } from "../orchestrate/types.ts";
import type { LaneBChangedRecord, LaneBReviewUnit } from "./review-unit.ts";

type ReviewRequiredUnit = Extract<LaneBReviewUnit, { status: "REVIEW_REQUIRED" }>;

export interface LaneBReviewReceipt {
  schemaVersion: "1";
  baseGitSha: string;
  reviewerInputFingerprint: string;
  changedRecords: LaneBChangedRecord[];
  independentReview: IndependentReviewResult;
}

/** The pull-request template section that carries the receipt (or `N/A`). */
export const REVIEW_SECTION_HEADING = "## Research semantic review";
export const RECEIPT_BEGIN = "<!-- open-evora:lane-b-semantic-review-receipt:begin -->";
export const RECEIPT_END = "<!-- open-evora:lane-b-semantic-review-receipt:end -->";

const RECEIPT_KEYS = ["schemaVersion", "baseGitSha", "reviewerInputFingerprint", "changedRecords", "independentReview"];
const CHANGED_RECORD_KEYS = ["recordFamily", "id", "path", "action", "blob"];

export function buildLaneBReceipt(unit: ReviewRequiredUnit, independentReview: IndependentReviewResult): LaneBReviewReceipt {
  return {
    schemaVersion: "1",
    baseGitSha: unit.baseGitSha,
    reviewerInputFingerprint: unit.reviewerInputFingerprint,
    changedRecords: structuredClone(unit.changedRecords),
    independentReview: structuredClone(independentReview),
  };
}

/** The exact block an author pastes into the PR template section: sorted-key JSON between fixed markers. */
export function renderReceiptBlock(receipt: LaneBReviewReceipt): string {
  const json = JSON.stringify(JSON.parse(canonicalJsonStringify(receipt)), null, 2);
  return `${RECEIPT_BEGIN}\n\`\`\`json\n${json}\n\`\`\`\n${RECEIPT_END}`;
}

export type PullRequestReceipt =
  | { status: "ABSENT"; reason: string }
  | { status: "NOT_APPLICABLE" }
  | { status: "PRESENT"; value: unknown }
  | { status: "INVALID"; reason: string };

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/**
 * Extracts the receipt from a pull-request body deterministically. Only the
 * fixed markers inside the one review section count; any other content —
 * prose, a hand-written "reviewed" note, JSON outside the markers — is never
 * a receipt.
 */
export function extractPullRequestReceipt(body: string | null | undefined): PullRequestReceipt {
  const text = (body ?? "").replace(/\r\n?/g, "\n");
  const begins = occurrences(text, RECEIPT_BEGIN);
  const ends = occurrences(text, RECEIPT_END);
  if (begins > 1 || ends > 1) return { status: "INVALID", reason: "the pull-request body contains more than one Lane B receipt" };

  const lines = text.split("\n");
  const headings = lines.flatMap((line, i) => (line.trim() === REVIEW_SECTION_HEADING ? [i] : []));
  if (headings.length > 1) return { status: "INVALID", reason: `the "${REVIEW_SECTION_HEADING}" section appears more than once` };
  if (headings.length === 0) {
    return begins + ends > 0
      ? { status: "INVALID", reason: `the receipt must be inside the "${REVIEW_SECTION_HEADING}" section` }
      : { status: "ABSENT", reason: `the pull-request body has no "${REVIEW_SECTION_HEADING}" section` };
  }
  const start = headings[0] + 1;
  const next = lines.findIndex((line, i) => i >= start && /^#{1,2} /.test(line));
  const section = lines.slice(start, next === -1 ? lines.length : next).join("\n");

  if (begins + ends > 0) {
    const from = section.indexOf(RECEIPT_BEGIN);
    const to = section.indexOf(RECEIPT_END);
    if (from === -1 || to === -1 || to < from) {
      return { status: "INVALID", reason: `the receipt markers must enclose the receipt inside the "${REVIEW_SECTION_HEADING}" section` };
    }
    const fenced = /^\s*```json\n([\s\S]*?)\n```\s*$/.exec(section.slice(from + RECEIPT_BEGIN.length, to));
    if (!fenced) return { status: "INVALID", reason: "the receipt markers must enclose exactly one ```json fenced block" };
    try {
      return { status: "PRESENT", value: JSON.parse(fenced[1]) };
    } catch (error) {
      return { status: "INVALID", reason: `the receipt is not valid JSON: ${(error as Error).message}` };
    }
  }

  const content = section.replace(/<!--[\s\S]*?-->/g, "").trim();
  if (content === "N/A") return { status: "NOT_APPLICABLE" };
  return {
    status: "ABSENT",
    reason: content === ""
      ? `the "${REVIEW_SECTION_HEADING}" section is empty`
      : `the "${REVIEW_SECTION_HEADING}" section contains no machine-generated receipt`,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string, errors: string[]): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${path} has unknown field ${JSON.stringify(key)}`);
  for (const key of keys) if (!(key in value)) errors.push(`${path} is missing field ${JSON.stringify(key)}`);
}

/** Receipt envelope shape only; the embedded review is judged by validateIndependentReview(). */
function checkReceiptShape(value: unknown): string[] {
  if (!isObject(value)) return ["receipt must be a JSON object"];
  const errors: string[] = [];
  exactKeys(value, RECEIPT_KEYS, "receipt", errors);
  if (value.schemaVersion !== "1") errors.push(`receipt.schemaVersion must be exactly "1", got ${JSON.stringify(value.schemaVersion)}`);
  if (typeof value.baseGitSha !== "string" || !/^[0-9a-f]{40}$/.test(value.baseGitSha)) errors.push("receipt.baseGitSha must be a full 40-character commit SHA");
  if (typeof value.reviewerInputFingerprint !== "string" || !/^[0-9a-f]{64}$/.test(value.reviewerInputFingerprint)) {
    errors.push("receipt.reviewerInputFingerprint must be a 64-character sha256 hex digest");
  }
  if (!Array.isArray(value.changedRecords)) {
    errors.push("receipt.changedRecords must be an array");
  } else {
    value.changedRecords.forEach((entry, i) => {
      if (!isObject(entry)) errors.push(`receipt.changedRecords[${i}] must be an object`);
      else exactKeys(entry, CHANGED_RECORD_KEYS, `receipt.changedRecords[${i}]`, errors);
    });
  }
  return errors;
}

export type LaneBVerification =
  | { ok: true; summary: string }
  | { ok: false; failedCheck: string; errors: string[] };

function fail(failedCheck: string, ...errors: string[]): LaneBVerification {
  return { ok: false, failedCheck, errors };
}

function recordList(records: readonly LaneBChangedRecord[]): string {
  return records.map((record) => record.id).join(", ");
}

/**
 * The context-free CLEC precheck over the unit's exact reviewer input:
 * a failure message when the changed records carry a blocker, else null.
 */
export function laneBContextFreeBlock(unit: ReviewRequiredUnit): { failedCheck: typeof CONTEXT_FREE_BLOCK; message: string } | null {
  const blockers = contextFreeBlockers(unit.reviewerInput.signals);
  return blockers.length > 0 ? { failedCheck: CONTEXT_FREE_BLOCK, message: describeContextFreeBlockers(blockers) } : null;
}

/**
 * Verifies a pull request's Lane B receipt against the review unit rebuilt
 * from Git. Fails closed on every missing, ambiguous, stale or invalid
 * receipt and on any outcome other than CONCUR. Advisory signals are never
 * failures by themselves: only a missing or inconsistent disposition is.
 * A context-free blocker fails first, before the receipt is even read.
 */
export function verifyLaneBPullRequest(unit: LaneBReviewUnit, body: string | null | undefined): LaneBVerification {
  if (unit.status === "NO_CANONICAL_CHANGE") {
    return { ok: true, summary: "no canonical PRB/EVD/SRC record changed; no Lane B receipt is required" };
  }
  if (unit.status === "UNSUPPORTED_DELETION") {
    return fail(
      "UNSUPPORTED_CANONICAL_DELETION",
      `deleting or renaming canonical records is not supported by Lane B direct review: ${unit.paths.join(", ")}`
    );
  }
  const blocked = laneBContextFreeBlock(unit);
  if (blocked) return fail(blocked.failedCheck, blocked.message);

  const extracted = extractPullRequestReceipt(body);
  if (extracted.status === "ABSENT") {
    return fail("RECEIPT_MISSING", `${extracted.reason}; canonical records changed (${recordList(unit.changedRecords)}) and require a Lane B receipt`);
  }
  if (extracted.status === "NOT_APPLICABLE") {
    return fail("RECEIPT_MISSING", `N/A is only valid when no canonical record changed; this pull request changes ${recordList(unit.changedRecords)}`);
  }
  if (extracted.status === "INVALID") return fail("RECEIPT_INVALID", extracted.reason);

  const shapeErrors = checkReceiptShape(extracted.value);
  if (shapeErrors.length > 0) return fail("RECEIPT_INVALID", ...shapeErrors);
  const receipt = extracted.value as LaneBReviewReceipt;

  if (receipt.baseGitSha !== unit.baseGitSha) {
    return fail("RECEIPT_BASE_MISMATCH", `receipt was prepared against ${receipt.baseGitSha}, but this pull request's base is ${unit.baseGitSha}`);
  }
  if (canonicalJsonStringify(receipt.changedRecords) !== canonicalJsonStringify(unit.changedRecords)) {
    return fail(
      "RECEIPT_CHANGE_MISMATCH",
      `receipt covers ${recordList(receipt.changedRecords) || "no records"} at reviewed content, but Git shows ${recordList(unit.changedRecords)} with different records or content; prepare a new review`
    );
  }
  if (receipt.reviewerInputFingerprint !== unit.reviewerInputFingerprint) {
    return fail("RECEIPT_FINGERPRINT_MISMATCH", "receipt reviewer-input fingerprint does not match the reviewer input rebuilt from Git; prepare a new review");
  }

  const review = validateIndependentReview(receipt.independentReview, unit.reviewerInput);
  if (review.errors.length > 0) return fail("INDEPENDENT_REVIEW_INVALID", ...review.errors);
  if (receipt.independentReview.outcome !== "CONCUR") {
    return fail("INDEPENDENT_REVIEW_NOT_CONCUR", `independent review outcome is ${receipt.independentReview.outcome}; only CONCUR is eligible for human approval`);
  }
  return {
    ok: true,
    summary: `independent review CONCUR bound to base ${unit.baseGitSha} covering ${recordList(unit.changedRecords)}; eligible for human review (not an approval)`,
  };
}

export type LaneBPreparation =
  | { status: "REVIEW_FAILED"; failedCheck: string; message: string }
  | { status: "NOT_CONCUR"; independentReview: IndependentReviewResult }
  | { status: "READY"; receipt: LaneBReviewReceipt; receiptBlock: string };

/**
 * Runs the independent review for a Lane B unit: one fresh
 * INDEPENDENT_REVIEWER invocation that receives only the bounded F00-F
 * prompt built from the frozen reviewer package, validated against that
 * same package. `workbenchDir` must already be boundary-checked as
 * gitignored; the reviewer input, its result and any receipt are written
 * only there. A context-free blocker fails before anything is written or
 * the reviewer is invoked.
 */
export function prepareLaneBReview(unit: ReviewRequiredUnit, reviewerInvoker: AiInvoker, workbenchDir: string): LaneBPreparation {
  const blocked = laneBContextFreeBlock(unit);
  if (blocked) return { status: "REVIEW_FAILED", ...blocked };
  mkdirSync(workbenchDir, { recursive: true });
  const reviewerInputJson = serializeReviewerInput(unit.reviewerInput);
  writeFileSync(join(workbenchDir, "reviewer-input.json"), `${reviewerInputJson}\n`, "utf8");

  const result = reviewerInvoker.invoke({ role: "INDEPENDENT_REVIEWER", input: buildReviewerPrompt(reviewerInputJson) });
  if (result.status === "TIMEOUT") return { status: "REVIEW_FAILED", failedCheck: "INDEPENDENT_REVIEW_TIMEOUT", message: result.message };
  if (result.status === "INVOCATION_FAILED") return { status: "REVIEW_FAILED", failedCheck: "INDEPENDENT_REVIEW_INVOCATION_FAILED", message: result.message };

  let value: unknown;
  try {
    value = JSON.parse(result.stdout);
  } catch (error) {
    return { status: "REVIEW_FAILED", failedCheck: "INDEPENDENT_REVIEW_OUTPUT_INVALID", message: `stdout was not valid JSON: ${(error as Error).message}` };
  }
  const validation = validateIndependentReview(value, unit.reviewerInput);
  if (validation.errors.length > 0) {
    return { status: "REVIEW_FAILED", failedCheck: "INDEPENDENT_REVIEW_OUTPUT_INVALID", message: validation.errors.join("; ") };
  }
  const independentReview = asValidatedIndependentReview(value);
  writeFileSync(join(workbenchDir, "independent-review.json"), `${JSON.stringify(independentReview, null, 2)}\n`, "utf8");
  if (independentReview.outcome !== "CONCUR") return { status: "NOT_CONCUR", independentReview };

  const receipt = buildLaneBReceipt(unit, independentReview);
  const receiptBlock = renderReceiptBlock(receipt);
  writeFileSync(join(workbenchDir, "pr-receipt.md"), `${receiptBlock}\n`, "utf8");
  return { status: "READY", receipt, receiptBlock };
}
