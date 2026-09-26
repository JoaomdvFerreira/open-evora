import { describe, expect, it } from "vitest";
import { formatPublicCompactDate, formatPublicCount, formatPublicDate, formatPublicDateTime, formatPublicPartialDate, formatPublicRelativeDays, publicCompactEnumLabel, publicEnumExplanation, publicEnumLabel, publicFieldCaption, publicTriStateLabel } from "./presentation";

describe("PT-PT public presentation terminology", () => {
  it("uses field-aware PRB validation labels", () => {
    expect(publicEnumLabel("validation_status", "unvalidated")).toBe("Por validar");
    expect(publicEnumLabel("solution_landscape_status", "not_assessed")).toBe("Não avaliadas");
  });

  it("uses a shorter field-aware label in compact problem status presentation, agreeing grammatically with its dimension noun", () => {
    expect(publicCompactEnumLabel("evidence_status", "discovered")).toBe("Identificada");
    expect(publicCompactEnumLabel("evidence_status", "corroborated")).toBe("Corroborada");
    expect(publicCompactEnumLabel("validation_status", "unvalidated")).toBe("Por validar");
    expect(publicCompactEnumLabel("validation_status", "partially_validated")).toBe("Parcialmente validada");
    expect(publicCompactEnumLabel("validation_status", "validated")).toBe("Validada");
  });

  it("falls back to the full label when a field has no compact mapping for a value, preserving the full non-compact mapping", () => {
    expect(publicEnumLabel("validation_status", "validated")).toBe("Validado");
  });

  it("maps EVD vNext relationship and claim-authority values centrally", () => {
    expect(publicEnumLabel("claim_authority", "authoritative")).toBe("Com autoridade");
    expect(publicEnumLabel("effects", "SUPPORTS")).toBe("Sustenta");
    expect(publicEnumLabel("effects", "REFINES")).toBe("Refina");
    expect(publicEnumLabel("effects", "BOUNDS")).toBe("Delimita");
    expect(publicEnumLabel("effects", "CONTRADICTS")).toBe("Contradiz");
    expect(publicEnumLabel("research_roles", "COMPARATIVE_MECHANISM")).toBe("Mecanismo comparativo");
    expect(publicEnumLabel("research_roles", "PLANNED_RESPONSE")).toBe("Resposta planeada");
  });

  it("formats public counts and timestamps for Portugal", () => {
    expect(formatPublicCount(12345)).toMatch(/12/);
    expect(formatPublicDateTime("2026-08-21T14:30:00Z")).not.toBe("2026-08-21T14:30:00Z");
  });

  it("uses the canonical value as the safe fallback for unknown future values", () => {
    expect(publicEnumLabel("status", "FUTURE_STATUS")).toBe("FUTURE_STATUS");
  });

  it("maps all SRC v2 resource_type values", () => {
    expect(publicEnumLabel("resource_type", "webpage")).toBe("Página web");
    expect(publicEnumLabel("resource_type", "document")).toBe("Documento");
    expect(publicEnumLabel("resource_type", "dataset")).toBe("Conjunto de dados");
    expect(publicEnumLabel("resource_type", "database")).toBe("Base de dados");
    expect(publicEnumLabel("resource_type", "service")).toBe("Serviço");
    expect(publicEnumLabel("resource_type", "correspondence")).toBe("Correspondência");
    expect(publicEnumLabel("resource_type", "other")).toBe("Outro");
    expect(publicEnumLabel("resource_type", "unknown")).toBe("Desconhecido");
  });

  it("maps all SRC v2 access.level values", () => {
    expect(publicEnumLabel("access.level", "public")).toBe("Público");
    expect(publicEnumLabel("access.level", "restricted")).toBe("Restrito");
    expect(publicEnumLabel("access.level", "private")).toBe("Privado");
    expect(publicEnumLabel("access.level", "unknown")).toBe("Desconhecido");
  });

  it("maps all SRC v2 access.availability values", () => {
    expect(publicEnumLabel("access.availability", "available")).toBe("Disponível");
    expect(publicEnumLabel("access.availability", "unavailable")).toBe("Indisponível");
    expect(publicEnumLabel("access.availability", "unknown")).toBe("Desconhecida");
  });

  it("maps all SRC v2 access.method values", () => {
    expect(publicEnumLabel("access.method", "browser")).toBe("Navegador");
    expect(publicEnumLabel("access.method", "download")).toBe("Transferência");
    expect(publicEnumLabel("access.method", "api")).toBe("API");
    expect(publicEnumLabel("access.method", "feed")).toBe("Feed");
    expect(publicEnumLabel("access.method", "gis_service")).toBe("Serviço GIS");
    expect(publicEnumLabel("access.method", "direct")).toBe("Acesso direto");
    expect(publicEnumLabel("access.method", "other")).toBe("Outro");
    expect(publicEnumLabel("access.method", "unknown")).toBe("Desconhecido");
  });

  it("maps all SRC v2 access.format values", () => {
    expect(publicEnumLabel("access.format", "html")).toBe("HTML");
    expect(publicEnumLabel("access.format", "pdf")).toBe("PDF");
    expect(publicEnumLabel("access.format", "csv")).toBe("CSV");
    expect(publicEnumLabel("access.format", "json")).toBe("JSON");
    expect(publicEnumLabel("access.format", "xml")).toBe("XML");
    expect(publicEnumLabel("access.format", "xlsx")).toBe("XLSX");
    expect(publicEnumLabel("access.format", "kml")).toBe("KML");
    expect(publicEnumLabel("access.format", "geojson")).toBe("GeoJSON");
    expect(publicEnumLabel("access.format", "image")).toBe("Imagem");
    expect(publicEnumLabel("access.format", "video")).toBe("Vídeo");
    expect(publicEnumLabel("access.format", "text")).toBe("Texto");
    expect(publicEnumLabel("access.format", "other")).toBe("Outro");
    expect(publicEnumLabel("access.format", "unknown")).toBe("Desconhecido");
  });

  it("resolves field captions for the new SRC v2 dotted access paths", () => {
    expect(publicFieldCaption("resource_type")).toBe("Tipo de recurso");
    expect(publicFieldCaption("access.level")).toBe("Nível de acesso");
    expect(publicFieldCaption("access.availability")).toBe("Disponibilidade");
    expect(publicFieldCaption("access.method")).toBe("Forma de consulta");
    expect(publicFieldCaption("access.format")).toBe("Formato");
    expect(publicFieldCaption("access.machine_readable")).toBe("Leitura automática");
  });

  it("preserves the safe fallback for unmapped SRC v2 values and fields", () => {
    expect(publicEnumLabel("resource_type", "future_resource_type")).toBe("future_resource_type");
    expect(publicEnumLabel("access.level", "future_level")).toBe("future_level");
    expect(publicFieldCaption("access.unmapped_field")).toBe("access.unmapped_field");
  });

  it("maps all 11 scope.geography.level values", () => {
    expect(publicEnumLabel("scope.geography.level", "site")).toBe("Local específico");
    expect(publicEnumLabel("scope.geography.level", "local_area")).toBe("Área local");
    expect(publicEnumLabel("scope.geography.level", "parish")).toBe("Freguesia");
    expect(publicEnumLabel("scope.geography.level", "city")).toBe("Cidade");
    expect(publicEnumLabel("scope.geography.level", "municipality")).toBe("Município");
    expect(publicEnumLabel("scope.geography.level", "intermunicipal")).toBe("Intermunicipal");
    expect(publicEnumLabel("scope.geography.level", "regional")).toBe("Regional");
    expect(publicEnumLabel("scope.geography.level", "national")).toBe("Nacional");
    expect(publicEnumLabel("scope.geography.level", "international")).toBe("Internacional");
    expect(publicEnumLabel("scope.geography.level", "non_geographic")).toBe("Sem âmbito geográfico");
    expect(publicEnumLabel("scope.geography.level", "unknown")).toBe("Desconhecido");
  });

  it("does not affect existing EVD geography label behavior", () => {
    expect(publicEnumLabel("geography.level", "city")).toBe("Cidade");
    expect(publicEnumLabel("geography.level", "parish")).toBe("Freguesia");
    expect(publicEnumLabel("geography.level", "municipality")).toBe("Município");
    expect(publicEnumLabel("geography.level", "intermunicipal")).toBe("Intermunicipal");
    expect(publicEnumLabel("geography.level", "regional")).toBe("Regional");
    expect(publicFieldCaption("geography.level")).toBe("Âmbito geográfico");
  });

  it("resolves field captions for the new coverage fields", () => {
    expect(publicFieldCaption("scope.geography.level")).toBe("Âmbito geográfico");
    expect(publicFieldCaption("scope.geography.area")).toBe("Área");
    expect(publicFieldCaption("scope.temporal")).toBe("Cobertura temporal");
    expect(publicFieldCaption("scope.domains")).toBe("Temas");
    expect(publicFieldCaption("scope.temporal.as_of")).toBe("Data de referência");
    expect(publicFieldCaption("scope.temporal.start")).toBe("Início");
    expect(publicFieldCaption("scope.temporal.end")).toBe("Fim");
  });

  it("preserves the safe fallback for unmapped scope.geography.level values", () => {
    expect(publicEnumLabel("scope.geography.level", "future_level")).toBe("future_level");
  });

  it("does not invent domain-code labels for scope.domains", () => {
    expect(publicEnumLabel("scope.domains", "housing")).toBe("housing");
  });

  it("maps licensing.status known/unknown", () => {
    expect(publicEnumLabel("licensing.status", "known")).toBe("Conhecido");
    expect(publicEnumLabel("licensing.status", "unknown")).toBe("Desconhecido");
  });

  it("maps licensing.reuse permitted/restricted/prohibited/unknown", () => {
    expect(publicEnumLabel("licensing.reuse", "permitted")).toBe("Permitida");
    expect(publicEnumLabel("licensing.reuse", "restricted")).toBe("Restrita");
    expect(publicEnumLabel("licensing.reuse", "prohibited")).toBe("Proibida");
    expect(publicEnumLabel("licensing.reuse", "unknown")).toBe("Desconhecida");
  });

  it("no longer accepts restricted as a licensing.status vocabulary value", () => {
    expect(publicEnumLabel("licensing.status", "restricted")).toBe("restricted");
  });

  it("resolves field captions for the licensing fields", () => {
    expect(publicFieldCaption("licensing.status")).toBe("Estado do licenciamento");
    expect(publicFieldCaption("licensing.licence")).toBe("Licença");
    expect(publicFieldCaption("licensing.reuse")).toBe("Reutilização");
    expect(publicFieldCaption("licensing.attribution")).toBe("Atribuição");
  });

  it("does not transform licensing.licence or licensing.attribution values", () => {
    expect(publicEnumLabel("licensing.licence", "CC-BY-4.0")).toBe("CC-BY-4.0");
    expect(publicEnumLabel("licensing.attribution", "Câmara Municipal de Évora")).toBe("Câmara Municipal de Évora");
  });

  it("preserves the safe fallback for unmapped licensing.status and licensing.reuse values", () => {
    expect(publicEnumLabel("licensing.status", "future_status")).toBe("future_status");
    expect(publicEnumLabel("licensing.reuse", "future_reuse")).toBe("future_reuse");
  });

  it("maps all 8 temporal.update_frequency values", () => {
    expect(publicEnumLabel("temporal.update_frequency", "one_off")).toBe("Pontual");
    expect(publicEnumLabel("temporal.update_frequency", "daily")).toBe("Diária");
    expect(publicEnumLabel("temporal.update_frequency", "weekly")).toBe("Semanal");
    expect(publicEnumLabel("temporal.update_frequency", "monthly")).toBe("Mensal");
    expect(publicEnumLabel("temporal.update_frequency", "quarterly")).toBe("Trimestral");
    expect(publicEnumLabel("temporal.update_frequency", "annual")).toBe("Anual");
    expect(publicEnumLabel("temporal.update_frequency", "irregular")).toBe("Irregular");
    expect(publicEnumLabel("temporal.update_frequency", "unknown")).toBe("Desconhecida");
  });

  it("resolves temporal.update_frequency via field-scoped resolution without affecting unrelated enums", () => {
    expect(publicEnumLabel("temporal.update_frequency", "unknown")).toBe("Desconhecida");
    expect(publicEnumLabel("access.level", "unknown")).toBe("Desconhecido");
    expect(publicEnumLabel("licensing.status", "unknown")).toBe("Desconhecido");
  });

  it("preserves the safe fallback for unmapped temporal.update_frequency values", () => {
    expect(publicEnumLabel("temporal.update_frequency", "future_frequency")).toBe("future_frequency");
  });

  it("maps the machine-readable tri-state, never treating unknown as false", () => {
    expect(publicTriStateLabel(true)).toBe("Sim");
    expect(publicTriStateLabel(false)).toBe("Não");
    expect(publicTriStateLabel("unknown")).toBe("Desconhecida");
    expect(publicTriStateLabel("unknown")).not.toBe(publicTriStateLabel(false));
  });

  it("resolves the required date-field captions", () => {
    expect(publicFieldCaption("temporal.published_at")).toBe("Publicação");
    expect(publicFieldCaption("temporal.updated_at")).toBe("Última atualização da fonte");
    expect(publicFieldCaption("temporal.last_checked_at")).toBe("Última verificação pela Open Évora");
  });

  it("resolves the temporal.update_frequency caption", () => {
    expect(publicFieldCaption("temporal.update_frequency")).toBe("Frequência de atualização");
  });

  it("resolves the canonical_reference caption", () => {
    expect(publicFieldCaption("canonical_reference")).toBe("Referência original");
  });
});

describe("formatPublicPartialDate", () => {
  it("renders a year-only canonical value unchanged", () => {
    expect(formatPublicPartialDate("2024")).toBe("2024");
  });

  it("renders a year-month canonical value as month of year, without inventing a day", () => {
    expect(formatPublicPartialDate("2024-01")).toBe("janeiro de 2024");
    expect(formatPublicPartialDate("2024-08")).toBe("agosto de 2024");
    expect(formatPublicPartialDate("2024-12")).toBe("dezembro de 2024");
  });

  it("renders a full canonical date as day of month of year", () => {
    expect(formatPublicPartialDate("2024-08-25")).toBe("25 de agosto de 2024");
  });

  it("never renders an invented day for partial (year or year-month) values", () => {
    expect(formatPublicPartialDate("2024")).not.toMatch(/\d+ de/);
    expect(formatPublicPartialDate("2024-08")).not.toMatch(/^\d+ de/);
  });

  it("never renders an invented month for year-only values", () => {
    expect(formatPublicPartialDate("2024")).toBe("2024");
    expect(formatPublicPartialDate("2024")).not.toMatch(/de \d{4}/);
  });

  it("returns the original authored value unchanged for an invalid/unexpected string", () => {
    expect(formatPublicPartialDate("not-a-date")).toBe("not-a-date");
    expect(formatPublicPartialDate("")).toBe("");
    expect(formatPublicPartialDate("2024-13")).toBe("2024-13");
    expect(formatPublicPartialDate("2024-02-30")).toBe("2024-02-30");
  });

  it("does not shift the day across a timezone boundary for a full canonical date", () => {
    expect(formatPublicPartialDate("2024-01-01")).toBe("1 de janeiro de 2024");
    expect(formatPublicPartialDate("2024-12-31")).toBe("31 de dezembro de 2024");
  });

  it("leaves formatPublicDate behavior unchanged for full date values", () => {
    expect(formatPublicDate("2024-08-25")).not.toBe("");
  });
});

describe("formatPublicDate", () => {
  // A canonical date-only value (e.g. `temporal.last_checked_at`) is an
  // authored civil date, not an instant — it must render as the same
  // year/month/day regardless of the runtime's local timezone. Mutating
  // process.env.TZ around each assertion (rather than relying on the
  // machine/CI's ambient timezone) is what makes this deterministic and
  // reproducible on any host: Node/ICU read TZ per Intl call, with no
  // caching that would make this flaky.
  function withTimeZone<T>(tz: string, run: () => T): T {
    const original = process.env.TZ;
    try {
      process.env.TZ = tz;
      return run();
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  }

  it("preserves the authored civil date under a negative UTC offset (the old bug: 21/09/2026)", () => {
    const result = withTimeZone("America/New_York", () => formatPublicDate("2026-09-22"));
    expect(result).toBe("22/09/2026");
    expect(result).not.toBe("21/09/2026");
  });

  it("preserves the authored civil date under a positive UTC offset", () => {
    const result = withTimeZone("Pacific/Kiritimati", () => formatPublicDate("2026-09-22"));
    expect(result).toBe("22/09/2026");
  });

  it("preserves the authored civil date under UTC itself", () => {
    const result = withTimeZone("UTC", () => formatPublicDate("2026-09-22"));
    expect(result).toBe("22/09/2026");
  });

  it("renders a valid leap-day canonical date correctly regardless of timezone", () => {
    const result = withTimeZone("America/New_York", () => formatPublicDate("2024-02-29"));
    expect(result).toBe("29/02/2024");
  });

  it("retains the documented fallback for malformed/unsupported input", () => {
    expect(formatPublicDate("not-a-date")).toBe("not-a-date");
    expect(formatPublicDate("")).toBe("");
  });
});

describe("formatPublicCompactDate", () => {
  it("renders the abbreviated PT-PT civil date without shifting the authored day", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      expect(formatPublicCompactDate("2026-08-10")).toBe("10 ago 2026");
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("falls back to the original value when it cannot be parsed", () => {
    expect(formatPublicCompactDate("not-a-date")).toBe("not-a-date");
  });
});

describe("publicEnumExplanation", () => {
  it("explains every canonical EVD classification value", () => {
    for (const value of ["fact", "reported-experience", "opinion", "claim", "measurement", "recommendation"]) {
      expect(publicEnumExplanation("evidence_nature", value)).toBeTruthy();
    }
    for (const value of ["authoritative", "non_authoritative", "unknown"]) {
      expect(publicEnumExplanation("claim_authority", value)).toBeTruthy();
    }
    expect(publicEnumExplanation("evidence_nature", "claim")).toBe("a fonte afirma, mas não mede.");
    expect(publicEnumExplanation("claim_authority", "authoritative")).toBe("quem afirma tem competência institucional sobre o tema.");
    expect(publicEnumExplanation("claim_authority", "non_authoritative")).toBe("quem afirma não tem competência institucional sobre a alegação.");
    expect(publicEnumExplanation("claim_authority", "unknown")).toBe("não está estabelecido se quem afirma tem competência institucional sobre a alegação.");
  });

  it("has no improvised explanation for an unknown value or field", () => {
    expect(publicEnumExplanation("evidence_nature", "future_value")).toBeNull();
    expect(publicEnumExplanation("status", "OPEN")).toBeNull();
  });
});

describe("formatPublicRelativeDays", () => {
  it("renders the whole-day PT-PT phrasing for an elapsed date", () => {
    const now = new Date("2026-04-12T09:00:00Z");
    expect(formatPublicRelativeDays("2026-04-08", now)).toBe("há 4 dias");
  });

  it("uses the singular for exactly one elapsed day", () => {
    const now = new Date("2026-04-09T09:00:00Z");
    expect(formatPublicRelativeDays("2026-04-08", now)).toBe("há 1 dia");
  });

  it("renders 'hoje' for the same calendar day, regardless of time of day", () => {
    const now = new Date("2026-04-08T23:00:00Z");
    expect(formatPublicRelativeDays("2026-04-08T02:00:00Z", now)).toBe("hoje");
  });

  it("never reports a future date as elapsed", () => {
    const now = new Date("2026-04-01T00:00:00Z");
    expect(formatPublicRelativeDays("2026-04-08", now)).toBe("hoje");
  });

  it("falls back to the original value for an unparseable date, like formatPublicDate", () => {
    expect(formatPublicRelativeDays("not-a-date")).toBe("not-a-date");
  });
});
