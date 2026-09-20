import type { RecordDetail, RecordSummary } from "../dataProvider/types";
import { normalizeForSearch } from "../records/normalize";
import { describeTopic, auditedDomainCodes } from "../presentation/topicMapping";

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
  sourceCount: number;
  problems: OverviewProblem[];
}

export interface MaterialChangeEntry {
  problemId: string;
  problemTitle: string;
  date: string;
  summary: string;
  domainCodes: string[];
}

export interface MaterialChangeSource {
  summary: RecordSummary;
  detail: RecordDetail;
}

/**
 * Metrics label only (value rendered separately in markup — Overview
 * visual-completion delta §5). PT-PT singular only for one, plural for zero
 * or more than one.
 */
export function problemCountLabel(count: number): string {
  return count === 1 ? "Problema acompanhado" : "Problemas acompanhados";
}

/** Metrics label only — PT-PT singular only for one, plural for zero or more than one. */
export function evidenceCountLabel(count: number): string {
  return count === 1 ? "Registo de evidência" : "Registos de evidência";
}

/**
 * Metrics label only, for the canonical `SRC-` record count (docs/datamodel.md
 * §1 — a Source is "an identifiable origin from which information is
 * obtained"). Same counting pattern as `evidenceCount` (a plain `record.type`
 * count over the loaded index), never a separately derived total. PT-PT
 * singular only for one, plural for zero or more than one.
 */
export function sourceCountLabel(count: number): string {
  return count === 1 ? "Fonte primária" : "Fontes primárias";
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
    sourceCount: records.filter((record) => record.type === "SRC-").length,
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
    const domainCodes = asStringArray(detail.record.domain);
    return detail.record.history.flatMap((value, authoredPosition) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
      const entry = value as Record<string, unknown>;
      const date = asString(entry.date);
      const entrySummary = asString(entry.summary);
      if (date === null || entrySummary === null) return [];
      return [{ problemId: summary.id, problemTitle: title, date, summary: entrySummary, domainCodes, authoredPosition }];
    });
  });

  return candidates
    .sort((a, b) => b.date.localeCompare(a.date) || a.problemId.localeCompare(b.problemId) || a.authoredPosition - b.authoredPosition)
    .map(({ authoredPosition: _authoredPosition, ...entry }) => entry);
}

export interface TopicCategoryCount {
  code: string;
  count: number;
}

/**
 * The `limit` canonical domain codes with the highest Problem counts. Used by
 * the category drawer (Overview final redesign, Phase 1) to compute each
 * topic's real, unfiltered count — callers pass `allTopicCodes().length` as
 * `limit` there so every audited topic is represented, not only a ranked
 * top-N. One Problem carrying multiple domain codes counts once toward each
 * of its codes (the same "any one of its domains" membership
 * `matchesTopicFilter` already uses), never toward only one chosen "primary"
 * domain (AGENTS.md "Human-owned decisions" — this presentation layer does
 * not pick a primary domain). Ties break by PT-PT label order (locale-aware
 * compare via `describeTopic`), a stable, deterministic, non-ranking
 * tie-break rather than load/insertion order.
 */
export function topCategoryCounts(problems: CitizenProblem[], limit: number): TopicCategoryCount[] {
  const counts = new Map<string, number>();
  for (const problem of problems) {
    for (const code of problem.domainCodes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || describeTopic(a.code).label.localeCompare(describeTopic(b.code).label, "pt-PT"))
    .slice(0, limit);
}

/** A Problem matches a topic filter when that canonical domain code is present among its (possibly multiple) domains. Never reorders or ranks. */
export function matchesTopicFilter(problem: CitizenProblem, topicCode: string | null): boolean {
  return topicCode === null || problem.domainCodes.includes(topicCode);
}

/**
 * The full canonical TEMA vocabulary (every audited `domain` code —
 * `topicMapping.ts`'s `auditedDomainCodes()`), in deterministic PT-PT public
 * label order (locale-aware compare via `describeTopic`) — the category
 * drawer's complete, stable topic ordering (Overview final redesign, Phase
 * 1). Every audited code is included regardless of whether any currently
 * loaded Problem carries it, so the drawer's option set never changes shape
 * as the visible result subset changes.
 */
export function allTopicCodes(): string[] {
  return [...auditedDomainCodes()].sort((a, b) => describeTopic(a).label.localeCompare(describeTopic(b).label, "pt-PT"));
}

export type ProblemSortOrder = "id" | "updatedAt";

/**
 * The editorial list's two sort orders. `"id"` is the existing deterministic
 * PRB-ID ascending order (unchanged default, matches every other Problem
 * ordering in Overview/Records). `"updatedAt"` orders by canonical
 * `CitizenProblem.updatedAt` descending (most recently updated first); a
 * `null` updatedAt sorts last (genuinely unknown recency, never assumed to
 * be "oldest" via a fabricated date); same-date entries — and every null —
 * break ties by ascending PRB ID, the same neutral tie-break
 * `projectMaterialChangeEntries` already uses, so the order stays fully
 * deterministic. This is a distinct field/label from the Hero ruler's
 * "Última alteração" (the authored material-change date) — see
 * OverviewPresentation.tsx's own note against conflating the two.
 */
export function sortProblems(problems: CitizenProblem[], order: ProblemSortOrder): CitizenProblem[] {
  const sorted = [...problems];
  if (order === "id") {
    return sorted.sort((a, b) => a.id.localeCompare(b.id));
  }
  return sorted.sort((a, b) => {
    if (a.updatedAt === b.updatedAt) return a.id.localeCompare(b.id);
    if (a.updatedAt === null) return 1;
    if (b.updatedAt === null) return -1;
    return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
  });
}

/** Fixed page size for the Overview problem list (Overview visual-completion — pagination). Not user-configurable. */
export const OVERVIEW_PROBLEMS_PER_PAGE = 10;

/**
 * Total page count for a given result count at the fixed page size, never
 * less than 1 (an empty result set still has "page 1 of 1" as its neutral
 * state, and callers gate the pagination footer's visibility separately —
 * see `OverviewPresentation`'s own note on when the footer renders at all).
 */
export function overviewPageCount(resultCount: number): number {
  return Math.max(1, Math.ceil(resultCount / OVERVIEW_PROBLEMS_PER_PAGE));
}

/**
 * Slices the already filtered+sorted Problem list to one page. Pagination is
 * strictly the last step of the pipeline (search → filters → sort →
 * pagination — Overview visual-completion): callers must only ever call this
 * against `sortProblems`'s own output, never against the unsorted/unfiltered
 * `citizenProblems`, so the result-count semantics stay a single, unambiguous
 * "total filtered results" everywhere else in Overview (the results header's
 * count is deliberately computed from the pre-pagination list, not this
 * slice). `page` is clamped to the valid `[1, overviewPageCount(...)]` range
 * so a stale page number (e.g. after a filter shrinks the result set) never
 * produces an out-of-range or empty slice.
 */
export function paginateProblems(problems: CitizenProblem[], page: number): CitizenProblem[] {
  const pageCount = overviewPageCount(problems.length);
  const clampedPage = Math.min(Math.max(1, page), pageCount);
  const start = (clampedPage - 1) * OVERVIEW_PROBLEMS_PER_PAGE;
  return problems.slice(start, start + OVERVIEW_PROBLEMS_PER_PAGE);
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
