import { parse } from "yaml";

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
