import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { RecordFields, RecordSchema } from "../core/types.ts";
import { stringifyRecordYaml } from "../core/yaml.ts";
import { sha256Hex } from "../core/fingerprint.ts";
import { validateIndependentReview } from "./independent-review.ts";
import { serializeReviewerInput, type ReviewerInputPackage } from "./reviewer-input.ts";
import { verifyResearchReviewAttestation } from "./cli.ts";
import { ReviewUnitError, resolveReviewUnit, type ReviewHead, type CanonicalReviewUnit } from "./review-unit.ts";

const researchReviewCliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));

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
  readonly root = mkdtempSync(join(tmpdir(), "open-evora-review-unit-test-"));

  constructor() {
    this.git("init", "-q");
    this.git("config", "core.autocrlf", "false");
    for (const [file, schema] of Object.entries(SCHEMAS)) this.write(`research/schemas/${file}`, `${JSON.stringify(schema, null, 2)}\n`);
    for (const record of [
      source("SRC-A", "Fonte A"),
      source("SRC-B", "Fonte B"),
      source("SRC-UNRELATED", "Fonte sem relação"),
      evidence("EVD-A", ["SRC-A"], "Muitas reclamações de moradores registadas em 2025."),
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

  unit(baseGitSha: string, head: ReviewHead): CanonicalReviewUnit {
    return resolveReviewUnit({ repoRoot: this.root, baseGitSha, head });
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

type ReviewRequired = Extract<CanonicalReviewUnit, { status: "REVIEW_REQUIRED" }>;

function reviewRequired(unit: CanonicalReviewUnit): ReviewRequired {
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

// ---------------------------------------------------------------------------
// Changed-record detection from Git.

test("changes outside canonical record files need no semantic review", () => {
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

test("a schema-only research change needs no semantic review", () => {
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

test("deleting a canonical record is unsupported and fails closed", () => {
  withFixture((fixture, base) => {
    fixture.remove(recordPath("EVD-UNRELATED"));
    const unit = fixture.unit(base, { kind: "commit", sha: fixture.commit() });
    assert.deepEqual(unit, { status: "UNSUPPORTED_DELETION", baseGitSha: base, paths: ["research/evidence/EVD-UNRELATED.yaml"] });
    assert.match(verifyResearchReviewAttestation(unit, null).join("\n"), /EVD-UNRELATED/);
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
    assert.throws(() => fixture.unit(base, { kind: "commit", sha: head }), ReviewUnitError);
  });
});

test("the base must be an existing full commit SHA", () => {
  withFixture((fixture, base) => {
    assert.throws(() => fixture.unit(base.slice(0, 12), { kind: "working-tree" }), ReviewUnitError);
    assert.throws(() => fixture.unit("0".repeat(40), { kind: "working-tree" }), ReviewUnitError);
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
    const scratch = mkdtempSync(join(tmpdir(), "open-evora-review-unit-scratch-"));
    const saved = { TMPDIR: process.env.TMPDIR, TEMP: process.env.TEMP, TMP: process.env.TMP };
    try {
      Object.assign(process.env, { TMPDIR: scratch, TEMP: scratch, TMP: scratch });
      addProblemWithSignal(fixture);
      reviewRequired(fixture.unit(base, { kind: "working-tree" }));
      assert.deepEqual(readdirSync(scratch), []);
      fixture.write("research/problems/PRB-BROKEN.yaml", "problem_id: [unterminated\n");
      assert.throws(() => fixture.unit(base, { kind: "working-tree" }), ReviewUnitError);
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

/** A direct update of EVD-A, whose only Source is SRC-A. */
function changeEvidenceA(fixture: Fixture): void {
  fixture.record(evidence("EVD-A", ["SRC-A"], "Muitas reclamações de moradores registadas no segundo trimestre de 2025."));
}

test("support for the Source of a changed EVD is read from the base commit, not from the head or checkout", () => {
  withSupportedBase(["A fonte regista reclamações sobre atrasos em 2025."], (fixture, base) => {
    changeEvidenceA(fixture);
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

test("a PRB-only change receives no support for the Sources of the unchanged EVD it links", () => {
  withSupportedBase(["A fonte regista reclamações sobre atrasos em 2025."], (fixture, base) => {
    addProblemWithSignal(fixture);
    const pkg = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit("direct change") })).reviewerInput;
    assert.ok(pkg.evidenceContext.some((record) => record.id === "SRC-A"), "SRC-A reaches the reviewer through the unchanged EVD-A");
    assert.equal(pkg.sourceVerificationContext, undefined);
    assert.equal(serializeReviewerInput(pkg).includes("A fonte regista reclamações sobre atrasos em 2025."), false);
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
      assert.match(verifyResearchReviewAttestation(unit, null).join("\n"), /must be changed separately/);
    }
    // Measured from an older base the SRC-A update joins the canonical side; the refusal is the same.
    assert.equal(fixture.unit(first, { kind: "working-tree" }).status, "SOURCE_VERIFICATION_NOT_SEPARATE");
  });
});

test("a support-only change has no canonical change and needs no semantic attestation", () => {
  withSupportedBase(["A fonte regista reclamações sobre atrasos em 2025."], (fixture, base) => {
    writeSupport(fixture, "SRC-A", ["A fonte regista reclamações sobre atrasos no segundo trimestre de 2025."]);
    writeSupport(fixture, "SRC-B", ["Outra afirmação verificada."]);
    const unit = fixture.unit(base, { kind: "commit", sha: fixture.commit("support-only change") });
    assert.deepEqual(unit, { status: "NO_CANONICAL_CHANGE", baseGitSha: base });
    assert.equal(unit.status, "NO_CANONICAL_CHANGE");
  });
});

test("invalid applicable support in the base fails closed; invalid support for an unreached Source does not", () => {
  withFixture((fixture) => {
    fixture.record({ ...source("SRC-A", "Fonte A"), ...ELIGIBLE_SOURCE, licensing: { reuse: "prohibited" } });
    writeSupport(fixture, "SRC-A", ["A fonte regista reclamações."]);
    writeSupport(fixture, "SRC-UNRELATED", []);
    const base = fixture.commit("invalid support on main");

    changeEvidenceA(fixture);
    assert.throws(
      () => fixture.unit(base, { kind: "working-tree" }),
      /SOURCE_VERIFICATION_SUPPORT: applicable Source Verification Support is invalid: source-verifications\/SRC-A\.yaml: SRC-A has licensing\.reuse "prohibited"/
    );

    // Reached only through the unchanged EVD-A, the same support is not applicable to a PRB-only change.
    fixture.git("checkout", "-q", "--", recordPath("EVD-A"));
    addProblemWithSignal(fixture);
    assert.equal(reviewRequired(fixture.unit(base, { kind: "working-tree" })).reviewerInput.sourceVerificationContext, undefined);

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
      changeEvidenceA(fixture);
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
test("a direct semantic review attestation passes only for the reconstructed base, records, input and CONCUR result", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const head = fixture.commit();
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: head }));
    const payload = {
      schemaVersion: "1" as const,
      reviewerProfile: "REFERENCE" as const,
      outcome: "CONCUR" as const,
      baseGitSha: unit.baseGitSha,
      reviewerInputFingerprint: unit.reviewerInputFingerprint,
      changedRecords: structuredClone(unit.changedRecords),
      independentReview: concur(unit.reviewerInput),
    };
    const attestation = { ...payload, integritySha256: sha256Hex(payload) };
    assert.deepEqual(verifyResearchReviewAttestation(unit, attestation), []);

    const staleRecord = structuredClone(attestation);
    staleRecord.changedRecords[0].blob = "0".repeat(40);
    assert.match(verifyResearchReviewAttestation(unit, staleRecord).join("\n"), /changed-record set or content is stale/);

    const staleInput = structuredClone(attestation);
    staleInput.reviewerInputFingerprint = "0".repeat(64);
    assert.match(verifyResearchReviewAttestation(unit, staleInput).join("\n"), /fingerprint is stale/);

    const nonConcur = structuredClone(attestation);
    nonConcur.independentReview.outcome = "DISAGREEMENT_FOUND";
    assert.ok(verifyResearchReviewAttestation(unit, nonConcur).length > 0);

    fixture.record(problem("PRB-NEW", "Atrasos no serviço são relatados.", ["EVD-A"], ["PRB-OTHER"]));
    const changed = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit("content changed after review") }));
    assert.match(verifyResearchReviewAttestation(changed, attestation).join("\n"), /stale|does not match/i);
  });
});

test("research:review writes only an exact CONCUR attestation and CI ignores PR-body claims", () => {
  withFixture((fixture, base) => {
    addProblemWithSignal(fixture);
    const unit = reviewRequired(fixture.unit(base, { kind: "working-tree" }));
    const attestationPath = join(fixture.root, ".research-review-attestation.json");
    const reviewerDir = mkdtempSync(join(tmpdir(), "open-evora-review-cli-"));
    const reviewer = join(reviewerDir, "reviewer.cjs");
    const invoke = (stdout: string) => {
      writeFileSync(reviewer, `process.stdout.write(${JSON.stringify(stdout)});\n`, "utf8");
      return spawnSync(process.execPath, ["--experimental-strip-types", researchReviewCliPath, "--base", base], {
        cwd: fixture.root,
        encoding: "utf8",
        env: { ...process.env, RESEARCH_AI_COMMAND: process.execPath, RESEARCH_AI_ARGS: reviewer },
      });
    };
    try {
      const invalid = invoke("not-json");
      assert.equal(invalid.status, 1);
      assert.equal(existsSync(attestationPath), false, "malformed output cannot produce an attestation");

      const nonConcur = invoke(JSON.stringify(withFinding(unit.reviewerInput, "CLEC_VIOLATION")));
      assert.equal(nonConcur.status, 1);
      assert.equal(existsSync(attestationPath), false, "a valid non-CONCUR cannot produce an attestation");

      const concurResult = invoke(JSON.stringify(concur(unit.reviewerInput)));
      assert.equal(concurResult.status, 0, concurResult.stderr);
      const attestation = JSON.parse(readFileSync(attestationPath, "utf8"));
      assert.equal(attestation.schemaVersion, "1");
      assert.equal(attestation.reviewerProfile, "REFERENCE");
      assert.equal(attestation.outcome, "CONCUR");
      assert.equal(attestation.baseGitSha, unit.baseGitSha);
      assert.equal(attestation.reviewerInputFingerprint, unit.reviewerInputFingerprint);
      assert.equal(attestation.independentReview.outcome, "CONCUR");
      assert.match(attestation.integritySha256, /^[0-9a-f]{64}$/);
      assert.deepEqual(verifyResearchReviewAttestation(unit, attestation), []);
      assert.equal(existsSync(join(fixture.root, ".research-workbench", "review-lifecycle")), false);
      assert.equal(existsSync(join(fixture.root, ".research-review")), false);

      // Missing attestation fails even if the event body contains arbitrary claims.
      const attestationText = readFileSync(attestationPath, "utf8");
      fixture.remove(".research-review-attestation.json");
      const recordsOnlyHead = fixture.commit("canonical record without attestation");
      const eventDir = mkdtempSync(join(tmpdir(), "open-evora-review-event-"));
      const eventPath = join(eventDir, "event.json");
      const runCheck = (body: string | null, eventHead: string, eventBase = base) => {
        writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { sha: eventBase }, head: { sha: eventHead }, body } }));
        return spawnSync(process.execPath, ["--experimental-strip-types", researchReviewCliPath, "--event-path", eventPath], {
          cwd: fixture.root,
          encoding: "utf8",
        });
      };
      try {
        const missing = runCheck("arbitrary PR body text", recordsOnlyHead);
        assert.equal(missing.status, 1);
        assert.match(missing.stderr, /ATTESTATION_MISSING_OR_INVALID/);

        // A local commit of the reviewed bytes preserves the binding; CI uses
        // the committed attestation and never needs a claim from the PR body.
        fixture.write(".research-review-attestation.json", attestationText);
        const head = fixture.commit("add exact review attestation");
        const arbitraryBody = runCheck("## Research semantic review\nplain text unrelated to review", head);
        assert.equal(arbitraryBody.status, 0, arbitraryBody.stderr);

        // A noncanonical change does not need a semantic attestation.
        fixture.write("docs/notes.md", "# Noncanonical change\n");
        const noncanonicalHead = fixture.commit("docs-only change");
        const noReview = runCheck("arbitrary prose", noncanonicalHead, head);
        assert.equal(noReview.status, 0, noReview.stderr);

        // Adding a prohibited path blocks the publication check even if the
        // review result itself is valid.
        fixture.write(".research-workbench/cycle/private.txt", "local-only");
        const unsafeHead = fixture.commit("prohibited workbench material");
        const unsafe = runCheck("arbitrary text", unsafeHead);
        assert.equal(unsafe.status, 1);
      } finally {
        rmSync(eventDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(reviewerDir, { recursive: true, force: true });
    }
  });
});

test("research:review rejects a context-free layer violation before invoking the reviewer", () => {
  withFixture((fixture, base) => {
    fixture.record(evidence("EVD-B", ["SRC-B"], "A nota refere PRB-0001."));
    const reviewerDir = mkdtempSync(join(tmpdir(), "open-evora-review-blocker-"));
    const reviewer = join(reviewerDir, "reviewer.cjs");
    const marker = join(reviewerDir, "invoked");
    writeFileSync(reviewer, `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "called"); process.stdout.write("{}");\n`);
    try {
      const result = spawnSync(process.execPath, ["--experimental-strip-types", researchReviewCliPath, "--base", base], {
        cwd: fixture.root,
        encoding: "utf8",
        env: { ...process.env, RESEARCH_AI_COMMAND: process.execPath, RESEARCH_AI_ARGS: reviewer },
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /CONTEXT_FREE_BLOCK/);
      assert.equal(existsSync(marker), false);
      assert.equal(existsSync(join(fixture.root, ".research-review-attestation.json")), false);
    } finally {
      rmSync(reviewerDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Reverse EVD→PRB impact (CRR-02).

test("an EVD-only change includes the unchanged linked PRB as a review subject", () => {
  withFixture((fixture, base) => {
    fixture.record(evidence("EVD-A", ["SRC-A"], "Reclamações de moradores registadas apenas em 2024."));
    const head = fixture.commit();
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: head }));
    assert.deepEqual(unit.changedRecords.map(({ id }) => id), ["EVD-A"]);
    assert.deepEqual(unit.reviewerInput.impactedSubjects?.map(({ id, changedEvidenceIds }) => [id, changedEvidenceIds]), [["PRB-0001", ["EVD-A"]]]);
    // CI reconstructs the identical package, impacted subject included.
    assert.equal(reviewRequired(fixture.unit(base, { kind: "commit", sha: head })).reviewerInputFingerprint, unit.reviewerInputFingerprint);

    const review = concur(unit.reviewerInput);
    for (const entry of review.signalDispositions) Object.assign(entry, { disposition: "NOT_APPLICABLE", evidenceReferences: [] });
    review.findings = [{
      findingId: "CLEC-FND-0001",
      recordId: "PRB-0001",
      field: "problem_statement",
      claim: "Atrasos relatados",
      dimension: "temporal_precision",
      kind: "CLEC_VIOLATION",
      severity: "BLOCKING",
      reason: "A EVD-A revista limita as reclamações a 2024; o problema não indica o período.",
      evidenceReferences: ["EVD-A"],
      correctionDirection: "Indicar o período documentado pela evidência ligada.",
      relatedSignalIds: [],
    }];
    review.outcome = "DISAGREEMENT_FOUND";
    assert.equal(unit.reviewerInput.impactedSubjects?.length, 1);
    assert.deepEqual(validateIndependentReview(review, unit.reviewerInput).errors, []);
  });
});

test("an EVD change no PRB links adds no impacted subject", () => {
  withFixture((fixture, base) => {
    fixture.record(evidence("EVD-B", ["SRC-B"], "Versão revista."));
    const unit = reviewRequired(fixture.unit(base, { kind: "commit", sha: fixture.commit() }));
    assert.equal("impactedSubjects" in unit.reviewerInput, false);
    assert.equal(serializeReviewerInput(unit.reviewerInput).includes("impactedSubjects"), false);
  });
});
