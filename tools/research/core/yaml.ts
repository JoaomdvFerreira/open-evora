import { parse, stringify } from "yaml";

import type { RecordFields } from "./types.ts";

/**
 * Parses one canonical research record's YAML text using the mature `yaml`
 * package, replacing the bespoke YAML-subset parser formerly in
 * tools/validate-research.js (retired; see tools/research/validation/validate.ts,
 * which now owns validation on this core).
 */
export function parseRecordYaml(text: string): RecordFields {
  const parsed = parse(text);
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("expected a YAML mapping at the document root");
  }
  return parsed as RecordFields;
}

/**
 * Serializes one canonical research record as a YAML mapping. The mature
 * `yaml` package remains the sole parser/serializer implementation for the
 * research tooling. Its output is normalized to exactly one trailing newline.
 */
export function stringifyRecordYaml(fields: RecordFields): string {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new Error("record fields must be a YAML mapping");
  }

  return `${stringify(fields).replace(/\n+$/, "")}\n`;
}
