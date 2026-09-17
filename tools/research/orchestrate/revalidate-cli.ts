#!/usr/bin/env node
/**
 * Operator CLI for the bounded frozen-cycle base revalidation path (see
 * revalidate-frozen-cycle.ts's module doc for the full requirement
 * mapping). Revalidates an already-frozen, previously-reviewed cycle's
 * candidate set against a NEW canonical base without re-authoring research,
 * but only when canonical `research/**` did not drift between the two
 * bases. PRIMARY_AUTHOR is never invoked by this command.
 *
 * This command loads the canonical corpus from the current working tree, so
 * it requires the working tree's current HEAD to equal --new-base-git-sha
 * AND the working tree to be genuinely clean (PR #127 remediation, finding
 * 3 — via the existing precheckRepositoryState() helper) — checked
 * explicitly, fail-closed — it performs no checkout of its own, matching
 * every other command in this directory (cli.ts, hold-cli.ts), none of
 * which manipulate Git branch/checkout state either.
 *
 * A PRE_GATE_SAFETY_HOLD reached here is resumable through hold-cli.ts's
 * `resume-revalidation` action (PR #127 remediation, finding 1) — the same
 * supported operator path the normal AI-driven path's HOLD already uses,
 * never a second incompatible protocol. An owner may also still choose to
 * re-run this command against a fresh target cycle instead.
 *
 * Usage:
 *   RESEARCH_AI_COMMAND=<executable> [RESEARCH_AI_ARGS="..."] \
 *   node --experimental-strip-types tools/research/orchestrate/revalidate-cli.ts \
 *     --source-cycle-dir .research-workbench/<old-cycle-name> \
 *     --target-cycle-dir .research-workbench/<new-cycle-name> \
 *     --old-base-git-sha <40-char-sha> \
 *     --new-base-git-sha <40-char-sha> \
 *     [--dir <researchRoot>]
 *
 * Exit code 0 = READY_FOR_HUMAN_REVIEW; 1 = FAILED (fail-closed), HOLD, or usage error.
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCorpusIndex } from "../core/corpus.ts";
import { validateCorpusIndex } from "../validation/validate.ts";
import type { CorpusIndex } from "../core/types.ts";
import { LocalCommandAiInvoker, loadLocalCommandAiInvokerConfigFromEnv } from "./ai-invoker.ts";
import { revalidateFrozenCycleAtNewBase } from "./revalidate-frozen-cycle.ts";
import type { ResearchChangeSet } from "./types.ts";
import { resolveAvailabilityAdapter } from "../admission/http-availability-adapter.ts";
import { createInferenceLimitResolutionChecker } from "../admission/inference-limit-resolution.ts";
import { precheckRepositoryState } from "../gate/repository-state.ts";

const FULL_GIT_SHA = /^[0-9a-fA-F]{40}$/;

function buildReadyOutput(changeSet: ResearchChangeSet, outputPath: string): string {
  return [
    "READY_FOR_HUMAN_REVIEW (frozen-cycle base revalidation)",
    `  packageId: ${changeSet.packageId}`,
    `  baseGitSha: ${changeSet.baseGitSha}`,
    `  candidates: ${changeSet.candidates.length}`,
    `  independentReview.outcome: ${changeSet.independentReview.outcome}`,
    `  written: ${outputPath}`,
  ].join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const idx = args.indexOf(name);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const dirFlag = flag("--dir");
  const researchRoot = dirFlag
    ? resolve(dirFlag)
    : resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "research");

  const sourceCycleDirFlag = flag("--source-cycle-dir");
  const targetCycleDirFlag = flag("--target-cycle-dir");
  const oldBaseGitSha = flag("--old-base-git-sha");
  const newBaseGitSha = flag("--new-base-git-sha");

  if (!sourceCycleDirFlag || !targetCycleDirFlag || !oldBaseGitSha || !newBaseGitSha) {
    console.error(
      "Usage: node tools/research/orchestrate/revalidate-cli.ts --source-cycle-dir <path> " +
      "--target-cycle-dir <path> --old-base-git-sha <sha> --new-base-git-sha <sha> [--dir <researchRoot>]"
    );
    process.exitCode = 1;
    return;
  }

  if (!FULL_GIT_SHA.test(oldBaseGitSha) || !FULL_GIT_SHA.test(newBaseGitSha)) {
    console.error("FAILED [USAGE]: --old-base-git-sha and --new-base-git-sha must each be a full 40-character hexadecimal SHA");
    process.exitCode = 1;
    return;
  }

  // This command never checks out Git state itself; it only ever reads the
  // corpus already on disk in the current working tree. The corpus it loads
  // is therefore only valid for the NEW base if the working tree's current
  // HEAD actually is that base, AND the working tree is genuinely clean —
  // an uncommitted local edit under research/** would otherwise be silently
  // folded into "the canonical corpus at the new base" without ever having
  // been committed (PR #127 remediation, finding 3). Reuses the existing
  // precheckRepositoryState() repository-state helper (gate/repository-
  // state.ts) — the exact same HEAD-match + whole-working-tree-clean check
  // applyCanonicalIntegrationPlan() itself performs before any canonical
  // write — rather than a second, narrower Git-invocation convention.
  const repositoryState = precheckRepositoryState(researchRoot, newBaseGitSha);
  if (!repositoryState.ok) {
    console.error(`FAILED [REPOSITORY_STATE_INVALID]: ${repositoryState.reason}`);
    process.exitCode = 1;
    return;
  }

  const sourceCycleDir = resolve(sourceCycleDirFlag);
  const targetCycleDir = resolve(targetCycleDirFlag);

  const aiConfig = loadLocalCommandAiInvokerConfigFromEnv();
  if (!aiConfig) {
    console.error(
      "FAILED [AI_RUNTIME_NOT_CONFIGURED]: RESEARCH_AI_COMMAND is not set. This path still requires an " +
      "operator-configured local AI command/process for the fresh INDEPENDENT_REVIEWER invocation (only " +
      "reached if admission is ELIGIBLE at the new base). PRIMARY_AUTHOR is never invoked by this command."
    );
    process.exitCode = 1;
    return;
  }
  const reviewerInvoker = new LocalCommandAiInvoker(aiConfig);

  const index: CorpusIndex = loadCorpusIndex(researchRoot);
  const { errors } = validateCorpusIndex(index);
  if (errors.length > 0) {
    console.error(
      `Cannot revalidate: canonical research corpus at the new base fails validation (${errors.length} problem(s)). ` +
      "Run node tools/research/validation/cli.ts for details."
    );
    process.exitCode = 1;
    return;
  }

  const outcome = await revalidateFrozenCycleAtNewBase({
    sourceCycleDir,
    targetCycleDir,
    oldBaseGitSha,
    newBaseGitSha,
    index,
    reviewerInvoker,
    resolveAvailabilityAdapter: (materialSources) => resolveAvailabilityAdapter(materialSources),
    // Bound to targetCycleDir only — never sourceCycleDir — so an
    // inference-limit resolution recorded for the OLD base/cycle can never
    // be treated as valid at the NEW base (requirement 10). A fresh
    // resolution must be recorded against targetCycleDir, via hold-cli.ts's
    // existing record-resolution action, if this run reaches a
    // CLAIM_INFERENCE_LIMITS_PRESENT HOLD.
    inferenceLimitResolutionChecker: createInferenceLimitResolutionChecker(targetCycleDir),
  });

  if (outcome.status === "FAILED") {
    console.error(`FAILED [${outcome.failedCheck}]: ${outcome.message}`);
    process.exitCode = 1;
    return;
  }
  if (outcome.status === "PRE_GATE_SAFETY_HOLD") {
    console.error(
      `PRE_GATE_SAFETY_HOLD: ${outcome.holdReportPath}\n` +
      "  Resumable via: node tools/research/orchestrate/hold-cli.ts resume-revalidation " +
      `--cycle-dir ${targetCycleDir} --source-cycle-dir ${sourceCycleDir} ` +
      `--old-base-git-sha ${oldBaseGitSha} --new-base-git-sha ${newBaseGitSha}`
    );
    process.exitCode = 1;
    return;
  }

  const outputPath = join(targetCycleDir, "research-change-set.json");
  writeFileSync(outputPath, `${JSON.stringify(outcome.changeSet, null, 2)}\n`, "utf8");

  console.log(buildReadyOutput(outcome.changeSet, outputPath));
  process.exitCode = 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error: unknown) => {
    console.error(`FAILED [UNCAUGHT]: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
