import assert from "node:assert/strict";
import test from "node:test";
import { validateResearchRoot } from "./validate.ts";
import { loadCorpusIndex } from "../core/corpus.ts";
import { computeProblemAnalysis } from "../analysis/analyze.ts";

const root = `${process.cwd()}/research`;

test("EVD vNext corpus is structurally valid and has the frozen target counts", () => {
  const result = validateResearchRoot(root);
  assert.deepEqual(result.errors, []);
  const index = loadCorpusIndex(root);
  assert.equal(index.byPrefix.get("EVD-")?.records.length, 126);
  assert.equal(index.byPrefix.get("SRC-")?.records.length, 107);
  assert.ok(index.byPrefix.get("EVD-")?.byId.has("EVD-000139"));
  assert.ok(index.byPrefix.get("EVD-")?.byId.has("EVD-000148"));
  assert.equal(index.byPrefix.get("EVD-")?.byId.has("EVD-000024"), false);
  assert.ok(index.byPrefix.get("SRC-")?.byId.has("SRC-0118"));
  assert.ok(index.byPrefix.get("SRC-")?.byId.has("SRC-0119"));
});

test("split, merge and nested PRB reference migrations leave no legacy EVD references", () => {
  const index = loadCorpusIndex(root);
  const prb3 = index.byPrefix.get("PRB-")!.byId.get("PRB-0003")!.fields;
  const ids = (prb3.evidence as Array<{ evidence_id: string }>).map((e) => e.evidence_id);
  assert.ok(ids.includes("EVD-000148"));
  assert.ok(!ids.includes("EVD-000030"));
  const currentness = ((prb3.decision_basis as Record<string, unknown>).currentness as Record<string, unknown>).evidence as string[];
  assert.ok(currentness.includes("EVD-000148"));
  const prb1 = computeProblemAnalysis(index, "PRB-0001")!;
  assert.equal(prb1.linkedEvdCount, 9);
});

test("authored EVD and SRC prose has no known English migration residue", () => {
  const index = loadCorpusIndex(root);
  const authored: string[] = [];
  for (const { fields } of index.byPrefix.get("EVD-")!.records) {
    const observation = fields.observation as Record<string, unknown>;
    const scope = fields.scope as Record<string, unknown>;
    const geography = scope.geography as Record<string, unknown>;
    authored.push(String(observation.summary ?? ""), String(geography.area ?? ""), ...((scope.populations as string[]) ?? []), ...((fields.inference_limits as string[]) ?? []));
  }
  for (const { fields } of index.byPrefix.get("SRC-")!.records) {
    const scope = fields.scope as Record<string, unknown>;
    const geography = scope.geography as Record<string, unknown>;
    authored.push(String(geography.area ?? ""), ...((fields.caveats as string[]) ?? []));
  }
  const residue = /\b(people|residents|drivers|pedestrians|users|using|seeking|developers|consumers|vulnerable|accommodation|associations|sports|facilities|participants|surrounding|outside|within|parking|collection|council|connections)\b/i;
  assert.deepEqual(authored.filter((value) => residue.test(value.replaceAll("Parking Buddy", ""))), []);
});
