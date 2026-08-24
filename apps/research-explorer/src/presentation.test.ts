import { describe, expect, it } from "vitest";
import { formatPublicCount, formatPublicDateTime, publicCompactEnumLabel, publicEnumLabel } from "./presentation";

describe("PT-PT public presentation terminology", () => {
  it("uses field-aware PRB validation labels", () => {
    expect(publicEnumLabel("validation_status", "unvalidated")).toBe("Por validar");
    expect(publicEnumLabel("existing_solutions", "not_assessed")).toBe("Não avaliadas");
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
});
