/** Deterministic canonical JSON serialization for reviewer input and attestations. */
import { createHash } from "node:crypto";

/**
 * Produces a stable string for any JSON-serializable value: object keys are
 * sorted recursively, array order is preserved exactly as authored, and no
 * insignificant whitespace is emitted.
 */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** SHA-256 over the deterministic canonical serialization of `value`, as a lowercase hex string. */
export function sha256Hex(value: unknown): string {
  return createHash("sha256").update(canonicalJsonStringify(value), "utf8").digest("hex");
}
