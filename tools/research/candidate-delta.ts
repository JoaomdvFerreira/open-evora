/**
 * Read-only classification of one already-parsed candidate record against
 * canonical corpus state. Candidate validity remains the validator's
 * responsibility; this module only requires enough well-formed input to
 * identify the schema-declared record family and its canonical ID.
 */
import type { CorpusIndex, RecordFields } from "./core/types.ts";

/** The only possible observations for a candidate relative to canonical state. */
export type CandidateDeltaAction = "CREATE" | "UPDATE" | "NO_CHANGE";

/** One parsed candidate and the schema-declared record family it belongs to. */
export interface CandidateRecord {
  /** Exact RecordSchema.prefix value identifying the candidate's record family. */
  recordFamily: string;
  /** Parsed canonical fields, without any candidate-package or filesystem concern. */
  fields: RecordFields;
}

/** The read-only delta observation for one candidate record. */
export interface CandidateDelta {
  recordFamily: string;
  id: string;
  action: CandidateDeltaAction;
}

function getPath(fields: RecordFields, dotted: string): unknown {
  let current: unknown = fields;
  for (const part of dotted.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current) || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Compares parsed YAML values structurally. Object key insertion order is
 * intentionally irrelevant; array item order and all authored values remain
 * significant. This performs no normalization or interpretation.
 */
function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;

  const leftIsArray = Array.isArray(left);
  if (leftIsArray !== Array.isArray(right)) return false;

  if (leftIsArray) {
    const leftArray = left as unknown[];
    const rightArray = right as unknown[];
    return leftArray.length === rightArray.length && leftArray.every((value, index) => structurallyEqual(value, rightArray[index]));
  }

  const leftObject = left as Record<string, unknown>;
  const rightObject = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftObject);
  const rightKeys = Object.keys(rightObject);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(rightObject, key) && structurallyEqual(leftObject[key], rightObject[key])
  );
}

/**
 * Classifies one parsed candidate against an already-loaded canonical index.
 * It is observational only: neither argument is mutated and no filesystem,
 * ID-allocation, deletion, promotion, or duplicate-detection behavior occurs.
 */
export function classifyCandidateDelta(index: CorpusIndex, candidate: CandidateRecord): CandidateDelta {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("candidate record must be an object");
  }
  if (typeof candidate.recordFamily !== "string" || candidate.recordFamily.trim() === "") {
    throw new Error("candidate record family must be a non-empty schema prefix");
  }
  if (!candidate.fields || typeof candidate.fields !== "object" || Array.isArray(candidate.fields)) {
    throw new Error("candidate fields must be a mapping");
  }

  const recordIndex = index.byPrefix.get(candidate.recordFamily);
  if (!recordIndex) {
    throw new Error(`unknown candidate record family: ${candidate.recordFamily}`);
  }
  if (typeof recordIndex.schema.idField !== "string" || recordIndex.schema.idField.trim() === "") {
    throw new Error(`record family ${candidate.recordFamily} declares no usable idField`);
  }

  const id = getPath(candidate.fields, recordIndex.schema.idField);
  if (typeof id !== "string" || id.trim() === "") {
    throw new Error(`candidate record lacks a usable canonical ID at ${recordIndex.schema.idField}`);
  }

  const canonical = recordIndex.byId.get(id);
  if (!canonical) return { recordFamily: candidate.recordFamily, id, action: "CREATE" };

  return {
    recordFamily: candidate.recordFamily,
    id,
    action: structurallyEqual(candidate.fields, canonical.fields) ? "NO_CHANGE" : "UPDATE",
  };
}
