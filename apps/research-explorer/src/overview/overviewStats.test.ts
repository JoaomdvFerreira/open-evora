import { describe, expect, it } from "vitest";
import {
  computeOverviewStats,
  computePublicOverviewData,
  formatEvidenceCount,
  formatProblemCount,
  matchesCitizenSearch,
  matchesTopicFilter,
  relevantTopicCodes,
  toCitizenProblem,
  type CitizenProblem,
} from "./overviewStats";
import type { RecordDetail, RecordSummary } from "../dataProvider/types";

function summary(overrides: Partial<RecordSummary>): RecordSummary {
  return { id: "PRB-0001", type: "PRB-", label: "Fixture", file: "research/problems/PRB-0001.yaml", summaryFields: {}, ...overrides };
}

describe("computeOverviewStats", () => {
  it("counts total records and counts by type", () => {
    const records = [
      summary({ id: "PRB-0001", type: "PRB-" }),
      summary({ id: "PRB-0002", type: "PRB-" }),
      summary({ id: "EVD-0001", type: "EVD-" }),
    ];
    const stats = computeOverviewStats(records);
    expect(stats.totalRecords).toBe(3);
    expect(stats.countsByType).toEqual([
      { type: "EVD-", count: 1 },
      { type: "PRB-", count: 2 },
    ]);
  });

  it("surfaces a field present on most records of a type with a small number of distinct values", () => {
    const records = [
      summary({ id: "PRB-0001", summaryFields: { status: "OPEN" } }),
      summary({ id: "PRB-0002", summaryFields: { status: "OPEN" } }),
      summary({ id: "PRB-0003", summaryFields: { status: "REJECTED" } }),
      summary({ id: "PRB-0004", summaryFields: { status: "OPEN" } }),
    ];
    const stats = computeOverviewStats(records);
    const statusDist = stats.distributions.find((d) => d.field === "status");
    expect(statusDist).toBeDefined();
    expect(statusDist!.values).toEqual([
      { value: "OPEN", count: 3 },
      { value: "REJECTED", count: 1 },
    ]);
  });

  it("excludes a field present on too few records (below presence threshold)", () => {
    const records = [
      summary({ id: "PRB-0001", summaryFields: { rare_field: "a" } }),
      summary({ id: "PRB-0002", summaryFields: {} }),
      summary({ id: "PRB-0003", summaryFields: {} }),
      summary({ id: "PRB-0004", summaryFields: {} }),
    ];
    const stats = computeOverviewStats(records);
    expect(stats.distributions.some((d) => d.field === "rare_field")).toBe(false);
  });

  it("excludes a field with too many distinct values (not a genuine distribution)", () => {
    const records = Array.from({ length: 10 }, (_, i) => summary({ id: `PRB-000${i}`, summaryFields: { unique_field: `v${i}` } }));
    const stats = computeOverviewStats(records);
    expect(stats.distributions.some((d) => d.field === "unique_field")).toBe(false);
  });

  it("excludes a constant field (only one distinct value carries no information)", () => {
    const records = [
      summary({ id: "PRB-0001", summaryFields: { constant: "x" } }),
      summary({ id: "PRB-0002", summaryFields: { constant: "x" } }),
    ];
    const stats = computeOverviewStats(records);
    expect(stats.distributions.some((d) => d.field === "constant")).toBe(false);
  });

  it("caps the number of distributions per type", () => {
    const records = Array.from({ length: 6 }, (_, i) =>
      summary({
        id: `PRB-000${i}`,
        summaryFields: { a: i % 2 === 0 ? "x" : "y", b: i % 2 === 0 ? "x" : "y", c: i % 2 === 0 ? "x" : "y", d: i % 2 === 0 ? "x" : "y" },
      })
    );
    const stats = computeOverviewStats(records);
    expect(stats.distributions.length).toBeLessThanOrEqual(2);
  });

  it("does not special-case a 'domain' field name — it is absent unless it actually appears in summaryFields", () => {
    const records = [summary({ id: "PRB-0001", summaryFields: { status: "OPEN" } })];
    const stats = computeOverviewStats(records);
    expect(stats.distributions.some((d) => d.field === "domain")).toBe(false);
  });

  it("handles an empty corpus without throwing", () => {
    const stats = computeOverviewStats([]);
    expect(stats.totalRecords).toBe(0);
    expect(stats.countsByType).toEqual([]);
    expect(stats.distributions).toEqual([]);
  });
});

describe("computePublicOverviewData", () => {
  it("derives PRB-only ordered public entries and PRB/EVD counts from arbitrary index data", () => {
    const data = computePublicOverviewData([
      summary({ id: "EVD-0002", type: "EVD-", label: "Evidence two" }),
      summary({ id: "PRB-0010", type: "PRB-", label: "Later problem", summaryFields: { validation_status: "validated", evidence_status: "discovered" } }),
      summary({ id: "SRC-0001", type: "SRC-", label: "Source" }),
      summary({ id: "PRB-0002", type: "PRB-", label: "Earlier problem", summaryFields: { validation_status: "unvalidated", evidence_status: "corroborated" } }),
      summary({ id: "EVD-0001", type: "EVD-", label: "Evidence one" }),
    ]);

    expect(data.problemCount).toBe(2);
    expect(data.evidenceCount).toBe(2);
    expect(data.problems).toEqual([
      { id: "PRB-0002", title: "Earlier problem", validationStatus: "unvalidated", evidenceStatus: "corroborated" },
      { id: "PRB-0010", title: "Later problem", validationStatus: "validated", evidenceStatus: "discovered" },
    ]);
  });
});

function detail(record: Record<string, unknown>): RecordDetail {
  return { id: "PRB-0001", type: "PRB-", file: "research/problems/PRB-0001.yaml", record, outgoingEdges: [], incomingEdges: [] };
}

describe("toCitizenProblem", () => {
  it("projects the canonical fields citizen discovery needs, keeping raw stored values", () => {
    const indexSummary = summary({ id: "PRB-0007", label: "Fallback title" });
    const problem = toCitizenProblem(indexSummary, detail({
      title: "Título canónico",
      problem_statement: "Descrição do problema.",
      domain: ["MOB", "ACC"],
      affected_populations: ["residentes", "estudantes"],
      geography: { level: "municipality", area: "Évora" },
      status: "OPEN",
      validation_status: "unvalidated",
      evidence_status: "corroborated",
      updated_at: "2026-09-10",
    }));

    expect(problem).toEqual({
      id: "PRB-0007",
      title: "Título canónico",
      problemStatement: "Descrição do problema.",
      domainCodes: ["MOB", "ACC"],
      affectedPopulations: ["residentes", "estudantes"],
      geographyArea: "Évora",
      lifecycleStatus: "OPEN",
      validationStatus: "unvalidated",
      evidenceStatus: "corroborated",
      updatedAt: "2026-09-10",
    });
  });

  it("falls back to the index summary label when the canonical title is missing", () => {
    const indexSummary = summary({ id: "PRB-0008", label: "Rótulo do índice" });
    const problem = toCitizenProblem(indexSummary, detail({}));
    expect(problem.title).toBe("Rótulo do índice");
  });

  it("normalizes a single-string domain into a one-element list, matching the list convention", () => {
    const indexSummary = summary({ id: "PRB-0009" });
    const problem = toCitizenProblem(indexSummary, detail({ domain: "MOB" }));
    expect(problem.domainCodes).toEqual(["MOB"]);
  });

  it("never throws on a detail missing every optional field", () => {
    const indexSummary = summary({ id: "PRB-0010" });
    const problem = toCitizenProblem(indexSummary, detail({}));
    expect(problem.problemStatement).toBeNull();
    expect(problem.domainCodes).toEqual([]);
    expect(problem.affectedPopulations).toEqual([]);
    expect(problem.geographyArea).toBeNull();
    expect(problem.lifecycleStatus).toBeNull();
    expect(problem.updatedAt).toBeNull();
  });
});

function citizenProblem(overrides: Partial<CitizenProblem>): CitizenProblem {
  return {
    id: "PRB-0001",
    title: "Problema fixture",
    problemStatement: null,
    domainCodes: [],
    affectedPopulations: [],
    geographyArea: null,
    lifecycleStatus: null,
    validationStatus: null,
    evidenceStatus: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("relevantTopicCodes", () => {
  it("returns only the domain codes actually present among the loaded Problems, sorted", () => {
    const problems = [
      citizenProblem({ id: "PRB-1", domainCodes: ["URB"] }),
      citizenProblem({ id: "PRB-2", domainCodes: ["MOB", "ACC"] }),
    ];
    expect(relevantTopicCodes(problems)).toEqual(["ACC", "MOB", "URB"]);
  });

  it("returns an empty list when no Problem has a domain code", () => {
    expect(relevantTopicCodes([citizenProblem({})])).toEqual([]);
  });

  it("deduplicates a domain code shared by multiple Problems", () => {
    const problems = [citizenProblem({ id: "PRB-1", domainCodes: ["MOB"] }), citizenProblem({ id: "PRB-2", domainCodes: ["MOB"] })];
    expect(relevantTopicCodes(problems)).toEqual(["MOB"]);
  });
});

describe("matchesTopicFilter", () => {
  it("matches every Problem when no topic is selected", () => {
    expect(matchesTopicFilter(citizenProblem({ domainCodes: ["MOB"] }), null)).toBe(true);
    expect(matchesTopicFilter(citizenProblem({ domainCodes: [] }), null)).toBe(true);
  });

  it("matches a multi-domain Problem when the selected code is any one of its domains", () => {
    const problem = citizenProblem({ domainCodes: ["MOB", "ACC"] });
    expect(matchesTopicFilter(problem, "MOB")).toBe(true);
    expect(matchesTopicFilter(problem, "ACC")).toBe(true);
    expect(matchesTopicFilter(problem, "URB")).toBe(false);
  });
});

describe("matchesCitizenSearch", () => {
  it("matches on title, problem statement, affected populations, geography, and topic label — case- and accent-insensitively", () => {
    const problem = citizenProblem({
      title: "Tráfego e estacionamento",
      problemStatement: "Congestão no centro histórico.",
      affectedPopulations: ["residentes", "comerciantes"],
      geographyArea: "Évora",
      domainCodes: ["MOB"],
    });
    expect(matchesCitizenSearch(problem, "trafego")).toBe(true);
    expect(matchesCitizenSearch(problem, "CONGESTAO")).toBe(true);
    expect(matchesCitizenSearch(problem, "comerciantes")).toBe(true);
    expect(matchesCitizenSearch(problem, "evora")).toBe(true);
    expect(matchesCitizenSearch(problem, "mobilidade")).toBe(true);
    expect(matchesCitizenSearch(problem, "habitação")).toBe(false);
  });

  it("matches every Problem for an empty or whitespace-only query", () => {
    const problem = citizenProblem({ title: "Qualquer coisa" });
    expect(matchesCitizenSearch(problem, "")).toBe(true);
    expect(matchesCitizenSearch(problem, "   ")).toBe(true);
  });

  it("does not match on the technical PRB ID alone", () => {
    const problem = citizenProblem({ id: "PRB-0042", title: "Outro problema" });
    expect(matchesCitizenSearch(problem, "PRB-0042")).toBe(false);
  });
});

describe("public Overview count grammar", () => {
  it("uses PT-PT singular only for one, and plural for zero or more than one", () => {
    expect(formatProblemCount(0)).toBe("0 problemas em investigação");
    expect(formatProblemCount(1)).toBe("1 problema em investigação");
    expect(formatProblemCount(2)).toBe("2 problemas em investigação");
    expect(formatEvidenceCount(0)).toBe("0 registos de evidência");
    expect(formatEvidenceCount(1)).toBe("1 registo de evidência");
    expect(formatEvidenceCount(2)).toBe("2 registos de evidência");
  });
});
