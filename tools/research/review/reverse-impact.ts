/**
 * Reverse EVD→PRB impact (CRR-02, docs/freezeplan.md §3.2): the one
 * deterministic derivation of which Problems a change to Evidence reaches.
 * When an EVD is created or updated, every PRB that references it in the
 * prospective corpus is semantically affected even if its own file is
 * unchanged, so the shared reviewer package (reviewer-input.ts) makes each
 * such unchanged PRB a review subject of its own.
 *
 * Complete evidential coverage is not recursive record context: an impacted
 * PRB is judged against a bounded projection of every EVD it links (the
 * fields PRB→EVD comparison needs) and never against those EVDs' Sources or
 * Source Verification Support. The evidential chain stays SRC → EVD → PRB.
 */
import { getRecordField } from "../core/record-fields.ts";
import type { CorpusIndex, RecordFields, RecordIndex } from "../core/types.ts";
import type { CandidateDelta } from "../integration/candidate-delta.ts";

/**
 * PRB→EVD reference locations that sit inside lists of objects or nested
 * stage objects and therefore cannot be declared in the schema's flat
 * `references` array. research/schemas/problem.schema.json declares them in
 * its notes and stringListFields; validate.ts enforces them as EVD-* lists.
 */
const NESTED_PROBLEM_EVIDENCE_LISTS: readonly { list?: string; field: string }[] = [
  { list: "investigation.open_questions", field: "evidence" },
  { field: "investigation.path.initial_signal.evidence" },
  { field: "investigation.path.development.evidence" },
  { field: "investigation.path.delimitation.evidence" },
];

/** The only EVD fields a reverse-impact boundary carries (PRB→EVD comparison). */
export const LINKED_EVIDENCE_BOUNDARY_FIELDS: readonly string[] = ["observation.summary", "scope", "inference_limits", "evidence_nature", "claim_authority"];

/** One EVD a PRB links, projected to the fields PRB→EVD comparison needs. */
export interface LinkedEvidenceBoundary {
  evidenceId: string;
  /** Whether this change creates or updates the EVD; its candidate version is the one projected. */
  changed: boolean;
  /** Only LINKED_EVIDENCE_BOUNDARY_FIELDS, each present only when the EVD authors it. */
  fields: RecordFields;
}

/**
 * An unchanged PRB that is a review subject because EVD it links changed.
 * It is never a candidate, never a Git-changed record and never integrated.
 */
export interface ImpactedProblemSubject {
  recordFamily: "PRB-";
  id: string;
  /** Created or updated EVD IDs this PRB links that caused the impact, sorted by ID. */
  changedEvidenceIds: string[];
  /** The PRB's complete authored fields (prospective = base version, since it is unchanged). */
  fields: RecordFields;
  /** Every EVD the PRB links in the prospective corpus, exactly once each, sorted by EVD ID. */
  linkedEvidenceBoundary: LinkedEvidenceBoundary[];
}

/** One PRB reached by a changed EVD, whether or not the PRB is itself a candidate. */
export interface ReverseEvidenceImpact {
  problemId: string;
  problemChanged: boolean;
  changedEvidenceIds: string[];
  linkedEvidenceIds: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pushId(out: Set<string>, value: unknown): void {
  if (typeof value === "string" && value.startsWith("EVD-")) out.add(value);
}

/**
 * Every EVD ID a PRB references through any schema-declared EVD location:
 * each `references` entry whose targetPrefix is EVD- (read from the schema,
 * so a future declared reference is covered) plus the nested investigation
 * lists. Sorted by ID; non-EVD targets are never followed.
 */
export function problemEvidenceReferenceIds(problemIndex: RecordIndex, fields: RecordFields): string[] {
  const ids = new Set<string>();
  for (const ref of problemIndex.schema.references ?? []) {
    if (ref.targetPrefix !== "EVD-") continue;
    const value = getRecordField(fields, ref.field);
    const items = ref.isList && Array.isArray(value) ? value : [value];
    for (const item of items) pushId(ids, ref.itemField && isObject(item) ? getRecordField(item as RecordFields, ref.itemField) : item);
  }
  for (const { list, field } of NESTED_PROBLEM_EVIDENCE_LISTS) {
    const owners = list ? getRecordField(fields, list) : fields;
    for (const owner of list ? (Array.isArray(owners) ? owners : []) : [owners]) {
      const value = isObject(owner) ? getRecordField(owner as RecordFields, field) : undefined;
      for (const item of Array.isArray(value) ? value : []) pushId(ids, item);
    }
  }
  return [...ids].sort();
}

/** EVD IDs this change creates or updates, sorted by ID. */
export function changedEvidenceIds(deltas: readonly CandidateDelta[]): string[] {
  return [...new Set(deltas.filter((d) => d.recordFamily === "EVD-" && (d.action === "CREATE" || d.action === "UPDATE")).map((d) => d.id))].sort();
}

/**
 * Every PRB in the prospective corpus that references a created or updated
 * EVD, sorted by PRB ID. `prospective` must be the candidates overlaid onto
 * the base, so a PRB's current references decide — never stale base ones.
 */
export function deriveReverseEvidenceImpacts(prospective: CorpusIndex, deltas: readonly CandidateDelta[]): ReverseEvidenceImpact[] {
  const changed = changedEvidenceIds(deltas);
  const problems = prospective.byPrefix.get("PRB-");
  if (changed.length === 0 || !problems) return [];
  const candidateProblems = new Set(deltas.filter((d) => d.recordFamily === "PRB-").map((d) => d.id));
  const impacts: ReverseEvidenceImpact[] = [];
  for (const [problemId, record] of problems.byId) {
    const linked = problemEvidenceReferenceIds(problems, record.fields);
    const causes = changed.filter((id) => linked.includes(id));
    if (causes.length > 0) impacts.push({ problemId, problemChanged: candidateProblems.has(problemId), changedEvidenceIds: causes, linkedEvidenceIds: linked });
  }
  return impacts.sort((a, b) => (a.problemId < b.problemId ? -1 : a.problemId > b.problemId ? 1 : 0));
}

/** The bounded projection of one EVD: LINKED_EVIDENCE_BOUNDARY_FIELDS only, each present only when authored. */
export function linkedEvidenceBoundaryFields(evidence: RecordFields): RecordFields {
  const out: RecordFields = {};
  const summary = getRecordField(evidence, "observation.summary");
  if (summary !== undefined) out.observation = { summary: structuredClone(summary) };
  for (const key of LINKED_EVIDENCE_BOUNDARY_FIELDS) {
    if (key.includes(".") || evidence[key] === undefined) continue;
    out[key] = structuredClone(evidence[key]);
  }
  return out;
}

/**
 * The review subjects reverse impact adds: impacted PRBs that are not
 * themselves candidates (a changed PRB is already a full candidate subject).
 * A linked EVD missing from the prospective corpus is kept with empty fields
 * so its absence stays visible rather than silently shrinking the boundary.
 */
export function impactedProblemSubjects(prospective: CorpusIndex, deltas: readonly CandidateDelta[]): ImpactedProblemSubject[] {
  const problems = prospective.byPrefix.get("PRB-");
  const evidence = prospective.byPrefix.get("EVD-");
  return deriveReverseEvidenceImpacts(prospective, deltas)
    .filter((impact) => !impact.problemChanged)
    .map((impact) => ({
      recordFamily: "PRB-" as const,
      id: impact.problemId,
      changedEvidenceIds: impact.changedEvidenceIds,
      fields: structuredClone(problems!.byId.get(impact.problemId)!.fields),
      linkedEvidenceBoundary: impact.linkedEvidenceIds.map((evidenceId) => {
        const record = evidence?.byId.get(evidenceId);
        return { evidenceId, changed: impact.changedEvidenceIds.includes(evidenceId), fields: record ? linkedEvidenceBoundaryFields(record.fields) : {} };
      }),
    }));
}
