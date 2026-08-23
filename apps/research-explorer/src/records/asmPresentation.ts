/**
 * UX-G2 v1: ASM (Assessment) current-state comprehension for Record Detail.
 * Presentation-layer only — reads already-canonical `detail.record` fields,
 * invents no values, and never surfaces raw schema paths (e.g.
 * "evidence_confidence.coherence") in the public-facing layer. Scope is
 * frozen to docs/design/research-explorer/ux-g2-asm-audit.md §9a: current
 * values only, no per-gate rationale, `notes`/`next_action` stay technical.
 */
import { decisionGateName, publicEnumLabel, publicFieldCaption } from "../presentation";
import { glossFor } from "../problem/statusGloss";

function getObject(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key];
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export interface GlossedField {
  field: string;
  caption: string;
  value: string;
  label: string;
  explanation?: string;
}

/**
 * `enumField` carries the full dotted path (e.g. `evidence_confidence.overall`)
 * so `publicEnumLabel`/`glossFor` can route it to the right label group
 * (confidence/decision_gate/contradiction_status/understanding); `field` is
 * the short caption key used for `publicFieldCaption` and as this item's
 * React key — kept separate because a dotted `civic_importance.reach` path
 * would otherwise leak into the caption lookup, which keys on the terminal
 * field name.
 */
function glossedField(field: string, value: string, enumField: string = field, caption: string = publicFieldCaption(field)): GlossedField {
  const gloss = glossFor(enumField, value);
  return {
    field,
    caption,
    value,
    label: gloss ? gloss.label : publicEnumLabel(enumField, value),
    explanation: gloss?.explanation,
  };
}

/** `assessment_status` + `as_of`, for the ASM meaning-zone orientation sentence — currentness of the assessment itself, distinct from the decision it reaches. */
export interface AsmCurrentness {
  assessmentStatus: GlossedField | null;
  asOf: string | null;
}

export function asmCurrentness(record: Record<string, unknown>): AsmCurrentness {
  const assessmentStatus = getString(record, "assessment_status");
  const asOf = getString(record, "as_of");
  return {
    assessmentStatus: assessmentStatus ? glossedField("assessment_status", assessmentStatus) : null,
    asOf,
  };
}

/** The 8 `decision_gates.*`, in canonical protocol order (§5) — never reordered or filtered by value, so a reader sees the same fixed criteria list regardless of how far the assessment has progressed. */
const DECISION_GATE_ORDER = [
  "problem_real",
  "civic_importance",
  "journey_understood",
  "root_cause_understood",
  "remaining_gap_supported",
  "digital_causality",
  "operability",
  "testability",
] as const;

export function decisionGates(record: Record<string, unknown>): GlossedField[] {
  const gates = getObject(record, "decision_gates");
  if (!gates) return [];
  const items: GlossedField[] = [];
  for (const key of DECISION_GATE_ORDER) {
    const value = getString(gates, key);
    if (value) items.push(glossedField(`decision_gates.${key}`, value, `decision_gates.${key}`, decisionGateName(key)));
  }
  return items;
}

const EVIDENCE_CONFIDENCE_ORDER = ["overall", "independence", "coherence", "adequacy", "relevance", "currentness", "contradiction_status", "stakeholder_validation"] as const;
const CIVIC_IMPORTANCE_ORDER = ["reach", "frequency", "severity", "persistence", "equity"] as const;

/** `evidence_confidence.*` dimensions, grouped — never flattened into the generic civic_importance group (protocol treats them as distinct dimension sets answering different questions). */
export function evidenceConfidenceDimensions(record: Record<string, unknown>): GlossedField[] {
  const group = getObject(record, "evidence_confidence");
  if (!group) return [];
  const items: GlossedField[] = [];
  for (const key of EVIDENCE_CONFIDENCE_ORDER) {
    const value = getString(group, key);
    if (!value) continue;
    items.push(glossedField(key, value, `evidence_confidence.${key}`));
  }
  return items;
}

/**
 * `civic_importance.*` dimensions — deliberately returned as individual
 * labelled values only, never combined into a score/average (protocol §3;
 * ux-g2-asm-audit.md §5 point/§9a: "never aggregate civic_importance
 * dimensions"). Callers must render these five as separate chips/rows, not
 * reduce them.
 */
export function civicImportanceDimensions(record: Record<string, unknown>): GlossedField[] {
  const group = getObject(record, "civic_importance");
  if (!group) return [];
  const items: GlossedField[] = [];
  for (const key of CIVIC_IMPORTANCE_ORDER) {
    const value = getString(group, key);
    if (value) items.push(glossedField(key, value, `civic_importance.${key}`));
  }
  return items;
}

/** journey_understanding/causal_understanding — "how well do we understand the mechanism" companions to critical_unknowns, per ux-g2-asm-audit.md §9 point 3. */
export function understandingDimensions(record: Record<string, unknown>): GlossedField[] {
  const items: GlossedField[] = [];
  for (const key of ["journey_understanding", "causal_understanding"] as const) {
    const value = getString(record, key);
    if (value) items.push(glossedField(key, value, key));
  }
  return items;
}

/**
 * `existing_solution_understanding` + `remaining_gap`, always returned as a
 * pair (one or both may be null if absent) — audit finding §5 point 5: these
 * answer distinct questions the schema was explicitly revised once to keep
 * apart ("do we understand what exists" vs "does it close the gap"), so
 * presenting one without the other risks recreating that exact conflation.
 */
export interface SolutionGapPair {
  existingSolutionUnderstanding: GlossedField | null;
  remainingGap: GlossedField | null;
}

export function solutionGapPair(record: Record<string, unknown>): SolutionGapPair {
  const existing = getString(record, "existing_solution_understanding");
  const gap = getString(record, "remaining_gap");
  return {
    existingSolutionUnderstanding: existing ? glossedField("existing_solution_understanding", existing) : null,
    remainingGap: gap ? glossedField("remaining_gap", gap) : null,
  };
}

/** Summary-level chips only: assessment_status, structure_action, digital_leverage — deliberately excludes triage, which gets its own dedicated presentation with the STOP/WATCH caveat (see triageSummary). */
export function decisionSummaryFields(record: Record<string, unknown>): GlossedField[] {
  const items: GlossedField[] = [];
  for (const key of ["assessment_status", "structure_action", "digital_leverage"] as const) {
    const value = getString(record, key);
    if (value) items.push(glossedField(key, value));
  }
  return items;
}

/**
 * `triage`, paired with its canonically-grounded caveat for STOP/WATCH
 * (protocol §5.2; ux-g2-asm-audit.md §9 point 5) — the caveat is fixed,
 * safe copy, not synthesized per-record. `caveat` is null for
 * DEEPEN/PROCEED, which carry no comparable civic-misreading risk.
 */
export interface TriageSummary {
  field: GlossedField | null;
  caveat: string | null;
}

const TRIAGE_CAVEAT =
  "Esta triagem descreve a postura do projeto Open Évora perante o Problema — não é um juízo sobre a importância cívica do Problema em si. A importância cívica é registada em separado, na secção «O que sabemos», e não é substituída nem invalidada pela triagem.";

export function triageSummary(record: Record<string, unknown>): TriageSummary {
  const value = getString(record, "triage");
  if (!value) return { field: null, caveat: null };
  const field = glossedField("triage", value);
  return { field, caveat: value === "STOP" || value === "WATCH" ? TRIAGE_CAVEAT : null };
}
