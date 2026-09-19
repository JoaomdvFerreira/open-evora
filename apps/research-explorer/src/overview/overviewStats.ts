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
 * Metrics label only, for the same canonical corpus count already shown
 * elsewhere as "Corpus: X registos" (manifest.totalRecords) — not a
 * separately computed total, so this label is never attached to a value
 * derived any other way. PT-PT singular only for one, plural for zero or
 * more than one.
 */
export function totalRecordsLabel(count: number): string {
  return count === 1 ? "Registo total" : "Registos totais";
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

/**
 * The Hero "Atualizado recentemente" panel's own projection: at most `limit`
 * *distinct Problems*, not material-change events. `projectMaterialChangeEntries`
 * is already sorted newest-first and may carry several entries for the same
 * PRB (a Problem can author more than one material-change history entry); this
 * keeps only each PRB's newest entry — first occurrence per `problemId`, since
 * the input is already newest-first — and only then applies `limit`, so a PRB
 * with several recent entries can never itself crowd out other distinct
 * Problems from the panel (the caller's bug this fixes: slicing the raw
 * newest-first list before deduplicating could render the same PRB twice and
 * show fewer than `limit` distinct Problems). Deduplicates by the canonical
 * `problemId` only, never by title (two distinct PRBs may legitimately share a
 * title). This is Hero-panel presentation shaping only — it creates no new
 * semantic state and never mutates or drops the canonical entries themselves;
 * `projectMaterialChangeEntries`'s full, undeduplicated result remains the
 * canonical material-change projection for every other caller.
 */
export function projectRecentDistinctProblems(entries: MaterialChangeEntry[], limit: number): MaterialChangeEntry[] {
  const seen = new Set<string>();
  const distinct: MaterialChangeEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.problemId)) continue;
    seen.add(entry.problemId);
    distinct.push(entry);
    if (distinct.length >= limit) break;
  }
  return distinct;
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

export interface TopicCategoryCount {
  code: string;
  count: number;
}

/**
 * The `limit` canonical domain codes with the highest Problem counts, for the
 * Hero's lightweight category shortcuts (Overview visual-completion delta
 * §4) — a distinct ranking from `relevantTopicCodes` above, which lists every
 * present code alphabetically for the full topic-filter control. One Problem
 * carrying multiple domain codes counts once toward each of its codes (the
 * same "any one of its domains" membership `matchesTopicFilter` already
 * uses), never toward only one chosen "primary" domain (AGENTS.md
 * "Human-owned decisions" — this presentation layer does not pick a primary
 * domain). Ties break by the same PT-PT label order as `relevantTopicCodes`,
 * a stable, deterministic, non-ranking tie-break rather than load/insertion
 * order.
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
 * Editorial problem-list filter rail (Overview visual-completion — editorial
 * list redesign). Each of the three investigation-state dimensions
 * (`lifecycleStatus`/`validationStatus`/`evidenceStatus`) gets its own
 * single-select filter, backed by its own canonical field — never collapsed
 * into one mixed "state" filter (AGENTS.md canonical-state integrity; the
 * three fields are distinct, non-ranked dimensions, matching
 * ProblemLifecycleStatus.tsx/InvestigationStatus.tsx's own separation).
 * These three helpers are intentionally parallel to `matchesTopicFilter`
 * above, not a generic "matches any field" abstraction, so each dimension's
 * own null-handling and field access stays explicit and typed.
 */
export function matchesLifecycleFilter(problem: CitizenProblem, status: string | null): boolean {
  return status === null || problem.lifecycleStatus === status;
}

export function matchesValidationFilter(problem: CitizenProblem, status: string | null): boolean {
  return status === null || problem.validationStatus === status;
}

export function matchesEvidenceFilter(problem: CitizenProblem, status: string | null): boolean {
  return status === null || problem.evidenceStatus === status;
}

export interface ValueCount {
  value: string;
  count: number;
}

/**
 * Per-value counts of one investigation-state dimension across the given
 * Problems, for the filter rail's inline counts (TARGET's "Aberto 8" /
 * "Corroborada 5" pattern). `null` values (the dimension genuinely absent on
 * that Problem) are never counted toward any option — there is no "sem
 * estado" filter option, matching how the editorial row (CitizenDiscovery.tsx's
 * `ProblemRow`) already omits a null dimension entirely rather than inventing
 * a placeholder value.
 * Options are returned in descending count order, tie-broken by the
 * canonical value itself (ascending, locale-stable) for a deterministic,
 * non-ranking order — this rail never orders options by presumed severity or
 * workflow precedence.
 */
export function countByDimension(problems: CitizenProblem[], field: "lifecycleStatus" | "validationStatus" | "evidenceStatus"): ValueCount[] {
  const counts = new Map<string, number>();
  for (const problem of problems) {
    const value = problem[field];
    if (value === null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * Zero-filled counts across a fixed canonical value set (e.g. the full
 * `evidence_status`/`validation_status` enum from `stateVisuals.ts`), unlike
 * `countByDimension` above, which lists only values actually present among
 * the given Problems. The filter rail needs the complete project filter
 * vocabulary — every canonical value stays a stable, always-rendered option
 * even when its count is 0 — so the rail's option set never changes shape as
 * the visible result subset changes. Order follows `canonicalValues`
 * (schema/enum declaration order), not count, since these are not a
 * count-ranked list the way `countByDimension`'s presence-only counts are.
 */
export function countByCanonicalValues(problems: CitizenProblem[], field: "lifecycleStatus" | "validationStatus" | "evidenceStatus", canonicalValues: string[]): ValueCount[] {
  const counts = new Map<string, number>();
  for (const value of canonicalValues) counts.set(value, 0);
  for (const problem of problems) {
    const value = problem[field];
    if (value === null || !counts.has(value)) continue;
    counts.set(value, counts.get(value)! + 1);
  }
  return canonicalValues.map((value) => ({ value, count: counts.get(value) ?? 0 }));
}

/**
 * The full canonical TEMA vocabulary (every audited `domain` code —
 * `topicMapping.ts`'s `auditedDomainCodes()`), in the same deterministic
 * PT-PT label order `relevantTopicCodes` already uses — unlike
 * `relevantTopicCodes`, which lists only codes present among the currently
 * loaded Problems. The filter rail needs the complete project topic
 * vocabulary, not only values present in the visible result subset.
 */
export function allTopicCodes(): string[] {
  return [...auditedDomainCodes()].sort((a, b) => describeTopic(a).label.localeCompare(describeTopic(b).label, "pt-PT"));
}

/**
 * ESTADO's lifecycle grouping: the canonical `status` enum
 * (`research/schemas/problem.schema.json`) has exactly one value meaning the
 * investigation has not reached a terminal outcome (`OPEN` — see
 * `statusGloss.ts`'s own "ainda não atingiu um dos resultados terminais"
 * explanation for `OPEN`); every other enumerated value (`REJECTED`,
 * `DUPLICATE`, `NON_DIGITAL`, `ALREADY_SOLVED`, `INSUFFICIENT_EVIDENCE`) is
 * one of those terminal outcomes. This groups the six-value canonical enum
 * into the two lifecycle states the rail must expose — never a third bucket,
 * and never a group named after — or containing — an evidence/validation
 * concept such as "Evidência insuficiente" (`INSUFFICIENT_EVIDENCE` groups
 * under "Fechado" here like every other non-`OPEN` value; it is not treated
 * as its own ESTADO option). This is presentation grouping only: the stored
 * `lifecycleStatus` value itself is never rewritten, and `matchesLifecycleFilter`
 * above (exact-value matching) is untouched for any future caller needing
 * the raw six-value filter.
 */
export type LifecycleGroup = "OPEN" | "CLOSED";

export function lifecycleGroupOf(status: string): LifecycleGroup {
  return status === "OPEN" ? "OPEN" : "CLOSED";
}

/** A Problem matches an ESTADO group filter when its own lifecycle status groups into that value (`lifecycleGroupOf`). Parallel to `matchesLifecycleFilter`, but against the grouped dimension. */
export function matchesLifecycleGroupFilter(problem: CitizenProblem, group: LifecycleGroup | null): boolean {
  return group === null || (problem.lifecycleStatus !== null && lifecycleGroupOf(problem.lifecycleStatus) === group);
}

const LIFECYCLE_GROUP_LABELS: Record<LifecycleGroup, string> = { OPEN: "Aberto", CLOSED: "Fechado" };

/**
 * Zero-filled ESTADO rail counts across the fixed two-value lifecycle group
 * vocabulary (`Aberto`/`Fechado`), grouping `countByCanonicalValues`'s
 * six-value canonical counts down to the two groups `lifecycleGroupOf`
 * defines. Order is always Aberto then Fechado, matching
 * `LIFECYCLE_GROUP_LABELS`/the task's required ESTADO option order.
 */
export function countByLifecycleGroup(problems: CitizenProblem[]): ValueCount[] {
  const counts: Record<LifecycleGroup, number> = { OPEN: 0, CLOSED: 0 };
  for (const problem of problems) {
    if (problem.lifecycleStatus === null) continue;
    counts[lifecycleGroupOf(problem.lifecycleStatus)] += 1;
  }
  return (Object.keys(LIFECYCLE_GROUP_LABELS) as LifecycleGroup[]).map((group) => ({ value: group, count: counts[group] }));
}

/** PT-PT label for a lifecycle group value (`Aberto`/`Fechado`) — the ESTADO rail's own two-value vocabulary, not a general enum label (`publicEnumLabel` continues to own the raw six-value `status` labels elsewhere). */
export function lifecycleGroupLabel(group: LifecycleGroup): string {
  return LIFECYCLE_GROUP_LABELS[group];
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
