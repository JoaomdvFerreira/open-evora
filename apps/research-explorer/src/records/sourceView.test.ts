import { describe, expect, it } from "vitest";
import {
  computeSourceSectionPresence,
  extractSourceCaveats,
  extractSourceCoverage,
  extractSourceDatesAccess,
  extractSourceLicensing,
  extractSourceOverview,
} from "./sourceView";

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
  caveats: ["O estudo é um experimento controlado realizado numa área de 10 quarteirões em Belltown, Seattle, com 11 condutores, 33 rotas e 495 entregas simuladas."],
};

/** Minimal valid SRC: only the required fields per research/schemas/source.schema.json, geography.level non_geographic so scope.geography.area may be absent. */
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

describe("extractSourceOverview", () => {
  it("extracts every Visão geral field from the SRC-0093-shaped complete example", () => {
    const overview = extractSourceOverview(SRC_0093);
    expect(overview).toEqual({
      name: "Providing curb availability information to delivery drivers reduces cruising for parking (2022)",
      publisher: "Scientific Reports (Springer Nature)",
      creators: ["Giacomo Dalla Chiara", "Klaas Fiete Krutein", "Andisheh Ranjbari", "Anne Goodchild"],
      resourceType: "document",
      canonicalReference: "https://doi.org/10.1038/s41598-022-23987-z",
      lastCheckedAt: "2026-08-25",
    });
  });

  it("leaves optional fields absent (null) for a minimal valid SRC, never inventing a fallback", () => {
    const overview = extractSourceOverview(MINIMAL_SRC);
    expect(overview).toEqual({
      name: "Minimal source",
      publisher: null,
      creators: null,
      resourceType: "webpage",
      canonicalReference: null,
      lastCheckedAt: "2026-08-25",
    });
  });
});

describe("extractSourceCoverage", () => {
  it("extracts geography with area when the schema requires it", () => {
    const coverage = extractSourceCoverage(SRC_0093);
    expect(coverage.geographyLevel).toBe("local_area");
    expect(coverage.geographyArea).toBe("Belltown, Seattle, Washington, EUA");
    expect(coverage.domains).toEqual(["MOB", "DIG"]);
  });

  it("extracts geography without area when the schema permits it absent (non_geographic)", () => {
    const coverage = extractSourceCoverage(MINIMAL_SRC);
    expect(coverage.geographyLevel).toBe("non_geographic");
    expect(coverage.geographyArea).toBeNull();
  });

  it("extracts an as_of temporal coverage as a tagged 'as_of' shape", () => {
    const record = { ...MINIMAL_SRC, scope: { ...(MINIMAL_SRC.scope as object), temporal: { as_of: "2024" } } };
    const coverage = extractSourceCoverage(record);
    expect(coverage.temporal).toEqual({ kind: "as_of", asOf: "2024" });
  });

  it("extracts a start/end temporal coverage as a tagged 'interval' shape", () => {
    const record = { ...MINIMAL_SRC, scope: { ...(MINIMAL_SRC.scope as object), temporal: { start: "2020", end: "2023" } } };
    const coverage = extractSourceCoverage(record);
    expect(coverage.temporal).toEqual({ kind: "interval", start: "2020", end: "2023" });
  });

  it("returns null temporal coverage when scope.temporal is absent", () => {
    const coverage = extractSourceCoverage(SRC_0093);
    expect(coverage.temporal).toBeNull();
  });
});

describe("extractSourceDatesAccess", () => {
  it("extracts published_at and last_checked_at from the SRC-0093-shaped example", () => {
    const datesAccess = extractSourceDatesAccess(SRC_0093);
    expect(datesAccess.publishedAt).toBe("2022-11-11");
    expect(datesAccess.updatedAt).toBeNull();
    expect(datesAccess.lastCheckedAt).toBe("2026-08-25");
    expect(datesAccess.accessLevel).toBe("public");
    expect(datesAccess.accessAvailability).toBe("available");
    expect(datesAccess.accessMachineReadable).toBe(false);
    expect(datesAccess.accessMethod).toBe("browser");
    expect(datesAccess.accessFormat).toBe("html");
    expect(datesAccess.canonicalReference).toBe("https://doi.org/10.1038/s41598-022-23987-z");
  });

  it("extracts the literal 'unknown' machine_readable value verbatim, distinct from boolean false", () => {
    const datesAccess = extractSourceDatesAccess(MINIMAL_SRC);
    expect(datesAccess.accessMachineReadable).toBe("unknown");
  });
});

describe("extractSourceLicensing", () => {
  it("extracts known licensing with licence and attribution present", () => {
    const licensing = extractSourceLicensing(SRC_0093);
    expect(licensing).toEqual({
      status: "known",
      licence: "CC BY 4.0",
      reuse: "permitted",
      attribution: "Giacomo Dalla Chiara, Klaas Fiete Krutein, Andisheh Ranjbari e Anne Goodchild",
    });
  });

  it("extracts unknown licensing without inventing licence/attribution text", () => {
    const licensing = extractSourceLicensing(MINIMAL_SRC);
    expect(licensing).toEqual({ status: "unknown", licence: null, reuse: "unknown", attribution: null });
  });
});

describe("extractSourceCaveats", () => {
  it("extracts non-empty caveats", () => {
    expect(extractSourceCaveats(SRC_0093)).toEqual([
      "O estudo é um experimento controlado realizado numa área de 10 quarteirões em Belltown, Seattle, com 11 condutores, 33 rotas e 495 entregas simuladas.",
    ]);
  });

  it("returns null for absent caveats", () => {
    expect(extractSourceCaveats(MINIMAL_SRC)).toBeNull();
  });

  it("returns null for an empty caveats array, distinct from absent", () => {
    expect(extractSourceCaveats({ ...MINIMAL_SRC, caveats: [] })).toBeNull();
  });
});

describe("computeSourceSectionPresence", () => {
  it("marks overview, coverage, dates-access, licensing, caveats, technical present for the SRC-0093-shaped complete example", () => {
    const presence = computeSourceSectionPresence(SRC_0093);
    expect(presence.overview).toBe("present");
    expect(presence.coverage).toBe("present");
    expect(presence["dates-access"]).toBe("present");
    expect(presence.licensing).toBe("present");
    expect(presence.caveats).toBe("present");
    expect(presence.technical).toBe("present");
  });

  it("keeps overview/technical present and marks licensing present (status/reuse are required) but caveats absent, for a minimal valid SRC beyond required fields", () => {
    const presence = computeSourceSectionPresence(MINIMAL_SRC);
    expect(presence.overview).toBe("present");
    expect(presence.technical).toBe("present");
    // coverage.geography.level is always a required field, so coverage is
    // always "present" for any valid SRC — there is no all-absent-scope case.
    expect(presence.coverage).toBe("present");
    expect(presence.licensing).toBe("present"); // status/reuse are required fields, so always present
    expect(presence.caveats).toBe("absent");
  });

  it("marks dates-access present whenever any relevant temporal/access/reference content exists (required temporal.last_checked_at alone is enough)", () => {
    const presence = computeSourceSectionPresence(MINIMAL_SRC);
    expect(presence["dates-access"]).toBe("present");
  });

  it("never declares findings or investigation present from SRC metadata alone, for either fixture", () => {
    const complete = computeSourceSectionPresence(SRC_0093);
    const minimal = computeSourceSectionPresence(MINIMAL_SRC);
    expect(complete.findings).toBe("deferred");
    expect(complete.investigation).toBe("deferred");
    expect(minimal.findings).toBe("deferred");
    expect(minimal.investigation).toBe("deferred");
  });

  // SUI-03A2: findings/investigation presence once relation context is supplied.
  it("14. marks findings present and investigation present when relation context reports a reachable PRB (SRC-0093 acceptance case)", () => {
    const presence = computeSourceSectionPresence(SRC_0093, { hasRelatedProblem: true });
    expect(presence.findings).toBe("present");
    expect(presence.investigation).toBe("present");
  });

  it("14. marks findings present but investigation absent when relation context reports no reachable PRB (empty case)", () => {
    const presence = computeSourceSectionPresence(MINIMAL_SRC, { hasRelatedProblem: false });
    expect(presence.findings).toBe("present");
    expect(presence.investigation).toBe("absent");
  });
});
