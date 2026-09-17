/**
 * Deterministic structural validation for the OD-B generation manifest
 * (contract §11, OD-B point (a)).
 * This never judges the substantive adequacy of the investigation question
 * or rationale — only that the required shape is present, matching every
 * other structural-only check in tools/research/ (§4 stage 18/21).
 */
import { isBoundedRelativePath } from "./path-containment.ts";
import type { GenerationManifest, ResearchMode } from "./types.ts";

export interface ManifestValidationResult {
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

/**
 * `candidateFiles` entries are untrusted PRIMARY_AUTHOR output consumed
 * directly by loadCandidates()'s filesystem read path (WU045-B01
 * independent-review remediation, finding 2). Every entry must be a
 * bounded relative path — see path-containment.ts's module doc for why
 * structural rejection alone is not sufficient and what the runtime
 * containment layer additionally enforces at the actual read/write site.
 */
function isBoundedRelativePathArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((entry) => isNonEmptyString(entry) && isBoundedRelativePath(entry));
}

const VALID_MODES: readonly ResearchMode[] = ["daily-discovery", "problem-refresh"];

/**
 * Validates one already-parsed manifest object. Returns every structural
 * problem found rather than throwing at the first one, matching
 * validate.ts's existing convention (tools/research/validation/validate.ts).
 */
export function validateManifest(value: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { errors: ["manifest must be an object"] };
  }
  const manifest = value as Record<string, unknown>;

  if (manifest.schemaVersion !== "1") {
    errors.push(`manifest.schemaVersion must be exactly "1", got ${JSON.stringify(manifest.schemaVersion)}`);
  }

  if (!VALID_MODES.includes(manifest.mode as ResearchMode)) {
    errors.push(`manifest.mode must be one of ${VALID_MODES.join(", ")}, got ${JSON.stringify(manifest.mode)}`);
  }

  if (manifest.mode === "problem-refresh" && !isNonEmptyString(manifest.targetProblemId)) {
    errors.push("manifest.targetProblemId is required and must be a non-empty string when mode is problem-refresh");
  }
  if (manifest.mode === "daily-discovery" && manifest.targetProblemId !== undefined) {
    errors.push("manifest.targetProblemId must be absent when mode is daily-discovery");
  }

  if (!isNonEmptyString(manifest.investigationQuestion)) {
    errors.push("manifest.investigationQuestion must be a non-empty string");
  }

  if (!isNonEmptyStringArray(manifest.candidateFiles)) {
    errors.push("manifest.candidateFiles must be a non-empty array of non-empty strings");
  } else if (!isBoundedRelativePathArray(manifest.candidateFiles)) {
    errors.push(
      `manifest.candidateFiles must contain only bounded relative paths (no ".." segments, no absolute/rooted form): ${JSON.stringify(manifest.candidateFiles)}`
    );
  }

  if (!isNonEmptyStringArray(manifest.claimedRecordIds)) {
    errors.push("manifest.claimedRecordIds must be a non-empty array of non-empty strings");
  }

  if (
    Array.isArray(manifest.candidateFiles) &&
    Array.isArray(manifest.claimedRecordIds) &&
    manifest.candidateFiles.length !== manifest.claimedRecordIds.length
  ) {
    errors.push("manifest.candidateFiles and manifest.claimedRecordIds must have the same length");
  }

  if (!isNonEmptyString(manifest.rationale)) {
    errors.push("manifest.rationale must be a non-empty string");
  }

  return { errors };
}

/** Type-narrowing helper for callers that have already confirmed zero errors. */
export function asValidatedManifest(value: unknown): GenerationManifest {
  return value as GenerationManifest;
}
