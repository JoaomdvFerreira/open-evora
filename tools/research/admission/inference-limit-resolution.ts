/**
 * Local, workbench-only pre-Gate human-resolution mechanism for exactly one
 * blocking finding code: CLAIM_INFERENCE_LIMITS_PRESENT (WU053 remediation
 * of the WU049 E2E gap: today that finding can never be resolved, so a
 * safety-sensitive claim with explicit, owner-reviewed inference limits can
 * never reach independent review).
 *
 * A resolution is a deterministic acceptance record bound, via the existing
 * project fingerprint convention (../orchestrate/fingerprint.ts), to the
 * exact base Git SHA, subject (EVD id), candidate content, and
 * inference_limits list the owner actually reviewed. Any drift in any of
 * those four inputs — or in the finding code itself — invalidates the
 * binding and the resolution is treated as absent (fail closed).
 *
 * This module never:
 *  - suppresses any other finding code;
 *  - constitutes canonical approval, corroboration, or claim validation;
 *  - writes anywhere outside the caller-supplied local/gitignored
 *    workbench cycle directory.
 * Accepting a resolution means only that CLAIM_INFERENCE_LIMITS_PRESENT no
 * longer blocks progression to independent review/Human Gate; the
 * inference_limits themselves are carried into the package unchanged.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../orchestrate/fingerprint.ts";
import type { InferenceLimitResolutionChecker } from "./safety-admission.ts";

export const INFERENCE_LIMIT_RESOLUTION_CODE = "CLAIM_INFERENCE_LIMITS_PRESENT" as const;

export interface InferenceLimitResolutionSubject {
  baseGitSha: string;
  subjectId: string;
  /** The exact candidate EVD fields object as evaluated (not re-derived, not re-authored). */
  candidateFields: Record<string, unknown>;
  inferenceLimits: readonly string[];
}

export interface InferenceLimitResolutionRecord {
  schemaVersion: "1";
  code: typeof INFERENCE_LIMIT_RESOLUTION_CODE;
  fingerprint: string;
  resolvedAt: string;
  resolvedBy: string;
  note: string;
}

/**
 * Deterministic binding fingerprint over exactly the inputs this resolution
 * must stay pinned to: the finding code, base Git SHA, subject id, the full
 * candidate content, and the inference_limits list. Reuses the existing
 * canonical-serialization/SHA-256 convention (fingerprint.ts) rather than
 * introducing a second hashing rule.
 */
export function inferenceLimitResolutionFingerprint(subject: InferenceLimitResolutionSubject): string {
  return sha256Hex({
    code: INFERENCE_LIMIT_RESOLUTION_CODE,
    baseGitSha: subject.baseGitSha,
    subjectId: subject.subjectId,
    candidateFields: subject.candidateFields,
    inferenceLimits: subject.inferenceLimits,
  });
}

function resolutionFilePath(cycleDir: string, subjectId: string): string {
  return join(cycleDir, "resolutions", `${subjectId}.inference-limits-resolution.json`);
}

/**
 * Writes a local, workbench-only resolution record. `cycleDir` must be the
 * same gitignored cycle directory the rest of orchestration uses (callers
 * are expected to have already boundary-checked it via
 * assertWorkbenchBoundary()); this module performs no boundary check itself
 * so it never becomes a second, divergent boundary rule.
 */
export function writeInferenceLimitResolution(
  cycleDir: string,
  subject: InferenceLimitResolutionSubject,
  resolvedBy: string,
  note: string,
  now: () => Date = () => new Date()
): string {
  const record: InferenceLimitResolutionRecord = {
    schemaVersion: "1",
    code: INFERENCE_LIMIT_RESOLUTION_CODE,
    fingerprint: inferenceLimitResolutionFingerprint(subject),
    resolvedAt: now().toISOString(),
    resolvedBy,
    note,
  };
  const dir = join(cycleDir, "resolutions");
  mkdirSync(dir, { recursive: true });
  const file = resolutionFilePath(cycleDir, subject.subjectId);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return file;
}

function isResolutionRecord(value: unknown): value is InferenceLimitResolutionRecord {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === "1" &&
    v.code === INFERENCE_LIMIT_RESOLUTION_CODE &&
    typeof v.fingerprint === "string" &&
    v.fingerprint.length === 64 &&
    typeof v.resolvedAt === "string" &&
    typeof v.resolvedBy === "string" &&
    typeof v.note === "string"
  );
}

/**
 * Reads and validates the on-disk resolution for `subject.subjectId`, if
 * any, and reports whether it is an exact match for the *current* subject
 * (base SHA, candidate content, inference_limits). Never throws: a missing
 * file, malformed JSON, structurally invalid record, or fingerprint
 * mismatch are all reported as "not a valid current resolution" so the
 * caller fails closed (the finding remains blocking) rather than crashing
 * or silently accepting a stale/tampered file.
 */
export function readInferenceLimitResolution(
  cycleDir: string,
  subject: InferenceLimitResolutionSubject
): { resolved: true; record: InferenceLimitResolutionRecord } | { resolved: false; reason: string } {
  const file = resolutionFilePath(cycleDir, subject.subjectId);
  if (!existsSync(file)) return { resolved: false, reason: "no resolution record present" };

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return { resolved: false, reason: `resolution record is not valid JSON: ${(error as Error).message}` };
  }
  if (!isResolutionRecord(raw)) {
    return { resolved: false, reason: "resolution record is structurally invalid" };
  }

  const expected = inferenceLimitResolutionFingerprint(subject);
  if (raw.fingerprint !== expected) {
    return { resolved: false, reason: "resolution record does not match the current base SHA, subject, candidate content, or inference limits" };
  }

  return { resolved: true, record: raw };
}

/**
 * Adapts the on-disk resolution store at `cycleDir` to the
 * InferenceLimitResolutionChecker boundary safety-admission.ts consumes.
 * `isResolved()` never throws — any read/parse/mismatch problem is treated
 * as "not resolved" (fail closed), matching readInferenceLimitResolution()'s
 * own contract.
 */
export function createInferenceLimitResolutionChecker(cycleDir: string): InferenceLimitResolutionChecker {
  return {
    isResolved(baseGitSha, subjectId, candidateFields, inferenceLimits) {
      const result = readInferenceLimitResolution(cycleDir, { baseGitSha, subjectId, candidateFields, inferenceLimits });
      return result.resolved;
    },
  };
}
