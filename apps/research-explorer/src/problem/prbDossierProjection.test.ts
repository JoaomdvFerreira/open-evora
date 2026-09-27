import { describe, expect, it } from "vitest";
import type { RecordDetail } from "../dataProvider/types";
import { prb0005DataProvider } from "./prb0005Fixture";
import { loadProblemProjection, type EvidenceWithSources, type ProblemProjection } from "./problemProjection";
import { buildPrbDossierData, PRB_DOSSIER_PROJECTION_VERSION, type PrbDossierData } from "./prbDossierProjection";

/* Synthetic fixtures use unmistakably synthetic identifiers (PRB-9999, EVD-9990xx, SRC-99xx). */

function detail(id: string, record: Record<string, unknown>): RecordDetail {
  return { id, type: `${id.split("-")[0]}-`, file: "", record, outgoingEdges: [], incomingEdges: [] };
}

const SRC_A = detail("SRC-9901", {
  source_id: "SRC-9901",
  publisher: "Município Sintético",
  creators: ["Autora Sintética", "Autor Sintético"],
  name: "Relatório sintético de mobilidade",
  resource_type: "document",
  identity: { persistent_identifier: { scheme: "doi", value: "10.0000/sintetico" }, version: "v2", snapshot_reference: "snapshot-sintetico" },
  scope: { geography: { level: "city", area: "Cidade Sintética" }, temporal: { start: "2024", end: "2025-06" }, domains: ["MOB", "URB"] },
  access: { level: "public", availability: "available", machine_readable: "unknown", method: "download", format: "pdf" },
  acquisition: { method: "archive", obtained_at: "2026-01-15" },
  canonical_reference: "https://example.org/sintetico.pdf",
  licensing: { status: "unknown", licence: null, reuse: "unknown", attribution: null },
  temporal: { published_at: "2025-07", updated_at: "2025-08-01", last_checked_at: "2026-08-10", update_frequency: "annual" },
  caveats: ["Primeira ressalva sintética.", "Segunda ressalva sintética."],
});

const SRC_B = detail("SRC-9902", {
  source_id: "SRC-9902",
  name: "Estudo comparativo sintético",
  resource_type: "webpage",
  scope: { geography: { level: "international", area: "Outra Cidade" }, domains: ["DIG"] },
  access: { level: "public", availability: "available", machine_readable: false, method: "browser", format: "html" },
  acquisition: { method: "public_web" },
  canonical_reference: "https://example.org/comparativo",
  licensing: { status: "known", licence: "CC BY 4.0", reuse: "permitted", attribution: "Autoria sintética" },
  temporal: { last_checked_at: "2026-08-25" },
});

const SRC_C = detail("SRC-9903", {
  source_id: "SRC-9903",
  name: "Página sintética restrita",
  resource_type: "service",
  scope: { geography: { level: "non_geographic" }, domains: [] },
  access: { level: "restricted", availability: "unavailable", machine_readable: true },
  acquisition: { method: "unknown" },
  licensing: { status: "known", licence: "Proprietária", reuse: "prohibited", attribution: null },
  temporal: { last_checked_at: "2026-09-01" },
});

function evd(id: string, record: Record<string, unknown>, sources: RecordDetail[], effects: string[], researchRoles: string[]): EvidenceWithSources {
  return { detail: detail(id, { evidence_id: id, ...record }), sources, effects, researchRoles };
}

const EVD_LOCAL_1 = evd("EVD-999001", {
  lineage_id: "SYN-LINEAGE-1",
  provenance: { sources: ["SRC-9901"], extracted_at: "2026-08-10" },
  observation: { summary: "Observação local sintética um." },
  scope: { geography: { level: "city", area: "Cidade Sintética" }, populations: ["peões", "residentes"], temporal: { as_of: "2025" } },
  domains: ["MOB", "URB"],
  evidence_nature: "measurement",
  claim_authority: "authoritative",
  inference_limits: ["Limite sintético A.", "Limite sintético B."],
}, [SRC_A], ["supports", "refines"], ["local_observation"]);

const EVD_COMPARATIVE = evd("EVD-999002", {
  provenance: { sources: ["SRC-9902", "SRC-9901"], extracted_at: "2026-08-11" },
  observation: { summary: "Mecanismo comparativo sintético." },
  scope: { geography: { level: "international", area: "Outra Cidade" }, populations: ["condutores"], temporal: { status: "unknown" } },
  domains: ["DIG"],
  evidence_nature: "claim",
  claim_authority: "non_authoritative",
  inference_limits: ["Sem transferibilidade causal."],
}, [SRC_B, SRC_A], ["bounds"], ["comparative_mechanism", "comparative_response"]);

const EVD_LOCAL_2 = evd("EVD-999003", {
  lineage_id: "SYN-LINEAGE-3",
  provenance: { sources: ["SRC-9903"], extracted_at: "2026-09-16" },
  observation: { summary: "Observação local sintética três." },
  scope: { geography: { level: "municipality", area: "Município Sintético" }, temporal: { start: "2026-01", end: "2026-09" } },
  domains: ["MOB"],
  evidence_nature: "fact",
  claim_authority: "unknown",
  inference_limits: [],
}, [SRC_C], ["supports"], ["local_observation", "existing_response"]);

const DECISION_BASIS = {
  contract_version: "1",
  eligibility_basis: "Base de elegibilidade sintética.",
  corroboration_basis: "Base de corroboração sintética.",
  manifestation: { kind: "observed", summary: "Manifestação sintética.", evidence: ["EVD-999001"] },
  consequence: { summary: "Consequência sintética.", evidence: ["EVD-999001", "EVD-999003"] },
  currentness: { assessment: "Atualidade sintética.", evidence: ["EVD-999003"] },
  contradiction_search: { performed: false, summary: "Pesquisa de contradição sintética." },
  overlap_check: { performed: true, summary: "Sobreposição sintética.", related_problems: ["PRB-9998"] },
  corroboration_statement: "Declaração de corroboração sintética.",
  supporting_evidence: ["EVD-999001", "EVD-999003"],
  boundary_evidence: ["EVD-999002"],
  independence_assessment: "Independência sintética.",
  scope: { geography: "Cidade Sintética", population: "peões", temporal: "2025–2026", bounded: false },
  limitations: "Limitações sintéticas.",
};

const RICH_RECORD = {
  problem_id: "PRB-9999",
  created_at: "2026-08-28",
  updated_at: "2026-09-25",
  title: "Problema sintético de mobilidade",
  domain: ["URB", "MOB", "ACC"],
  geography: { level: "city", area: "Cidade Sintética" },
  affected_populations: ["residentes", "condutores", "peões"],
  problem_statement: "Formulação sintética.",
  causal_reading: "Leitura causal sintética.",
  evidence: [],
  evidence_status: "discovered",
  validation_status: "unvalidated",
  digital_tractability: "not_assessed",
  solution_landscape_status: "not_assessed",
  status: "OPEN",
  investigation: {
    open_questions: [
      {
        question: "Primeira questão sintética?",
        latest_result: "Resultado sintético.",
        why_open: "Motivo sintético.",
        resolution_condition: "Condição sintética.",
        current_action: "WATCH — monitorizar dados sintéticos.",
        evidence: ["EVD-999002", "EVD-999001"],
      },
      { not_a_question: "entrada inválida ignorada" },
      { question: "Segunda questão sintética?" },
    ],
    path: {
      delimitation: { summary: "Delimitação sintética.", evidence: ["EVD-999002"] },
      initial_signal: { summary: "Sinal sintético.", evidence: ["EVD-999001"] },
      development: { summary: "Desenvolvimento sintético.", evidence: [] },
    },
  },
  decision_basis: DECISION_BASIS,
  history: [
    { date: "2026-08-31", summary: "Primeira entrada sintética.", evidence: ["EVD-999001"], state_changes: { evidence_status: { from: "discovered", to: "corroborated" } } },
    { date: "2026-09-16", summary: "Segunda entrada sintética." },
  ],
};

function richProjection(): ProblemProjection {
  return { problem: detail("PRB-9999", structuredClone(RICH_RECORD)), evidence: structuredClone([EVD_LOCAL_1, EVD_COMPARATIVE, EVD_LOCAL_2]) };
}

function sparseProjection(): ProblemProjection {
  return {
    problem: detail("PRB-9999", {
      problem_id: "PRB-9999",
      created_at: "2026-01-01",
      updated_at: "2026-01-02",
      title: "Problema sintético mínimo",
      domain: "MOB",
      geography: { level: "non_geographic" },
      affected_populations: [],
      problem_statement: "Formulação mínima.",
      evidence: [],
      evidence_status: "discovered",
      validation_status: "unvalidated",
      digital_tractability: "not_assessed",
      solution_landscape_status: "not_assessed",
      status: "OPEN",
    }),
    evidence: [],
  };
}

function collectUndefinedPaths(value: unknown, path = "$"): string[] {
  if (value === undefined) return [path];
  if (Array.isArray(value)) return value.flatMap((item, index) => collectUndefinedPaths(item, `${path}[${index}]`));
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => collectUndefinedPaths(item, `${path}.${key}`));
  return [];
}

function assertPlainJson(value: unknown): void {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (Array.isArray(value)) return value.forEach(assertPlainJson);
  expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  Object.values(value as object).forEach(assertPlainJson);
}

describe("buildPrbDossierData — determinism and serialisation", () => {
  it("produces deep-equal output for identical input and carries the contract version but no generation timestamp", () => {
    const first = buildPrbDossierData(richProjection());
    const second = buildPrbDossierData(richProjection());
    expect(second).toEqual(first);
    expect(first.projectionVersion).toBe(PRB_DOSSIER_PROJECTION_VERSION);
    expect(first.projectionVersion).toBe(1);
    expect(JSON.stringify(first)).not.toMatch(/generat/i);
  });

  it("survives a JSON round trip unchanged and contains only plain JSON values, never undefined", () => {
    for (const projection of [richProjection(), sparseProjection()]) {
      const data = buildPrbDossierData(projection);
      expect(JSON.parse(JSON.stringify(data))).toStrictEqual(data);
      expect(collectUndefinedPaths(data)).toEqual([]);
      assertPlainJson(data);
    }
  });

  it("does not mutate the input projection or share mutable arrays with it", () => {
    const projection = richProjection();
    const snapshot = structuredClone(projection);
    const data = buildPrbDossierData(projection);
    expect(projection).toStrictEqual(snapshot);

    data.evidence[0].effects.push("mutated");
    data.evidence[0].sourceIds.push("SRC-0000");
    data.problem.domains.push("XXX");
    data.sources[0].caveats.push("mutated");
    expect(projection).toStrictEqual(snapshot);
  });
});

describe("buildPrbDossierData — problem", () => {
  it("maps every canonical problem field as authored, without translating enum codes", () => {
    const { problem } = buildPrbDossierData(richProjection());
    expect(problem).toEqual({
      id: "PRB-9999",
      createdAt: "2026-08-28",
      updatedAt: "2026-09-25",
      title: "Problema sintético de mobilidade",
      domains: ["URB", "MOB", "ACC"],
      geography: { level: "city", area: "Cidade Sintética" },
      affectedPopulations: ["residentes", "condutores", "peões"],
      problemStatement: "Formulação sintética.",
      causalReading: "Leitura causal sintética.",
      status: "OPEN",
      evidenceStatus: "discovered",
      validationStatus: "unvalidated",
      digitalTractability: "not_assessed",
      solutionLandscapeStatus: "not_assessed",
    });
  });

  it("keeps unauthored optional fields null/empty and omits every optional structure of a sparse PRB", () => {
    const data = buildPrbDossierData(sparseProjection());
    expect(data.problem.domains).toEqual(["MOB"]);
    expect(data.problem.geography).toEqual({ level: "non_geographic", area: null });
    expect(data.problem.causalReading).toBeNull();
    expect(data.problem.affectedPopulations).toEqual([]);
    expect(data.investigation).toEqual({ openQuestions: [], path: [] });
    expect(data.decisionBasis).toBeNull();
    expect(data.history).toEqual([]);
    expect(data.evidence).toEqual([]);
    expect(data.sources).toEqual([]);
    expect(data.counts).toEqual({ evidenceRecordCount: 0, distinctSourceCount: 0, effectCount: 0, openQuestionCount: 0 });
  });
});

describe("buildPrbDossierData — investigation and history", () => {
  it("keeps valid open questions in authored order with every field distinct and current_action as plain text", () => {
    const { investigation } = buildPrbDossierData(richProjection());
    expect(investigation.openQuestions).toEqual([
      {
        question: "Primeira questão sintética?",
        latestResult: "Resultado sintético.",
        whyOpen: "Motivo sintético.",
        resolutionCondition: "Condição sintética.",
        currentAction: "WATCH — monitorizar dados sintéticos.",
        evidenceIds: ["EVD-999002", "EVD-999001"],
      },
      { question: "Segunda questão sintética?", latestResult: null, whyOpen: null, resolutionCondition: null, currentAction: null, evidenceIds: [] },
    ]);
  });

  it("orders path stages canonically regardless of authored key order and derives no stage state", () => {
    const { investigation } = buildPrbDossierData(richProjection());
    expect(investigation.path).toEqual([
      { key: "initial_signal", summary: "Sinal sintético.", evidenceIds: ["EVD-999001"] },
      { key: "development", summary: "Desenvolvimento sintético.", evidenceIds: [] },
      { key: "delimitation", summary: "Delimitação sintética.", evidenceIds: ["EVD-999002"] },
    ]);
  });

  it("keeps history in authored order with only authored fields", () => {
    const { history } = buildPrbDossierData(richProjection());
    expect(history).toEqual([
      { date: "2026-08-31", summary: "Primeira entrada sintética.", evidenceIds: ["EVD-999001"], stateChanges: [{ field: "evidence_status", from: "discovered", to: "corroborated" }] },
      { date: "2026-09-16", summary: "Segunda entrada sintética.", evidenceIds: [], stateChanges: [] },
    ]);
  });
});

describe("buildPrbDossierData — decision basis", () => {
  it("maps the complete authored structure faithfully, preserving explicit false booleans and references", () => {
    const { decisionBasis } = buildPrbDossierData(richProjection());
    expect(decisionBasis).toEqual({
      contractVersion: "1",
      eligibilityBasis: "Base de elegibilidade sintética.",
      corroborationBasis: "Base de corroboração sintética.",
      manifestation: { kind: "observed", summary: "Manifestação sintética.", evidenceIds: ["EVD-999001"] },
      consequence: { summary: "Consequência sintética.", evidenceIds: ["EVD-999001", "EVD-999003"] },
      currentness: { assessment: "Atualidade sintética.", evidenceIds: ["EVD-999003"] },
      contradictionSearch: { performed: false, summary: "Pesquisa de contradição sintética.", evidenceIds: [] },
      overlapCheck: { performed: true, summary: "Sobreposição sintética.", relatedProblemIds: ["PRB-9998"] },
      corroborationStatement: "Declaração de corroboração sintética.",
      supportingEvidenceIds: ["EVD-999001", "EVD-999003"],
      boundaryEvidenceIds: ["EVD-999002"],
      independenceAssessment: "Independência sintética.",
      scope: { geography: "Cidade Sintética", population: "peões", temporal: "2025–2026", bounded: false },
      limitations: "Limitações sintéticas.",
    });
  });

  it("does not derive unauthored decision-basis parts, including booleans", () => {
    const projection = richProjection();
    projection.problem.record.decision_basis = { contract_version: "1", scope: { geography: "Cidade Sintética" } };
    const { decisionBasis } = buildPrbDossierData(projection);
    expect(decisionBasis?.scope).toEqual({ geography: "Cidade Sintética", population: null, temporal: null, bounded: null });
    expect(decisionBasis?.manifestation).toBeNull();
    expect(decisionBasis?.contradictionSearch).toBeNull();
    expect(decisionBasis?.overlapCheck).toBeNull();
    expect(decisionBasis?.supportingEvidenceIds).toEqual([]);
    expect(decisionBasis?.limitations).toBeNull();
  });
});

describe("buildPrbDossierData — evidence", () => {
  it("keeps exactly projection.evidence order and maps each EVD's canonical fields and PRB→EVD relationship", () => {
    const data = buildPrbDossierData(richProjection());
    expect(data.evidence.map((item) => item.id)).toEqual(["EVD-999001", "EVD-999002", "EVD-999003"]);
    expect(data.evidence[0]).toEqual({
      id: "EVD-999001",
      lineageId: "SYN-LINEAGE-1",
      observationSummary: "Observação local sintética um.",
      extractedAt: "2026-08-10",
      sourceIds: ["SRC-9901"],
      unresolvedSourceIds: [],
      scope: { geography: { level: "city", area: "Cidade Sintética" }, populations: ["peões", "residentes"], temporal: { asOf: "2025", start: null, end: null, status: null } },
      domains: ["MOB", "URB"],
      evidenceNature: "measurement",
      claimAuthority: "authoritative",
      inferenceLimits: ["Limite sintético A.", "Limite sintético B."],
      effects: ["supports", "refines"],
      researchRoles: ["local_observation"],
    });
  });

  it("preserves temporal scope precision and form exactly as authored", () => {
    const [, comparative, local] = buildPrbDossierData(richProjection()).evidence;
    expect(comparative.lineageId).toBeNull();
    expect(comparative.scope.temporal).toEqual({ asOf: null, start: null, end: null, status: "unknown" });
    expect(comparative.sourceIds).toEqual(["SRC-9902", "SRC-9901"]);
    expect(comparative.researchRoles).toEqual(["comparative_mechanism", "comparative_response"]);
    expect(local.scope.temporal).toEqual({ asOf: null, start: "2026-01", end: "2026-09", status: null });
    expect(local.scope.populations).toEqual([]);
  });

  it("never reorders, filters or de-duplicates evidence, even a repeated EVD", () => {
    const projection = richProjection();
    projection.evidence = [projection.evidence[2], projection.evidence[0], structuredClone(projection.evidence[2])];
    expect(buildPrbDossierData(projection).evidence.map((item) => item.id)).toEqual(["EVD-999003", "EVD-999001", "EVD-999003"]);
  });

  it("generates no ranking, score, confidence, strength or reliability fields", () => {
    const serialised = JSON.stringify(buildPrbDossierData(richProjection()));
    expect(serialised).not.toMatch(/"[a-zA-Z]*(rank|score|confidence|strength|importance|reliab|relevance)[a-zA-Z]*":/i);
  });
});

describe("buildPrbDossierData — sources", () => {
  it("de-duplicates by SRC ID in first-seen order and indexes which EVDs use each source", () => {
    const { sources } = buildPrbDossierData(richProjection());
    expect(sources.map((source) => source.id)).toEqual(["SRC-9901", "SRC-9902", "SRC-9903"]);
    expect(sources.map((source) => source.usedByEvidenceIds)).toEqual([["EVD-999001", "EVD-999002"], ["EVD-999002"], ["EVD-999003"]]);
  });

  it("lists an EVD once in usedByEvidenceIds even when the same EVD appears repeatedly", () => {
    const projection = richProjection();
    projection.evidence.push(structuredClone(projection.evidence[0]));
    const [first] = buildPrbDossierData(projection).sources;
    expect(first.usedByEvidenceIds).toEqual(["EVD-999001", "EVD-999002"]);
  });

  it("maps every canonical source audit field as authored", () => {
    const [source] = buildPrbDossierData(richProjection()).sources;
    expect(source).toEqual({
      id: "SRC-9901",
      name: "Relatório sintético de mobilidade",
      publisher: "Município Sintético",
      creators: ["Autora Sintética", "Autor Sintético"],
      resourceType: "document",
      identity: { persistentIdentifier: { scheme: "doi", value: "10.0000/sintetico" }, version: "v2", snapshotReference: "snapshot-sintetico" },
      scope: { geography: { level: "city", area: "Cidade Sintética" }, temporal: { asOf: null, start: "2024", end: "2025-06", status: null }, domains: ["MOB", "URB"] },
      access: { level: "public", availability: "available", machineReadable: "unknown", method: "download", format: "pdf" },
      acquisition: { method: "archive", obtainedAt: "2026-01-15" },
      canonicalReference: "https://example.org/sintetico.pdf",
      licensing: { status: "unknown", licence: null, reuse: "unknown", attribution: null },
      temporal: { publishedAt: "2025-07", updatedAt: "2025-08-01", lastCheckedAt: "2026-08-10", updateFrequency: "annual" },
      caveats: ["Primeira ressalva sintética.", "Segunda ressalva sintética."],
      usedByEvidenceIds: ["EVD-999001", "EVD-999002"],
    });
  });

  it("keeps machine-readable unknown distinct from false and true", () => {
    const { sources } = buildPrbDossierData(richProjection());
    expect(sources.map((source) => source.access.machineReadable)).toEqual(["unknown", false, true]);
  });

  it("keeps access and licensing independent and last_checked_at as a plain date only", () => {
    const [, permitted, restricted] = buildPrbDossierData(richProjection()).sources;
    expect(permitted.access.level).toBe("public");
    expect(permitted.licensing.reuse).toBe("permitted");
    expect(restricted.access).toEqual({ level: "restricted", availability: "unavailable", machineReadable: true, method: null, format: null });
    expect(restricted.licensing.reuse).toBe("prohibited");
    expect(restricted.identity).toBeNull();
    expect(restricted.scope.geography).toEqual({ level: "non_geographic", area: null });
    expect(permitted.temporal).toEqual({ publishedAt: null, updatedAt: null, lastCheckedAt: "2026-08-25", updateFrequency: null });
    expect(JSON.stringify(permitted)).not.toMatch(/"(currentness|current|validated|verified|isCurrent)":/i);
  });
});

describe("buildPrbDossierData — counts and reference integrity", () => {
  it("counts evidence, distinct sources, PRB→EVD effects and open questions from projected data", () => {
    expect(buildPrbDossierData(richProjection()).counts).toEqual({ evidenceRecordCount: 3, distinctSourceCount: 3, effectCount: 4, openQuestionCount: 2 });
  });

  it("makes an authored source reference without a resolved SRC observable instead of fabricating it", () => {
    const projection = richProjection();
    projection.evidence[2].sources = [];
    const data = buildPrbDossierData(projection);
    expect(data.evidence[2].sourceIds).toEqual(["SRC-9903"]);
    expect(data.evidence[2].unresolvedSourceIds).toEqual(["SRC-9903"]);
    expect(data.sources.map((source) => source.id)).toEqual(["SRC-9901", "SRC-9902"]);
  });

  function expectResolvedIntegrity(data: PrbDossierData): void {
    for (const item of data.evidence) {
      expect(item.unresolvedSourceIds).toEqual([]);
      for (const sourceId of item.sourceIds) {
        const matches = data.sources.filter((source) => source.id === sourceId);
        expect(matches).toHaveLength(1);
        expect(matches[0].usedByEvidenceIds).toContain(item.id);
      }
    }
  }

  it("resolves every evidence source ID to exactly one top-level source for a fully resolved projection", () => {
    expectResolvedIntegrity(buildPrbDossierData(richProjection()));
  });

  it("holds reference integrity and canonical counts for the real resolved PRB-0005 projection", async () => {
    const lookup = new Map((await prb0005DataProvider.listRecords()).map((summary) => [summary.id, summary]));
    const projection = await loadProblemProjection(prb0005DataProvider, lookup, "PRB-0005");
    const data = buildPrbDossierData(projection);

    expectResolvedIntegrity(data);
    expect(data.evidence.map((item) => item.id)).toEqual(projection.evidence.map((item) => item.detail.id));
    expect(data.counts).toEqual({ evidenceRecordCount: 11, distinctSourceCount: 9, effectCount: 15, openQuestionCount: 2 });
    expect(data.decisionBasis).toBeNull();
    expect(JSON.parse(JSON.stringify(data))).toStrictEqual(data);
  });
});
