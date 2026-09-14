/**
 * Deterministic canonical JSON serialization and fingerprinting used for
 * WU045's own idempotency identity (§11 fail-closed/idempotency
 * requirement; §14 case 20). This is intentionally a separate, narrower
 * mechanism from WU046's approval/contentHash binding protocol (§12,
 * HIGH-2 remedy): that protocol governs what an owner approved and is
 * WU046's responsibility to implement; this module only lets WU045 detect
 * that a rerun against identical inputs produced an identical package.
 */
import { createHash } from "node:crypto";

/**
 * Produces a stable string for any JSON-serializable value: object keys are
 * sorted recursively, array order is preserved exactly as authored, and no
 * insignificant whitespace is emitted. This mirrors the ordering contract
 * §12 requires for the RCS contentHash, applied here to WU045's own
 * preparation fingerprint.
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
