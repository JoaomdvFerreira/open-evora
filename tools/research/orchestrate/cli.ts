#!/usr/bin/env node
/**
 * Local/operator-triggered orchestration entry point for automated
 * research preparation (contract §11, OD-A Option 1). A human runs this
 * once per cycle, supplying the
 * accepted RESEARCH_TRIGGER; it requires no scheduler, cron, or always-on
 * service.
 *
 * WU045-B01 remediation: the normal path now drives both required OD-B AI
 * invocations itself (primary authoring, then a fresh, separately-invoked
 * independent review — see run-cycle.ts) rather than requiring an operator
 * to pre-create manifest.json/independent-review.json/candidate YAML. It
 * sequences the already-existing deterministic primitives (§6) and
 * structurally validates every AI-produced artifact, producing exactly a
 * READY_FOR_HUMAN_REVIEW Research Change Set (OD-C) or an explicit
 * failure — never a partial "looks ready" package, and never a canonical
 * or public write.
 *
 * AI runtime configuration (OD-A/§2 "do not choose a vendor"): the
 * executable that performs both AI roles is entirely operator-configured
 * via environment variables (see ai-invoker.ts); this module never selects
 * or hard-codes a vendor/model. If unset, this command fails closed with
 * AI_RUNTIME_NOT_CONFIGURED rather than silently falling back to
 * pre-generated files.
 *
 * Cycle directory layout (all paths relative to --cycle-dir, which must
 * live under the gitignored .research-workbench/ boundary):
 *   manifest.json                  (written by this CLI from the validated
 *                                    PRIMARY_AUTHOR envelope)
 *   candidates/<file>.yaml          (written by this CLI from the same
 *                                    envelope)
 *   independent-review.json        (written by this CLI from the validated
 *                                    INDEPENDENT_REVIEWER result)
 *   research-change-set.json       (OD-C JSON source of truth; output)
 *
 * WU045 never renders a Markdown view and never computes WU046's separate
 * approval/contentHash binding — see research-change-set.ts.
 *
 * Usage:
 *   RESEARCH_AI_COMMAND=<executable> [RESEARCH_AI_ARGS="..."] \
 *   node --experimental-strip-types tools/research/orchestrate/cli.ts \
 *     --cycle-dir .research-workbench/<cycle-name> \
 *     --base-git-sha <40-char-sha> \
 *     --mode daily-discovery|problem-refresh \
 *     --request "<bounded research question/URL/request>" \
 *     [--target-problem-id PRB-0001] \
 *     [--dir <researchRoot>]
 *
 * Exit code 0 = READY_FOR_HUMAN_REVIEW; 1 = FAILED (fail-closed) or usage error.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCorpusIndex } from "../core/corpus.ts";
import { validateCorpusIndex } from "../validation/validate.ts";
import type { CorpusIndex } from "../core/types.ts";
import { LocalCommandAiInvoker, loadLocalCommandAiInvokerConfigFromEnv } from "./ai-invoker.ts";
import { asValidatedResearchChangeSet, validateResearchChangeSet } from "./rcs-validator.ts";
import { runResearchCycle } from "./run-cycle.ts";
import type { ResearchChangeSet, ResearchMode, ResearchTrigger } from "./types.ts";
import { assertWorkbenchBoundary } from "./workbench-boundary.ts";
import { resolveAvailabilityAdapter } from "../admission/http-availability-adapter.ts";
import { createInferenceLimitResolutionChecker } from "../admission/inference-limit-resolution.ts";

export interface ReuseIdentity {
  baseGitSha: string;
  mode: ResearchMode;
  targetProblemId?: string;
  request: string;
}

export type ReuseCheckResult =
  | { status: "REUSABLE"; changeSet: ResearchChangeSet }
  | { status: "NOT_REUSABLE"; reason: string };

/**
 * Decides whether the research-change-set.json at `outputPath` may be
 * trusted as a genuinely completed prior WU045 cycle for `identity`
 * (WU045-B01 independent-review remediation, finding 1). Never throws: any
 * problem reading, parsing, or structurally validating the file is reported
 * as NOT_REUSABLE so the caller falls through to a fresh AI-driven run
 * rather than crashing or reporting a false success. Exported for direct
 * CLI-level testing (a prior version of this logic was untested at the
 * cli.ts layer, which is exactly where the defect this remediates lived).
 */
export function tryReuseExistingChangeSet(outputPath: string, identity: ReuseIdentity): ReuseCheckResult {
  if (!existsSync(outputPath)) {
    return { status: "NOT_REUSABLE", reason: "no existing package at this cycle directory" };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(outputPath, "utf8"));
  } catch (error) {
    return { status: "NOT_REUSABLE", reason: `existing package is not valid JSON: ${(error as Error).message}` };
  }

  const validation = validateResearchChangeSet(raw);
  if (validation.errors.length > 0) {
    return { status: "NOT_REUSABLE", reason: `existing package failed structural validation: ${validation.errors.join("; ")}` };
  }
  const changeSet = asValidatedResearchChangeSet(raw);

  // Identity comparison runs only against a package that has already
  // proven itself internally consistent (schema-valid, fingerprint
  // recomputation matched) — never against raw, unvalidated JSON.
  if (
    changeSet.baseGitSha !== identity.baseGitSha ||
    changeSet.manifest.mode !== identity.mode ||
    changeSet.manifest.targetProblemId !== identity.targetProblemId ||
    changeSet.manifest.investigationQuestion !== identity.request
  ) {
    return { status: "NOT_REUSABLE", reason: "existing package does not match the current trigger/base identity" };
  }

  return { status: "REUSABLE", changeSet };
}

function buildReadyOutput(changeSet: ResearchChangeSet, outputPath: string, suffix?: string): string {
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

  const cycleDirFlag = flag("--cycle-dir");
  const baseGitSha = flag("--base-git-sha");
  const modeFlag = flag("--mode");
  const request = flag("--request");
  const targetProblemId = flag("--target-problem-id");

  if (!cycleDirFlag || !baseGitSha || !modeFlag || !request) {
    console.error(
      "Usage: node tools/research/orchestrate/cli.ts --cycle-dir <path> --base-git-sha <sha> " +
      "--mode daily-discovery|problem-refresh --request <text> [--target-problem-id <id>] [--dir <researchRoot>]"
    );
    process.exitCode = 1;
    return;
  }

  if (modeFlag !== "daily-discovery" && modeFlag !== "problem-refresh") {
    console.error(`FAILED [USAGE]: --mode must be "daily-discovery" or "problem-refresh", got ${JSON.stringify(modeFlag)}`);
    process.exitCode = 1;
    return;
  }
  if (modeFlag === "problem-refresh" && !targetProblemId) {
    console.error("FAILED [USAGE]: --target-problem-id is required when --mode is problem-refresh");
    process.exitCode = 1;
    return;
  }
  if (modeFlag === "daily-discovery" && targetProblemId) {
    console.error("FAILED [USAGE]: --target-problem-id must be absent when --mode is daily-discovery");
    process.exitCode = 1;
    return;
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
    process.exitCode = 1;
    return;
  }

  const aiConfig = loadLocalCommandAiInvokerConfigFromEnv();
  if (!aiConfig) {
    console.error(
      "FAILED [AI_RUNTIME_NOT_CONFIGURED]: RESEARCH_AI_COMMAND is not set. " +
      "WU045 requires an operator-configured local AI command/process for both the " +
      "PRIMARY_AUTHOR and INDEPENDENT_REVIEWER invocations (contract §3) and will not " +
      "silently fall back to pre-generated files. Set RESEARCH_AI_COMMAND (and optionally " +
      "RESEARCH_AI_ARGS / RESEARCH_AI_TIMEOUT_MS) and re-run."
    );
    process.exitCode = 1;
    return;
  }
  // A single configured executable may serve both roles (contract §3); each
  // invocation is still a brand-new child process with no shared session —
  // see ai-invoker.ts. Two separate AiInvoker instances are constructed so
  // that, even if a future configuration diverges the two roles' commands,
  // nothing here could accidentally reuse state between them.
  const primaryInvoker = new LocalCommandAiInvoker(aiConfig);
  const reviewerInvoker = new LocalCommandAiInvoker(aiConfig);

  const index: CorpusIndex = loadCorpusIndex(researchRoot);
  const { errors } = validateCorpusIndex(index);
  if (errors.length > 0) {
    console.error(
      `Cannot prepare a research change set: canonical research corpus fails validation (${errors.length} problem(s)). Run node tools/research/validation/cli.ts for details.`
    );
    process.exitCode = 1;
    return;
  }

  // WU048 case 20 idempotency: if this exact cycle directory already holds a
  // research-change-set.json that is DEMONSTRABLY a genuinely completed
  // prior WU045 cycle for this exact trigger, reuse it rather than
  // re-invoking AI (which is not byte-deterministic) and potentially
  // materializing a semantically duplicate package.
  //
  // WU045-B01 independent-review remediation, finding 1: a prior revision
  // of this check trusted any on-disk research-change-set.json that merely
  // had four matching top-level string fields, with no structural
  // validation — a corrupted, incomplete, or hand-fabricated file (e.g. one
  // with a schema-invalid independentReview.outcome, or missing candidates
  // entirely) was silently reported as READY_FOR_HUMAN_REVIEW. The file is
  // now parsed through the full ResearchChangeSet structural contract
  // (rcs-validator.ts), which recomputes and checks the package's own
  // deterministic content fingerprint (the same fingerprint contract
  // research-change-set.ts already defines — not a second, parallel
  // identity rule) before anything is trusted. A malformed/incomplete/
  // fabricated file fails closed and falls through to a fresh AI-driven run
  // rather than crashing or reporting a false success.
  const outputPath = join(cycleDir, "research-change-set.json");
  const reuse = tryReuseExistingChangeSet(outputPath, { baseGitSha, mode: trigger.mode, targetProblemId: trigger.targetProblemId, request: trigger.request });
  if (reuse.status === "REUSABLE") {
    console.log(buildReadyOutput(reuse.changeSet, outputPath, "(idempotent reuse of existing package)"));
    process.exitCode = 0;
    return;
  }

  const outcome = await runResearchCycle({
    trigger,
    index,
    baseGitSha,
    cycleDir,
    primaryInvoker,
    reviewerInvoker,
    // Real production Source availability (WU053 remediation): performs a
    // live post-freeze request against each material non-private Source's
    // own canonical_reference, using only Node built-ins. Never a fake
    // default `available` result — see http-availability-adapter.ts.
    resolveAvailabilityAdapter: (materialSources) => resolveAvailabilityAdapter(materialSources),
    // Local, workbench-only pre-Gate resolution for CLAIM_INFERENCE_LIMITS_PRESENT
    // only (WU053 remediation) — every other blocking finding remains
    // non-overridable; see inference-limit-resolution.ts.
    inferenceLimitResolutionChecker: createInferenceLimitResolutionChecker(cycleDir),
  });

  if (outcome.status === "FAILED") {
    console.error(`FAILED [${outcome.failedCheck}]: ${outcome.message}`);
    process.exitCode = 1;
    return;
  }
  if (outcome.status === "PRE_GATE_SAFETY_HOLD") {
    console.error(`PRE_GATE_SAFETY_HOLD: ${outcome.holdReportPath}`);
    process.exitCode = 1;
    return;
  }

  writeFileSync(outputPath, `${JSON.stringify(outcome.changeSet, null, 2)}\n`, "utf8");

  console.log(buildReadyOutput(outcome.changeSet, outputPath));
  process.exitCode = 0;
}

// Only auto-run when this file is executed directly (node tools/research/orchestrate/cli.ts),
// never when imported by a test — this lets cli-reuse.test.ts import
// tryReuseExistingChangeSet() without triggering a live CLI invocation as a
// side effect of the import itself.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error: unknown) => {
    console.error(`FAILED [UNCAUGHT]: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
