/**
 * Reads an authored top-level or dotted record field without normalizing or
 * interpreting its value. Arrays are leaves rather than traversal targets.
 */
export function getRecordField(fields: Record<string, unknown>, dotted: string): unknown {
  let current: unknown = fields;
  for (const part of dotted.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current) || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
