import { describe, expect, it } from "vitest";
import { formatPublicCount, formatPublicDateTime, publicCompactEnumLabel, publicEnumLabel, publicFieldCaption } from "./presentation";

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

  it("distinguishes evidential authority from publication permission", () => {
    expect(publicEnumLabel("strength", "primary-authoritative")).toBe("Primária com autoridade");
    expect(publicEnumLabel("authority", "authoritative")).toBe("Com autoridade");
  });

  it("keeps SUPERSEDED distinct from STALE", () => {
    expect(publicEnumLabel("analysis.temporal_relevance", "SUPERSEDED")).toBe("Substituída");
    expect(publicEnumLabel("freshness.status", "STALE")).toBe("Desatualizada");
  });

  it("formats public counts and timestamps for Portugal", () => {
    expect(formatPublicCount(12345)).toMatch(/12/);
    expect(formatPublicDateTime("2026-08-21T14:30:00Z")).not.toBe("2026-08-21T14:30:00Z");
  });

  it("preserves a public-signal code while using its reviewed label", () => {
    expect(publicEnumLabel("analysis.public_signal_class", "PS1")).toBe("PS1 — Jornalismo local / notícias públicas");
    expect(publicEnumLabel("some_unrelated_field", "PS1")).toBe("PS1");
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
});
