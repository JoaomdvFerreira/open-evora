#!/usr/bin/env node
/**
 * RE-05 synthetic scale-corpus generator.
 *
 * Produces a deterministic, disposable research-tree fixture (schemas/ +
 * sources/evidence/problems YAML) shaped like the real corpus's structural
 * patterns (SRC/EVD/PRB proportions, shared-source hub nodes, high-degree
 * problems, list/reference fields) so the real adapter code path
 * (validate-research-bridge.js + read-model.js) can be exercised at scale
 * without touching canonical research/**.
 *
 * Usage: node generate-corpus.js <scale> <outDir>
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const REAL_SCHEMAS_DIR = path.join(REPO_ROOT, "research", "schemas");
const CANONICAL_RESEARCH_DIR = path.join(REPO_ROOT, "research");
const { loadCorpusIndex } = require(path.join(REPO_ROOT, "tools", "research", "index.ts"));

// --- deterministic PRNG (mulberry32) -- fixed seed so every run of a given
// scale is byte-for-byte reproducible. -------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n, width) {
  return String(n).padStart(width, "0");
}

function quote(v) {
  return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Emits a value at YAML-compatible 2-space indentation. */
function emitValue(key, value, indent, lines) {
  const p = "  ".repeat(indent);
  if (value === null || value === undefined) {
    lines.push(`${p}${key}: null`);
  } else if (typeof value === "boolean" || typeof value === "number") {
    lines.push(`${p}${key}: ${value}`);
  } else if (typeof value === "string") {
    lines.push(`${p}${key}: ${quote(value)}`);
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${p}${key}: []`);
      return;
    }
    lines.push(`${p}${key}:`);
    for (const item of value) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        lines.push(`${p}  -`);
        for (const [itemKey, itemValue] of Object.entries(item)) {
          emitValue(itemKey, itemValue, indent + 2, lines);
        }
      } else {
        lines.push(`${p}  - ${typeof item === "string" ? quote(item) : item}`);
      }
    }
  } else if (typeof value === "object") {
    lines.push(`${p}${key}:`);
    for (const [k, v] of Object.entries(value)) emitValue(k, v, indent + 1, lines);
  }
}

function toYaml(record) {
  const lines = [];
  for (const [k, v] of Object.entries(record)) emitValue(k, v, 0, lines);
  return lines.join("\n") + "\n";
}

// --- Scale-proportional counts use the current canonical SRC/EVD/PRB corpus
// as their baseline. PRB is floored first (smallest, most degree-sensitive
// category), SRC is a fixed share of the remainder, and EVD absorbs the rest
// so the three counts always sum exactly to `scale`.
// ------------------------------------------------------
function canonicalCounts() {
  const index = loadCorpusIndex(CANONICAL_RESEARCH_DIR);
  const count = (prefix) => index.byPrefix.get(prefix)?.records.length ?? 0;
  const src = count("SRC-");
  const evd = count("EVD-");
  const prb = count("PRB-");
  const total = src + evd + prb;
  if (total === 0) throw new Error("Canonical SRC/EVD/PRB corpus is empty");
  return { src, evd, prb, total };
}

function computeCounts(scale) {
  const baseline = canonicalCounts();
  const prb = Math.max(5, Math.round(scale * (baseline.prb / baseline.total)));
  const src = Math.max(10, Math.round(scale * (baseline.src / baseline.total)));
  const evd = scale - prb - src;
  if (evd <= 0) throw new Error(`Scale ${scale} too small for proportional generation`);
  return { src, evd, prb };
}

const DOMAINS = ["MOB", "ACC", "SOC", "HOU", "HEA", "EMP", "ECO", "EDU"];

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN(rng, arr, n) {
  const out = [];
  const pool = [...arr];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

function generate(scale, outDir) {
  const rng = mulberry32(0xe5f7a5 ^ scale);
  const { src, evd, prb } = computeCounts(scale);

  const srcIds = Array.from({ length: src }, (_, i) => `SRC-${pad(i + 1, 4)}`);
  const evdIds = Array.from({ length: evd }, (_, i) => `EVD-${pad(i + 1, 6)}`);
  const prbIds = Array.from({ length: prb }, (_, i) => `PRB-${pad(i + 1, 4)}`);

  // A small hub of high-degree SRC/PRB nodes, per RE-05's "some higher-degree
  // nodes" and "Evidence sharing Sources" requirements.
  const hubSrc = srcIds.slice(0, Math.max(2, Math.ceil(src * 0.03)));
  const hubPrb = prbIds.slice(0, Math.max(1, Math.ceil(prb * 0.05)));

  for (const dir of ["schemas", "sources", "evidence", "problems"]) {
    fs.mkdirSync(path.join(outDir, dir), { recursive: true });
  }

  // Reuse the real, canonical schemas verbatim (no UI/adapter behaviour
  // difference should be introduced by the benchmark).
  for (const f of fs.readdirSync(REAL_SCHEMAS_DIR)) {
    if (f.endsWith(".schema.json")) {
      fs.copyFileSync(path.join(REAL_SCHEMAS_DIR, f), path.join(outDir, "schemas", f));
    }
  }

  // --- SRC ------------------------------------------------------------------
  for (const id of srcIds) {
    const rec = {
      source_id: id,
      publisher: `Synthetic Publisher ${pick(rng, ["A", "B", "C", "D"])}`,
      name: `Synthetic dataset ${id}`,
      resource_type: "dataset",
      scope: {
        geography: { level: "municipality", area: "Synthetic benchmark area" },
        domains: pickN(rng, DOMAINS, 1 + Math.floor(rng() * 3)),
      },
      access: { level: "public", availability: "available", machine_readable: pick(rng, [true, false, "unknown"]) },
      acquisition: { method: "public_web" },
      licensing: { status: "unknown", reuse: "unknown" },
      temporal: { last_checked_at: "2026-08-10" },
    };
    fs.writeFileSync(path.join(outDir, "sources", `${id}.yaml`), toYaml(rec));
  }

  // --- EVD --------------------------------------------------------------
  for (const id of evdIds) {
    const useHub = rng() < 0.4;
    const sourceId = useHub ? pick(rng, hubSrc) : pick(rng, srcIds);
    const additional = rng() < 0.3 ? pickN(rng, srcIds, 1 + Math.floor(rng() * 2)) : [];
    const sourceIds = [...new Set([sourceId, ...additional])];

    const rec = {
      evidence_id: id,
      provenance: { sources: sourceIds, extracted_at: "2026-08-10" },
      observation: { summary: `Synthetic observation summary for ${id}, generated deterministically for RE-05 scale benchmarking.` },
      scope: {
        geography: { level: "municipality", area: "Synthetic benchmark area" },
        temporal: { as_of: "2026-08-10" },
      },
      domains: pickN(rng, DOMAINS, 1 + Math.floor(rng() * 2)),
      evidence_nature: "claim",
      claim_authority: "unknown",
      inference_limits: ["Synthetic benchmark fixture; not evidence about Évora."],
    };
    fs.writeFileSync(path.join(outDir, "evidence", `${id}.yaml`), toYaml(rec));
  }

  // --- PRB (varying Evidence counts; hub problems get many more) ----------
  for (const id of prbIds) {
    const isHub = hubPrb.includes(id);
    const evCount = isHub ? Math.min(evdIds.length, 15 + Math.floor(rng() * 20)) : Math.min(evdIds.length, 2 + Math.floor(rng() * 8));
    const rec = {
      problem_id: id,
      title: `Synthetic problem statement for ${id}`,
      domain: pickN(rng, DOMAINS, 1 + Math.floor(rng() * 2)),
      geography: { level: "municipality" },
      affected_populations: [`synthetic affected population ${1 + Math.floor(rng() * 4)}`],
      problem_statement: `Synthetic problem statement body for ${id}, deterministically generated for RE-05 scale benchmarking.`,
      evidence: pickN(rng, evdIds, evCount).map((evidence_id) => ({
        evidence_id,
        effects: ["SUPPORTS"],
        research_roles: ["LOCAL_OBSERVATION"],
      })),
      evidence_status: "discovered",
      validation_status: "unvalidated",
      digital_tractability: "not_assessed",
      solution_landscape_status: "not_assessed",
      status: "OPEN",
    };
    fs.writeFileSync(path.join(outDir, "problems", `${id}.yaml`), toYaml(rec));
  }

  return { src, evd, prb, total: src + evd + prb };
}

function main() {
  const [, , scaleArg, outDirArg] = process.argv;
  if (!scaleArg || !outDirArg) {
    console.error("Usage: node generate-corpus.js <scale> <outDir>");
    process.exitCode = 1;
    return;
  }
  const scale = Number(scaleArg);
  const outDir = path.resolve(outDirArg);
  fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  fs.mkdirSync(outDir, { recursive: true });
  const counts = generate(scale, outDir);
  console.log(`Generated synthetic corpus at ${outDir}: ${JSON.stringify(counts)}`);
}

if (require.main === module) {
  main();
}

module.exports = { generate, computeCounts };
