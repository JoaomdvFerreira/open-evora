#!/usr/bin/env node
/**
 * RE-00 architecture spike — proves the schema-driven node/edge read model
 * against the real canonical corpus. Throwaway validation code: RE-01 will
 * productionize this into apps/research-explorer/scripts/build-data.js with
 * the full manifest/index/edges/record-detail split. This script
 * intentionally stays small and generates a single combined graph.json
 * plus a stats summary, not the full v1 read model.
 *
 * Zero new dependencies: reuses tools/validate-research.js as-is.
 *
 * Usage: node apps/research-explorer/spike/build-graph.js
 */

const fs = require("fs");
const path = require("path");
const { validateResearchTree, getPath } = require("../../../tools/validate-research.js");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const researchRoot = path.join(repoRoot, "research");
const outDir = path.join(__dirname, "generated");

const LABEL_FALLBACKS = [
  "title",
  "name",
  "problem_statement",
  "observation.summary",
];

function labelFor(record, id) {
  for (const field of LABEL_FALLBACKS) {
    const v = getPath(record, field);
    if (typeof v === "string" && v.trim() !== "") {
      return v.length > 80 ? v.slice(0, 77) + "..." : v;
    }
  }
  return id;
}

function resolveReferenceValues(record, field) {
  const v = getPath(record, field);
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [v].filter((x) => typeof x === "string");
}

function main() {
  const { errors, totalRecords, parsedByDir } = validateResearchTree(researchRoot);

  if (errors.length > 0) {
    console.error(`Spike aborted: ${errors.length} validation error(s). Fix canonical data first.`);
    for (const e of errors) console.error("  " + e);
    process.exit(1);
  }

  const nodes = [];
  const edges = [];
  const counts = {};

  for (const [prefix, { schema, parsed }] of parsedByDir.entries()) {
    counts[prefix] = parsed.length;

    for (const { file, record } of parsed) {
      const id = getPath(record, schema.idField);
      nodes.push({
        id,
        type: prefix,
        label: labelFor(record, id),
        file: path.relative(repoRoot, file).replace(/\\/g, "/"),
      });

      for (const ref of schema.references || []) {
        const values = resolveReferenceValues(record, ref.field);
        for (const target of values) {
          edges.push({ from: id, to: target, field: ref.field, required: !!ref.required });
        }
      }
    }
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const danglingEdges = edges.filter((e) => !nodeIds.has(e.to));

  const graph = {
    generated_at: new Date().toISOString(),
    generator: "apps/research-explorer/spike/build-graph.js (RE-00 spike, superseded by RE-01)",
    totalRecords,
    counts,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "graph.json"), JSON.stringify(graph, null, 2) + "\n");

  const stats = {
    generated_at: graph.generated_at,
    totalRecords,
    counts,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    danglingEdgeCount: danglingEdges.length,
    edgesByField: edges.reduce((acc, e) => {
      acc[e.field] = (acc[e.field] || 0) + 1;
      return acc;
    }, {}),
  };
  fs.writeFileSync(path.join(outDir, "stats.json"), JSON.stringify(stats, null, 2) + "\n");

  console.log(`Spike graph generated: ${nodes.length} nodes, ${edges.length} edges, ${danglingEdges.length} dangling (expect 0).`);
  console.log(`  written: ${path.relative(repoRoot, path.join(outDir, "graph.json"))}`);
  console.log(`  written: ${path.relative(repoRoot, path.join(outDir, "stats.json"))}`);
}

main();
