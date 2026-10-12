/**
 * End-to-end regression for the Citizen Language & Evidence Contract
 * enforcement chain (docs/investigationstrategy.md Â§12) through the
 * orchestrated canonical-integration path:
 *
 *   Lane A: candidate -> deterministic signals -> context-free precheck ->
 *   independent semantic review -> Research Change Set -> Human Gate package
 *   -> hash-bound human decision -> post-approval promotion -> Git/PR ->
 *   READY_FOR_OWNER_MERGE.
 *
 * Every step runs the real production orchestration and Gate code
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
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadIndexFor, remoteGitFixture, runOwnerDeclaredCycle, type RemoteGitFixture } from "./gate/test-fixtures.ts";
import { MARKDOWN_FILENAME, PACKAGE_FILENAME } from "./gate/cli.ts";
import { computeContentHash } from "./gate/content-hash.ts";
import { DECISION_RECORD_FILENAME, writeDecisionRecord } from "./gate/decision-record.ts";
import { reviewerInputFromGatePackage, validateHumanGatePackage } from "./gate/package-validator.ts";
import { stringifyRecordYaml } from "./core/yaml.ts";
import { sha256Hex } from "./core/fingerprint.ts";
import { runPostApprovalPath } from "./gate/promote.ts";
import type { HumanGatePackage } from "./gate/types.ts";
import { ADVISORY, CONTEXT_FREE_BLOCK, contextFreeBlockers, SIGNAL_CODE } from "./language/signals.ts";
import type { AiInvocationRequest, AiInvocationResult, AiInvoker } from "./ai/invoker.ts";
import { validateIndependentReview } from "./review/independent-review.ts";
import type { ReviewerInputPackage } from "./review/reviewer-input.ts";
import type { ResearchTrigger } from "./orchestrate/types.ts";
import type { IndependentReviewResult } from "./review/types.ts";

const GATE_CLI = fileURLToPath(new URL("./gate/cli.ts", import.meta.url));

// ---------------------------------------------------------------------------
// One EVD record, valid under the real schemas, citing the fixture's SRC-BASE.
// Its observation carries an ordinary advisory quantity signal ("muitas");
// the blocked variant also embeds a PRB ID in its own inference limits.

const EVD_ID = "EVD-E2E";
const EVD_FILE = `${EVD_ID}.yaml`;
const EVD_REPO_PATH = `research/evidence/${EVD_FILE}`;
const ADVISORY_SUMMARY = "A fonte regista muitas reclamaÃ§Ãµes sobre a recolha de resÃ­duos em 2026.";

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
    "    area: Ã‰vora",
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

const ADVISORY_EVD = evidenceYaml(ADVISORY_SUMMARY, "A contagem de reclamaÃ§Ãµes nÃ£o mede a frequÃªncia dos atrasos.");
const BLOCKED_EVD = evidenceYaml(ADVISORY_SUMMARY, "A contagem de reclamaÃ§Ãµes nÃ£o se refere a PRB-0001.");

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
    rationale: "A afirmaÃ§Ã£o alterada corresponde ao que a fonte regista.",
    findings: [],
    signalDispositions: input.signals.map(({ signalId, signal }) => ({
      signalId,
      disposition: "SUPPORTED",
      reason: "A fonte citada regista a contagem de reclamaÃ§Ãµes referida.",
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
  review.rationale = "A quantidade afirmada vai alÃ©m do que a fonte regista.";
  review.findings = [{
    findingId: "CLEC-FND-0001",
    recordId: EVD_ID,
    field: signal.field,
    claim: signal.excerpt,
    dimension: signal.dimension,
    kind: "CLEC_VIOLATION",
    severity: "BLOCKING",
    reason: "A fonte nÃ£o regista um nÃºmero de reclamaÃ§Ãµes que suporte \"muitas\".",
    evidenceReferences: ["SRC-BASE"],
    correctionDirection: "Indicar o nÃºmero de reclamaÃ§Ãµes registado pela fonte, ou retirar o quantificador.",
    relatedSignalIds: [signalId],
  }];
  const disposition = review.signalDispositions.find((entry) => entry.signalId === signalId)!;
  Object.assign(disposition, { disposition: "VIOLATION", reason: "Ver o achado ligado.", evidenceReferences: ["SRC-BASE"], relatedFindingIds: ["CLEC-FND-0001"] });
  return review;
}

// ---------------------------------------------------------------------------
// Lane A harness.

const TRIGGER: ResearchTrigger = { mode: "daily-discovery", request: "O que mudou na recolha de resÃ­duos?" };
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
  const outcome = await runOwnerDeclaredCycle({
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
    assert.match(cycle.git("show", `${promoted.commitSha}:${EVD_REPO_PATH}`), /muitas reclamaÃ§Ãµes/);

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

// ---------------------------------------------------------------------------
// Source Verification Support: bounded, base-bound review context for Source fidelity.

const COUNT_FACT = "312 reclamaÃ§Ãµes";
const FIDELITY_SUMMARY = `A fonte regista ${COUNT_FACT} sobre a recolha de resÃ­duos no primeiro semestre de 2026.`;
const FIDELITY_EVD = evidenceYaml(FIDELITY_SUMMARY, "A contagem de reclamaÃ§Ãµes nÃ£o mede a frequÃªncia dos atrasos.");
const VERIFIED_STATEMENTS = [
  `O relatÃ³rio indica ${COUNT_FACT} sobre a recolha de resÃ­duos entre janeiro e junho de 2026.`,
  "O relatÃ³rio nÃ£o distingue reclamaÃ§Ãµes por freguesia.",
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
    review.rationale = "A metadata canÃ³nica da fonte nÃ£o permite verificar a afirmaÃ§Ã£o derivada da fonte.";
    review.findings = unsupported.map((fact, i) => ({
      findingId: `CLEC-FND-${String(i + 1).padStart(4, "0")}`,
      recordId: EVD_ID,
      field: "observation.summary",
      claim: fact,
      dimension: "evidence_fidelity",
      kind: "INSUFFICIENT_EVIDENCE",
      severity: "BLOCKING",
      reason: "Nem a metadata de SRC-BASE nem as afirmaÃ§Ãµes verificadas fornecidas indicam este facto.",
      evidenceReferences: ["SRC-BASE"],
      correctionDirection: "Limitar a observaÃ§Ã£o ao que a fonte verificada indica, ou obter verificaÃ§Ã£o da fonte para este facto.",
      relatedSignalIds: [],
    }));
    return review;
  });
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
