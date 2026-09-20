import { describe, expect, it } from "vitest";
import {
  allTopicCodes,
  computeOverviewStats,
  computePublicOverviewData,
  evidenceCountLabel,
  formatMaterialChangeMarkerDate,
  getLisbonCivilDate,
  isDateInCivilWeekOf,
  isMaterialChangeInCivilWeek,
  latestMaterialChangeByProblem,
  latestMaterialChangeInCivilWeekByProblem,
  latestMaterialChangeInCivilWeekOfByProblem,
  matchesCitizenSearch,
  matchesTopicFilter,
  overviewPageCount,
  paginateProblems,
  problemCountLabel,
  problemIdsAlteredInCivilWeek,
  problemIdsAlteredInCivilWeekOf,
  projectMaterialChangeEntries,
  sortProblems,
  sourceCountLabel,
  toCitizenProblem,
  topCategoryCounts,
  type CitizenProblem,
  type MaterialChangeEntry,
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

function materialChangeEntry(overrides: Partial<MaterialChangeEntry>): MaterialChangeEntry {
  return { problemId: "PRB-0001", problemTitle: "Problema fixture", date: "2026-03-01", summary: "Alteração registada.", domainCodes: [], ...overrides };
}

describe("latestMaterialChangeByProblem", () => {
  it("picks the single newest entry per Problem, keyed by problemId", () => {
    // projectMaterialChangeEntries's own contract: newest date first.
    const entries = [
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-01", summary: "Mais recente." }),
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-01-01", summary: "Mais antigo." }),
      materialChangeEntry({ problemId: "PRB-0002", date: "2026-02-01", summary: "Único." }),
    ];
    const latest = latestMaterialChangeByProblem(entries);
    expect(latest.get("PRB-0001")?.summary).toBe("Mais recente.");
    expect(latest.get("PRB-0002")?.summary).toBe("Único.");
  });

  it("is deterministic under the same-date tie order projectMaterialChangeEntries already establishes", () => {
    const entries = [
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-01", summary: "Primeira posição." }),
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-01", summary: "Segunda posição." }),
    ];
    expect(latestMaterialChangeByProblem(entries).get("PRB-0001")?.summary).toBe("Primeira posição.");
  });

  it("carries no entry for a Problem absent from the projected list", () => {
    const latest = latestMaterialChangeByProblem([materialChangeEntry({ problemId: "PRB-0001" })]);
    expect(latest.has("PRB-0002")).toBe(false);
    expect(latest.size).toBe(1);
  });

  it("returns an empty map for an empty entry list", () => {
    expect(latestMaterialChangeByProblem([]).size).toBe(0);
  });
});

describe("latestMaterialChangeInCivilWeekOfByProblem", () => {
  // Civil-date-input primitive (Lisbon date-boundary hardening, §2) —
  // "2026-03-04" (Wednesday)'s civil week is Monday 2026-03-02 through
  // Sunday 2026-03-08. Pure civil-date arithmetic only: no `Date` instant,
  // no timezone resolution.
  const referenceCivilDate = "2026-03-04";

  it("carries no entry for a Problem whose only history is outside the current civil week", () => {
    const entries = [materialChangeEntry({ problemId: "PRB-0001", date: "2026-01-15" })];
    expect(latestMaterialChangeInCivilWeekOfByProblem(entries, referenceCivilDate).has("PRB-0001")).toBe(false);
  });

  it("carries the qualifying entry for a Problem changed inside the current civil week", () => {
    const entries = [materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-05", summary: "Alteração desta semana." })];
    const latest = latestMaterialChangeInCivilWeekOfByProblem(entries, referenceCivilDate);
    expect(latest.get("PRB-0001")?.summary).toBe("Alteração desta semana.");
  });

  it("uses the newest qualifying entry, never an older entry, when a Problem has several this week", () => {
    const entries = [
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-06", summary: "Mais recente desta semana." }),
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-02", summary: "Mais antiga desta semana." }),
    ];
    const latest = latestMaterialChangeInCivilWeekOfByProblem(entries, referenceCivilDate);
    expect(latest.get("PRB-0001")?.summary).toBe("Mais recente desta semana.");
  });

  it("agrees exactly with problemIdsAlteredInCivilWeekOf's membership for the same supplied civil date", () => {
    const entries = [
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-05" }),
      materialChangeEntry({ problemId: "PRB-0002", date: "2026-01-01" }),
    ];
    const latestKeys = new Set(latestMaterialChangeInCivilWeekOfByProblem(entries, referenceCivilDate).keys());
    expect(latestKeys).toEqual(problemIdsAlteredInCivilWeekOf(entries, referenceCivilDate));
  });

  it("moving the supplied reference civil date from Sunday to the following Monday changes weekly membership correctly", () => {
    // 2026-03-08 is the Sunday closing the 2026-03-02..2026-03-08 civil
    // week; 2026-03-09 is the following Monday, opening a new civil week.
    // A Problem changed on 2026-03-08 must qualify under the Sunday
    // reference and stop qualifying the instant the reference crosses into
    // the following Monday.
    const entries = [materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-08" })];
    expect(latestMaterialChangeInCivilWeekOfByProblem(entries, "2026-03-08").has("PRB-0001")).toBe(true);
    expect(latestMaterialChangeInCivilWeekOfByProblem(entries, "2026-03-09").has("PRB-0001")).toBe(false);
  });

  it("returns an empty map for an empty entry list", () => {
    expect(latestMaterialChangeInCivilWeekOfByProblem([], referenceCivilDate).size).toBe(0);
  });
});

describe("latestMaterialChangeInCivilWeekByProblem", () => {
  const wednesday = new Date(Date.UTC(2026, 2, 4)); // civil week 2026-03-02..2026-03-08 (Lisbon)

  it("carries no entry for a Problem whose only history is outside the current civil week", () => {
    const entries = [materialChangeEntry({ problemId: "PRB-0001", date: "2026-01-15" })];
    expect(latestMaterialChangeInCivilWeekByProblem(entries, wednesday).has("PRB-0001")).toBe(false);
  });

  it("carries the qualifying entry for a Problem changed inside the current civil week", () => {
    const entries = [materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-05", summary: "Alteração desta semana." })];
    const latest = latestMaterialChangeInCivilWeekByProblem(entries, wednesday);
    expect(latest.get("PRB-0001")?.summary).toBe("Alteração desta semana.");
  });

  it("uses the newest qualifying entry, never an older entry, when a Problem has several this week", () => {
    const entries = [
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-06", summary: "Mais recente desta semana." }),
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-02", summary: "Mais antiga desta semana." }),
    ];
    const latest = latestMaterialChangeInCivilWeekByProblem(entries, wednesday);
    expect(latest.get("PRB-0001")?.summary).toBe("Mais recente desta semana.");
  });

  it("never surfaces an out-of-week newest entry in place of an in-week older one", () => {
    // The Problem's overall-newest entry (2026-04-01) is outside this civil
    // week; only the older 2026-03-06 entry qualifies, so that is what must
    // be reported here — never the out-of-week newest, and never nothing.
    const entries = [
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-04-01", summary: "Mais recente no geral, fora da semana." }),
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-06", summary: "Mais recente qualificável esta semana." }),
    ];
    const latest = latestMaterialChangeInCivilWeekByProblem(entries, wednesday);
    expect(latest.get("PRB-0001")?.summary).toBe("Mais recente qualificável esta semana.");
  });

  it("agrees exactly with problemIdsAlteredInCivilWeek's membership", () => {
    const entries = [
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-05" }),
      materialChangeEntry({ problemId: "PRB-0002", date: "2026-01-01" }),
    ];
    const latestKeys = new Set(latestMaterialChangeInCivilWeekByProblem(entries, wednesday).keys());
    expect(latestKeys).toEqual(problemIdsAlteredInCivilWeek(entries, wednesday));
  });

  it("returns an empty map for an empty entry list", () => {
    expect(latestMaterialChangeInCivilWeekByProblem([], wednesday).size).toBe(0);
  });
});

describe("isMaterialChangeInCivilWeek", () => {
  // Reference: Wednesday 2026-03-04. Its civil week is Monday 2026-03-02
  // through Sunday 2026-03-08.
  const wednesday = new Date(Date.UTC(2026, 2, 4));

  it("includes the Monday boundary", () => {
    expect(isMaterialChangeInCivilWeek("2026-03-02", wednesday)).toBe(true);
  });

  it("includes the Sunday boundary", () => {
    expect(isMaterialChangeInCivilWeek("2026-03-08", wednesday)).toBe(true);
  });

  it("excludes the previous Sunday", () => {
    expect(isMaterialChangeInCivilWeek("2026-03-01", wednesday)).toBe(false);
  });

  it("excludes the following Monday", () => {
    expect(isMaterialChangeInCivilWeek("2026-03-09", wednesday)).toBe(false);
  });

  it("includes a mid-week date in the same civil week", () => {
    expect(isMaterialChangeInCivilWeek("2026-03-04", wednesday)).toBe(true);
  });

  it("computes the correct civil week when the reference date is itself a Sunday", () => {
    const sunday = new Date(Date.UTC(2026, 2, 8));
    expect(isMaterialChangeInCivilWeek("2026-03-02", sunday)).toBe(true);
    expect(isMaterialChangeInCivilWeek("2026-03-09", sunday)).toBe(false);
  });

  it("safely excludes a malformed or invalid date", () => {
    expect(isMaterialChangeInCivilWeek("not-a-date", wednesday)).toBe(false);
    expect(isMaterialChangeInCivilWeek("2026-13-01", wednesday)).toBe(false);
    expect(isMaterialChangeInCivilWeek("2026-02-30", wednesday)).toBe(false);
    expect(isMaterialChangeInCivilWeek("", wednesday)).toBe(false);
  });

  it("does not use a rolling seven days — a date 7 days before the reference but outside the civil week is excluded", () => {
    // 2026-02-25 is exactly 7 days before 2026-03-04, but falls in the prior
    // civil week (2026-02-23 to 2026-03-01), not the current one.
    expect(isMaterialChangeInCivilWeek("2026-02-25", wednesday)).toBe(false);
  });

  it("resolves the civil week from the Europe/Lisbon calendar, not the system/browser timezone", () => {
    // 2026-06-01T23:30:00Z is still Monday 2026-06-01 in UTC, but Portugal is
    // on summer time (WEST, UTC+1) in June, so it is already Tuesday
    // 2026-06-02 in Lisbon. A UTC-only implementation would anchor the civil
    // week one day early; the Europe/Lisbon-aware implementation must not.
    const lateMondayUtc = new Date(Date.UTC(2026, 5, 1, 23, 30));
    expect(getLisbonCivilDate(lateMondayUtc)).toBe("2026-06-02");
    // The Lisbon week is Monday 2026-06-01 through Sunday 2026-06-07: Monday
    // itself must still qualify even though it is already "yesterday" in UTC
    // terms relative to this reference instant.
    expect(isMaterialChangeInCivilWeek("2026-06-01", lateMondayUtc)).toBe(true);
    // The following Monday must not.
    expect(isMaterialChangeInCivilWeek("2026-06-08", lateMondayUtc)).toBe(false);
  });

  it("places a late-Sunday-UTC instant that is already Monday in Lisbon into the new week, not the old one", () => {
    // 2026-06-07T23:30:00Z is Sunday in UTC, but with Portugal on summer time
    // it is already 2026-06-08T00:30 in Lisbon — Monday of the *next* civil
    // week. The reference civil week must be 2026-06-08..2026-06-14, not
    // 2026-06-01..2026-06-07.
    const lateSundayUtc = new Date(Date.UTC(2026, 5, 7, 23, 30));
    expect(getLisbonCivilDate(lateSundayUtc)).toBe("2026-06-08");
    expect(isMaterialChangeInCivilWeek("2026-06-08", lateSundayUtc)).toBe(true);
    expect(isMaterialChangeInCivilWeek("2026-06-07", lateSundayUtc)).toBe(false);
  });

  it("stays correct immediately either side of the Portugal DST transitions", () => {
    // Spring-forward: 2026-03-29 (last Sunday of March) is when Portugal
    // moves from WET (UTC+0) to WEST (UTC+1).
    expect(getLisbonCivilDate(new Date(Date.UTC(2026, 2, 29, 0, 30)))).toBe("2026-03-29");
    // Autumn back: 2026-10-25 (last Sunday of October) is when Portugal moves
    // from WEST (UTC+1) back to WET (UTC+0) — Lisbon is at UTC+0 for the rest
    // of that day, so it stays 2026-10-25 even late in the UTC day.
    expect(getLisbonCivilDate(new Date(Date.UTC(2026, 9, 25, 0, 30)))).toBe("2026-10-25");
    expect(getLisbonCivilDate(new Date(Date.UTC(2026, 9, 25, 23, 30)))).toBe("2026-10-25");
  });
});

describe("getLisbonCivilDate", () => {
  it("defaults to resolving the current instant when called with no argument", () => {
    // Only asserts the shape/determinism contract — this test intentionally
    // avoids asserting a specific date against wall-clock time.
    expect(getLisbonCivilDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isDateInCivilWeekOf", () => {
  // Pure whole-day civil-date arithmetic, independent of any timezone
  // resolution — both arguments are already civil dates here.
  it("includes the Monday and Sunday boundaries of the reference civil date's week", () => {
    expect(isDateInCivilWeekOf("2026-03-02", "2026-03-04")).toBe(true);
    expect(isDateInCivilWeekOf("2026-03-08", "2026-03-04")).toBe(true);
  });

  it("excludes the adjacent weeks", () => {
    expect(isDateInCivilWeekOf("2026-03-01", "2026-03-04")).toBe(false);
    expect(isDateInCivilWeekOf("2026-03-09", "2026-03-04")).toBe(false);
  });

  it("safely excludes a malformed candidate or reference civil date", () => {
    expect(isDateInCivilWeekOf("not-a-date", "2026-03-04")).toBe(false);
    expect(isDateInCivilWeekOf("2026-03-04", "not-a-date")).toBe(false);
  });
});

describe("problemIdsAlteredInCivilWeekOf", () => {
  // Civil-date-input primitive (Lisbon date-boundary hardening, §2) — no
  // `Date` instant, no timezone resolution, just civil-date arithmetic via
  // `isDateInCivilWeekOf`.
  const referenceCivilDate = "2026-03-04"; // civil week 2026-03-02..2026-03-08

  it("counts each qualifying Problem once, deduplicated by problemId", () => {
    const entries = [
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-02" }),
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-05" }),
      materialChangeEntry({ problemId: "PRB-0002", date: "2026-03-08" }),
    ];
    const ids = problemIdsAlteredInCivilWeekOf(entries, referenceCivilDate);
    expect(ids).toEqual(new Set(["PRB-0001", "PRB-0002"]));
  });

  it("excludes a Problem whose only entries fall outside the civil week", () => {
    const entries = [materialChangeEntry({ problemId: "PRB-0001", date: "2026-02-20" })];
    expect(problemIdsAlteredInCivilWeekOf(entries, referenceCivilDate).size).toBe(0);
  });

  it("moving the supplied reference civil date from Sunday to the following Monday changes weekly membership correctly", () => {
    // Mirrors latestMaterialChangeInCivilWeekOfByProblem's own boundary
    // test, at the shortcut-membership layer: the two must agree exactly at
    // this same boundary (see the "count and changed-row projection remain
    // aligned" Overview-level regression).
    const entries = [materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-08" })];
    expect(problemIdsAlteredInCivilWeekOf(entries, "2026-03-08").has("PRB-0001")).toBe(true);
    expect(problemIdsAlteredInCivilWeekOf(entries, "2026-03-09").has("PRB-0001")).toBe(false);
  });

  it("returns an empty set for no entries", () => {
    expect(problemIdsAlteredInCivilWeekOf([], referenceCivilDate).size).toBe(0);
  });
});

describe("problemIdsAlteredInCivilWeek", () => {
  const wednesday = new Date(Date.UTC(2026, 2, 4)); // civil week 2026-03-02..2026-03-08

  it("counts each qualifying Problem once, deduplicated by problemId", () => {
    const entries = [
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-02" }),
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-05" }),
      materialChangeEntry({ problemId: "PRB-0002", date: "2026-03-08" }),
    ];
    const ids = problemIdsAlteredInCivilWeek(entries, wednesday);
    expect(ids).toEqual(new Set(["PRB-0001", "PRB-0002"]));
  });

  it("excludes a Problem whose only entries fall outside the civil week", () => {
    const entries = [materialChangeEntry({ problemId: "PRB-0001", date: "2026-02-20" })];
    expect(problemIdsAlteredInCivilWeek(entries, wednesday).size).toBe(0);
  });

  it("includes a Problem with at least one qualifying entry even if its newest entry is older", () => {
    const entries = [
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-04-01" }), // newest, outside this week
      materialChangeEntry({ problemId: "PRB-0001", date: "2026-03-06" }), // older, but in this civil week
    ];
    expect(problemIdsAlteredInCivilWeek(entries, wednesday).has("PRB-0001")).toBe(true);
  });

  it("returns an empty set for no entries", () => {
    expect(problemIdsAlteredInCivilWeek([], wednesday).size).toBe(0);
  });
});

describe("formatMaterialChangeMarkerDate", () => {
  it("renders a compact PT-PT DD/MM presentation", () => {
    expect(formatMaterialChangeMarkerDate("2026-08-31")).toBe("31/08");
  });

  it("pads single-digit day and month", () => {
    expect(formatMaterialChangeMarkerDate("2026-01-05")).toBe("05/01");
  });

  it("falls back to the raw value for a malformed date", () => {
    expect(formatMaterialChangeMarkerDate("not-a-date")).toBe("not-a-date");
    expect(formatMaterialChangeMarkerDate("2026-13-01")).toBe("2026-13-01");
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
