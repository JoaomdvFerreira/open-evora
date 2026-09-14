#!/usr/bin/env node
/**
 * Local/operator-triggered entry point for WU046 Human Gate & Post-Approval
 * Orchestration (docs/design/m013-launch-automation-contract.md §12).
 * Three subcommands, matching the three phases of §12's exact sequence:
 *
 *   render   — assembles + validates a Human Gate package from a WU045
 *              Research Change Set, writes the package JSON (source of
 *              truth) and its generated Markdown view into the same
 *              gitignored cycle directory, and prints the packageId +
 *              contentHash the owner must review against.
 *   decide   — submits a human decision against the package JSON currently
 *              on disk (HIGH-2 steps 7-12), persisting a decision record on
 *              success or reporting an explicit abort/rejection.
 *   promote  — runs the complete post-approval path (§12/F-J) for a cycle
 *              directory holding both a validated package and a valid,
 *              bound APPROVE decision, terminating at exactly
 *              READY_FOR_OWNER_MERGE or an explicit failure/private-hold.
 *
 * Usage:
 *   node --experimental-strip-types tools/research/gate/cli.ts render \
 *     --cycle-dir .research-workbench/<cycle-name> [--dir <researchRoot>]
 *
 *   node --experimental-strip-types tools/research/gate/cli.ts decide \
 *     --cycle-dir .research-workbench/<cycle-name> \
 *     --actor <name/handle> \
 *     --canonical-acceptance APPROVE|REJECT|HOLD_MORE_RESEARCH \
 *     --public-publication APPROVE|REJECT|HOLD
 *
 *   node --experimental-strip-types tools/research/gate/cli.ts promote \
 *     --cycle-dir .research-workbench/<cycle-name> \
 *     --base-branch main [--dir <researchRoot>] [--repo-root <repoRoot>]
 *
 * Exit code 0 = success for that subcommand's own terminal state
 * (READY_FOR_HUMAN_REVIEW / RECORDED / READY_FOR_OWNER_MERGE / PRIVATE_HOLD);
 * 1 = any failure, rejection, or abort (fail-closed) or usage error.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCorpusIndex } from "../core/corpus.ts";
import { validateCorpusIndex } from "../validation/validate.ts";
import { asValidatedResearchChangeSet, validateResearchChangeSet } from "../orchestrate/rcs-validator.ts";
import { buildHumanGatePackage } from "./package-builder.ts";
import { computeContentHash, shortFingerprint } from "./content-hash.ts";
import { renderHumanGateMarkdown } from "./markdown-view.ts";
import { submitHumanGateDecision } from "./decision.ts";
import { writeDecisionRecord } from "./decision-record.ts";
import { runPostApprovalPath } from "./promote.ts";
import type { CanonicalAcceptanceDecision, PublicExplorerPublicationDecision } from "./types.ts";

export const PACKAGE_FILENAME = "human-gate-package.json";
export const MARKDOWN_FILENAME = "human-gate-review.md";

function parseArgs(args: string[]): { command: string | undefined; flag: (name: string) => string | undefined } {
  const [command, ...rest] = args;
  const flag = (name: string): string | undefined => {
    const idx = rest.indexOf(name);
    return idx !== -1 ? rest[idx + 1] : undefined;
  };
  return { command, flag };
}

function runRender(flag: (name: string) => string | undefined): number {
  const cycleDirFlag = flag("--cycle-dir");
  if (!cycleDirFlag) {
    console.error("Usage: gate/cli.ts render --cycle-dir <path> [--dir <researchRoot>]");
    return 1;
  }
  const cycleDir = resolve(cycleDirFlag);
  const dirFlag = flag("--dir");
  const researchRoot = dirFlag ? resolve(dirFlag) : resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "research");

  const rcsPath = join(cycleDir, "research-change-set.json");
  if (!existsSync(rcsPath)) {
    console.error(`FAILED [RCS_NOT_FOUND]: no research-change-set.json at ${rcsPath}`);
    return 1;
  }

  let rawRcs: unknown;
  try {
    rawRcs = JSON.parse(readFileSync(rcsPath, "utf8"));
  } catch (error) {
    console.error(`FAILED [RCS_INVALID]: ${(error as Error).message}`);
    return 1;
  }
  const rcsValidation = validateResearchChangeSet(rawRcs);
  if (rcsValidation.errors.length > 0) {
    console.error(`FAILED [RCS_INVALID]: ${rcsValidation.errors.join("; ")}`);
    return 1;
  }
  const changeSet = asValidatedResearchChangeSet(rawRcs);

  const index = loadCorpusIndex(researchRoot);
  const { errors } = validateCorpusIndex(index);
  if (errors.length > 0) {
    console.error(`FAILED [CORPUS_INVALID]: canonical research corpus fails validation (${errors.length} problem(s))`);
    return 1;
  }

  const built = buildHumanGatePackage(index, changeSet);
  if (built.errors.length > 0 || !built.pkg) {
    console.error(`FAILED [PACKAGE_ASSEMBLY]: ${built.errors.join("; ")}`);
    return 1;
  }
  const pkg = built.pkg;

  const packagePath = join(cycleDir, PACKAGE_FILENAME);
  const markdownPath = join(cycleDir, MARKDOWN_FILENAME);
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderHumanGateMarkdown(pkg), "utf8");

  const contentHash = computeContentHash(pkg);
  console.log([
    "READY_FOR_HUMAN_REVIEW",
    `  packageId: ${pkg.packageId}`,
    `  baseGitSha: ${pkg.baseGitSha}`,
    `  contentHash: ${contentHash}`,
    `  shortFingerprint: ${shortFingerprint(contentHash)}`,
    `  package: ${packagePath}`,
    `  markdown: ${markdownPath}`,
  ].join("\n"));
  return 0;
}

const VALID_CANONICAL: readonly CanonicalAcceptanceDecision[] = ["APPROVE", "REJECT", "HOLD_MORE_RESEARCH"];
const VALID_PUBLICATION: readonly PublicExplorerPublicationDecision[] = ["APPROVE", "REJECT", "HOLD"];

function runDecide(flag: (name: string) => string | undefined): number {
  const cycleDirFlag = flag("--cycle-dir");
  const actor = flag("--actor");
  const canonicalAcceptance = flag("--canonical-acceptance");
  const publicPublication = flag("--public-publication");
  // The exact contentHash `render` printed and the owner reviewed against —
  // never recomputed from the current on-disk file here. Passing it
  // explicitly (rather than trusting whatever is on disk right now) is what
  // lets HIGH-2 step 10's comparison actually detect a mutation that
  // happened between render and decide, instead of trivially matching
  // against itself.
  const shownContentHash = flag("--content-hash");

  if (!cycleDirFlag || !actor || !canonicalAcceptance || !publicPublication || !shownContentHash) {
    console.error(
      "Usage: gate/cli.ts decide --cycle-dir <path> --actor <name> --content-hash <hash-from-render> " +
      "--canonical-acceptance APPROVE|REJECT|HOLD_MORE_RESEARCH --public-publication APPROVE|REJECT|HOLD"
    );
    return 1;
  }
  if (!VALID_CANONICAL.includes(canonicalAcceptance as CanonicalAcceptanceDecision)) {
    console.error(`FAILED [USAGE]: --canonical-acceptance must be one of ${VALID_CANONICAL.join(", ")}`);
    return 1;
  }
  if (!VALID_PUBLICATION.includes(publicPublication as PublicExplorerPublicationDecision)) {
    console.error(`FAILED [USAGE]: --public-publication must be one of ${VALID_PUBLICATION.join(", ")}`);
    return 1;
  }

  const cycleDir = resolve(cycleDirFlag);
  const packagePath = join(cycleDir, PACKAGE_FILENAME);
  if (!existsSync(packagePath)) {
    console.error(`FAILED [PACKAGE_NOT_FOUND]: no ${PACKAGE_FILENAME} at ${cycleDir}; run render first`);
    return 1;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(packagePath, "utf8"));
  } catch (error) {
    console.error(`FAILED [PACKAGE_INVALID]: ${(error as Error).message}`);
    return 1;
  }
  const pkgForIdentity = raw as { packageId?: string; baseGitSha?: string };
  if (typeof pkgForIdentity.packageId !== "string" || typeof pkgForIdentity.baseGitSha !== "string") {
    console.error("FAILED [PACKAGE_INVALID]: package.json missing packageId/baseGitSha");
    return 1;
  }

  const outcome = submitHumanGateDecision(packagePath, {
    packageId: pkgForIdentity.packageId,
    contentHash: shownContentHash,
    baseGitSha: pkgForIdentity.baseGitSha,
    actor,
    canonicalAcceptance: canonicalAcceptance as CanonicalAcceptanceDecision,
    publicExplorerPublication: publicPublication as PublicExplorerPublicationDecision,
  });

  if (outcome.status !== "RECORDED") {
    console.error(`FAILED [${outcome.status}]: ${outcome.message}`);
    return 1;
  }

  const recordPath = writeDecisionRecord(cycleDir, outcome.record);
  console.log([
    "RECORDED",
    `  packageId: ${outcome.record.packageId}`,
    `  canonicalAcceptance: ${outcome.record.canonicalAcceptance}`,
    `  publicExplorerPublication: ${outcome.record.publicExplorerPublication}`,
    `  record: ${recordPath}`,
  ].join("\n"));
  return 0;
}

function runPromote(flag: (name: string) => string | undefined): number {
  const cycleDirFlag = flag("--cycle-dir");
  const baseBranch = flag("--base-branch") ?? "main";
  if (!cycleDirFlag) {
    console.error("Usage: gate/cli.ts promote --cycle-dir <path> [--base-branch main] [--dir <researchRoot>] [--repo-root <repoRoot>]");
    return 1;
  }
  const cycleDir = resolve(cycleDirFlag);
  const repoRootFlag = flag("--repo-root");
  const repoRoot = repoRootFlag ? resolve(repoRootFlag) : resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
  const dirFlag = flag("--dir");
  const researchRoot = dirFlag ? resolve(dirFlag) : join(repoRoot, "research");

  const outcome = runPostApprovalPath({
    repoRoot,
    researchRoot,
    cycleDir,
    packagePath: join(cycleDir, PACKAGE_FILENAME),
    baseBranch,
  });

  if (outcome.status === "FAILED") {
    console.error(`FAILED [${outcome.failedStage}]: ${outcome.message}`);
    return 1;
  }
  if (outcome.status === "PRIVATE_HOLD") {
    console.log(`PRIVATE_HOLD: ${outcome.message}`);
    return 0;
  }
  console.log([
    "READY_FOR_OWNER_MERGE",
    `  branch: ${outcome.branch}`,
    `  commitSha: ${outcome.commitSha}`,
    `  prUrl: ${outcome.prUrl}`,
    "  NOTE: this PR has not been merged. Owner review and merge remain required.",
  ].join("\n"));
  return 0;
}

function main(): void {
  const { command, flag } = parseArgs(process.argv.slice(2));
  let exitCode: number;
  switch (command) {
    case "render":
      exitCode = runRender(flag);
      break;
    case "decide":
      exitCode = runDecide(flag);
      break;
    case "promote":
      exitCode = runPromote(flag);
      break;
    default:
      console.error("Usage: gate/cli.ts <render|decide|promote> [options]");
      exitCode = 1;
  }
  process.exitCode = exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
