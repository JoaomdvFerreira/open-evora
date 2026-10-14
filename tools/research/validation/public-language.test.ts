import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { CorpusIndex, RecordFields, RecordSchema } from "../core/types.ts";
import {
  formatPublicLanguageFinding,
  loadPublicLanguageRules,
  publicPrbTextFields,
  scanPublicLanguage,
  validatePublicLanguage,
  type PublicLanguageRule,
} from "./public-language.ts";

const PROBLEM_SCHEMA: RecordSchema = { prefix: "PRB-", directory: "problems", idField: "problem_id" };
const RULES = loadPublicLanguageRules();

function indexOf(problems: RecordFields[], researchRoot = "/repo/research"): CorpusIndex {
  const records = problems.map((fields) => ({ file: `problems/${fields.problem_id}.yaml`, fields }));
  return {
    researchRoot,
    byPrefix: new Map([["PRB-", { schema: PROBLEM_SCHEMA, records, byId: new Map(records.map((r) => [r.fields.problem_id as string, r])) }]]),
    totalRecords: records.length,
  };
}

/** A PRB whose every public text field carries a distinct marker word. */
function fullyPopulatedProblem(text: (field: string) => string): RecordFields {
  return {
    problem_id: "PRB-0001",
    status: "CLOSED",
    title: text("title"),
    problem_statement: text("problem_statement"),
    investigation: {
      open_questions: [
        {
          question: text("question"),
          latest_result: text("latest_result"),
          why_open: text("why_open"),
          current_action: text("current_action"),
          resolution_condition: text("resolution_condition"),
          evidence: ["EVD-000001"],
        },
      ],
      path: {
        initial_signal: { summary: text("initial_signal"), evidence: ["EVD-000001"] },
        development: { summary: text("development") },
        delimitation: { summary: text("delimitation") },
      },
    },
    history: [{ date: "2026-10-14", summary: text("history"), state_changes: { status: { from: "OPEN", to: "CLOSED" } } }],
    closure: { reason: "OUT_OF_SCOPE", explanation: text("explanation"), reopen_condition: text("reopen_condition"), closed_at: "2026-10-14" },
  };
}

function scan(problems: RecordFields[], rules: PublicLanguageRule[] = RULES) {
  return scanPublicLanguage(indexOf(problems), rules);
}

test("every citizen-facing PRB field is scanned, including closed records", () => {
  const findings = scan([fullyPopulatedProblem((field) => `Texto de ${field.replace(/_/g, " ")} com o proprietário.`)]);
  assert.deepEqual(
    findings.map((f) => f.field),
    [
      "title",
      "problem_statement",
      "investigation.open_questions[0].question",
      "investigation.open_questions[0].latest_result",
      "investigation.open_questions[0].why_open",
      "investigation.open_questions[0].current_action",
      "investigation.open_questions[0].resolution_condition",
      "investigation.path.initial_signal.summary",
      "investigation.path.development.summary",
      "investigation.path.delimitation.summary",
      "history[0].summary",
      "closure.explanation",
      "closure.reopen_condition",
    ]
  );
  assert.ok(findings.every((f) => f.expression === "proprietário"));
});

test("open and closed PRBs are both scanned", () => {
  const open = { problem_id: "PRB-0002", status: "OPEN", title: "Ver PRB-0003." };
  const closed = { problem_id: "PRB-0003", status: "CLOSED", closure: { explanation: "Ver EVD-000037." } };
  assert.deepEqual(
    scan([open, closed]).map((f) => [f.file, f.field, f.expression]),
    [
      ["problems/PRB-0002.yaml", "title", "PRB-"],
      ["problems/PRB-0003.yaml", "closure.explanation", "EVD-"],
    ]
  );
});

test("record identifiers are detected only with their identifier structure", () => {
  const findings = scan([
    { problem_id: "PRB-0001", problem_statement: "Ver EVD-000033, SRC-0030, PRB-0013, IREQ-0015 e nenhum outro PRB-*." },
  ]);
  assert.deepEqual(findings.map((f) => f.matched), ["EVD-000033", "SRC-0030", "PRB-0013", "IREQ-0015", "PRB-*"]);

  const ordinary = scan([{ problem_id: "PRB-0001", problem_statement: "O SRC- e o PRB foram discutidos; a XEVD-0001 não é um identificador." }]);
  assert.deepEqual(ordinary, []);
});

test("internal governance language and jargon are detected case- and accent-insensitively, with inflections", () => {
  const findings = scan([
    {
      problem_id: "PRB-0001",
      problem_statement:
        "Os Proprietarios decidiram; a proprietária e o Owner também. Um desafio direto, desafios institucionais e um challenge. " +
        "Candidatas no corpus, evidências canónicas autoritativas e dados site-specific. Manifestações qualificáveis e séries operacionais. " +
        "Os registos ligados a este problema e os registos ligados. Critérios delimitados, a hipótese informacional, uma observação " +
        "seguramente executável, e restringiu a hipótese de falha.",
    },
  ]);
  assert.deepEqual(
    findings.map((f) => f.expression),
    [
      "proprietário",
      "proprietária",
      "owner",
      "desafio direto",
      "desafio institucional",
      "challenge",
      "candidato",
      "corpus",
      "evidência canónica",
      "autoritativo",
      "site-specific",
      "manifestação qualificável",
      "série operacional",
      "registos ligados",
      "registos ligados",
      "critério delimitado",
      "hipótese informacional",
      "observação seguramente executável",
      "restringiu a hipótese de falha",
    ]
  );
  assert.equal(findings[0].matched, "Proprietarios");
});

test("structural status values are detected only as isolated uppercase words", () => {
  const findings = scan([{ problem_id: "PRB-0001", problem_statement: "Permanece OPEN; antes CLOSED, depois UNKNOWN, HOLD e OUT_OF_SCOPE." }]);
  assert.deepEqual(findings.map((f) => f.expression), ["OPEN", "CLOSED", "UNKNOWN", "HOLD", "OUT_OF_SCOPE"]);

  const ordinary = scan([
    {
      problem_id: "PRB-0001",
      problem_statement:
        "Uma questão open ou Open, closed, unknown e hold; REOPENED, OPENING, HOLDER, OPEN_DATA e out_of_scope não contam. " +
        "Candidaturas, ownership e challenged também não.",
    },
  ]);
  assert.deepEqual(ordinary, []);
});

test("nested open-question fields are reported with their index", () => {
  const findings = scan([
    {
      problem_id: "PRB-0001",
      investigation: { open_questions: [{ question: "Sem problemas." }, { why_open: "Partilhado com PRB-0002.", current_action: "Desafio direto." }] },
    },
  ]);
  assert.deepEqual(findings.map((f) => f.field), ["investigation.open_questions[1].why_open", "investigation.open_questions[1].current_action"]);
});

test("investigation path summaries are scanned for every authored stage", () => {
  const findings = scan([
    { problem_id: "PRB-0001", investigation: { path: { initial_signal: { summary: "Ver EVD-000001." }, delimitation: { summary: "Ver PRB-0005." } } } },
  ]);
  assert.deepEqual(findings.map((f) => f.field), ["investigation.path.initial_signal.summary", "investigation.path.delimitation.summary"]);
});

test("history summaries and closure fields are scanned", () => {
  const findings = scan([
    {
      problem_id: "PRB-0009",
      history: [{ date: "2026-10-01", summary: "Sem jargão." }, { date: "2026-10-14", summary: "PRB-0009 permanece OPEN." }],
      closure: { explanation: "Ver EVD-000037.", reopen_condition: "Com o owner." },
    },
  ]);
  assert.deepEqual(
    findings.map((f) => `${f.field}:${f.expression}`),
    ["history[1].summary:PRB-", "history[1].summary:OPEN", "closure.explanation:EVD-", "closure.reopen_condition:owner"]
  );
});

test("diagnostics name the record path, field path, expression and an excerpt", () => {
  const index = indexOf(
    [{ problem_id: "PRB-0009", history: [{ summary: `${"Texto inicial muito longo para cortar. ".repeat(3)}O problema permanece OPEN até nova informação.` }] }],
    "/repo/research"
  );
  const [finding] = scanPublicLanguage(index, RULES);
  assert.equal(finding.excerpt.startsWith("…"), true);
  assert.match(finding.excerpt, /O problema permanece OPEN até nova informação\.$/);
  assert.equal(
    formatPublicLanguageFinding(finding, index.researchRoot),
    `research/problems/PRB-0009.yaml — history[0].summary — forbidden expression: "OPEN" (internal-status) — "${finding.excerpt}"`
  );
  assert.deepEqual(validatePublicLanguage(index), [formatPublicLanguageFinding(finding, index.researchRoot)]);
});

test("multiple occurrences are all reported in deterministic text order", () => {
  const problems = [
    { problem_id: "PRB-0001", problem_statement: "O proprietário viu PRB-0002, depois PRB-0003 e de novo o proprietário." },
    { problem_id: "PRB-0002", title: "Ver EVD-000001 e EVD-000002." },
  ];
  const first = scan(problems);
  assert.deepEqual(
    first.map((f) => `${f.file}|${f.matched}`),
    [
      "problems/PRB-0001.yaml|proprietário",
      "problems/PRB-0001.yaml|PRB-0002",
      "problems/PRB-0001.yaml|PRB-0003",
      "problems/PRB-0001.yaml|proprietário",
      "problems/PRB-0002.yaml|EVD-000001",
      "problems/PRB-0002.yaml|EVD-000002",
    ]
  );
  assert.deepEqual(scan(problems), first);
});

test("the forbidden-expression configuration can be extended without changing the validator", () => {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-public-language-"));
  try {
    const path = join(dir, "rules.json");
    const extra: PublicLanguageRule = { category: "internal-jargon", expression: "pipeline", pattern: "pipelines?" };
    writeFileSync(path, JSON.stringify({ rules: [...RULES, extra] }), "utf8");
    const extended = loadPublicLanguageRules(path);
    const problem = { problem_id: "PRB-0001", problem_statement: "Os pipelines internos." };
    assert.deepEqual(scan([problem]), []);
    assert.deepEqual(scan([problem], extended).map((f) => f.expression), ["pipeline"]);

    writeFileSync(path, JSON.stringify({ rules: [{ category: "x", expression: "", pattern: "y" }] }), "utf8");
    assert.throws(() => loadPublicLanguageRules(path), /rules\[0\]\.expression must be a non-empty string/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("metadata, identifiers, evidence references, decision_basis and enum values are not scanned", () => {
  const problem: RecordFields = {
    problem_id: "PRB-0001",
    status: "OPEN",
    evidence_status: "UNKNOWN",
    evidence: [{ evidence_id: "EVD-000001", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] }],
    investigation: { open_questions: [{ question: "Uma pergunta.", evidence: ["EVD-000001"] }], path: { development: { summary: "Sem jargão.", evidence: ["EVD-000001"] } } },
    history: [{ date: "2026-10-14", summary: "Sem jargão.", evidence: ["EVD-000001"], state_changes: { status: { from: "OPEN", to: "CLOSED" } } }],
    closure: { reason: "OUT_OF_SCOPE", explanation: "Fora do âmbito.", reopen_condition: "Nova informação.", closed_at: "2026-10-14" },
    decision_basis: {
      corroboration_basis: "O proprietário confirmou o desafio direto com evidência canónica.",
      overlap_check: { summary: "Nenhum outro PRB-* aborda isto; PRB-0009 permanece OPEN.", related_problems: ["PRB-0002"] },
      independence_assessment: "EVD-000171 e EVD-000172 vêm do mesmo corpus.",
    },
  };
  assert.deepEqual(scan([problem]), []);
  assert.deepEqual(
    publicPrbTextFields(problem).map((f) => f.field),
    [
      "investigation.open_questions[0].question",
      "investigation.path.development.summary",
      "history[0].summary",
      "closure.explanation",
      "closure.reopen_condition",
    ]
  );
});
