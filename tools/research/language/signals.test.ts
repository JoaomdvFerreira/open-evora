/**
 * Deterministic CLEC language signals: lexical families, cross-record
 * structural signals, the advisory-only boundary, and the inspection CLI.
 *
 * Engine fixtures are in-memory corpus indexes built on the real executable
 * schemas (research/schemas/*); CLI fixtures are temporary Git repositories.
 * Nothing here reads canonical research records.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { loadSchemas } from "../core/schemas.ts";
import type { CorpusIndex, ParsedRecord, RecordFields, RecordIndex } from "../core/types.ts";
import { stringifyRecordYaml } from "../core/yaml.ts";
import {
  ADVISORY,
  CLEC_DIMENSION,
  CONTEXT_FREE_BLOCK,
  CONTEXT_FREE_BLOCKING_CODES,
  contextFreeBlockers,
  describeContextFreeBlockers,
  detectLanguageSignals,
  linkedEvidenceSupportsScopeTerm,
  SIGNAL_CODE,
  SIGNAL_DIMENSION,
  subjectIdsForFiles,
} from "./signals.ts";
import type { LanguageSignal, SignalCode } from "./signals.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SCHEMAS_DIR = join(HERE, "..", "..", "..", "research", "schemas");
const SCHEMAS = loadSchemas(join(HERE, "..", "..", "..", "research"));
const CLI = join(HERE, "cli.ts");

function src(overrides: RecordFields = {}): RecordFields {
  return {
    source_id: "SRC-9001",
    name: "Relatório municipal de mobilidade",
    resource_type: "document",
    scope: { geography: { level: "municipality", area: "Évora" }, domains: ["MOB"] },
    access: { level: "public", availability: "available", machine_readable: false },
    acquisition: { method: "public_web" },
    licensing: { status: "unknown", reuse: "unknown" },
    temporal: { last_checked_at: "2026-08-11" },
    ...overrides,
  };
}

function evd(overrides: RecordFields = {}): RecordFields {
  return {
    evidence_id: "EVD-900001",
    provenance: { sources: ["SRC-9001"], extracted_at: "2026-08-11" },
    observation: { summary: "O relatório regista 12 carreiras urbanas em 2025." },
    scope: { geography: { level: "municipality", area: "Évora" }, temporal: { as_of: "2025" } },
    domains: ["MOB"],
    evidence_nature: "fact",
    claim_authority: "authoritative",
    inference_limits: ["Não mede a procura."],
    ...overrides,
  };
}

function prb(overrides: RecordFields = {}): RecordFields {
  return {
    problem_id: "PRB-9001",
    created_at: "2026-08-11",
    updated_at: "2026-08-11",
    title: "Horários das carreiras urbanas",
    domain: ["MOB"],
    geography: { level: "municipality", area: "Évora" },
    affected_populations: ["residentes que dependem das carreiras urbanas"],
    problem_statement: "A oferta noturna das carreiras urbanas é menor do que a diurna.",
    evidence: [],
    evidence_status: "discovered",
    validation_status: "unvalidated",
    digital_tractability: "not_assessed",
    solution_landscape_status: "not_assessed",
    status: "OPEN",
    ...overrides,
  };
}

function corpus(records: { src?: RecordFields[]; evd?: RecordFields[]; prb?: RecordFields[] }): CorpusIndex {
  const groups: Record<string, RecordFields[]> = { "SRC-": records.src ?? [], "EVD-": records.evd ?? [], "PRB-": records.prb ?? [] };
  const byPrefix = new Map<string, RecordIndex>();
  let totalRecords = 0;
  for (const schema of SCHEMAS) {
    const parsed: ParsedRecord[] = groups[schema.prefix].map((fields) => ({ file: `${schema.directory}/${fields[schema.idField]}.yaml`, fields }));
    byPrefix.set(schema.prefix, { schema, records: parsed, byId: new Map(parsed.map((r) => [r.fields[schema.idField] as string, r])) });
    totalRecords += parsed.length;
  }
  return { researchRoot: "", byPrefix, totalRecords };
}

/** Lexical signals for one PRB problem_statement, as [code, verbatim match] pairs. */
function statementSignals(text: string): [SignalCode, string | undefined][] {
  const signals = detectLanguageSignals(corpus({ prb: [prb({ problem_statement: text, decision_basis: { currentness: { assessment: "Avaliada." } } })] }));
  return signals.filter((s) => s.field === "problem_statement").map((s) => [s.code, s.match]);
}

function codes(signals: LanguageSignal[]): SignalCode[] {
  return signals.map((s) => s.code);
}

describe("lexical wording families", () => {
  const positives: [SignalCode, string, string][] = [
    [SIGNAL_CODE.VAGUE_QUANTITY, "Há vários atrasos.", "vários"],
    [SIGNAL_CODE.VAGUE_QUANTITY, "Muitas paragens não têm abrigo.", "Muitas"],
    [SIGNAL_CODE.VAGUE_QUANTITY, "A maioria das carreiras termina cedo.", "A maioria"],
    [SIGNAL_CODE.VAGUE_FREQUENCY, "Os autocarros atrasam frequentemente.", "frequentemente"],
    [SIGNAL_CODE.VAGUE_FREQUENCY, "Os atrasos ocorrem com frequência.", "com frequência"],
    [SIGNAL_CODE.VAGUE_FREQUENCY, "Há atrasos recorrentes.", "recorrentes"],
    [SIGNAL_CODE.VAGUE_SCOPE, "O problema afeta zonas-chave da cidade.", "zonas-chave"],
    [SIGNAL_CODE.VAGUE_SCOPE, "O problema afeta zonas chave da cidade.", "zonas chave"],
    [SIGNAL_CODE.VAGUE_SCOPE, "O incumprimento é generalizado.", "generalizado"],
    [SIGNAL_CODE.VAGUE_SCOPE, "As falhas são generalizadas.", "generalizadas"],
    [SIGNAL_CODE.VAGUE_SCOPE, "Ocorre em todo o município.", "em todo o município"],
    [SIGNAL_CODE.INTENSITY_JUDGEMENT, "Há um impacto significativo.", "significativo"],
    [SIGNAL_CODE.INTENSITY_JUDGEMENT, "A oferta diminuiu significativamente.", "significativamente"],
    [SIGNAL_CODE.INTENSITY_JUDGEMENT, "Registam-se falhas graves.", "graves"],
    [SIGNAL_CODE.CERTAINTY_MARKER, "O relatório comprova a falha.", "comprova"],
    [SIGNAL_CODE.CERTAINTY_MARKER, "Os dados confirmaram a falha.", "confirmaram"],
    [SIGNAL_CODE.CERTAINTY_MARKER, "Está demonstrado que há falhas.", "demonstrado"],
    [SIGNAL_CODE.CAUSAL_MARKER, "Há atrasos devido à obra.", "devido à"],
    [SIGNAL_CODE.CAUSAL_MARKER, "A obra provoca atrasos.", "provoca"],
    [SIGNAL_CODE.CAUSAL_MARKER, "As obras provocaram atrasos.", "provocaram"],
    [SIGNAL_CODE.CAUSAL_MARKER, "A obra leva ao encerramento.", "leva ao"],
    [SIGNAL_CODE.GENERIC_POPULATION, "O problema afeta os residentes.", "os residentes"],
    [SIGNAL_CODE.GENERIC_POPULATION, "Afeta a população e o comércio.", "a população"],
  ];
  for (const [code, text, match] of positives) {
    test(`${code} flags "${match}"`, () => {
      assert.deepEqual(statementSignals(text), [[code, match]]);
    });
  }

  test("matching ignores case and accents but reports the authored wording verbatim", () => {
    assert.deepEqual(statementSignals("Há varios atrasos."), [[SIGNAL_CODE.VAGUE_QUANTITY, "varios"]]);
    assert.deepEqual(statementSignals("HÁ VÁRIOS ATRASOS."), [[SIGNAL_CODE.VAGUE_QUANTITY, "VÁRIOS"]]);
    assert.deepEqual(statementSignals("Há atrasos devido a obras."), [[SIGNAL_CODE.CAUSAL_MARKER, "devido a"]]);
  });

  test("words that merely contain a signal stem are not flagged", () => {
    const nearMisses = [
      "A variação da oferta é variável.", // vários
      "A frequência das carreiras foi aprovada.", // com frequência, prova
      "É provavelmente uma questão de causalidade.", // prova, causa
      "A gravação foi devidamente arquivada.", // graves, devido a
      "O operador leva a cabo a revisão regional.", // leva a, geral
      "Os transportes públicos.", // generic population
      "Os residentes que dependem das carreiras.", // qualified population
    ];
    for (const text of nearMisses) assert.deepEqual(statementSignals(text), [], text);
  });

  test("overlapping families yield one signal for the longest wording", () => {
    assert.deepEqual(statementSignals("Os atrasos ocorrem muitas vezes."), [[SIGNAL_CODE.VAGUE_FREQUENCY, "muitas vezes"]]);
  });

  test("an unqualified affected population entry is flagged; a qualified one is not", () => {
    const signals = detectLanguageSignals(corpus({ prb: [prb({ affected_populations: ["residentes", "residentes sem viatura própria"] })] }));
    assert.deepEqual(
      signals.map((s) => [s.code, s.field]),
      [[SIGNAL_CODE.GENERIC_POPULATION, "affected_populations[0]"]]
    );
  });

  test("PRB fields with their own evidence lists carry those references", () => {
    const record = prb({
      investigation: { open_questions: [{ question: "Os atrasos são frequentes?", evidence: ["EVD-900001", "EVD-900002"] }] },
    });
    const [signal] = detectLanguageSignals(corpus({ prb: [record] })).filter((s) => s.code === SIGNAL_CODE.VAGUE_FREQUENCY);
    assert.equal(signal.field, "investigation.open_questions[0].question");
    assert.deepEqual(signal.evidenceReferences, ["EVD-900001", "EVD-900002"]);
  });

  test("EVD lexical families read the observation and are reviewed against its Sources", () => {
    const signals = detectLanguageSignals(corpus({ evd: [evd({ observation: { summary: "O relatório regista atrasos frequentes." } })] }));
    assert.deepEqual(
      signals.map((s) => [s.code, s.field, s.evidenceReferences]),
      [[SIGNAL_CODE.VAGUE_FREQUENCY, "observation.summary", ["SRC-9001"]]]
    );
  });
});

describe("currentness signals", () => {
  test("PRB present-currentness wording without an authored currentness basis is flagged", () => {
    const signals = detectLanguageSignals(corpus({ prb: [prb({ problem_statement: "Atualmente a oferta mantém-se reduzida." })] }));
    assert.deepEqual(
      signals.map((s) => [s.code, s.match]),
      [
        [SIGNAL_CODE.PRB_CURRENTNESS_WORDING_WITHOUT_BASIS, "Atualmente"],
        [SIGNAL_CODE.PRB_CURRENTNESS_WORDING_WITHOUT_BASIS, "mantém-se"],
      ]
    );
  });

  test("an authored currentness assessment removes the PRB currentness prompt", () => {
    const record = prb({ problem_statement: "Atualmente a oferta é reduzida.", decision_basis: { currentness: { assessment: "Confirmado em 2026 pela fonte X." } } });
    assert.deepEqual(codes(detectLanguageSignals(corpus({ prb: [record] }))).filter((c) => c === SIGNAL_CODE.PRB_CURRENTNESS_WORDING_WITHOUT_BASIS), []);
  });

  test("EVD with unknown temporal status and present wording is flagged; a dated EVD is not", () => {
    const summary = "O relatório regista que o serviço continua a terminar às 20h.";
    const unknown = evd({ observation: { summary }, scope: { geography: { level: "municipality", area: "Évora" }, temporal: { status: "unknown" } } });
    assert.deepEqual(codes(detectLanguageSignals(corpus({ evd: [unknown] }))), [SIGNAL_CODE.EVD_TEMPORAL_UNKNOWN_PRESENT_WORDING]);
    assert.deepEqual(codes(detectLanguageSignals(corpus({ evd: [evd({ observation: { summary } })] }))), []);
  });
});

describe("EVD attribution and inference limits", () => {
  test("a non-factual observation without an attribution marker is flagged", () => {
    const signals = detectLanguageSignals(corpus({ evd: [evd({ evidence_nature: "claim", observation: { summary: "O serviço termina demasiado cedo." } })] }));
    assert.deepEqual(
      signals.map((s) => [s.code, s.field, s.excerpt, s.evidenceReferences]),
      [[SIGNAL_CODE.EVD_ATTRIBUTION_ABSENT, "observation.summary", "O serviço termina demasiado cedo.", ["SRC-9001"]]]
    );
  });

  test("attribution markers in PT-PT inflections suppress the prompt", () => {
    for (const summary of [
      "Segundo a associação, o serviço termina cedo.",
      "De acordo com os utentes inquiridos, o serviço termina cedo.",
      "Estudantes relataram que o serviço termina cedo.",
      "A associação afirma que o serviço termina cedo.",
      "O plano recomenda prolongar o serviço.",
    ]) {
      const record = evd({ evidence_nature: "opinion", observation: { summary } });
      assert.deepEqual(codes(detectLanguageSignals(corpus({ evd: [record] }))), [], summary);
    }
  });

  test("factual natures are not checked for attribution", () => {
    for (const nature of ["fact", "measurement"]) {
      const record = evd({ evidence_nature: nature, observation: { summary: "O serviço termina às 20h." } });
      assert.deepEqual(codes(detectLanguageSignals(corpus({ evd: [record] }))), [], nature);
    }
  });

  test("empty inference limits are flagged only for non-factual natures", () => {
    const summary = "Segundo a associação, o serviço termina cedo.";
    const opinion = detectLanguageSignals(corpus({ evd: [evd({ evidence_nature: "opinion", observation: { summary }, inference_limits: [] })] }));
    assert.deepEqual(
      opinion.map((s) => [s.code, s.field, s.excerpt]),
      [[SIGNAL_CODE.EVD_INFERENCE_LIMITS_EMPTY, "inference_limits", "[]"]]
    );
    assert.deepEqual(codes(detectLanguageSignals(corpus({ evd: [evd({ inference_limits: [] })] }))), []);
    assert.deepEqual(codes(detectLanguageSignals(corpus({ evd: [evd({ evidence_nature: "opinion", observation: { summary } })] }))), []);
  });
});

describe("PRB geography against supporting evidence", () => {
  function geographySignals(prbLevel: string, evidence: [string, string, string[]][]): LanguageSignal[] {
    const evds = evidence.map(([id, level]) => evd({ evidence_id: id, scope: { geography: { level, area: "x" }, temporal: { as_of: "2025" } } }));
    const links = evidence.map(([id, , effects]) => ({ evidence_id: id, effects, research_roles: ["LOCAL_OBSERVATION"] }));
    const record = prb({ geography: { level: prbLevel, area: "Évora" }, evidence: links });
    return detectLanguageSignals(corpus({ evd: evds, prb: [record] })).filter((s) => s.code === SIGNAL_CODE.PRB_GEOGRAPHY_BROADER_THAN_EVIDENCE);
  }

  test("a PRB broader than every supporting EVD is flagged with those EVD as references", () => {
    const signals = geographySignals("municipality", [
      ["EVD-900001", "local_area", ["SUPPORTS"]],
      ["EVD-900002", "parish", ["SUPPORTS", "REFINES"]],
    ]);
    assert.deepEqual(
      signals.map((s) => [s.field, s.excerpt, s.evidenceReferences]),
      [["geography.level", "municipality", ["EVD-900001", "EVD-900002"]]]
    );
  });

  test("ordering follows the schema's geography level order", () => {
    assert.equal(geographySignals("city", [["EVD-900001", "parish", ["SUPPORTS"]]]).length, 1);
    assert.equal(geographySignals("parish", [["EVD-900001", "city", ["SUPPORTS"]]]).length, 0);
    assert.equal(geographySignals("national", [["EVD-900001", "regional", ["SUPPORTS"]]]).length, 1);
  });

  test("one supporting EVD at the PRB level or broader is enough to clear the prompt", () => {
    assert.equal(geographySignals("municipality", [["EVD-900001", "site", ["SUPPORTS"]], ["EVD-900002", "municipality", ["SUPPORTS"]]]).length, 0);
  });

  test("non-supporting and non-ordinal EVD geography are not compared", () => {
    assert.equal(geographySignals("municipality", [["EVD-900001", "site", ["BOUNDS"]]]).length, 0);
    assert.equal(geographySignals("municipality", [["EVD-900001", "unknown", ["SUPPORTS"]], ["EVD-900002", "non_geographic", ["SUPPORTS"]]]).length, 0);
  });
});

describe("PRB scope terms against linked evidence", () => {
  const SCOPE_CODES: SignalCode[] = [
    SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE,
    SIGNAL_CODE.PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE,
    SIGNAL_CODE.PRB_TEMPORAL_TERM_NOT_IN_LINKED_EVIDENCE,
  ];

  /** Scope-term signals for a PRB statement linked to EVD-900001 (as given), as [code, match] pairs. */
  function scopeSignals(statement: string, linked: RecordFields = evd(), extra: { src?: RecordFields[]; evd?: RecordFields[] } = {}): [SignalCode, string | undefined][] {
    const record = prb({ problem_statement: statement, evidence: [{ evidence_id: "EVD-900001", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] }] });
    const signals = detectLanguageSignals(corpus({ src: extra.src, evd: [linked, ...(extra.evd ?? [])], prb: [record] }));
    return signals.filter((s) => s.field === "problem_statement" && SCOPE_CODES.includes(s.code)).map((s) => [s.code, s.match]);
  }

  test("an unsupported geographic term is flagged against the linked EVD", () => {
    const record = prb({ problem_statement: "As carreiras do centro histórico terminam cedo.", evidence: [{ evidence_id: "EVD-900001", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] }] });
    const [signal] = detectLanguageSignals(corpus({ evd: [evd()], prb: [record] })).filter((s) => s.code === SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE);
    assert.deepEqual(
      [signal.field, signal.match, signal.dimension, signal.severity, signal.evidenceReferences],
      ["problem_statement", "centro histórico", CLEC_DIMENSION.EXPLICIT_SCOPE, ADVISORY, ["EVD-900001"]]
    );
  });

  test("population and temporal terms are flagged when the linked EVD lacks them", () => {
    assert.deepEqual(scopeSignals("Os estudantes esperam mais ao fim de semana."), [
      [SIGNAL_CODE.PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE, "estudantes"],
      [SIGNAL_CODE.PRB_TEMPORAL_TERM_NOT_IN_LINKED_EVIDENCE, "fim de semana"],
    ]);
  });

  test("a term in the linked EVD's observation summary or scope clears the prompt", () => {
    const statement = "No centro histórico, os idosos esperam mais à noite em 2025.";
    assert.deepEqual(scopeSignals(statement, evd({ observation: { summary: "O relatório regista menos carreiras noturnas no centro histórico para pessoas idosas." } })), []);
    assert.deepEqual(
      scopeSignals(statement, evd({ observation: { summary: "O relatório regista menos carreiras." }, scope: { geography: { level: "local_area", area: "Centro Histórico de Évora" }, populations: ["idosos"], temporal: { as_of: "2025" } } })),
      [[SIGNAL_CODE.PRB_TEMPORAL_TERM_NOT_IN_LINKED_EVIDENCE, "noite"]]
    );
  });

  test("a year is supported by the same year or by the linked EVD's own scope period, not by another year", () => {
    const period = evd({ scope: { geography: { level: "municipality", area: "Évora" }, temporal: { start: "2024", end: "2027" } } });
    assert.deepEqual(scopeSignals("A oferta reduzida foi registada em 2025.", period), []);
    assert.deepEqual(scopeSignals("A oferta reduzida foi registada em 2023.", period), [[SIGNAL_CODE.PRB_TEMPORAL_TERM_NOT_IN_LINKED_EVIDENCE, "2023"]]);
    assert.deepEqual(scopeSignals("A oferta reduzida foi registada em 2026."), [[SIGNAL_CODE.PRB_TEMPORAL_TERM_NOT_IN_LINKED_EVIDENCE, "2026"]]);
  });

  test("a term only in the linked EVD's inference limits is still flagged", () => {
    const limited = evd({ inference_limits: ["Não abrange o centro histórico nem os estudantes."] });
    assert.deepEqual(scopeSignals("As carreiras do centro histórico não servem os estudantes.", limited), [
      [SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE, "centro histórico"],
      [SIGNAL_CODE.PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE, "estudantes"],
    ]);
  });

  test("an SRC or an unlinked EVD carrying the term never supports it", () => {
    const source = src({ name: "Relatório do centro histórico", scope: { geography: { level: "local_area", area: "Centro histórico" }, domains: ["MOB"] } });
    const unlinked = evd({ evidence_id: "EVD-900002", observation: { summary: "O relatório regista atrasos no centro histórico." } });
    assert.deepEqual(scopeSignals("As carreiras do centro histórico terminam cedo.", evd(), { src: [source], evd: [unlinked] }), [
      [SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE, "centro histórico"],
    ]);
  });

  test("one prompt per term family per field, reported verbatim, matching inflections of the same family only", () => {
    assert.deepEqual(scopeSignals("Os idosos e as idosas referem os bairros; os bairros periféricos também."), [
      [SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE, "bairros"],
      [SIGNAL_CODE.PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE, "idosos"],
    ]);
    assert.deepEqual(scopeSignals("Os idosos esperam mais.", evd({ observation: { summary: "Uma pessoa idosa relatou esperas." } })), []);
    assert.deepEqual(scopeSignals("Os estudantes esperam mais.", evd({ observation: { summary: "Os alunos relataram esperas." } })), [
      [SIGNAL_CODE.PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE, "estudantes"],
    ]);
  });

  test("words that merely contain a scope term are not flagged", () => {
    assert.deepEqual(scopeSignals("A municipalidade e a cidadania regional não são termos de âmbito."), []);
  });

  test("a PRB without linked Evidence in the index gets no scope-term prompts", () => {
    const signals = detectLanguageSignals(corpus({ prb: [prb({ problem_statement: "Os estudantes do centro histórico esperam ao fim de semana." })] }));
    assert.equal(signals.some((s) => SCOPE_CODES.includes(s.code)), false);
  });

  test("the shared support predicate reads observation.summary and scope only", () => {
    const record = evd({ observation: { summary: "Regista atrasos." }, scope: { populations: ["estudantes"] }, inference_limits: ["Não abrange o centro histórico."] });
    assert.equal(linkedEvidenceSupportsScopeTerm(SIGNAL_CODE.PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE, "Estudantes", record), true);
    assert.equal(linkedEvidenceSupportsScopeTerm(SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE, "centro histórico", record), false);
    // Only the three scope-term codes are judged by it.
    assert.equal(linkedEvidenceSupportsScopeTerm(SIGNAL_CODE.VAGUE_QUANTITY, "estudantes", record), false);
  });
});

describe("record-ID leakage and SRC wording", () => {
  test("a PRB ID in EVD text is an advisory signal, reported verbatim", () => {
    const record = evd({ inference_limits: ["Não mede a procura.", "Não deve ser tratada como impacto em PRB-0005."] });
    const signals = detectLanguageSignals(corpus({ evd: [record] }));
    assert.deepEqual(
      signals.map((s) => [s.code, s.field, s.match, s.severity]),
      [[SIGNAL_CODE.PRB_ID_IN_EVD_TEXT, "inference_limits[1]", "PRB-0005", ADVISORY]]
    );
  });

  test("ID patterns need the full canonical shape", () => {
    const record = evd({ inference_limits: ["Sem relação com PRB- nem com XPRB-0005 ou PRB-0005A."] });
    assert.deepEqual(detectLanguageSignals(corpus({ evd: [record] })), []);
  });

  test("any canonical record ID in SRC text is flagged, including official-name fields", () => {
    const record = src({ name: "Anexo PRB-0001", caveats: ["Ver EVD-000001 e SRC-0002."] });
    const signals = detectLanguageSignals(corpus({ src: [record] }));
    assert.deepEqual(
      signals.map((s) => [s.code, s.field, s.match]),
      [
        [SIGNAL_CODE.SRC_RECORD_ID_IN_TEXT, "name", "PRB-0001"],
        [SIGNAL_CODE.SRC_RECORD_ID_IN_TEXT, "caveats[0]", "EVD-000001"],
        [SIGNAL_CODE.SRC_RECORD_ID_IN_TEXT, "caveats[0]", "SRC-0002"],
      ]
    );
  });

  test("evaluative or proof wording in SRC caveats is flagged; official names are left as published", () => {
    const record = src({ name: "Relatório Crítico de Mobilidade", caveats: ["Fonte fiável que comprova a cobertura."] });
    const signals = detectLanguageSignals(corpus({ src: [record] }));
    assert.deepEqual(
      signals.map((s) => [s.code, s.field, s.match]),
      [
        [SIGNAL_CODE.SRC_EVALUATIVE_WORDING, "caveats[0]", "fiável"],
        [SIGNAL_CODE.SRC_EVALUATIVE_WORDING, "caveats[0]", "comprova"],
      ]
    );
  });
});

describe("advisory-only, read-only contract", () => {
  const everySignal = () =>
    corpus({
      src: [src({ caveats: ["Fonte fiável; ver PRB-0001."] })],
      evd: [
        evd({ evidence_id: "EVD-900001", scope: { geography: { level: "parish", area: "x" }, temporal: { as_of: "2025" } } }),
        evd({
          evidence_id: "EVD-900002",
          evidence_nature: "claim",
          observation: { summary: "Muitas paragens continuam a ter atrasos frequentes, sempre." },
          scope: { geography: { level: "site", area: "x" }, temporal: { status: "unknown" } },
          inference_limits: [],
        }),
        evd({ evidence_id: "EVD-900003", inference_limits: ["Não se aplica a PRB-0009."] }),
      ],
      prb: [
        prb({
          problem_statement:
            "Atualmente vários atrasos frequentes em zonas-chave são graves, comprovam falhas devido à obra desde 2024 e afetam os residentes.",
          evidence: [{ evidence_id: "EVD-900001", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] }],
        }),
      ],
    });

  test("every signal code is reachable and every emitted signal is advisory with its declared dimension", () => {
    const signals = detectLanguageSignals(everySignal());
    assert.deepEqual(new Set(codes(signals)), new Set(Object.values(SIGNAL_CODE)));
    const dimensions = new Set<string>(Object.values(CLEC_DIMENSION));
    for (const s of signals) {
      assert.equal(s.severity, ADVISORY);
      assert.equal(s.dimension, SIGNAL_DIMENSION[s.code]);
      assert.ok(dimensions.has(s.dimension));
    }
    assert.ok(!signals.some((s) => "score" in s));
  });

  test("detection never mutates records and only quotes authored text", () => {
    const index = everySignal();
    const before = structuredClone([...index.byPrefix.values()].map((set) => set.records));
    const signals = detectLanguageSignals(index);
    assert.deepEqual([...index.byPrefix.values()].map((set) => set.records), before);

    const allText = JSON.stringify(before);
    for (const s of signals) {
      if (s.match !== undefined) assert.ok(s.excerpt.includes(s.match), `${s.code}: match within excerpt`);
      if (s.excerpt !== "[]") assert.ok(allText.includes(JSON.stringify(s.excerpt).slice(1, -1)), `${s.code}: excerpt is verbatim`);
    }
  });

  test("detection is deterministic", () => {
    assert.deepEqual(detectLanguageSignals(everySignal()), detectLanguageSignals(everySignal()));
  });

  test("subjectIds limits subjects while cross-record context still reads the whole corpus", () => {
    const index = everySignal();
    const signals = detectLanguageSignals(index, { subjectIds: new Set(["PRB-9001"]) });
    assert.deepEqual(new Set(signals.map((s) => s.subjectId)), new Set(["PRB-9001"]));
    assert.ok(codes(signals).includes(SIGNAL_CODE.PRB_GEOGRAPHY_BROADER_THAN_EVIDENCE));
  });

  test("subjectIdsForFiles maps record files to IDs and ignores everything else", () => {
    const ids = subjectIdsForFiles(everySignal(), ["evidence/EVD-900002.yaml", "evidence\\EVD-900003.yaml", "schemas/evidence.schema.json", "evidence/EVD-999999.yaml"]);
    assert.deepEqual([...ids].sort(), ["EVD-900002", "EVD-900003"]);
  });
});

describe("context-free blocking policy", () => {
  /** Signals in the reviewer-package shape: a package-local ID over unchanged signal data. */
  function identified(signals: LanguageSignal[]): { signalId: string; signal: LanguageSignal }[] {
    return signals.map((signal, i) => ({ signalId: `CLEC-SIG-${String(i + 1).padStart(4, "0")}`, signal }));
  }

  /** One signal of `code`, with no record, index or evidence context behind it. */
  function bare(code: SignalCode): LanguageSignal {
    return { code, dimension: SIGNAL_DIMENSION[code], subjectId: "X", field: "f", excerpt: "e", severity: ADVISORY };
  }

  test("the blocking set is exactly the two cross-layer internal-ID codes", () => {
    assert.deepEqual([...CONTEXT_FREE_BLOCKING_CODES].sort(), [SIGNAL_CODE.PRB_ID_IN_EVD_TEXT, SIGNAL_CODE.SRC_RECORD_ID_IN_TEXT]);
    assert.equal(CONTEXT_FREE_BLOCK, "CLEC_CONTEXT_FREE_BLOCK");
  });

  test("classification reads the code alone: every other code, lexical or contextual, stays advisory", () => {
    const all = identified(Object.values(SIGNAL_CODE).map(bare));
    assert.deepEqual(
      contextFreeBlockers(all).map((entry) => entry.signal.code),
      [SIGNAL_CODE.SRC_RECORD_ID_IN_TEXT, SIGNAL_CODE.PRB_ID_IN_EVD_TEXT]
    );
    for (const code of [
      SIGNAL_CODE.EVD_INFERENCE_LIMITS_EMPTY,
      SIGNAL_CODE.EVD_ATTRIBUTION_ABSENT,
      SIGNAL_CODE.CAUSAL_MARKER,
      SIGNAL_CODE.SRC_EVALUATIVE_WORDING,
    ]) {
      assert.deepEqual(contextFreeBlockers(identified([bare(code)])), [], `${code} is not blocking`);
    }
  });

  test("blockers keep their signal identity and authored location, in signal order", () => {
    const signals = identified(
      detectLanguageSignals(
        corpus({
          src: [src({ caveats: ["Fonte fiável; ver EVD-000001."] })],
          evd: [evd({ evidence_nature: "claim", inference_limits: [], observation: { summary: "Muitos atrasos causam queixas em PRB-0003." } })],
        })
      )
    );
    const blockers = contextFreeBlockers(signals);
    assert.deepEqual(
      blockers.map(({ signalId, signal }) => [signalId, signal.code, signal.subjectId, signal.field, signal.match]),
      signals
        .filter(({ signal }) => signal.code === SIGNAL_CODE.PRB_ID_IN_EVD_TEXT || signal.code === SIGNAL_CODE.SRC_RECORD_ID_IN_TEXT)
        .map(({ signalId, signal }) => [signalId, signal.code, signal.subjectId, signal.field, signal.match])
    );
    assert.deepEqual(
      blockers.map(({ signal }) => [signal.code, signal.subjectId, signal.field, signal.match]),
      [
        [SIGNAL_CODE.PRB_ID_IN_EVD_TEXT, "EVD-900001", "observation.summary", "PRB-0003"],
        [SIGNAL_CODE.SRC_RECORD_ID_IN_TEXT, "SRC-9001", "caveats[0]", "EVD-000001"],
      ]
    );
    for (const blocker of blockers) assert.equal(blocker, signals.find((entry) => entry.signalId === blocker.signalId), "the entry is returned unchanged");
    // Advisory prompts in the same records are untouched by the policy.
    assert.ok(signals.length > blockers.length);
    assert.deepEqual(contextFreeBlockers(signals), blockers, "evaluation is deterministic");

    const report = describeContextFreeBlockers(blockers);
    assert.match(report, /CLEC-SIG-\d{4} PRB_ID_IN_EVD_TEXT EVD-900001 observation\.summary: "PRB-0003" in "Muitos atrasos causam queixas em PRB-0003\."/);
    assert.match(report, /SRC_RECORD_ID_IN_TEXT SRC-9001 caveats\[0\]: "EVD-000001"/);
    assert.equal(report, describeContextFreeBlockers(blockers));
  });
});

describe("language signal CLI", () => {
  function fixtureRepo(): { root: string; research: string; cleanup: () => void } {
    const root = mkdtempSync(join(tmpdir(), "open-evora-language-signals-"));
    const research = join(root, "research");
    for (const dir of ["sources", "evidence", "problems", "schemas"]) mkdirSync(join(research, dir), { recursive: true });
    for (const f of readdirSync(SCHEMAS_DIR)) writeFileSync(join(research, "schemas", f), readFileSync(join(SCHEMAS_DIR, f), "utf8"));
    writeFileSync(join(research, "sources", "SRC-9001.yaml"), stringifyRecordYaml(src()));
    writeFileSync(join(research, "evidence", "EVD-900001.yaml"), stringifyRecordYaml(evd()));
    writeFileSync(join(research, "evidence", "EVD-900002.yaml"), stringifyRecordYaml(evd({ evidence_id: "EVD-900002" })));
    writeFileSync(join(research, "problems", "PRB-9001.yaml"), stringifyRecordYaml(prb({ problem_statement: "Há vários atrasos." })));
    execFileSync("git", ["init", "--quiet", root]);
    execFileSync("git", ["-C", root, "add", "."]);
    execFileSync("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "initial"]);
    return { root, research, cleanup: () => rmSync(root, { recursive: true, force: true }) };
  }

  function run(args: string[]) {
    return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  }

  test("corpus mode reports advisories and exits 0", () => {
    const repo = fixtureRepo();
    try {
      const result = run(["--all", "--dir", repo.research]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /PRB-9001 problem_statement VAGUE_QUANTITY \[supported_quantity\] advisory/);
      assert.match(result.stdout, /1 advisory signal\(s\) across 1 record\(s\)\./);
    } finally {
      repo.cleanup();
    }
  });

  test("corpus mode stays advisory when context-free blocker codes are present", () => {
    const repo = fixtureRepo();
    try {
      writeFileSync(join(repo.research, "evidence", "EVD-900002.yaml"), stringifyRecordYaml(evd({ evidence_id: "EVD-900002", inference_limits: ["Não é impacto em PRB-0005."] })));
      writeFileSync(join(repo.research, "sources", "SRC-9001.yaml"), stringifyRecordYaml(src({ caveats: ["Ver EVD-900001."] })));
      const result = run(["--all", "--dir", repo.research]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /EVD-900002 inference_limits\[0\] PRB_ID_IN_EVD_TEXT \[evidence_fidelity\] advisory/);
      assert.match(result.stdout, /SRC-9001 caveats\[0\] SRC_RECORD_ID_IN_TEXT \[evidence_fidelity\] advisory/);
    } finally {
      repo.cleanup();
    }
  });

  test("changed-record mode inspects only committed, uncommitted and untracked record changes", () => {
    const repo = fixtureRepo();
    try {
      const base = execFileSync("git", ["-C", repo.root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
      writeFileSync(join(repo.research, "evidence", "EVD-900001.yaml"), stringifyRecordYaml(evd({ inference_limits: ["Ver PRB-9001."] })));
      execFileSync("git", ["-C", repo.root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-am", "edit"]);
      writeFileSync(join(repo.research, "evidence", "EVD-900002.yaml"), stringifyRecordYaml(evd({ evidence_id: "EVD-900002", evidence_nature: "claim", observation: { summary: "Há atrasos." } })));
      writeFileSync(join(repo.research, "sources", "SRC-9002.yaml"), stringifyRecordYaml(src({ source_id: "SRC-9002", caveats: ["Dados fiáveis."] })));

      const result = run(["--changed-since", base, "--dir", repo.research, "--json"]);
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout) as { mode: string; subjects: string[]; signals: LanguageSignal[] };
      assert.equal(report.mode, "changed");
      assert.deepEqual(report.subjects, ["EVD-900001", "EVD-900002", "SRC-9002"]);
      assert.deepEqual(
        report.signals.map((s) => [s.subjectId, s.code, s.severity]),
        [
          ["EVD-900001", SIGNAL_CODE.PRB_ID_IN_EVD_TEXT, ADVISORY],
          ["EVD-900002", SIGNAL_CODE.EVD_ATTRIBUTION_ABSENT, ADVISORY],
          ["SRC-9002", SIGNAL_CODE.SRC_EVALUATIVE_WORDING, ADVISORY],
        ]
      );
    } finally {
      repo.cleanup();
    }
  });

  test("changed-record mode with no record changes reports nothing and exits 0", () => {
    const repo = fixtureRepo();
    try {
      const result = run(["--changed-since", "HEAD", "--dir", repo.research, "--json"]);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout).signals, []);
    } finally {
      repo.cleanup();
    }
  });

  test("only usage and Git errors exit non-zero", () => {
    const repo = fixtureRepo();
    try {
      assert.equal(run(["--dir", repo.research]).status, 1);
      assert.equal(run(["--all", "--changed-since", "HEAD", "--dir", repo.research]).status, 1);
      assert.equal(run(["--changed-since", "--dir", repo.research]).status, 1);
      assert.equal(run(["--changed-since", "no-such-ref", "--dir", repo.research]).status, 1);
    } finally {
      repo.cleanup();
    }
  });
});
