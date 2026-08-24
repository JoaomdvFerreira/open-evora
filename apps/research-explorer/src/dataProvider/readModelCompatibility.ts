/**
 * Runtime compatibility rule between this application build and a generated
 * read model's `readModelVersion` — this versions the read-model contract,
 * independent of any canonical schema question (see docs/explorerarchitecture.md).
 *
 * Rule: the read model's major version must exactly match
 * SUPPORTED_READ_MODEL_MAJOR. Minor/patch differences are accepted (additive,
 * backward-compatible changes to the contract); a major-version mismatch is
 * treated as incompatible rather than best-effort-parsed, per RE-02A's
 * explicit "fail closed on incompatible data" requirement.
 */

export const SUPPORTED_READ_MODEL_MAJOR = 1;

export function parseMajorVersion(version: string): number | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;
  return Number(match[1]);
}

export function isReadModelVersionCompatible(version: string): boolean {
  const major = parseMajorVersion(version);
  return major !== null && major === SUPPORTED_READ_MODEL_MAJOR;
}
