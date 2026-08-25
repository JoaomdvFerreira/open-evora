/** Presentation-only PT-PT terminology. Canonical data remains unchanged. */
const LABELS: Record<string, Record<string, string>> = {
  validation_status: { unvalidated: "Por validar", partially_validated: "Parcialmente validado", validated: "Validado" },
  solution_landscape_status: { not_assessed: "Não avaliadas", assessed: "Avaliadas" },
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
  "scope.geography.level": { site: "Local específico", local_area: "Área local", parish: "Freguesia", city: "Cidade", municipality: "Município", intermunicipal: "Intermunicipal", regional: "Regional", national: "Nacional", international: "Internacional", non_geographic: "Sem âmbito geográfico", unknown: "Desconhecido" },
  resource_type: { webpage: "Página web", document: "Documento", dataset: "Conjunto de dados", database: "Base de dados", service: "Serviço", correspondence: "Correspondência", other: "Outro", unknown: "Desconhecido" },
  level: { public: "Público", restricted: "Restrito", private: "Privado", unknown: "Desconhecido" },
  availability: { available: "Disponível", unavailable: "Indisponível", unknown: "Desconhecida" },
  method: { browser: "Navegador", download: "Transferência", api: "API", feed: "Feed", gis_service: "Serviço GIS", direct: "Acesso direto", other: "Outro", unknown: "Desconhecido" },
  format: { html: "HTML", pdf: "PDF", csv: "CSV", json: "JSON", xml: "XML", xlsx: "XLSX", kml: "KML", geojson: "GeoJSON", image: "Imagem", video: "Vídeo", text: "Texto", other: "Outro", unknown: "Desconhecido" },
  authority: { authoritative: "Com autoridade", "verified-third-party": "Terceiro verificado", community: "Comunitária", derived: "Derivada", estimated: "Estimada", unknown: "Desconhecida" },
  freshness: { CURRENT: "Atual", STALE: "Desatualizada", UNKNOWN: "Desconhecida", UNAVAILABLE: "Indisponível" },
  "licensing.status": { known: "Conhecido", unknown: "Desconhecido" },
  "licensing.reuse": { permitted: "Permitida", restricted: "Restrita", prohibited: "Proibida", unknown: "Desconhecida" },
  type: { institutional: "Institucional", statistical: "Estatística", "formal-public": "Fonte pública formal", social: "Social", press: "Imprensa", stakeholder: "Interveniente", observation: "Observação" },
  update_frequency: { one_off: "Pontual", daily: "Diária", weekly: "Semanal", monthly: "Mensal", quarterly: "Trimestral", annual: "Anual", irregular: "Irregular", unknown: "Desconhecida" },
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
  status: "Estado", validation_status: "Estado de validação", evidence_status: "Estado da evidência", digital_tractability: "Tratabilidade digital", solution_landscape_status: "Soluções existentes", strength: "Força da evidência", type: "Tipo", evidence_nature: "Natureza da evidência", friction_types: "Tipos de fricção", verification: "Verificação", contribution: "Contribuição", public_signal_class: "Classe de sinal público", representativeness: "Representatividade", temporal_relevance: "Relevância temporal", geography: "Âmbito geográfico", authority: "Autoridade", freshness: "Atualidade",
  resource_type: "Tipo de recurso", "access.level": "Nível de acesso", "access.availability": "Disponibilidade", "access.method": "Forma de consulta", "access.format": "Formato", "access.machine_readable": "Leitura automática",
  "scope.geography.level": "Âmbito geográfico", "scope.geography.area": "Área", "scope.temporal": "Cobertura temporal", "scope.domains": "Temas",
  "scope.temporal.as_of": "Data de referência", "scope.temporal.start": "Início", "scope.temporal.end": "Fim",
  "licensing.status": "Estado do licenciamento", "licensing.licence": "Licença", "licensing.reuse": "Reutilização", "licensing.attribution": "Atribuição",
  update_frequency: "Frequência de atualização", published_at: "Publicação", updated_at: "Última atualização da fonte", last_checked_at: "Última verificação pela Open Évora",
  canonical_reference: "Referência original",
};

const PS_LABELS: Record<string, string> = {
  PS1: "Jornalismo local / notícias públicas", PS2: "Discussão pública social/comunitária", PS3: "Avaliações e superfícies públicas de feedback", PS4: "Petições públicas / intervenções cívicas / participações em reuniões", PS5: "Sínteses públicas institucionais de reclamações/participação", PS6: "Sinais operacionais abertos",
};

export function publicEnumLabel(field: string, value: string): string {
  const terminalField = field.split(".").at(-1) ?? field;
  const labelField = field === "scope.geography.level"
    ? "scope.geography.level"
    : field === "licensing.status"
      ? "licensing.status"
      : field === "licensing.reuse"
        ? "licensing.reuse"
        : field.startsWith("freshness.")
          ? "freshness"
          : field.startsWith("geography.")
            ? "geography"
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
  if ((field.startsWith("access.") || field.startsWith("scope.") || field.startsWith("licensing.")) && FIELD_CAPTIONS[field]) return FIELD_CAPTIONS[field];
  const terminalField = field.split(".").at(-1) ?? field;
  const captionField = field.startsWith("geography.") ? "geography" : field.startsWith("analysis.public_signal_class") ? "public_signal_class" : terminalField;
  return FIELD_CAPTIONS[captionField] ?? field;
}

const TRI_STATE_LABELS = { true: "Sim", false: "Não", unknown: "Desconhecida" } as const;

/**
 * For canonical tri-state fields like `access.machine_readable`, whose values are the booleans
 * `true`/`false` plus the literal string `"unknown"`. Never treats `"unknown"` as `false` and
 * never infers a value from any other field.
 */
export function publicTriStateLabel(value: boolean | "unknown"): string {
  return TRI_STATE_LABELS[String(value) as "true" | "false" | "unknown"];
}

export function formatPublicCount(value: number): string {
  return new Intl.NumberFormat("pt-PT").format(value);
}

export function formatPublicDateTime(isoValue: string): string {
  const date = new Date(isoValue);
  return Number.isNaN(date.valueOf()) ? isoValue : new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** For date-only canonical values (e.g. `temporal.last_checked_at`, `YYYY-MM-DD`) — `formatPublicDateTime`'s `timeStyle` would fabricate a local-timezone time no canonical field carries. */
export function formatPublicDate(isoValue: string): string {
  const date = new Date(isoValue);
  return Number.isNaN(date.valueOf()) ? isoValue : new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" }).format(date);
}

const YEAR_ONLY = /^\d{4}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;
const YEAR_MONTH_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * For canonical SRC scope temporal values, whose precision may be year, year-month, or full
 * date. Unlike `formatPublicDate`, never routes partial values through `new Date`, which would
 * fabricate a month/day no canonical field carries. Renders exactly the input's precision.
 */
export function formatPublicPartialDate(value: string): string {
  if (YEAR_ONLY.test(value)) return value;

  if (YEAR_MONTH.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (month < 1 || month > 12) return value;
    const date = new Date(Date.UTC(year, month - 1, 1));
    return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  }

  if (YEAR_MONTH_DAY.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    if (month < 1 || month > 12) return value;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1) return value;
    return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  }

  return value;
}
