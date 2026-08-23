/**
 * Canonical-value-plus-gloss pairs for Problem View's "Estado atual" fields
 * (`research/schemas/problem.schema.json`, `docs/models/problem-model.md`).
 * The canonical value itself always remains visible at the call site —
 * `label` is a short, safe rendering (either the schema's own terminology,
 * grounded prose from problem-model.md, or a literal, non-semantic PT
 * translation of the enum word that adds no criterion beyond translation).
 * `explanation`, where present, paraphrases problem-model.md's own prose.
 * Where problem-model.md defines nothing beyond the enum member itself (all
 * four `digital_tractability` values, `existing_solutions`), no explanation
 * is manufactured — see docs/design/research-explorer-design-foundations.md
 * §8 and prototype-rationale.md's "Glosses that could not be canonically
 * grounded".
 *
 * `evidence_status`'s `discovered` <-> `corroborated` ordering is a
 * documented exception: `docs/models/problem-model.md`'s own "## Lifecycle"
 * section explicitly draws `DISCOVERED -> CORROBORATED -> ...` as a named,
 * ordered progression (not merely the schema enum's array order, which
 * alone would not be sufficient grounding) — corroborated further by actual
 * corpus practice recording this exact transition (e.g.
 * `docs/discovery/rs-02b1-focused-desk-research-progress.md`: "`evidence_status`
 * `discovered -> corroborated`" on `PRB-0004`). What remains genuinely
 * undocumented, and is therefore never claimed here, is the specific
 * criterion that distinguishes the two (in particular, no source states or
 * implies independent-source corroboration).
 */

export interface FieldGloss {
  label: string;
  explanation?: string;
}

type FieldGlossMap = Record<string, FieldGloss>;

const STATUS_GLOSS: FieldGlossMap = {
  OPEN: {
    label: "Aberto",
    explanation:
      "ainda não atingiu um dos resultados terminais do modelo canónico — por exemplo, rejeitado, identificado como duplicado, considerado não digital, já resolvido, ou encerrado por evidência insuficiente.",
  },
  REJECTED: { label: "Rejeitado" },
  DUPLICATE: { label: "Duplicado" },
  NON_DIGITAL: { label: "Não digital" },
  ALREADY_SOLVED: { label: "Já resolvido" },
  INSUFFICIENT_EVIDENCE: { label: "Evidência insuficiente" },
};

const VALIDATION_STATUS_GLOSS: FieldGlossMap = {
  unvalidated: {
    label: "Por validar",
    explanation:
      "ainda não foi concluído um desafio deliberado ao enquadramento atual, ou a evidência direta ainda é insuficiente para o sustentar; não significa que o problema seja falso.",
  },
  partially_validated: {
    label: "Parcialmente validado",
    explanation:
      "uma ou mais partes materiais do diagnóstico foram diretamente desafiadas e apoiadas/refinadas, mas pelo menos uma dimensão decisiva permanece por resolver.",
  },
  validated: {
    label: "Validado",
    explanation: "o enquadramento canónico atual resistiu a um desafio direto proporcional, ao nível necessário para a próxima decisão do programa.",
  },
};

const EVIDENCE_STATUS_GLOSS: FieldGlossMap = {
  discovered: { label: "Evidência identificada" },
  corroborated: {
    label: "Evidência corroborada",
    explanation:
      "surge depois de \"evidência identificada\" na sequência do ciclo de vida documentada para o Problema; o critério exato de distinção entre os dois valores não está documentado nos modelos consultados.",
  },
};

const DIGITAL_TRACTABILITY_GLOSS: FieldGlossMap = {
  not_assessed: { label: "Tratabilidade digital não avaliada" },
  low: { label: "Tratabilidade digital: baixa" },
  medium: { label: "Tratabilidade digital: média" },
  high: { label: "Tratabilidade digital: alta" },
};

const EXISTING_SOLUTIONS_GLOSS: FieldGlossMap = {
  not_assessed: { label: "Soluções existentes: não avaliadas" },
  assessed: { label: "Soluções existentes: avaliadas" },
};

/**
 * `decision_gates.*` PASS/PARTIAL/FAIL/UNKNOWN/NOT_ASSESSED glosses —
 * paraphrased verbatim from docs/discovery/d3-execution-protocol.md §5.1b.
 * PARTIAL vs UNKNOWN is the distinction the protocol explicitly added
 * WU-D3-03 to preserve (§5.1b): "we have something, but not enough" vs
 * "we have nothing to characterize this gate with at all" — collapsing them
 * would hide exactly the information a reader needs here.
 */
const DECISION_GATE_GLOSS: FieldGlossMap = {
  PASS: { label: "Cumpre", explanation: "existe evidência suficiente para sustentar a decisão nesta fase." },
  PARTIAL: {
    label: "Cumpre parcialmente",
    explanation: "existe evidência real e relevante, mas insuficiente para considerar o critério cumprido — distinto de \"desconhecido\", que significa não haver evidência alguma.",
  },
  FAIL: { label: "Não cumpre", explanation: "a evidência disponível sustenta a conclusão de que o critério não é cumprido." },
  UNKNOWN: { label: "Desconhecido", explanation: "não existe evidência suficiente, ou nenhuma, para caracterizar este critério." },
  NOT_ASSESSED: { label: "Não avaliado", explanation: "este critério ainda não foi avaliado nesta investigação." },
};

/**
 * `triage` glosses — paraphrased from docs/discovery/d3-execution-protocol.md
 * §5.2. STOP/WATCH carry an explicit, canonically-grounded caveat: they
 * describe Open Évora's project posture, never a judgement of the
 * underlying civic problem's importance (see PRB-0009/ASM-0009, the
 * protocol's own paradigm case: civic_importance PASS, triage WATCH).
 */
const TRIAGE_GLOSS: FieldGlossMap = {
  STOP: {
    label: "Não prosseguir",
    explanation:
      "o projeto não vai investir mais esforço de investigação/intervenção nesta formulação do problema — por exemplo, por não haver alavancagem digital, a lacuna já estar coberta, ou outro mecanismo ser claramente mais adequado. É um desfecho legítimo, não uma falha, e nunca uma afirmação de que o problema cívico não importa.",
  },
  WATCH: {
    label: "Acompanhar",
    explanation:
      "o projeto não está, para já, a aprofundar ou a construir uma solução, mas mantém o problema sob observação, para o caso de a situação mudar ou surgir uma lacuna concreta a resolver. Não é uma afirmação de que o problema cívico não importa.",
  },
  DEEPEN: {
    label: "Aprofundar",
    explanation: "existe pelo menos um critério de decisão bloqueado por uma incerteza crítica; o projeto vai recolher evidência específica para o resolver.",
  },
  PROCEED: {
    label: "Prosseguir",
    explanation: "existe compreensão suficiente para avançar para a fase seguinte de investigação — não é, por si só, autorização para construir software.",
  },
};

/**
 * `evidence_confidence.contradiction_status` — deliberately **not** the
 * generic `confidence` HIGH/MEDIUM/LOW label set. Protocol §5.1a: this field
 * measures the degree of contradiction PRESENT in the evidence, not the
 * assessor's confidence in the call — LOW is the coherent/good state, HIGH
 * is the state with substantial unresolved contradiction. A literal
 * "Elevado/Baixo" translation reads naturally as a confidence scale and
 * would invite exactly the misreading this gloss exists to prevent.
 */
const CONTRADICTION_STATUS_GLOSS: FieldGlossMap = {
  LOW: { label: "Baixo grau de contradição", explanation: "a base de evidência é coerente — existe pouca ou nenhuma contradição por resolver." },
  MEDIUM: { label: "Grau de contradição médio", explanation: "existe alguma contradição na base de evidência, ainda não totalmente resolvida." },
  HIGH: { label: "Grau de contradição elevado", explanation: "existe contradição substancial e por resolver na base de evidência." },
  UNKNOWN: { label: "Grau de contradição desconhecido", explanation: "não é possível, atualmente, caracterizar o grau de contradição na base de evidência." },
  NOT_ASSESSED: { label: "Grau de contradição não avaliado" },
};

const FIELD_GLOSSARIES: Record<string, FieldGlossMap> = {
  status: STATUS_GLOSS,
  validation_status: VALIDATION_STATUS_GLOSS,
  evidence_status: EVIDENCE_STATUS_GLOSS,
  digital_tractability: DIGITAL_TRACTABILITY_GLOSS,
  existing_solutions: EXISTING_SOLUTIONS_GLOSS,
  decision_gate: DECISION_GATE_GLOSS,
  triage: TRIAGE_GLOSS,
  contradiction_status: CONTRADICTION_STATUS_GLOSS,
};

/** PT captions for every "Estado atual" field — used as the accessible field context for a status chip (screen readers otherwise lose the field-name context a `<dt>/<dd>` pair used to give). */
export const FIELD_CAPTIONS: Record<string, string> = {
  status: "Estado",
  validation_status: "Estado de validação",
  evidence_status: "Estado da evidência",
  digital_tractability: "Tratabilidade digital",
  existing_solutions: "Soluções existentes",
};

/** PT captions for the four fields explained in the point-of-use Problem help disclosure. */
export const DISCLOSURE_FIELD_LABELS: Record<string, string> = {
  status: "Estado",
  validation_status: "Estado de validação",
  evidence_status: "Estado da evidência",
  digital_tractability: "Tratabilidade digital",
};

/** Fields explained in the point-of-use disclosure, in Estado-atual order. `existing_solutions` is deliberately excluded — no grounded prose exists for it beyond the enum itself. */
export const DISCLOSURE_FIELDS = ["status", "validation_status", "evidence_status", "digital_tractability"] as const;

/** Returns a safe label/explanation pair for a known field+value, or null when nothing safe exists — callers must still render the canonical value regardless of this result. */
export function glossFor(field: string, value: string): FieldGloss | null {
  const glossaryField = field.startsWith("decision_gates.")
    ? "decision_gate"
    : field === "evidence_confidence.contradiction_status"
      ? "contradiction_status"
      : field;
  return FIELD_GLOSSARIES[glossaryField]?.[value] ?? null;
}
