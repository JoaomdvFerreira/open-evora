/**
 * Derives the Lane B (direct pull-request) semantic-review unit from Git
 * alone (docs/investigationstrategy.md §12 "Mandatory independent semantic
 * review"). The unit is every canonical record file created or updated
 * between an exact base commit and a prospective head, reviewed against the
 * canonical corpus reconstructed from that base.
 *
 * Git diff plus the schema-declared record directories decide what changed;
 * nothing a pull request says about itself can widen or narrow that set.
 * Deletions and renames are not reviewable on this path and are reported as
 * unsupported rather than authorized.
 *
 * Source Verification Support is read only from the base commit, never from
 * the head: a change cannot supply the support its own review relies on, and
 * a change touching both canonical records and support is refused outright
 * (the support must be merged first, in its own pull request).
 *
 * Every comparison step reuses the existing primitives — the corpus loader,
 * candidate loader, canonical-integration review and F00-F reviewer input
 * package — so Lane B is judged by exactly the Lane A review contract.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { loadCorpusIndex } from "../core/corpus.ts";
import { getRecordField } from "../core/record-fields.ts";
import { loadSourceVerifications, SOURCE_VERIFICATION_SUPPORT, SOURCE_VERIFICATIONS_DIRECTORY, SourceVerificationError } from "../core/source-verifications.ts";
import { loadSchemas } from "../core/schemas.ts";
import type { RecordSchema } from "../core/types.ts";
import type { CandidateDeltaAction } from "../integration/candidate-delta.ts";
import { prepareCanonicalIntegrationReview } from "../integration/canonical-integration-review.ts";
import { loadCandidates } from "../orchestrate/candidate-loader.ts";
import { sha256Hex } from "../orchestrate/fingerprint.ts";
import { buildReviewerInputPackage, type ReviewerInputPackage, type ReviewFraming } from "../orchestrate/reviewer-input.ts";

/** Which prospective state the changed records are read from. */
export type LaneBHead = { kind: "commit"; sha: string } | { kind: "working-tree" };

/** One changed canonical record file, as Git and the base corpus classify it. */
export interface LaneBChangedRecord {
  recordFamily: string;
  id: string;
  /** Repository-relative path. */
  path: string;
  action: CandidateDeltaAction;
  /** Git blob ID of the exact prospective file content. */
  blob: string;
}

export type LaneBReviewUnit =
  | { status: "NO_CANONICAL_CHANGE"; baseGitSha: string }
  | { status: "UNSUPPORTED_DELETION"; baseGitSha: string; paths: string[] }
  /** Canonical records and Source Verification Support changed together; never reviewable. */
  | { status: "SOURCE_VERIFICATION_NOT_SEPARATE"; baseGitSha: string; recordPaths: string[]; supportPaths: string[] }
  | {
      status: "REVIEW_REQUIRED";
      baseGitSha: string;
      changedRecords: LaneBChangedRecord[];
      reviewerInput: ReviewerInputPackage;
      /** sha256 over the canonical JSON of `reviewerInput`, exactly as the reviewer receives it. */
      reviewerInputFingerprint: string;
    };

/** Any Git, reconstruction or candidate failure; callers fail closed on it. */
export class LaneBReviewUnitError extends Error {}

/**
 * The fixed framing every Lane B package carries. It is author-independent
 * by construction, so CI can rebuild the identical package from Git and no
 * free-form author justification reaches the reviewer.
 */
export const LANE_B_REVIEW_FRAMING: ReviewFraming = {
  mode: "direct-pull-request",
  investigationQuestion: "Direct pull-request change to canonical research records: review each changed record against its evidence.",
};

const RESEARCH_ROOT = "research";
const SCHEMAS_DIR = `${RESEARCH_ROOT}/schemas`;
const SOURCE_VERIFICATIONS_DIR = `${RESEARCH_ROOT}/${SOURCE_VERIFICATIONS_DIRECTORY}`;
const FULL_GIT_SHA = /^[0-9a-f]{40}$/;

function git(repoRoot: string, args: string[], input?: string): Buffer {
  try {
    return execFileSync("git", args, { cwd: repoRoot, input, maxBuffer: 256 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString("utf8").trim();
    throw new LaneBReviewUnitError(`git ${args[0]} failed${stderr ? `: ${stderr}` : ""}`);
  }
}

function nulSeparated(output: Buffer): string[] {
  return output.toString("utf8").split("\0").filter((entry) => entry !== "");
}

/** Verifies that `sha` is a full commit SHA present in the repository. */
export function assertCommitExists(repoRoot: string, sha: string): void {
  if (typeof sha !== "string" || !FULL_GIT_SHA.test(sha)) {
    throw new LaneBReviewUnitError(`expected a full lower-case 40-character commit SHA, got ${JSON.stringify(sha)}`);
  }
  const resolved = git(repoRoot, ["rev-parse", "--verify", "--quiet", `${sha}^{commit}`]).toString("utf8").trim();
  if (resolved !== sha) throw new LaneBReviewUnitError(`commit ${sha} does not exist in this repository`);
}

/** Reads blob contents at `rev` for each path through one `git cat-file --batch` process. */
function readBlobs(repoRoot: string, rev: string, paths: readonly string[]): Map<string, { oid: string; content: Buffer }> {
  const out = new Map<string, { oid: string; content: Buffer }>();
  if (paths.length === 0) return out;
  for (const path of paths) {
    if (/[\r\n]/.test(path)) throw new LaneBReviewUnitError(`refusing to read a path containing a line break: ${JSON.stringify(path)}`);
  }
  const output = git(repoRoot, ["cat-file", "--batch"], paths.map((path) => `${rev}:${path}\n`).join(""));
  let offset = 0;
  for (const path of paths) {
    const headerEnd = output.indexOf(0x0a, offset);
    const header = output.subarray(offset, headerEnd).toString("utf8").split(" ");
    if (header.length !== 3 || header[1] !== "blob") throw new LaneBReviewUnitError(`${path} is not a file at ${rev}`);
    const size = Number(header[2]);
    out.set(path, { oid: header[0], content: output.subarray(headerEnd + 1, headerEnd + 1 + size) });
    offset = headerEnd + 1 + size + 1;
  }
  return out;
}

function parseSchemas(files: Iterable<{ path: string; text: string }>): RecordSchema[] {
  const schemas: RecordSchema[] = [];
  for (const { path, text } of files) {
    try {
      schemas.push(JSON.parse(text) as RecordSchema);
    } catch (error) {
      throw new LaneBReviewUnitError(`could not parse ${path}: ${(error as Error).message}`);
    }
  }
  return schemas;
}

function schemaPaths(paths: readonly string[]): string[] {
  return paths.filter((path) => path.startsWith(`${SCHEMAS_DIR}/`) && path.endsWith(".schema.json") && !path.slice(SCHEMAS_DIR.length + 1).includes("/"));
}

function schemasAtCommit(repoRoot: string, sha: string): RecordSchema[] {
  const paths = schemaPaths(nulSeparated(git(repoRoot, ["ls-tree", "-r", "-z", "--name-only", sha, "--", SCHEMAS_DIR])));
  const blobs = readBlobs(repoRoot, sha, paths);
  return parseSchemas(paths.map((path) => ({ path, text: blobs.get(path)!.content.toString("utf8") })));
}

function schemasInWorkingTree(repoRoot: string): RecordSchema[] {
  try {
    return loadSchemas(join(repoRoot, RESEARCH_ROOT));
  } catch (error) {
    throw new LaneBReviewUnitError(`could not read working-tree schemas: ${(error as Error).message}`);
  }
}

/**
 * A canonical record file is a top-level YAML file in a schema-declared
 * record directory — the same discovery rule the corpus loader uses.
 */
function isCanonicalRecordPath(path: string, recordDirs: ReadonlySet<string>): boolean {
  const slash = path.lastIndexOf("/");
  return slash > 0 && recordDirs.has(path.slice(0, slash)) && /\.ya?ml$/.test(path);
}

/** The deterministic refusal for a change that carries both canonical records and Source Verification Support. */
export function describeSourceVerificationNotSeparate(unit: Extract<LaneBReviewUnit, { status: "SOURCE_VERIFICATION_NOT_SEPARATE" }>): string {
  return (
    `this change modifies canonical records (${unit.recordPaths.join(", ")}) and Source Verification Support (${unit.supportPaths.join(", ")}) together. ` +
    "Source Verification Support must be merged first in a separate pull request; the canonical change is then reviewed against a base that already contains it."
  );
}

interface PathChange {
  status: string;
  path: string;
}

function parseNameStatus(output: Buffer): PathChange[] {
  const parts = nulSeparated(output);
  const changes: PathChange[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) changes.push({ status: parts[i], path: parts[i + 1] });
  return changes;
}

function changedPaths(repoRoot: string, baseGitSha: string, head: LaneBHead): PathChange[] {
  // --no-renames: a rename is always observed as a deletion plus a creation.
  if (head.kind === "commit") {
    return parseNameStatus(git(repoRoot, ["diff", "--name-status", "--no-renames", "-z", baseGitSha, head.sha, "--", RESEARCH_ROOT]));
  }
  const tracked = parseNameStatus(git(repoRoot, ["diff", "--name-status", "--no-renames", "-z", baseGitSha, "--", RESEARCH_ROOT]));
  const untracked = nulSeparated(git(repoRoot, ["ls-files", "-z", "--others", "--exclude-standard", "--", RESEARCH_ROOT]));
  return [...tracked, ...untracked.map((path) => ({ status: "A", path }))];
}

/** Writes repository-relative `files` under `root`, a temporary directory the caller removes. */
function stage(root: string, files: ReadonlyMap<string, Buffer>): void {
  for (const [path, content] of files) {
    const target = join(root, ...path.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

/** Blob IDs Git would store for working-tree files, honouring the repository's clean filters. */
function workingTreeBlobs(repoRoot: string, paths: readonly string[]): Map<string, string> {
  const oids = git(repoRoot, ["hash-object", "--stdin-paths"], paths.map((path) => `${path}\n`).join("")).toString("utf8").trim().split("\n");
  return new Map(paths.map((path, i) => [path, oids[i]]));
}

export interface ResolveLaneBReviewUnitInput {
  repoRoot: string;
  baseGitSha: string;
  head: LaneBHead;
}

/**
 * Builds the Lane B review unit for `head` against the exact `baseGitSha`.
 * The base corpus is reconstructed from Git objects into a temporary
 * directory that is always removed; no worktree is created or touched.
 */
export function resolveLaneBReviewUnit({ repoRoot, baseGitSha, head }: ResolveLaneBReviewUnitInput): LaneBReviewUnit {
  assertCommitExists(repoRoot, baseGitSha);
  if (head.kind === "commit") assertCommitExists(repoRoot, head.sha);

  const baseSchemas = schemasAtCommit(repoRoot, baseGitSha);
  const headSchemas = head.kind === "commit" ? schemasAtCommit(repoRoot, head.sha) : schemasInWorkingTree(repoRoot);
  // Union of base and head directories: moving a record directory in the
  // same change cannot take records out of the review boundary.
  const recordDirs = new Set([...baseSchemas, ...headSchemas].map((schema) => `${RESEARCH_ROOT}/${schema.directory}`));

  const allChanges = changedPaths(repoRoot, baseGitSha, head);
  const changes = allChanges.filter((change) => isCanonicalRecordPath(change.path, recordDirs));
  const supportPaths = [...new Set(allChanges.filter((change) => change.path.startsWith(`${SOURCE_VERIFICATIONS_DIR}/`)).map((change) => change.path))].sort();
  if (changes.length > 0 && supportPaths.length > 0) {
    return { status: "SOURCE_VERIFICATION_NOT_SEPARATE", baseGitSha, recordPaths: [...new Set(changes.map((change) => change.path))].sort(), supportPaths };
  }
  const deleted = changes.filter((change) => change.status === "D").map((change) => change.path).sort();
  if (deleted.length > 0) return { status: "UNSUPPORTED_DELETION", baseGitSha, paths: deleted };
  const unexpected = changes.filter((change) => !["A", "M", "T"].includes(change.status));
  if (unexpected.length > 0) {
    throw new LaneBReviewUnitError(`unsupported Git change status for ${unexpected.map((change) => `${change.status} ${change.path}`).join(", ")}`);
  }
  const paths = [...new Set(changes.map((change) => change.path))].sort();
  if (paths.length === 0) return { status: "NO_CANONICAL_CHANGE", baseGitSha };

  const staging = mkdtempSync(join(tmpdir(), "open-evora-lane-b-"));
  try {
    const baseDirs = baseSchemas.map((schema) => `${RESEARCH_ROOT}/${schema.directory}`);
    // Source Verification Support is staged from the base alongside the corpus, so it is loaded from the same base root.
    const basePaths = nulSeparated(git(repoRoot, ["ls-tree", "-r", "-z", "--name-only", baseGitSha, "--", SCHEMAS_DIR, SOURCE_VERIFICATIONS_DIR, ...baseDirs]));
    const baseBlobs = readBlobs(repoRoot, baseGitSha, basePaths);
    const baseRoot = join(staging, "base");
    stage(baseRoot, new Map([...baseBlobs].map(([path, blob]) => [path, blob.content])));
    let index;
    try {
      index = loadCorpusIndex(join(baseRoot, RESEARCH_ROOT));
    } catch (error) {
      throw new LaneBReviewUnitError(`could not reconstruct the base corpus at ${baseGitSha}: ${(error as Error).message}`);
    }

    let candidatesRoot: string;
    let blobs: Map<string, string>;
    if (head.kind === "commit") {
      const headBlobs = readBlobs(repoRoot, head.sha, paths);
      candidatesRoot = join(staging, "head");
      stage(candidatesRoot, new Map([...headBlobs].map(([path, blob]) => [path, blob.content])));
      blobs = new Map([...headBlobs].map(([path, blob]) => [path, blob.oid]));
    } else {
      candidatesRoot = repoRoot;
      blobs = workingTreeBlobs(repoRoot, paths);
    }

    const loaded = loadCandidates(index, candidatesRoot, paths);
    if (loaded.failures.length > 0) {
      throw new LaneBReviewUnitError(loaded.failures.map((failure) => `${failure.file}: ${failure.message}`).join("; "));
    }

    // A changed file must be the canonical file of the record it holds, so
    // the reviewed record and the changed path can never diverge.
    const pathByTarget = new Map<string, string>();
    loaded.candidates.forEach((candidate, i) => {
      const schema = index.byPrefix.get(candidate.recordFamily)!.schema;
      const id = getRecordField(candidate.fields, schema.idField) as string;
      const expectedDir = `${RESEARCH_ROOT}/${schema.directory}`;
      const path = paths[i];
      if (path !== `${expectedDir}/${id}.yaml` && path !== `${expectedDir}/${id}.yml`) {
        throw new LaneBReviewUnitError(`${path} holds ${id}, whose canonical file is ${expectedDir}/${id}.yaml`);
      }
      pathByTarget.set(`${candidate.recordFamily}\u0000${id}`, path);
    });

    let review;
    try {
      review = prepareCanonicalIntegrationReview(baseGitSha, index, loaded.candidates);
    } catch (error) {
      throw new LaneBReviewUnitError((error as Error).message);
    }
    let reviewerInput;
    try {
      reviewerInput = buildReviewerInputPackage({
        baseGitSha,
        manifest: LANE_B_REVIEW_FRAMING,
        index,
        candidates: review.candidates,
        deltas: review.deltas,
        validation: review.validation,
        readiness: review.readiness,
        sourceVerifications: loadSourceVerifications(index),
      });
    } catch (error) {
      if (error instanceof SourceVerificationError) throw new LaneBReviewUnitError(`${SOURCE_VERIFICATION_SUPPORT}: ${error.message}`);
      throw error;
    }

    const changedRecords = review.deltas.map((delta) => {
      const path = pathByTarget.get(`${delta.recordFamily}\u0000${delta.id}`)!;
      return { recordFamily: delta.recordFamily, id: delta.id, path, action: delta.action, blob: blobs.get(path)! };
    });
    return { status: "REVIEW_REQUIRED", baseGitSha, changedRecords, reviewerInput, reviewerInputFingerprint: sha256Hex(reviewerInput) };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

/** The exact base a pull request's changes are measured from: the merge base of its base and head. */
export function pullRequestBase(repoRoot: string, baseSha: string, headSha: string): string {
  assertCommitExists(repoRoot, baseSha);
  assertCommitExists(repoRoot, headSha);
  return git(repoRoot, ["merge-base", baseSha, headSha]).toString("utf8").trim();
}

/** Resolves a ref (branch, tag, `HEAD` or SHA) to its full commit SHA. */
export function resolveCommit(repoRoot: string, ref: string): string {
  const sha = git(repoRoot, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).toString("utf8").trim();
  if (!FULL_GIT_SHA.test(sha)) throw new LaneBReviewUnitError(`${ref} does not resolve to a commit`);
  return sha;
}
