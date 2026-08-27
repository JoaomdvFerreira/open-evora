/**
 * Read-only preparation of the exact filesystem effects that a human may
 * inspect at Gate 1. This never approves or applies canonical integration.
 */
import { posix as path } from "node:path";

import type { CandidateDelta, CandidateRecord } from "./candidate-delta.ts";
import type { CanonicalIntegrationReview } from "./canonical-integration-review.ts";
import type { CorpusIndex, RecordFields, RecordIndex } from "../core/types.ts";
import { stringifyRecordYaml } from "../core/yaml.ts";
import { validateCandidateSet } from "./prospective-validation.ts";

/** One prospective canonical write, including its complete replacement content. */
export interface CanonicalIntegrationWriteOperation {
  recordFamily: string;
  id: string;
  action: "CREATE" | "UPDATE";
  /** Path relative to the research root. */
  targetFile: string;
  /** Complete canonical YAML mapping that would be written. */
  yaml: string;
}

/** A no-op prospective observation; it has no write target or YAML content. */
export interface CanonicalIntegrationNoChangeOperation {
  recordFamily: string;
  id: string;
  action: "NO_CHANGE";
}

export type CanonicalIntegrationPlanOperation =
  | CanonicalIntegrationWriteOperation
  | CanonicalIntegrationNoChangeOperation;

/**
 * Detached deterministic material for human Gate 1 inspection. `baseGitSha`
 * remains caller-supplied: a future orchestrator must check it against HEAD.
 */
export interface CanonicalIntegrationPlan {
  baseGitSha: string;
  deltas: CandidateDelta[];
  operations: CanonicalIntegrationPlanOperation[];
}

function targetKey(delta: Pick<CandidateDelta, "recordFamily" | "id">): string {
  return `${delta.recordFamily}\u0000${delta.id}`;
}

function sameDeltas(left: readonly CandidateDelta[], right: readonly CandidateDelta[]): boolean {
  return left.length === right.length && left.every((delta, index) => (
    delta.recordFamily === right[index]?.recordFamily
    && delta.id === right[index]?.id
    && delta.action === right[index]?.action
  ));
}

/**
 * This is intentionally a small check local to canonical integration paths,
 * not a general path-security abstraction. Corpus paths use forward slashes.
 */
function isTargetWithinSchemaDirectory(directory: string, target: string): boolean {
  if (typeof directory !== "string" || typeof target !== "string" || directory === "" || target === "") return false;
  if (directory.includes("\\") || target.includes("\\")) return false;

  const normalizedDirectory = path.normalize(directory);
  const normalizedTarget = path.normalize(target);
  if (
    path.isAbsolute(directory)
    || path.isAbsolute(target)
    || normalizedDirectory === "."
    || normalizedDirectory === ".."
    || normalizedDirectory.startsWith("../")
  ) return false;

  return normalizedTarget.startsWith(`${normalizedDirectory}/`);
}

function targetFile(recordIndex: RecordIndex, delta: CandidateDelta): string {
  if (delta.action === "CREATE") return `${recordIndex.schema.directory}/${delta.id}.yaml`;

  const existing = recordIndex.byId.get(delta.id);
  if (!existing) throw new Error(`UPDATE target ${delta.recordFamily}${delta.id} no longer exists in the canonical index`);
  return existing.file;
}

function candidateId(fields: RecordFields, idField: string): unknown {
  let current: unknown = fields;
  for (const part of idField.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current) || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function candidatesByTarget(index: CorpusIndex, candidates: readonly CandidateRecord[]): Map<string, CandidateRecord> {
  const result = new Map<string, CandidateRecord>();
  for (const candidate of candidates) {
    const recordIndex = index.byPrefix.get(candidate.recordFamily);
    if (!recordIndex) throw new Error(`unknown candidate record family: ${candidate.recordFamily}`);
    const id = candidateId(candidate.fields, recordIndex.schema.idField);
    if (typeof id !== "string" || id.trim() === "") {
      throw new Error(`candidate record lacks a usable canonical ID at ${recordIndex.schema.idField}`);
    }
    result.set(`${candidate.recordFamily}\u0000${id}`, candidate);
  }
  return result;
}

/**
 * Produces a detached prospective filesystem plan from a structurally ready
 * Gate 1 review. It deliberately performs no filesystem or Git operation.
 */
export function prepareCanonicalIntegrationPlan(
  index: CorpusIndex,
  review: CanonicalIntegrationReview
): CanonicalIntegrationPlan {
  if (review.readiness !== "READY_FOR_INTEGRATION_GATE") {
    throw new Error("canonical integration plan requires READY_FOR_INTEGRATION_GATE review readiness");
  }

  const result = validateCandidateSet(index, review.candidates);
  if (result.validation.errors.length > 0) {
    throw new Error("review candidates are no longer structurally ready for canonical integration");
  }
  if (!sameDeltas(result.deltas, review.deltas)) {
    throw new Error("review candidate deltas no longer match the supplied canonical integration review");
  }

  const candidates = candidatesByTarget(index, review.candidates);
  const deltas = structuredClone(result.deltas);
  const operations = deltas.map((delta): CanonicalIntegrationPlanOperation => {
    if (delta.action === "NO_CHANGE") {
      return { recordFamily: delta.recordFamily, id: delta.id, action: "NO_CHANGE" };
    }

    const recordIndex = index.byPrefix.get(delta.recordFamily);
    if (!recordIndex) throw new Error(`unknown candidate record family: ${delta.recordFamily}`);
    const file = targetFile(recordIndex, delta);
    if (!isTargetWithinSchemaDirectory(recordIndex.schema.directory, file)) {
      throw new Error(`canonical integration target escapes schema directory: ${file}`);
    }

    const candidate = candidates.get(targetKey(delta));
    if (!candidate) throw new Error(`review has no candidate for ${delta.recordFamily}${delta.id}`);
    return {
      recordFamily: delta.recordFamily,
      id: delta.id,
      action: delta.action,
      targetFile: file,
      yaml: stringifyRecordYaml(structuredClone(candidate.fields) as RecordFields),
    };
  });

  return { baseGitSha: review.baseGitSha, deltas, operations };
}
