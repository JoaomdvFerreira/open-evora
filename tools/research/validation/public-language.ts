/**
 * Public-language check for citizen-facing PRB text.
 *
 * Scans only the PRB fields the Research Explorer presents as prose and
 * reports any expression listed in public-language-rules.json: record
 * identifiers, internal governance language, structural status values and
 * internal research jargon. Internal metadata, identifier fields, evidence
 * references, decision_basis and enum values are never scanned.
 *
 * This is a deterministic wording-hygiene check. It does not judge whether
 * wording is supported by evidence; that remains human semantic review
 * (docs/investigationstrategy.md §12).
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { CorpusIndex, RecordFields } from "../core/types.ts";

export interface PublicLanguageRule {
  category: string;
  /** The expression reported in diagnostics. */
  expression: string;
  /** Regular-expression source, matched as a whole word. */
  pattern: string;
  /** When true, matching is exact; otherwise case- and accent-insensitive. */
  caseSensitive?: boolean;
}

export interface PublicLanguageFinding {
  /** Record path relative to the research root, e.g. "problems/PRB-0009.yaml". */
  file: string;
  /** Public field path, e.g. "history[0].summary". */
  field: string;
  expression: string;
  category: string;
  /** The text actually matched. */
  matched: string;
  excerpt: string;
}

interface CompiledRule {
  rule: PublicLanguageRule;
  regex: RegExp;
}

const DEFAULT_RULES_PATH = new URL("./public-language-rules.json", import.meta.url);

const OPEN_QUESTION_FIELDS = ["question", "latest_result", "why_open", "current_action", "resolution_condition"] as const;

const EXCERPT_RADIUS = 40;

/** Loads and shape-checks the forbidden-expression configuration. */
export function loadPublicLanguageRules(path: string | URL = DEFAULT_RULES_PATH): PublicLanguageRule[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { rules?: unknown };
  if (!Array.isArray(parsed.rules)) throw new Error("public-language rules: expected a \"rules\" array");
  return parsed.rules.map((value, i) => {
    const rule = value as Partial<PublicLanguageRule>;
    for (const key of ["category", "expression", "pattern"] as const) {
      if (typeof rule[key] !== "string" || rule[key].trim() === "") {
        throw new Error(`public-language rules: rules[${i}].${key} must be a non-empty string`);
      }
    }
    if (rule.caseSensitive !== undefined && typeof rule.caseSensitive !== "boolean") {
      throw new Error(`public-language rules: rules[${i}].caseSensitive must be a boolean`);
    }
    return rule as PublicLanguageRule;
  });
}

/**
 * Removes diacritics one character at a time so that indexes in the folded
 * string still point at the same characters in the original.
 */
function foldAccents(text: string): string {
  let out = "";
  for (const ch of text) {
    const folded = ch.normalize("NFD").replace(/\p{M}/gu, "");
    out += folded.length === ch.length ? folded : ch;
  }
  return out;
}

function compileRule(rule: PublicLanguageRule): CompiledRule {
  const source = rule.pattern.replace(/ /g, "\\s+");
  const body = rule.caseSensitive ? source : foldAccents(source);
  const flags = rule.caseSensitive ? "gu" : "giu";
  return { rule, regex: new RegExp(`(?<![\\p{L}\\p{N}_])(?:${body})(?![\\p{L}\\p{N}_])`, flags) };
}

function excerptAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - EXCERPT_RADIUS);
  const to = Math.min(text.length, end + EXCERPT_RADIUS);
  const body = text.slice(from, to).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${body}${to < text.length ? "…" : ""}`;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** The citizen-facing text fields of one PRB, in deterministic order. */
export function publicPrbTextFields(record: RecordFields): Array<{ field: string; text: string }> {
  const out: Array<{ field: string; text: string }> = [];
  const add = (field: string, value: unknown): void => {
    if (typeof value === "string") out.push({ field, text: value });
  };

  add("title", record.title);
  add("problem_statement", record.problem_statement);

  const investigation = asObject(record.investigation);
  const questions = investigation?.open_questions;
  if (Array.isArray(questions)) {
    questions.forEach((entry, i) => {
      const question = asObject(entry);
      for (const key of OPEN_QUESTION_FIELDS) add(`investigation.open_questions[${i}].${key}`, question?.[key]);
    });
  }
  const path = asObject(investigation?.path);
  for (const [stage, value] of Object.entries(path ?? {})) add(`investigation.path.${stage}.summary`, asObject(value)?.summary);

  if (Array.isArray(record.history)) {
    record.history.forEach((entry, i) => add(`history[${i}].summary`, asObject(entry)?.summary));
  }

  const closure = asObject(record.closure);
  add("closure.explanation", closure?.explanation);
  add("closure.reopen_condition", closure?.reopen_condition);
  return out;
}

/** Scans every PRB in the index against the given rules. Output order is deterministic. */
export function scanPublicLanguage(index: CorpusIndex, rules: PublicLanguageRule[]): PublicLanguageFinding[] {
  const compiled = rules.map(compileRule);
  const findings: PublicLanguageFinding[] = [];
  for (const { file, fields } of index.byPrefix.get("PRB-")?.records ?? []) {
    for (const { field, text } of publicPrbTextFields(fields)) {
      const folded = foldAccents(text);
      const hits: Array<{ start: number; end: number; order: number; rule: PublicLanguageRule }> = [];
      compiled.forEach(({ rule, regex }, order) => {
        const target = rule.caseSensitive ? text : folded;
        for (const match of target.matchAll(regex)) {
          hits.push({ start: match.index, end: match.index + match[0].length, order, rule });
        }
      });
      hits.sort((a, b) => a.start - b.start || a.order - b.order);
      for (const { start, end, rule } of hits) {
        findings.push({
          file,
          field,
          expression: rule.expression,
          category: rule.category,
          matched: text.slice(start, end),
          excerpt: excerptAround(text, start, end),
        });
      }
    }
  }
  return findings;
}

/** One diagnostic line: record path — field path — expression — excerpt. */
export function formatPublicLanguageFinding(finding: PublicLanguageFinding, researchRoot: string): string {
  return `${basename(researchRoot)}/${finding.file} — ${finding.field} — forbidden expression: "${finding.expression}" (${finding.category}) — "${finding.excerpt}"`;
}

/** Validation errors for every forbidden expression in public PRB text. */
export function validatePublicLanguage(index: CorpusIndex, rules: PublicLanguageRule[] = loadPublicLanguageRules()): string[] {
  return scanPublicLanguage(index, rules).map((finding) => formatPublicLanguageFinding(finding, index.researchRoot));
}
