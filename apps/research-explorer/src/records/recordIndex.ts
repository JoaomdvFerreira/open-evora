import type { RecordSummary } from "../dataProvider/types";
import { normalizeForSearch } from "./normalize";

/**
 * One stable derived lookup (record ID -> summary), built once per loaded
 * index and reused everywhere a related-record label/type is needed
 * (relationship rendering, navigation, existence checks) — never recomputed
 * per component or per render.
 */
export function buildRecordLookup(records: RecordSummary[]): Map<string, RecordSummary> {
  const lookup = new Map<string, RecordSummary>();
  for (const record of records) {
    lookup.set(record.id, record);
  }
  return lookup;
}

function flattenSearchableValues(value: unknown): (string | number | boolean)[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenSearchableValues);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(flattenSearchableValues);
  return [];
}

/**
 * Precomputed, normalised search text for one record: ID, type, label,
 * every serialisable summaryFields value, and the bounded additional
 * canonical/detail text already present on the record (ODM-014,
 * `searchText` — see read-model.js's SEARCH_FIELD_CANDIDATES). Nothing else:
 * search never triggers a per-query detail load, it only reads what is
 * already in the loaded index.
 */
export function recordSearchText(record: RecordSummary): string {
  const parts = [
    record.id,
    record.type,
    record.label,
    ...flattenSearchableValues(record.summaryFields).map(String),
    record.searchText ?? "",
  ];
  return normalizeForSearch(parts.join(" "));
}

export function recordMatchesQuery(searchText: string, normalizedQuery: string): boolean {
  return normalizedQuery === "" || searchText.includes(normalizedQuery);
}

export const ALL_TYPES = "all";

export interface RecordsFilterState {
  query: string;
  typeFilter: string;
}

/**
 * Pure filter: type + normalised text search. The only two RE-02B filter
 * dimensions (record type, text search) — no domain-specific filters, no
 * query builder.
 */
export function filterRecords(records: RecordSummary[], { query, typeFilter }: RecordsFilterState): RecordSummary[] {
  const normalizedQuery = normalizeForSearch(query.trim());
  return records.filter((record) => {
    if (typeFilter !== ALL_TYPES && record.type !== typeFilter) return false;
    return recordMatchesQuery(recordSearchText(record), normalizedQuery);
  });
}

/**
 * Derived, not hardcoded: the type-filter dropdown's options come from
 * whatever types are actually present in the loaded index, so a future
 * schema-conforming record type appears automatically.
 */
export function availableRecordTypes(records: RecordSummary[]): string[] {
  return Array.from(new Set(records.map((r) => r.type))).sort();
}
