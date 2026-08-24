import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { RecordSchema } from "./types.ts";

/**
 * Loads every research/schemas/*.schema.json file under researchRoot/schemas.
 * research/schemas/* remains the executable authority for record shape
 * (docs/datamodel.md §7) — this loader reads it, it does not restate it.
 */
export function loadSchemas(researchRoot: string): RecordSchema[] {
  const schemasDir = join(researchRoot, "schemas");
  const files = readdirSync(schemasDir).filter((f) => f.endsWith(".schema.json"));
  return files
    .sort()
    .map((f) => JSON.parse(readFileSync(join(schemasDir, f), "utf8")) as RecordSchema);
}
