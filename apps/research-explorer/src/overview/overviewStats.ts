import type { RecordSummary } from "../dataProvider/types";

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
