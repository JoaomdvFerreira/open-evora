/**
 * SUI-03A1: pure extraction/presence selectors for the SRC v2 canonical
 * record, scoped to the fields `docs/datamodel.md` §1.1 assigns directly to
 * the Source record (`AGENTS.md` — no competing semantic definition of
 * canonical state). This is a data helper, not a component: it returns
 * extracted values and presence booleans only, never labels, formatted
 * dates, or derived judgements (quality/authority/freshness/confidence are
 * out of scope per the data model's boundary section).
 *
 * EVD backlinks, PRB corpus relations, "O que encontrámos", and "Na
 * investigação" are explicitly deferred to SUI-03A2 — see `SourceSections`
 * below for how that later slice plugs in without touching this one.
 */

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * SUI-03K3: pure HTTP(S)-URL-validity check, extracted so both the header
 * "Abrir fonte original" CTA eligibility (`publicSourceReferenceUrl` in
 * `RecordDetailPanel.tsx`, which additionally requires `access.level` ===
 * "public" and `access.availability` === "available") and the factual
 * "Referência original" link rendering (`SourceDatesAccessSection`, which
 * must NOT depend on access/publication eligibility) share one definition of
 * "is this string a valid HTTP(S) URL" instead of two independent parsers.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getStringArray(record: Record<string, unknown>, key: string): string[] | null {
  const value = record[key];
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return items.length > 0 ? items : null;
}

function getObject(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key];
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** `access.machine_readable` may canonically be the literal string `"unknown"` (research/schemas/source.schema.json pattern) as well as boolean — both are extracted verbatim, never collapsed into one type. */
function getMachineReadable(access: Record<string, unknown>): boolean | "unknown" | null {
  const value = access.machine_readable;
  if (typeof value === "boolean") return value;
  if (value === "unknown") return "unknown";
  return null;
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

export interface SourceOverview {
  name: string | null;
  publisher: string | null;
  creators: string[] | null;
  resourceType: string | null;
  canonicalReference: string | null;
  lastCheckedAt: string | null;
}

export function extractSourceOverview(record: Record<string, unknown>): SourceOverview {
  const temporal = getObject(record, "temporal");
  return {
    name: getString(record, "name"),
    publisher: getString(record, "publisher"),
    creators: getStringArray(record, "creators"),
    resourceType: getString(record, "resource_type"),
    canonicalReference: getString(record, "canonical_reference"),
    lastCheckedAt: temporal ? getString(temporal, "last_checked_at") : null,
  };
}

// ---------------------------------------------------------------------------
// Cobertura
// ---------------------------------------------------------------------------

/** `scope.temporal` is exclusively `as_of` OR `start`+`end` (docs/datamodel.md §1.1) — extracted as a tagged union so a consumer never has to re-derive which form applies. */
export type SourceCoverageTemporal = { kind: "as_of"; asOf: string } | { kind: "interval"; start: string; end: string } | null;

export interface SourceCoverage {
  geographyLevel: string | null;
  geographyArea: string | null;
  temporal: SourceCoverageTemporal;
  domains: string[] | null;
}

function extractCoverageTemporal(scope: Record<string, unknown>): SourceCoverageTemporal {
  const temporal = getObject(scope, "temporal");
  if (!temporal) return null;
  const asOf = getString(temporal, "as_of");
  if (asOf) return { kind: "as_of", asOf };
  const start = getString(temporal, "start");
  const end = getString(temporal, "end");
  if (start && end) return { kind: "interval", start, end };
  return null;
}

export function extractSourceCoverage(record: Record<string, unknown>): SourceCoverage {
  const scope = getObject(record, "scope");
  const geography = scope ? getObject(scope, "geography") : null;
  return {
    geographyLevel: geography ? getString(geography, "level") : null,
    geographyArea: geography ? getString(geography, "area") : null,
    temporal: scope ? extractCoverageTemporal(scope) : null,
    domains: scope ? getStringArray(scope, "domains") : null,
  };
}

// ---------------------------------------------------------------------------
// Datas e acesso
// ---------------------------------------------------------------------------

export interface SourceDatesAccess {
  publishedAt: string | null;
  updatedAt: string | null;
  lastCheckedAt: string | null;
  updateFrequency: string | null;
  accessLevel: string | null;
  accessAvailability: string | null;
  accessMachineReadable: boolean | "unknown" | null;
  accessMethod: string | null;
  accessFormat: string | null;
  canonicalReference: string | null;
}

export function extractSourceDatesAccess(record: Record<string, unknown>): SourceDatesAccess {
  const temporal = getObject(record, "temporal");
  const access = getObject(record, "access");
  return {
    publishedAt: temporal ? getString(temporal, "published_at") : null,
    updatedAt: temporal ? getString(temporal, "updated_at") : null,
    lastCheckedAt: temporal ? getString(temporal, "last_checked_at") : null,
    updateFrequency: temporal ? getString(temporal, "update_frequency") : null,
    accessLevel: access ? getString(access, "level") : null,
    accessAvailability: access ? getString(access, "availability") : null,
    accessMachineReadable: access ? getMachineReadable(access) : null,
    accessMethod: access ? getString(access, "method") : null,
    accessFormat: access ? getString(access, "format") : null,
    canonicalReference: getString(record, "canonical_reference"),
  };
}

// ---------------------------------------------------------------------------
// Licenciamento
// ---------------------------------------------------------------------------

export interface SourceLicensing {
  status: string | null;
  licence: string | null;
  reuse: string | null;
  attribution: string | null;
}

export function extractSourceLicensing(record: Record<string, unknown>): SourceLicensing {
  const licensing = getObject(record, "licensing");
  return {
    status: licensing ? getString(licensing, "status") : null,
    licence: licensing ? getString(licensing, "licence") : null,
    reuse: licensing ? getString(licensing, "reuse") : null,
    attribution: licensing ? getString(licensing, "attribution") : null,
  };
}

// ---------------------------------------------------------------------------
// Limitações
// ---------------------------------------------------------------------------

export function extractSourceCaveats(record: Record<string, unknown>): string[] | null {
  return getStringArray(record, "caveats");
}

// ---------------------------------------------------------------------------
// Section presence
// ---------------------------------------------------------------------------

/**
 * Candidate Source View section IDs. `findings` is always `"present"`
 * (SUI-03J0 — the Source View's "O que encontrámos" area always renders
 * something, so it is never deferred or absent). `investigation` is
 * relation-owned: `"deferred"` without `relationContext`, else `"present"`
 * or `"absent"` depending on `hasRelatedProblem` (SUI-03A2).
 */
export type SourceSectionId = "overview" | "findings" | "coverage" | "dates-access" | "licensing" | "caveats" | "investigation" | "technical";

export type SourceSectionPresence = "present" | "absent" | "deferred";

export type SourceSectionPresenceMap = Record<SourceSectionId, SourceSectionPresence>;

/**
 * Relation context needed to resolve `investigation` presence (SUI-03A2) —
 * deliberately just the one boolean it needs, not the full
 * `SourceEvidenceRelations` shape, so this module stays free of any
 * dependency on the relation-loading module or DataProvider. Passing this
 * is optional so this function keeps working standalone (SRC-owned presence
 * only) for any caller that hasn't loaded relation context yet.
 */
export interface SourceSectionRelationContext {
  /** Whether the Source Section presence model should treat `investigation` as present — true iff at least one PRB explicitly uses a related EVD in `evidence[]`. */
  hasRelatedProblem: boolean;
}

/**
 * `overview` and `technical` are unconditional for any valid SRC record —
 * `technical` in particular per the task's own rule ("always available…
 * because the raw canonical record already exists"), not because any
 * specific field is present. The other owned sections are present only when
 * their extracted content is non-empty, so a later rail/index can skip
 * rendering an empty section without re-deriving this logic itself.
 *
 * `investigation` is relation-owned (SUI-03A2): without `relationContext` it
 * stays "deferred" (SUI-03A1 behaviour, unchanged for any caller that hasn't
 * loaded relations yet); with `relationContext` supplied, it is "present"
 * only when `hasRelatedProblem` is true, else "absent".
 *
 * `findings` (SUI-03J0) is always "present", regardless of `relationContext`
 * — the actual Source View's "O que encontrámos" area always renders
 * something (loading, error/retry, evidence, or an explicit empty state), so
 * it never makes sense to defer or hide it from the section index. This is
 * the one shared section-index source for both desktop and mobile; do not
 * add a second section-presence helper elsewhere.
 */
export function computeSourceSectionPresence(
  record: Record<string, unknown>,
  relationContext?: SourceSectionRelationContext
): SourceSectionPresenceMap {
  const coverage = extractSourceCoverage(record);
  const datesAccess = extractSourceDatesAccess(record);
  const licensing = extractSourceLicensing(record);
  const caveats = extractSourceCaveats(record);

  const hasCoverage = coverage.geographyLevel !== null || coverage.geographyArea !== null || coverage.temporal !== null || coverage.domains !== null;

  const hasDatesAccess =
    datesAccess.publishedAt !== null ||
    datesAccess.updatedAt !== null ||
    datesAccess.lastCheckedAt !== null ||
    datesAccess.updateFrequency !== null ||
    datesAccess.accessLevel !== null ||
    datesAccess.accessAvailability !== null ||
    datesAccess.accessMachineReadable !== null ||
    datesAccess.accessMethod !== null ||
    datesAccess.accessFormat !== null ||
    datesAccess.canonicalReference !== null;

  const hasLicensing = licensing.status !== null || licensing.licence !== null || licensing.reuse !== null || licensing.attribution !== null;

  const hasCaveats = caveats !== null;

  return {
    overview: "present",
    coverage: hasCoverage ? "present" : "absent",
    "dates-access": hasDatesAccess ? "present" : "absent",
    licensing: hasLicensing ? "present" : "absent",
    caveats: hasCaveats ? "present" : "absent",
    technical: "present",
    findings: "present",
    investigation: relationContext ? (relationContext.hasRelatedProblem ? "present" : "absent") : "deferred",
  };
}
