/**
 * Synthetic corpus shared by the reduced reviewer-input tests
 * (reduced-reviewer-input.test.ts) and their reference-profile regression.
 * Every record is invented; no canonical record is read.
 */
import { readFileSync } from "node:fs";

import type { SourceVerification, SourceVerificationSet } from "../core/source-verifications.ts";
import type { CorpusIndex, ParsedRecord, RecordFields, RecordSchema } from "../core/types.ts";
import type { CandidateDelta, CandidateRecord } from "../integration/candidate-delta.ts";
import type { ReviewerInputSource } from "./reviewer-input.ts";

export const SHA = "0123456789abcdef0123456789abcdef01234567";

const schema = (name: string): RecordSchema => JSON.parse(readFileSync(new URL(`../../../research/schemas/${name}.schema.json`, import.meta.url), "utf8"));
/** The repository's actual schemas: reference discovery and the geography ordering read them. */
export const SOURCE_SCHEMA = schema("source");
export const EVIDENCE_SCHEMA = schema("evidence");
export const PROBLEM_SCHEMA = schema("problem");

/** A Source carrying fields on and off the reduced allow-list. */
export function source(id: string, extra: RecordFields = {}): RecordFields {
  return {
    source_id: id,
    publisher: `Entidade ${id}`,
    creators: [`Autor ${id}`],
    name: `Relatório ${id}`,
    resource_type: "document",
    identity: { version: "v1" },
    scope: { geography: { level: "municipality", area: "Évora" }, temporal: { start: "2024", end: "2025" }, domains: ["ENV"] },
    access: { level: "public", availability: "available", machine_readable: false, method: "download", format: "pdf" },
    acquisition: { method: "public_web", obtained_at: "2026-01-02" },
    canonical_reference: `https://example.test/${id}`,
    licensing: { status: "unknown", licence: "Licença desconhecida", reuse: "unknown" },
    temporal: { published_at: "2025-03", last_checked_at: "2026-01-03", update_frequency: "annual" },
    caveats: ["Amostra reduzida."],
    ...extra,
  };
}

export function evidence(id: string, summary: string, scope: RecordFields, sources: string[], extra: RecordFields = {}): RecordFields {
  return {
    evidence_id: id,
    created_at: "2026-01-04",
    updated_at: "2026-01-04",
    provenance: { sources, captured_at: "2026-01-04" },
    observation: { summary },
    scope,
    domains: ["ENV"],
    inference_limits: ["Não mede a frequência dos atrasos."],
    evidence_nature: "reported-experience",
    claim_authority: "non_authoritative",
    ...extra,
  };
}

const MUNICIPAL = { geography: { level: "municipality", area: "Évora" }, populations: ["residentes"], temporal: { as_of: "2025" } };
const SITE = { geography: { level: "local_area", area: "Malagueira" }, populations: ["moradores"], temporal: { as_of: "2025" } };

/** Changed by the reverse-impact scenarios: municipal → one neighbourhood. */
export const EVD_A_BROAD = evidence("EVD-A", "Residentes de Évora relatam atrasos na recolha de resíduos em 2025.", MUNICIPAL, ["SRC-A"]);
export const EVD_A_NARROW = evidence("EVD-A", "Moradores da Malagueira relatam atrasos na recolha de resíduos em 2025.", SITE, ["SRC-A"]);
/** Unchanged, still supports the municipal wording. */
export const EVD_B = evidence("EVD-B", "Residentes de Évora relatam atrasos na recolha de resíduos em 2025.", MUNICIPAL, ["SRC-B"]);
/** Unchanged boundary Evidence, linked only through decision_basis.boundary_evidence and an open question. */
export const EVD_C = evidence("EVD-C", "O contrato de recolha prevê duas recolhas semanais.", MUNICIPAL, ["SRC-C"], { evidence_nature: "fact", claim_authority: "authoritative" });
export const EVD_UNRELATED = evidence("EVD-U", "Sem relação.", MUNICIPAL, ["SRC-U"]);

export function problem(id: string, statement: string, evidenceEntries: RecordFields[], extra: RecordFields = {}): RecordFields {
  return {
    problem_id: id,
    created_at: "2026-01-05",
    updated_at: "2026-01-05",
    title: "Atrasos na recolha de resíduos",
    domain: ["ENV"],
    geography: { level: "municipality", area: "Évora" },
    affected_populations: ["residentes"],
    problem_statement: statement,
    evidence: evidenceEntries,
    evidence_status: "corroborated",
    validation_status: "partially_validated",
    digital_tractability: "not_assessed",
    solution_landscape_status: "not_assessed",
    status: "OPEN",
    ...extra,
  };
}

export const PRB_A = problem(
  "PRB-A",
  "Residentes de Évora relatam atrasos na recolha de resíduos.",
  [
    { evidence_id: "EVD-A", effects: ["SUPPORTS"], research_roles: ["LOCAL_OBSERVATION"] },
    { evidence_id: "EVD-B", effects: ["SUPPORTS", "BOUNDS"], research_roles: ["LOCAL_OBSERVATION"] },
  ],
  {
    investigation: {
      open_questions: [{ question: "A frequência contratual é cumprida?", evidence: ["EVD-C"] }],
      path: { initial_signal: { summary: "Relatos de residentes sobre atrasos.", evidence: ["EVD-A"] } },
    },
    decision_basis: {
      supporting_evidence: ["EVD-A", "EVD-B"],
      boundary_evidence: ["EVD-C"],
      contradiction_search: { performed: true, summary: "Procurou-se contradição no contrato.", evidence: ["EVD-C"] },
      scope: { geography: "Évora", population: "residentes", temporal: "2025", bounded: true },
    },
  },
);
export const PRB_UNRELATED = problem("PRB-U", "Outro problema sem relação.", [{ evidence_id: "EVD-U", effects: ["SUPPORTS"] }]);

function family(recordSchema: RecordSchema, records: RecordFields[]) {
  const parsed: ParsedRecord[] = records.map((fields) => ({ file: `${recordSchema.directory}/${fields[recordSchema.idField]}.yaml`, fields }));
  return { schema: recordSchema, records: parsed, byId: new Map(parsed.map((r) => [r.fields[recordSchema.idField] as string, r])) };
}

export function corpus(records: { sources?: RecordFields[]; evidence?: RecordFields[]; problems?: RecordFields[] } = {}): CorpusIndex {
  const sources = records.sources ?? ["SRC-A", "SRC-B", "SRC-C", "SRC-U"].map((id) => source(id));
  const evidenceRecords = records.evidence ?? [EVD_A_BROAD, EVD_B, EVD_C, EVD_UNRELATED];
  const problems = records.problems ?? [PRB_A, PRB_UNRELATED];
  const byPrefix = new Map([
    ["SRC-", family(SOURCE_SCHEMA, sources)],
    ["EVD-", family(EVIDENCE_SCHEMA, evidenceRecords)],
    ["PRB-", family(PROBLEM_SCHEMA, problems)],
  ]);
  return { researchRoot: "/synthetic", byPrefix, totalRecords: sources.length + evidenceRecords.length + problems.length };
}

export function verification(sourceId: string, statements: string[]): SourceVerification {
  return {
    source_id: sourceId,
    retrieval: { retrieved_at: "2026-01-06", content_sha256: "ab".repeat(32), media_type: "application/pdf" },
    verified_claims: statements.map((statement, i) => ({ locator: `p. ${i + 1}`, statement })),
  };
}

export function supportSet(verifications: SourceVerification[]): SourceVerificationSet {
  return { bySourceId: new Map(verifications.map((v) => [v.source_id, v])), issues: [] };
}

const idOf = (c: CandidateRecord): string => (c.fields.problem_id ?? c.fields.evidence_id ?? c.fields.source_id) as string;

export type Change = { candidate: CandidateRecord; action: CandidateDelta["action"] };
export const evd = (fields: RecordFields, action: CandidateDelta["action"] = "UPDATE"): Change => ({ candidate: { recordFamily: "EVD-", fields }, action });
export const prb = (fields: RecordFields, action: CandidateDelta["action"] = "UPDATE"): Change => ({ candidate: { recordFamily: "PRB-", fields }, action });
export const src = (fields: RecordFields, action: CandidateDelta["action"] = "UPDATE"): Change => ({ candidate: { recordFamily: "SRC-", fields }, action });

/** A reviewer source in CanonicalIntegrationReview order (family, then ID). */
export function change(index: CorpusIndex, changes: Change[], overrides: Partial<ReviewerInputSource> = {}): ReviewerInputSource {
  const sorted = [...changes].sort((a, b) => {
    const key = (c: Change) => `${c.candidate.recordFamily}\u0000${idOf(c.candidate)}`;
    return key(a) < key(b) ? -1 : 1;
  });
  return {
    baseGitSha: SHA,
    manifest: { investigationQuestion: "Revisão direta.", mode: "direct-change" },
    index,
    candidates: sorted.map((c) => c.candidate),
    deltas: sorted.map((c) => ({ recordFamily: c.candidate.recordFamily, id: idOf(c.candidate), action: c.action })),
    validation: { errors: [], totalRecords: index.totalRecords },
    readiness: "READY_FOR_INTEGRATION_GATE",
    sourceVerifications: supportSet([verification("SRC-A", ["A fonte regista atrasos."]), verification("SRC-B", ["Outra afirmação."])]),
    ...overrides,
  };
}

/** The representative reverse-impact change: EVD-A narrows, PRB-A is untouched. */
export function narrowingChange(): ReviewerInputSource {
  return change(corpus(), [evd(EVD_A_NARROW)]);
}
