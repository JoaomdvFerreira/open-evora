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
 * visual-completion delta §5). Plain "problema"/"problemas" — the compact
 * inline Hero metric presentation (visual-convergence pass) reads as
 * "6 problemas", not the longer "Problemas acompanhados" phrasing. PT-PT
 * singular only for one, plural for zero or more than one.
 */
export function problemCountLabel(count: number): string {
  return count === 1 ? "problema" : "problemas";
}

/** Metrics label only — PT-PT singular only for one, plural for zero or more than one. */
export function evidenceCountLabel(count: number): string {
  return count === 1 ? "Registo de evidência" : "Registos de evidência";
}

/**
 * Metrics label only, for the canonical `SRC-` record count (docs/datamodel.md
 * §1 — a Source is "an identifiable origin from which information is
 * obtained"). Same counting pattern as `evidenceCount` (a plain `record.type`
 * count over the loaded index), never a separately derived total. The
 * canonical data model does not classify Sources as primary vs
 * secondary/additional, so the label names the record type plainly — "Fonte"
 * / "Fontes", never "primária(s)". PT-PT singular only for one, plural for
 * zero or more than one.
 */
export function sourceCountLabel(count: number): string {
  return count === 1 ? "Fonte" : "Fontes";
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
 * The single newest material-change entry per Problem, regardless of age
 * (Overview final redesign, Phase 2), keyed by canonical `problemId`. Input
 * must already be `projectMaterialChangeEntries`'s output — this does not
 * re-derive material-change meaning, it only picks one entry per Problem out
 * of an already-projected, already-sorted list. Because that list is sorted
 * newest date first (ties broken by Problem ID then authored array position
 * — see `projectMaterialChangeEntries`'s own doc comment), the first entry
 * seen for a given `problemId` while walking it in order is deterministically
 * its newest, with the exact same same-date tie behaviour already
 * established there — this helper adds no ranking/importance judgement of
 * its own.
 *
 * Not the Overview row-level changed-treatment source (weekly-emphasis
 * correction) — that is `latestMaterialChangeInCivilWeekByProblem`, which
 * additionally requires the entry to fall in the current civil week. This
 * helper remains available for other, non-recency-scoped historical uses of
 * "this Problem's most recent authored change".
 */
export function latestMaterialChangeByProblem(entries: MaterialChangeEntry[]): Map<string, MaterialChangeEntry> {
  const latest = new Map<string, MaterialChangeEntry>();
  for (const entry of entries) {
    if (!latest.has(entry.problemId)) latest.set(entry.problemId, entry);
  }
  return latest;
}

const CIVIL_WEEK_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Milliseconds in a day — used only for whole-day (UTC-anchored) civil-week arithmetic below. */
const MS_PER_CIVIL_DAY = 24 * 60 * 60 * 1000;

/** `Europe/Lisbon` — the civil-week timezone anchor (Overview final redesign, Phase 2, §3/§5 correction). Every "esta semana" judgement is relative to the calendar in Évora, never the browser/system/UTC timezone. */
const CIVIL_WEEK_TIMEZONE = "Europe/Lisbon";

// en-CA formats as YYYY-MM-DD, matching the canonical day-precision shape
// used everywhere else in this file — no manual field reassembly needed.
const lisbonCivilDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CIVIL_WEEK_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Parses a `YYYY-MM-DD` string into a UTC-anchored whole-day timestamp, or
 * `null` when it is malformed or does not round-trip to a real calendar day
 * (e.g. `2026-02-30`). The UTC anchor here carries no timezone meaning of its
 * own — it is only a neutral, DST-free axis for whole-day arithmetic between
 * two already-resolved civil dates (both `isDateInCivilWeekOf`'s arguments
 * are civil dates already, one canonical, one already resolved to
 * `Europe/Lisbon` by `getLisbonCivilDate`).
 */
function parseCivilDay(date: string): number | null {
  if (!CIVIL_WEEK_DATE.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  const parsed = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(parsed);
  if (roundTrip.getUTCFullYear() !== year || roundTrip.getUTCMonth() !== month - 1 || roundTrip.getUTCDate() !== day) return null;
  return parsed;
}

/**
 * Resolves `referenceDate` (an absolute instant) to its `Europe/Lisbon`
 * civil calendar date, as `YYYY-MM-DD` (Overview final redesign, Phase 2, §3
 * correction). This is the one place wall-clock/browser/system timezone
 * meets Lisbon civil time — `Intl.DateTimeFormat` with an explicit
 * `timeZone` resolves the correct offset for the given instant regardless of
 * the host's own timezone, and correctly accounts for Portugal's DST
 * transitions without this file needing to encode them itself.
 */
export function getLisbonCivilDate(referenceDate: Date = new Date()): string {
  return lisbonCivilDateFormatter.format(referenceDate);
}

/**
 * True when a canonical, day-precision material-change `date` (`YYYY-MM-DD`)
 * falls within the civil week — Monday through Sunday — containing
 * `referenceCivilDate` (itself a `YYYY-MM-DD` civil date, not an instant).
 * A civil week, not a rolling seven days: the window's boundaries are fixed
 * calendar-day cut-offs, computed from `referenceCivilDate`'s own weekday,
 * not "the 7 days up to and including `referenceCivilDate`".
 *
 * Pure whole-day date arithmetic only — no timezone resolution happens here.
 * Both dates are already civil dates by the time they reach this helper (see
 * `isMaterialChangeInCivilWeek`, which resolves an instant to its Lisbon
 * civil date before delegating here), so this stays trivially deterministic
 * and independently testable against fixed civil-date strings. A
 * malformed/invalid `date` (wrong shape, or a shape that does not round-trip
 * to a real calendar day) is safely excluded — never treated as a match.
 */
export function isDateInCivilWeekOf(date: string, referenceCivilDate: string): boolean {
  const candidateDay = parseCivilDay(date);
  if (candidateDay === null) return false;
  const referenceDay = parseCivilDay(referenceCivilDate);
  if (referenceDay === null) return false;

  // ISO weekday distance back to Monday: Sunday (getUTCDay() === 0) is 6 days
  // after that week's Monday; Monday (1) through Saturday (6) are (weekday - 1)
  // days after it.
  const referenceWeekday = new Date(referenceDay).getUTCDay();
  const daysSinceMonday = referenceWeekday === 0 ? 6 : referenceWeekday - 1;
  const mondayStart = referenceDay - daysSinceMonday * MS_PER_CIVIL_DAY;
  const sundayEnd = mondayStart + 7 * MS_PER_CIVIL_DAY - 1;

  return candidateDay >= mondayStart && candidateDay <= sundayEnd;
}

/**
 * True when a canonical, day-precision material-change `date`
 * (`YYYY-MM-DD`) falls within the `Europe/Lisbon` civil week containing
 * `referenceDate` (Overview final redesign, Phase 2, §5; §3 timezone
 * correction). `referenceDate` is an injectable parameter (defaulting to
 * `new Date()`) precisely so callers — and unit tests — never depend on
 * wall-clock time implicitly; it is resolved to its Lisbon civil date via
 * `getLisbonCivilDate` (correct across Portugal's DST transitions,
 * independent of the browser/system timezone), and the actual week-boundary
 * arithmetic is delegated to the pure `isDateInCivilWeekOf`.
 *
 * A `Date`-instant convenience wrapper only — callers that already hold a
 * resolved Lisbon civil date (e.g. Overview's own shared civil-date state,
 * see §1 hardening) should call `isDateInCivilWeekOf` directly instead of
 * reconstructing an instant merely to re-resolve it here.
 */
export function isMaterialChangeInCivilWeek(date: string, referenceDate: Date = new Date()): boolean {
  return isDateInCivilWeekOf(date, getLisbonCivilDate(referenceDate));
}

/**
 * Distinct Problems (by canonical `problemId`) with at least one
 * material-change entry whose authored `date` falls in the civil week
 * containing `referenceCivilDate` (a `YYYY-MM-DD` Lisbon civil date, not an
 * instant — Overview final redesign, Phase 2, §6; civil-date-input hardening)
 * — the `Alterados esta semana` shortcut's count/filter set. Counts a
 * Problem once regardless of how many qualifying entries it has this week
 * (never a raw entry count). Takes the full projected entry list, not
 * `latestMaterialChangeByProblem`'s output, because a Problem's single
 * newest entry could predate this week even while an older-but-still-this-
 * week entry exists — membership in the shortcut is "has a qualifying entry
 * this week", not "was most recently changed this week". Pure civil-date
 * arithmetic only (via `isDateInCivilWeekOf`) — no timezone resolution
 * happens here.
 */
export function problemIdsAlteredInCivilWeekOf(entries: MaterialChangeEntry[], referenceCivilDate: string): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (isDateInCivilWeekOf(entry.date, referenceCivilDate)) ids.add(entry.problemId);
  }
  return ids;
}

/**
 * `Date`-instant convenience wrapper over `problemIdsAlteredInCivilWeekOf`
 * (resolves `referenceDate` to its Lisbon civil date via `getLisbonCivilDate`
 * first). Callers that already hold a resolved Lisbon civil date should call
 * `problemIdsAlteredInCivilWeekOf` directly instead of reconstructing an
 * instant merely to re-resolve it here.
 */
export function problemIdsAlteredInCivilWeek(entries: MaterialChangeEntry[], referenceDate: Date = new Date()): Set<string> {
  return problemIdsAlteredInCivilWeekOf(entries, getLisbonCivilDate(referenceDate));
}

/**
 * The single newest THIS-CIVIL-WEEK material-change entry per Problem,
 * keyed by canonical `problemId`, for the civil week containing
 * `referenceCivilDate` (a `YYYY-MM-DD` Lisbon civil date, not an instant —
 * Overview final redesign, Phase 2 — weekly-emphasis correction;
 * civil-date-input hardening). This is the row-level changed-treatment
 * projection: unlike `latestMaterialChangeByProblem` (which picks a
 * Problem's newest entry regardless of age, and remains available for
 * historical/other surfaces), a Problem contributes an entry here only when
 * it has at least one qualifying entry in that civil week — the same
 * `isDateInCivilWeekOf` membership `problemIdsAlteredInCivilWeekOf` uses, so
 * the row-level clay treatment/marker and the `Alterados esta semana`
 * shortcut always agree on which Problems qualify whenever both are derived
 * from the same `referenceCivilDate`.
 *
 * Filters to qualifying entries first, then reuses
 * `latestMaterialChangeByProblem`'s existing "first entry seen wins" pick,
 * so a Problem with multiple qualifying entries this week still gets its
 * newest qualifying one (never an older entry, and never a non-qualifying
 * newest entry from outside this week) — the same newest-first,
 * problemId/authored-position tie-break `projectMaterialChangeEntries`
 * already establishes, since filtering preserves that order. Pure civil-date
 * arithmetic only — no timezone resolution happens here.
 */
export function latestMaterialChangeInCivilWeekOfByProblem(
  entries: MaterialChangeEntry[],
  referenceCivilDate: string
): Map<string, MaterialChangeEntry> {
  return latestMaterialChangeByProblem(entries.filter((entry) => isDateInCivilWeekOf(entry.date, referenceCivilDate)));
}

/**
 * `Date`-instant convenience wrapper over
 * `latestMaterialChangeInCivilWeekOfByProblem` (resolves `referenceDate` to
 * its Lisbon civil date via `getLisbonCivilDate` first). Callers that already
 * hold a resolved Lisbon civil date should call
 * `latestMaterialChangeInCivilWeekOfByProblem` directly instead of
 * reconstructing an instant merely to re-resolve it here.
 */
export function latestMaterialChangeInCivilWeekByProblem(
  entries: MaterialChangeEntry[],
  referenceDate: Date = new Date()
): Map<string, MaterialChangeEntry> {
  return latestMaterialChangeInCivilWeekOfByProblem(entries, getLisbonCivilDate(referenceDate));
}

/**
 * Compact PT-PT `DD/MM` presentation for the row-level material-change
 * marker (Overview final redesign, Phase 2, §4) — e.g. `31/08`. Deliberately
 * separate from the shared `formatPublicDate`/`formatPublicDateTime`
 * (presentation.ts): those render the full `dateStyle: "medium"` PT-PT date
 * used across every other surface, and changing their output would ripple
 * into pages this task must not touch. This formatter is Overview's own,
 * scoped to the row marker only; the full canonical date remains available
 * in the marker's own `dateTime` attribute wherever this is used. Falls back
 * to the raw input, like the shared formatters do, when it cannot be parsed
 * as a valid calendar day.
 */
export function formatMaterialChangeMarkerDate(date: string): string {
  if (!CIVIL_WEEK_DATE.test(date)) return date;
  const [year, month, day] = date.split("-").map(Number);
  if (month < 1 || month > 12) return date;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return date;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
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
