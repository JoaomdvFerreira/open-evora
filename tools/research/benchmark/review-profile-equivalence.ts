#!/usr/bin/env node
/**
 * Non-operational equivalence benchmark between the two semantic-reviewer
 * input profiles: REFERENCE (reviewer-input.ts, the package every review
 * route uses) and REDUCED (reduced-reviewer-input.ts, used by no route).
 * CRR-07 is a non-operational benchmark. The owner-approved staged amendment
 * runs one REFERENCE + one REDUCED execution per case initially; repeat only
 * ambiguous, inconsistent, discrepant or tooling/reviewer-unstable cases, up
 * to three executions per profile for that case.
 *
 * Both profiles are built from one ReviewerInputSource per case, so they
 * frame the same semantic change. A run is an experiment, never a semantic
 * attempt: this module never reads or writes the owner-controlled review
 * lifecycle (review-lifecycle.ts), never writes a review artifact,
 * and never changes which profile Lane A, direct canonical review or the Gate use. Each run is
 * one fresh reviewer process with the same structural retry rule as
 * independent-review-invocation.ts (one technical retry on the same frozen
 * prompt, never on a valid result).
 *
 * Usage (from any directory; reviewer runtime as for direct canonical review, RESEARCH_AI_*):
 *   node tools/research/benchmark/review-profile-equivalence.ts prepare --repo <dir>
 *   node tools/research/benchmark/review-profile-equivalence.ts run --repo <dir> --case <id> --profile <REFERENCE|REDUCED> --run <n> --out <dir>
 *   node tools/research/benchmark/review-profile-equivalence.ts evaluate --results <dir> --out <file.json>
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { LocalCommandAiInvoker, loadLocalCommandAiInvokerConfigFromEnv, type AiInvoker } from "../ai/invoker.ts";
import { loadCorpusIndex } from "../core/corpus.ts";
import { sha256Hex } from "../core/fingerprint.ts";
import { loadSourceVerifications } from "../core/source-verifications.ts";
import type { RecordFields } from "../core/types.ts";
import { loadCandidates } from "../integration/candidate-loader.ts";
import { prepareCanonicalIntegrationReview } from "../integration/canonical-integration-review.ts";
import { DIRECT_REVIEW_FRAMING, resolveReviewUnit } from "../review/review-unit.ts";
import { contextFreeBlockers } from "../language/signals.ts";
import { asValidatedIndependentReview, validateIndependentReview, validateReducedIndependentReview } from "../review/independent-review.ts";
import { buildReducedReviewerInputPackage, ReducedReviewContextFreeBlockError, serializeReducedReviewerInput } from "../review/reduced-reviewer-input.ts";
import { change, corpus, evd, EVD_A_BROAD, EVD_A_NARROW, EVD_C, EVD_UNRELATED, problem, PRB_UNRELATED } from "../review/reduced-test-fixtures.ts";
import { buildReviewerInputPackage, serializeReviewerInput, type ReviewerInputSource } from "../review/reviewer-input.ts";
import { buildReducedReviewerPrompt, buildReviewerPrompt, buildReviewerStructuralRetryPrompt } from "../review/reviewer-prompt.ts";
import type { IndependentReviewResult, ReviewFinding } from "../review/types.ts";

export type BenchmarkProfile = "REFERENCE" | "REDUCED";
export const BENCHMARK_PROFILES: readonly BenchmarkProfile[] = ["REFERENCE", "REDUCED"];
export const INITIAL_RUNS_PER_PROFILE = 1;
export const MAX_RUNS_PER_PROFILE = 3;

/**
 * One expected material defect, fixed before any reviewer output exists. A
 * run detects it when a BLOCKING finding on `recordId` sits on a field
 * matching `field` and its claim, reason or correction matches `text`.
 */
export interface ExpectedDefect {
  defectId: string;
  recordId: string;
  description: string;
  field: string;
  text: string;
}

export interface BenchmarkCase {
  caseId: string;
  origin: string;
  /** DETECT: every expected defect should block. CONCUR: control, any blocker is a false-blocker candidate. */
  expectation: "DETECT" | "CONCUR";
  expectedDefects: ExpectedDefect[];
}

// ---------------------------------------------------------------------------
// Frozen cases
// ---------------------------------------------------------------------------

const PR191_BASE = "fd692cb1ffe10902922796fb1eb291b42dcb0420";
const PR191_HEAD = "e95fcf5b2b2c83c4d43ffbf84bb8b975025e7480";
const PR191_PROBLEM_PATH = "research/problems/PRB-0001.yaml";
/**
 * CASE191_RECONSTRUCTION_ACCEPTED_ON_BEST_AVAILABLE_HISTORICAL_EVIDENCE.
 * The reconstructed pre-correction fingerprint matches the only recorded
 * attempt-1 prefix (all 12 hex characters); attempt 2 independently reproduced
 * its full historical fingerprint, validating this reconstruction method.
 */
export const PR191_RECONSTRUCTION_ACCEPTANCE = "CASE191_RECONSTRUCTION_ACCEPTED_ON_BEST_AVAILABLE_HISTORICAL_EVIDENCE";
export const PR191_RECORDED_ATTEMPT_1_FINGERPRINT_PREFIX = "8e7ebdb9683c";
export const PR191_RECONSTRUCTED_ATTEMPT_1_FINGERPRINT = "8e7ebdb9683c1b9c3cca44d62dd15bf95a090e3940dd4359e8c9e42d06b11b58";
/** Git blob of the reconstructed pre-correction PRB-0001. */
export const PR191_PRE_CORRECTION_BLOB = "623e322099d15080905727a758aa987901cd087b";

/**
 * The PRB-0001 corrections made between the two PR #191 direct canonical review attempts, as
 * [corrected, original] text, in reverse order of application. Undoing them
 * on the merged PRB-0001 restores the attempt-1 content. Never canonical.
 */
export const PR191_PRE_CORRECTION_INVERSE: readonly (readonly [string, string, number])[] = [
  ["publicado em julho de 2026", "publicado de julho de 2026", 2],
  ["tenha sido publicado", "esteja datado", 1],
  ["foi publicado", "está datado", 1],
  ["uma preocupação para residentes que dependem do serviço, citando as linhas e os horários.", "uma preocupação para residentes que dependem do serviço, com referência a linhas e horários no Plano de Desenvolvimento Social.", 1],
  ["o Plano de Desenvolvimento Social aponta a falta de uma rede de transportes\n  públicos eficaz, citando as linhas e os horários.", "o Plano de Desenvolvimento Social refere linhas e horários ao apontar a\n  falta de uma rede de transportes públicos eficaz.", 1],
  ["estudantes da Universidade de Évora", "estudantes universitários de um campus específico", 1],
  ["com referência a linhas e horários no Plano de Desenvolvimento Social.", "incluindo\n      referências a linhas e horários específicos.", 1],
  ["o Plano de Desenvolvimento Social refere linhas e horários ao apontar a\n  falta de uma rede de transportes públicos eficaz.", "a articulação entre linhas\n  e horários é uma preocupação expressa no Plano de Desenvolvimento Social.", 1],
  [
    "O transporte flexível documentado em EVD-000002 funciona como evidência\n    de limite e de estado atual, não como linha independente de corroboração.\n    A descrição da variação entre a oferta diurna e a oferta à noite, aos fins\n    de semana e nos feriados no mesmo registo mantém o seu papel de suporte.",
    "EVD-000002 é totalmente excluído desta avaliação de independência: documenta\n    uma resposta existente de transporte flexível e funciona como evidência de\n    limite e de estado atual, não como uma linha de corroboração da afirmação\n    sobre a variação da utilidade do serviço.",
    1,
  ],
  ["outubro de 2026", "agosto de 2026", 4],
  ["julho de 2026", "junho de 2026", 2],
  ["a carreira 25 (EVD-000157) foram", "a carreira 25 (EVD-000157), e os canais atuais do TREVO para consultar\n      linhas e horários foram", 1],
  [
    "A procura considerou as edições de 2022 e 2023 dos relatórios anuais\n      da Autoridade de Transportes municipal (EVD-000117) e o transporte\n      flexível documentado em EVD-000002 para locais de baixa procura.",
    "Foram verificadas diretamente as edições de 2022 e 2023 dos relatórios\n      anuais da Autoridade de Transportes municipal (EVD-000117), bem como os\n      horários públicos do TREVO e a existência de transporte flexível para\n      locais de baixa procura.",
    1,
  ],
  [
    "o registo apresenta apenas a média mensal de passageiros dos lotes 1 e 2\n    e explicita que ela não estabelece a proporção de estudantes ou jovens\n    entre passageiros nem descreve a composição demográfica da rede urbana\n    TREVO em Évora.",
    "o próprio registo alerta\n    explicitamente contra a interpretação da proporção regional de estudantes e\n    jovens passageiros da ATAC como se fosse a distribuição demográfica dos\n    passageiros da rede urbana TREVO em Évora.",
    1,
  ],
  [
    "O registo apresenta a média mensal de passageiros dos lotes 1 e 2;\n      essa média não estabelece a proporção de estudantes ou jovens entre\n      passageiros nem descreve a composição demográfica da rede urbana TREVO\n      em Évora.",
    "O próprio registo\n      alerta que a distribuição regional de estudantes e jovens passageiros da\n      ATAC não deve ser interpretada como representativa dos passageiros da rede\n      urbana TREVO em Évora.",
    1,
  ],
  ["efetivos de deslocação longos, segundo os relatos.", "de deslocação longos para o campus situado no parque industrial.", 1],
];

/** Applies exact [current, original, count] replacements in order; any other occurrence count fails. */
export function applyInverseReplacements(text: string, inverse: readonly (readonly [string, string, number])[]): string {
  let out = text;
  for (const [current, original, expected] of inverse) {
    const count = out.split(current).length - 1;
    if (count !== expected) throw new Error(`expected ${expected} occurrence(s) of ${JSON.stringify(current)}, found ${count}`);
    out = out.split(current).join(original);
  }
  return out;
}

export const BENCHMARK_CASES: readonly BenchmarkCase[] = [
  {
    caseId: "PR191-PRE-CORRECTION",
    origin: `PR #191 direct canonical review attempt-1 content: base ${PR191_BASE}, head ${PR191_HEAD} with PRB-0001 reconstructed (blob ${PR191_PRE_CORRECTION_BLOB})`,
    expectation: "DETECT",
    expectedDefects: [
      {
        defectId: "PR191-D1",
        recordId: "PRB-0001",
        description: "decision_basis.consequence.summary places the EVD-000079 campus in the industrial park; EVD-000079 locates the protest only near the Colégio Pedro da Fonseca.",
        field: "^decision_basis\\.consequence\\.summary$",
        text: "parque industrial|industrial park",
      },
      {
        defectId: "PR191-D2",
        recordId: "PRB-0001",
        description: "decision_basis.limitations / scope.geography describe EVD-000028 as warning about a regional student/young-passenger proportion it no longer reports (it now holds only the lots 1-2 monthly average).",
        field: "^decision_basis\\.(limitations|scope\\.geography)$",
        text: "EVD-000028|propor[cç][aã]o regional|distribui[cç][aã]o regional|regional (student|proportion|distribution)",
      },
      {
        defectId: "PR191-D3",
        recordId: "PRB-0001",
        description: "decision_basis.contradiction_search.summary uses TREVO public timetables / current channels as checked material with no EVD or SRC in the package.",
        field: "^decision_basis\\.contradiction_search\\.summary$",
        text: "TREVO",
      },
    ],
  },
  {
    caseId: "PR211",
    origin: "PR #211: base 803f86702519ac760df360e045c37027dff431d1, head ee24c52547e94e182e4cb315472dcbd4965b94b0",
    expectation: "DETECT",
    expectedDefects: [
      {
        defectId: "PR211-D1",
        recordId: "PRB-0002",
        description: "investigation.path.delimitation.summary places the shelterless stops in the Centro Histórico; no linked EVD (000010/011/016/122/123) carries that place.",
        field: "^investigation\\.path\\.delimitation\\.summary$",
        text: "Centro Hist[oó]rico|historic (centre|center)",
      },
    ],
  },
  {
    caseId: "PR204",
    origin: "PR #204: base c7beca7b3bc162d4e2c22d4e4dd246a9979328cc, head 8b3f5da3bf8fc35d55db8a6fc169c5a0e0f886f3",
    expectation: "CONCUR",
    expectedDefects: [],
  },
  {
    caseId: "SYNTHETIC-REVERSE-IMPACT",
    origin: "Invented corpus (review/reduced-test-fixtures.ts): EVD-A narrows from Évora to Malagueira; unchanged PRB-A has no other supporting EVD",
    expectation: "DETECT",
    expectedDefects: [
      {
        defectId: "SYN-D1",
        recordId: "PRB-A",
        description: "Unchanged PRB-A states a municipal (Évora residents) scope that its only supporting EVD, now narrowed to Malagueira, no longer covers.",
        field: ".",
        text: "Malagueira|EVD-A",
      },
    ],
  },
];

const HISTORICAL: Readonly<Record<string, { base: string; head: string; overrides?: (repoRoot: string) => Map<string, string> }>> = {
  "PR191-PRE-CORRECTION": {
    base: PR191_BASE,
    head: PR191_HEAD,
    overrides: (repoRoot) => {
      const merged = git(repoRoot, ["show", `${PR191_HEAD}:${PR191_PROBLEM_PATH}`]).toString("utf8");
      return new Map([[PR191_PROBLEM_PATH, applyInverseReplacements(merged, PR191_PRE_CORRECTION_INVERSE)]]);
    },
  },
  PR211: { base: "803f86702519ac760df360e045c37027dff431d1", head: "ee24c52547e94e182e4cb315472dcbd4965b94b0" },
  PR204: { base: "c7beca7b3bc162d4e2c22d4e4dd246a9979328cc", head: "8b3f5da3bf8fc35d55db8a6fc169c5a0e0f886f3" },
};

/** PRB-A as in the fixtures, but EVD-A is its only SUPPORTS evidence: narrowing EVD-A leaves it broader than its Evidence. */
export const PRB_A_SOLE_SUPPORT: RecordFields = problem(
  "PRB-A",
  "Residentes de Évora relatam atrasos na recolha de resíduos.",
  [{ evidence_id: "EVD-A", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] }],
  {
    investigation: {
      open_questions: [{ question: "A frequência contratual é cumprida?", evidence: ["EVD-C"] }],
      path: { initial_signal: { summary: "Relatos de residentes sobre atrasos.", evidence: ["EVD-A"] } },
    },
    decision_basis: {
      supporting_evidence: ["EVD-A"],
      boundary_evidence: ["EVD-C"],
      contradiction_search: { performed: true, summary: "Procurou-se contradição no contrato.", evidence: ["EVD-C"] },
      scope: { geography: "Évora", population: "residentes", temporal: "2025", bounded: true },
    },
  },
);

/** The synthetic reverse-impact change: invented records only; EVD-A narrows, PRB-A is unchanged. */
export function syntheticReverseImpactSource(): ReviewerInputSource {
  const index = corpus({ evidence: [EVD_A_BROAD, EVD_C, EVD_UNRELATED], problems: [PRB_A_SOLE_SUPPORT, PRB_UNRELATED] });
  return change(index, [evd(EVD_A_NARROW)]);
}

// ---------------------------------------------------------------------------
// Case sources from Git
// ---------------------------------------------------------------------------

function git(repoRoot: string, args: string[], input?: string): Buffer {
  return execFileSync("git", args, { cwd: repoRoot, input, maxBuffer: 256 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
}

function stageTree(repoRoot: string, sha: string, prefix: string, root: string): void {
  const paths = git(repoRoot, ["ls-tree", "-r", "-z", "--name-only", sha, "--", prefix]).toString("utf8").split("\0").filter(Boolean);
  const output = git(repoRoot, ["cat-file", "--batch"], paths.map((path) => `${sha}:${path}\n`).join(""));
  let offset = 0;
  for (const path of paths) {
    const headerEnd = output.indexOf(0x0a, offset);
    const size = Number(output.subarray(offset, headerEnd).toString("utf8").split(" ")[2]);
    const target = join(root, ...path.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, output.subarray(headerEnd + 1, headerEnd + 1 + size));
    offset = headerEnd + 1 + size + 1;
  }
}

/** The Git blob ID of `content`, as `git hash-object` computes it. */
export function gitBlobId(content: string): string {
  const bytes = Buffer.from(content, "utf8");
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

/**
 * The reviewer source of a historical case, built exactly as direct canonical review builds
 * it (same framing and primitives) from the base corpus and the changed
 * head files, with optional head-content overrides. Without overrides the
 * REFERENCE package must reproduce direct canonical review's own fingerprint, or this throws.
 */
export function historicalCaseSource(repoRoot: string, caseId: string): ReviewerInputSource {
  const spec = HISTORICAL[caseId];
  if (!spec) throw new Error(`${caseId} is not a historical case`);
  const unit = resolveReviewUnit({ repoRoot, baseGitSha: spec.base, head: { kind: "commit", sha: spec.head } });
  if (unit.status !== "REVIEW_REQUIRED") throw new Error(`${caseId}: direct canonical review unit is ${unit.status}`);
  const paths = unit.changedRecords.map((record) => record.path).sort();
  const overrides = spec.overrides?.(repoRoot) ?? new Map<string, string>();

  const staging = mkdtempSync(join(tmpdir(), "open-evora-review-benchmark-"));
  try {
    stageTree(repoRoot, spec.base, "research", join(staging, "base"));
    const index = loadCorpusIndex(join(staging, "base", "research"));
    const headRoot = join(staging, "head");
    for (const path of paths) {
      const content = overrides.get(path) ?? git(repoRoot, ["show", `${spec.head}:${path}`]).toString("utf8");
      const target = join(headRoot, ...path.split("/"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
    }
    for (const [path, content] of overrides) {
      if (path === PR191_PROBLEM_PATH && gitBlobId(content) !== PR191_PRE_CORRECTION_BLOB) {
        throw new Error(`${caseId}: reconstructed ${path} is blob ${gitBlobId(content)}, expected ${PR191_PRE_CORRECTION_BLOB}`);
      }
    }
    const loaded = loadCandidates(index, headRoot, paths);
    if (loaded.failures.length > 0) throw new Error(loaded.failures.map((f) => `${f.file}: ${f.message}`).join("; "));
    const review = prepareCanonicalIntegrationReview(spec.base, index, loaded.candidates);
    const source: ReviewerInputSource = {
      baseGitSha: spec.base,
      manifest: DIRECT_REVIEW_FRAMING,
      index,
      candidates: review.candidates,
      deltas: review.deltas,
      validation: review.validation,
      readiness: review.readiness,
      sourceVerifications: loadSourceVerifications(index),
    };
    if (overrides.size === 0 && sha256Hex(buildReviewerInputPackage(source)) !== unit.reviewerInputFingerprint) {
      throw new Error(`${caseId}: benchmark REFERENCE input differs from direct canonical review's reviewer input ${unit.reviewerInputFingerprint}`);
    }
    return source;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

export function caseSource(repoRoot: string, caseId: string): ReviewerInputSource {
  return caseId === "SYNTHETIC-REVERSE-IMPACT" ? syntheticReverseImpactSource() : historicalCaseSource(repoRoot, caseId);
}

// ---------------------------------------------------------------------------
// Profiles and runs
// ---------------------------------------------------------------------------

export type ProfileInput =
  | { status: "READY"; profile: BenchmarkProfile; inputFingerprint: string; promptSha256: string; prompt: string; signalCount: number; validate(value: unknown): string[] }
  /** Deterministic context-free blocker: no reviewer may run for this profile. */
  | { status: "CONTEXT_FREE_BLOCKED"; profile: BenchmarkProfile; message: string };

const sha256Text = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

/** The frozen reviewer input, prompt and validator of one profile for one source. */
export function profileInput(profile: BenchmarkProfile, source: ReviewerInputSource): ProfileInput {
  if (profile === "REFERENCE") {
    const pkg = buildReviewerInputPackage(source);
    const blockers = contextFreeBlockers(pkg.signals);
    if (blockers.length > 0) return { status: "CONTEXT_FREE_BLOCKED", profile, message: blockers.map((b) => `${b.signalId} ${b.signal.code}`).join(", ") };
    const prompt = buildReviewerPrompt(serializeReviewerInput(pkg));
    return { status: "READY", profile, inputFingerprint: sha256Hex(pkg), promptSha256: sha256Text(prompt), prompt, signalCount: pkg.signals.length, validate: (value) => validateIndependentReview(value, pkg).errors };
  }
  let pkg;
  try {
    pkg = buildReducedReviewerInputPackage(source);
  } catch (error) {
    if (error instanceof ReducedReviewContextFreeBlockError) return { status: "CONTEXT_FREE_BLOCKED", profile, message: error.message };
    throw error;
  }
  const prompt = buildReducedReviewerPrompt(serializeReducedReviewerInput(pkg));
  return { status: "READY", profile, inputFingerprint: sha256Hex(pkg), promptSha256: sha256Text(prompt), prompt, signalCount: pkg.signals.length, validate: (value) => validateReducedIndependentReview(value, pkg).errors };
}

export type RunInvocation =
  | { status: "VALID"; review: IndependentReviewResult; technicalCalls: 1 | 2; firstCallErrors: string[] }
  | { status: "FAILED"; failedCheck: string; message: string; technicalCalls: number };

/** One experimental reviewer execution: the structural retry rule of independent-review-invocation.ts, no files, no lifecycle. */
export function runReviewer(invoker: AiInvoker, input: Extract<ProfileInput, { status: "READY" }>): RunInvocation {
  let prompt = input.prompt;
  let firstCallErrors: string[] = [];
  for (const technicalCall of [1, 2] as const) {
    const result = invoker.invoke({ role: "INDEPENDENT_REVIEWER", input: prompt });
    if (result.status !== "OK") return { status: "FAILED", failedCheck: `INDEPENDENT_REVIEW_${result.status}`, message: result.message, technicalCalls: technicalCall };
    let value: unknown;
    let errors: string[];
    let outputKind: "INVALID_REVIEW" | "NOT_JSON" = "INVALID_REVIEW";
    try {
      value = JSON.parse(result.stdout);
      errors = input.validate(value);
    } catch (error) {
      errors = [`stdout was not valid JSON: ${(error as Error).message}`];
      outputKind = "NOT_JSON";
    }
    if (errors.length === 0) return { status: "VALID", review: asValidatedIndependentReview(value), technicalCalls: technicalCall, firstCallErrors };
    if (technicalCall === 2) return { status: "FAILED", failedCheck: "INDEPENDENT_REVIEW_OUTPUT_INVALID", message: errors.join("; "), technicalCalls: 2 };
    firstCallErrors = errors;
    prompt = buildReviewerStructuralRetryPrompt(input.prompt, errors, outputKind);
  }
  throw new Error("technical call limit exceeded");
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export interface DefectDetection {
  defectId: string;
  detected: boolean;
  /** BLOCKING findings matching the defect. */
  findingIds: string[];
  /** ADVISORY findings matching the defect: noticed but would not block, so not a detection. */
  advisoryFindingIds: string[];
}

export interface RunClassification {
  outcome: string;
  detections: DefectDetection[];
  blockingFindingIds: string[];
  /** BLOCKING findings that match no expected defect. */
  unexpectedBlockingFindingIds: string[];
  /** CONCUR cases only: the run blocks material expected to be acceptable. */
  falseBlocker: boolean | null;
}

function matchesDefect(finding: ReviewFinding, defect: ExpectedDefect): boolean {
  if (finding.recordId !== defect.recordId || !new RegExp(defect.field).test(finding.field)) return false;
  return new RegExp(defect.text, "i").test(`${finding.claim}\n${finding.reason}\n${finding.correctionDirection}`);
}

export function classifyRun(benchmarkCase: BenchmarkCase, review: IndependentReviewResult): RunClassification {
  const blocking = review.findings.filter((f) => f.severity === "BLOCKING");
  const detections = benchmarkCase.expectedDefects.map((defect) => {
    const matching = review.findings.filter((f) => matchesDefect(f, defect));
    const findingIds = matching.filter((f) => f.severity === "BLOCKING").map((f) => f.findingId);
    return { defectId: defect.defectId, detected: findingIds.length > 0, findingIds, advisoryFindingIds: matching.filter((f) => f.severity === "ADVISORY").map((f) => f.findingId) };
  });
  const matched = new Set(detections.flatMap((d) => d.findingIds));
  const blocks = review.outcome !== "CONCUR";
  return {
    outcome: review.outcome,
    detections,
    blockingFindingIds: blocking.map((f) => f.findingId),
    unexpectedBlockingFindingIds: blocking.filter((f) => !matched.has(f.findingId)).map((f) => f.findingId),
    falseBlocker: benchmarkCase.expectation === "CONCUR" ? blocks : null,
  };
}

// ---------------------------------------------------------------------------
// Persisted run records (no timestamps or random IDs)
// ---------------------------------------------------------------------------

export interface RunRecord {
  caseId: string;
  origin: string;
  profile: BenchmarkProfile;
  run: number;
  inputFingerprint: string | null;
  promptSha256: string | null;
  invocation:
    | { status: "VALID"; technicalCalls: number; firstCallErrors: string[] }
    | { status: "FAILED"; technicalCalls: number; failedCheck: string; message: string }
    | { status: "CONTEXT_FREE_BLOCKED"; technicalCalls: 0; failedCheck: string; message: string };
  review: IndependentReviewResult | null;
}

export function runRecordFileName(caseId: string, profile: BenchmarkProfile, run: number): string {
  return `${caseId}.${profile}.${run}.json`;
}

function benchmarkCase(caseId: string): BenchmarkCase {
  const found = BENCHMARK_CASES.find((c) => c.caseId === caseId);
  if (!found) throw new Error(`unknown case ${caseId}`);
  return found;
}

export function executeRun(repoRoot: string, caseId: string, profile: BenchmarkProfile, run: number, invoker: AiInvoker): RunRecord {
  const benchmark = benchmarkCase(caseId);
  const input = profileInput(profile, caseSource(repoRoot, caseId));
  const base = { caseId, origin: benchmark.origin, profile, run };
  if (input.status === "CONTEXT_FREE_BLOCKED") {
    return { ...base, inputFingerprint: null, promptSha256: null, invocation: { status: "CONTEXT_FREE_BLOCKED", technicalCalls: 0, failedCheck: "CONTEXT_FREE_BLOCK", message: input.message }, review: null };
  }
  const invocation = runReviewer(invoker, input);
  const fingerprints = { inputFingerprint: input.inputFingerprint, promptSha256: input.promptSha256 };
  if (invocation.status === "FAILED") return { ...base, ...fingerprints, invocation: { status: "FAILED", technicalCalls: invocation.technicalCalls, failedCheck: invocation.failedCheck, message: invocation.message }, review: null };
  return { ...base, ...fingerprints, invocation: { status: "VALID", technicalCalls: invocation.technicalCalls, firstCallErrors: invocation.firstCallErrors }, review: invocation.review };
}

export interface MatrixRow {
  caseId: string;
  profile: BenchmarkProfile;
  runs: number;
  reviewerInvocations: number;
  validRuns: number;
  expectedDefectDetections: number;
  misses: number;
  falseBlockers: number;
  structuralFailures: number;
}

/** Aggregates run records per case and profile; a failed run counts every expected defect as missed. */
export function benchmarkMatrix(records: readonly RunRecord[]): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const c of BENCHMARK_CASES) {
    for (const profile of BENCHMARK_PROFILES) {
      const runs = records.filter((r) => r.caseId === c.caseId && r.profile === profile);
      const classified = runs.flatMap((r) => (r.review ? [classifyRun(c, r.review)] : []));
      const detections = classified.reduce((n, k) => n + k.detections.filter((d) => d.detected).length, 0);
      rows.push({
        caseId: c.caseId,
        profile,
        runs: runs.length,
        reviewerInvocations: runs.reduce((n, run) => n + run.invocation.technicalCalls, 0),
        validRuns: classified.length,
        expectedDefectDetections: detections,
        misses: runs.length * c.expectedDefects.length - detections,
        falseBlockers: classified.filter((k) => k.falseBlocker === true).length,
        structuralFailures: runs.length - classified.length,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  const [command, ...args] = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args[i + 1];
  };
  const fail = (message: string): void => {
    console.error(`FAILED: ${message}`);
    process.exitCode = 1;
  };

  if (command === "prepare") {
    const repoRoot = resolve(flag("--repo") ?? ".");
    for (const c of BENCHMARK_CASES) {
      const source = caseSource(repoRoot, c.caseId);
      for (const profile of BENCHMARK_PROFILES) {
        const input = profileInput(profile, source);
        if (input.status === "CONTEXT_FREE_BLOCKED") console.log(`${c.caseId} ${profile} CONTEXT_FREE_BLOCKED ${input.message}`);
        else console.log(`${c.caseId} ${profile} input=${input.inputFingerprint} prompt=${input.promptSha256} promptBytes=${Buffer.byteLength(input.prompt)} signals=${input.signalCount}`);
      }
    }
    return;
  }
  if (command === "run") {
    const repoRoot = resolve(flag("--repo") ?? ".");
    const caseId = flag("--case");
    const profile = flag("--profile") as BenchmarkProfile | undefined;
    const run = Number(flag("--run"));
    const out = flag("--out");
    if (!caseId || !profile || !BENCHMARK_PROFILES.includes(profile) || !Number.isInteger(run) || run < 1 || run > MAX_RUNS_PER_PROFILE || !out) return fail(`usage: run --repo <dir> --case <id> --profile <REFERENCE|REDUCED> --run <1..${MAX_RUNS_PER_PROFILE}> --out <dir>`);
    const config = loadLocalCommandAiInvokerConfigFromEnv();
    if (!config) return fail("RESEARCH_AI_COMMAND is not set");
    const record = executeRun(repoRoot, caseId, profile, run, new LocalCommandAiInvoker(config));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, runRecordFileName(caseId, profile, run)), `${JSON.stringify(record, null, 2)}\n`, "utf8");
    console.log(`${caseId} ${profile} #${run}: ${record.invocation.status}${record.review ? ` ${record.review.outcome}` : ""}`);
    return;
  }
  if (command === "evaluate") {
    const dir = flag("--results");
    const out = flag("--out");
    if (!dir || !out) return fail("usage: evaluate --results <dir> --out <file.json>");
    const records = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as RunRecord);
    const runs = records.map((r) => ({ ...r, classification: r.review ? classifyRun(benchmarkCase(r.caseId), r.review) : null }));
    writeFileSync(out, `${JSON.stringify({ cases: BENCHMARK_CASES, matrix: benchmarkMatrix(records), runs }, null, 2)}\n`, "utf8");
    console.table(benchmarkMatrix(records));
    return;
  }
  fail("usage: prepare | run | evaluate");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
