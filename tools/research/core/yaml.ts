import { parse } from "yaml";

import type { RecordFields } from "./types.ts";

/**
 * Parses one canonical research record's YAML text using the mature `yaml`
 * package, replacing the bespoke YAML-subset parser in
 * tools/validate-research.js for this new core (TC-01 scope). Does not
 * change tools/validate-research.js itself, which remains the current
 * behavioural baseline.
 */
export function parseRecordYaml(text: string): RecordFields {
  const parsed = parse(text);
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("expected a YAML mapping at the document root");
  }
  return parsed as RecordFields;
}
