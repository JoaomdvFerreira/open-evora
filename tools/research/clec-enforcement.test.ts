/**
 * End-to-end regression for the Citizen Language & Evidence Contract
 * enforcement chain (docs/investigationstrategy.md §12) as one system, across
 * both research lanes:
 *
 *   Lane A: candidate -> deterministic signals -> context-free precheck ->
 *   independent semantic review -> Research Change Set -> Human Gate package
 *   -> hash-bound human decision -> post-approval promotion -> Git/PR ->
 *   READY_FOR_OWNER_MERGE.
 *
 *   Lane B: Git-derived canonical change -> deterministic signals ->
 *   context-free precheck -> independent semantic review -> receipt ->
 *   pull-request receipt check.
 *
 * Every step runs the real production orchestration, Gate and Lane B code
 * against temporary Git repositories shaped like the real research tree and
 * validated by its real schemas. Only true external boundaries are replaced:
 * the AI invocations (recording stubs), GitHub (the fake `gh` from
 * gate/test-fixtures.ts), Source availability (no network), and the two
 * expensive post-promotion build commands (promote.ts's test-only hook).
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { gitFixture, loadIndexFor, remoteGitFixture, sourceYaml, type GitFixture, type RemoteGitFixture } from "./gate/test-fixtures.ts";
import { MARKDOWN_FILENAME, PACKAGE_FILENAME } from "./gate/cli.ts";
import { computeContentHash } from "./gate/content-hash.ts";
import { DECISION_RECORD_FILENAME, writeDecisionRecord } from "./gate/decision-record.ts";
import { reviewerInputFromGatePackage, validateHumanGatePackage } from "./gate/package-validator.ts";
import { stringifyRecordYaml } from "./core/yaml.ts";
import { sha256Hex } from "./orchestrate/fingerprint.ts";
import { runPostApprovalPath } from "./gate/promote.ts";
import type { HumanGatePackage } from "./gate/types.ts";
import { ADVISORY, CONTEXT_FREE_BLOCK, contextFreeBlockers, SIGNAL_CODE } from "./language/signals.ts";
import { buildLaneBReceipt, prepareLaneBReview, renderReceiptBlock } from "./lane-b/receipt.ts";
import { pullRequestBase, resolveCommit, resolveLaneBReviewUnit, type LaneBReviewUnit } from "./lane-b/review-unit.ts";
import type { AiInvocationRequest, AiInvocationResult, AiInvoker } from "./orchestrate/ai-invoker.ts";
import { validateIndependentReview } from "./orchestrate/independent-review.ts";
import { serializeReviewerInput, type ReviewerInputPackage } from "./orchestrate/reviewer-input.ts";
import { runResearchCycle } from "./orchestrate/run-cycle.ts";
import type { IndependentReviewResult, ResearchTrigger } from "./orchestrate/types.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const GATE_CLI = fileURLToPath(new URL("./gate/cli.ts", import.meta.url));
const LANE_B_CLI = fileURLToPath(new URL("./lane-b/cli.ts", import.meta.url));

// ---------------------------------------------------------------------------
// One EVD record, valid under the real schemas, citing the fixture's SRC-BASE.
// Its observation carries an ordinary advisory quantity signal ("muitas");
// the blocked variant also embeds a PRB ID in its own inference limits.

const EVD_ID = "EVD-E2E";
const EVD_FILE = `${EVD_ID}.yaml`;
const EVD_REPO_PATH = `research/evidence/${EVD_FILE}`;
const ADVISORY_SUMMARY = "A fonte regista muitas reclamações sobre a recolha de resíduos em 2026.";

function evidenceYaml(summary: string, inferenceLimit: string): string {
  return [
    `evidence_id: ${EVD_ID}`,
    "provenance:",
    "  sources:",
    "    - SRC-BASE",
    "  extracted_at: 2026-08-27",
    "observation:",
    `  summary: ${summary}`,
    "scope:",
    "  geography:",
    "    level: municipality",
    "    area: Évora",
    "  temporal:",
    '    as_of: "2026"',
    "domains:",
    "  - MOB",
    "evidence_nature: fact",
    "claim_authority: authoritative",
    "inference_limits:",
    `  - ${inferenceLimit}`,
    "",
  ].join("\n");
}

const ADVISORY_EVD = evidenceYaml(ADVISORY_SUMMARY, "A contagem de reclamações não mede a frequência dos atrasos.");
const BLOCKED_EVD = evidenceYaml(ADVISORY_SUMMARY, "A contagem de reclamações não se refere a PRB-0001.");

// ---------------------------------------------------------------------------
// AI boundary: recording stubs. The reviewer reads only the frozen reviewer
// package embedded in its prompt, exactly as a real reviewer process would.

class RecordingInvoker implements AiInvoker {
  readonly calls: AiInvocationRequest[] = [];
  private readonly respond: (request: AiInvocationRequest) => unknown;

  constructor(respond: (request: AiInvocationRequest) => unknown) {
    this.respond = respond;
  }

  invoke(request: AiInvocationRequest): AiInvocationResult {
    this.calls.push(request);
    return { status: "OK", stdout: JSON.stringify(this.respond(request)) };
  }
}

function reviewerInputOf(request: AiInvocationRequest): ReviewerInputPackage {
  return JSON.parse(request.input.split("REVIEW INPUT (immutable, JSON):\n")[1].split("\n")[0]) as ReviewerInputPackage;
}

/** An evidence-aware CONCUR: every signal SUPPORTED by the records its own text should be read against. */
function concur(input: ReviewerInputPackage): IndependentReviewResult {
  return {
    schemaVersion: "2",
    outcome: "CONCUR",
    rationale: "A afirmação alterada corresponde ao que a fonte regista.",
    findings: [],
    signalDispositions: input.signals.map(({ signalId, signal }) => ({
      signalId,
      disposition: "SUPPORTED",
      reason: "A fonte citada regista a contagem de reclamações referida.",
      evidenceReferences: signal.evidenceReferences?.length ? [...signal.evidenceReferences] : [signal.subjectId],
      relatedFindingIds: [],
    })),
  };
}

function quantitySignal(input: ReviewerInputPackage) {
  const entry = input.signals.find(({ signal }) => signal.code === SIGNAL_CODE.VAGUE_QUANTITY && signal.subjectId === EVD_ID && signal.field === "observation.summary");
  assert.ok(entry, "expected the advisory VAGUE_QUANTITY signal on the EVD observation");
  return entry;
}

/** A valid semantic disagreement: the reviewer judges the advisory quantity wording unsupported. */
function disagreement(input: ReviewerInputPackage): IndependentReviewResult {
  const review = concur(input);
  const { signalId, signal } = quantitySignal(input);
  review.outcome = "DISAGREEMENT_FOUND";
  review.rationale = "A quantidade afirmada vai além do que a fonte regista.";
  review.findings = [{
    findingId: "CLEC-FND-0001",
    recordId: EVD_ID,
    field: signal.field,
    claim: signal.excerpt,
    dimension: signal.dimension,
    kind: "CLEC_VIOLATION",
    severity: "BLOCKING",
    reason: "A fonte não regista um número de reclamações que suporte \"muitas\".",
    evidenceReferences: ["SRC-BASE"],
    correctionDirection: "Indicar o número de reclamações registado pela fonte, ou retirar o quantificador.",
    relatedSignalIds: [signalId],
  }];
  const disposition = review.signalDispositions.find((entry) => entry.signalId === signalId)!;
  Object.assign(disposition, { disposition: "VIOLATION", reason: "Ver o achado ligado.", evidenceReferences: ["SRC-BASE"], relatedFindingIds: ["CLEC-FND-0001"] });
  return review;
}

// ---------------------------------------------------------------------------
// Lane A harness.

const TRIGGER: ResearchTrigger = { mode: "daily-discovery", request: "O que mudou na recolha de resíduos?" };
const NOW = () => new Date("2026-09-15T12:00:00.000Z");
const SOURCE_AVAILABLE = { check: (sourceId: string) => ({ sourceId, status: "available" as const, checkedAt: "2026-09-15T12:00:00.000Z" }) };
const NOOP_POST_PROMOTION = {
  researchCheck: [process.execPath, ["-e", "process.exit(0)"]] as [string, string[]],
  explorerBuild: [process.execPath, ["-e", "process.exit(0)"]] as [string, string[]],
};

function primaryAuthor(evidence: string): RecordingInvoker {
  return new RecordingInvoker(() => ({
    schemaVersion: "1",
    manifest: { schemaVersion: "1", mode: TRIGGER.mode, investigationQuestion: TRIGGER.request, candidateFiles: [EVD_FILE], claimedRecordIds: [EVD_ID], rationale: "Synthetic authoring rationale." },
    candidateFiles: [{ path: EVD_FILE, yaml: evidence }],
  }));
}

interface LaneACycle {
  fixture: RemoteGitFixture;
  cycleDir: string;
  base: string;
  baseBranch: string;
  git(...args: string[]): string;
  gate(...args: string[]): { status: number | null; stdout: string; stderr: string };
  promote(): ReturnType<typeof runPostApprovalPath>;
  cycleArtifacts(): string[];
}

/** `setup` shapes the fixture's main before its head becomes the cycle's base. */
async function withLaneACycle(fn: (cycle: LaneACycle) => Promise<void>, setup?: (fixture: RemoteGitFixture) => void): Promise<void> {
  const fixture = remoteGitFixture();
  const cycleDir = mkdtempSync(join(tmpdir(), "open-evora-clec-cycle-"));
  try {
    setup?.(fixture);
    const git = (...args: string[]): string => execFileSync("git", ["-C", fixture.root, ...args], { encoding: "utf8" }).trim();
    const baseBranch = git("rev-parse", "--abbrev-ref", "HEAD");
    await fn({
      fixture,
      cycleDir,
      base: fixture.head(),
      baseBranch,
      git,
      gate: (...args) => spawnSync(process.execPath, ["--experimental-strip-types", GATE_CLI, ...args], { encoding: "utf8" }),
      promote: () => runPostApprovalPath({
        repoRoot: fixture.root,
        researchRoot: fixture.research,
        cycleDir,
        packagePath: join(cycleDir, PACKAGE_FILENAME),
        baseBranch,
        env: fixture.env,
        postPromotionCommandsForTestingOnly: NOOP_POST_PROMOTION,
      }),
      cycleArtifacts: () => readdirSync(cycleDir).sort(),
    });
  } finally {
    rmSync(cycleDir, { recursive: true, force: true });
    fixture.cleanup();
  }
}

/** Nothing reached canonical research or publication: no record, no commit, no branch, no push, no PR. */
function assertNothingPublished(cycle: LaneACycle): void {
  assert.equal(existsSync(join(cycle.fixture.research, "evidence", EVD_FILE)), false);
  assert.equal(cycle.git("rev-parse", "HEAD"), cycle.base);
  assert.equal(cycle.git("rev-parse", "--abbrev-ref", "HEAD"), cycle.baseBranch);
  assert.equal(cycle.git("status", "--porcelain", "--untracked-files=all"), "");
  assert.deepEqual(cycle.git("for-each-ref", "--format=%(refname)", "refs/heads").split("\n"), [`refs/heads/${cycle.baseBranch}`]);
  assert.equal(cycle.git("ls-remote", "--heads", "origin"), "");
  assert.deepEqual(cycle.fixture.readFakeGhState().prs, []);
}

/** Runs the real orchestration and, on READY_FOR_HUMAN_REVIEW, persists the RCS where `gate render` reads it (as orchestrate/cli.ts does). */
async function prepareCycle(cycle: LaneACycle, primary: RecordingInvoker, reviewer: RecordingInvoker) {
  const outcome = await runResearchCycle({
    trigger: TRIGGER,
    index: loadIndexFor(cycle.fixture.research),
    baseGitSha: cycle.base,
    cycleDir: cycle.cycleDir,
    primaryInvoker: primary,
    reviewerInvoker: reviewer,
    availabilityAdapter: SOURCE_AVAILABLE,
    now: NOW,
  });
  if (outcome.status === "READY_FOR_HUMAN_REVIEW") {
    writeFileSync(join(cycle.cycleDir, "research-change-set.json"), `${JSON.stringify(outcome.changeSet, null, 2)}\n`, "utf8");
  }
  return outcome;
}

/** `gate render`; returns the package exactly as written and the contentHash shown to the owner. */
function render(cycle: LaneACycle): { pkg: HumanGatePackage; contentHash: string; markdown: string } {
  const rendered = cycle.gate("render", "--cycle-dir", cycle.cycleDir, "--dir", cycle.fixture.research);
  assert.equal(rendered.status, 0, rendered.stderr);
  const contentHash = /contentHash: ([0-9a-f]{64})/.exec(rendered.stdout)?.[1];
  assert.ok(contentHash, rendered.stdout);
  const pkg = JSON.parse(readFileSync(join(cycle.cycleDir, PACKAGE_FILENAME), "utf8")) as HumanGatePackage;
  return { pkg, contentHash, markdown: readFileSync(join(cycle.cycleDir, MARKDOWN_FILENAME), "utf8") };
}

function decide(cycle: LaneACycle, contentHash: string) {
  return cycle.gate(
    "decide", "--cycle-dir", cycle.cycleDir, "--actor", "owner@example.invalid", "--content-hash", contentHash,
    "--canonical-acceptance", "APPROVE", "--public-publication", "APPROVE"
  );
}

// ---------------------------------------------------------------------------
// Lane A

test("Lane A: an advisory-signal candidate reaches READY_FOR_OWNER_MERGE only through one independent CONCUR review and a hash-bound human APPROVE", async () => {
  await withLaneACycle(async (cycle) => {
    const primary = primaryAuthor(ADVISORY_EVD);
    const reviewer = new RecordingInvoker((request) => concur(reviewerInputOf(request)));

    // Orchestration: the advisory signal passes the precheck and reaches exactly one fresh reviewer.
    const outcome = await prepareCycle(cycle, primary, reviewer);
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW", outcome.status === "FAILED" ? `${outcome.failedCheck}: ${outcome.message}` : outcome.status);
    if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;
    assert.deepEqual(primary.calls.map((call) => call.role), ["PRIMARY_AUTHOR"]);
    assert.deepEqual(reviewer.calls.map((call) => call.role), ["INDEPENDENT_REVIEWER"]);

    const reviewerInput = reviewerInputOf(reviewer.calls[0]);
    const { signalId } = quantitySignal(reviewerInput);
    assert.ok(reviewerInput.signals.every(({ signal }) => signal.severity === ADVISORY));
    assert.deepEqual(contextFreeBlockers(reviewerInput.signals), []);
    assert.deepEqual(reviewerInput.evidenceContext.map((record) => record.id), ["SRC-BASE"]);

    // The validated review, with every disposition, is carried unchanged by the RCS.
    const review = concur(reviewerInput);
    assert.deepEqual(JSON.parse(readFileSync(join(cycle.cycleDir, "independent-review.json"), "utf8")), review);
    assert.deepEqual(outcome.changeSet.independentReview, review);
    assert.ok(outcome.changeSet.integrationPlan);

    // Human Gate: the package validates and presents the same signals and dispositions.
    const { pkg, contentHash, markdown } = render(cycle);
    assert.deepEqual(validateHumanGatePackage(pkg).errors, []);
    assert.equal(pkg.baseGitSha, cycle.base);
    assert.equal(computeContentHash(pkg), contentHash);
    assert.deepEqual(pkg.independentReview, review);
    assert.deepEqual(pkg.reviewSignals.map((entry) => entry.signalId), reviewerInput.signals.map((entry) => entry.signalId));
    assert.deepEqual(pkg.reviewEvidenceContext.map((record) => record.id), ["SRC-BASE"]);
    assert.match(markdown, new RegExp(`${signalId}[\\s\\S]*SUPPORTED`));

    // Before a bound APPROVE the promoter is unreachable.
    const premature = cycle.promote();
    assert.equal(premature.status === "FAILED" && premature.failedStage, "HIGH2_REVALIDATION");
    assertNothingPublished(cycle);

    // A decision against any other content hash never binds.
    const mismatched = decide(cycle, "0".repeat(64));
    assert.equal(mismatched.status, 1);
    assert.match(mismatched.stderr, /FAILED \[ABORTED_CONTENT_MISMATCH\]/);
    assert.equal(existsSync(join(cycle.cycleDir, DECISION_RECORD_FILENAME)), false);

    // The human APPROVE binds to the exact package ID, content hash and base SHA, and writes nothing canonical.
    const decided = decide(cycle, contentHash);
    assert.equal(decided.status, 0, decided.stderr);
    const record = JSON.parse(readFileSync(join(cycle.cycleDir, DECISION_RECORD_FILENAME), "utf8"));
    assert.deepEqual(
      [record.packageId, record.contentHash, record.baseGitSha, record.canonicalAcceptance, record.publicExplorerPublication],
      [pkg.packageId, contentHash, cycle.base, "APPROVE", "APPROVE"]
    );
    assertNothingPublished(cycle);

    // Post-approval: promotion, guard and Git/PR orchestration stop at the owner's merge.
    const promoted = cycle.promote();
    assert.equal(promoted.status, "READY_FOR_OWNER_MERGE", promoted.status === "FAILED" ? `${promoted.failedStage}: ${promoted.message}` : promoted.status);
    if (promoted.status !== "READY_FOR_OWNER_MERGE") return;
    assert.equal(cycle.git("rev-parse", `${promoted.commitSha}^`), cycle.base);
    assert.deepEqual(cycle.git("diff", "--name-only", cycle.base, promoted.commitSha).split("\n"), [EVD_REPO_PATH]);
    assert.match(cycle.git("show", `${promoted.commitSha}:${EVD_REPO_PATH}`), /muitas reclamações/);

    // No automatic merge: the base branch is untouched locally and never pushed; only the PR branch exists remotely.
    const { prs } = cycle.fixture.readFakeGhState();
    assert.deepEqual(prs.map((pr) => [pr.url, pr.headRefName, pr.baseRefName]), [[promoted.prUrl, promoted.branch, cycle.baseBranch]]);
    assert.equal(cycle.git("rev-parse", `refs/heads/${cycle.baseBranch}`), cycle.base);
    assert.deepEqual(cycle.git("ls-remote", "--heads", "origin").split("\n").map((line) => line.split("\t")), [[promoted.commitSha, `refs/heads/${promoted.branch}`]]);

    // The whole chain used exactly one independent review.
    assert.equal(reviewer.calls.length, 1);
  });
});

test("Lane A: a candidate EVD embedding a PRB ID fails the context-free precheck before any review, RCS, Gate decision, promotion or publication", async () => {
  await withLaneACycle(async (cycle) => {
    const reviewer = new RecordingInvoker((request) => concur(reviewerInputOf(request)));

    const outcome = await prepareCycle(cycle, primaryAuthor(BLOCKED_EVD), reviewer);
    assert.equal(outcome.status, "FAILED", outcome.status);
    if (outcome.status !== "FAILED") return;
    assert.equal(outcome.failedCheck, CONTEXT_FREE_BLOCK);
    assert.match(outcome.message, /CLEC-SIG-\d{4} PRB_ID_IN_EVD_TEXT EVD-E2E inference_limits\[0\]: "PRB-0001"/);
    assert.equal(reviewer.calls.length, 0);
    assert.deepEqual(cycle.cycleArtifacts(), ["candidates", "manifest.json"]);

    // No RCS, so no Gate package and no decision can exist downstream.
    const rendered = cycle.gate("render", "--cycle-dir", cycle.cycleDir, "--dir", cycle.fixture.research);
    assert.equal(rendered.status, 1);
    assert.match(rendered.stderr, /FAILED \[RCS_NOT_FOUND\]/);
    const decided = decide(cycle, "0".repeat(64));
    assert.equal(decided.status, 1);
    assert.match(decided.stderr, /FAILED \[PACKAGE_NOT_FOUND\]/);
    const promoted = cycle.promote();
    assert.equal(promoted.status === "FAILED" && promoted.failedStage, "HIGH2_REVALIDATION");

    assert.deepEqual(cycle.cycleArtifacts(), ["candidates", "manifest.json"]);
    assertNothingPublished(cycle);
  });
});

test("Lane A: an independent semantic disagreement on an advisory-only candidate reaches the Gate intact and canonical APPROVE stays unavailable", async () => {
  await withLaneACycle(async (cycle) => {
    const reviewer = new RecordingInvoker((request) => disagreement(reviewerInputOf(request)));

    // The precheck does not reject advisory wording; the judgement is the reviewer's.
    const outcome = await prepareCycle(cycle, primaryAuthor(ADVISORY_EVD), reviewer);
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW", outcome.status === "FAILED" ? `${outcome.failedCheck}: ${outcome.message}` : outcome.status);
    if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;
    assert.equal(reviewer.calls.length, 1);
    const reviewerInput = reviewerInputOf(reviewer.calls[0]);
    assert.ok(reviewerInput.signals.every(({ signal }) => signal.severity === ADVISORY));
    assert.deepEqual(contextFreeBlockers(reviewerInput.signals), []);
    const review = disagreement(reviewerInput);
    assert.deepEqual(validateIndependentReview(review, reviewerInput).errors, []);
    assert.deepEqual(outcome.changeSet.independentReview, review);

    // The Gate package preserves the finding and its signal disposition.
    const { pkg, contentHash, markdown } = render(cycle);
    assert.deepEqual(validateHumanGatePackage(pkg).errors, []);
    assert.deepEqual(pkg.independentReview, review);
    assert.match(pkg.nonAuthoritativeRecommendation, /canonical APPROVE is unavailable/);
    assert.match(markdown, /CLEC-FND-0001/);

    // Canonical APPROVE is refused against the exact bound package.
    const decided = decide(cycle, contentHash);
    assert.equal(decided.status, 1);
    assert.match(decided.stderr, /FAILED \[REJECTED_SEMANTIC_REVIEW_BLOCKER\]/);
    assert.equal(existsSync(join(cycle.cycleDir, DECISION_RECORD_FILENAME)), false);

    // Even a hand-written, otherwise exactly bound APPROVE record is not honoured by promotion.
    writeDecisionRecord(cycle.cycleDir, {
      schemaVersion: "1",
      packageId: pkg.packageId,
      contentHash,
      baseGitSha: pkg.baseGitSha,
      actor: "owner@example.invalid",
      timestamp: "2026-09-15T12:00:00.000Z",
      canonicalAcceptance: "APPROVE",
      publicExplorerPublication: "APPROVE",
    });
    const promoted = cycle.promote();
    assert.equal(promoted.status === "FAILED" && promoted.failedStage, "SEMANTIC_REVIEW_BLOCKER");

    assertNothingPublished(cycle);
    assert.equal(reviewer.calls.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Lane B harness: the same research tree, changed directly in Git.

interface LaneBRepo {
  fixture: GitFixture;
  base: string;
  scratch: string;
  writeEvidence(yaml: string): void;
  commit(message: string): string;
  /** The review unit `research:lane-b:prepare` computes from the uncommitted working tree. */
  workingTreeUnit(): LaneBReviewUnit;
  /** `research:lane-b:check` against a pull-request body in the repository's own template; `base` defaults to the fixture base. */
  check(head: string, reviewSection: string, base?: string): { status: number | null; output: string };
}

const PR_TEMPLATE = readFileSync(join(REPO_ROOT, ".github", "PULL_REQUEST_TEMPLATE.md"), "utf8");

function pullRequestBody(reviewSection: string): string {
  assert.match(PR_TEMPLATE, /^## Research semantic review$[\s\S]*^N\/A$/m);
  return PR_TEMPLATE.replace(/^N\/A$/m, () => reviewSection);
}

function withLaneBRepo(fn: (repo: LaneBRepo) => void): void {
  const fixture = gitFixture();
  const scratch = mkdtempSync(join(tmpdir(), "open-evora-clec-lane-b-"));
  try {
    execFileSync("git", ["-C", fixture.root, "config", "core.autocrlf", "false"]);
    writeFileSync(join(fixture.research, "sources", "SRC-UNRELATED.yaml"), sourceYaml("SRC-UNRELATED", "Unrelated"));
    mkdirSync(join(fixture.root, "docs"));
    writeFileSync(join(fixture.root, "docs", "notes.md"), "# Notas\n");
    const commit = (message: string): string => {
      fixture.commit(message);
      return fixture.head();
    };
    const base = commit("base corpus");
    fn({
      fixture,
      base,
      scratch,
      writeEvidence: (yaml) => writeFileSync(join(fixture.research, "evidence", EVD_FILE), yaml, "utf8"),
      commit,
      workingTreeUnit: () => resolveLaneBReviewUnit({
        repoRoot: fixture.root,
        baseGitSha: pullRequestBase(fixture.root, base, resolveCommit(fixture.root, "HEAD")),
        head: { kind: "working-tree" },
      }),
      check: (head, reviewSection, prBase = base) => {
        const bodyFile = join(scratch, "pr-body.md");
        writeFileSync(bodyFile, pullRequestBody(reviewSection), "utf8");
        const result = spawnSync(process.execPath, ["--experimental-strip-types", LANE_B_CLI, "check", "--base", prBase, "--head", head, "--body-file", bodyFile], {
          cwd: fixture.root,
          encoding: "utf8",
        });
        return { status: result.status, output: `${result.stdout}${result.stderr}` };
      },
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
    fixture.cleanup();
  }
}

type ReviewRequired = Extract<LaneBReviewUnit, { status: "REVIEW_REQUIRED" }>;

function reviewRequired(unit: LaneBReviewUnit): ReviewRequired {
  assert.equal(unit.status, "REVIEW_REQUIRED");
  return unit as ReviewRequired;
}

/** Runs `prepare`'s review step for the working tree and returns its receipt block. */
function prepareConcurReceipt(repo: LaneBRepo, reviewer: RecordingInvoker): { unit: ReviewRequired; receiptBlock: string } {
  const unit = reviewRequired(repo.workingTreeUnit());
  const prepared = prepareLaneBReview(unit, reviewer, join(repo.scratch, "workbench"));
  assert.equal(prepared.status, "READY", prepared.status === "REVIEW_FAILED" ? `${prepared.failedCheck}: ${prepared.message}` : prepared.status);
  if (prepared.status !== "READY") throw new Error("unreachable");
  return { unit, receiptBlock: prepared.receiptBlock };
}

// ---------------------------------------------------------------------------
// Lane B

test("Lane B: a direct advisory-signal change gets one independent CONCUR review whose exact receipt passes the pull-request check", () => {
  withLaneBRepo((repo) => {
    repo.writeEvidence(ADVISORY_EVD);
    const reviewer = new RecordingInvoker((request) => concur(reviewerInputOf(request)));
    const { unit, receiptBlock } = prepareConcurReceipt(repo, reviewer);

    // Git-derived detection: exactly the changed canonical record, with its normal bounded evidence context.
    assert.equal(unit.baseGitSha, repo.base);
    assert.deepEqual(unit.changedRecords.map(({ id, path, action }) => [id, path, action]), [[EVD_ID, EVD_REPO_PATH, "CREATE"]]);
    assert.deepEqual(unit.reviewerInput.evidenceContext.map((record) => record.id), ["SRC-BASE"]);
    const { signalId } = quantitySignal(unit.reviewerInput);
    assert.ok(unit.reviewerInput.signals.every(({ signal }) => signal.severity === ADVISORY));
    assert.deepEqual(contextFreeBlockers(unit.reviewerInput.signals), []);

    // One fresh reviewer, fed only the bounded package; every signal dispositioned.
    assert.deepEqual(reviewer.calls.map((call) => call.role), ["INDEPENDENT_REVIEWER"]);
    assert.ok(reviewer.calls[0].input.includes(serializeReviewerInput(unit.reviewerInput)));
    const receipt = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(receiptBlock)![1]);
    assert.deepEqual(receipt.independentReview, concur(unit.reviewerInput));
    assert.deepEqual(receipt.independentReview.signalDispositions.map((d: { signalId: string }) => d.signalId), unit.reviewerInput.signals.map((s) => s.signalId));
    assert.ok(receipt.independentReview.signalDispositions.some((d: { signalId: string }) => d.signalId === signalId));

    // The receipt binds to the exact base, record content and reviewer input.
    assert.equal(receipt.baseGitSha, repo.base);
    assert.equal(receipt.reviewerInputFingerprint, unit.reviewerInputFingerprint);
    const blob = execFileSync("git", ["-C", repo.fixture.root, "hash-object", EVD_REPO_PATH], { encoding: "utf8" }).trim();
    assert.deepEqual(receipt.changedRecords.map((record: { id: string; blob: string }) => [record.id, record.blob]), [[EVD_ID, blob]]);

    // The exact machine-generated block in the PR's review section passes the CI check.
    const head = repo.commit("direct research change");
    const checked = repo.check(head, receiptBlock);
    assert.equal(checked.status, 0, checked.output);
    assert.match(checked.output, /^PASS: independent review CONCUR .* eligible for human review \(not an approval\)/m);
    assert.equal(reviewer.calls.length, 1);
  });
});

test("Lane B: changing reviewed record content after the receipt makes the same receipt fail closed", () => {
  withLaneBRepo((repo) => {
    repo.writeEvidence(ADVISORY_EVD);
    const reviewer = new RecordingInvoker((request) => concur(reviewerInputOf(request)));
    const { unit, receiptBlock } = prepareConcurReceipt(repo, reviewer);
    const reviewedHead = repo.commit("direct research change");
    assert.equal(repo.check(reviewedHead, receiptBlock).status, 0);

    repo.writeEvidence(evidenceYaml("A fonte regista a maioria das reclamações sobre a recolha de resíduos em 2026.", "A contagem de reclamações não mede a frequência dos atrasos."));
    const changedHead = repo.commit("edit after review");
    const checked = repo.check(changedHead, receiptBlock);
    assert.equal(checked.status, 1);
    assert.match(checked.output, /FAILED \[RECEIPT_CHANGE_MISMATCH\]/);

    const changedUnit = reviewRequired(resolveLaneBReviewUnit({ repoRoot: repo.fixture.root, baseGitSha: repo.base, head: { kind: "commit", sha: changedHead } }));
    assert.notEqual(changedUnit.reviewerInputFingerprint, unit.reviewerInputFingerprint);
    assert.equal(reviewer.calls.length, 1, "the earlier review is never re-run or reused for the changed content");
  });
});

test("Lane B: a direct EVD change embedding a PRB ID is blocked before review, gets no receipt, and no CONCUR receipt or N/A waives it", () => {
  withLaneBRepo((repo) => {
    repo.writeEvidence(BLOCKED_EVD);
    const reviewer = new RecordingInvoker((request) => concur(reviewerInputOf(request)));
    const workbench = join(repo.scratch, "workbench");
    mkdirSync(workbench);

    const prepared = prepareLaneBReview(reviewRequired(repo.workingTreeUnit()), reviewer, workbench);
    assert.equal(prepared.status, "REVIEW_FAILED");
    if (prepared.status !== "REVIEW_FAILED") return;
    assert.equal(prepared.failedCheck, CONTEXT_FREE_BLOCK);
    assert.match(prepared.message, /CLEC-SIG-\d{4} PRB_ID_IN_EVD_TEXT EVD-E2E inference_limits\[0\]: "PRB-0001"/);
    assert.equal(reviewer.calls.length, 0);
    assert.deepEqual(readdirSync(workbench), [], "no reviewer input, review or receipt is written");

    // An exact, structurally valid CONCUR receipt for the committed change cannot waive the blocker.
    const head = repo.commit("direct research change");
    const unit = reviewRequired(resolveLaneBReviewUnit({ repoRoot: repo.fixture.root, baseGitSha: repo.base, head: { kind: "commit", sha: head } }));
    const waiver = concur(unit.reviewerInput);
    assert.deepEqual(validateIndependentReview(waiver, unit.reviewerInput).errors, []);
    const receiptBlock = renderReceiptBlock(buildLaneBReceipt(unit, waiver));
    for (const section of [receiptBlock, "N/A"]) {
      const checked = repo.check(head, section);
      assert.equal(checked.status, 1);
      assert.match(checked.output, /FAILED \[CLEC_CONTEXT_FREE_BLOCK\]/);
    }
    assert.equal(reviewer.calls.length, 0);
  });
});

test("Lane B: a change touching no canonical PRB/EVD/SRC record needs no receipt and passes with N/A", () => {
  withLaneBRepo((repo) => {
    writeFileSync(join(repo.fixture.root, "docs", "notes.md"), "# Notas revistas\n");
    mkdirSync(join(repo.fixture.root, "tools"));
    writeFileSync(join(repo.fixture.root, "tools", "tool.ts"), "export {};\n");
    assert.deepEqual(repo.workingTreeUnit(), { status: "NO_CANONICAL_CHANGE", baseGitSha: repo.base });

    const checked = repo.check(repo.commit("tooling and docs change"), "N/A");
    assert.equal(checked.status, 0, checked.output);
    assert.match(checked.output, /^PASS: no canonical PRB\/EVD\/SRC record changed; no Lane B receipt is required/m);
  });
});

// ---------------------------------------------------------------------------
// Source Verification Support: bounded, base-bound review context for Source fidelity.

const COUNT_FACT = "312 reclamações";
const TREND_FACT = "duplicaram";
const FIDELITY_SUMMARY = `A fonte regista ${COUNT_FACT} sobre a recolha de resíduos no primeiro semestre de 2026.`;
const FIDELITY_EVD = evidenceYaml(FIDELITY_SUMMARY, "A contagem de reclamações não mede a frequência dos atrasos.");
const BEYOND_SUPPORT_EVD = evidenceYaml(`${FIDELITY_SUMMARY.slice(0, -1)}, que ${TREND_FACT} face a 2025.`, "A contagem de reclamações não mede a frequência dos atrasos.");
const VERIFIED_STATEMENTS = [
  `O relatório indica ${COUNT_FACT} sobre a recolha de resíduos entre janeiro e junho de 2026.`,
  "O relatório não distingue reclamações por freguesia.",
];

function writeSupport(researchRoot: string, statements: readonly string[], sourceId = "SRC-BASE"): void {
  mkdirSync(join(researchRoot, "source-verifications"), { recursive: true });
  writeFileSync(join(researchRoot, "source-verifications", `${sourceId}.yaml`), stringifyRecordYaml({
    source_id: sourceId,
    retrieval: { retrieved_at: "2026-08-27", content_sha256: "9f".repeat(32), media_type: "application/pdf" },
    verified_claims: statements.map((statement, i) => ({ locator: `p. ${i + 3}`, statement })),
  }), "utf8");
}

/**
 * Deterministic stand-in for the reviewer's Source-fidelity judgement: each
 * Source-derived fact the EVD states must be stated by a verified claim
 * supplied for its cited Source; otherwise that wording stays
 * INSUFFICIENT_EVIDENCE (silence is not absence, and nothing is inferred).
 */
function sourceFidelityReviewer(statedFacts: readonly string[]): RecordingInvoker {
  return new RecordingInvoker((request) => {
    const input = reviewerInputOf(request);
    const verified = (input.sourceVerificationContext ?? [])
      .filter((entry) => entry.source_id === "SRC-BASE")
      .flatMap((entry) => entry.verified_claims.map((claim) => claim.statement));
    const unsupported = statedFacts.filter((fact) => !verified.some((statement) => statement.includes(fact)));
    const review = concur(input);
    if (unsupported.length === 0) return review;
    review.outcome = "INSUFFICIENT_EVIDENCE";
    review.rationale = "A metadata canónica da fonte não permite verificar a afirmação derivada da fonte.";
    review.findings = unsupported.map((fact, i) => ({
      findingId: `CLEC-FND-${String(i + 1).padStart(4, "0")}`,
      recordId: EVD_ID,
      field: "observation.summary",
      claim: fact,
      dimension: "evidence_fidelity",
      kind: "INSUFFICIENT_EVIDENCE",
      severity: "BLOCKING",
      reason: "Nem a metadata de SRC-BASE nem as afirmações verificadas fornecidas indicam este facto.",
      evidenceReferences: ["SRC-BASE"],
      correctionDirection: "Limitar a observação ao que a fonte verificada indica, ou obter verificação da fonte para este facto.",
      relatedSignalIds: [],
    }));
    return review;
  });
}

function assertInsufficient(prepared: ReturnType<typeof prepareLaneBReview>, claims: string[]): void {
  assert.equal(prepared.status, "NOT_CONCUR", prepared.status === "REVIEW_FAILED" ? `${prepared.failedCheck}: ${prepared.message}` : prepared.status);
  if (prepared.status !== "NOT_CONCUR") return;
  assert.equal(prepared.independentReview.outcome, "INSUFFICIENT_EVIDENCE");
  assert.deepEqual(
    prepared.independentReview.findings.map((finding) => [finding.kind, finding.claim, finding.evidenceReferences]),
    claims.map((claim) => ["INSUFFICIENT_EVIDENCE", claim, ["SRC-BASE"]])
  );
}

test("Lane A: base Source Verification Support reaches the reviewer and the Gate identically, presented as review context", async () => {
  await withLaneACycle(async (cycle) => {
    const reviewer = sourceFidelityReviewer([COUNT_FACT]);
    const outcome = await prepareCycle(cycle, primaryAuthor(FIDELITY_EVD), reviewer);
    assert.equal(outcome.status, "READY_FOR_HUMAN_REVIEW", outcome.status === "FAILED" ? `${outcome.failedCheck}: ${outcome.message}` : outcome.status);
    if (outcome.status !== "READY_FOR_HUMAN_REVIEW") return;

    const reviewerInput = reviewerInputOf(reviewer.calls[0]);
    assert.deepEqual(
      reviewerInput.sourceVerificationContext?.map((entry) => [entry.source_id, entry.verified_claims.map((claim) => claim.statement)]),
      [["SRC-BASE", VERIFIED_STATEMENTS]]
    );
    assert.deepEqual(reviewerInput.evidenceContext.map((record) => record.id), ["SRC-BASE"]);
    assert.equal(outcome.changeSet.independentReview.outcome, "CONCUR");

    // The Gate exposes exactly what the reviewer received and rebuilds the identical reviewer input.
    const { pkg, markdown } = render(cycle);
    assert.deepEqual(validateHumanGatePackage(pkg).errors, []);
    assert.deepEqual(pkg.reviewSourceVerificationContext, reviewerInput.sourceVerificationContext);
    assert.equal(sha256Hex(reviewerInputFromGatePackage(pkg)), sha256Hex(reviewerInput));
    assert.match(markdown, /### Source Verification Support \(review context, not Evidence\)\nReview support, not canonical Evidence and not Source text/);
    assert.ok(markdown.includes(`  - \`p. 3\`: ${VERIFIED_STATEMENTS[0]}`));
    assertNothingPublished(cycle);
  }, (fixture) => {
    writeSupport(fixture.research, VERIFIED_STATEMENTS);
    fixture.commit("source verification support");
  });
});

test("Lane B: a Source-fidelity claim is INSUFFICIENT_EVIDENCE without support and becomes reviewable once bounded support is merged first", () => {
  withLaneBRepo((repo) => {
    // Without support, the canonical SRC metadata cannot decide the Source-derived count.
    repo.writeEvidence(FIDELITY_EVD);
    const before = reviewRequired(repo.workingTreeUnit());
    assert.equal(before.reviewerInput.sourceVerificationContext, undefined);
    assertInsufficient(prepareLaneBReview(before, sourceFidelityReviewer([COUNT_FACT]), join(repo.scratch, "without-support")), [COUNT_FACT]);

    // Support introduced in the same change is refused, whatever the review section says.
    writeSupport(repo.fixture.research, VERIFIED_STATEMENTS);
    assert.equal(repo.workingTreeUnit().status, "SOURCE_VERIFICATION_NOT_SEPARATE");
    const mixed = repo.check(repo.commit("canonical change with its own support"), "N/A");
    assert.equal(mixed.status, 1);
    assert.match(mixed.output, /FAILED \[SOURCE_VERIFICATION_NOT_SEPARATE\]: .*Source Verification Support must be merged first in a separate pull request/);

    // The support-only pull request needs no receipt; once merged it is the next change's base.
    execFileSync("git", ["-C", repo.fixture.root, "reset", "-q", "--hard", repo.base]);
    writeSupport(repo.fixture.research, VERIFIED_STATEMENTS);
    const supportHead = repo.commit("source verification support");
    const supportOnly = repo.check(supportHead, "N/A");
    assert.equal(supportOnly.status, 0, supportOnly.output);
    assert.match(supportOnly.output, /^PASS: no canonical PRB\/EVD\/SRC record changed/m);

    mkdirSync(join(repo.fixture.research, "evidence"), { recursive: true }); // Git dropped the emptied directory
    repo.writeEvidence(FIDELITY_EVD);
    const reviewer = sourceFidelityReviewer([COUNT_FACT]);
    const unit = reviewRequired(resolveLaneBReviewUnit({ repoRoot: repo.fixture.root, baseGitSha: supportHead, head: { kind: "working-tree" } }));
    assert.deepEqual(unit.reviewerInput.sourceVerificationContext?.map((entry) => entry.source_id), ["SRC-BASE"]);
    const prepared = prepareLaneBReview(unit, reviewer, join(repo.scratch, "with-support"));
    assert.equal(prepared.status, "READY", prepared.status === "REVIEW_FAILED" ? `${prepared.failedCheck}: ${prepared.message}` : prepared.status);
    if (prepared.status !== "READY") return;
    assert.ok(reviewer.calls[0].input.includes(serializeReviewerInput(unit.reviewerInput)));
    const checked = repo.check(repo.commit("direct research change"), prepared.receiptBlock, supportHead);
    assert.equal(checked.status, 0, checked.output);
    assert.match(checked.output, /^PASS: independent review CONCUR /m);
  });
});

test("Lane B: Source-derived wording beyond the verified claims stays INSUFFICIENT_EVIDENCE even with support", () => {
  withLaneBRepo((repo) => {
    writeSupport(repo.fixture.research, VERIFIED_STATEMENTS);
    const supportHead = repo.commit("source verification support");
    repo.writeEvidence(BEYOND_SUPPORT_EVD);
    const unit = reviewRequired(resolveLaneBReviewUnit({ repoRoot: repo.fixture.root, baseGitSha: supportHead, head: { kind: "working-tree" } }));
    assert.deepEqual(unit.reviewerInput.sourceVerificationContext?.[0].verified_claims.map((claim) => claim.statement), VERIFIED_STATEMENTS);
    const workbench = join(repo.scratch, "workbench");
    assertInsufficient(prepareLaneBReview(unit, sourceFidelityReviewer([COUNT_FACT, TREND_FACT]), workbench), [TREND_FACT]);
    assert.equal(existsSync(join(workbench, "pr-receipt.md")), false, "no receipt exists for a non-CONCUR review");
  });
});

// ---------------------------------------------------------------------------
// Both lanes: Source Verification Support follows only the EVDs a change
// creates or updates. A PRB reaching an unchanged EVD never receives support
// for that EVD's Sources; the unchanged EVD is the PRB's evidential boundary.

const PRB_ID = "PRB-E2E";
const PRB_FILE = `${PRB_ID}.yaml`;
const UNCHANGED_EVD_ID = "EVD-OLD";

function problemYaml(evidenceIds: readonly string[]): string {
  return stringifyRecordYaml({
    problem_id: PRB_ID,
    created_at: "2026-09-15",
    updated_at: "2026-09-15",
    title: "Reclamações sobre a recolha de resíduos",
    domain: ["MOB"],
    geography: { level: "municipality", area: "Évora" },
    affected_populations: ["pessoas que apresentaram reclamações sobre a recolha"],
    problem_statement: "A fonte regista reclamações sobre a recolha de resíduos.",
    evidence: evidenceIds.map((evidence_id) => ({ evidence_id, effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] })),
    evidence_status: "discovered",
    validation_status: "unvalidated",
    digital_tractability: "not_assessed",
    solution_landscape_status: "not_assessed",
    status: "OPEN",
  });
}

/** Base additions shared by both lanes: an unchanged EVD on its own eligible Source, and support for both Sources. */
function seedUnchangedEvidenceBase(research: string): void {
  writeFileSync(join(research, "sources", "SRC-OTHER.yaml"), sourceYaml("SRC-OTHER", "Other"));
  writeFileSync(join(research, "evidence", `${UNCHANGED_EVD_ID}.yaml`), stringifyRecordYaml({
    evidence_id: UNCHANGED_EVD_ID,
    provenance: { sources: ["SRC-OTHER"], extracted_at: "2026-08-20" },
    observation: { summary: "A fonte regista reclamações sobre a recolha de resíduos." },
    scope: { geography: { level: "municipality", area: "Évora" }, temporal: { as_of: "2026" } },
    domains: ["MOB"],
    evidence_nature: "fact",
    claim_authority: "authoritative",
    inference_limits: ["A contagem de reclamações não mede a frequência dos atrasos."],
  }));
  writeSupport(research, VERIFIED_STATEMENTS);
  writeSupport(research, ["A fonte indica reclamações sobre a recolha de resíduos em Évora."], "SRC-OTHER");
}

/** The review-unit content both lanes must agree on, independent of lane framing and base SHA. */
function boundedReviewContent(input: ReviewerInputPackage) {
  return { candidates: input.candidates, evidenceContext: input.evidenceContext, signals: input.signals, sourceVerificationContext: input.sourceVerificationContext };
}

/** Reviewer input of one Lane A cycle authoring `files`, captured from the reviewer's prompt. */
async function laneAReviewerInput(files: { path: string; id: string; yaml: string }[]): Promise<ReviewerInputPackage> {
  let input: ReviewerInputPackage | undefined;
  await withLaneACycle(async (cycle) => {
    const primary = new RecordingInvoker(() => ({
      schemaVersion: "1",
      manifest: { schemaVersion: "1", mode: TRIGGER.mode, investigationQuestion: TRIGGER.request, candidateFiles: files.map((f) => f.path), claimedRecordIds: files.map((f) => f.id), rationale: "Synthetic authoring rationale." },
      candidateFiles: files.map((f) => ({ path: f.path, yaml: f.yaml })),
    }));
    const reviewer = new RecordingInvoker((request) => concur(reviewerInputOf(request)));
    const outcome = await prepareCycle(cycle, primary, reviewer);
    assert.ok(reviewer.calls.length > 0, outcome.status === "FAILED" ? `${outcome.failedCheck}: ${outcome.message}` : outcome.status);
    input = reviewerInputOf(reviewer.calls[0]);
  }, (fixture) => {
    seedUnchangedEvidenceBase(fixture.research);
    fixture.commit("unchanged evidence and support on main");
  });
  return input!;
}

/** Reviewer input Lane B derives from Git for the same change written as canonical files. */
function laneBReviewerInput(files: { path: string; yaml: string }[]): ReviewerInputPackage {
  let input: ReviewerInputPackage | undefined;
  withLaneBRepo((repo) => {
    seedUnchangedEvidenceBase(repo.fixture.research);
    const base = repo.commit("unchanged evidence and support on main");
    for (const file of files) writeFileSync(join(repo.fixture.research, file.path), file.yaml, "utf8");
    input = reviewRequired(resolveLaneBReviewUnit({ repoRoot: repo.fixture.root, baseGitSha: base, head: { kind: "working-tree" } })).reviewerInput;
  });
  return input!;
}

test("both lanes give a PRB plus a changed EVD support only for the changed EVD's Sources", async () => {
  const prb = problemYaml([UNCHANGED_EVD_ID, EVD_ID]);
  const laneA = await laneAReviewerInput([{ path: EVD_FILE, id: EVD_ID, yaml: FIDELITY_EVD }, { path: PRB_FILE, id: PRB_ID, yaml: prb }]);
  const laneB = laneBReviewerInput([{ path: `evidence/${EVD_FILE}`, yaml: FIDELITY_EVD }, { path: `problems/${PRB_FILE}`, yaml: prb }]);

  for (const input of [laneA, laneB]) {
    assert.deepEqual(input.evidenceContext.map((record) => record.id), [UNCHANGED_EVD_ID, "SRC-BASE", "SRC-OTHER"]);
    assert.deepEqual(input.sourceVerificationContext?.map((entry) => entry.source_id), ["SRC-BASE"]);
  }
  assert.deepEqual(boundedReviewContent(laneA), boundedReviewContent(laneB));
});

test("both lanes give a PRB-only change no support for the Sources of the unchanged EVD it links", async () => {
  const prb = problemYaml([UNCHANGED_EVD_ID]);
  const laneA = await laneAReviewerInput([{ path: PRB_FILE, id: PRB_ID, yaml: prb }]);
  const laneB = laneBReviewerInput([{ path: `problems/${PRB_FILE}`, yaml: prb }]);

  for (const input of [laneA, laneB]) {
    assert.deepEqual(input.evidenceContext.map((record) => record.id), [UNCHANGED_EVD_ID, "SRC-OTHER"]);
    assert.equal(input.sourceVerificationContext, undefined);
  }
  assert.deepEqual(boundedReviewContent(laneA), boundedReviewContent(laneB));
});
