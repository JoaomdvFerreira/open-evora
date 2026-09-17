#!/usr/bin/env node
/**
 * Small, explicit operator CLI for the F3 pre-Gate HOLD resume path
 * (independent-review remediation of WU053), extended by PR #127
 * remediation (finding 1) to also resume a HOLD reached through the bounded
 * frozen-cycle base-revalidation path. Three actions, all requiring an
 * operator to run this deliberately against a specific cycle directory —
 * never invoked automatically by cli.ts's or revalidate-cli.ts's normal
 * paths:
 *
 *   record-resolution     Records the permitted local, workbench-only
 *                          CLAIM_INFERENCE_LIMITS_PRESENT resolution for one
 *                          EVD candidate (see ../admission/inference-limit-
 *                          resolution.ts). Does not itself unblock anything;
 *                          it only makes the exact-match binding available
 *                          for the next resume/normal-path admission check.
 *                          Applies identically to a HOLD from either origin
 *                          below, since it only ever binds to a cycle
 *                          directory's frozen candidate content.
 *
 *   resume                 Resumes an existing normal-path (trigger-
 *                          originated) pre-Gate HOLD at --cycle-dir: reloads
 *                          the exact frozen manifest/candidates from that
 *                          HOLD (never re-invoking PRIMARY_AUTHOR), reruns
 *                          prospective validation, performs fresh Source
 *                          availability checks, and re-evaluates admission.
 *                          A fresh INDEPENDENT_REVIEWER invocation happens
 *                          only if admission is now ELIGIBLE — see
 *                          run-cycle.ts's resumePreGateHold().
 *
 *   resume-revalidation     Resumes an existing base-revalidation-originated
 *                          pre-Gate HOLD (revalidate-cli.ts) at --cycle-dir,
 *                          through the exact same shared mechanism `resume`
 *                          above uses (run-cycle.ts's resumeRevalidationHold()),
 *                          keyed to --source-cycle-dir/--old-base-git-sha
 *                          instead of a trigger. PRIMARY_AUTHOR is never
 *                          invoked; a fresh INDEPENDENT_REVIEWER is invoked
 *                          only if admission is now ELIGIBLE.
 *
 * No action ever performs a canonical write or touches `.aiqt/**`.
 *
 * Usage:
 *   node --experimental-strip-types tools/research/orchestrate/hold-cli.ts \
 *     record-resolution --cycle-dir <path> --base-git-sha <sha> \
 *     --subject-id EVD-XXXX --resolved-by <name> --note <text>
 *
 *   RESEARCH_AI_COMMAND=<executable> [RESEARCH_AI_ARGS="..."] \
 *   node --experimental-strip-types tools/research/orchestrate/hold-cli.ts \
 *     resume --cycle-dir <path> --base-git-sha <sha> \
 *     --mode daily-discovery|problem-refresh --request "<text>" \
 *     [--target-problem-id PRB-0001] [--dir <researchRoot>]
 *
 *   RESEARCH_AI_COMMAND=<executable> [RESEARCH_AI_ARGS="..."] \
 *   node --experimental-strip-types tools/research/orchestrate/hold-cli.ts \
 *     resume-revalidation --cycle-dir <path> --source-cycle-dir <path> \
 *     --old-base-git-sha <sha> --new-base-git-sha <sha> [--dir <researchRoot>]
 *
 * Exit code 0 = success (resolution recorded, or resume reached
 * READY_FOR_HUMAN_REVIEW/idempotent reuse); 1 = FAILED/HOLD/usage error.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCorpusIndex } from "../core/corpus.ts";
import { validateCorpusIndex } from "../validation/validate.ts";
import type { CorpusIndex } from "../core/types.ts";
import { LocalCommandAiInvoker, loadLocalCommandAiInvokerConfigFromEnv } from "./ai-invoker.ts";
import { resumePreGateHold, resumeRevalidationHold } from "./run-cycle.ts";
import type { ResearchMode, ResearchTrigger } from "./types.ts";
import { assertWorkbenchBoundary } from "./workbench-boundary.ts";
import { resolveAvailabilityAdapter } from "../admission/http-availability-adapter.ts";
import { createInferenceLimitResolutionChecker, writeInferenceLimitResolution } from "../admission/inference-limit-resolution.ts";
import { loadCandidates } from "./candidate-loader.ts";
import { asValidatedManifest, validateManifest } from "./manifest.ts";
import { tryReuseExistingChangeSet } from "./cli.ts";
import { precheckRepositoryState } from "../gate/repository-state.ts";
import { asValidatedResearchChangeSet, validateResearchChangeSet } from "./rcs-validator.ts";

function flagReader(args: readonly string[]): (name: string) => string | undefined {
  return (name: string) => {
    const idx = args.indexOf(name);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
}

function resolveResearchRoot(dirFlag: string | undefined): string {
  return dirFlag
    ? resolve(dirFlag)
    : resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "research");
}

/**
 * Records the permitted local resolution for one candidate's
 * CLAIM_INFERENCE_LIMITS_PRESENT finding. Reloads the exact frozen
 * manifest/candidate from `cycleDir` (never re-authoring or re-deriving the
 * candidate content) so the recorded resolution is bound, via the existing
 * fingerprint convention, to exactly what a HOLD actually evaluated.
 */
function recordResolution(args: readonly string[]): number {
  const flag = flagReader(args);
  const cycleDirFlag = flag("--cycle-dir");
  const baseGitSha = flag("--base-git-sha");
  const subjectId = flag("--subject-id");
  const resolvedBy = flag("--resolved-by");
  const note = flag("--note");

  if (!cycleDirFlag || !baseGitSha || !subjectId || !resolvedBy || !note) {
    console.error(
      "Usage: hold-cli.ts record-resolution --cycle-dir <path> --base-git-sha <sha> " +
      "--subject-id <EVD id> --resolved-by <name> --note <text>"
    );
    return 1;
  }

  const cycleDir = resolve(cycleDirFlag);
  try {
    assertWorkbenchBoundary(cycleDir);
  } catch (error) {
    console.error(`Refusing to run: ${(error as Error).message}`);
    return 1;
  }

  const manifestPath = join(cycleDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`FAILED [MANIFEST_MISSING]: no manifest.json at ${cycleDir}`);
    return 1;
  }
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    console.error(`FAILED [MANIFEST_INVALID]: manifest.json is not valid JSON: ${(error as Error).message}`);
    return 1;
  }
  const manifestValidation = validateManifest(rawManifest);
  if (manifestValidation.errors.length > 0) {
    console.error(`FAILED [MANIFEST_INVALID]: ${manifestValidation.errors.join("; ")}`);
    return 1;
  }
  const manifest = asValidatedManifest(rawManifest);

  const researchRoot = resolveResearchRoot(flag("--dir"));
  const index: CorpusIndex = loadCorpusIndex(researchRoot);
  const loadResult = loadCandidates(index, join(cycleDir, "candidates"), manifest.candidateFiles);
  if (loadResult.failures.length > 0) {
    console.error(
      `FAILED [CANDIDATE_LOAD]: ${loadResult.failures.map((failure) => `${failure.file}: ${failure.message}`).join("; ")}`
    );
    return 1;
  }

  const candidate = loadResult.candidates.find(
    (item) => item.recordFamily === "EVD-" && item.fields.evidence_id === subjectId
  );
  if (!candidate) {
    console.error(`FAILED [SUBJECT_NOT_FOUND]: no EVD candidate with evidence_id ${JSON.stringify(subjectId)} in this cycle's frozen candidates`);
    return 1;
  }
  const inferenceLimits = Array.isArray(candidate.fields.inference_limits)
    ? candidate.fields.inference_limits.filter((v): v is string => typeof v === "string")
    : [];

  const file = writeInferenceLimitResolution(cycleDir, { baseGitSha, subjectId, candidateFields: candidate.fields, inferenceLimits }, resolvedBy, note);
  console.log(`RESOLUTION_RECORDED\n  subjectId: ${subjectId}\n  written: ${file}`);
  return 0;
}

function buildReadyOutput(changeSet: import("./types.ts").ResearchChangeSet, outputPath: string, suffix?: string): string {
  const header = suffix ? `READY_FOR_HUMAN_REVIEW ${suffix}` : "READY_FOR_HUMAN_REVIEW";
  return [
    header,
    `  packageId: ${changeSet.packageId}`,
    `  baseGitSha: ${changeSet.baseGitSha}`,
    `  candidates: ${changeSet.candidates.length}`,
    `  independentReview.outcome: ${changeSet.independentReview.outcome}`,
    `  written: ${outputPath}`,
  ].join("\n");
}

/** Resumes an existing pre-Gate HOLD at --cycle-dir. Never invokes PRIMARY_AUTHOR. */
async function resume(args: readonly string[]): Promise<number> {
  const flag = flagReader(args);
  const cycleDirFlag = flag("--cycle-dir");
  const baseGitSha = flag("--base-git-sha");
  const modeFlag = flag("--mode");
  const request = flag("--request");
  const targetProblemId = flag("--target-problem-id");

  if (!cycleDirFlag || !baseGitSha || !modeFlag || !request) {
    console.error(
      "Usage: hold-cli.ts resume --cycle-dir <path> --base-git-sha <sha> " +
      "--mode daily-discovery|problem-refresh --request <text> [--target-problem-id <id>] [--dir <researchRoot>]"
    );
    return 1;
  }
  if (modeFlag !== "daily-discovery" && modeFlag !== "problem-refresh") {
    console.error(`FAILED [USAGE]: --mode must be "daily-discovery" or "problem-refresh", got ${JSON.stringify(modeFlag)}`);
    return 1;
  }

  const trigger: ResearchTrigger = {
    mode: modeFlag as ResearchMode,
    ...(targetProblemId ? { targetProblemId } : {}),
    request,
  };

  const cycleDir = resolve(cycleDirFlag);
  try {
    assertWorkbenchBoundary(cycleDir);
  } catch (error) {
    console.error(`Refusing to run: ${(error as Error).message}`);
    return 1;
  }

  // Idempotency (matches cli.ts's own normal-path check): if this cycle
  // directory already holds a genuinely completed research-change-set.json
  // for this exact identity, reuse it rather than resuming again.
  const outputPath = join(cycleDir, "research-change-set.json");
  const reuse = tryReuseExistingChangeSet(outputPath, { baseGitSha, mode: trigger.mode, targetProblemId: trigger.targetProblemId, request: trigger.request });
  if (reuse.status === "REUSABLE") {
    console.log(buildReadyOutput(reuse.changeSet, outputPath, "(idempotent reuse of existing package)"));
    return 0;
  }

  const aiConfig = loadLocalCommandAiInvokerConfigFromEnv();
  if (!aiConfig) {
    console.error(
      "FAILED [AI_RUNTIME_NOT_CONFIGURED]: RESEARCH_AI_COMMAND is not set. Resuming a HOLD still " +
      "requires an operator-configured local AI command/process for the fresh INDEPENDENT_REVIEWER " +
      "invocation (only reached if admission is now ELIGIBLE)."
    );
    return 1;
  }
  const reviewerInvoker = new LocalCommandAiInvoker(aiConfig);

  const researchRoot = resolveResearchRoot(flag("--dir"));
  const index: CorpusIndex = loadCorpusIndex(researchRoot);
  const { errors } = validateCorpusIndex(index);
  if (errors.length > 0) {
    console.error(
      `Cannot resume: canonical research corpus fails validation (${errors.length} problem(s)). Run node tools/research/validation/cli.ts for details.`
    );
    return 1;
  }

  const outcome = await resumePreGateHold({
    index,
    baseGitSha,
    trigger,
    cycleDir,
    reviewerInvoker,
    resolveAvailabilityAdapter: (materialSources) => resolveAvailabilityAdapter(materialSources),
    inferenceLimitResolutionChecker: createInferenceLimitResolutionChecker(cycleDir),
  });

  if (outcome.status === "FAILED") {
    console.error(`FAILED [${outcome.failedCheck}]: ${outcome.message}`);
    return 1;
  }
  if (outcome.status === "PRE_GATE_SAFETY_HOLD") {
    console.error(`PRE_GATE_SAFETY_HOLD: ${outcome.holdReportPath}`);
    return 1;
  }

  writeFileSync(outputPath, `${JSON.stringify(outcome.changeSet, null, 2)}\n`, "utf8");
  console.log(buildReadyOutput(outcome.changeSet, outputPath));
  return 0;
}

/**
 * PR #127 remediation (finding 1): resumes an existing pre-Gate HOLD
 * produced by the bounded frozen-cycle base-revalidation path
 * (revalidate-cli.ts) at --cycle-dir. Mirrors `resume` above exactly, using
 * resumeRevalidationHold() (identity.kind = "BASE_REVALIDATION") in place of
 * resumePreGateHold() — the same shared hold-freeze/resume mechanism
 * (run-cycle.ts), never a second incompatible protocol. Never invokes
 * PRIMARY_AUTHOR; a fresh INDEPENDENT_REVIEWER is invoked only if admission
 * is now ELIGIBLE.
 */
async function resumeRevalidation(args: readonly string[]): Promise<number> {
  const flag = flagReader(args);
  const cycleDirFlag = flag("--cycle-dir");
  const sourceCycleDirFlag = flag("--source-cycle-dir");
  const oldBaseGitSha = flag("--old-base-git-sha");
  const newBaseGitSha = flag("--new-base-git-sha");

  if (!cycleDirFlag || !sourceCycleDirFlag || !oldBaseGitSha || !newBaseGitSha) {
    console.error(
      "Usage: hold-cli.ts resume-revalidation --cycle-dir <path> --source-cycle-dir <path> " +
      "--old-base-git-sha <sha> --new-base-git-sha <sha> [--dir <researchRoot>]"
    );
    return 1;
  }

  const cycleDir = resolve(cycleDirFlag);
  const sourceCycleDir = resolve(sourceCycleDirFlag);
  try {
    assertWorkbenchBoundary(cycleDir);
  } catch (error) {
    console.error(`Refusing to run: ${(error as Error).message}`);
    return 1;
  }

  // Idempotency: if this target cycle directory already holds a genuinely
  // completed research-change-set.json at exactly the new base, reuse it
  // rather than resuming again — mirroring `resume`'s own idempotent-reuse
  // check, but against baseGitSha alone (this path has no trigger
  // mode/request identity to compare).
  const outputPath = join(cycleDir, "research-change-set.json");
  if (existsSync(outputPath)) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(outputPath, "utf8"));
    } catch {
      raw = undefined;
    }
    if (raw !== undefined) {
      const validation = validateResearchChangeSet(raw);
      if (validation.errors.length === 0) {
        const existing = asValidatedResearchChangeSet(raw);
        if (existing.baseGitSha === newBaseGitSha) {
          console.log(buildReadyOutput(existing, outputPath, "(idempotent reuse of existing package)"));
          return 0;
        }
      }
    }
  }

  const aiConfig = loadLocalCommandAiInvokerConfigFromEnv();
  if (!aiConfig) {
    console.error(
      "FAILED [AI_RUNTIME_NOT_CONFIGURED]: RESEARCH_AI_COMMAND is not set. Resuming a HOLD still " +
      "requires an operator-configured local AI command/process for the fresh INDEPENDENT_REVIEWER " +
      "invocation (only reached if admission is now ELIGIBLE)."
    );
    return 1;
  }
  const reviewerInvoker = new LocalCommandAiInvoker(aiConfig);

  const researchRoot = resolveResearchRoot(flag("--dir"));

  // Same clean-tree + HEAD-match precondition revalidate-cli.ts enforces
  // (PR #127 remediation, finding 3) — resuming still loads the canonical
  // corpus from the current working tree, so it must genuinely reflect the
  // new base.
  const repositoryState = precheckRepositoryState(researchRoot, newBaseGitSha);
  if (!repositoryState.ok) {
    console.error(`FAILED [REPOSITORY_STATE_INVALID]: ${repositoryState.reason}`);
    return 1;
  }

  const index: CorpusIndex = loadCorpusIndex(researchRoot);
  const { errors } = validateCorpusIndex(index);
  if (errors.length > 0) {
    console.error(
      `Cannot resume: canonical research corpus fails validation (${errors.length} problem(s)). Run node tools/research/validation/cli.ts for details.`
    );
    return 1;
  }

  const outcome = await resumeRevalidationHold({
    index,
    baseGitSha: newBaseGitSha,
    sourceCycleDir,
    oldBaseGitSha,
    cycleDir,
    reviewerInvoker,
    resolveAvailabilityAdapter: (materialSources) => resolveAvailabilityAdapter(materialSources),
    inferenceLimitResolutionChecker: createInferenceLimitResolutionChecker(cycleDir),
  });

  if (outcome.status === "FAILED") {
    console.error(`FAILED [${outcome.failedCheck}]: ${outcome.message}`);
    return 1;
  }
  if (outcome.status === "PRE_GATE_SAFETY_HOLD") {
    console.error(`PRE_GATE_SAFETY_HOLD: ${outcome.holdReportPath}`);
    return 1;
  }

  writeFileSync(outputPath, `${JSON.stringify(outcome.changeSet, null, 2)}\n`, "utf8");
  console.log(buildReadyOutput(outcome.changeSet, outputPath));
  return 0;
}

async function main(): Promise<void> {
  const [action, ...rest] = process.argv.slice(2);
  if (action === "record-resolution") {
    process.exitCode = recordResolution(rest);
    return;
  }
  if (action === "resume") {
    process.exitCode = await resume(rest);
    return;
  }
  if (action === "resume-revalidation") {
    process.exitCode = await resumeRevalidation(rest);
    return;
  }
  console.error("Usage: hold-cli.ts <record-resolution|resume|resume-revalidation> [...flags]");
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error: unknown) => {
    console.error(`FAILED [UNCAUGHT]: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
