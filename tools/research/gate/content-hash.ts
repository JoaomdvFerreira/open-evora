/**
 * Deterministic content-hash binding for the Human Gate approval protocol.
 * `contentHash` is defined as SHA-256 over the deterministic
 * canonical serialization of the validated Human Gate package JSON — never
 * the generated Markdown view.
 *
 * This module intentionally reuses the exact canonical-serialization
 * primitive (UTF-8, deterministic recursive key ordering, array order
 * preserved as authored, no insignificant whitespace) that
 * tools/research/orchestrate/fingerprint.ts already defines for WU045's own
 * idempotency fingerprint, rather than introducing a second, parallel
 * serialization rule. The package's contentHash and the preparation
 * fingerprint remain distinct identities over distinct objects (a Human Gate
 * package vs. a Research Change Set) computed with the same underlying
 * mechanism.
 */
import { canonicalJsonStringify, sha256Hex } from "../orchestrate/fingerprint.ts";
import type { HumanGatePackage, HumanGatePackageIdentity } from "./types.ts";

/**
 * Computes the full contentHash for an already-validated HumanGatePackage
 * object. The hash is taken over the entire package (every field the
 * approval binding must cover), keyed deterministically.
 */
export function computeContentHash(pkg: HumanGatePackage): string {
  return sha256Hex(pkg);
}

/** Deterministic canonical JSON bytes for a package — exposed for tests/tooling that need the exact serialized form. */
export function canonicalPackageBytes(pkg: HumanGatePackage): string {
  return canonicalJsonStringify(pkg);
}

/** Derives the full identity tuple from an already-validated package. */
export function derivePackageIdentity(pkg: HumanGatePackage): HumanGatePackageIdentity {
  return {
    packageId: pkg.packageId,
    schemaVersion: pkg.schemaVersion,
    baseGitSha: pkg.baseGitSha,
    contentHash: computeContentHash(pkg),
  };
}

/** A short, human-visible fingerprint for package identity/auditability only — never the binding mechanism itself. */
export function shortFingerprint(contentHash: string): string {
  return contentHash.slice(0, 12);
}
