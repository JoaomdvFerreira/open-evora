/**
 * Deterministic Citizen Language & Evidence Contract (CLEC) signals for
 * canonical SRC/EVD/PRB records (docs/investigationstrategy.md §12).
 *
 * Every signal is an advisory review prompt for evidence-aware semantic
 * review — never a wording violation, a finding, or a pass. No word is
 * banned: the same wording may be supported in one context and unsupported
 * in another, and only review against the linked evidence decides that.
 *
 * Separately, this module owns the context-free blocking policy: a closed set
 * of signal codes for cross-layer internal-ID coupling that no evidence
 * interpretation can make valid. A change unit carrying one of them is
 * rejected before semantic review; that is a layer-integrity rule, not a
 * semantic judgement, and it never applies to lexical wording.
 *
 * This module is the code-owned home of the signal lexicon (CLEC: "a
 * deterministic signal lexicon ... is code-owned"). It is pure: it reads an
 * already-loaded corpus index, never mutates or rewrites record text, never
 * scores, and makes no network or NLP-library calls. Field meanings remain
 * owned by docs/datamodel.md and record shape by research/schemas/*.
 */
import { getRecordField } from "../core/record-fields.ts";
import type { CorpusIndex, ParsedRecord, RecordFields } from "../core/types.ts";

/** The ten CLEC dimensions, in the order docs/investigationstrategy.md §12 tabulates them. */
export const CLEC_DIMENSION = {
  CLARITY: "clarity",
  SPECIFICITY: "specificity",
  EXPLICIT_SCOPE: "explicit_scope",
  SUPPORTED_QUANTITY: "supported_quantity",
  ATTRIBUTION: "attribution",
  SUPPORTED_CAUSALITY: "supported_causality",
  TEMPORAL_PRECISION: "temporal_precision",
  VISIBLE_UNCERTAINTY: "visible_uncertainty",
  NEUTRAL_WORDING: "neutral_wording",
  EVIDENCE_FIDELITY: "evidence_fidelity",
} as const;
export type ClecDimension = (typeof CLEC_DIMENSION)[keyof typeof CLEC_DIMENSION];

export const SIGNAL_CODE = {
  VAGUE_QUANTITY: "VAGUE_QUANTITY",
  VAGUE_FREQUENCY: "VAGUE_FREQUENCY",
  VAGUE_SCOPE: "VAGUE_SCOPE",
  INTENSITY_JUDGEMENT: "INTENSITY_JUDGEMENT",
  CERTAINTY_MARKER: "CERTAINTY_MARKER",
  CAUSAL_MARKER: "CAUSAL_MARKER",
  GENERIC_POPULATION: "GENERIC_POPULATION",
  PRB_GEOGRAPHY_BROADER_THAN_EVIDENCE: "PRB_GEOGRAPHY_BROADER_THAN_EVIDENCE",
  PRB_CURRENTNESS_WORDING_WITHOUT_BASIS: "PRB_CURRENTNESS_WORDING_WITHOUT_BASIS",
  PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE: "PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE",
  PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE: "PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE",
  PRB_TEMPORAL_TERM_NOT_IN_LINKED_EVIDENCE: "PRB_TEMPORAL_TERM_NOT_IN_LINKED_EVIDENCE",
  EVD_TEMPORAL_UNKNOWN_PRESENT_WORDING: "EVD_TEMPORAL_UNKNOWN_PRESENT_WORDING",
  EVD_ATTRIBUTION_ABSENT: "EVD_ATTRIBUTION_ABSENT",
  EVD_INFERENCE_LIMITS_EMPTY: "EVD_INFERENCE_LIMITS_EMPTY",
  SRC_EVALUATIVE_WORDING: "SRC_EVALUATIVE_WORDING",
  SRC_RECORD_ID_IN_TEXT: "SRC_RECORD_ID_IN_TEXT",
  PRB_ID_IN_EVD_TEXT: "PRB_ID_IN_EVD_TEXT",
} as const;
export type SignalCode = (typeof SIGNAL_CODE)[keyof typeof SIGNAL_CODE];

/** Single source of truth: the CLEC dimension each signal code prompts review against. */
export const SIGNAL_DIMENSION: Readonly<Record<SignalCode, ClecDimension>> = {
  VAGUE_QUANTITY: CLEC_DIMENSION.SUPPORTED_QUANTITY,
  VAGUE_FREQUENCY: CLEC_DIMENSION.SUPPORTED_QUANTITY,
  VAGUE_SCOPE: CLEC_DIMENSION.EXPLICIT_SCOPE,
  INTENSITY_JUDGEMENT: CLEC_DIMENSION.NEUTRAL_WORDING,
  CERTAINTY_MARKER: CLEC_DIMENSION.VISIBLE_UNCERTAINTY,
  CAUSAL_MARKER: CLEC_DIMENSION.SUPPORTED_CAUSALITY,
  GENERIC_POPULATION: CLEC_DIMENSION.SPECIFICITY,
  PRB_GEOGRAPHY_BROADER_THAN_EVIDENCE: CLEC_DIMENSION.EXPLICIT_SCOPE,
  PRB_CURRENTNESS_WORDING_WITHOUT_BASIS: CLEC_DIMENSION.TEMPORAL_PRECISION,
  PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE: CLEC_DIMENSION.EXPLICIT_SCOPE,
  PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE: CLEC_DIMENSION.EXPLICIT_SCOPE,
  PRB_TEMPORAL_TERM_NOT_IN_LINKED_EVIDENCE: CLEC_DIMENSION.TEMPORAL_PRECISION,
  EVD_TEMPORAL_UNKNOWN_PRESENT_WORDING: CLEC_DIMENSION.TEMPORAL_PRECISION,
  EVD_ATTRIBUTION_ABSENT: CLEC_DIMENSION.ATTRIBUTION,
  EVD_INFERENCE_LIMITS_EMPTY: CLEC_DIMENSION.VISIBLE_UNCERTAINTY,
  SRC_EVALUATIVE_WORDING: CLEC_DIMENSION.NEUTRAL_WORDING,
  SRC_RECORD_ID_IN_TEXT: CLEC_DIMENSION.EVIDENCE_FIDELITY,
  PRB_ID_IN_EVD_TEXT: CLEC_DIMENSION.EVIDENCE_FIDELITY,
};

/**
 * Every signal is an advisory semantic-review prompt; there is no blocking
 * signal severity. Context-free blocking is a separate enforcement policy over
 * signal codes (CONTEXT_FREE_BLOCKING_CODES), not a property of a signal.
 */
export const ADVISORY = "advisory" as const;

/**
 * One explainable CLEC review prompt. `excerpt` and `match` are verbatim
 * substrings of the authored field text (never rewritten). `evidenceReferences`
 * names the records the text should be reviewed against, where authored:
 * a PRB field's own EVD list, or an EVD's provenance Sources.
 */
export interface LanguageSignal {
  code: SignalCode;
  dimension: ClecDimension;
  subjectId: string;
  /** Dotted field path; list items are indexed, e.g. `inference_limits[1]`. */
  field: string;
  excerpt: string;
  /** The matched wording, for lexical and ID signals. */
  match?: string;
  severity: typeof ADVISORY;
  evidenceReferences?: string[];
}

type LexicalCode =
  | typeof SIGNAL_CODE.VAGUE_QUANTITY
  | typeof SIGNAL_CODE.VAGUE_FREQUENCY
  | typeof SIGNAL_CODE.VAGUE_SCOPE
  | typeof SIGNAL_CODE.INTENSITY_JUDGEMENT
  | typeof SIGNAL_CODE.CERTAINTY_MARKER
  | typeof SIGNAL_CODE.CAUSAL_MARKER
  | typeof SIGNAL_CODE.GENERIC_POPULATION;

// ---------------------------------------------------------------------------
// PT-PT lexicon. Patterns are regex fragments over *folded* text: lower-case,
// diacritics removed (so "vários"/"varios", "à"/"a" match alike). A single
// space stands for any whitespace run. Every pattern is wrapped in Unicode
// letter/digit boundaries, so no pattern matches inside a longer word.
// ---------------------------------------------------------------------------

const VERB_A = "(?:a|am|ar|ou|aram|ando)"; // first-conjugation present/past/infinitive/gerund
const PARTICIPLE = "(?:ad[oa]s?)";
const PREP_A = "(?:a|ao|aos|as)"; // a / ao / aos / à / às after folding
const PREP_DE = "(?:de|do|da|dos|das)";

const LEXICON: Readonly<Record<LexicalCode, readonly string[]>> = {
  VAGUE_QUANTITY: [
    "vari[oa]s",
    "muit[oa]s",
    "divers[oa]s",
    "numeros[oa]s",
    "inumer[oa]s",
    "pouc[oa]s",
    "tod[oa]s [oa]s",
    "(?:a )?maioria",
    "(?:a )?maior parte",
    "grande parte",
    "(?:grande|elevado) numero",
    "a generalidade",
    "(?:dezenas|centenas|milhares) de",
    "cada vez mais",
    "crescentes?",
    "crescentemente",
  ],
  VAGUE_FREQUENCY: [
    "frequentemente",
    "com frequencia",
    "frequentes?",
    "recorrentes?",
    "recorrentemente",
    "sistematicamente",
    "constantemente",
    "regularmente",
    "habitualmente",
    "repetidamente",
    "ocasionalmente",
    "raramente",
    "(?:muitas|varias|por|as) vezes",
    "sempre",
    "nunca",
  ],
  VAGUE_SCOPE: [
    "(?:zona|zonas|area|areas|ponto|pontos|local|locais)(?:-| )chave",
    "generalizad[oa]s?",
    "generalizadamente",
    "transversa(?:l|is|lmente)",
    "globalmente",
    "em tod[oa] [oa] (?:cidade|concelho|municipio|regiao|pais|territorio|distrito|alentejo)",
    "por toda a parte",
    "em todo o lado",
    "em geral",
    "no geral",
    "de (?:um )?(?:modo|forma) geral",
    "em termos (?:gerais|globais)",
  ],
  INTENSITY_JUDGEMENT: [
    "significativ[oa]s?",
    "significativamente",
    "graves?",
    "gravemente",
    "gravissim[oa]s?",
    "critic[oa]s?",
    "enormes?",
    "enormemente",
    "drastic[oa]s?",
    "drasticamente",
    "dramatic[oa]s?",
    "dramaticamente",
    "alarmantes?",
    "sever[oa]s?",
    "severamente",
    "gritantes?",
    "flagrantes?",
    "inaceitave(?:l|is)",
    "preocupantes?",
    "extrem[oa]s?",
    "extremamente",
    "escandalos[oa]s?",
    "caotic[oa]s?",
    "caos",
    "massiv[oa]s?",
    "terrive(?:l|is)",
    "pessim[oa]s?",
    "lamentave(?:l|is)",
    "vergonhos[oa]s?",
    "fortemente",
    "profundamente",
    "altamente",
    "totalmente",
    "absolutamente",
  ],
  CERTAINTY_MARKER: [
    `comprov${VERB_A}`,
    "comprov(?:e|em)",
    `comprov${PARTICIPLE}`,
    "comprovadamente",
    `confirm${VERB_A}`,
    "confirm(?:e|em)",
    `confirm${PARTICIPLE}`,
    "confirmac(?:ao|oes)",
    `demonstr${VERB_A}`,
    `demonstr${PARTICIPLE}`,
    `prov${VERB_A}`,
    `prov${PARTICIPLE}`,
    "provas",
    "evidentes?",
    "evidentemente",
    "inequivoc[oa]s?",
    "inequivocamente",
    "indiscutive(?:l|is)",
    "indiscutivelmente",
    "inegave(?:l|is)",
    "inegavelmente",
    "incontestave(?:l|is)",
    "irrefutave(?:l|is)",
    "certamente",
    "sem duvidas?",
    "claramente",
    "obviamente",
    "obvi[oa]s?",
  ],
  CAUSAL_MARKER: [
    `devid[oa]s? ${PREP_A}`,
    `provoc${VERB_A}`,
    `provoc${PARTICIPLE}`,
    `caus${VERB_A}`,
    `caus${PARTICIPLE}`,
    "causas",
    `lev(?:a|am|ou|aram|ar) ${PREP_A}(?! cabo)`,
    `conduz(?:em|iu|iram|ir)? ${PREP_A}`,
    "result(?:a|am|ou|aram|ar) (?:em|de|do|da|dos|das|num|numa)",
    `(?:em|como) resultado ${PREP_DE}`,
    `origin${VERB_A}`,
    `ger(?:a|am|ou|aram|ar)`,
    `desencade(?:ia|iam|ou|aram|ar)`,
    "contribu(?:i|em|iu|iram|ir) para",
    "imped(?:e|em|iu|iram|ir)",
    "f(?:az|azem|ez|izeram) com que",
    `dev(?:e|em|eu|eram)-se ${PREP_A}`,
    `(?:em|por) consequencia ${PREP_DE}`,
    "consequentemente",
    "por conseguinte",
    `em virtude ${PREP_DE}`,
    `por forca ${PREP_DE}`,
    `gracas ${PREP_A}`,
    "fruto de",
    "porque",
    "visto que",
    "dado que",
    "uma vez que",
  ],
  GENERIC_POPULATION: [
    // Flagged only when unqualified: followed by punctuation, end of text, or
    // a bare conjunction — never when a qualifier ("que", "de", an adjective…) follows.
    "(?:(?:tod[oa]s? )?[oa]s? )?(?:populac(?:ao|oes)|cidadaos|residentes|moradores|habitantes|municipes|utilizadores|utentes|eborenses|pessoas|comunidade|sociedade)(?=\\s*(?:[,.;:!?)\\]]|$)|\\s+(?:e|ou)(?![\\p{L}\\p{N}]))",
    "toda a gente",
  ],
};

/** Present-currentness wording: asserts that something holds now. */
const CURRENTNESS_LEXICON: readonly string[] = [
  "atualmente",
  "presentemente",
  "neste momento",
  "de momento",
  "hoje em dia",
  "ainda hoje",
  "nos dias (?:de hoje|que correm)",
  "continu(?:a|am|ando) a",
  "persistem?",
  "mant(?:em|eem)-se",
];

/**
 * Attribution markers for non-factual EVD observations: who reports, claims,
 * holds or recommends. Presence of any marker suppresses EVD_ATTRIBUTION_ABSENT;
 * whether the attribution is adequate remains a review judgement.
 */
const ATTRIBUTION_LEXICON: readonly string[] = [
  "segundo",
  "de acordo com",
  "conforme",
  "na (?:opiniao|perspetiva|visao|otica) d[aoe]s?",
  "refer(?:e|em|iu|iram|id[oa]s?)",
  `afirm${VERB_A}`,
  `declar${VERB_A}`,
  `relat${VERB_A}`,
  "relatos?",
  `report${VERB_A}`,
  `report${PARTICIPLE}`,
  "descrev(?:e|em|eu|eram)",
  `indic${VERB_A}`,
  `consider${VERB_A}`,
  "defend(?:e|em|eu|eram)",
  "propo(?:e|em|s)",
  "propuseram",
  `recomend${VERB_A}`,
  "recomendac(?:ao|oes)",
  "suger(?:e|em|iu|iram)",
  `aleg${VERB_A}`,
  "alegadamente",
  `denunci${VERB_A}`,
  `queix${VERB_A}`,
  "queixas?",
  `reclam${VERB_A}`,
  "reclamac(?:ao|oes)",
  `critic(?:a|am|ou|aram)`,
  `apont${VERB_A}`,
  `assinal${VERB_A}`,
  `sublinh${VERB_A}`,
  `estim${VERB_A}`,
  `manifest${VERB_A}`,
  `reivindic${VERB_A}`,
  `identific${VERB_A}`,
  `identific${PARTICIPLE}`,
  `regist${VERB_A}`,
  `comunic${VERB_A}`,
  "atribu(?:i|em|iu|iram)",
  `enumer${VERB_A}`,
  "prev(?:e|eem|iu|iram)",
  "entend(?:e|em|eu|eram)",
  `acredit${VERB_A}`,
  "admit(?:e|em|iu|iram)",
  `anunci${VERB_A}`,
  `explic${VERB_A}`,
  "(?:diz|dizem|disse|disseram)",
  "(?:inquerito|inqueritos|inquiridos|respondentes|entrevistados|participantes)",
];

type ScopeTermCode =
  | typeof SIGNAL_CODE.PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE
  | typeof SIGNAL_CODE.PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE
  | typeof SIGNAL_CODE.PRB_TEMPORAL_TERM_NOT_IN_LINKED_EVIDENCE;

const YEAR_TERM = "(?:19|20)\\d{2}";

/**
 * Closed PRB scope-term lexicon (folded, same conventions as LEXICON). Each
 * entry is one term family: a PRB term is supported only by the same family
 * in linked Evidence, except a year, which is its own term. Exact lexical
 * matching only: no stemming beyond the listed inflections, no synonyms, no
 * semantic similarity.
 *
 * Only terms that state a specific scope are listed. Geography is a named
 * place or a bounded geographic expression, never a bare class noun
 * ("freguesia", "bairro", "cidade", "concelho", "município", "região"…);
 * population is a concrete group, never generic "população" or "cidadão";
 * time is a year, part of the day or week, or a recurring period, never a
 * bare month name. Those words name a kind of scope, not a scope, and alone produced
 * prompts that review could only dismiss.
 */
const SCOPE_TERM_LEXICON: Readonly<Record<ScopeTermCode, readonly string[]>> = {
  PRB_GEOGRAPHIC_TERM_NOT_IN_LINKED_EVIDENCE: [
    "evora",
    "alentejo",
    "portugal",
    "centro historico",
    "intramuros",
    "extramuros",
    "(?:zonas?|areas?|meio|freguesias?) rura(?:l|is)",
    "(?:zonas?|areas?|meio) urban[oa]s?",
    "periferias?",
  ],
  PRB_POPULATION_TERM_NOT_IN_LINKED_EVIDENCE: [
    "residentes?",
    "morador(?:es|as?)?",
    "habitantes?",
    "municipes?",
    "idos[oa]s?",
    "senior(?:es)?",
    "crianc(?:a|as)",
    "jove(?:m|ns)",
    "estudantes?",
    "alun[oa]s?",
    "famili(?:a|as)",
    "trabalhador(?:es|as?)?",
    "turistas?",
    "visitantes?",
    "utentes?",
    "utilizador(?:es|as?)?",
    "passageir[oa]s?",
    "pe(?:ao|oes|oas?)",
    "ciclistas?",
    "condutor(?:es|as?)?",
    "comerciantes?",
    "doentes?",
    "pessoas? com deficiencia",
    "pessoas? com mobilidade reduzida",
    "desempregad[oa]s?",
    "i?migrantes?",
    "sem-abrigo",
    "cuidador(?:es|as?)?",
  ],
  PRB_TEMPORAL_TERM_NOT_IN_LINKED_EVIDENCE: [
    YEAR_TERM,
    "noites?|noturn[oa]s?",
    "madrugadas?",
    "fi(?:m|ns) de semana",
    "sabados?",
    "domingos?",
    "feriados?",
    "dias? uteis",
    "horas? de ponta",
    "(?:ano|periodo) letivo",
    "ferias(?: escolares)?",
    "ver(?:ao|oes)",
    "invernos?",
  ],
};

/** Extra SRC-only evaluative wording: judgements of a Source's reliability or strength. */
const SRC_EVALUATIVE_LEXICON: readonly string[] = [
  "fiave(?:l|is)",
  "fidedign[oa]s?",
  "credive(?:l|is)",
  "robust[oa]s?",
  "rigoros[oa]s?",
  "autoritativ[oa]s?",
];

/** Non-factual EVD natures that must read as attributed (docs/datamodel.md §2). */
const NON_FACTUAL_NATURES: ReadonlySet<string> = new Set(["reported-experience", "claim", "opinion", "recommendation"]);

/** Geography levels outside the place-size ordering. */
const NON_ORDINAL_GEOGRAPHY: ReadonlySet<string> = new Set(["non_geographic", "unknown"]);

const BOUNDARY_BEFORE = "(?<![\\p{L}\\p{N}])";
const BOUNDARY_AFTER = "(?![\\p{L}\\p{N}])";

function compile(patterns: readonly string[]): RegExp {
  const body = patterns.map((p) => p.replace(/ /g, "\\s+")).join("|");
  return new RegExp(`${BOUNDARY_BEFORE}(?:${body})${BOUNDARY_AFTER}`, "gu");
}

const LEXICAL_CODES = Object.keys(LEXICON) as LexicalCode[];
const LEXICAL_PATTERNS: ReadonlyMap<LexicalCode, RegExp> = new Map(LEXICAL_CODES.map((code) => [code, compile(LEXICON[code])]));
const CURRENTNESS_PATTERN = compile(CURRENTNESS_LEXICON);
const ATTRIBUTION_PATTERN = compile(ATTRIBUTION_LEXICON);
const SRC_EVALUATIVE_PATTERN = compile([...LEXICON.INTENSITY_JUDGEMENT, ...LEXICON.CERTAINTY_MARKER, ...SRC_EVALUATIVE_LEXICON]);
const SCOPE_TERM_CODES_ORDERED = Object.keys(SCOPE_TERM_LEXICON) as ScopeTermCode[];
/** Per code, one compiled pattern per term family, in lexicon order. */
const SCOPE_TERM_PATTERNS: ReadonlyMap<ScopeTermCode, readonly { pattern: RegExp; exact: RegExp }[]> = new Map(
  SCOPE_TERM_CODES_ORDERED.map((code) => [
    code,
    SCOPE_TERM_LEXICON[code].map((term) => ({ pattern: compile([term]), exact: new RegExp(`^(?:${term.replace(/ /g, "\\s+")})$`, "u") })),
  ])
);
const YEAR_PATTERN = new RegExp(`^${YEAR_TERM}$`);
const CANONICAL_ID_PATTERN = /(?<![\p{L}\p{N}])(?:SRC|EVD|PRB)-\d+(?![\p{L}\p{N}])/gu;
const PRB_ID_PATTERN = /(?<![\p{L}\p{N}])PRB-\d+(?![\p{L}\p{N}])/gu;

// ---------------------------------------------------------------------------
// Text folding and matching. Matching runs on folded text; every reported
// excerpt/match is sliced from the original text through an index map.
// ---------------------------------------------------------------------------

interface FoldedText {
  original: string;
  folded: string;
  /** folded index -> original index; has one extra trailing entry for end positions. */
  map: number[];
}

function fold(original: string): FoldedText {
  let folded = "";
  const map: number[] = [];
  let index = 0;
  for (const ch of original) {
    const piece = ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (let k = 0; k < piece.length; k++) map.push(index);
    folded += piece;
    index += ch.length;
  }
  map.push(original.length);
  return { original, folded, map };
}

interface Match {
  start: number;
  end: number;
}

function findAll(pattern: RegExp, text: string): Match[] {
  const matches: Match[] = [];
  pattern.lastIndex = 0;
  for (const m of text.matchAll(pattern)) {
    matches.push({ start: m.index, end: m.index + m[0].length });
  }
  return matches;
}

function findFolded(pattern: RegExp, text: FoldedText): Match[] {
  return findAll(pattern, text.folded).map((m) => ({ start: text.map[m.start], end: text.map[m.end] }));
}

const EXCERPT_CONTEXT = 60;

/** Verbatim context window around a match, kept within its paragraph, cut at whole words and trimmed. */
function excerptAround(text: string, start: number, end: number): string {
  const prevBreak = text.lastIndexOf("\n\n", start - 1);
  const lineStart = prevBreak === -1 ? 0 : prevBreak + 2;
  const nextBreak = text.indexOf("\n\n", end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  let from = Math.max(lineStart, start - EXCERPT_CONTEXT);
  let to = Math.min(lineEnd, end + EXCERPT_CONTEXT);
  if (from > lineStart) {
    const space = text.indexOf(" ", from);
    if (space !== -1 && space < start) from = space + 1;
  }
  if (to < lineEnd) {
    const space = text.lastIndexOf(" ", to);
    if (space >= end) to = space;
  }
  return text.slice(from, to).trim();
}

// ---------------------------------------------------------------------------
// Authored text fields per record type.
// ---------------------------------------------------------------------------

interface TextField {
  field: string;
  text: string;
  /** Whether lexical wording families apply (PRB/EVD families, or SRC evaluative wording). */
  lexical: boolean;
  evidenceReferences?: string[];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function pushText(out: TextField[], field: string, value: unknown, lexical: boolean, evidenceReferences?: string[]): void {
  const text = asString(value);
  if (text === undefined) return;
  out.push(evidenceReferences && evidenceReferences.length > 0 ? { field, text, lexical, evidenceReferences } : { field, text, lexical });
}

function pushTextList(out: TextField[], field: string, value: unknown, lexical: boolean): void {
  if (!Array.isArray(value)) return;
  value.forEach((item, i) => pushText(out, `${field}[${i}]`, item, lexical));
}

const OPEN_QUESTION_TEXT_FIELDS = ["question", "why_open", "current_action", "latest_result", "resolution_condition"];
const PATH_STAGES = ["initial_signal", "development", "delimitation"];
const DECISION_BASIS_TEXT_FIELDS = ["eligibility_basis", "corroboration_basis", "corroboration_statement", "independence_assessment", "limitations"];
const DECISION_BASIS_SECTIONS = ["manifestation", "consequence", "currentness", "contradiction_search", "overlap_check"];

function problemTextFields(fields: RecordFields): TextField[] {
  const out: TextField[] = [];
  pushText(out, "title", fields.title, true);
  pushText(out, "geography.area", getRecordField(fields, "geography.area"), true);
  pushTextList(out, "affected_populations", fields.affected_populations, true);
  pushText(out, "problem_statement", fields.problem_statement, true);
  pushText(out, "causal_reading", fields.causal_reading, true);

  if (Array.isArray(fields.history)) {
    fields.history.forEach((entry, i) => {
      const obj = asObject(entry);
      if (!obj) return;
      for (const [key, value] of Object.entries(obj)) {
        if (key !== "date") pushText(out, `history[${i}].${key}`, value, true);
      }
    });
  }

  const questions = getRecordField(fields, "investigation.open_questions");
  if (Array.isArray(questions)) {
    questions.forEach((entry, i) => {
      const obj = asObject(entry);
      if (!obj) return;
      const refs = asStringList(obj.evidence);
      for (const key of OPEN_QUESTION_TEXT_FIELDS) pushText(out, `investigation.open_questions[${i}].${key}`, obj[key], true, refs);
    });
  }
  for (const stage of PATH_STAGES) {
    const obj = asObject(getRecordField(fields, `investigation.path.${stage}`));
    if (obj) pushText(out, `investigation.path.${stage}.summary`, obj.summary, true, asStringList(obj.evidence));
  }

  const basis = asObject(fields.decision_basis);
  if (basis) {
    for (const key of DECISION_BASIS_TEXT_FIELDS) pushText(out, `decision_basis.${key}`, basis[key], true);
    for (const section of DECISION_BASIS_SECTIONS) {
      const obj = asObject(basis[section]);
      if (!obj) continue;
      const textKey = section === "currentness" ? "assessment" : "summary";
      pushText(out, `decision_basis.${section}.${textKey}`, obj[textKey], true, asStringList(obj.evidence));
    }
    const scope = asObject(basis.scope);
    if (scope) for (const key of ["geography", "population", "temporal"]) pushText(out, `decision_basis.scope.${key}`, scope[key], true);
  }
  return out;
}

function evidenceTextFields(fields: RecordFields): TextField[] {
  const out: TextField[] = [];
  pushText(out, "observation.summary", getRecordField(fields, "observation.summary"), true, asStringList(getRecordField(fields, "provenance.sources")));
  pushText(out, "scope.geography.area", getRecordField(fields, "scope.geography.area"), false);
  pushTextList(out, "scope.populations", getRecordField(fields, "scope.populations"), false);
  pushTextList(out, "inference_limits", fields.inference_limits, false);
  return out;
}

function sourceTextFields(fields: RecordFields): TextField[] {
  const out: TextField[] = [];
  // Official names stay as published (docs/datamodel.md §1.1): checked for ID leakage only.
  pushText(out, "name", fields.name, false);
  pushText(out, "publisher", fields.publisher, false);
  pushTextList(out, "creators", fields.creators, false);
  pushText(out, "identity.version", getRecordField(fields, "identity.version"), false);
  pushText(out, "identity.snapshot_reference", getRecordField(fields, "identity.snapshot_reference"), false);
  pushText(out, "licensing.licence", getRecordField(fields, "licensing.licence"), false);
  pushText(out, "licensing.attribution", getRecordField(fields, "licensing.attribution"), false);
  pushTextList(out, "caveats", fields.caveats, true);
  return out;
}

// ---------------------------------------------------------------------------
// Signal construction.
// ---------------------------------------------------------------------------

function signal(code: SignalCode, subjectId: string, field: string, excerpt: string, extra: { match?: string; evidenceReferences?: string[] } = {}): LanguageSignal {
  return {
    code,
    dimension: SIGNAL_DIMENSION[code],
    subjectId,
    field,
    excerpt,
    ...(extra.match !== undefined ? { match: extra.match } : {}),
    severity: ADVISORY,
    ...(extra.evidenceReferences && extra.evidenceReferences.length > 0 ? { evidenceReferences: [...extra.evidenceReferences] } : {}),
  };
}

function matchSignals(code: SignalCode, subjectId: string, tf: TextField, matches: Match[]): LanguageSignal[] {
  return matches.map((m) =>
    signal(code, subjectId, tf.field, excerptAround(tf.text, m.start, m.end), {
      match: tf.text.slice(m.start, m.end),
      evidenceReferences: tf.evidenceReferences,
    })
  );
}

/**
 * Lexical family matches in one field. Where families overlap
 * ("muitas vezes" is both a quantity word and a frequency phrase), the
 * longest match wins so one wording yields one signal.
 */
function lexicalSignals(subjectId: string, tf: TextField, folded: FoldedText): LanguageSignal[] {
  const candidates: (Match & { code: LexicalCode; order: number })[] = [];
  LEXICAL_CODES.forEach((code, order) => {
    for (const m of findFolded(LEXICAL_PATTERNS.get(code)!, folded)) candidates.push({ ...m, code, order });
  });
  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.order - b.order);

  const kept: (Match & { code: LexicalCode })[] = [];
  for (const c of candidates) {
    const overlaps = kept.findIndex((k) => c.start < k.end && k.start < c.end);
    if (overlaps === -1) {
      kept.push(c);
    } else if (c.end - c.start > kept[overlaps].end - kept[overlaps].start) {
      kept[overlaps] = c;
    }
  }
  kept.sort((a, b) => a.start - b.start);
  return kept.flatMap((k) => matchSignals(k.code, subjectId, tf, [k]));
}

function hasCurrentnessBasis(fields: RecordFields): boolean {
  return asString(getRecordField(fields, "decision_basis.currentness.assessment")) !== undefined;
}

/** Ordinal geography levels, smallest to largest, taken from the EVD schema's enum order. */
function geographyRanks(index: CorpusIndex): ReadonlyMap<string, number> {
  const levels = index.byPrefix.get("EVD-")?.schema.enums?.["scope.geography.level"] ?? [];
  return new Map(levels.filter((l) => !NON_ORDINAL_GEOGRAPHY.has(l)).map((level, rank) => [level, rank]));
}

function supportingEvidenceIds(fields: RecordFields): string[] {
  if (!Array.isArray(fields.evidence)) return [];
  const ids: string[] = [];
  for (const entry of fields.evidence) {
    const obj = asObject(entry);
    const id = obj && asString(obj.evidence_id);
    if (id && asStringList(obj.effects).includes("SUPPORTS")) ids.push(id);
  }
  return ids;
}

function geographySignal(subjectId: string, fields: RecordFields, index: CorpusIndex, ranks: ReadonlyMap<string, number>): LanguageSignal[] {
  const level = asString(getRecordField(fields, "geography.level"));
  const prbRank = level === undefined ? undefined : ranks.get(level);
  if (prbRank === undefined) return [];

  const evidence = index.byPrefix.get("EVD-");
  const comparable: { id: string; rank: number }[] = [];
  for (const id of supportingEvidenceIds(fields)) {
    const evd = evidence?.byId.get(id);
    const evdLevel = evd && asString(getRecordField(evd.fields, "scope.geography.level"));
    const rank = evdLevel === undefined ? undefined : ranks.get(evdLevel);
    if (rank !== undefined) comparable.push({ id, rank });
  }
  if (comparable.length === 0 || comparable.some((c) => c.rank >= prbRank)) return [];
  return [signal(SIGNAL_CODE.PRB_GEOGRAPHY_BROADER_THAN_EVIDENCE, subjectId, "geography.level", level!, { evidenceReferences: comparable.map((c) => c.id) })];
}

// ---------------------------------------------------------------------------
// PRB scope terms against linked Evidence. Only an EVD the PRB links supports
// a term, and only through its observation.summary or scope: inference_limits
// never count as positive support, and neither does any SRC, Source
// Verification Support or unlinked EVD. Emission and the review-time check of
// a SUPPORTED disposition (orchestrate/independent-review.ts) share this one
// predicate.
// ---------------------------------------------------------------------------

/** The signal codes judged by linkedEvidenceSupportsScopeTerm(). */
export const SCOPE_TERM_CODES: ReadonlySet<SignalCode> = new Set(SCOPE_TERM_CODES_ORDERED);

/** Every EVD ID a PRB links through its `evidence[]` relationships, in authored order. */
export function linkedEvidenceIds(problem: RecordFields): string[] {
  if (!Array.isArray(problem.evidence)) return [];
  const ids: string[] = [];
  for (const entry of problem.evidence) {
    const id = asString(asObject(entry)?.evidence_id);
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function collectScalars(value: unknown, out: string[]): void {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "number") out.push(String(value));
  else if (Array.isArray(value)) value.forEach((item) => collectScalars(item, out));
  else if (value !== null && typeof value === "object") Object.values(value).forEach((item) => collectScalars(item, out));
}

/** The folded text an EVD can support a scope term through: observation.summary and every scope value. */
function scopeSupportText(evidence: RecordFields): string {
  const parts: string[] = [];
  collectScalars(getRecordField(evidence, "observation.summary"), parts);
  collectScalars(evidence.scope, parts);
  return fold(parts.join("\n")).folded;
}

function yearOf(value: unknown): number | undefined {
  const match = /^(\d{4})/.exec(typeof value === "number" ? String(value) : typeof value === "string" ? value : "");
  return match ? Number(match[1]) : undefined;
}

/** A year inside the EVD's own scope.temporal period (as_of, or start–end inclusive) is supported through scope. */
function yearInScopePeriod(evidence: RecordFields, year: number): boolean {
  const asOf = yearOf(getRecordField(evidence, "scope.temporal.as_of"));
  if (asOf !== undefined) return asOf === year;
  const start = yearOf(getRecordField(evidence, "scope.temporal.start"));
  const end = yearOf(getRecordField(evidence, "scope.temporal.end"));
  return start !== undefined && end !== undefined && start <= year && year <= end;
}

/**
 * Whether one EVD supports a PRB scope term for `code`: the same term family
 * (or, for a year, the same year) occurs in its observation.summary or scope.
 * `match` is the signal's verbatim match. Unknown codes and terms are never
 * supported.
 */
export function linkedEvidenceSupportsScopeTerm(code: SignalCode, match: string, evidence: RecordFields): boolean {
  if (!SCOPE_TERM_CODES.has(code)) return false;
  const foldedMatch = fold(match.trim()).folded;
  const text = scopeSupportText(evidence);
  if (YEAR_PATTERN.test(foldedMatch)) {
    return findAll(compile([foldedMatch]), text).length > 0 || yearInScopePeriod(evidence, Number(foldedMatch));
  }
  const family = SCOPE_TERM_PATTERNS.get(code as ScopeTermCode)!.find((entry) => entry.exact.test(foldedMatch));
  return family !== undefined && findAll(family.pattern, text).length > 0;
}

/**
 * Scope-term signals for one PRB text field: the first occurrence of each
 * term family (each year) per field, when no linked EVD supports it. Emitted
 * only for a PRB linking at least one EVD present in the index; a PRB without
 * linked Evidence has nothing to compare against here.
 */
function scopeTermSignals(subjectId: string, tf: TextField, folded: FoldedText, linked: readonly { id: string; fields: RecordFields }[]): LanguageSignal[] {
  const out: LanguageSignal[] = [];
  for (const code of SCOPE_TERM_CODES_ORDERED) {
    // Within one code, overlapping families yield the longest wording once.
    const found: (Match & { order: number })[] = [];
    SCOPE_TERM_PATTERNS.get(code)!.forEach(({ pattern }, order) => {
      for (const m of findFolded(pattern, folded)) found.push({ ...m, order });
    });
    found.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.order - b.order);
    const kept: (Match & { order: number })[] = [];
    for (const m of found) if (!kept.some((k) => m.start < k.end && k.start < m.end)) kept.push(m);

    const seen = new Set<string>();
    for (const m of kept) {
      const match = tf.text.slice(m.start, m.end);
      const key = YEAR_PATTERN.test(match) ? `year:${match}` : `term:${m.order}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (linked.some((evd) => linkedEvidenceSupportsScopeTerm(code, match, evd.fields))) continue;
      out.push(signal(code, subjectId, tf.field, excerptAround(tf.text, m.start, m.end), { match, evidenceReferences: linked.map((evd) => evd.id) }));
    }
  }
  return out;
}

function problemSignals(record: ParsedRecord, index: CorpusIndex, ranks: ReadonlyMap<string, number>): LanguageSignal[] {
  const id = record.fields.problem_id as string;
  const currentnessBasis = hasCurrentnessBasis(record.fields);
  const evidence = index.byPrefix.get("EVD-");
  const linked = linkedEvidenceIds(record.fields).flatMap((evidenceId) => {
    const evd = evidence?.byId.get(evidenceId);
    return evd ? [{ id: evidenceId, fields: evd.fields }] : [];
  });
  const out: LanguageSignal[] = [...geographySignal(id, record.fields, index, ranks)];
  for (const tf of problemTextFields(record.fields)) {
    const folded = fold(tf.text);
    out.push(...lexicalSignals(id, tf, folded));
    if (!currentnessBasis) out.push(...matchSignals(SIGNAL_CODE.PRB_CURRENTNESS_WORDING_WITHOUT_BASIS, id, tf, findFolded(CURRENTNESS_PATTERN, folded)));
    if (linked.length > 0) out.push(...scopeTermSignals(id, tf, folded, linked));
  }
  return out;
}

function evidenceSignals(record: ParsedRecord): LanguageSignal[] {
  const { fields } = record;
  const id = fields.evidence_id as string;
  const sources = asStringList(getRecordField(fields, "provenance.sources"));
  const nature = asString(fields.evidence_nature);
  const nonFactual = nature !== undefined && NON_FACTUAL_NATURES.has(nature);
  const temporalUnknown = getRecordField(fields, "scope.temporal.status") === "unknown";
  const out: LanguageSignal[] = [];

  for (const tf of evidenceTextFields(fields)) {
    if (tf.lexical) {
      const folded = fold(tf.text);
      out.push(...lexicalSignals(id, tf, folded));
      if (temporalUnknown) out.push(...matchSignals(SIGNAL_CODE.EVD_TEMPORAL_UNKNOWN_PRESENT_WORDING, id, tf, findFolded(CURRENTNESS_PATTERN, folded)));
      if (nonFactual && findFolded(ATTRIBUTION_PATTERN, folded).length === 0) {
        out.push(signal(SIGNAL_CODE.EVD_ATTRIBUTION_ABSENT, id, tf.field, tf.text.trim(), { evidenceReferences: sources }));
      }
    }
    out.push(...matchSignals(SIGNAL_CODE.PRB_ID_IN_EVD_TEXT, id, tf, findAll(PRB_ID_PATTERN, tf.text)));
  }

  if (nonFactual && Array.isArray(fields.inference_limits) && fields.inference_limits.length === 0) {
    out.push(signal(SIGNAL_CODE.EVD_INFERENCE_LIMITS_EMPTY, id, "inference_limits", "[]", { evidenceReferences: sources }));
  }
  return out;
}

function sourceSignals(record: ParsedRecord): LanguageSignal[] {
  const id = record.fields.source_id as string;
  const out: LanguageSignal[] = [];
  for (const tf of sourceTextFields(record.fields)) {
    if (tf.lexical) out.push(...matchSignals(SIGNAL_CODE.SRC_EVALUATIVE_WORDING, id, tf, findFolded(SRC_EVALUATIVE_PATTERN, fold(tf.text))));
    out.push(...matchSignals(SIGNAL_CODE.SRC_RECORD_ID_IN_TEXT, id, tf, findAll(CANONICAL_ID_PATTERN, tf.text)));
  }
  return out;
}

export interface DetectOptions {
  /** Limit subjects to these record IDs (e.g. records changed against a Git base). Cross-record context still reads the whole index. */
  subjectIds?: ReadonlySet<string>;
}

/**
 * Detects advisory CLEC signals across the canonical corpus, in a
 * deterministic order: PRB, then EVD, then SRC records (each in index order),
 * then field order, then position. Records are read only; nothing is rewritten.
 */
export function detectLanguageSignals(index: CorpusIndex, options: DetectOptions = {}): LanguageSignal[] {
  const ranks = geographyRanks(index);
  const include = (record: ParsedRecord, idField: string): boolean => {
    const id = record.fields[idField];
    return typeof id === "string" && (options.subjectIds === undefined || options.subjectIds.has(id));
  };
  const records = (prefix: string): ParsedRecord[] => {
    const set = index.byPrefix.get(prefix);
    return set ? set.records.filter((r) => include(r, set.schema.idField)) : [];
  };

  return [
    ...records("PRB-").flatMap((r) => problemSignals(r, index, ranks)),
    ...records("EVD-").flatMap((r) => evidenceSignals(r)),
    ...records("SRC-").flatMap((r) => sourceSignals(r)),
  ];
}

// ---------------------------------------------------------------------------
// Context-free blocking policy (docs/investigationstrategy.md §12).
// ---------------------------------------------------------------------------

/** The one failure identity for a context-free blocker, in every enforcement path. */
export const CONTEXT_FREE_BLOCK = "CLEC_CONTEXT_FREE_BLOCK" as const;

/**
 * Signal codes rejected deterministically before semantic review. Canonical
 * record IDs in authored SRC text, and PRB IDs in authored EVD text, couple a
 * record to internal research state of another layer; the code alone decides
 * this, with no evidence or context lookup. Every other code stays advisory.
 */
export const CONTEXT_FREE_BLOCKING_CODES: ReadonlySet<SignalCode> = new Set([SIGNAL_CODE.SRC_RECORD_ID_IN_TEXT, SIGNAL_CODE.PRB_ID_IN_EVD_TEXT]);

/**
 * The context-free blockers among a review unit's signals (for example a
 * reviewer package's `{ signalId, signal }` entries), unchanged and in their
 * given order. Empty means the unit proceeds to semantic review.
 */
export function contextFreeBlockers<T extends { signal: LanguageSignal }>(signals: readonly T[]): T[] {
  return signals.filter((entry) => CONTEXT_FREE_BLOCKING_CODES.has(entry.signal.code));
}

/** A deterministic report of context-free blockers: one line per signal, quoting the authored location. */
export function describeContextFreeBlockers(blockers: readonly { signalId: string; signal: LanguageSignal }[]): string {
  const lines = blockers.map(({ signalId, signal: s }) =>
    `${signalId} ${s.code} ${s.subjectId} ${s.field}: ${JSON.stringify(s.match ?? s.excerpt)} in ${JSON.stringify(s.excerpt)}`
  );
  return [
    "canonical record text embeds internal record IDs across research layers; correct the text before independent semantic review (a review cannot waive this):",
    ...lines,
  ].join("\n  ");
}

/**
 * Maps research-root-relative record file paths (e.g. "evidence/EVD-000001.yaml")
 * to the IDs of the canonical records loaded from them. Paths that are not
 * canonical record files (schemas, deleted files, other directories) are ignored.
 */
export function subjectIdsForFiles(index: CorpusIndex, files: readonly string[]): Set<string> {
  const wanted = new Set(files.map((f) => f.split("\\").join("/")));
  const ids = new Set<string>();
  for (const set of index.byPrefix.values()) {
    for (const record of set.records) {
      const id = record.fields[set.schema.idField];
      if (wanted.has(record.file) && typeof id === "string") ids.add(id);
    }
  }
  return ids;
}
