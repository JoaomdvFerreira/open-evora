/**
 * Pure validation logic for the canonical SRC/EVD/PRB research corpus.
 *
 * Built on the shared TC-01 loading/indexing layer (corpus.ts) instead of
 * re-walking research/schemas/* or research/<dir>/*.yaml directly.
 * research/schemas/* remains the executable structural authority
 * (docs/datamodel.md §7) — this module interprets it, it does not restate
 * it.
 *
 * No process/console/exit-code handling here; see validate-cli.ts for the
 * CLI wrapper. This module performs structural validation only: it makes
 * no semantic research judgement (docs/datamodel.md §6, AGENTS.md
 * "Human-owned decisions").
 */
import { loadCorpusIndexTolerant } from "../core/corpus.ts";
import type { CorpusIndex, ParsedRecord, RecordFields, RecordIndex, RecordSchema, SchemaFieldType } from "../core/types.ts";

export interface ValidationResult {
  errors: string[];
  totalRecords: number;
}

function getPath(fields: RecordFields, dotted: string): unknown {
  let cur: unknown = fields;
  for (const part of dotted.split(".")) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur) || !(part in cur)) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function validateIdAndFilename(
  file: string,
  record: RecordFields,
  schema: RecordSchema,
  seenIds: Map<string, string>,
  errors: string[]
): void {
  const id = getPath(record, schema.idField);
  if (typeof id !== "string" || id.trim() === "") {
    errors.push(`[${file}] missing required field: ${schema.idField}`);
    return;
  }
  if (!id.startsWith(schema.prefix)) {
    errors.push(`[${file}] ID "${id}" does not start with expected prefix "${schema.prefix}"`);
  }
  const base = file.split("/").pop()!.replace(/\.ya?ml$/, "");
  if (base !== id) {
    errors.push(`[${file}] filename "${base}" does not match record ID "${id}"`);
  }
  if (seenIds.has(id)) {
    errors.push(`[${file}] duplicate ID "${id}" also used in ${seenIds.get(id)}`);
  } else {
    seenIds.set(id, file);
  }
}

function validateRequiredFields(file: string, record: RecordFields, schema: RecordSchema, errors: string[]): void {
  for (const reqField of schema.requiredFields || []) {
    const val = getPath(record, reqField);
    if (val === undefined || val === null || val === "") {
      errors.push(`[${file}] missing required field: ${reqField}`);
    }
  }
}

function validateEnums(file: string, record: RecordFields, schema: RecordSchema, errors: string[]): void {
  for (const [field, allowed] of Object.entries(schema.enums || {})) {
    const val = getPath(record, field);
    if (val === undefined || val === null) continue;
    const values = Array.isArray(val) ? val : [val];
    for (const v of values) {
      if (!allowed.includes(v as string)) {
        errors.push(
          `[${file}] field "${field}" has invalid value "${v}" (expected one of: ${allowed.join(", ")})`
        );
      }
    }
  }
}

function validateBooleanFields(file: string, record: RecordFields, schema: RecordSchema, errors: string[]): void {
  for (const field of schema.booleanFields || []) {
    const val = getPath(record, field);
    if (val === undefined || val === null) continue;
    if (typeof val !== "boolean") {
      errors.push(`[${file}] field "${field}" must be a boolean (true|false), got "${val}"`);
    }
  }
}

/**
 * Recursively collects every dotted field path present in `value`,
 * including every intermediate object path along the way (e.g. an object
 * present at "scope.geography" contributes both "scope" and
 * "scope.geography" to the set, in addition to each of its own fields).
 * Each collected path is checked individually against `allowedFields` —
 * declaring a parent path authorizes only that object field itself, never
 * its descendants; every permitted nested field must be declared
 * explicitly (exact dotted-path allowlist, no wildcard authorization).
 * Arrays are treated as leaf values at their own path — item shapes are
 * not walked (matches the documented "do not attempt arbitrary array-item
 * schema traversal in this slice").
 */
function collectFieldPaths(value: unknown, prefix: string, out: Set<string>): void {
  if (prefix !== "") out.add(prefix);
  if (value === null || typeof value !== "object" || Array.isArray(value)) return;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    collectFieldPaths(v, prefix === "" ? key : `${prefix}.${key}`, out);
  }
}

/**
 * Rejects any field path present in `record` that is not exactly declared
 * in `schema.allowedFields`. This is an exact allowlist: a declared
 * object path (e.g. "scope.geography") does not implicitly authorize any
 * undeclared descendant (e.g. "scope.geography.foo") — that descendant
 * must be declared on its own.
 */
function validateAllowedFields(file: string, record: RecordFields, schema: RecordSchema, errors: string[]): void {
  if (!schema.allowedFields) return;
  const allowed = new Set(schema.allowedFields);
  const present = new Set<string>();
  collectFieldPaths(record, "", present);
  for (const path of present) {
    if (!allowed.has(path)) {
      errors.push(`[${file}] field "${path}" is not an allowed field for this schema`);
    }
  }
}

const TYPE_NAMES: Record<string, SchemaFieldType> = {
  string: "string",
  boolean: "boolean",
  object: "object",
  array: "array",
};

function actualTypeName(val: unknown): string {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  const t = typeof val;
  if (t === "string" || t === "boolean" || t === "object") return TYPE_NAMES[t];
  return t; // e.g. "number" — not a declarable SchemaFieldType, always a mismatch
}

function validateFieldTypes(file: string, record: RecordFields, schema: RecordSchema, errors: string[]): void {
  for (const [field, allowedTypes] of Object.entries(schema.fieldTypes || {})) {
    const val = getPath(record, field);
    if (val === undefined) continue; // missing optional fields are not type errors
    const actual = actualTypeName(val);
    if (!(allowedTypes as string[]).includes(actual)) {
      errors.push(
        `[${file}] field "${field}" has type "${actual}" (expected one of: ${allowedTypes.join(", ")})`
      );
    }
  }
}

function validatePatterns(file: string, record: RecordFields, schema: RecordSchema, errors: string[]): void {
  for (const [field, patternSource] of Object.entries(schema.patterns || {})) {
    let re: RegExp;
    try {
      re = new RegExp(`^(?:${patternSource})$`);
    } catch (e) {
      errors.push(`[${file}] field "${field}" declares an invalid pattern "${patternSource}": ${(e as Error).message}`);
      continue;
    }
    const val = getPath(record, field);
    if (val === undefined || val === null) continue;
    if (typeof val !== "string") continue; // non-string values are fieldTypes' concern, not coerced here
    if (!re.test(val)) {
      errors.push(`[${file}] field "${field}" value "${val}" does not match required pattern`);
    }
  }
}

function validateConditionalRequired(file: string, record: RecordFields, schema: RecordSchema, errors: string[]): void {
  for (const rule of schema.conditionalRequired || []) {
    const val = getPath(record, rule.field);
    if (val === undefined || val === null) continue;
    const matches =
      (rule.in !== undefined && rule.in.includes(val as string)) ||
      (rule.notIn !== undefined && !rule.notIn.includes(val as string));
    if (!matches) continue;
    for (const req of rule.requires) {
      const reqVal = getPath(record, req);
      if (reqVal === undefined || reqVal === null || reqVal === "") {
        errors.push(`[${file}] field "${req}" is required when "${rule.field}" is "${val}"`);
      }
    }
  }
}

function validateExclusiveFieldSets(file: string, record: RecordFields, schema: RecordSchema, errors: string[]): void {
  for (const rule of schema.exclusiveFieldSets || []) {
    const obj = getPath(record, rule.path);
    if (obj === undefined || obj === null) continue; // do not apply when the parent object is absent
    if (typeof obj !== "object" || Array.isArray(obj)) continue;
    const presentKeys = new Set(Object.keys(obj as Record<string, unknown>));

    const matchingSets = rule.sets.filter((set) => set.every((f) => presentKeys.has(f)));
    // A set only "matches" if every one of its fields is present AND no
    // fields outside that set are present, so a partial authoring of one
    // set (e.g. only "start") is never mistaken for a match.
    const exactMatches = matchingSets.filter((set) => {
      const setFields = new Set(set);
      return [...presentKeys].every((k) => setFields.has(k));
    });

    if (exactMatches.length === 1) continue;
    errors.push(
      `[${file}] field "${rule.path}" must author exactly one of: ${rule.sets
        .map((s) => `[${s.join(", ")}]`)
        .join(" or ")}`
    );
  }
}

const INVESTIGATION_PATH_STAGES = ["initial_signal", "development", "delimitation"] as const;
const PRB_EFFECTS = new Set(["SUPPORTS", "REFINES", "BOUNDS", "CONTRADICTS"]);
const PRB_RESEARCH_ROLES = new Set(["LOCAL_OBSERVATION", "CONTEXTUAL", "COMPARATIVE_MECHANISM", "COMPARATIVE_RESPONSE", "EXISTING_RESPONSE", "PLANNED_RESPONSE"]);

function validatePrbEvidenceRelations(file: string, record: RecordFields, errors: string[]): void {
  const evidence = record.evidence;
  if (!Array.isArray(evidence)) return;
  const seenEvidenceIds = new Set<string>();
  for (const [i, entry] of evidence.entries()) {
    const field = `evidence[${i}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`[${file}] field "${field}" must be an object`); continue;
    }
    const relation = entry as Record<string, unknown>;
    if (typeof relation.evidence_id !== "string" || relation.evidence_id.trim() === "") errors.push(`[${file}] missing required field: ${field}.evidence_id`);
    else if (seenEvidenceIds.has(relation.evidence_id)) errors.push(`[${file}] duplicate PRB evidence relationship: ${relation.evidence_id}`);
    else seenEvidenceIds.add(relation.evidence_id);
    for (const [name, allowed] of [["effects", PRB_EFFECTS], ["research_roles", PRB_RESEARCH_ROLES]] as const) {
      if (!Array.isArray(relation[name]) || relation[name].length === 0) {
        errors.push(`[${file}] missing required non-empty field: ${field}.${name}`); continue;
      }
      const seen = new Set<string>();
      for (const value of relation[name]) {
        if (typeof value !== "string" || !allowed.has(value)) errors.push(`[${file}] field "${field}.${name}" has invalid value "${value}"`);
        else if (seen.has(value)) errors.push(`[${file}] field "${field}.${name}" contains duplicate value "${value}"`);
        else seen.add(value);
      }
    }
  }
}

function validateNestedPrbEvidenceMembership(file: string, record: RecordFields, errors: string[]): void {
  const linked = new Set(
    (Array.isArray(record.evidence) ? record.evidence : []).map((entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Record<string, unknown>).evidence_id : undefined).filter((id): id is string => typeof id === "string")
  );
  const paths = ["decision_basis.manifestation.evidence", "decision_basis.consequence.evidence", "decision_basis.currentness.evidence", "decision_basis.contradiction_search.evidence", "decision_basis.supporting_evidence", "decision_basis.boundary_evidence"];
  for (const path of paths) for (const id of (getPath(record, path) as unknown[] | undefined) || []) if (typeof id === "string" && !linked.has(id)) errors.push(`[${file}] nested EVD reference "${id}" at ${path} is not linked in PRB.evidence`);
  const investigation = record.investigation as Record<string, unknown> | undefined;
  for (const item of Array.isArray(investigation?.open_questions) ? investigation.open_questions : []) for (const id of ((item as Record<string, unknown>)?.evidence as unknown[] || [])) if (typeof id === "string" && !linked.has(id)) errors.push(`[${file}] nested EVD reference "${id}" at investigation.open_questions is not linked in PRB.evidence`);
  const path = investigation?.path as Record<string, unknown> | undefined;
  for (const stage of INVESTIGATION_PATH_STAGES) for (const id of (((path?.[stage] as Record<string, unknown> | undefined)?.evidence as unknown[]) || [])) if (typeof id === "string" && !linked.has(id)) errors.push(`[${file}] nested EVD reference "${id}" at investigation.path.${stage} is not linked in PRB.evidence`);
}

/**
 * Validates PRB.investigation's two optional parts. Not expressible via the
 * generic schema-declared `references` array (which only walks flat dotted
 * paths): open_questions is a list of objects and path is a fixed set of
 * nested stage objects, each carrying its own `evidence` list. This
 * performs the same two checks the generic mechanism performs elsewhere —
 * EVD-* existence and PRB-linkage — plus the one schema-required structural
 * rule (an authored open-question entry must have a non-empty `question`).
 */
function validateInvestigation(
  file: string,
  record: RecordFields,
  evidenceById: ReadonlyMap<string, ParsedRecord>,
  errors: string[]
): void {
  const investigation = getPath(record, "investigation");
  if (investigation === undefined || investigation === null) return;
  if (typeof investigation !== "object" || Array.isArray(investigation)) return;

  const prbEvidence = new Set(
    (Array.isArray((record as Record<string, unknown>).evidence) ? ((record as Record<string, unknown>).evidence as unknown[]) : [])
      .map((v) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>).evidence_id : undefined))
      .filter((v): v is string => typeof v === "string")
  );

  function checkEvidenceList(fieldPath: string, val: unknown): void {
    if (val === undefined || val === null) return;
    const list = Array.isArray(val) ? val : [val];
    for (const t of list) {
      if (typeof t !== "string") continue;
      if (t.trim() === "") {
        errors.push(`[${file}] field "${fieldPath}" contains an empty reference entry (expected an EVD-* ID)`);
        continue;
      }
      if (!evidenceById.has(t)) {
        errors.push(`[${file}] field "${fieldPath}" references non-existent EVD-* record "${t}"`);
        continue;
      }
      if (!prbEvidence.has(t)) {
        errors.push(`[${file}] field "${fieldPath}" references "${t}" which is not linked to this problem (not present in its evidence list)`);
      }
    }
  }

  const openQuestions = (investigation as Record<string, unknown>).open_questions;
  if (Array.isArray(openQuestions)) {
    openQuestions.forEach((entry, i) => {
      const fieldBase = `investigation.open_questions[${i}]`;
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(`[${file}] field "${fieldBase}" must be an object`);
        return;
      }
      const question = (entry as Record<string, unknown>).question;
      if (typeof question !== "string" || question.trim() === "") {
        errors.push(`[${file}] missing required field: ${fieldBase}.question`);
      }
      checkEvidenceList(`${fieldBase}.evidence`, (entry as Record<string, unknown>).evidence);
    });
  }

  const path = (investigation as Record<string, unknown>).path;
  if (path !== undefined && path !== null && typeof path === "object" && !Array.isArray(path)) {
    for (const stage of INVESTIGATION_PATH_STAGES) {
      const stageVal = (path as Record<string, unknown>)[stage];
      if (stageVal === undefined || stageVal === null) continue;
      if (typeof stageVal !== "object" || Array.isArray(stageVal)) continue;
      checkEvidenceList(`investigation.path.${stage}.evidence`, (stageVal as Record<string, unknown>).evidence);
    }
  }
}

function validateReferences(recordIndexes: RecordIndex[], errors: string[]): void {
  const idsByPrefix = new Map<string, ReadonlyMap<string, ParsedRecord>>();
  for (const { schema, byId } of recordIndexes) {
    idsByPrefix.set(schema.prefix, byId);
  }

  for (const { schema, records } of recordIndexes) {
    for (const ref of schema.references || []) {
      const targetIds = idsByPrefix.get(ref.targetPrefix);
      for (const { file, fields } of records) {
        const val = getPath(fields, ref.field);
        if (val === undefined || val === null) {
          if (ref.required) {
            errors.push(`[${file}] missing required reference field: ${ref.field}`);
          }
          continue;
        }
        const targets = ref.isList ? (Array.isArray(val) ? val : [val]) : [val];
        for (const t of targets) {
          const target = ref.itemField && t && typeof t === "object" && !Array.isArray(t)
            ? getPath(t as RecordFields, ref.itemField)
            : t;
          if (typeof target !== "string") continue;
          if (target.trim() === "") {
            if (ref.isList) {
              errors.push(
                `[${file}] field "${ref.field}" contains an empty reference entry (expected a ${ref.targetPrefix}* ID)`
              );
            }
            continue;
          }
          if (!targetIds || !targetIds.has(target)) {
            errors.push(
              `[${file}] field "${ref.field}" references non-existent ${ref.targetPrefix}* record "${target}"`
            );
          }
        }
      }
    }
  }
}

/**
 * Validates an already-loaded CorpusIndex against its declared schemas.
 * Preserves the legacy tools/validate-research.js rule set exactly: ID
 * presence/prefix/filename match, duplicate-ID detection, required
 * fields, enums, boolean fields, and cross-reference integrity.
 *
 * Note: byId dedupes silently on first-seen (see corpus.ts), so duplicate
 * detection here re-derives duplicates from `records` (insertion order),
 * not from byId.
 */
export function validateCorpusIndex(index: CorpusIndex): ValidationResult {
  const errors: string[] = [];
  const seenIds = new Map<string, string>();
  const recordIndexes = [...index.byPrefix.values()];
  const evidenceById = index.byPrefix.get("EVD-")?.byId ?? new Map<string, ParsedRecord>();

  for (const { schema, records } of recordIndexes) {
    for (const { file, fields } of records) {
      validateIdAndFilename(file, fields, schema, seenIds, errors);
      validateRequiredFields(file, fields, schema, errors);
      validateEnums(file, fields, schema, errors);
      validateBooleanFields(file, fields, schema, errors);
      validateAllowedFields(file, fields, schema, errors);
      validateFieldTypes(file, fields, schema, errors);
      validatePatterns(file, fields, schema, errors);
      validateConditionalRequired(file, fields, schema, errors);
      validateExclusiveFieldSets(file, fields, schema, errors);
      if (schema.prefix === "PRB-") {
        validatePrbEvidenceRelations(file, fields, errors);
        validateNestedPrbEvidenceMembership(file, fields, errors);
        validateInvestigation(file, fields, evidenceById, errors);
      }
    }
  }

  validateReferences(recordIndexes, errors);

  return { errors, totalRecords: index.totalRecords };
}

/**
 * Loads the corpus at researchRoot (tolerating malformed YAML files, which
 * are reported as validation errors rather than aborting the load — this
 * matches the legacy validator's per-file try/catch) and validates it.
 */
export function validateResearchRoot(researchRoot: string): ValidationResult {
  const { index, issues } = loadCorpusIndexTolerant(researchRoot);
  const errors = issues.map((failure) => `[${failure.file}] malformed YAML: ${failure.message}`);
  const result = validateCorpusIndex(index);
  return { errors: [...errors, ...result.errors], totalRecords: result.totalRecords };
}
