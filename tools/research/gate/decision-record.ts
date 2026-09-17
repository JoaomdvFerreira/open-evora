/**
 * Persistence and structural validation for the Human Gate decision record.
 * Stored as JSON in the same gitignored cycle directory
 * as the Research Change Set it decides — outside canonical/public
 * research/** — bound to packageId/contentHash/baseGitSha/actor/timestamp/
 * canonicalAcceptance/publicExplorerPublication.
 *
 * A decision record for one package must never authorize another: every
 * consumer of a loaded record (promote.ts) must re-check its binding
 * against the package/repository state actually in front of it before
 * acting, not merely trust that the record was once valid.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { HumanGateDecisionRecord } from "./types.ts";

export const DECISION_RECORD_FILENAME = "human-gate-decision.json";

export interface DecisionRecordValidationResult {
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

const FULL_GIT_SHA = /^[0-9a-fA-F]{40}$/;
const FULL_SHA256 = /^[0-9a-f]{64}$/;
const VALID_CANONICAL_ACCEPTANCE = new Set(["APPROVE", "REJECT", "HOLD_MORE_RESEARCH"]);
const VALID_PUBLICATION = new Set(["APPROVE", "REJECT", "HOLD"]);

/** Validates one already-parsed decision record object. Never throws. */
export function validateDecisionRecord(value: unknown): DecisionRecordValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { errors: ["decision record must be an object"] };
  }
  const record = value as Record<string, unknown>;
  const errors: string[] = [];

  if (record.schemaVersion !== "1") {
    errors.push(`record.schemaVersion must be exactly "1", got ${JSON.stringify(record.schemaVersion)}`);
  }
  if (!isNonEmptyString(record.packageId) || !(record.packageId as string).startsWith("RCS-")) {
    errors.push("record.packageId must be a non-empty string starting with \"RCS-\"");
  }
  if (typeof record.contentHash !== "string" || !FULL_SHA256.test(record.contentHash)) {
    errors.push("record.contentHash must be a 64-character lowercase hex SHA-256 string");
  }
  if (typeof record.baseGitSha !== "string" || !FULL_GIT_SHA.test(record.baseGitSha)) {
    errors.push("record.baseGitSha must be a full 40-character hexadecimal SHA");
  }
  if (!isNonEmptyString(record.actor)) {
    errors.push("record.actor must be a non-empty string");
  }
  if (typeof record.timestamp !== "string" || Number.isNaN(Date.parse(record.timestamp))) {
    errors.push("record.timestamp must be a valid ISO-8601 timestamp string");
  }
  if (!VALID_CANONICAL_ACCEPTANCE.has(record.canonicalAcceptance as string)) {
    errors.push(`record.canonicalAcceptance must be one of ${[...VALID_CANONICAL_ACCEPTANCE].join(", ")}`);
  }
  if (!VALID_PUBLICATION.has(record.publicExplorerPublication as string)) {
    errors.push(`record.publicExplorerPublication must be one of ${[...VALID_PUBLICATION].join(", ")}`);
  }
  if (
    record.publicExplorerPublication === "APPROVE" &&
    record.canonicalAcceptance !== "APPROVE"
  ) {
    errors.push("record violates OD-D: publicExplorerPublication=APPROVE requires canonicalAcceptance=APPROVE");
  }

  return { errors };
}

export function asValidatedDecisionRecord(value: unknown): HumanGateDecisionRecord {
  return value as HumanGateDecisionRecord;
}

/** Absolute path to the decision record for a given gitignored cycle directory. */
export function decisionRecordPath(cycleDir: string): string {
  return join(cycleDir, DECISION_RECORD_FILENAME);
}

/** Persists a decision record as JSON in `cycleDir` (same directory as the RCS/package it decides). */
export function writeDecisionRecord(cycleDir: string, record: HumanGateDecisionRecord): string {
  const path = decisionRecordPath(cycleDir);
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return path;
}

export type LoadDecisionRecordResult =
  | { status: "ABSENT" }
  | { status: "INVALID"; errors: string[] }
  | { status: "OK"; record: HumanGateDecisionRecord };

/**
 * Loads and validates the decision record for `cycleDir`, if any. Supports
 * safe resume/retry: a caller that finds status "OK" may resume the
 * post-approval sequence from a prior recorded decision rather than
 * requiring the owner to decide again, but must still independently
 * re-verify the record's binding (packageId/contentHash/baseGitSha) against
 * the package/repository state currently in front of it before treating it
 * as authoritative for that state (see promote.ts).
 */
export function loadDecisionRecord(cycleDir: string): LoadDecisionRecordResult {
  const path = decisionRecordPath(cycleDir);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { status: "ABSENT" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { status: "INVALID", errors: [`decision record is not valid JSON: ${(error as Error).message}`] };
  }

  const validation = validateDecisionRecord(parsed);
  if (validation.errors.length > 0) {
    return { status: "INVALID", errors: validation.errors };
  }
  return { status: "OK", record: asValidatedDecisionRecord(parsed) };
}

/**
 * Fails closed unless `record` is bound to exactly this package identity.
 * A decision record for one package must never authorize a different one —
 * this is the enforcement point every promotion-path caller must use before
 * treating a loaded record as authoritative.
 */
export function assertDecisionRecordBinding(
  record: HumanGateDecisionRecord,
  expected: { packageId: string; contentHash: string; baseGitSha: string }
): { ok: true } | { ok: false; reason: string } {
  if (record.packageId !== expected.packageId) {
    return { ok: false, reason: `decision record packageId (${record.packageId}) does not match expected packageId (${expected.packageId})` };
  }
  if (record.contentHash !== expected.contentHash) {
    return { ok: false, reason: `decision record contentHash (${record.contentHash}) does not match expected contentHash (${expected.contentHash})` };
  }
  if (record.baseGitSha !== expected.baseGitSha) {
    return { ok: false, reason: `decision record baseGitSha (${record.baseGitSha}) does not match expected baseGitSha (${expected.baseGitSha})` };
  }
  return { ok: true };
}
