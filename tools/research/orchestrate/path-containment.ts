/**
 * Shared path-containment enforcement for untrusted, AI-authored candidate
 * paths (WU045-B01 independent-review remediation, finding 2 — path
 * traversal in `candidateFiles[].path`). `AuthoredCandidateFile.path` and
 * `GenerationManifest.candidateFiles[]` entries originate from PRIMARY_AUTHOR
 * AI stdout: untrusted external output the contract's own threat model
 * requires WU045 to structurally validate before acting on it (contract §5
 * "Primary authoring contract"). This module is the single place that
 * containment is enforced; both the write path (materializing candidate
 * files) and the read path (loading them back) call the same helper so the
 * two can never diverge.
 *
 * Two layers, both required (structural validation alone is not sufficient
 * — a path can be syntactically "clean" and still resolve outside the
 * approved directory on some platforms, e.g. via symlinks):
 *
 *   1. Structural rejection (`isBoundedRelativePath`): rejects the path
 *      shape itself — absolute paths, `..` segments, empty segments, and
 *      any POSIX or Windows-style rooted form (`/x`, `\x`, `C:\x`, UNC
 *      `\\host\share`) — before any filesystem call is made.
 *   2. Runtime containment (`resolveContainedPath`): resolves both the
 *      candidate target and the approved base directory to their real,
 *      symlink-resolved absolute paths and asserts the target is strictly
 *      inside the base. This catches anything structural rejection cannot
 *      (e.g. a symlink placed inside the approved directory that points
 *      outside it) and is the actual enforcement point immediately before
 *      every read/write.
 */
import { realpathSync } from "node:fs";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";

export type PathContainmentResult =
  | { ok: true; absolutePath: string }
  | { ok: false; reason: string };

const WINDOWS_DRIVE_OR_UNC = /^(?:[A-Za-z]:[\\/]|\\\\|\/\/)/;

/**
 * Structural check only: does `candidatePath` look like a single bounded,
 * relative, forward-slash path with no traversal or rooting? This never
 * touches the filesystem. Intentionally narrow — WU045 only ever needs a
 * flat-or-shallow relative candidate filename, never an arbitrary path
 * grammar, so this rejects far more than it needs to accept.
 */
export function isBoundedRelativePath(candidatePath: string): boolean {
  if (typeof candidatePath !== "string" || candidatePath.trim() === "") return false;
  // Reject any backslash outright: candidate paths are declared and
  // consumed as forward-slash-relative (see types.ts); accepting backslash
  // would let a Windows-style rooted or drive-qualified path slip past the
  // POSIX-style checks below on a POSIX host.
  if (candidatePath.includes("\\")) return false;
  if (candidatePath.includes("\0")) return false;
  if (isAbsolute(candidatePath)) return false;
  if (WINDOWS_DRIVE_OR_UNC.test(candidatePath)) return false;

  const segments = candidatePath.split("/");
  for (const segment of segments) {
    if (segment === "" || segment === ".") return false; // no empty/current-dir segments
    if (segment === "..") return false; // no traversal segments, anywhere in the path
  }

  // Defense in depth: normalize() collapses "./" and resolves "../" against
  // its neighbours; if the normalized form differs in a way that still
  // contains "..", or escapes to an absolute form, reject. (The segment
  // scan above already rejects every ".."/"." segment pre-normalization,
  // so this is a redundant, cheap second check rather than the primary
  // gate — see resolveContainedPath() for the authoritative runtime check.)
  const normalized = normalize(candidatePath);
  if (normalized.split(/[\\/]/).includes("..")) return false;
  if (isAbsolute(normalized)) return false;

  return true;
}

/**
 * Runtime containment check: resolves `candidatePath` against `baseDir` and
 * verifies the result is strictly inside `baseDir`'s real (symlink-resolved)
 * location. This is the authoritative check — call it immediately before
 * every read or write of a candidate file, even when
 * `isBoundedRelativePath()` has already passed, because structural shape
 * alone cannot detect a symlink inside `baseDir` that points outside it.
 *
 * `baseDir` must already exist. `candidatePath`'s parent directories need
 * not exist yet (the write path creates them) — in that case containment is
 * checked against the resolved (`realpathSync`) existing ancestor plus the
 * remaining, not-yet-created suffix, which `isBoundedRelativePath()` has
 * already guaranteed contains no traversal segments.
 */
export function resolveContainedPath(baseDir: string, candidatePath: string): PathContainmentResult {
  if (!isBoundedRelativePath(candidatePath)) {
    return { ok: false, reason: `candidate path is not a bounded relative path: ${JSON.stringify(candidatePath)}` };
  }

  let realBase: string;
  try {
    realBase = realpathSync(baseDir);
  } catch (error) {
    return { ok: false, reason: `candidate base directory could not be resolved: ${(error as Error).message}` };
  }

  const joined = join(realBase, candidatePath);
  const resolved = resolve(joined);

  // Resolve whichever leading portion of `resolved` actually exists on disk
  // (through symlinks) so a symlink placed inside baseDir that points
  // outside it is caught even though the leaf file/directory itself may not
  // exist yet.
  let existingAncestor = resolved;
  let suffix = "";
  while (true) {
    try {
      existingAncestor = realpathSync(existingAncestor);
      break;
    } catch {
      const parent = existingAncestor.slice(0, existingAncestor.lastIndexOf(sep));
      if (!parent || parent === existingAncestor) {
        // Nothing on this path exists yet above realBase; fall back to the
        // lexically resolved path, which is still safe because
        // isBoundedRelativePath() already excluded traversal segments.
        existingAncestor = resolved;
        suffix = "";
        break;
      }
      suffix = existingAncestor.slice(parent.length) + suffix;
      existingAncestor = parent;
    }
  }
  const effectiveResolved = suffix ? existingAncestor + suffix : existingAncestor;

  const withSep = realBase.endsWith(sep) ? realBase : realBase + sep;
  if (effectiveResolved !== realBase && !effectiveResolved.startsWith(withSep)) {
    return {
      ok: false,
      reason: `candidate path resolves outside the approved candidate directory: ${JSON.stringify(candidatePath)} -> ${effectiveResolved}`,
    };
  }

  return { ok: true, absolutePath: resolved };
}
