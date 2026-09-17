import type { RecordDetail, RecordSummary } from "../dataProvider/types";
import { normalizeForSearch } from "../records/normalize";
import { describeTopic } from "../presentation/topicMapping";

export interface TypeCount {
  type: string;
  count: number;
}

export interface FieldDistribution {
  type: string;
  field: string;
  values: { value: string; count: number }[];
}

export interface OverviewStats {
  totalRecords: number;
  countsByType: TypeCount[];
  distributions: FieldDistribution[];
}

export interface OverviewProblem {
  id: string;
  title: string;
  validationStatus: string | null;
  evidenceStatus: string | null;
}

export interface PublicOverviewData {
  problemCount: number;
  evidenceCount: number;
  problems: OverviewProblem[];
}

export interface MaterialChangeEntry {
  problemId: string;
  problemTitle: string;
  date: string;
  summary: string;
}

export interface MaterialChangeSource {
  summary: RecordSummary;
  detail: RecordDetail;
}

export function formatProblemCount(count: number): string {
  return `${count} ${count === 1 ? "problema" : "problemas"} em investigação`;
}

export function formatEvidenceCount(count: number): string {
  return `${count} ${count === 1 ? "registo" : "registos"} de evidência`;
}

/**
 * The public first-contact projection. It deliberately uses only index
 * summaries: canonical PRB title/identity and schema-derived status fields.
 * It is not persisted and does not introduce an Overview-specific dataset.
 */
export function computePublicOverviewData(records: RecordSummary[]): PublicOverviewData {
  const problems = records
    .filter((record) => record.type === "PRB-")
    .map((record) => ({
      id: record.id,
      title: record.label,
      validationStatus: typeof record.summaryFields.validation_status === "string" ? record.summaryFields.validation_status : null,
      evidenceStatus: typeof record.summaryFields.evidence_status === "string" ? record.summaryFields.evidence_status : null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    problemCount: problems.length,
    evidenceCount: records.filter((record) => record.type === "EVD-").length,
    problems,
  };
}

/**
 * WU054 — the citizen-discovery projection of one canonical PRB, derived at
 * runtime from a `getRecord()` detail read that Overview already performs
 * (previously used only to resolve the full title via `findMeaningField`).
 * Not persisted, not a read-model shape, and not a competing semantic
 * representation (AGENTS.md canonical-state integrity) — every field here is
 * read straight off the canonical PRB record and kept in its raw stored
 * form; PT-PT presentation labels come from the existing presentation
 * helpers (`presentation.ts`, `topicMapping.ts`) at render time, never here.
 */
export interface CitizenProblem {
  id: string;
  title: string;
  problemStatement: string | null;
  domainCodes: string[];
  affectedPopulations: string[];
  geographyArea: string | null;
  lifecycleStatus: string | null;
  validationStatus: string | null;
  evidenceStatus: string | null;
  updatedAt: string | null;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function summaryStringField(summary: RecordSummary, field: string): string | null {
  const value = summary.summaryFields[field];
  return typeof value === "string" ? value : null;
}

/**
 * Projects one canonical PRB detail (`RecordDetail.record`, as read by
 * `DataProvider.getRecord()`) into the fields citizen discovery (search,
 * filters, cards) actually needs. Falls back to the index summary's `label`
 * for `title` when the canonical `title` field is missing, matching
 * `Overview.tsx`'s existing fallback behaviour.
 */
export function toCitizenProblem(summary: RecordSummary, detail: RecordDetail): CitizenProblem {
  const record = detail.record;
  return {
    id: summary.id,
    title: asString(record.title) ?? summary.label,
    problemStatement: asString(record.problem_statement),
    domainCodes: asStringArray(record.domain),
    affectedPopulations: asStringArray(record.affected_populations),
    geographyArea: typeof record.geography === "object" && record.geography !== null ? asString((record.geography as Record<string, unknown>).area) : null,
    lifecycleStatus: asString(record.status) ?? summaryStringField(summary, "status"),
    validationStatus: asString(record.validation_status) ?? summaryStringField(summary, "validation_status"),
    evidenceStatus: asString(record.evidence_status) ?? summaryStringField(summary, "evidence_status"),
    updatedAt: asString(record.updated_at),
  };
}

/**
 * Runtime-only projection of the explicitly authored PRB history used by the
 * citizen-facing material-change timeline. `updated_at` intentionally plays
 * no part: an authored history entry is the sole material-change signal.
 *
 * Entries sort newest date first. Entries with the same authored date use
 * Problem ID ascending, then their authored array position ascending. Those
 * mechanical ties communicate neither importance nor intra-day recency.
 */
export function projectMaterialChangeEntries(sources: MaterialChangeSource[]): MaterialChangeEntry[] {
  const candidates = sources.flatMap(({ summary, detail }) => {
    if (summary.type !== "PRB-" || !Array.isArray(detail.record.history)) return [];
    const title = asString(detail.record.title) ?? summary.label;
    return detail.record.history.flatMap((value, authoredPosition) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
      const entry = value as Record<string, unknown>;
      const date = asString(entry.date);
      const entrySummary = asString(entry.summary);
      if (date === null || entrySummary === null) return [];
      return [{ problemId: summary.id, problemTitle: title, date, summary: entrySummary, authoredPosition }];
    });
  });

  return candidates
    .sort((a, b) => b.date.localeCompare(a.date) || a.problemId.localeCompare(b.problemId) || a.authoredPosition - b.authoredPosition)
    .map(({ authoredPosition: _authoredPosition, ...entry }) => entry);
}

/**
 * The audited topic filters relevant to the currently loaded Problems only
 * (one entry per canonical domain code actually present; "Todos" is added
 * separately by the caller and always sorts first). Ordered alphabetically
 * by each code's PT-PT public label (`describeTopic`, locale-aware compare)
 * — never a filter for a domain code absent from the loaded corpus, and
 * never a grouping beyond the 12 approved mappings (topicMapping.ts's own
 * neutral fallback covers any future unaudited code without inventing a new
 * public grouping here). This governs topic-filter control order only; PRB
 * Problem ordering stays the deterministic PRB-ID order throughout.
 */
export function relevantTopicCodes(problems: CitizenProblem[]): string[] {
  const present = new Set(problems.flatMap((problem) => problem.domainCodes));
  return [...present].sort((a, b) => describeTopic(a).label.localeCompare(describeTopic(b).label, "pt-PT"));
}

/** A Problem matches a topic filter when that canonical domain code is present among its (possibly multiple) domains. Never reorders or ranks. */
export function matchesTopicFilter(problem: CitizenProblem, topicCode: string | null): boolean {
  return topicCode === null || problem.domainCodes.includes(topicCode);
}

/**
 * Citizen-facing search fields only, per WU054 scope: title, problem
 * statement, affected populations, geography, and the PT-PT topic label
 * (never PRB history, decision_basis, evidence IDs, or other technical
 * fields). Deterministic, case- and accent-insensitive
 * (`normalizeForSearch`, shared with Records search), and purely
 * client-side.
 */
export function matchesCitizenSearch(problem: CitizenProblem, query: string): boolean {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (normalizedQuery === "") return true;

  const haystack = [
    problem.title,
    problem.problemStatement ?? "",
    ...problem.affectedPopulations,
    problem.geographyArea ?? "",
    ...problem.domainCodes.map((code) => describeTopic(code).label),
  ].join(" ␟ ");

  return normalizeForSearch(haystack).includes(normalizedQuery);
}

// Tuned to surface a handful of genuinely informative distributions (e.g. a
// PRB's validation_status, an EVD's evidence_nature) without hardcoding any field
// name — every schema-conforming record type is treated identically.
const MIN_PRESENCE_RATIO = 0.5;
const MIN_DISTINCT_VALUES = 2;
const MAX_DISTINCT_VALUES = 8;
const MAX_DISTRIBUTIONS_PER_TYPE = 2;

/**
 * Corpus-orientation statistics derived entirely from the already-loaded
 * index.json (RecordSummary[]) — no record-detail or edges.json access.
 *
 * Distributions are computed generically from whatever `summaryFields` keys
 * are actually present (RE-01's adapter lifts a schema's `enums`-declared
 * fields into summaryFields — see read-model-spec.md); a field only
 * qualifies as a "distribution" for a given type if it appears on at least
 * half that type's records with a small, genuinely-distinguishing number of
 * distinct values. No field name (including "domain", which today is not
 * enum-constrained by any schema and therefore is not present in
 * summaryFields) is special-cased — this is a deliberate scope boundary,
 * not an oversight: broadening RE-01's summaryFields selection is a
 * separate, evidenced adapter decision, not an RE-02C UI concern.
 */
export function computeOverviewStats(records: RecordSummary[]): OverviewStats {
  const byType = new Map<string, RecordSummary[]>();
  for (const record of records) {
    if (!byType.has(record.type)) byType.set(record.type, []);
    byType.get(record.type)!.push(record);
  }

  const countsByType = [...byType.entries()]
    .map(([type, typeRecords]) => ({ type, count: typeRecords.length }))
    .sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0));

  const distributions: FieldDistribution[] = [];
  for (const [type, typeRecords] of byType) {
    const valueCountsByField = new Map<string, Map<string, number>>();
    const presenceByField = new Map<string, number>();

    for (const record of typeRecords) {
      for (const [field, rawValue] of Object.entries(record.summaryFields)) {
        if (typeof rawValue !== "string" && typeof rawValue !== "number" && typeof rawValue !== "boolean") continue;
        const value = String(rawValue);
        if (!valueCountsByField.has(field)) valueCountsByField.set(field, new Map());
        const valueCounts = valueCountsByField.get(field)!;
        valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1);
        presenceByField.set(field, (presenceByField.get(field) ?? 0) + 1);
      }
    }

    const candidates = [...valueCountsByField.entries()]
      .map(([field, valueCounts]) => ({
        field,
        presenceRatio: (presenceByField.get(field) ?? 0) / typeRecords.length,
        values: [...valueCounts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1)),
      }))
      .filter(
        (c) =>
          c.presenceRatio >= MIN_PRESENCE_RATIO && c.values.length >= MIN_DISTINCT_VALUES && c.values.length <= MAX_DISTINCT_VALUES
      )
      .sort((a, b) => b.presenceRatio - a.presenceRatio || (a.field < b.field ? -1 : 1))
      .slice(0, MAX_DISTRIBUTIONS_PER_TYPE);

    for (const candidate of candidates) {
      distributions.push({ type, field: candidate.field, values: candidate.values });
    }
  }

  return { totalRecords: records.length, countsByType, distributions };
}
