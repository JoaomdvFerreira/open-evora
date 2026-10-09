import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRecordLookup, filterRecords } from "./recordIndex";
import type { RecordSummary } from "../dataProvider/types";

/**
 * Exercises the Records model against the real RE-01 generated index.json —
 * not a fixture — to prove the actual current corpus (not just synthetic
 * data) populates correctly. Package `npm run test` checks generated data
 * is present and fresh first (scripts/check-generated-data.js); this suite
 * never skips, so a missing read model fails rather than passing silently.
 */
const INDEX_PATH = path.resolve(__dirname, "..", "..", "generated", "index.json");

describe("Records model — real generated corpus", () => {
  const records: RecordSummary[] = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));

  it("populates from the real generated index.json with a non-trivial record count", () => {
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => typeof r.id === "string" && r.id.length > 0)).toBe(true);
  });

  it("builds a lookup covering every real record exactly once", () => {
    const lookup = buildRecordLookup(records);
    expect(lookup.size).toBe(records.length);
  });

  it("can search the real corpus for PRB-0005", () => {
    const result = filterRecords(records, { query: "PRB-0005", typeFilter: "all" });
    expect(result.map((r) => r.id)).toContain("PRB-0005");
  });

  it("finds EVD-000001 by a canonical detail phrase beyond its truncated label ('conectividade rural-urbana')", () => {
    const result = filterRecords(records, { query: "conectividade rural-urbana", typeFilter: "all" });
    expect(result.map((r) => r.id)).toContain("EVD-000001");
  });

  it("type filtering still narrows searchText matches", () => {
    const result = filterRecords(records, { query: "conectividade rural-urbana", typeFilter: "PRB-" });
    expect(result.map((r) => r.id)).not.toContain("EVD-000001");
  });

  it("searchText matching remains diacritic/case-insensitive", () => {
    const result = filterRecords(records, { query: "CONECTIVIDADE rural-urbana", typeFilter: "all" });
    expect(result.map((r) => r.id)).toContain("EVD-000001");
  });
});
