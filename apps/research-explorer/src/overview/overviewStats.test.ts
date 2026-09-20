import { describe, expect, it } from "vitest";
import {
  allTopicCodes,
  computeOverviewStats,
  computePublicOverviewData,
  evidenceCountLabel,
  matchesCitizenSearch,
  matchesTopicFilter,
  overviewPageCount,
  paginateProblems,
  problemCountLabel,
  projectMaterialChangeEntries,
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

  it("breaks a count tie by deterministic PT-PT label order", () => {
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

describe("allTopicCodes", () => {
  it("returns the complete canonical TEMA vocabulary, not only codes present among any loaded Problems", () => {
    expect(allTopicCodes().sort()).toEqual([...auditedDomainCodes()].sort());
  });

  it("orders by PT-PT public label", () => {
    const codes = allTopicCodes();
    const labels = codes.map((code) => describeTopic(code).label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "pt-PT")));
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

describe("overviewPageCount / paginateProblems", () => {
  function idList(count: number): CitizenProblem[] {
    return Array.from({ length: count }, (_, index) => citizenProblem({ id: `PRB-${String(index + 1).padStart(4, "0")}` }));
  }

  it("reports one page for a result count at or under the fixed page size", () => {
    expect(overviewPageCount(0)).toBe(1);
    expect(overviewPageCount(1)).toBe(1);
    expect(overviewPageCount(10)).toBe(1);
  });

  it("reports additional pages once the result count exceeds the fixed page size", () => {
    expect(overviewPageCount(11)).toBe(2);
    expect(overviewPageCount(20)).toBe(2);
    expect(overviewPageCount(21)).toBe(3);
  });

  it("slices at most 10 problems for page 1", () => {
    const problems = idList(25);
    const page1 = paginateProblems(problems, 1);
    expect(page1.length).toBe(10);
    expect(page1.map((p) => p.id)).toEqual(problems.slice(0, 10).map((p) => p.id));
  });

  it("renders the remaining problems on page 2", () => {
    const problems = idList(25);
    const page2 = paginateProblems(problems, 2);
    expect(page2.length).toBe(10);
    expect(page2.map((p) => p.id)).toEqual(problems.slice(10, 20).map((p) => p.id));
  });

  it("renders only the remainder on the final, partial page", () => {
    const problems = idList(25);
    const page3 = paginateProblems(problems, 3);
    expect(page3.map((p) => p.id)).toEqual(problems.slice(20, 25).map((p) => p.id));
  });

  it("clamps an out-of-range page number to the nearest valid page rather than returning an empty slice", () => {
    const problems = idList(15);
    expect(paginateProblems(problems, 99).map((p) => p.id)).toEqual(problems.slice(10, 15).map((p) => p.id));
    expect(paginateProblems(problems, 0).map((p) => p.id)).toEqual(problems.slice(0, 10).map((p) => p.id));
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
    expect(problemCountLabel(0)).toBe("problemas");
    expect(problemCountLabel(1)).toBe("problema");
    expect(problemCountLabel(2)).toBe("problemas");
    expect(evidenceCountLabel(0)).toBe("Registos de evidência");
    expect(evidenceCountLabel(1)).toBe("Registo de evidência");
    expect(evidenceCountLabel(2)).toBe("Registos de evidência");
    expect(sourceCountLabel(0)).toBe("Fontes");
    expect(sourceCountLabel(1)).toBe("Fonte");
    expect(sourceCountLabel(2)).toBe("Fontes");
  });
});
