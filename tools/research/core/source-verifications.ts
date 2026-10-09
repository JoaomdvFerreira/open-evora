/**
 * Loader and validator for Source Verification Support
 * (research/source-verifications/SRC-*.yaml; docs/datamodel.md "Source
 * Verification Support", docs/investigationstrategy.md §12).
 *
 * Source Verification Support is a non-record review-support layer, not a
 * fourth canonical record family: no research/schemas/* file declares it, the
 * canonical corpus loader (corpus.ts) never reads it, and the Explorer never
 * publishes it. Each file holds bounded factual paraphrases that were
 * verified, upstream and by a human, against captured bytes of one public
 * Source. Its only consumer is the shared independent-review input
 * (orchestrate/reviewer-input.ts), which receives it from the review base.
 *
 * Validation here is deterministic and structural: exact keys, the
 * referenced SRC's existence and eligibility, dates, digest/media-type shape,
 * claim cardinality and length caps. It cannot prove that a statement is a
 * paraphrase rather than Source wording, that it is true, or that the
 * captured bytes were faithfully read — those remain owner review and
 * publication-safety responsibilities. `licensing.reuse: unknown` is
 * accepted only because the artifact carries no Source quotation or bytes;
 * it never authorizes republishing Source wording.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { getRecordField } from "./record-fields.ts";
import type { CorpusIndex, RecordFields } from "./types.ts";
import { parseRecordYaml } from "./yaml.ts";

/** Directory under the research root; deliberately not a schema-declared record directory. */
export const SOURCE_VERIFICATIONS_DIRECTORY = "source-verifications";

export const MAX_VERIFIED_CLAIMS = 8;
export const MAX_STATEMENT_LENGTH = 500;
export const MAX_LOCATOR_LENGTH = 200;
export const MAX_ARCHIVE_REFERENCE_LENGTH = 500;

export interface SourceVerificationRetrieval {
  retrieved_at: string;
  content_sha256: string;
  media_type: string;
  archive_reference?: string;
}

export interface SourceVerifiedClaim {
  locator: string;
  statement: string;
}

/** One validated support file, exactly its allowed keys; claims keep file order. */
export interface SourceVerification {
  source_id: string;
  retrieval: SourceVerificationRetrieval;
  verified_claims: SourceVerifiedClaim[];
}

/** A support file that failed validation, keyed by its research-root-relative path. */
export interface SourceVerificationIssue {
  file: string;
  /** The SRC ID the file is keyed by (its filename stem), when the filename names one. */
  sourceId?: string;
  errors: string[];
}

/** Every support file under one research root: the valid ones by SRC ID, and every invalid one. */
export interface SourceVerificationSet {
  bySourceId: ReadonlyMap<string, SourceVerification>;
  issues: readonly SourceVerificationIssue[];
}

/** Applicable support that cannot be used; review callers fail closed on it. */
export class SourceVerificationError extends Error {}

/** The failed-check code every review path reports for a SourceVerificationError. */
export const SOURCE_VERIFICATION_SUPPORT = "SOURCE_VERIFICATION_SUPPORT";

const TOP_LEVEL_KEYS = ["source_id", "retrieval", "verified_claims"];
const RETRIEVAL_KEYS = ["retrieved_at", "content_sha256", "media_type", "archive_reference"];
const CLAIM_KEYS = ["locator", "statement"];
const FILE_NAME = /^(SRC-[^/\\]+)\.yaml$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// type/subtype per RFC 6838 restricted-name characters, lower case, no parameters.
const MEDIA_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Length in Unicode code points, so a cap never depends on UTF-16 surrogate pairs. */
function length(value: string): number {
  return [...value].length;
}

function isCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key)).map((key) => `${path} has unexpected field ${JSON.stringify(key)}`);
}

function boundedString(value: unknown, path: string, max: number): string[] {
  if (typeof value !== "string" || value.trim() === "") return [`${path} must be a non-empty string`];
  if (length(value) > max) return [`${path} must be at most ${max} characters, got ${length(value)}`];
  return [];
}

/**
 * Eligibility of one canonical SRC record for Source Verification Support.
 * Only a public, non-correspondence Source whose reuse is not prohibited may
 * carry support; `reuse: unknown` stays eligible because support never
 * carries Source wording or bytes.
 */
export function sourceVerificationEligibilityErrors(sourceId: string, source: RecordFields | undefined): string[] {
  if (!source) return [`${sourceId} does not exist as a canonical SRC record`];
  const errors: string[] = [];
  const level = getRecordField(source, "access.level");
  if (level !== "public") errors.push(`${sourceId} has access.level ${JSON.stringify(level)}; only public Sources may carry Source Verification Support`);
  if (getRecordField(source, "resource_type") === "correspondence") errors.push(`${sourceId} is correspondence; correspondence may not carry Source Verification Support`);
  if (getRecordField(source, "licensing.reuse") === "prohibited") errors.push(`${sourceId} has licensing.reuse "prohibited"; it may not carry Source Verification Support`);
  return errors;
}

function sourceFields(index: CorpusIndex, sourceId: string): RecordFields | undefined {
  return index.byPrefix.get("SRC-")?.byId.get(sourceId)?.fields;
}

/**
 * Validates one parsed support document keyed by `fileSourceId` (its
 * filename stem) against `source`, the SRC record it must belong to
 * (undefined when that record does not exist). Returns every problem;
 * `value` is set only when there are none, and then holds exactly the
 * allowed keys.
 */
export function validateSourceVerification(
  value: unknown,
  fileSourceId: string,
  source: RecordFields | undefined
): { errors: string[]; value?: SourceVerification } {
  if (!isObject(value)) return { errors: ["support file must be a YAML mapping"] };
  const errors = unknownKeys(value, TOP_LEVEL_KEYS, "support file");

  if (value.source_id !== fileSourceId) {
    errors.push(`source_id must be ${JSON.stringify(fileSourceId)} (the file is keyed by Source), got ${JSON.stringify(value.source_id)}`);
  } else {
    errors.push(...sourceVerificationEligibilityErrors(fileSourceId, source));
  }

  const retrieval = value.retrieval;
  if (!isObject(retrieval)) {
    errors.push("retrieval must be a mapping");
  } else {
    errors.push(...unknownKeys(retrieval, RETRIEVAL_KEYS, "retrieval"));
    if (typeof retrieval.retrieved_at !== "string" || !isCalendarDate(retrieval.retrieved_at)) {
      errors.push(`retrieval.retrieved_at must be a real calendar date YYYY-MM-DD, got ${JSON.stringify(retrieval.retrieved_at)}`);
    }
    if (typeof retrieval.content_sha256 !== "string" || !SHA256.test(retrieval.content_sha256)) {
      errors.push("retrieval.content_sha256 must be 64 lower-case hexadecimal characters");
    }
    if (typeof retrieval.media_type !== "string" || !MEDIA_TYPE.test(retrieval.media_type)) {
      errors.push(`retrieval.media_type must be a lower-case type/subtype media type, got ${JSON.stringify(retrieval.media_type)}`);
    }
    if (retrieval.archive_reference !== undefined) {
      errors.push(...boundedString(retrieval.archive_reference, "retrieval.archive_reference", MAX_ARCHIVE_REFERENCE_LENGTH));
    }
  }

  const claims = value.verified_claims;
  if (!Array.isArray(claims) || claims.length < 1 || claims.length > MAX_VERIFIED_CLAIMS) {
    errors.push(`verified_claims must be a list of 1-${MAX_VERIFIED_CLAIMS} claims`);
  } else {
    claims.forEach((claim, i) => {
      const path = `verified_claims[${i}]`;
      if (!isObject(claim)) {
        errors.push(`${path} must be a mapping`);
        return;
      }
      errors.push(...unknownKeys(claim, CLAIM_KEYS, path));
      errors.push(...boundedString(claim.locator, `${path}.locator`, MAX_LOCATOR_LENGTH));
      errors.push(...boundedString(claim.statement, `${path}.statement`, MAX_STATEMENT_LENGTH));
    });
  }

  if (errors.length > 0) return { errors };
  const r = retrieval as Record<string, string>;
  return {
    errors,
    value: {
      source_id: fileSourceId,
      retrieval: {
        retrieved_at: r.retrieved_at,
        content_sha256: r.content_sha256,
        media_type: r.media_type,
        ...(r.archive_reference !== undefined ? { archive_reference: r.archive_reference } : {}),
      },
      verified_claims: (claims as Record<string, string>[]).map((claim) => ({ locator: claim.locator, statement: claim.statement })),
    },
  };
}

/**
 * Loads and validates every file under `<index.researchRoot>/source-verifications/`
 * against the SRC records of `index` — the review base the caller is bound
 * to. Deterministic: entries are read in sorted name order. A missing
 * directory is an empty set. Never throws for file content; every problem
 * is reported in `issues`.
 */
export function loadSourceVerifications(index: CorpusIndex): SourceVerificationSet {
  const dir = join(index.researchRoot, SOURCE_VERIFICATIONS_DIRECTORY);
  const bySourceId = new Map<string, SourceVerification>();
  const issues: SourceVerificationIssue[] = [];
  if (!existsSync(dir)) return { bySourceId, issues };

  for (const name of readdirSync(dir).sort()) {
    const file = `${SOURCE_VERIFICATIONS_DIRECTORY}/${name}`;
    const match = FILE_NAME.exec(name);
    if (!match || !statSync(join(dir, name)).isFile()) {
      issues.push({ file, errors: ["only SRC-*.yaml support files are allowed in this directory"] });
      continue;
    }
    const sourceId = match[1];
    let parsed: unknown;
    try {
      parsed = parseRecordYaml(readFileSync(join(dir, name), "utf8"));
    } catch (error) {
      issues.push({ file, sourceId, errors: [`malformed YAML: ${(error as Error).message}`] });
      continue;
    }
    const result = validateSourceVerification(parsed, sourceId, sourceFields(index, sourceId));
    if (result.value) bySourceId.set(sourceId, result.value);
    else issues.push({ file, sourceId, errors: result.errors });
  }
  return { bySourceId, issues };
}

/** Validation-report lines for every invalid support file under the research root of `index`. */
export function validateSourceVerifications(index: CorpusIndex): string[] {
  return loadSourceVerifications(index).issues.flatMap((issue) => issue.errors.map((error) => `[${issue.file}] ${error}`));
}

/**
 * The support applicable to exactly `sourceIds` (SRC IDs already reachable
 * from the candidates), sorted by SRC ID; Sources without support are simply
 * absent (absence is UNKNOWN, never NO). Fails closed when an applicable
 * file is invalid, or when the prospective SRC — which a candidate may
 * replace — is no longer eligible.
 */
export function selectSourceVerificationContext(
  support: SourceVerificationSet,
  sourceIds: Iterable<string>,
  prospective: CorpusIndex
): SourceVerification[] {
  const wanted = new Set(sourceIds);
  const invalid = support.issues.filter((issue) => issue.sourceId !== undefined && wanted.has(issue.sourceId));
  if (invalid.length > 0) {
    throw new SourceVerificationError(
      `applicable Source Verification Support is invalid: ${invalid.map((issue) => `${issue.file}: ${issue.errors.join("; ")}`).join(" | ")}`
    );
  }
  const selected = [...wanted].filter((id) => support.bySourceId.has(id)).sort();
  for (const id of selected) {
    const errors = sourceVerificationEligibilityErrors(id, sourceFields(prospective, id));
    if (errors.length > 0) throw new SourceVerificationError(`applicable Source Verification Support for ${id} is no longer eligible: ${errors.join("; ")}`);
  }
  return selected.map((id) => structuredClone(support.bySourceId.get(id)!));
}
