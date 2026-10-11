/**
 * The Lane B semantic-review receipt: the compact pull-request-body binding
 * of an independent CLEC review for a direct change to canonical research
 * (docs/investigationstrategy.md §12). The receipt is transient governance
 * material, never canonical research state, and is never committed.
 *
 * The complete F00-F IndependentReviewResult is not in the receipt. It is the
 * hash-addressed review artifact `.research-review/<reviewSha256>.json`,
 * committed in the same pull request, where `reviewSha256` is the canonical
 * SHA-256 (core/fingerprint.ts) of the review itself. The receipt binds that
 * hash to the exact base commit, the exact changed record files (by Git blob
 * ID) and the fingerprint of the exact reviewer input. Verification rebuilds
 * all three from Git (review-unit.ts) — the receipt's own claims are only
 * compared, never trusted — reads the referenced artifact from the head
 * commit, checks its hash and judges it with the existing context-aware
 * validateIndependentReview().
 *
 * A verified CONCUR receipt makes a change eligible for human review only.
 * It is not an approval. Advisory signal presence alone never fails it; a
 * context-free CLEC blocker in the review unit always does, receipt or not.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { AiInvoker } from "../ai/invoker.ts";
import { CONTEXT_FREE_BLOCK, contextFreeBlockers, describeContextFreeBlockers } from "../language/signals.ts";
import { canonicalJsonStringify, sha256Hex } from "../core/fingerprint.ts";
import { validateIndependentReview } from "../review/independent-review.ts";
import { invokeIndependentReview } from "../review/independent-review-invocation.ts";
import { serializeReviewerInput } from "../review/reviewer-input.ts";
import type { IndependentReviewOutcome, IndependentReviewResult } from "../review/types.ts";
import {
  describeSourceVerificationNotSeparate,
  REVIEW_ARTIFACT_DIRECTORY,
  type LaneBChangedRecord,
  type LaneBReviewArtifacts,
  type LaneBReviewUnit,
} from "./review-unit.ts";

type ReviewRequiredUnit = Extract<LaneBReviewUnit, { status: "REVIEW_REQUIRED" }>;

/** One changed canonical record file, as the receipt binds it: its path and exact Git blob. */
export interface LaneBChangedRecordBlob {
  path: string;
  blob: string;
}

export interface LaneBReviewReceipt {
  schemaVersion: "2";
  outcome: IndependentReviewOutcome;
  baseGitSha: string;
  /** Ordered by `path` (UTF-16 code-unit order), one entry per changed canonical record file. */
  changedRecordBlobs: LaneBChangedRecordBlob[];
  reviewerInputFingerprint: string;
  /** sha256Hex() of the complete IndependentReviewResult held in the review artifact. */
  reviewSha256: string;
}

/** The pull-request template section that carries the receipt (or `N/A`). */
export const REVIEW_SECTION_HEADING = "## Research semantic review";
export const RECEIPT_BEGIN = "<!-- open-evora:lane-b-semantic-review-receipt:begin -->";
export const RECEIPT_END = "<!-- open-evora:lane-b-semantic-review-receipt:end -->";

const RECEIPT_KEYS = ["schemaVersion", "outcome", "baseGitSha", "changedRecordBlobs", "reviewerInputFingerprint", "reviewSha256"];
const CHANGED_RECORD_BLOB_KEYS = ["path", "blob"];
const SHA256_HEX = /^[0-9a-f]{64}$/;
const RECEIPT_OUTCOMES: readonly IndependentReviewOutcome[] = ["CONCUR", "DISAGREEMENT_FOUND", "INSUFFICIENT_EVIDENCE"];

/** The receipt's code-owned ordering of changed records: by repository-relative path. */
export function changedRecordBlobs(records: readonly LaneBChangedRecord[]): LaneBChangedRecordBlob[] {
  return records.map(({ path, blob }) => ({ path, blob })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** The canonical review hash: independent of key order, whitespace and line endings of any serialization. */
export function reviewSha256(independentReview: IndependentReviewResult): string {
  return sha256Hex(independentReview);
}

/** Repository-relative path of the full review artifact for `sha`. */
export function reviewArtifactPath(sha: string): string {
  return `${REVIEW_ARTIFACT_DIRECTORY}/${sha}.json`;
}

/** Deterministic on-disk form of a review artifact: sorted-key, two-space JSON with a final newline. */
export function renderReviewArtifact(independentReview: IndependentReviewResult): string {
  return `${JSON.stringify(JSON.parse(canonicalJsonStringify(independentReview)), null, 2)}\n`;
}

export function buildLaneBReceipt(unit: ReviewRequiredUnit, independentReview: IndependentReviewResult): LaneBReviewReceipt {
  return {
    schemaVersion: "2",
    outcome: independentReview.outcome,
    baseGitSha: unit.baseGitSha,
    changedRecordBlobs: changedRecordBlobs(unit.changedRecords),
    reviewerInputFingerprint: unit.reviewerInputFingerprint,
    reviewSha256: reviewSha256(independentReview),
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

/** Receipt shape only; the referenced review is judged by validateIndependentReview(). */
function checkReceiptShape(value: unknown): string[] {
  if (!isObject(value)) return ["receipt must be a JSON object"];
  const errors: string[] = [];
  exactKeys(value, RECEIPT_KEYS, "receipt", errors);
  if (value.schemaVersion !== "2") errors.push(`receipt.schemaVersion must be exactly "2", got ${JSON.stringify(value.schemaVersion)}`);
  if (!RECEIPT_OUTCOMES.includes(value.outcome as IndependentReviewOutcome)) {
    errors.push(`receipt.outcome must be one of ${RECEIPT_OUTCOMES.join(", ")}, got ${JSON.stringify(value.outcome)}`);
  }
  if (typeof value.baseGitSha !== "string" || !/^[0-9a-f]{40}$/.test(value.baseGitSha)) errors.push("receipt.baseGitSha must be a full 40-character commit SHA");
  if (typeof value.reviewerInputFingerprint !== "string" || !SHA256_HEX.test(value.reviewerInputFingerprint)) {
    errors.push("receipt.reviewerInputFingerprint must be a 64-character sha256 hex digest");
  }
  if (typeof value.reviewSha256 !== "string" || !SHA256_HEX.test(value.reviewSha256)) errors.push("receipt.reviewSha256 must be a 64-character sha256 hex digest");
  if (!Array.isArray(value.changedRecordBlobs)) {
    errors.push("receipt.changedRecordBlobs must be an array");
  } else {
    value.changedRecordBlobs.forEach((entry, i) => {
      if (!isObject(entry)) errors.push(`receipt.changedRecordBlobs[${i}] must be an object`);
      else {
        exactKeys(entry, CHANGED_RECORD_BLOB_KEYS, `receipt.changedRecordBlobs[${i}]`, errors);
        if (typeof entry.path !== "string" || typeof entry.blob !== "string") errors.push(`receipt.changedRecordBlobs[${i}] path and blob must be strings`);
      }
    });
  }
  return errors;
}

/**
 * A passed verification is NOT_APPLICABLE (no canonical record changed) or
 * VERIFIED, carrying the receipt and the review it verified for deterministic
 * consumers such as the PR review summary. CLI output never prints the review.
 */
export type LaneBVerification =
  | { ok: true; status: "NOT_APPLICABLE"; summary: string }
  | { ok: true; status: "VERIFIED"; summary: string; receipt: LaneBReviewReceipt; independentReview: IndependentReviewResult }
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
 * Verifies a pull request's Lane B receipt and its review artifact against
 * the review unit rebuilt from Git. Fails closed on every missing, ambiguous,
 * stale or invalid receipt or artifact, on any review artifact changed by
 * the pull request other than the one the receipt references, and on any
 * outcome other than CONCUR. Advisory signals are never failures by
 * themselves: only a missing or inconsistent disposition is. A context-free
 * blocker fails first, before the receipt is even read.
 */
export function verifyLaneBPullRequest(unit: LaneBReviewUnit, body: string | null | undefined, artifacts: LaneBReviewArtifacts): LaneBVerification {
  if (unit.status === "NO_CANONICAL_CHANGE") {
    if (artifacts.changedPaths.length > 0) {
      return fail("REVIEW_ARTIFACT_UNREFERENCED", `no canonical record changed, so no review artifact may change: ${artifacts.changedPaths.join(", ")}`);
    }
    return { ok: true, status: "NOT_APPLICABLE", summary: "no canonical PRB/EVD/SRC record changed; no Lane B receipt is required" };
  }
  if (unit.status === "UNSUPPORTED_DELETION") {
    return fail(
      "UNSUPPORTED_CANONICAL_DELETION",
      `deleting or renaming canonical records is not supported by Lane B direct review: ${unit.paths.join(", ")}`
    );
  }
  if (unit.status === "SOURCE_VERIFICATION_NOT_SEPARATE") return fail("SOURCE_VERIFICATION_NOT_SEPARATE", describeSourceVerificationNotSeparate(unit));
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
  if (canonicalJsonStringify(receipt.changedRecordBlobs) !== canonicalJsonStringify(changedRecordBlobs(unit.changedRecords))) {
    return fail(
      "RECEIPT_CHANGE_MISMATCH",
      `receipt covers ${receipt.changedRecordBlobs.map((entry) => entry.path).join(", ") || "no records"} at reviewed content, but Git shows ${recordList(unit.changedRecords)} with different records or content; prepare a new review`
    );
  }
  if (receipt.reviewerInputFingerprint !== unit.reviewerInputFingerprint) {
    return fail("RECEIPT_FINGERPRINT_MISMATCH", "receipt reviewer-input fingerprint does not match the reviewer input rebuilt from Git; prepare a new review");
  }

  // Only the exact hash-addressed artifact the receipt names can carry the review.
  const artifactPath = reviewArtifactPath(receipt.reviewSha256);
  const unreferenced = artifacts.changedPaths.filter((path) => path !== artifactPath);
  if (unreferenced.length > 0) {
    return fail("REVIEW_ARTIFACT_UNREFERENCED", `this pull request changes review artifacts the receipt does not reference: ${unreferenced.join(", ")}; commit only ${artifactPath}`);
  }
  const read = artifacts.read(artifactPath);
  if (read.status === "MISSING") return fail("REVIEW_ARTIFACT_MISSING", `the receipt references ${artifactPath}, which is not in this pull request's head commit`);
  if (read.status === "NOT_A_FILE") return fail("REVIEW_ARTIFACT_MISSING", `${artifactPath} is not an ordinary repository file`);
  let review: IndependentReviewResult;
  try {
    review = JSON.parse(read.text) as IndependentReviewResult;
  } catch (error) {
    return fail("REVIEW_ARTIFACT_MALFORMED", `${artifactPath} is not valid JSON: ${(error as Error).message}`);
  }
  const actualSha = sha256Hex(review);
  if (actualSha !== receipt.reviewSha256) {
    return fail("REVIEW_ARTIFACT_HASH_MISMATCH", `${artifactPath} has canonical SHA-256 ${actualSha}, not the ${receipt.reviewSha256} its name and the receipt bind`);
  }

  const validation = validateIndependentReview(review, unit.reviewerInput);
  if (validation.errors.length > 0) return fail("INDEPENDENT_REVIEW_INVALID", ...validation.errors);
  if (review.outcome !== receipt.outcome) {
    return fail("RECEIPT_OUTCOME_MISMATCH", `receipt outcome ${receipt.outcome} differs from the review artifact outcome ${review.outcome}`);
  }
  if (review.outcome !== "CONCUR") {
    return fail("INDEPENDENT_REVIEW_NOT_CONCUR", `independent review outcome is ${review.outcome}; only CONCUR is eligible for human approval`);
  }
  return {
    ok: true,
    status: "VERIFIED",
    receipt,
    independentReview: review,
    summary: `independent review CONCUR (${artifactPath}) bound to base ${unit.baseGitSha} covering ${recordList(unit.changedRecords)}; eligible for human review (not an approval)`,
  };
}

export type LaneBPreparation =
  | { status: "REVIEW_FAILED"; failedCheck: string; message: string }
  | { status: "NOT_CONCUR"; independentReview: IndependentReviewResult }
  | { status: "READY"; receipt: LaneBReviewReceipt; receiptBlock: string; artifactPath: string };

/**
 * Runs the independent review for a Lane B unit through the shared bounded
 * invocation helper. `workbenchDir` must already be boundary-checked as
 * gitignored; the reviewer input, its result and any receipt are written
 * there. Only a valid CONCUR review is also written to `repoRoot` as its
 * hash-addressed review artifact, to be committed with the reviewed records.
 * A context-free blocker fails before anything is written or the reviewer is
 * invoked.
 */
export function prepareLaneBReview(unit: ReviewRequiredUnit, reviewerInvoker: AiInvoker, workbenchDir: string, repoRoot: string): LaneBPreparation {
  const blocked = laneBContextFreeBlock(unit);
  if (blocked) return { status: "REVIEW_FAILED", ...blocked };
  mkdirSync(workbenchDir, { recursive: true });
  const reviewerInputJson = serializeReviewerInput(unit.reviewerInput);
  writeFileSync(join(workbenchDir, "reviewer-input.json"), `${reviewerInputJson}\n`, "utf8");

  const result = invokeIndependentReview(reviewerInvoker, unit.reviewerInput, workbenchDir);
  if (result.status === "FAILED") return { status: "REVIEW_FAILED", failedCheck: result.failedCheck, message: result.message };
  const independentReview = result.review;
  writeFileSync(join(workbenchDir, "independent-review.json"), `${JSON.stringify(independentReview, null, 2)}\n`, "utf8");
  if (independentReview.outcome !== "CONCUR") return { status: "NOT_CONCUR", independentReview };

  const receipt = buildLaneBReceipt(unit, independentReview);
  const artifactPath = reviewArtifactPath(receipt.reviewSha256);
  mkdirSync(join(repoRoot, REVIEW_ARTIFACT_DIRECTORY), { recursive: true });
  writeFileSync(join(repoRoot, ...artifactPath.split("/")), renderReviewArtifact(independentReview), "utf8");
  const receiptBlock = renderReceiptBlock(receipt);
  writeFileSync(join(workbenchDir, "pr-receipt.md"), `${receiptBlock}\n`, "utf8");
  return { status: "READY", receipt, receiptBlock, artifactPath };
}
