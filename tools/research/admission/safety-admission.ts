/** Deterministic, non-persisted WU049 pre-Gate safety admission. */
import { getRecordField } from "../core/record-fields.ts";
import type { CorpusIndex, ParsedRecord } from "../core/types.ts";
import type { CandidateRecord } from "../integration/candidate-delta.ts";

export type SafetyDisposition = "ELIGIBLE" | "HOLD";
export type AvailabilityStatus = "available" | "unavailable" | "unknown" | "timeout" | "error" | "unsupported" | "authentication_required";
export interface AvailabilityEvidence { sourceId: string; status: AvailabilityStatus; checkedAt: string; }
export interface SourceAvailabilityAdapter { check(sourceId: string, source: Record<string, unknown>): AvailabilityEvidence; }
export interface SafetyFinding {
  code: string;
  subjectId: string;
  severity: "info" | "blocker";
  summary: string;
  evidenceReferences?: string[];
}
export interface SafetyAdmission { disposition: SafetyDisposition; findings: SafetyFinding[]; evaluatedAt: string; }
export interface EvaluateSafetyAdmissionInput {
  index: CorpusIndex;
  candidates: readonly CandidateRecord[];
  affectedProblemIds: readonly string[];
  frozenAt: string;
  evaluatedAt: string;
  availabilityAdapter?: SourceAvailabilityAdapter;
}

const MINUTE = 60_000;
function record(index: CorpusIndex, prefix: string, id: string): ParsedRecord | undefined { return index.byPrefix.get(prefix)?.byId.get(id); }
function array(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []; }
function idOf(fields: Record<string, unknown>, field: string): string | undefined { const value = getRecordField(fields, field); return typeof value === "string" ? value : undefined; }
function evdSources(fields: Record<string, unknown>): string[] { return array(getRecordField(fields, "provenance.sources")); }
function candidateById(candidates: readonly CandidateRecord[], family: string, field: string, id: string): Record<string, unknown> | undefined {
  return candidates.find((candidate) => candidate.recordFamily === family && idOf(candidate.fields, field) === id)?.fields;
}

/** Explicit candidate EVD provenance plus decision-basis EVD provenance only. */
function materialEvidence(input: EvaluateSafetyAdmissionInput): { id: string; fields: Record<string, unknown> }[] {
  const result = new Map<string, Record<string, unknown>>();
  for (const candidate of input.candidates) if (candidate.recordFamily === "EVD-") {
    const id = idOf(candidate.fields, "evidence_id"); if (id) result.set(id, candidate.fields);
  }
  for (const problemId of input.affectedProblemIds) {
    const fields = candidateById(input.candidates, "PRB-", "problem_id", problemId) ?? record(input.index, "PRB-", problemId)?.fields; if (!fields) continue;
    const basis = getRecordField(fields, "decision_basis");
    if (!basis || typeof basis !== "object") continue;
    for (const key of ["manifestation.evidence", "consequence.evidence", "currentness.evidence", "contradiction_search.evidence", "supporting_evidence", "boundary_evidence"]) {
      for (const evidenceId of array(getRecordField(basis as Record<string, unknown>, key))) {
        const evidence = record(input.index, "EVD-", evidenceId)?.fields; if (evidence) result.set(evidenceId, evidence);
      }
    }
  }
  return [...result].map(([id, fields]) => ({ id, fields }));
}

/** PRB evidence relationships own contradiction semantics; EVD does not. */
function contradictionFindings(input: EvaluateSafetyAdmissionInput): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  for (const problemId of input.affectedProblemIds) {
    const problem = candidateById(input.candidates, "PRB-", "problem_id", problemId) ?? record(input.index, "PRB-", problemId)?.fields;
    if (!problem) continue;
    for (const relation of getRecordField(problem, "evidence") as unknown[] ?? []) {
      if (!relation || typeof relation !== "object") continue;
      const fields = relation as Record<string, unknown>;
      const evidenceId = typeof fields.evidence_id === "string" ? fields.evidence_id : undefined;
      if (!evidenceId || !array(fields.effects).includes("CONTRADICTS")) continue;
      const summary = getRecordField(problem, "decision_basis.contradiction_search.summary");
      findings.push({ code: "CONTRADICTION_VISIBLE", subjectId: evidenceId, severity: "info", summary: typeof summary === "string" && summary.trim() ? summary : `Contradictory evidence is linked to ${problemId}.`, evidenceReferences: [problemId, evidenceId] });
    }
  }
  return findings;
}

function findingsSorted(findings: SafetyFinding[]): SafetyFinding[] {
  const unique = new Map<string, SafetyFinding>();
  for (const finding of findings) unique.set(`${finding.code}\u0000${finding.subjectId}`, finding);
  return [...unique.values()].sort((a, b) => a.code.localeCompare(b.code) || a.subjectId.localeCompare(b.subjectId));
}

export function evaluateSafetyAdmission(input: EvaluateSafetyAdmissionInput): SafetyAdmission {
  const findings: SafetyFinding[] = contradictionFindings(input);
  const candidateSources = new Map<string, Record<string, unknown>>();
  for (const candidate of input.candidates) if (candidate.recordFamily === "SRC-") { const id = idOf(candidate.fields, "source_id"); if (id) candidateSources.set(id, candidate.fields); }
  const evidence = materialEvidence(input);
  const sourceIds = new Set<string>();
  for (const item of evidence) {
    for (const sourceId of evdSources(item.fields)) sourceIds.add(sourceId);
    if (getRecordField(item.fields, "evidence_nature") === "claim") {
      const authority = getRecordField(item.fields, "claim_authority");
      if (authority !== "authoritative") findings.push({ code: authority === "unknown" || authority === undefined ? "CLAIM_AUTHORITY_UNKNOWN" : "CLAIM_AUTHORITY_INSUFFICIENT", subjectId: item.id, severity: "blocker", summary: "Claim authority does not meet the required canonical value." });
      const limits = getRecordField(item.fields, "inference_limits");
      if (!Array.isArray(limits)) findings.push({ code: "CLAIM_INFERENCE_LIMITS_INDETERMINATE", subjectId: item.id, severity: "blocker", summary: "Claim inference limits are absent or indeterminate." });
      else if (limits.length > 0) findings.push({ code: "CLAIM_INFERENCE_LIMITS_PRESENT", subjectId: item.id, severity: "blocker", summary: "Claim has explicit inference limits requiring human resolution." });
    }
  }
  for (const sourceId of sourceIds) {
    const source = candidateSources.get(sourceId) ?? record(input.index, "SRC-", sourceId)?.fields;
    if (!source) { findings.push({ code: "SOURCE_REVALIDATION_MISSING", subjectId: sourceId, severity: "blocker", summary: "Material Source cannot be resolved for revalidation." }); continue; }
    if (getRecordField(source, "access.level") === "private") { findings.push({ code: "PRIVATE_SOURCE", subjectId: sourceId, severity: "blocker", summary: "Material Source is private and cannot enter the pre-Gate path." }); continue; }
    let evidence: AvailabilityEvidence | undefined;
    try { evidence = input.availabilityAdapter?.check(sourceId, source); } catch { findings.push({ code: "SOURCE_AVAILABILITY_UNVERIFIABLE", subjectId: sourceId, severity: "blocker", summary: "Material Source availability could not be verified." }); continue; }
    if (!evidence || evidence.sourceId !== sourceId) { findings.push({ code: "SOURCE_REVALIDATION_MISSING", subjectId: sourceId, severity: "blocker", summary: "No same-Source availability evidence was supplied." }); continue; }
    const checked = Date.parse(evidence.checkedAt), frozen = Date.parse(input.frozenAt), now = Date.parse(input.evaluatedAt);
    if (!Number.isFinite(checked) || !Number.isFinite(frozen) || !Number.isFinite(now) || checked < frozen || checked > now || now - checked > 10 * MINUTE) { findings.push({ code: "SOURCE_REVALIDATION_STALE", subjectId: sourceId, severity: "blocker", summary: "Material Source availability evidence is not fresh after candidate freeze." }); continue; }
    if (evidence.status === "unavailable") findings.push({ code: "SOURCE_UNAVAILABLE", subjectId: sourceId, severity: "blocker", summary: "Material Source is unavailable." });
    else if (evidence.status !== "available") findings.push({ code: "SOURCE_AVAILABILITY_UNVERIFIABLE", subjectId: sourceId, severity: "blocker", summary: "Material Source availability could not be verified." });
  }
  const ordered = findingsSorted(findings);
  return { disposition: ordered.some((f) => f.severity === "blocker") ? "HOLD" : "ELIGIBLE", findings: ordered, evaluatedAt: input.evaluatedAt };
}
