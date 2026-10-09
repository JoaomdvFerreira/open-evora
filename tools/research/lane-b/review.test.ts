import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { RecordFields, RecordSchema } from "../core/types.ts";
import { stringifyRecordYaml } from "../core/yaml.ts";
import type { AiInvocationRequest, AiInvoker } from "../orchestrate/ai-invoker.ts";
import { sha256Hex } from "../orchestrate/fingerprint.ts";
import { validateIndependentReview } from "../orchestrate/independent-review.ts";
import { serializeReviewerInput, type ReviewerInputPackage } from "../orchestrate/reviewer-input.ts";
import { buildReviewerPrompt } from "../orchestrate/reviewer-prompt.ts";
import { assertWorkbenchBoundary } from "../orchestrate/workbench-boundary.ts";
import { defaultLaneBWorkbenchDir } from "./cli.ts";
import {
  extractPullRequestReceipt,
  prepareLaneBReview,
  RECEIPT_BEGIN,
  RECEIPT_END,
  renderReceiptBlock,
  buildLaneBReceipt,
  verifyLaneBPullRequest,
  type LaneBReviewReceipt,
} from "./receipt.ts";
import { LaneBReviewUnitError, resolveLaneBReviewUnit, type LaneBHead, type LaneBReviewUnit } from "./review-unit.ts";

const realRepoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const cliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));

// ---------------------------------------------------------------------------
// Temporary Git fixture: a tiny synthetic corpus plus unrelated repository files.

const SCHEMAS: Record<string, RecordSchema> = {
  "source.schema.json": { prefix: "SRC-", directory: "sources", idField: "source_id" },
  "evidence.schema.json": {
    prefix: "EVD-",
    directory: "evidence",
    idField: "evidence_id",
    references: [{ field: "provenance.sources", isList: true, targetPrefix: "SRC-", targetDirectory: "sources", required: true }],
  },
  "problem.schema.json": {
    prefix: "PRB-",
    directory: "problems",
    idField: "problem_id",
    references: [
      { field: "evidence", isList: true, itemField: "evidence_id", targetPrefix: "EVD-", targetDirectory: "evidence" },
      { field: "decision_basis.overlap_check.related_problems", isList: true, targetPrefix: "PRB-", targetDirectory: "problems" },
    ],
  },
};

const source = (id: string, name: string): RecordFields => ({ source_id: id, name });
const evidence = (id: string, sources: string[], summary: string): RecordFields => ({ evidence_id: id, provenance: { sources }, observation: { summary }, inference_limits: [] });
const problem = (id: string, statement: string, evidenceIds: string[], related: string[] = []): RecordFields => ({
  problem_id: id,
  problem_statement: statement,
  evidence: evidenceIds.map((evidence_id) => ({ evidence_id })),
  decision_basis: { overlap_check: { related_problems: related } },
});

const DIR: Record<string, string> = { "SRC-": "sources", "EVD-": "evidence", "PRB-": "problems" };
const recordPath = (id: string): string => `research/${DIR[id.slice(0, 4)]}/${id}.yaml`;

class Fixture {
  readonly root = mkdtempSync(join(tmpdir(), "open-evora-lane-b-test-"));

  constructor() {
    this.git("init", "-q");
    this.git("config", "core.autocrlf", "false");
    for (const [file, schema] of Object.entries(SCHEMAS)) this.write(`research/schemas/${file}`, `${JSON.stringify(schema, null, 2)}\n`);
    for (const record of [
      source("SRC-A", "Fonte A"),
      source("SRC-B", "Fonte B"),
      source("SRC-UNRELATED", "Fonte sem relação"),
      evidence("EVD-A", ["SRC-A"], "Muitas reclamações registadas em 2025."),
      evidence("EVD-B", ["SRC-B"], "Versão canónica."),
      evidence("EVD-UNRELATED", ["SRC-UNRELATED"], "Sem relação."),
      problem("PRB-OTHER", "Outro problema.", ["EVD-UNRELATED"]),
      problem("PRB-0001", "Atrasos relatados.", ["EVD-A"]),
    ]) this.record(record);
    this.write("research/examples/example.yaml", "example: true\n");
    this.write("apps/research-explorer/src/App.tsx", "export {};\n");
    this.write("tools/research/tool.ts", "export {};\n");
    this.write("docs/notes.md", "# Notas\n");
  }

  git(...args: string[]): string {
    return execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args], {
      cwd: this.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  }

  write(path: string, content: string): void {
    const target = join(this.root, ...path.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }

  record(fields: RecordFields): void {
    const id = (fields.problem_id ?? fields.evidence_id ?? fields.source_id) as string;
    this.write(recordPath(id), stringifyRecordYaml(fields));
  }

  remove(path: string): void {
    rmSync(join(this.root, ...path.split("/")));
  }

  commit(message = "change"): string {
    this.git("add", "-A");
    this.git("commit", "-q", "--allow-empty", "-m", message);
    return this.git("rev-parse", "HEAD");
  }

  unit(baseGitSha: string, head: LaneBHead): LaneBReviewUnit {
    return resolveLaneBReviewUnit({ repoRoot: this.root, baseGitSha, head });
  }

  cleanup(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}

function withFixture(fn: (fixture: Fixture, base: string) => void): void {
  const fixture = new Fixture();
  try {
    fn(fixture, fixture.commit("base"));
  } finally {
    fixture.cleanup();
  }
}

type ReviewRequired = Extract<LaneBReviewUnit, { status: "REVIEW_REQUIRED" }>;

function reviewRequired(unit: LaneBReviewUnit): ReviewRequired {
  assert.equal(unit.status, "REVIEW_REQUIRED");
  return unit as ReviewRequired;
}

/** Base corpus plus a new PRB that relies on EVD-A and names PRB-OTHER as a related problem. */
function addProblemWithSignal(fixture: Fixture): void {
  fixture.record(problem("PRB-NEW", "Muitos moradores relatam atrasos.", ["EVD-A"], ["PRB-OTHER"]));
}

// ---------------------------------------------------------------------------
// Structured reviews built against a reviewer package.

type Review = Record<string, unknown> & { outcome: string; findings: Record<string, unknown>[]; signalDispositions: Record<string, unknown>[] };

function concur(pkg: ReviewerInputPackage): Review {
  return {
    schemaVersion: "2",
    outcome: "CONCUR",
    rationale: "As afirmações alteradas correspondem à evidência fornecida.",
    findings: [],
    signalDispositions: pkg.signals.map(({ signalId }) => ({
      signalId,
      disposition: "SUPPORTED",
      reason: "EVD-A regista muitas reclamações.",
      evidenceReferences: ["EVD-A"],
      relatedFindingIds: [],
    })),
  };
}

function firstSignalOn(pkg: ReviewerInputPackage, recordId: string): string {
  const entry = pkg.signals.find(({ signal }) => signal.subjectId === recordId);
  assert.ok(entry, `expected a signal on ${recordId}`);
  return entry.signalId;
}

function withFinding(pkg: ReviewerInputPackage, kind: "CLEC_VIOLATION" | "INSUFFICIENT_EVIDENCE"): Review {
  const review = concur(pkg);
  const signalId = firstSignalOn(pkg, "PRB-NEW");
  review.findings = [{
    findingId: "CLEC-FND-0001",
    recordId: "PRB-NEW",
    field: "problem_statement",
    claim: "Muitos moradores",
    dimension: "supported_quantity",
    kind,
    severity: "BLOCKING",
    reason: "A evidência regista reclamações, não a proporção de moradores afetados.",
    evidenceReferences: ["EVD-A"],
    correctionDirection: "Atribuir a afirmação às reclamações registadas.",
    relatedSignalIds: [signalId],
  }];
  const disposition = review.signalDispositions.find((entry) => entry.signalId === signalId)!;
  disposition.disposition = kind === "CLEC_VIOLATION" ? "VIOLATION" : "INSUFFICIENT_EVIDENCE";
  disposition.evidenceReferences = ["EVD-A"];
  disposition.relatedFindingIds = ["CLEC-FND-0001"];
  review.outcome = kind === "CLEC_VIOLATION" ? "DISAGREEMENT_FOUND" : "INSUFFICIENT_EVIDENCE";
  return review;
}

function receiptFor(unit: ReviewRequired, review: Review): LaneBReviewReceipt {
  return buildLaneBReceipt(unit, review as unknown as LaneBReviewReceipt["independentReview"]);
}

/** A PR body in the canonical template shape with `section` as the Research semantic review content. */
function prBody(section: string): string {
  return ["## Summary", "", "Direct research change.", "", "## Research semantic review", "", section, "", "## Notes", "", "None."].join("\n");
}

const bodyWith = (receipt: unknown): string => prBody(renderReceiptBlock(receipt as LaneBReviewReceipt));

function assertFails(unit: LaneBReviewUnit, body: string, failedCheck: string, pattern?: RegExp): void {
  const result = verifyLaneBPullRequest(unit, body);
  assert.equal(result.ok, false, `expected ${failedCheck}`);
  if (result.ok) return;
  assert.equal(result.failedCheck, failedCheck, result.errors.join("; "));
  if (pattern) assert.match(result.errors.join("\n"), pattern);
}

class RecordingInvoker implements AiInvoker {
  readonly requests: AiInvocationRequest[] = [];
  private readonly respond: (request: AiInvocationRequest) => string;

  constructor(respond: (request: AiInvocationRequest) => string) {
    this.respond = respond;
  }

  invoke(request: AiInvocationRequest) {
    this.requests.push(request);
    return { status: "OK" as const, stdout: this.respond(request) };
  }
}

// ---------------------------------------------------------------------------
// Changed-record detection from Git.

test("changes outside canonical record files need no Lane B review", () => {
  withFixture((fixture, base) => {
    fixture.write("apps/research-explorer/src/App.tsx", "export const x = 1;\n");
    fixture.write("tools/research/tool.ts", "export const y = 2;\n");
    fixture.write("docs/notes.md", "# Notas revistas\n");
    fixture.write("research/examples/example.yaml", "example: false\n");
    const head = fixture.commit();
    assert.deepEqual(fixture.unit(base, { kind: "commit", sha: head }), { status: "NO_CANONICAL_CHANGE", baseGitSha: base });
    assert.deepEqual(fixture.unit(base, { kind: "commit", sha: base }), { status: "NO_CANONICAL_CHANGE", baseGitSha: base });
  });
});

test("a schema-only research change needs no Lane B review", () => {
  withFixture((fixture, base) => {
    fixture.write("research/schemas/source.schema.json", `${JSON.stringify({ ...SCHEMAS["source.schema.json"], notes: "revisto" })}\n`);
    assert.equal(fixture.unit(base, { kind: "commit", sha: fixture.commit() }).status, "NO_CANONICAL_CHANGE");
  });
});

test("canonical PRB creates and EVD/SRC updates are review units, alongside unrelated changes", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    fixture.record(evidence("EVD-B", ["SRC-B"], "Versão candidata."));
    fixture.record(source("SRC-B", "Fonte B (editora revista)"));
    fixture.write("docs/notes.md", "# Outra alteração\n");
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    assert.deepEqual(
      unit.changedRecords.map(({ recordFamily, id, path, action }) => ({ recordFamily, id, path, action })),
      [
        { recordFamily: "EVD-", id: "EVD-B", path: "research/evidence/EVD-B.yaml", action: "UPDATE" },
        { recordFamily: "PRB-", id: "PRB-NEW", path: "research/problems/PRB-NEW.yaml", action: "CREATE" },
        { recordFamily: "SRC-", id: "SRC-B", path: "research/sources/SRC-B.yaml", action: "UPDATE" },
      ]
    );
    assert.ok(unit.changedRecords.every(({ blob }) => /^[0-9a-f]{40,64}$/.test(blob)));
  });
});

test("deleting a canonical record is unsupported by Lane B and fails closed", () => {
  withFixture((fixture, base) => {
    fixture.remove(recordPath("EVD-UNRELATED"));
    const unit = fixture.unit(base, { kind: "commit", sha: fixture.commit() });
    assert.deepEqual(unit, { status: "UNSUPPORTED_DELETION", baseGitSha: base, paths: ["research/evidence/EVD-UNRELATED.yaml"] });
    assertFails(unit, prBody("N/A"), "UNSUPPORTED_CANONICAL_DELETION", /EVD-UNRELATED/);
  });
});

test("renaming a canonical record file is observed as an unsupported deletion", () => {
  withFixture((fixture, base) => {
    fixture.git("mv", recordPath("SRC-UNRELATED"), "research/sources/SRC-RENAMED.yaml");
    const unit = fixture.unit(base, { kind: "commit", sha: fixture.commit() });
    assert.equal(unit.status, "UNSUPPORTED_DELETION");
  });
});

test("a changed record file must be the canonical file of the record it holds", () => {
  withFixture((fixture, base) => {
    fixture.write("research/problems/misnamed.yaml", stringifyRecordYaml(problem("PRB-NEW", "Atrasos.", ["EVD-A"])));
    const head = fixture.commit();
    assert.throws(() => fixture.unit(base, { kind: "commit", sha: head }), LaneBReviewUnitError);
  });
});

test("the base must be an existing full commit SHA", () => {
  withFixture((fixture, base) => {
    assert.throws(() => fixture.unit(base.slice(0, 12), { kind: "working-tree" }), LaneBReviewUnitError);
    assert.throws(() => fixture.unit("0".repeat(40), { kind: "working-tree" }), LaneBReviewUnitError);
  });
});

// ---------------------------------------------------------------------------
// Base reconstruction and the bounded reviewer package.

test("the reviewer package follows PRB -> EVD -> SRC only and excludes unrelated records and related problems", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    assert.deepEqual(unit.reviewerInput.evidenceContext.map((record) => record.id), ["EVD-A", "SRC-A"]);
    const json = serializeReviewerInput(unit.reviewerInput);
    // PRB-OTHER is named by the candidate itself, but its record is never followed;
    // whole-corpus validation may name other record files, never their content.
    for (const excluded of ["Outro problema.", "Sem relação.", "Fonte sem relação", "Atrasos relatados.", "Versão canónica.", "Fonte B"]) {
      assert.equal(json.includes(excluded), false, `${excluded} must not reach the reviewer`);
    }
    assert.equal(unit.reviewerInput.mode, "direct-pull-request");
    assert.ok(unit.reviewerInput.signals.some(({ signal }) => signal.subjectId === "PRB-NEW"));
  });
});

test("a candidate version wins over its canonical version in the reviewer package", () => {
  withFixture((fixture, base) => {
    fixture.record(evidence("EVD-B", ["SRC-A"], "Versão candidata."));
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    const json = serializeReviewerInput(unit.reviewerInput);
    assert.equal(json.includes("Versão candidata."), true);
    assert.equal(json.includes("Versão canónica."), false);
    assert.deepEqual(unit.reviewerInput.evidenceContext.map((record) => record.id), ["SRC-A"]);
  });
});

test("the base corpus is reconstructed from the base commit, not from the checked-out tree", () => {
  withFixture((fixture, first) => {
    fixture.record(evidence("EVD-A", ["SRC-A"], "Reclamações registadas no segundo trimestre de 2025."));
    const base = fixture.commit("evidence revised on main");
    addProblemWithSignal(fixture);
    const head = fixture.commit("direct change");
    fixture.git("checkout", "-q", first);

    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: head }));
    assert.deepEqual(unit.changedRecords.map((record) => record.id), ["PRB-NEW"]);
    const evdA = unit.reviewerInput.evidenceContext.find((record) => record.id === "EVD-A");
    assert.deepEqual(evdA?.fields.observation, { summary: "Reclamações registadas no segundo trimestre de 2025." });

    // Against an older base, the same head carries the EVD-A revision as a change of its own.
    assert.deepEqual(reviewRequired(fixture.unit(first, { kind: "commit", sha: head })).changedRecords.map((record) => record.id), ["EVD-A", "PRB-NEW"]);
  });
});

test("temporary base-corpus staging is removed on success and on failure", () => {
  withFixture((fixture, base) => {
    const scratch = mkdtempSync(join(tmpdir(), "open-evora-lane-b-scratch-"));
    const saved = { TMPDIR: process.env.TMPDIR, TEMP: process.env.TEMP, TMP: process.env.TMP };
    try {
      Object.assign(process.env, { TMPDIR: scratch, TEMP: scratch, TMP: scratch });
      addProblemWithSignal(fixture);
      reviewRequired(fixture.unit(base, { kind: "working-tree" }));
      assert.deepEqual(readdirSync(scratch), []);
      fixture.write("research/problems/PRB-BROKEN.yaml", "problem_id: [unterminated\n");
      assert.throws(() => fixture.unit(base, { kind: "working-tree" }), LaneBReviewUnitError);
      assert.deepEqual(readdirSync(scratch), []);
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

test("an uncommitted working-tree change yields the same review unit as its later commit", () => {
  withFixture((fixture, base) => {
    fixture.git("config", "core.autocrlf", "true");
    addProblemWithSignal(fixture); // untracked
    fixture.write(recordPath("EVD-B"), stringifyRecordYaml(evidence("EVD-B", ["SRC-B"], "Versão candidata.")).replace(/\n/g, "\r\n")); // modified, CRLF
    const prepared = reviewRequired(fixture.unit(base, { kind: "working-tree" }));
    const committed = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    assert.deepEqual(committed.changedRecords, prepared.changedRecords);
    assert.equal(committed.reviewerInputFingerprint, prepared.reviewerInputFingerprint);
  });
});

// ---------------------------------------------------------------------------
// Source Verification Support: read from the review base only.

const SUPPORT_PATH = "research/source-verifications/SRC-A.yaml";
const ELIGIBLE_SOURCE: RecordFields = { resource_type: "document", access: { level: "public" }, licensing: { reuse: "unknown" } };

function writeSupport(fixture: Fixture, sourceId: string, statements: string[]): void {
  fixture.write(`research/source-verifications/${sourceId}.yaml`, stringifyRecordYaml({
    source_id: sourceId,
    retrieval: { retrieved_at: "2026-08-25", content_sha256: "ab".repeat(32), media_type: "application/pdf" },
    verified_claims: statements.map((statement, i) => ({ locator: `p. ${i + 1}`, statement })),
  }));
}

/** A base where SRC-A is an eligible public Source carrying support with `statements`. */
function withSupportedBase(statements: string[], fn: (fixture: Fixture, base: string) => void): void {
  withFixture((fixture) => {
    fixture.record({ ...source("SRC-A", "Fonte A"), ...ELIGIBLE_SOURCE });
    writeSupport(fixture, "SRC-A", statements);
    fn(fixture, fixture.commit("support merged on main"));
  });
}

test("support for a Source the changed records reach is read from the base commit, not from the head or checkout", () => {
  withSupportedBase(["A fonte regista reclamações sobre atrasos em 2025."], (fixture, base) => {
    addProblemWithSignal(fixture);
    const head = fixture.commit("direct change");
    writeSupport(fixture, "SRC-A", ["Afirmação não revista no checkout."]);

    const pkg = reviewRequired(fixture.unit(base, { kind: "commit", sha: head })).reviewerInput;
    assert.deepEqual(pkg.sourceVerificationContext?.map((entry) => [entry.source_id, entry.verified_claims.map((claim) => claim.statement)]), [
      ["SRC-A", ["A fonte regista reclamações sobre atrasos em 2025."]],
    ]);
    assert.equal(serializeReviewerInput(pkg).includes("Afirmação não revista no checkout."), false);
    // The edited checkout is itself a change carrying both canonical records and support.
    assert.equal(fixture.unit(base, { kind: "working-tree" }).status, "SOURCE_VERIFICATION_NOT_SEPARATE");
  });
});

test("support introduced together with a canonical change cannot influence its review and fails closed", () => {
  withFixture((fixture, first) => {
    fixture.record({ ...source("SRC-A", "Fonte A"), ...ELIGIBLE_SOURCE });
    const base = fixture.commit("eligible source on main");
    addProblemWithSignal(fixture);
    writeSupport(fixture, "SRC-A", ["Afirmação trazida pela própria alteração."]);

    for (const unit of [fixture.unit(base, { kind: "working-tree" }), fixture.unit(base, { kind: "commit", sha: fixture.commit("mixed change") })]) {
      assert.deepEqual(unit, { status: "SOURCE_VERIFICATION_NOT_SEPARATE", baseGitSha: base, recordPaths: [recordPath("PRB-NEW")], supportPaths: [SUPPORT_PATH] });
      assertFails(unit, prBody("N/A"), "SOURCE_VERIFICATION_NOT_SEPARATE", /Source Verification Support must be merged first in a separate pull request/);
    }
    // Measured from an older base the SRC-A update joins the canonical side; the refusal is the same.
    assert.equal(fixture.unit(first, { kind: "working-tree" }).status, "SOURCE_VERIFICATION_NOT_SEPARATE");
  });
});

test("a support-only change has no canonical change and needs no Lane B receipt", () => {
  withSupportedBase(["A fonte regista reclamações sobre atrasos em 2025."], (fixture, base) => {
    writeSupport(fixture, "SRC-A", ["A fonte regista reclamações sobre atrasos no segundo trimestre de 2025."]);
    writeSupport(fixture, "SRC-B", ["Outra afirmação verificada."]);
    const unit = fixture.unit(base, { kind: "commit", sha: fixture.commit("support-only change") });
    assert.deepEqual(unit, { status: "NO_CANONICAL_CHANGE", baseGitSha: base });
    assert.equal(verifyLaneBPullRequest(unit, prBody("N/A")).ok, true);
  });
});

test("invalid applicable support in the base fails closed; invalid support for an unreached Source does not", () => {
  withFixture((fixture) => {
    fixture.record({ ...source("SRC-A", "Fonte A"), ...ELIGIBLE_SOURCE, licensing: { reuse: "prohibited" } });
    writeSupport(fixture, "SRC-A", ["A fonte regista reclamações."]);
    writeSupport(fixture, "SRC-UNRELATED", []);
    const base = fixture.commit("invalid support on main");

    addProblemWithSignal(fixture);
    assert.throws(
      () => fixture.unit(base, { kind: "working-tree" }),
      /SOURCE_VERIFICATION_SUPPORT: applicable Source Verification Support is invalid: source-verifications\/SRC-A\.yaml: SRC-A has licensing\.reuse "prohibited"/
    );

    fixture.remove(recordPath("PRB-NEW"));
    fixture.record(evidence("EVD-B", ["SRC-B"], "Versão candidata."));
    assert.equal(reviewRequired(fixture.unit(base, { kind: "working-tree" })).reviewerInput.sourceVerificationContext, undefined);
  });
});

test("the fingerprinted reviewer input changes with applicable base support and not with support for unreached Sources", () => {
  withSupportedBase(["A fonte regista reclamações sobre atrasos em 2025."], (fixture, base) => {
    // The same direct change reviewed on another base; only the base SHA itself is neutralised for comparison.
    const reviewOn = (onBase: string): string => {
      fixture.git("checkout", "-q", "--detach", onBase);
      addProblemWithSignal(fixture);
      const unit = reviewRequired(fixture.unit(onBase, { kind: "commit", sha: fixture.commit("direct change") }));
      assert.equal(unit.reviewerInputFingerprint, sha256Hex(unit.reviewerInput));
      return sha256Hex({ ...unit.reviewerInput, baseGitSha: "" });
    };
    const original = reviewOn(base);

    fixture.git("checkout", "-q", "--detach", base);
    writeSupport(fixture, "SRC-A", ["A fonte regista reclamações sobre atrasos no segundo trimestre de 2025."]);
    const revisedBase = fixture.commit("support revised on main");
    fixture.git("checkout", "-q", "--detach", base);
    fixture.record({ ...source("SRC-UNRELATED", "Fonte sem relação"), ...ELIGIBLE_SOURCE });
    writeSupport(fixture, "SRC-UNRELATED", ["Afirmação sobre outra fonte."]);
    const unrelatedBase = fixture.commit("unrelated support on main");

    assert.notEqual(reviewOn(revisedBase), original);
    assert.equal(reviewOn(unrelatedBase), original);
  });
});

// ---------------------------------------------------------------------------
// PR-body receipt extraction.

test("a rendered receipt is extracted deterministically from the template section, including CRLF bodies", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    const receipt = receiptFor(unit, concur(unit.reviewerInput));
    const body = bodyWith(receipt);
    assert.deepEqual(extractPullRequestReceipt(body), { status: "PRESENT", value: receipt });
    assert.deepEqual(extractPullRequestReceipt(body.replace(/\n/g, "\r\n")), { status: "PRESENT", value: receipt });
    assert.equal(renderReceiptBlock(receipt), renderReceiptBlock(JSON.parse(JSON.stringify(receipt))));
  });
});

test("the repository PR template defaults to N/A and carries a pasted receipt in its review section", () => {
  const template = readFileSync(join(realRepoRoot, ".github", "PULL_REQUEST_TEMPLATE.md"), "utf8");
  assert.deepEqual(extractPullRequestReceipt(template), { status: "NOT_APPLICABLE" });
  assert.equal(template.includes(RECEIPT_BEGIN) || template.includes(RECEIPT_END), false);
  const block = `${RECEIPT_BEGIN}\n\`\`\`json\n{"schemaVersion":"1"}\n\`\`\`\n${RECEIPT_END}`;
  const filled = template.replace(/\r?\nN\/A\r?\n/, `\n${block}\n`);
  assert.notEqual(filled, template);
  assert.deepEqual(extractPullRequestReceipt(filled), { status: "PRESENT", value: { schemaVersion: "1" } });
});

test("prose, JSON outside the markers and template comments are never mistaken for a receipt", () => {
  assert.deepEqual(extractPullRequestReceipt(prBody("N/A")), { status: "NOT_APPLICABLE" });
  assert.deepEqual(extractPullRequestReceipt(prBody("<!-- instructions -->\nN/A")), { status: "NOT_APPLICABLE" });
  for (const section of ["reviewed: true", "Self-reviewed by the author. N/A", '```json\n{"schemaVersion":"1"}\n```', "<!-- instructions -->"]) {
    assert.equal(extractPullRequestReceipt(prBody(section)).status, "ABSENT", section);
  }
  assert.equal(extractPullRequestReceipt("## Summary\n\nNo review section.").status, "ABSENT");
  assert.equal(extractPullRequestReceipt(null).status, "ABSENT");
});

test("duplicated, misplaced or malformed receipt blocks are invalid", () => {
  const block = `${RECEIPT_BEGIN}\n\`\`\`json\n{}\n\`\`\`\n${RECEIPT_END}`;
  assert.equal(extractPullRequestReceipt(prBody(`${block}\n${block}`)).status, "INVALID");
  assert.equal(extractPullRequestReceipt(`${prBody("N/A")}\n\n${block}`).status, "INVALID");
  assert.equal(extractPullRequestReceipt(`${block}\n\n## Summary`).status, "INVALID");
  assert.equal(extractPullRequestReceipt(prBody(`${RECEIPT_BEGIN}\n\`\`\`json\n{not json}\n\`\`\`\n${RECEIPT_END}`)).status, "INVALID");
  assert.equal(extractPullRequestReceipt(prBody(`${RECEIPT_BEGIN}\n{}\n${RECEIPT_END}`)).status, "INVALID");
  assert.equal(extractPullRequestReceipt(prBody(RECEIPT_BEGIN)).status, "INVALID");
  assert.equal(extractPullRequestReceipt(`${prBody("N/A")}\n## Research semantic review\n\nN/A`).status, "INVALID");
});

// ---------------------------------------------------------------------------
// Receipt verification against the unit rebuilt from Git.

test("without canonical record changes the check passes with or without a receipt section", () => {
  withFixture((fixture, base) => {
    fixture.write("docs/notes.md", "# Alterado\n");
    const unit = fixture.unit(base, { kind: "commit", sha: fixture.commit() });
    for (const body of [prBody("N/A"), "", "## Summary\n\nDocs only."]) assert.equal(verifyLaneBPullRequest(unit, body).ok, true);
  });
});

test("a canonical record change without a receipt fails, including N/A and prose", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = fixture.unit(base, { kind: "commit", sha: fixture.commit() });
    assertFails(unit, "## Summary\n\nNo section.", "RECEIPT_MISSING", /PRB-NEW/);
    assertFails(unit, prBody("N/A"), "RECEIPT_MISSING", /N\/A is only valid/);
    assertFails(unit, prBody("Reviewed: true (self-review by the author)."), "RECEIPT_MISSING");
  });
});

test("a malformed or duplicated receipt fails", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    const receipt = receiptFor(unit, concur(unit.reviewerInput));
    assertFails(unit, bodyWith({ ...receipt, extra: true }), "RECEIPT_INVALID", /unknown field "extra"/);
    assertFails(unit, bodyWith({ ...receipt, schemaVersion: "2" }), "RECEIPT_INVALID");
    assertFails(unit, prBody(`${renderReceiptBlock(receipt)}\n${renderReceiptBlock(receipt)}`), "RECEIPT_INVALID", /more than one/);
  });
});

test("an exact CONCUR receipt with signals and valid dispositions passes; advisory signals alone never fail", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    assert.ok(unit.reviewerInput.signals.length > 0);
    const result = verifyLaneBPullRequest(unit, bodyWith(receiptFor(unit, concur(unit.reviewerInput))));
    assert.deepEqual(result.ok, true, result.ok ? "" : result.errors.join("; "));
  });
});

test("a receipt bound to another base fails", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    const receipt = receiptFor(unit, concur(unit.reviewerInput));
    assertFails(unit, bodyWith({ ...receipt, baseGitSha: "f".repeat(40) }), "RECEIPT_BASE_MISMATCH");
  });
});

test("a tampered reviewer-input fingerprint fails", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    const receipt = receiptFor(unit, concur(unit.reviewerInput));
    assertFails(unit, bodyWith({ ...receipt, reviewerInputFingerprint: "0".repeat(64) }), "RECEIPT_FINGERPRINT_MISMATCH");
  });
});

test("a receipt goes stale when a reviewed record changes or another record is added after review", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const reviewed = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    const body = bodyWith(receiptFor(reviewed, concur(reviewed.reviewerInput)));

    fixture.record(problem("PRB-NEW", "Muitos moradores relatam atrasos frequentes.", ["EVD-A"], ["PRB-OTHER"]));
    const edited = fixture.unit(base, { kind: "commit", sha: fixture.commit("edit after review") });
    assertFails(edited, body, "RECEIPT_CHANGE_MISMATCH");

    fixture.record(problem("PRB-NEW", "Muitos moradores relatam atrasos.", ["EVD-A"], ["PRB-OTHER"]));
    fixture.record(evidence("EVD-NEW", ["SRC-A"], "Nova observação."));
    const extended = fixture.unit(base, { kind: "commit", sha: fixture.commit("add after review") });
    assertFails(extended, body, "RECEIPT_CHANGE_MISMATCH");
  });
});

test("only a CONCUR outcome is eligible; DISAGREEMENT_FOUND and INSUFFICIENT_EVIDENCE fail", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    assertFails(unit, bodyWith(receiptFor(unit, withFinding(unit.reviewerInput, "CLEC_VIOLATION"))), "INDEPENDENT_REVIEW_NOT_CONCUR", /DISAGREEMENT_FOUND/);
    assertFails(unit, bodyWith(receiptFor(unit, withFinding(unit.reviewerInput, "INSUFFICIENT_EVIDENCE"))), "INDEPENDENT_REVIEW_NOT_CONCUR", /INSUFFICIENT_EVIDENCE/);
  });
});

test("the embedded review is judged by the context-aware validator against the rebuilt package", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    const pkg = unit.reviewerInput;
    const check = (mutate: (review: Review) => void, pattern: RegExp): void => {
      const review = concur(pkg);
      mutate(review);
      assertFails(unit, bodyWith(receiptFor(unit, review)), "INDEPENDENT_REVIEW_INVALID", pattern);
    };

    check((review) => review.signalDispositions.pop(), /has no disposition/);
    check((review) => review.signalDispositions.push({ ...review.signalDispositions[0] }), /more than one disposition/);
    check((review) => { review.signalDispositions[0].signalId = "CLEC-SIG-9999"; }, /not a signal in the review input/);
    check((review) => { review.signalDispositions[0].evidenceReferences = ["EVD-UNRELATED"]; }, /not a record in the review input/);
    check((review) => {
      const linked = withFinding(pkg, "CLEC_VIOLATION");
      review.findings = linked.findings;
      review.outcome = "DISAGREEMENT_FOUND";
    }, /does not link the finding/);
    check((review) => { review.outcome = undefined as unknown as string; }, /outcome must be one of/);
  });
});

// ---------------------------------------------------------------------------
// Preparation: one fresh, bounded INDEPENDENT_REVIEWER invocation.

test("preparation invokes one INDEPENDENT_REVIEWER with only the bounded package prompt and yields a verifiable receipt", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "working-tree" }));
    const workbench = mkdtempSync(join(tmpdir(), "open-evora-lane-b-workbench-"));
    const savedFetch = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error("network access is not part of Lane B review"); }) as typeof fetch;
    try {
      const invoker = new RecordingInvoker(() => JSON.stringify(concur(unit.reviewerInput)));
      const outcome = prepareLaneBReview(unit, invoker, workbench);
      assert.equal(outcome.status, "READY");
      assert.equal(invoker.requests.length, 1);
      assert.equal(invoker.requests[0].role, "INDEPENDENT_REVIEWER");
      assert.equal(invoker.requests[0].input, buildReviewerPrompt(serializeReviewerInput(unit.reviewerInput)));
      for (const excluded of ["Outro problema.", "Sem relação.", "Fonte sem relação", "Atrasos relatados."]) assert.equal(invoker.requests[0].input.includes(excluded), false);
      // Source records reach the reviewer exactly as canonical metadata; nothing is fetched.
      assert.deepEqual(unit.reviewerInput.evidenceContext.find((record) => record.id === "SRC-A")?.fields, source("SRC-A", "Fonte A"));
      assert.deepEqual(readdirSync(workbench).sort(), ["independent-review-attempt-1.stdout.txt", "independent-review.json", "pr-receipt.md", "reviewer-input.json"]);

      if (outcome.status !== "READY") return;
      const committed = fixture.unit(base, { kind: "commit", sha: fixture.commit() });
      assert.deepEqual(verifyLaneBPullRequest(committed, prBody(outcome.receiptBlock)).ok, true);
    } finally {
      globalThis.fetch = savedFetch;
      rmSync(workbench, { recursive: true, force: true });
    }
  });
});

test("Lane B retries an invalid finding once and creates a receipt only from the valid replacement", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "working-tree" }));
    const workbench = mkdtempSync(join(tmpdir(), "open-evora-lane-b-workbench-"));
    try {
      const invalid = withFinding(unit.reviewerInput, "CLEC_VIOLATION");
      invalid.findings[0].evidenceReferences = [];
      let calls = 0;
      const invoker = new RecordingInvoker(() => JSON.stringify(++calls === 1 ? invalid : concur(unit.reviewerInput)));
      const outcome = prepareLaneBReview(unit, invoker, workbench);
      assert.equal(outcome.status, "READY");
      assert.equal(invoker.requests.length, 2);
      assert.ok(invoker.requests[1].input.startsWith(`${invoker.requests[0].input}\n`));
      assert.match(readFileSync(join(workbench, "independent-review-attempt-1.errors.txt"), "utf8"), /evidenceReferences must name at least one record/);
      assert.equal(JSON.parse(readFileSync(join(workbench, "independent-review.json"), "utf8")).outcome, "CONCUR");
      if (outcome.status === "READY") assert.deepEqual(verifyLaneBPullRequest(reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() })), prBody(outcome.receiptBlock)).ok, true);
    } finally {
      rmSync(workbench, { recursive: true, force: true });
    }
  });
});

test("Lane B retains both invalid outputs and fails without a review or receipt", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "working-tree" }));
    const workbench = mkdtempSync(join(tmpdir(), "open-evora-lane-b-workbench-"));
    try {
      const invalid = withFinding(unit.reviewerInput, "CLEC_VIOLATION");
      invalid.findings[0].evidenceReferences = [];
      const invoker = new RecordingInvoker(() => JSON.stringify(invalid));
      const outcome = prepareLaneBReview(unit, invoker, workbench);
      assert.equal(outcome.status, "REVIEW_FAILED");
      if (outcome.status === "REVIEW_FAILED") assert.equal(outcome.failedCheck, "INDEPENDENT_REVIEW_OUTPUT_INVALID");
      assert.equal(invoker.requests.length, 2);
      assert.deepEqual(readdirSync(workbench).sort(), [
        "independent-review-attempt-1.errors.txt", "independent-review-attempt-1.stdout.txt",
        "independent-review-attempt-2.errors.txt", "independent-review-attempt-2.stdout.txt", "reviewer-input.json",
      ]);
    } finally {
      rmSync(workbench, { recursive: true, force: true });
    }
  });
});

test("preparation yields no receipt for a non-CONCUR, malformed or self-asserted review", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "working-tree" }));
    const workbench = mkdtempSync(join(tmpdir(), "open-evora-lane-b-workbench-"));
    try {
      const nonConcurInvoker = new RecordingInvoker(() => JSON.stringify(withFinding(unit.reviewerInput, "CLEC_VIOLATION")));
      const notConcur = prepareLaneBReview(unit, nonConcurInvoker, workbench);
      assert.equal(notConcur.status, "NOT_CONCUR");
      assert.equal(nonConcurInvoker.requests.length, 1);
      for (const stdout of ['{"reviewed": true}', "Reviewed: true", JSON.stringify({ ...concur(unit.reviewerInput), signalDispositions: [] })]) {
        const outcome = prepareLaneBReview(unit, new RecordingInvoker(() => stdout), workbench);
        assert.equal(outcome.status, "REVIEW_FAILED", stdout);
      }
      assert.equal(readdirSync(workbench).includes("pr-receipt.md"), false);
    } finally {
      rmSync(workbench, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Context-free CLEC precheck: cross-layer internal IDs fail before any review.

/** A CONCUR review that validates against the package, dispositioning every signal (blockers included) as `disposition`. */
function waiverAttempt(pkg: ReviewerInputPackage, disposition: "SUPPORTED" | "NOT_APPLICABLE"): Review {
  const review = concur(pkg);
  review.signalDispositions.forEach((entry, i) => {
    Object.assign(entry, { disposition, evidenceReferences: disposition === "SUPPORTED" ? [pkg.signals[i].signal.subjectId] : [] });
  });
  return review;
}

/** The changed records carry `blocker`: preparation never invokes the reviewer, and no receipt or N/A passes the check. */
function assertContextFreeBlocked(fixture: Fixture, base: string, blocker: RegExp): void {
  const prepared = reviewRequired(fixture.unit(base, { kind: "working-tree" }));
  const workbench = mkdtempSync(join(tmpdir(), "open-evora-lane-b-workbench-"));
  try {
    const invoker = new RecordingInvoker(() => JSON.stringify(waiverAttempt(prepared.reviewerInput, "SUPPORTED")));
    const outcome = prepareLaneBReview(prepared, invoker, workbench);
    assert.equal(outcome.status, "REVIEW_FAILED");
    if (outcome.status === "REVIEW_FAILED") {
      assert.equal(outcome.failedCheck, "CLEC_CONTEXT_FREE_BLOCK");
      assert.match(outcome.message, blocker);
    }
    assert.equal(invoker.requests.length, 0);
    assert.deepEqual(readdirSync(workbench), [], "no reviewer input, review or receipt is written");
  } finally {
    rmSync(workbench, { recursive: true, force: true });
  }

  const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
  for (const review of [waiverAttempt(unit.reviewerInput, "SUPPORTED"), waiverAttempt(unit.reviewerInput, "NOT_APPLICABLE")]) {
    // The receipt is otherwise exact and its review validates: only the precheck rejects it.
    assert.deepEqual(validateIndependentReview(review, unit.reviewerInput).errors, []);
    assert.equal(review.outcome, "CONCUR");
    assertFails(unit, bodyWith(receiptFor(unit, review)), "CLEC_CONTEXT_FREE_BLOCK", blocker);
  }
  for (const body of [prBody("N/A"), "## Summary\n\nNo section.", ""]) assertFails(unit, body, "CLEC_CONTEXT_FREE_BLOCK", blocker);
}

test("a direct EVD update embedding a PRB ID is blocked before review, and no receipt waives it", () => {
  withFixture((fixture, base) => {
    fixture.record(evidence("EVD-B", ["SRC-B"], "Versão candidata, ligada a PRB-0001."));
    assertContextFreeBlocked(fixture, base, /CLEC-SIG-\d{4} PRB_ID_IN_EVD_TEXT EVD-B observation\.summary: "PRB-0001"/);
  });
});

test("a direct SRC update embedding a canonical record ID is blocked before review, and no receipt waives it", () => {
  withFixture((fixture, base) => {
    fixture.record(source("SRC-B", "Fonte B, ver EVD-000001"));
    assertContextFreeBlocked(fixture, base, /CLEC-SIG-\d{4} SRC_RECORD_ID_IN_TEXT SRC-B name: "EVD-000001"/);
  });
});

test("a historical blocker outside the changed records never blocks the change, even within its evidence context", () => {
  withFixture((fixture) => {
    fixture.record(evidence("EVD-A", ["SRC-A"], "Muitas reclamações registadas em 2025, ver PRB-0001."));
    const base = fixture.commit("historical coupling already on main");
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    assert.ok(unit.reviewerInput.evidenceContext.some((record) => record.id === "EVD-A"));
    assert.ok(unit.reviewerInput.signals.every(({ signal }) => signal.subjectId === "PRB-NEW"));
    const result = verifyLaneBPullRequest(unit, bodyWith(receiptFor(unit, concur(unit.reviewerInput))));
    assert.equal(result.ok, true, result.ok ? "" : result.errors.join("; "));
  });
});

test("the default Lane B workbench location is inside the gitignored research workbench", () => {
  const unit = { status: "REVIEW_REQUIRED", baseGitSha: "a".repeat(40), reviewerInputFingerprint: "b".repeat(64) } as ReviewRequired;
  const dir = defaultLaneBWorkbenchDir(realRepoRoot, unit);
  assert.doesNotThrow(() => assertWorkbenchBoundary(dir));
  assert.ok(dir.startsWith(join(realRepoRoot, ".research-workbench")));
});

// ---------------------------------------------------------------------------
// CLI check entry point, as CI runs it.

function runCheck(fixture: Fixture, args: string[]): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, "check", ...args], { cwd: fixture.root, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test("the check CLI reads the PR body from the GitHub event file and measures from the merge base", () => {
  withFixture((fixture, base) => {
    const mainBranch = fixture.git("rev-parse", "--abbrev-ref", "HEAD");
    fixture.git("checkout", "-q", "-b", "direct-change");
    addProblemWithSignal(fixture);
    const head = fixture.commit("direct change");
    fixture.git("checkout", "-q", mainBranch);
    fixture.write("docs/notes.md", "# Main moved\n");
    const movedMain = fixture.commit("main moved");

    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: head }));
    const eventDir = mkdtempSync(join(tmpdir(), "open-evora-lane-b-event-"));
    const eventPath = join(eventDir, "event.json");
    const writeEvent = (body: string | null): void => writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { sha: movedMain }, head: { sha: head }, body } }));
    try {
      writeEvent(prBody("N/A"));
      const missing = runCheck(fixture, ["--event-path", eventPath]);
      assert.equal(missing.status, 1);
      assert.match(missing.output, /FAILED \[RECEIPT_MISSING\]/);

      writeEvent(bodyWith(receiptFor(unit, concur(unit.reviewerInput))));
      const passed = runCheck(fixture, ["--event-path", eventPath]);
      assert.equal(passed.status, 0, passed.output);
      assert.match(passed.output, /^PASS: independent review CONCUR/m);
    } finally {
      rmSync(eventDir, { recursive: true, force: true });
    }
  });
});

test("the prepare and check CLIs fail a context-free blocker before any reviewer process runs, whatever the receipt", () => {
  withFixture((fixture, base) => {
    fixture.record(evidence("EVD-B", ["SRC-B"], "Versão candidata, ligada a PRB-0001."));
    const stubDir = mkdtempSync(join(tmpdir(), "open-evora-lane-b-stub-"));
    const stub = join(stubDir, "reviewer.cjs");
    const marker = join(stubDir, "invoked");
    writeFileSync(stub, `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "");\nprocess.stdout.write("{}");\n`);
    try {
      const prepared = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, "prepare", "--base", base], {
        cwd: fixture.root,
        encoding: "utf8",
        env: { ...process.env, RESEARCH_AI_COMMAND: process.execPath, RESEARCH_AI_ARGS: stub },
      });
      assert.equal(prepared.status, 1, prepared.stdout);
      assert.match(prepared.stderr, /^FAILED \[CLEC_CONTEXT_FREE_BLOCK\]: .*\n  CLEC-SIG-\d{4} PRB_ID_IN_EVD_TEXT EVD-B observation\.summary: "PRB-0001"/m);
      assert.equal(readdirSync(stubDir).includes("invoked"), false, "the reviewer command never ran");
      assert.equal(prepared.stdout.includes(RECEIPT_BEGIN), false);

      const head = fixture.commit();
      const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: head }));
      const bodyFile = join(stubDir, "body.md");
      writeFileSync(bodyFile, bodyWith(receiptFor(unit, waiverAttempt(unit.reviewerInput, "SUPPORTED"))));
      const checked = runCheck(fixture, ["--base", base, "--head", head, "--body-file", bodyFile]);
      assert.equal(checked.status, 1);
      assert.match(checked.output, /FAILED \[CLEC_CONTEXT_FREE_BLOCK\]/);
    } finally {
      rmSync(stubDir, { recursive: true, force: true });
    }
  });
});
