/**
 * Canonical-value-plus-gloss pairs for Problem View's "Estado atual" fields
 * (`research/schemas/problem.schema.json`, `docs/datamodel.md`).
 * The canonical value itself always remains visible at the call site —
 * `label` is a short, safe rendering (either the schema's own terminology,
 * grounded prose from docs/datamodel.md, or a literal, non-semantic PT
 * translation of the enum word that adds no criterion beyond translation).
 * `explanation`, where present, paraphrases docs/datamodel.md's own prose.
 * Where docs/datamodel.md defines nothing beyond the enum member itself (all
 * four `digital_tractability` values, `solution_landscape_status`), no
 * explanation is manufactured.
 *
 * `evidence_status`'s `discovered` <-> `corroborated` ordering is a
 * documented progression (not merely the schema enum's array order, which
 * alone would not be sufficient grounding) — see docs/datamodel.md's
 * Corroboration concept. What remains genuinely undocumented, and is
 * therefore never claimed here, is the specific criterion that distinguishes
 * the two (in particular, no source states or implies independent-source
 * corroboration).
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

const SOLUTION_LANDSCAPE_STATUS_GLOSS: FieldGlossMap = {
  not_assessed: { label: "Soluções existentes: não avaliadas" },
  assessed: { label: "Soluções existentes: avaliadas" },
};

const FIELD_GLOSSARIES: Record<string, FieldGlossMap> = {
  status: STATUS_GLOSS,
  validation_status: VALIDATION_STATUS_GLOSS,
  evidence_status: EVIDENCE_STATUS_GLOSS,
  digital_tractability: DIGITAL_TRACTABILITY_GLOSS,
  solution_landscape_status: SOLUTION_LANDSCAPE_STATUS_GLOSS,
};

/** PT captions for every "Estado atual" field — used as the accessible field context for a status chip (screen readers otherwise lose the field-name context a `<dt>/<dd>` pair used to give). */
export const FIELD_CAPTIONS: Record<string, string> = {
  status: "Estado",
  validation_status: "Estado de validação",
  evidence_status: "Estado da evidência",
  digital_tractability: "Tratabilidade digital",
  solution_landscape_status: "Soluções existentes",
};

/** PT captions for the four fields explained in the point-of-use Problem help disclosure. */
export const DISCLOSURE_FIELD_LABELS: Record<string, string> = {
  status: "Estado",
  validation_status: "Estado de validação",
  evidence_status: "Estado da evidência",
  digital_tractability: "Tratabilidade digital",
};

/** Fields explained in the point-of-use disclosure, in Estado-atual order. `solution_landscape_status` is deliberately excluded — no grounded prose exists for it beyond the enum itself. */
export const DISCLOSURE_FIELDS = ["status", "validation_status", "evidence_status", "digital_tractability"] as const;

/** Returns a safe label/explanation pair for a known field+value, or null when nothing safe exists — callers must still render the canonical value regardless of this result. */
export function glossFor(field: string, value: string): FieldGloss | null {
  return FIELD_GLOSSARIES[field]?.[value] ?? null;
}
