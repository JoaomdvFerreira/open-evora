/**
 * Deterministic structural validation for the PRIMARY_AUTHOR AI invocation's
 * structured output envelope (WU045-B01 remediation; contract §5 "Primary
 * authoring contract"). Validates shape/presence only — never the
 * substantive adequacy of the research content — exactly like every other
 * structural check in tools/research/orchestrate/. A malformed or
 * incomplete envelope fails closed before any candidate reaches the
 * deterministic chain (§14 case 19).
 */
import { validateManifest } from "./manifest.ts";
import { isBoundedRelativePath } from "./path-containment.ts";
import type { AuthoredCandidateFile, PrimaryAuthoringEnvelope } from "./types.ts";

export interface AuthoringEnvelopeValidationResult {
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * `path` is untrusted PRIMARY_AUTHOR output (WU045-B01 independent-review
 * remediation, finding 2). Beyond non-empty-string presence, it must be a
 * bounded relative path — no traversal (`..`) segments, no absolute or
 * platform-rooted form (`/x`, `\x`, `C:\x`, UNC `\\host\share`) — checked
 * with the same helper `materializeAuthoringEnvelope()`/`loadCandidates()`
 * use for their own runtime containment check (path-containment.ts), so the
 * structural and runtime layers can never diverge on what counts as valid.
 * This structural check runs before any filesystem call; it is not by
 * itself sufficient (see path-containment.ts's module doc) but rejects the
 * overwhelming majority of malformed/malicious paths for free.
 */
function validateCandidateFile(value: unknown, index: number): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`candidateFiles[${index}] must be an object`];
  }
  const file = value as Record<string, unknown>;
  if (!isNonEmptyString(file.path)) {
    errors.push(`candidateFiles[${index}].path must be a non-empty string`);
  } else if (!isBoundedRelativePath(file.path)) {
    errors.push(
      `candidateFiles[${index}].path must be a bounded relative path (no ".." segments, no absolute/rooted form): ${JSON.stringify(file.path)}`
    );
  }
  if (!isNonEmptyString(file.yaml)) {
    errors.push(`candidateFiles[${index}].yaml must be a non-empty string`);
  }
  return errors;
}

/**
 * Validates one already-parsed primary-authoring envelope. Returns every
 * structural problem found rather than throwing at the first one. Checks,
 * beyond the embedded manifest's own shape (delegated to
 * validateManifest()): the envelope's own schemaVersion, that
 * candidateFiles is a non-empty array of well-formed entries, that every
 * path is unique, and that the set of paths exactly matches
 * manifest.candidateFiles (order-independent) — the same
 * manifest/candidate-content agreement research-change-set.ts already
 * enforces for claimed record IDs, checked here one layer earlier so a
 * mismatched envelope fails before any file is ever written to disk.
 */
export function validateAuthoringEnvelope(value: unknown): AuthoringEnvelopeValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { errors: ["authoring envelope must be an object"] };
  }
  const envelope = value as Record<string, unknown>;
  const errors: string[] = [];

  if (envelope.schemaVersion !== "1") {
    errors.push(`envelope.schemaVersion must be exactly "1", got ${JSON.stringify(envelope.schemaVersion)}`);
  }

  const manifestValidation = validateManifest(envelope.manifest);
  errors.push(...manifestValidation.errors.map((message) => `manifest.${message}`));

  if (!Array.isArray(envelope.candidateFiles) || envelope.candidateFiles.length === 0) {
    errors.push("envelope.candidateFiles must be a non-empty array");
  } else {
    envelope.candidateFiles.forEach((file, index) => {
      errors.push(...validateCandidateFile(file, index));
    });

    if (errors.length === 0) {
      const files = envelope.candidateFiles as AuthoredCandidateFile[];
      const paths = files.map((file) => file.path);
      const uniquePaths = new Set(paths);
      if (uniquePaths.size !== paths.length) {
        errors.push("envelope.candidateFiles paths must be unique");
      }

      const manifest = envelope.manifest as Record<string, unknown>;
      if (manifestValidation.errors.length === 0 && Array.isArray(manifest.candidateFiles)) {
        const manifestPaths = new Set(manifest.candidateFiles as string[]);
        const missingFromEnvelope = [...manifestPaths].filter((path) => !uniquePaths.has(path));
        const undeclaredInManifest = [...uniquePaths].filter((path) => !manifestPaths.has(path));
        if (missingFromEnvelope.length > 0 || undeclaredInManifest.length > 0) {
          errors.push(
            `envelope.candidateFiles paths must exactly match manifest.candidateFiles (missing: [${missingFromEnvelope.join(", ")}], undeclared: [${undeclaredInManifest.join(", ")}])`
          );
        }
      }
    }
  }

  return { errors };
}

/** Type-narrowing helper for callers that have already confirmed zero errors. */
export function asValidatedAuthoringEnvelope(value: unknown): PrimaryAuthoringEnvelope {
  return value as PrimaryAuthoringEnvelope;
}
