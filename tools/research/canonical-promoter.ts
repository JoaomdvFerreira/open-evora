/**
 * Applies an already human-approved CanonicalIntegrationPlan to canonical
 * research. This module never decides whether Gate 1 was approved: callers
 * must invoke it only after that external human decision. Its Git, structural,
 * and validation checks are safety checks, not approval, and it writes exactly
 * the plan supplied by the caller without interpreting candidate research.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, posix as path, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import type { CanonicalIntegrationPlan, CanonicalIntegrationWriteOperation } from "./canonical-integration-plan.ts";
import { loadCorpusIndex } from "./core/corpus.ts";
import type { RecordFields } from "./core/types.ts";
import { parseRecordYaml } from "./core/yaml.ts";
import { validateResearchRoot } from "./validation/validate.ts";
import type { ValidationResult } from "./validation/validate.ts";

export interface CanonicalIntegrationPromotionResult {
  baseGitSha: string;
  createCount: number;
  updateCount: number;
  noChangeCount: number;
  postWriteValidation: ValidationResult;
}

interface PreparedWrite extends CanonicalIntegrationWriteOperation {
  targetPath: string;
}

/** The minimal local state needed to undo writes from one promotion attempt. */
export interface CanonicalPromotionRollbackEntry {
  action: "CREATE" | "UPDATE";
  targetPath: string;
  original?: Buffer;
}

export class CanonicalIntegrationPromotionError extends Error {
  readonly rollbackSucceeded?: boolean;

  constructor(message: string, rollbackSucceeded?: boolean) {
    super(message);
    this.name = "CanonicalIntegrationPromotionError";
    this.rollbackSucceeded = rollbackSucceeded;
  }
}

function runGit(repoPath: string, args: string[]): string {
  const result = spawnSync("git", ["-C", repoPath, ...args], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new CanonicalIntegrationPromotionError(`Git safety check failed: ${(result.stderr || result.error?.message || "unknown Git error").trim()}`);
  }
  return result.stdout.trim();
}

function getPath(fields: RecordFields, dotted: string): unknown {
  let value: unknown = fields;
  for (const part of dotted.split(".")) {
    if (value === null || typeof value !== "object" || Array.isArray(value) || !(part in value)) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function isWithinDirectory(directory: string, target: string): boolean {
  if (!directory || !target || directory.includes("\\") || target.includes("\\")) return false;
  const normalizedDirectory = path.normalize(directory);
  const normalizedTarget = path.normalize(target);
  return !path.isAbsolute(normalizedDirectory)
    && !path.isAbsolute(normalizedTarget)
    && normalizedDirectory !== "."
    && normalizedDirectory !== ".."
    && !normalizedDirectory.startsWith("../")
    && normalizedTarget.startsWith(`${normalizedDirectory}/`);
}

function assertCanonicalRepositoryState(researchRoot: string, baseGitSha: string): { researchRoot: string; head: string } {
  if (!/^[0-9a-f]{40}$/i.test(baseGitSha)) {
    throw new CanonicalIntegrationPromotionError("plan baseGitSha must be a full 40-character Git SHA");
  }

  const resolvedResearchRoot = realpathSync(resolve(researchRoot));
  const repositoryRoot = realpathSync(runGit(resolvedResearchRoot, ["rev-parse", "--show-toplevel"]));
  // Git supplies the repository-relative location without relying on Windows
  // long-path versus 8.3-path spelling, which can differ for the same root.
  if (runGit(resolvedResearchRoot, ["rev-parse", "--show-prefix"]) !== "research/") {
    throw new CanonicalIntegrationPromotionError("researchRoot must resolve to this repository's canonical research/ directory");
  }

  const head = runGit(repositoryRoot, ["rev-parse", "HEAD"]);
  if (head !== baseGitSha) {
    throw new CanonicalIntegrationPromotionError("plan baseGitSha does not match the current Git HEAD");
  }
  if (runGit(repositoryRoot, ["status", "--porcelain", "--untracked-files=all"]) !== "") {
    throw new CanonicalIntegrationPromotionError("Git working tree must be clean before canonical promotion");
  }
  return { researchRoot: resolvedResearchRoot, head };
}

function assertExistingCorpusValid(researchRoot: string): void {
  const validation = validateResearchRoot(researchRoot);
  if (validation.errors.length > 0) {
    throw new CanonicalIntegrationPromotionError("current canonical research corpus has validation errors");
  }
}

function prepareWrites(researchRoot: string, plan: CanonicalIntegrationPlan): PreparedWrite[] {
  if (!Array.isArray(plan.deltas) || !Array.isArray(plan.operations) || plan.deltas.length !== plan.operations.length) {
    throw new CanonicalIntegrationPromotionError("plan deltas and operations must have matching deterministic identities/actions");
  }

  const index = loadCorpusIndex(researchRoot);
  const targets = new Set<string>();
  const identities = new Set<string>();
  const writes: PreparedWrite[] = [];

  plan.operations.forEach((operation, position) => {
    if (operation.action !== "CREATE" && operation.action !== "UPDATE" && operation.action !== "NO_CHANGE") {
      throw new CanonicalIntegrationPromotionError(`unsupported canonical integration operation action: ${String(operation.action)}`);
    }
    const delta = plan.deltas[position];
    if (!delta || delta.recordFamily !== operation.recordFamily || delta.id !== operation.id || delta.action !== operation.action) {
      throw new CanonicalIntegrationPromotionError("plan deltas and operations must have matching deterministic identities/actions");
    }
    const identity = `${operation.recordFamily}\u0000${operation.id}`;
    if (identities.has(identity)) throw new CanonicalIntegrationPromotionError(`duplicate plan identity: ${operation.recordFamily}${operation.id}`);
    identities.add(identity);

    const recordIndex = index.byPrefix.get(operation.recordFamily);
    if (!recordIndex) throw new CanonicalIntegrationPromotionError(`unknown record family: ${operation.recordFamily}`);

    if (operation.action === "NO_CHANGE") {
      if ("targetFile" in operation || "yaml" in operation) {
        throw new CanonicalIntegrationPromotionError("NO_CHANGE operations must not have write target or YAML content");
      }
      return;
    }

    const write = operation as CanonicalIntegrationWriteOperation;
    if (!isWithinDirectory(recordIndex.schema.directory, write.targetFile)) {
      throw new CanonicalIntegrationPromotionError(`write target escapes schema directory: ${write.targetFile}`);
    }
    if (targets.has(write.targetFile)) throw new CanonicalIntegrationPromotionError(`duplicate write target: ${write.targetFile}`);
    targets.add(write.targetFile);
    const expectedTarget = operation.action === "CREATE"
      ? `${recordIndex.schema.directory}/${operation.id}.yaml`
      : recordIndex.byId.get(operation.id)?.file;
    if (write.targetFile !== expectedTarget) {
      throw new CanonicalIntegrationPromotionError(`${operation.action} target does not match current canonical target: ${write.targetFile}`);
    }

    const targetPath = resolve(researchRoot, ...write.targetFile.split("/"));
    const schemaDirectory = resolve(researchRoot, ...recordIndex.schema.directory.split("/"));
    const fromSchemaDirectory = relative(schemaDirectory, targetPath);
    if (
      fromSchemaDirectory === ""
      || fromSchemaDirectory === ".."
      || fromSchemaDirectory.startsWith(`..${sep}`)
      || isAbsolute(fromSchemaDirectory)
    ) {
      throw new CanonicalIntegrationPromotionError(`write target escapes schema directory: ${write.targetFile}`);
    }
    if (operation.action === "CREATE" ? existsSync(targetPath) : !existsSync(targetPath)) {
      throw new CanonicalIntegrationPromotionError(`${operation.action} target has unexpected filesystem state: ${write.targetFile}`);
    }
    const fields = parseRecordYaml(write.yaml);
    if (getPath(fields, recordIndex.schema.idField) !== operation.id) {
      throw new CanonicalIntegrationPromotionError(`write YAML canonical ID does not match operation ID: ${operation.id}`);
    }
    writes.push({ ...write, targetPath });
  });

  return writes;
}

function applyWrites(writes: readonly PreparedWrite[], root: string): void {
  for (const write of writes) {
    const targetPath = join(root, ...write.targetFile.split("/"));
    if (write.action === "CREATE") writeFileSync(targetPath, write.yaml, { encoding: "utf8", flag: "wx" });
    else writeFileSync(targetPath, write.yaml, "utf8");
  }
}

/** Restores only files touched by this one promotion attempt. */
export function rollbackCanonicalPromotion(entries: readonly CanonicalPromotionRollbackEntry[]): boolean {
  try {
    for (const entry of [...entries].reverse()) {
      if (entry.action === "UPDATE") writeFileSync(entry.targetPath, entry.original!);
      else if (existsSync(entry.targetPath)) rmSync(entry.targetPath);
    }
    return true;
  } catch {
    return false;
  }
}

function assertFinalBytes(writes: readonly PreparedWrite[]): void {
  for (const write of writes) {
    if (!readFileSync(write.targetPath).equals(Buffer.from(write.yaml, "utf8"))) {
      throw new CanonicalIntegrationPromotionError(`final canonical bytes differ from approved plan for ${write.targetFile}`);
    }
  }
}

/**
 * Applies only the supplied, externally human-approved Gate 1 plan. It makes
 * no Gate 1 decision, stores no approval, and performs no Git mutation.
 */
export function applyCanonicalIntegrationPlan(researchRoot: string, plan: CanonicalIntegrationPlan): CanonicalIntegrationPromotionResult {
  const state = assertCanonicalRepositoryState(researchRoot, plan.baseGitSha);
  assertExistingCorpusValid(state.researchRoot);
  const writes = prepareWrites(state.researchRoot, plan);

  const stageParent = mkdtempSync(join(tmpdir(), "open-evora-canonical-promoter-"));
  try {
    const stagedResearchRoot = join(stageParent, "research");
    cpSync(state.researchRoot, stagedResearchRoot, { recursive: true });
    applyWrites(writes, stagedResearchRoot);
    const stagedValidation = validateResearchRoot(stagedResearchRoot);
    if (stagedValidation.errors.length > 0) {
      throw new CanonicalIntegrationPromotionError("approved plan would produce a canonical corpus with validation errors");
    }
  } finally {
    rmSync(stageParent, { recursive: true, force: true });
  }

  const rollbackEntries: CanonicalPromotionRollbackEntry[] = writes.map((write) => (
    write.action === "UPDATE"
      ? { action: "UPDATE", targetPath: write.targetPath, original: readFileSync(write.targetPath) }
      : { action: "CREATE", targetPath: write.targetPath }
  ));
  const touched: CanonicalPromotionRollbackEntry[] = [];
  try {
    for (let index = 0; index < writes.length; index += 1) {
      const write = writes[index]!;
      const entry = rollbackEntries[index]!;
      if (write.action === "CREATE") writeFileSync(write.targetPath, write.yaml, { encoding: "utf8", flag: "wx" });
      else writeFileSync(write.targetPath, write.yaml, "utf8");
      touched.push(entry);
    }
    const postWriteValidation = validateResearchRoot(state.researchRoot);
    if (postWriteValidation.errors.length > 0) {
      throw new CanonicalIntegrationPromotionError("post-write canonical validation failed");
    }
    assertFinalBytes(writes);
    return {
      baseGitSha: state.head,
      createCount: writes.filter((write) => write.action === "CREATE").length,
      updateCount: writes.filter((write) => write.action === "UPDATE").length,
      noChangeCount: plan.operations.filter((operation) => operation.action === "NO_CHANGE").length,
      postWriteValidation,
    };
  } catch (error) {
    const rollbackSucceeded = rollbackCanonicalPromotion(touched);
    const message = error instanceof Error ? error.message : "canonical promotion failed";
    throw new CanonicalIntegrationPromotionError(message, rollbackSucceeded);
  }
}
