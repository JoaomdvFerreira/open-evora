import { execFileSync } from "node:child_process";

/** Path-only publication boundary shared by direct review and the research check. */

const CANONICAL_RECORD = /^research\/(?:problems\/PRB-[A-Z0-9-]+|evidence\/EVD-[A-Z0-9-]+|sources\/SRC-[A-Z0-9-]+)\.ya?ml$/i;
const SOURCE_VERIFICATION = /^research\/source-verifications\/SRC-[A-Z0-9-]+\.ya?ml$/i;
const RESEARCH_SCHEMA = /^research\/schemas\/[^/]+\.schema\.json$/i;
const ATTESTATION = /^\.research-review-attestation\.json$/;

const PRIVATE_SEGMENT = /^(?:\.research-workbench|\.research-review|private(?:[-_].*)?|raw(?:[-_].*)?|correspondence(?:[-_].*)?|transcripts?(?:[-_].*)?|recordings?(?:[-_].*)?|working[-_ ]?materials?|private[-_ ]?notes)$/i;
const PRIVATE_FILENAME = /(?:^|[-_.])(?:private[-_ ]?notes|raw[-_ ]?(?:source|material)|transcripts?|recordings?)(?:$|[-_.])/i;

export interface PublicationPathSafetyResult {
  ok: boolean;
  prohibitedPaths: string[];
  unexpectedResearchPaths: string[];
}

function normalized(path: string): string {
  return path.replace(/\\/g, "/");
}

function isPrivatePath(path: string): boolean {
  const parts = path.split("/");
  return parts.some((part) => PRIVATE_SEGMENT.test(part) || PRIVATE_FILENAME.test(part));
}

function isPermittedResearchPath(path: string): boolean {
  return CANONICAL_RECORD.test(path) || SOURCE_VERIFICATION.test(path) || RESEARCH_SCHEMA.test(path) || ATTESTATION.test(path);
}

/**
 * Rejects known private/workbench material paths and unrecognized artifacts
 * inside `research/`. It cannot determine whether prose inside an otherwise
 * permitted canonical field contains private material.
 */
export function checkResearchPublicationPaths(paths: readonly string[]): PublicationPathSafetyResult {
  const unique = [...new Set(paths.map(normalized))].sort();
  const prohibitedPaths = unique.filter(isPrivatePath);
  const unexpectedResearchPaths = unique.filter((path) => path.startsWith("research/") && !isPermittedResearchPath(path));
  return {
    ok: prohibitedPaths.length === 0 && unexpectedResearchPaths.length === 0,
    prohibitedPaths,
    unexpectedResearchPaths,
  };
}
/** Git-derived changed paths between `base` and a commit, or a working tree. */
export function gitChangedPaths(repoRoot: string, base: string, head?: string): string[] {
  const args = ["diff", "--name-only", "--no-renames", "-z", base];
  if (head) args.push(head);
  else args.push("--");
  const tracked = execFileSync("git", args, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 })
    .toString("utf8").split("\0").filter(Boolean);
  if (head) return tracked;
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
    cwd: repoRoot,
    maxBuffer: 64 * 1024 * 1024,
  }).toString("utf8").split("\0").filter(Boolean);
  return [...new Set([...tracked, ...untracked])];
}

export function assertResearchPublicationPaths(paths: readonly string[]): void {
  const result = checkResearchPublicationPaths(paths);
  if (!result.ok) {
    const details = [
      ...result.prohibitedPaths.map((path) => `${path} (prohibited publication path)`),
      ...result.unexpectedResearchPaths.map((path) => `${path} (unrecognized research artifact)`),
    ];
    throw new Error(`research publication path check failed closed:\n  ${details.join("\n  ")}`);
  }
}
