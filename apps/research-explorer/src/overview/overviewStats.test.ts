import { describe, expect, it } from "vitest";
import {
  allTopicCodes,
  computeOverviewStats,
  computePublicOverviewData,
  countByCanonicalValues,
  countByDimension,
  countByLifecycleGroup,
  evidenceCountLabel,
  lifecycleGroupLabel,
  lifecycleGroupOf,
  matchesCitizenSearch,
  matchesEvidenceFilter,
  matchesLifecycleFilter,
  matchesLifecycleGroupFilter,
  matchesTopicFilter,
  matchesValidationFilter,
  problemCountLabel,
  projectMaterialChangeEntries,
  relevantTopicCodes,
  sortProblems,
  sourceCountLabel,
  toCitizenProblem,
  topCategoryCounts,
  type CitizenProblem,
} from "./overviewStats";
import type { RecordDetail, RecordSummary } from "../dataProvider/types";
import { auditedDomainCodes, describeTopic } from "../presentation/topicMapping";

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
    expect(data.sourceCount).toBe(1);
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

  it("preserves summary state when an unavailable detail has no state fields", () => {
    const indexSummary = summary({
      id: "PRB-0008",
      summaryFields: { status: "OPEN", validation_status: "unvalidated", evidence_status: "corroborated" },
    });
    const problem = toCitizenProblem(indexSummary, detail({}));

    expect(problem.lifecycleStatus).toBe("OPEN");
    expect(problem.validationStatus).toBe("unvalidated");
    expect(problem.evidenceStatus).toBe("corroborated");
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

describe("projectMaterialChangeEntries", () => {
  it("derives entries only from explicitly authored PRB history", () => {
    const entries = projectMaterialChangeEntries([
      { summary: summary({ id: "PRB-0007", label: "Problema canónico" }), detail: detail({ updated_at: "2099-12-31", history: [{ date: "2026-04-08", summary: "Alteração registada." }] }) },
    ]);
    expect(entries).toEqual([{ problemId: "PRB-0007", problemTitle: "Problema canónico", date: "2026-04-08", summary: "Alteração registada.", domainCodes: [] }]);
  });

  it("carries the same canonical domain codes as the owning Problem's detail, alongside each entry", () => {
    const entries = projectMaterialChangeEntries([
      { summary: summary({ id: "PRB-0007" }), detail: detail({ domain: ["MOB", "PUB"], history: [{ date: "2026-04-08", summary: "Alteração registada." }] }) },
    ]);
    expect(entries).toEqual([{ problemId: "PRB-0007", problemTitle: "Fixture", date: "2026-04-08", summary: "Alteração registada.", domainCodes: ["MOB", "PUB"] }]);
  });

  it("does not treat updated_at or an absent history as a material change", () => {
    const entries = projectMaterialChangeEntries([
      { summary: summary({ id: "PRB-0001" }), detail: detail({ updated_at: "2099-12-31" }) },
      { summary: summary({ id: "PRB-0002" }), detail: detail({ updated_at: "2099-12-30", history: [] }) },
    ]);
    expect(entries).toEqual([]);
  });

  it("orders authored dates newest first", () => {
    const entries = projectMaterialChangeEntries([
      { summary: summary({ id: "PRB-0001" }), detail: detail({ history: [{ date: "2026-01-01", summary: "Mais antigo." }] }) },
      { summary: summary({ id: "PRB-0002" }), detail: detail({ history: [{ date: "2026-03-01", summary: "Mais recente." }] }) },
    ]);
    expect(entries.map((entry) => entry.summary)).toEqual(["Mais recente.", "Mais antigo."]);
  });

  it("uses Problem ID then authored array position as a non-ranking same-date tie-break", () => {
    const entries = projectMaterialChangeEntries([
      { summary: summary({ id: "PRB-0002" }), detail: detail({ history: [{ date: "2026-03-01", summary: "Segundo problema." }] }) },
      { summary: summary({ id: "PRB-0001" }), detail: detail({ history: [{ date: "2026-03-01", summary: "Primeira posição." }, { date: "2026-03-01", summary: "Segunda posição." }] }) },
    ]);
    expect(entries.map((entry) => `${entry.problemId}:${entry.summary}`)).toEqual(["PRB-0001:Primeira posição.", "PRB-0001:Segunda posição.", "PRB-0002:Segundo problema."]);
  });

  it("does not invent entries from malformed or non-Problem detail", () => {
    const entries = projectMaterialChangeEntries([
      { summary: summary({ id: "PRB-0001" }), detail: detail({ history: [{ date: "2026-03-01" }, { summary: "Sem data." }, "texto"] }) },
      { summary: summary({ id: "EVD-0001", type: "EVD-" }), detail: detail({ history: [{ date: "2026-03-01", summary: "Não é Problem." }] }) },
    ]);
    expect(entries).toEqual([]);
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
  it("returns only the domain codes actually present among the loaded Problems, sorted by PT-PT label", () => {
    const problems = [
      citizenProblem({ id: "PRB-1", domainCodes: ["URB"] }),
      citizenProblem({ id: "PRB-2", domainCodes: ["MOB", "ACC"] }),
    ];
    // Acessibilidade / Mobilidade / Urbanismo — label order happens to match code order here.
    expect(relevantTopicCodes(problems)).toEqual(["ACC", "MOB", "URB"]);
  });

  it("orders by PT-PT public label, not by canonical code, when they diverge", () => {
    // ECO -> "Economia", DIG -> "Digital": alphabetically by label, Digital comes first,
    // even though the codes DIG/ECO would themselves sort the other way.
    const problems = [
      citizenProblem({ id: "PRB-1", domainCodes: ["ECO"] }),
      citizenProblem({ id: "PRB-2", domainCodes: ["DIG"] }),
    ];
    expect(relevantTopicCodes(problems)).toEqual(["DIG", "ECO"]);
  });

  it("returns an empty list when no Problem has a domain code", () => {
    expect(relevantTopicCodes([citizenProblem({})])).toEqual([]);
  });

  it("deduplicates a domain code shared by multiple Problems", () => {
    const problems = [citizenProblem({ id: "PRB-1", domainCodes: ["MOB"] }), citizenProblem({ id: "PRB-2", domainCodes: ["MOB"] })];
    expect(relevantTopicCodes(problems)).toEqual(["MOB"]);
  });
});

describe("topCategoryCounts", () => {
  it("orders domain codes by descending Problem count", () => {
    const problems = [
      citizenProblem({ id: "PRB-1", domainCodes: ["MOB"] }),
      citizenProblem({ id: "PRB-2", domainCodes: ["MOB"] }),
      citizenProblem({ id: "PRB-3", domainCodes: ["PUB"] }),
    ];
    expect(topCategoryCounts(problems, 5)).toEqual([
      { code: "MOB", count: 2 },
      { code: "PUB", count: 1 },
    ]);
  });

  it("counts a Problem toward every one of its domain codes, not a single primary one", () => {
    const problems = [citizenProblem({ id: "PRB-1", domainCodes: ["MOB", "PUB"] })];
    // Both tie at count 1; "Espaço público" sorts before "Mobilidade" alphabetically.
    expect(topCategoryCounts(problems, 5)).toEqual([
      { code: "PUB", count: 1 },
      { code: "MOB", count: 1 },
    ]);
  });

  it("breaks a count tie by the same deterministic PT-PT label order as relevantTopicCodes", () => {
    // ECO -> "Economia", DIG -> "Digital": Digital sorts first alphabetically,
    // even though both appear once and the codes themselves sort the other way.
    const problems = [
      citizenProblem({ id: "PRB-1", domainCodes: ["ECO"] }),
      citizenProblem({ id: "PRB-2", domainCodes: ["DIG"] }),
    ];
    expect(topCategoryCounts(problems, 5)).toEqual([
      { code: "DIG", count: 1 },
      { code: "ECO", count: 1 },
    ]);
  });

  it("caps the result at the given limit", () => {
    const problems = [
      citizenProblem({ id: "PRB-1", domainCodes: ["MOB"] }),
      citizenProblem({ id: "PRB-2", domainCodes: ["PUB"] }),
      citizenProblem({ id: "PRB-3", domainCodes: ["ENV"] }),
    ];
    expect(topCategoryCounts(problems, 2)).toHaveLength(2);
  });

  it("returns an empty list when no Problem has a domain code", () => {
    expect(topCategoryCounts([citizenProblem({})], 5)).toEqual([]);
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

describe("matchesLifecycleFilter, matchesValidationFilter, matchesEvidenceFilter", () => {
  it("match every Problem when no value is selected, regardless of a null dimension", () => {
    expect(matchesLifecycleFilter(citizenProblem({ lifecycleStatus: null }), null)).toBe(true);
    expect(matchesValidationFilter(citizenProblem({ validationStatus: null }), null)).toBe(true);
    expect(matchesEvidenceFilter(citizenProblem({ evidenceStatus: null }), null)).toBe(true);
  });

  it("match only a Problem whose own dimension equals the selected value", () => {
    expect(matchesLifecycleFilter(citizenProblem({ lifecycleStatus: "OPEN" }), "OPEN")).toBe(true);
    expect(matchesLifecycleFilter(citizenProblem({ lifecycleStatus: "REJECTED" }), "OPEN")).toBe(false);
    expect(matchesValidationFilter(citizenProblem({ validationStatus: "validated" }), "validated")).toBe(true);
    expect(matchesValidationFilter(citizenProblem({ validationStatus: "unvalidated" }), "validated")).toBe(false);
    expect(matchesEvidenceFilter(citizenProblem({ evidenceStatus: "corroborated" }), "corroborated")).toBe(true);
    expect(matchesEvidenceFilter(citizenProblem({ evidenceStatus: "discovered" }), "corroborated")).toBe(false);
  });

  it("never matches a genuinely absent (null) dimension against a selected value", () => {
    expect(matchesLifecycleFilter(citizenProblem({ lifecycleStatus: null }), "OPEN")).toBe(false);
    expect(matchesValidationFilter(citizenProblem({ validationStatus: null }), "validated")).toBe(false);
    expect(matchesEvidenceFilter(citizenProblem({ evidenceStatus: null }), "corroborated")).toBe(false);
  });

  it("keep the three dimensions independent — filtering by one never depends on another's value", () => {
    const problem = citizenProblem({ lifecycleStatus: "OPEN", validationStatus: null, evidenceStatus: "corroborated" });
    expect(matchesLifecycleFilter(problem, "OPEN")).toBe(true);
    expect(matchesValidationFilter(problem, null)).toBe(true);
    expect(matchesEvidenceFilter(problem, "corroborated")).toBe(true);
  });
});

describe("countByDimension", () => {
  it("counts each present value across the given Problems, excluding a null dimension from every option", () => {
    const problems = [
      citizenProblem({ id: "PRB-1", lifecycleStatus: "OPEN" }),
      citizenProblem({ id: "PRB-2", lifecycleStatus: "OPEN" }),
      citizenProblem({ id: "PRB-3", lifecycleStatus: "REJECTED" }),
      citizenProblem({ id: "PRB-4", lifecycleStatus: null }),
    ];
    expect(countByDimension(problems, "lifecycleStatus")).toEqual([
      { value: "OPEN", count: 2 },
      { value: "REJECTED", count: 1 },
    ]);
  });

  it("orders options by descending count, tie-broken by the canonical value ascending", () => {
    const problems = [
      citizenProblem({ id: "PRB-1", evidenceStatus: "discovered" }),
      citizenProblem({ id: "PRB-2", evidenceStatus: "corroborated" }),
    ];
    expect(countByDimension(problems, "evidenceStatus")).toEqual([
      { value: "corroborated", count: 1 },
      { value: "discovered", count: 1 },
    ]);
  });

  it("returns an empty list when every Problem has a null dimension", () => {
    expect(countByDimension([citizenProblem({ validationStatus: null })], "validationStatus")).toEqual([]);
  });
});

describe("allTopicCodes", () => {
  it("returns the complete canonical TEMA vocabulary, not only codes present among any loaded Problems", () => {
    expect(allTopicCodes().sort()).toEqual([...auditedDomainCodes()].sort());
  });

  it("orders by PT-PT public label, matching relevantTopicCodes's order convention", () => {
    const codes = allTopicCodes();
    const labels = codes.map((code) => describeTopic(code).label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "pt-PT")));
  });
});

describe("countByCanonicalValues", () => {
  it("includes every canonical value even when it has zero matches among the given Problems", () => {
    const problems = [citizenProblem({ id: "PRB-1", evidenceStatus: "corroborated" })];
    expect(countByCanonicalValues(problems, "evidenceStatus", ["discovered", "corroborated"])).toEqual([
      { value: "discovered", count: 0 },
      { value: "corroborated", count: 1 },
    ]);
  });

  it("orders options by the given canonical value order, not by count", () => {
    const problems = [
      citizenProblem({ id: "PRB-1", validationStatus: "validated" }),
      citizenProblem({ id: "PRB-2", validationStatus: "validated" }),
      citizenProblem({ id: "PRB-3", validationStatus: "unvalidated" }),
    ];
    expect(countByCanonicalValues(problems, "validationStatus", ["unvalidated", "partially_validated", "validated"])).toEqual([
      { value: "unvalidated", count: 1 },
      { value: "partially_validated", count: 0 },
      { value: "validated", count: 2 },
    ]);
  });

  it("never counts a null dimension toward any canonical value", () => {
    expect(countByCanonicalValues([citizenProblem({ evidenceStatus: null })], "evidenceStatus", ["discovered", "corroborated"])).toEqual([
      { value: "discovered", count: 0 },
      { value: "corroborated", count: 0 },
    ]);
  });
});

describe("lifecycleGroupOf / matchesLifecycleGroupFilter / countByLifecycleGroup / lifecycleGroupLabel", () => {
  it("groups only OPEN as the open lifecycle group; every other canonical status value groups as closed", () => {
    expect(lifecycleGroupOf("OPEN")).toBe("OPEN");
    for (const closedStatus of ["REJECTED", "DUPLICATE", "NON_DIGITAL", "ALREADY_SOLVED", "INSUFFICIENT_EVIDENCE"]) {
      expect(lifecycleGroupOf(closedStatus)).toBe("CLOSED");
    }
  });

  it("labels the two groups Aberto/Fechado, never an evidence/validation concept such as 'Evidência insuficiente'", () => {
    expect(lifecycleGroupLabel("OPEN")).toBe("Aberto");
    expect(lifecycleGroupLabel("CLOSED")).toBe("Fechado");
  });

  it("matches a Problem whose status groups into the selected ESTADO value, regardless of the specific closed status", () => {
    expect(matchesLifecycleGroupFilter(citizenProblem({ lifecycleStatus: "OPEN" }), "OPEN")).toBe(true);
    expect(matchesLifecycleGroupFilter(citizenProblem({ lifecycleStatus: "REJECTED" }), "CLOSED")).toBe(true);
    expect(matchesLifecycleGroupFilter(citizenProblem({ lifecycleStatus: "INSUFFICIENT_EVIDENCE" }), "CLOSED")).toBe(true);
    expect(matchesLifecycleGroupFilter(citizenProblem({ lifecycleStatus: "OPEN" }), "CLOSED")).toBe(false);
  });

  it("matches every Problem when no group is selected, and never matches a null dimension against a selected group", () => {
    expect(matchesLifecycleGroupFilter(citizenProblem({ lifecycleStatus: null }), null)).toBe(true);
    expect(matchesLifecycleGroupFilter(citizenProblem({ lifecycleStatus: null }), "OPEN")).toBe(false);
  });

  it("zero-fills both groups, in Aberto-then-Fechado order, and never counts a null dimension", () => {
    const problems = [
      citizenProblem({ id: "PRB-1", lifecycleStatus: "OPEN" }),
      citizenProblem({ id: "PRB-2", lifecycleStatus: "REJECTED" }),
      citizenProblem({ id: "PRB-3", lifecycleStatus: "DUPLICATE" }),
      citizenProblem({ id: "PRB-4", lifecycleStatus: null }),
    ];
    expect(countByLifecycleGroup(problems)).toEqual([
      { value: "OPEN", count: 1 },
      { value: "CLOSED", count: 2 },
    ]);
  });

  it("returns zero counts for both groups when no Problem carries a lifecycle status", () => {
    expect(countByLifecycleGroup([citizenProblem({ lifecycleStatus: null })])).toEqual([
      { value: "OPEN", count: 0 },
      { value: "CLOSED", count: 0 },
    ]);
  });
});

describe("sortProblems", () => {
  it("orders by ascending PRB ID for the default 'id' order, regardless of updatedAt", () => {
    const problems = [
      citizenProblem({ id: "PRB-9", updatedAt: "2026-01-01" }),
      citizenProblem({ id: "PRB-2", updatedAt: "2026-06-01" }),
      citizenProblem({ id: "PRB-10", updatedAt: null }),
    ];
    expect(sortProblems(problems, "id").map((p) => p.id)).toEqual(["PRB-10", "PRB-2", "PRB-9"]);
  });

  it("orders by descending updatedAt for the 'updatedAt' order", () => {
    const problems = [
      citizenProblem({ id: "PRB-1", updatedAt: "2026-01-01" }),
      citizenProblem({ id: "PRB-2", updatedAt: "2026-06-01" }),
      citizenProblem({ id: "PRB-3", updatedAt: "2026-03-01" }),
    ];
    expect(sortProblems(problems, "updatedAt").map((p) => p.id)).toEqual(["PRB-2", "PRB-3", "PRB-1"]);
  });

  it("sorts a null updatedAt last, never treating it as oldest by a fabricated date", () => {
    const problems = [
      citizenProblem({ id: "PRB-1", updatedAt: null }),
      citizenProblem({ id: "PRB-2", updatedAt: "2026-06-01" }),
    ];
    expect(sortProblems(problems, "updatedAt").map((p) => p.id)).toEqual(["PRB-2", "PRB-1"]);
  });

  it("breaks a same-date tie, and a same-null tie, by ascending PRB ID", () => {
    const problems = [
      citizenProblem({ id: "PRB-9", updatedAt: "2026-06-01" }),
      citizenProblem({ id: "PRB-2", updatedAt: "2026-06-01" }),
      citizenProblem({ id: "PRB-8", updatedAt: null }),
      citizenProblem({ id: "PRB-3", updatedAt: null }),
    ];
    expect(sortProblems(problems, "updatedAt").map((p) => p.id)).toEqual(["PRB-2", "PRB-9", "PRB-3", "PRB-8"]);
  });

  it("does not mutate the input array", () => {
    const problems = [citizenProblem({ id: "PRB-2" }), citizenProblem({ id: "PRB-1" })];
    const original = [...problems];
    sortProblems(problems, "id");
    expect(problems).toEqual(original);
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

describe("public Overview metrics count grammar", () => {
  it("uses PT-PT singular only for one, and plural for zero or more than one", () => {
    expect(problemCountLabel(0)).toBe("Problemas acompanhados");
    expect(problemCountLabel(1)).toBe("Problema acompanhado");
    expect(problemCountLabel(2)).toBe("Problemas acompanhados");
    expect(evidenceCountLabel(0)).toBe("Registos de evidência");
    expect(evidenceCountLabel(1)).toBe("Registo de evidência");
    expect(evidenceCountLabel(2)).toBe("Registos de evidência");
    expect(sourceCountLabel(0)).toBe("Fontes primárias");
    expect(sourceCountLabel(1)).toBe("Fonte primária");
    expect(sourceCountLabel(2)).toBe("Fontes primárias");
  });
});
