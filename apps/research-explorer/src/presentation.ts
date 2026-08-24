/** Presentation-only PT-PT terminology. Canonical data remains unchanged. */
const LABELS: Record<string, Record<string, string>> = {
  validation_status: { unvalidated: "Por validar", partially_validated: "Parcialmente validado", validated: "Validado" },
  existing_solutions: { not_assessed: "Não avaliadas", assessed: "Avaliadas" },
  status: { OPEN: "Aberto", REJECTED: "Rejeitado", DUPLICATE: "Duplicado", NON_DIGITAL: "Não digital", ALREADY_SOLVED: "Já resolvido", INSUFFICIENT_EVIDENCE: "Evidência insuficiente" },
  evidence_status: { discovered: "Evidência identificada", corroborated: "Evidência corroborada" },
  digital_tractability: { not_assessed: "Não avaliada", low: "Baixa", medium: "Média", high: "Alta" },
  strength: { "primary-authoritative": "Primária com autoridade", "primary-non-authoritative": "Primária sem autoridade sobre o facto", secondary: "Secundária", anecdotal: "Anecdótica" },
  evidence_nature: { fact: "Facto", "reported-experience": "Experiência relatada", opinion: "Opinião", claim: "Alegação", measurement: "Medição", recommendation: "Recomendação" },
  friction_types: { INFORMATION: "Informação", COORDINATION: "Coordenação", TRANSACTION: "Transação", OPERATIONAL: "Operacional", PHYSICAL: "Física", REGULATORY: "Regulatória", OTHER: "Outra" },
  verification: { REPORTED: "Reportada", CORROBORATED: "Corroborada", VERIFIED: "Verificada", UNKNOWN: "Desconhecida", NOT_APPLICABLE: "Não aplicável" },
  contribution: { CONFIRMS: "Confirma", REFINES: "Refina", CONTRADICTS: "Contradiz", "CURRENT-STATE-UPDATE": "Atualização do estado atual", "EXISTING-SOLUTION": "Solução existente", "PLANNED-SOLUTION": "Solução planeada", "NEW-CANDIDATE": "Novo candidato" },
  representativeness: { UNKNOWN: "Desconhecida", LIMITED: "Limitada", DESIGNED_REPRESENTATIVE: "Concebida como representativa", NOT_APPLICABLE: "Não aplicável" },
  temporal_relevance: { CURRENT: "Atual", HISTORICAL: "Histórica", SUPERSEDED: "Substituída", UNKNOWN: "Desconhecida" },
  geography: { city: "Cidade", parish: "Freguesia", municipality: "Município", intermunicipal: "Intermunicipal", regional: "Regional" },
  source_type: { api: "API", dataset: "Conjunto de dados", gis: "Sistema de Informação Geográfica", web: "Página web", document: "Documento", database: "Base de dados", feed: "Fluxo de dados", unknown: "Desconhecido" },
  authority: { authoritative: "Com autoridade", "verified-third-party": "Terceiro verificado", community: "Comunitária", derived: "Derivada", estimated: "Estimada", unknown: "Desconhecida" },
  freshness: { CURRENT: "Atual", STALE: "Desatualizada", UNKNOWN: "Desconhecida", UNAVAILABLE: "Indisponível" },
  licensing: { known: "Conhecida", unknown: "Desconhecida", restricted: "Restrita" },
  type: { institutional: "Institucional", statistical: "Estatística", "formal-public": "Fonte pública formal", social: "Social", press: "Imprensa", stakeholder: "Interveniente", observation: "Observação" },
};

/**
 * UX-D §4 finding F01: compact labels agree grammatically with the dimension
 * noun they're displayed after ("Validação: <label>" / "Evidência: <label>"),
 * distinct from the full/non-compact LABELS mapping used elsewhere.
 */
const COMPACT_LABELS: Record<string, Record<string, string>> = {
  validation_status: { unvalidated: "Por validar", partially_validated: "Parcialmente validada", validated: "Validada" },
  evidence_status: { discovered: "Identificada", corroborated: "Corroborada" },
};

const FIELD_CAPTIONS: Record<string, string> = {
  status: "Estado", validation_status: "Estado de validação", evidence_status: "Estado da evidência", digital_tractability: "Tratabilidade digital", existing_solutions: "Soluções existentes", strength: "Força da evidência", type: "Tipo", evidence_nature: "Natureza da evidência", friction_types: "Tipos de fricção", verification: "Verificação", contribution: "Contribuição", public_signal_class: "Classe de sinal público", representativeness: "Representatividade", temporal_relevance: "Relevância temporal", geography: "Âmbito geográfico", source_type: "Tipo de fonte", authority: "Autoridade", freshness: "Atualidade", licensing: "Licenciamento",
};

const PS_LABELS: Record<string, string> = {
  PS1: "Jornalismo local / notícias públicas", PS2: "Discussão pública social/comunitária", PS3: "Avaliações e superfícies públicas de feedback", PS4: "Petições públicas / intervenções cívicas / participações em reuniões", PS5: "Sínteses públicas institucionais de reclamações/participação", PS6: "Sinais operacionais abertos",
};

export function publicEnumLabel(field: string, value: string): string {
  const terminalField = field.split(".").at(-1) ?? field;
  const labelField = field.startsWith("freshness.")
    ? "freshness"
    : field.startsWith("geography.")
      ? "geography"
      : field.startsWith("licensing.")
        ? "licensing"
        : terminalField;
  const signalLabel = field === "analysis.public_signal_class" ? PS_LABELS[value] : undefined;
  return LABELS[labelField]?.[value] ?? (signalLabel ? `${value} — ${signalLabel}` : value);
}

/** Compact, field-aware labels for dense presentation surfaces. */
export function publicCompactEnumLabel(field: string, value: string): string {
  const terminalField = field.split(".").at(-1) ?? field;
  return COMPACT_LABELS[terminalField]?.[value] ?? publicEnumLabel(field, value);
}

export function publicFieldCaption(field: string): string {
  const terminalField = field.split(".").at(-1) ?? field;
  const captionField = field.startsWith("geography.") ? "geography" : field.startsWith("licensing.") ? "licensing" : field.startsWith("analysis.public_signal_class") ? "public_signal_class" : terminalField;
  return FIELD_CAPTIONS[captionField] ?? field;
}

export function formatPublicCount(value: number): string {
  return new Intl.NumberFormat("pt-PT").format(value);
}

export function formatPublicDateTime(isoValue: string): string {
  const date = new Date(isoValue);
  return Number.isNaN(date.valueOf()) ? isoValue : new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
