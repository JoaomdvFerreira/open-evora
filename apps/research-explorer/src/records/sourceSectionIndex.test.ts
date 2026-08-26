import { describe, expect, it } from "vitest";
import { computeSourceSectionPresence } from "./sourceView";
import { sourceSectionIndex } from "./sourceSectionIndex";

/** Mirrors research/sources/SRC-0093.yaml exactly. */
const SRC_0093: Record<string, unknown> = {
  source_id: "SRC-0093",
  publisher: "Scientific Reports (Springer Nature)",
  creators: ["Giacomo Dalla Chiara", "Klaas Fiete Krutein", "Andisheh Ranjbari", "Anne Goodchild"],
  name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
  resource_type: "document",
  identity: {
    persistent_identifier: { scheme: "doi", value: "10.1038/s41598-022-23987-z" },
  },
  scope: {
    geography: { level: "local_area", area: "Belltown, Seattle, Washington, EUA" },
    domains: ["MOB", "DIG"],
  },
  access: {
    level: "public",
    availability: "available",
    machine_readable: false,
    method: "browser",
    format: "html",
  },
  acquisition: { method: "public_web" },
  canonical_reference: "https://doi.org/10.1038/s41598-022-23987-z",
  licensing: {
    status: "known",
    licence: "CC BY 4.0",
    reuse: "permitted",
    attribution: "Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari e Anne Goodchild",
  },
  temporal: { published_at: "2022-11-11", last_checked_at: "2026-08-25" },
  caveats: [
    "O estudo é um experimento controlado realizado numa área de 10 quarteirões em Belltown, Seattle, com 11 condutores, 33 rotas e 495 entregas simuladas.",
  ],
};

/** Minimal valid SRC: only required fields, no caveats. */
const MINIMAL_SRC: Record<string, unknown> = {
  source_id: "SRC-0001",
  name: "Minimal source",
  resource_type: "webpage",
  scope: {
    geography: { level: "non_geographic" },
    domains: ["DIG"],
  },
  access: { level: "unknown", availability: "unknown", machine_readable: "unknown" },
  acquisition: { method: "unknown" },
  licensing: { status: "unknown", reuse: "unknown" },
  temporal: { last_checked_at: "2026-08-25" },
};

describe("computeSourceSectionPresence (SUI-03J0 findings normalization)", () => {
  it("1. findings is present and investigation is deferred without relationContext", () => {
    const presence = computeSourceSectionPresence(MINIMAL_SRC);
    expect(presence.findings).toBe("present");
    expect(presence.investigation).toBe("deferred");
  });

  it("2. relation context with a related PRB: findings present, investigation present", () => {
    const presence = computeSourceSectionPresence(SRC_0093, { hasRelatedProblem: true });
    expect(presence.findings).toBe("present");
    expect(presence.investigation).toBe("present");
  });

  it("3. relation context without a related PRB: findings present, investigation absent", () => {
    const presence = computeSourceSectionPresence(SRC_0093, { hasRelatedProblem: false });
    expect(presence.findings).toBe("present");
    expect(presence.investigation).toBe("absent");
  });
});

describe("sourceSectionIndex", () => {
  it("4. canonical section order is stable for a fully-present record", () => {
    const entries = sourceSectionIndex(SRC_0093, { hasRelatedProblem: true });
    expect(entries.map((entry) => entry.sectionId)).toEqual([
      "overview",
      "findings",
      "coverage",
      "dates-access",
      "licensing",
      "caveats",
      "investigation",
      "technical",
    ]);
  });

  it("5. all eight labels are exact PT-PT copy", () => {
    const entries = sourceSectionIndex(SRC_0093, { hasRelatedProblem: true });
    const labelsBySectionId = Object.fromEntries(entries.map((entry) => [entry.sectionId, entry.label]));
    expect(labelsBySectionId).toEqual({
      overview: "Visão geral",
      findings: "O que encontrámos",
      coverage: "Cobertura",
      "dates-access": "Datas e acesso",
      licensing: "Licenciamento",
      caveats: "Limitações",
      investigation: "Na investigação",
      technical: "Informação técnica",
    });
  });

  it("6. all anchor IDs are deterministic and unique", () => {
    const entries = sourceSectionIndex(SRC_0093, { hasRelatedProblem: true });
    const anchorIds = entries.map((entry) => entry.anchorId);
    expect(anchorIds).toEqual([
      "source-overview",
      "source-findings",
      "source-coverage",
      "source-dates-access",
      "source-licensing",
      "source-caveats",
      "source-investigation",
      "source-technical",
    ]);
    expect(new Set(anchorIds).size).toBe(anchorIds.length);
  });

  it("7. caveats absent: Limitações excluded", () => {
    const entries = sourceSectionIndex(MINIMAL_SRC);
    expect(entries.map((entry) => entry.label)).not.toContain("Limitações");
  });

  it("8. caveats present: Limitações included in canonical position (after Licenciamento, before Na investigação/Informação técnica)", () => {
    const entries = sourceSectionIndex(SRC_0093, { hasRelatedProblem: true });
    const ids = entries.map((entry) => entry.sectionId);
    expect(ids.indexOf("caveats")).toBeGreaterThan(ids.indexOf("licensing"));
    expect(ids.indexOf("caveats")).toBeLessThan(ids.indexOf("investigation"));
  });

  it("9. no relationContext: O que encontrámos included, Na investigação excluded", () => {
    const entries = sourceSectionIndex(MINIMAL_SRC);
    const labels = entries.map((entry) => entry.label);
    expect(labels).toContain("O que encontrámos");
    expect(labels).not.toContain("Na investigação");
  });

  it("10. relation context with PRB: Na investigação included", () => {
    const entries = sourceSectionIndex(SRC_0093, { hasRelatedProblem: true });
    expect(entries.map((entry) => entry.label)).toContain("Na investigação");
  });

  it("11. technical is always included", () => {
    expect(sourceSectionIndex(MINIMAL_SRC).map((entry) => entry.sectionId)).toContain("technical");
    expect(sourceSectionIndex(SRC_0093, { hasRelatedProblem: true }).map((entry) => entry.sectionId)).toContain("technical");
    expect(sourceSectionIndex(SRC_0093, { hasRelatedProblem: false }).map((entry) => entry.sectionId)).toContain("technical");
  });

  it("12. SRC-0093-shaped metadata + relation context (related PRB) produces exactly the expected eight-label index", () => {
    const entries = sourceSectionIndex(SRC_0093, { hasRelatedProblem: true });
    expect(entries.map((entry) => entry.label)).toEqual([
      "Visão geral",
      "O que encontrámos",
      "Cobertura",
      "Datas e acesso",
      "Licenciamento",
      "Limitações",
      "Na investigação",
      "Informação técnica",
    ]);
  });

  it("13. no legacy rail/action entries (identity/header, Abrir fonte original, type card, Graph, repository path, generic Provenance/Relações) appear in the index", () => {
    const entries = sourceSectionIndex(SRC_0093, { hasRelatedProblem: true });
    const labels = entries.map((entry) => entry.label);
    for (const forbidden of ["Abrir fonte original", "Graph", "Provenance", "Relações", "Repositório", "Tipo"]) {
      expect(labels).not.toContain(forbidden);
    }
    expect(entries).toHaveLength(8);
  });

  it("canonical SRC with no caveats and no related PRB produces the six-label minimal index", () => {
    const entries = sourceSectionIndex(MINIMAL_SRC, { hasRelatedProblem: false });
    expect(entries.map((entry) => entry.label)).toEqual([
      "Visão geral",
      "O que encontrámos",
      "Cobertura",
      "Datas e acesso",
      "Licenciamento",
      "Informação técnica",
    ]);
  });
});
