/**
 * Deterministic frozen-cycle base revalidation (bounded operator/reusable
 * path; AGENTS.md governance applies — this module owns no methodology of
 * its own, it only sequences already-existing deterministic primitives).
 *
 * Problem this solves: the normal orchestration path (cli.ts/run-cycle.ts)
 * requires exact `baseGitSha` identity to reuse a prior cycle's package and
 * otherwise falls through to a fresh AI-driven cycle, which would invoke
 * PRIMARY_AUTHOR again. When Git has moved to a new base but canonical
 * `research/**` content did not drift, re-authoring is neither necessary nor
 * desirable — the already-reviewed, frozen candidate set can instead be
 * re-verified against the newer base using the exact same deterministic
 * integration/readiness/admission/review machinery the normal path already
 * uses, with PRIMARY_AUTHOR structurally unreachable.
 *
 * This module never re-implements any of that machinery: it reloads a prior
 * cycle's frozen manifest/candidates exactly as run-cycle.ts's own
 * resumePreGateHold() does, verifies the two conditions specific to a base
 * change (old base is an ancestor of the new base; no `research/**` drift
 * between them), and then hands off to run-cycle.ts's
 * continueFromFrozenCandidates() — the same shared continuation
 * resumePreGateHold() and the normal AI-driven path both already use. There
 * is no second, parallel implementation of prospective validation,
 * availability revalidation, safety admission, or reviewer/RCS assembly.
 *
 * Per-requirement mapping (docs/design/m013-launch-automation-contract.md
 * §11 fail-closed convention; this module's own task spec):
 *   1. Source cycle immutable       -> only ever read, never written, here.
 *   2. Target is a new gitignored
 *      workbench cycle              -> assertWorkbenchBoundary() + distinct
 *                                       target/source directory check.
 *   3. Source RCS structurally
 *      valid                        -> validateResearchChangeSet() (the
 *                                       exact fingerprint-recomputing check
 *                                       cli.ts's idempotent-reuse path uses).
 *   4. Reload exact source
 *      manifest + candidates        -> validateManifest()/loadCandidates(),
 *                                       same as resumePreGateHold().
 *   5. Recompute + verify frozen
 *      candidate set before reuse   -> candidateSetsEquivalent() (order-
 *                                       insensitive, content-exact candidate-
 *                                       multiset comparison local to this
 *                                       module) compared against the source
 *                                       RCS's own candidates (the RCS's own
 *                                       preparationFingerprint already
 *                                       proved internal consistency in step
 *                                       3; this step additionally proves the
 *                                       on-disk manifest/candidates being
 *                                       reloaded are the same content the
 *                                       RCS itself carries — independent of
 *                                       manifest-order vs. RCS-deterministic-
 *                                       order, which are two legitimate
 *                                       orderings of the same set, not drift).
 *                                       frozenCandidateFingerprint() itself
 *                                       remains order-sensitive and is still
 *                                       used, unchanged, for HOLD/resume
 *                                       identity further below.
 *   6. Old base ancestor of
 *      new base                     -> git merge-base --is-ancestor.
 *   7. research/** diff empty       -> git diff --name-only <old>..<new> --
 *                                       research/; fail closed with an
 *                                       explicit reason otherwise.
 *   8. Re-evaluate frozen candidates
 *      against canonical corpus at
 *      NEW base                    -> continueFromFrozenCandidates() is
 *                                       called with the NEW base and a
 *                                       CorpusIndex the caller loaded at the
 *                                       NEW base (this module performs no
 *                                       checkout itself — see revalidate-cli.ts).
 *   9. Fresh Source availability    -> continueFromFrozenCandidates()'s own
 *                                       resolveAvailabilityAdapter() call,
 *                                       unchanged, always live/never cached.
 *   10. Inference-limit resolution
 *       not reused across bases     -> a NEW cycleDir means
 *                                       createInferenceLimitResolutionChecker(cycleDir)
 *                                       (base-SHA-bound fingerprint, keyed to
 *                                       the target cycle directory) can never
 *                                       resolve to the source cycle's
 *                                       resolutions/ records — see
 *                                       revalidate-cli.ts, which never points
 *                                       the checker at the source cycle.
 *   11. Fresh frozen HOLD if
 *       CLAIM_INFERENCE_LIMITS_PRESENT
 *       remains, resumable through
 *       a supported operator path   -> continueFromFrozenCandidates() writes
 *                                       pre-gate-safety-hold.json into the
 *                                       target cycle directory (same as
 *                                       runResearchCycle()); this module
 *                                       additionally writes run-cycle.ts's own
 *                                       hold-freeze.json binding record there
 *                                       via writeHoldFreeze(), keyed to a
 *                                       BaseRevalidationHoldIdentity
 *                                       (sourceCycleDir + oldBaseGitSha) —
 *                                       the SAME shape/writer the normal path
 *                                       uses, not a second incompatible
 *                                       protocol. hold-cli.ts's `resume`
 *                                       action (resumeRevalidationHold())
 *                                       resumes it exactly like a normal-path
 *                                       HOLD: exact-bound to the frozen
 *                                       candidates, resumable without
 *                                       PRIMARY_AUTHOR, fresh availability
 *                                       rechecked, fresh INDEPENDENT_REVIEWER
 *                                       only after ELIGIBLE (PR #127
 *                                       remediation, finding 1).
 *   12. Fresh INDEPENDENT_REVIEWER
 *       only after ELIGIBLE         -> continueFromFrozenCandidates()'s own
 *                                       control flow, unchanged.
 *   13. PRIMARY_AUTHOR unreachable  -> this module never imports ai-invoker's
 *                                       PRIMARY_AUTHOR role, never imports
 *                                       primary-prompt.ts/authoring-envelope.ts,
 *                                       and calls continueFromFrozenCandidates()
 *                                       directly rather than runResearchCycle().
 *   14. No canonical write          -> continueFromFrozenCandidates() never
 *                                       calls applyCanonicalIntegrationPlan();
 *                                       neither does this module.
 *   15. No reuse of old Human Gate
 *       package/decision            -> this module never reads
 *                                       human-gate-package.json/human-gate-
 *                                       decision.json from the source cycle,
 *                                       and continueFromFrozenCandidates()
 *                                       always assembles a fresh RCS (new
 *                                       packageId/preparationFingerprint,
 *                                       since baseGitSha differs).
 *   16. Old base bound to source
 *       RCS (PR #127 remediation,
 *       finding 2)                  -> loadAndVerifyFrozenSource() requires
 *                                       sourceRcs.baseGitSha === oldBaseGitSha
 *                                       exactly; a caller cannot assert an
 *                                       oldBaseGitSha the source cycle's own
 *                                       frozen RCS does not corroborate.
 *   17. Clean working tree before
 *       loading new-base corpus
 *       (PR #127 remediation,
 *       finding 3)                  -> enforced by the caller
 *                                       (revalidate-cli.ts), which reuses the
 *                                       existing precheckRepositoryState()
 *                                       repository-state helper before
 *                                       loading the canonical corpus.
 *   18. Target must be genuinely
 *       new/empty (PR #127
 *       remediation, finding 4)     -> the target-not-new check rejects any
 *                                       existing directory entry at all, not
 *                                       only manifest.json/research-change-
 *                                       set.json.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import type { CorpusIndex } from "../core/types.ts";
import type { AiInvoker } from "./ai-invoker.ts";
import { asValidatedManifest, validateManifest } from "./manifest.ts";
import { asValidatedResearchChangeSet, validateResearchChangeSet } from "./rcs-validator.ts";
import { loadCandidates } from "./candidate-loader.ts";
import { continueFromFrozenCandidates, frozenCandidateFingerprint, writeHoldFreeze } from "./run-cycle.ts";
import { sha256Hex } from "./fingerprint.ts";
import type { PreparationOutcome } from "./types.ts";
import { assertWorkbenchBoundary } from "./workbench-boundary.ts";
import type { InferenceLimitResolutionChecker, SourceAvailabilityAdapter } from "../admission/safety-admission.ts";
import type { CandidateRecord } from "../integration/candidate-delta.ts";

const defaultRepoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");

const FULL_GIT_SHA = /^[0-9a-fA-F]{40}$/;

function failed(failedCheck: string, message: string): PreparationOutcome {
  return { status: "FAILED", failedCheck, message };
}

/**
 * Runs `git` against `repoRoot` and returns trimmed stdout, or throws with a
 * bounded, non-secret message on any non-zero exit. Mirrors the existing
 * execFileSync convention (workbench-boundary.ts) rather than introducing a
 * second git-invocation style. `repoRoot` defaults to this repository's own
 * root but is overridable so verifyOldBaseIsAncestor()/verifyNoResearchDrift()
 * are independently testable against a synthetic Git repository.
 */
function git(args: readonly string[], repoRoot: string = defaultRepoRoot): string {
  return execFileSync("git", args as string[], { cwd: repoRoot, encoding: "utf8" }).trim();
}

/**
 * Requirement 6: verifies `oldBaseGitSha` is an ancestor of (or equal to)
 * `newBaseGitSha` using `git merge-base --is-ancestor`, which exits 0 for
 * ancestor-or-equal and 1 otherwise (never throws for a clean "not an
 * ancestor" result — only for git invocation failure, e.g. an unknown SHA).
 */
export function verifyOldBaseIsAncestor(oldBaseGitSha: string, newBaseGitSha: string, repoRoot: string = defaultRepoRoot): { ok: true } | { ok: false; reason: string } {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", oldBaseGitSha, newBaseGitSha], { cwd: repoRoot, encoding: "utf8" });
    return { ok: true };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { status?: number };
    if (typeof err.status === "number") {
      return { ok: false, reason: `old base ${oldBaseGitSha} is not an ancestor of new base ${newBaseGitSha}` };
    }
    return { ok: false, reason: `could not verify Git ancestry: ${err.message}` };
  }
}

/**
 * Requirement 7: verifies canonical `research/**` did not change between the
 * two bases via `git diff --name-only <old>..<new> -- research/`. An empty
 * result means no canonical research drift. Never throws for a clean empty
 * result; throws only if the diff itself cannot be computed (e.g. an unknown
 * SHA), which the caller reports as a FAILED outcome, never a silent pass.
 */
export function verifyNoResearchDrift(oldBaseGitSha: string, newBaseGitSha: string, repoRoot: string = defaultRepoRoot): { drifted: false } | { drifted: true; files: string[] } {
  const output = git(["diff", "--name-only", `${oldBaseGitSha}..${newBaseGitSha}`, "--", "research/"], repoRoot);
  const files = output === "" ? [] : output.split("\n").filter((line) => line.trim() !== "");
  return files.length === 0 ? { drifted: false } : { drifted: true, files };
}

export interface RevalidateFrozenCycleInput {
  /** Immutable prior cycle directory whose frozen manifest/candidates/RCS are being revalidated. Read-only. */
  sourceCycleDir: string;
  /** New, must-not-already-contain-artifacts, gitignored workbench cycle directory this run writes to. */
  targetCycleDir: string;
  oldBaseGitSha: string;
  newBaseGitSha: string;
  /** CorpusIndex already loaded from the canonical corpus AT `newBaseGitSha` (this module never checks out Git state itself). */
  index: CorpusIndex;
  /** A brand-new invocation target for INDEPENDENT_REVIEWER only — this module never invokes or references a PRIMARY_AUTHOR role. */
  reviewerInvoker: AiInvoker;
  availabilityAdapter?: SourceAvailabilityAdapter;
  resolveAvailabilityAdapter?: (materialSources: ReadonlyMap<string, Record<string, unknown>>) => Promise<SourceAvailabilityAdapter>;
  /**
   * Must be created against `targetCycleDir` (never `sourceCycleDir`) by the
   * caller — see requirement 10. Absent = always blocking (fail closed),
   * matching every other caller of continueFromFrozenCandidates().
   */
  inferenceLimitResolutionChecker?: InferenceLimitResolutionChecker;
  now?: () => Date;
  /** Overridable for tests only; defaults to this repository's own root. */
  repoRoot?: string;
}

/**
 * Requirement 3+4+5: loads and structurally verifies the source cycle's
 * frozen Research Change Set, then reloads its exact manifest/candidates
 * from disk and confirms the reload reproduces the same frozen content the
 * RCS itself carries. Never throws: every problem is reported so the caller
 * fails closed with an explicit reason.
 *
 * PR #127 remediation (finding 2): also binds the caller-supplied
 * `oldBaseGitSha` to the source RCS's own `baseGitSha` — the caller has no
 * independent authority to assert what base a frozen cycle was produced
 * against; that fact is owned exclusively by the source cycle's own frozen,
 * fingerprint-verified `research-change-set.json`. A caller-supplied
 * `oldBaseGitSha` that does not match fails closed here, before ancestry or
 * drift is ever checked (so a caller cannot launder a false "old base"
 * through a genuinely-ancestor-of-new-base SHA that the source cycle itself
 * was never actually frozen against).
 */
function loadAndVerifyFrozenSource(sourceCycleDir: string, oldBaseGitSha: string): { ok: true; manifest: ReturnType<typeof asValidatedManifest>; candidates: ReturnType<typeof loadCandidates>["candidates"] } | { ok: false; reason: string } {
  const rcsPath = `${sourceCycleDir}/research-change-set.json`;
  if (!existsSync(rcsPath)) {
    return { ok: false, reason: `no research-change-set.json at source cycle directory ${sourceCycleDir}` };
  }
  let rawRcs: unknown;
  try {
    rawRcs = JSON.parse(readFileSync(rcsPath, "utf8"));
  } catch (error) {
    return { ok: false, reason: `source research-change-set.json is not valid JSON: ${(error as Error).message}` };
  }
  const rcsValidation = validateResearchChangeSet(rawRcs);
  if (rcsValidation.errors.length > 0) {
    return { ok: false, reason: `source Research Change Set failed structural validation: ${rcsValidation.errors.join("; ")}` };
  }
  const sourceRcs = asValidatedResearchChangeSet(rawRcs);

  if (sourceRcs.baseGitSha !== oldBaseGitSha) {
    return {
      ok: false,
      reason: `--old-base-git-sha (${oldBaseGitSha}) does not match the source cycle's own frozen baseGitSha (${sourceRcs.baseGitSha}); ` +
        "the old base must be derived from the validated source Research Change Set, not asserted by the caller",
    };
  }

  const manifestPath = `${sourceCycleDir}/manifest.json`;
  if (!existsSync(manifestPath)) {
    return { ok: false, reason: `no manifest.json at source cycle directory ${sourceCycleDir}` };
  }
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return { ok: false, reason: `source manifest.json is not valid JSON: ${(error as Error).message}` };
  }
  const manifestValidation = validateManifest(rawManifest);
  if (manifestValidation.errors.length > 0) {
    return { ok: false, reason: `source manifest.json failed structural validation: ${manifestValidation.errors.join("; ")}` };
  }
  const manifest = asValidatedManifest(rawManifest);

  // The reloaded on-disk manifest.json must itself equal the manifest
  // already embedded (and fingerprint-verified) inside the source RCS —
  // otherwise a tampered/replaced manifest.json could silently substitute a
  // different investigationQuestion/rationale/claimedRecordIds for the ones
  // the RCS's own preparationFingerprint actually covers. This is checked
  // via the same canonical fingerprint convention as every other freeze
  // check in this module, never a field-by-field ad hoc comparison.
  if (frozenCandidateFingerprint(manifest, []) !== frozenCandidateFingerprint(sourceRcs.manifest, [])) {
    return { ok: false, reason: "source manifest.json does not match the manifest embedded in the source research-change-set.json (tampered, replaced, or otherwise drifted since freeze)" };
  }

  return { ok: true, manifest, candidates: sourceRcs.candidates };
}

/**
 * Order-insensitive, content-exact candidate-multiset fingerprint, local to
 * this module's SOURCE FILES <-> SOURCE RCS integrity check only.
 *
 * frozenCandidateFingerprint() (run-cycle.ts) stays order-sensitive by
 * design — it is the HOLD/resume binding identity and must not change here.
 * But the two arrays this module compares for source-integrity purposes
 * represent the exact same candidate SET under two independently legitimate
 * orderings: loadCandidates() returns manifest.candidateFiles order, while a
 * frozen RCS stores CanonicalIntegrationReview candidate order (deterministic
 * recordFamily/id delta order). Comparing those two orderings with the
 * order-sensitive fingerprint made source-integrity verification incorrectly
 * order-sensitive and produced a false-positive SOURCE_CANDIDATE_DRIFT.
 *
 * Each CandidateRecord is fingerprinted individually with the project's one
 * canonical-serialization/SHA-256 convention (fingerprint.ts — the same
 * convention frozenCandidateFingerprint() itself uses), then the per-record
 * fingerprints are sorted before comparison. This preserves multiplicity
 * (a duplicate replacing a distinct record still changes the multiset) while
 * making the comparison independent of array order.
 */
function candidateMultisetFingerprints(candidates: readonly CandidateRecord[]): string[] {
  return candidates.map((candidate) => sha256Hex(candidate)).sort();
}

/**
 * True iff both candidate arrays represent the exact same multiset of
 * records, regardless of order. Exported for direct unit-level regression
 * coverage in addition to the full-flow integration tests.
 */
export function candidateSetsEquivalent(left: readonly CandidateRecord[], right: readonly CandidateRecord[]): boolean {
  const leftFingerprints = candidateMultisetFingerprints(left);
  const rightFingerprints = candidateMultisetFingerprints(right);
  return leftFingerprints.length === rightFingerprints.length && leftFingerprints.every((fingerprint, index) => fingerprint === rightFingerprints[index]);
}

/**
 * PR #127 remediation (finding 1): copies the source cycle's already-frozen,
 * already fingerprint-verified manifest.json and candidate YAML files
 * byte-for-byte into `targetCycleDir` — a plain filesystem copy of content
 * this module has already proven (loadAndVerifyFrozenSource()) reproduces
 * the exact frozen fingerprint the source RCS carries, never new authoring
 * and never a re-derivation of content from the corpus. This is only ever
 * called when the outcome is a fresh PRE_GATE_SAFETY_HOLD at the new base:
 * resumeHoldByIdentity() (run-cycle.ts) reloads manifest/candidates from
 * `cycleDir` exactly like a normal-path resume does, so a revalidation HOLD
 * needs the same on-disk shape a normal-path HOLD already has in order to be
 * resumable through the same shared mechanism.
 */
function materializeFrozenSourceIntoTarget(sourceCycleDir: string, targetCycleDir: string, manifest: ReturnType<typeof asValidatedManifest>): void {
  writeFileSync(join(targetCycleDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const targetCandidatesDir = join(targetCycleDir, "candidates");
  for (const file of manifest.candidateFiles) {
    const from = join(sourceCycleDir, "candidates", file);
    const to = join(targetCandidatesDir, file);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
}

/**
 * Runs the complete bounded frozen-cycle base revalidation sequence:
 * immutably reload a prior cycle's frozen manifest/candidates, verify the
 * base transition is safe (ancestry + zero `research/**` drift), and hand
 * off to the exact same deterministic continuation the normal path and the
 * pre-Gate HOLD resume path already use — never re-authoring, never
 * invoking PRIMARY_AUTHOR, never writing canonical research, never touching
 * the source cycle directory.
 */
export async function revalidateFrozenCycleAtNewBase(input: RevalidateFrozenCycleInput): Promise<PreparationOutcome> {
  if (!FULL_GIT_SHA.test(input.oldBaseGitSha)) {
    return failed("USAGE", `old base Git SHA must be a full 40-character hexadecimal SHA, got ${JSON.stringify(input.oldBaseGitSha)}`);
  }
  if (!FULL_GIT_SHA.test(input.newBaseGitSha)) {
    return failed("USAGE", `new base Git SHA must be a full 40-character hexadecimal SHA, got ${JSON.stringify(input.newBaseGitSha)}`);
  }

  // Requirement 2 (target is a new workbench cycle): the target must be a
  // gitignored workbench location, distinct from the source, and must not
  // already hold cycle artifacts — this path never resumes or overwrites an
  // existing target cycle; a fresh target is required every time.
  try {
    assertWorkbenchBoundary(input.targetCycleDir);
  } catch (error) {
    return failed("WORKBENCH_BOUNDARY", (error as Error).message);
  }
  if (resolve(input.targetCycleDir) === resolve(input.sourceCycleDir)) {
    return failed("TARGET_NOT_DISTINCT", "target cycle directory must be different from the immutable source cycle directory");
  }
  // PR #127 remediation (finding 4): the target must be genuinely new/empty
  // — any pre-existing entry at all (not only manifest.json/research-change-
  // set.json) is refused, including a stray resolutions/ directory,
  // hold-freeze.json, independent-review.json, or any other artifact a prior
  // (possibly unrelated) run may have left behind.
  if (existsSync(input.targetCycleDir)) {
    const entries = readdirSync(input.targetCycleDir);
    if (entries.length > 0) {
      return failed(
        "TARGET_NOT_NEW",
        `target cycle directory ${input.targetCycleDir} already contains entries (${entries.join(", ")}); this path requires a new, empty target`
      );
    }
  }

  // Requirements 3-5: source Research Change Set is structurally valid, its
  // exact frozen manifest/candidates reload cleanly, and the reload
  // reproduces the same frozen content the RCS itself carries. Requirement
  // 16 (PR #127 remediation, finding 2): the caller-supplied oldBaseGitSha
  // is bound to the source RCS's own baseGitSha here.
  const source = loadAndVerifyFrozenSource(input.sourceCycleDir, input.oldBaseGitSha);
  if (!source.ok) {
    return failed("SOURCE_CYCLE_INVALID", source.reason);
  }

  // Requirement 5 continued: confirm the source RCS's own candidates were
  // built from exactly the same candidate SET the reloaded on-disk
  // manifest/candidates produce (never a second-guessed, edited, or replaced
  // set). This comparison is deliberately order-insensitive but
  // content-exact (candidateSetsEquivalent()): loadCandidates() returns
  // manifest.candidateFiles order, while the frozen RCS stores
  // CanonicalIntegrationReview candidate order (deterministic
  // recordFamily/id delta order) — two independently legitimate orderings of
  // the same set, not a sign of drift. Using the order-sensitive
  // frozenCandidateFingerprint() for this particular comparison produced a
  // false-positive SOURCE_CANDIDATE_DRIFT whenever those two legitimate
  // orderings differed; frozenCandidateFingerprint() itself is unchanged and
  // still order-sensitive for HOLD/resume identity below.
  const candidatesDir = `${input.sourceCycleDir}/candidates`;
  const loadResult = loadCandidates(input.index, candidatesDir, source.manifest.candidateFiles);
  if (loadResult.failures.length > 0) {
    return failed(
      "SOURCE_CANDIDATE_LOAD",
      loadResult.failures.map((failure) => `${failure.file}: ${failure.message}`).join("; ")
    );
  }
  if (!candidateSetsEquivalent(loadResult.candidates, source.candidates)) {
    return failed(
      "SOURCE_CANDIDATE_DRIFT",
      "the source cycle's on-disk manifest/candidates no longer match the frozen content its own research-change-set.json carries " +
      "(edited, replaced, or otherwise drifted since the source cycle was frozen)"
    );
  }
  // Continue computing the existing order-sensitive frozen fingerprint (over
  // the reloaded manifest/candidates, in manifest.candidateFiles order) for
  // any new HOLD binding below — this is the exact same identity a normal
  // HOLD/resume already uses and is untouched by the equivalence check above.
  const reloadedFingerprint = frozenCandidateFingerprint(source.manifest, loadResult.candidates);

  // Requirement 6: old base must be an ancestor of (or equal to) new base.
  const ancestry = verifyOldBaseIsAncestor(input.oldBaseGitSha, input.newBaseGitSha, input.repoRoot ?? defaultRepoRoot);
  if (!ancestry.ok) {
    return failed("BASE_NOT_ANCESTOR", ancestry.reason);
  }

  // Requirement 7: canonical research/** must not have drifted between the
  // two bases. Any drift fails closed before any reviewer invocation or
  // canonical write is reachable — a fresh research cycle is required.
  let researchDrift: ReturnType<typeof verifyNoResearchDrift>;
  try {
    researchDrift = verifyNoResearchDrift(input.oldBaseGitSha, input.newBaseGitSha, input.repoRoot ?? defaultRepoRoot);
  } catch (error) {
    return failed("RESEARCH_DRIFT_CHECK_FAILED", `could not verify canonical research drift: ${(error as Error).message}`);
  }
  if (researchDrift.drifted) {
    return failed(
      "CANONICAL_RESEARCH_DRIFTED",
      `canonical research/** changed between ${input.oldBaseGitSha} and ${input.newBaseGitSha} (${researchDrift.files.join(", ")}); ` +
      "the frozen candidate set cannot be revalidated against a drifted corpus — a fresh research cycle is required."
    );
  }

  // The target cycle directory itself is never created by this module until
  // this exact point (the target-not-new check above intentionally ran
  // against a directory that may not exist yet). Unlike the normal
  // AI-driven path, this path never materializes candidate files into the
  // target — continueFromFrozenCandidates() writes only its own downstream
  // artifacts (independent-review.json, hold-freeze.json, etc.), which
  // requires the directory to already exist.
  mkdirSync(input.targetCycleDir, { recursive: true });

  // Requirements 8-13: re-evaluate the exact frozen candidates against the
  // canonical corpus at the NEW base, using the same deterministic
  // continuation the normal path and pre-Gate HOLD resume already use.
  // `input.index` must already reflect the NEW base (the caller's
  // responsibility — see revalidate-cli.ts); this module performs no Git
  // checkout of its own. PRIMARY_AUTHOR is never referenced anywhere in this
  // module or in continueFromFrozenCandidates() itself.
  const outcome = await continueFromFrozenCandidates(
    input.targetCycleDir,
    input.newBaseGitSha,
    input.index,
    source.manifest,
    loadResult.candidates,
    input.reviewerInvoker,
    input.availabilityAdapter,
    input.resolveAvailabilityAdapter,
    input.inferenceLimitResolutionChecker,
    input.now
  );

  // Requirement 11 (PR #127 remediation, finding 1): a fresh frozen HOLD is
  // written in the TARGET cycle (never the immutable source cycle) whenever
  // CLAIM_INFERENCE_LIMITS_PRESENT — or any other blocking finding — remains
  // at the new base. The frozen manifest/candidates are also copied
  // byte-for-byte into the target (materializeFrozenSourceIntoTarget() —
  // never re-authored, and only ever reached here, on a genuine HOLD; a
  // successful READY_FOR_HUMAN_REVIEW outcome never materializes these
  // files, since its research-change-set.json already carries everything).
  // This reuses run-cycle.ts's own writeHoldFreeze()/HoldFreezeRecord shape
  // (identity.kind = "BASE_REVALIDATION"), the exact same on-disk shape a
  // normal-path HOLD uses, so hold-cli.ts's `resume-revalidation` action
  // (backed by resumeRevalidationHold()) can reload and resume this HOLD
  // through the same supported operator path — never a second, incompatible
  // freeze protocol.
  if (outcome.status === "PRE_GATE_SAFETY_HOLD") {
    materializeFrozenSourceIntoTarget(input.sourceCycleDir, input.targetCycleDir, source.manifest);
    writeHoldFreeze(input.targetCycleDir, {
      schemaVersion: "1",
      baseGitSha: input.newBaseGitSha,
      identity: { kind: "BASE_REVALIDATION", sourceCycleDir: input.sourceCycleDir, oldBaseGitSha: input.oldBaseGitSha },
      candidateFingerprint: reloadedFingerprint,
    });
  }

  return outcome;
}
