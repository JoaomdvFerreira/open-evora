#!/usr/bin/env node
/**
 * RE-05 synthetic scale-corpus generator.
 *
 * Produces a deterministic, disposable research-tree fixture (schemas/ +
 * sources/evidence/problems/notes YAML) shaped like the real corpus's
 * structural patterns (SRC/EVD/PRB proportions, shared-source hub nodes,
 * high-degree problems, list/reference fields, one schema-conforming
 * future/unknown type: NOTE-) so the real adapter code path
 * (validate-research-bridge.js + read-model.js) can be exercised at scale
 * without touching canonical research/**.
 *
 * Usage: node generate-corpus.js <scale> <outDir>
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const REAL_SCHEMAS_DIR = path.join(REPO_ROOT, "research", "schemas");

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

/** Emits a value at YAML-subset-compatible 2-space indentation — a subset
 * readable by both the retired tools/validate-research.js#parseYaml and the
 * current tools/research/core/yaml.ts (backed by the full `yaml` package, a
 * strict superset of that subset). */
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
      lines.push(`${p}  - ${typeof item === "string" ? quote(item) : item}`);
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

// --- scale-proportional counts, matching the real corpus's SRC/EVD-heavy,
// PRB-light shape (roughly 42/53/4 in the real 236-record corpus), plus a
// small NOTE (future-type) slice the real corpus doesn't yet exercise.
// ------------------------------------------------------
function computeCounts(scale) {
  const prb = Math.max(5, Math.round(scale * 0.04));
  const note = Math.max(3, Math.round(scale * 0.012));
  const src = Math.max(10, Math.round(scale * 0.34));
  const evd = scale - prb - note - src;
  if (evd <= 0) throw new Error(`Scale ${scale} too small for proportional generation`);
  return { src, evd, prb, note };
}

const DOMAINS = ["MOB", "ACC", "SOC", "HOU", "HEA", "EMP", "ECO", "EDU"];
const GEO_LEVELS = ["city", "parish", "municipality", "intermunicipal", "regional"];
const EVD_TYPES = ["institutional", "statistical", "formal-public", "social", "press", "stakeholder", "observation"];
const EVD_NATURE = ["fact", "reported-experience", "opinion", "claim", "measurement", "recommendation"];
const EVD_STRENGTH = ["primary-authoritative", "primary-non-authoritative", "secondary", "anecdotal"];
const CONTRIBUTION = ["CONFIRMS", "REFINES", "CONTRADICTS", "CURRENT-STATE-UPDATE", "EXISTING-SOLUTION", "PLANNED-SOLUTION", "NEW-CANDIDATE"];
const FRICTION = ["INFORMATION", "COORDINATION", "TRANSACTION", "OPERATIONAL", "PHYSICAL", "REGULATORY", "OTHER"];
const SRC_TYPE = ["api", "dataset", "gis", "web", "document", "database", "feed", "unknown"];
const AUTHORITY = ["authoritative", "verified-third-party", "community", "derived", "estimated", "unknown"];
const LIC_STATUS = ["known", "unknown", "restricted"];
const FRESH_STATUS = ["CURRENT", "STALE", "UNKNOWN", "UNAVAILABLE"];
const PRB_EVIDENCE_STATUS = ["discovered", "corroborated"];
const PRB_VALIDATION_STATUS = ["unvalidated", "partially_validated", "validated"];
const DIGITAL_TRACT = ["not_assessed", "low", "medium", "high"];
const EXIST_SOL = ["not_assessed", "assessed"];
const PRB_STATUS = ["OPEN", "REJECTED", "DUPLICATE", "NON_DIGITAL", "ALREADY_SOLVED", "INSUFFICIENT_EVIDENCE"];

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
  const { src, evd, prb, note } = computeCounts(scale);

  const srcIds = Array.from({ length: src }, (_, i) => `SRC-${pad(i + 1, 4)}`);
  const evdIds = Array.from({ length: evd }, (_, i) => `EVD-${pad(i + 1, 6)}`);
  const prbIds = Array.from({ length: prb }, (_, i) => `PRB-${pad(i + 1, 4)}`);
  const noteIds = Array.from({ length: note }, (_, i) => `NOTE-${pad(i + 1, 4)}`);

  // A small hub of high-degree SRC/PRB nodes, per RE-05's "some higher-degree
  // nodes" and "Evidence sharing Sources" requirements.
  const hubSrc = srcIds.slice(0, Math.max(2, Math.ceil(src * 0.03)));
  const hubPrb = prbIds.slice(0, Math.max(1, Math.ceil(prb * 0.05)));

  for (const dir of ["schemas", "sources", "evidence", "problems", "notes"]) {
    fs.mkdirSync(path.join(outDir, dir), { recursive: true });
  }

  // Reuse the real, canonical schemas verbatim (no UI/adapter behaviour
  // difference should be introduced by the benchmark), plus one new
  // schema-conforming "future/unknown" type the adapter has never seen.
  for (const f of fs.readdirSync(REAL_SCHEMAS_DIR)) {
    if (f.endsWith(".schema.json")) {
      fs.copyFileSync(path.join(REAL_SCHEMAS_DIR, f), path.join(outDir, "schemas", f));
    }
  }
  fs.writeFileSync(
    path.join(outDir, "schemas", "note.schema.json"),
    JSON.stringify(
      {
        prefix: "NOTE-",
        directory: "notes",
        idField: "note_id",
        sourceModel: "docs/datamodel.md",
        notes: "RE-05 synthetic-only future/unknown schema-conforming type: proves generic node/edge discovery needs no adapter change for a type the adapter has never seen.",
        requiredFields: ["note_id", "title"],
        enums: {},
        references: [{ field: "subject", isList: false, targetPrefix: "PRB-", targetDirectory: "problems", required: false }],
      },
      null,
      2
    ) + "\n"
  );

  // --- SRC ------------------------------------------------------------------
  for (const id of srcIds) {
    const rec = {
      source_id: id,
      publisher: `Synthetic Publisher ${pick(rng, ["A", "B", "C", "D"])}`,
      name: `Synthetic dataset ${id}`,
      scope: { geography: pick(rng, GEO_LEVELS), domains: pickN(rng, DOMAINS, 1 + Math.floor(rng() * 3)) },
      source_type: pick(rng, SRC_TYPE),
      access: { public: rng() > 0.2, machine_readable: pick(rng, ["true", "false", "unknown"]) },
      authority: pick(rng, AUTHORITY),
      licensing: { status: pick(rng, LIC_STATUS) },
      freshness: { last_checked: "2026-08-10", status: pick(rng, FRESH_STATUS) },
    };
    fs.writeFileSync(path.join(outDir, "sources", `${id}.yaml`), toYaml(rec));
  }

  // --- EVD --------------------------------------------------------------
  for (const id of evdIds) {
    const useHub = rng() < 0.4;
    const sourceId = useHub ? pick(rng, hubSrc) : pick(rng, srcIds);
    const additional = rng() < 0.3 ? pickN(rng, srcIds, 1 + Math.floor(rng() * 2)) : [];
    const hasAnalysis = rng() < 0.85;
    const relatedProblems = hasAnalysis
      ? rng() < 0.2
        ? []
        : rng() < 0.3
          ? pickN(rng, hubPrb, 1)
          : pickN(rng, prbIds, 1 + Math.floor(rng() * 2))
      : [];

    const rec = {
      evidence_id: id,
      type: pick(rng, EVD_TYPES),
      source: { publisher: "Synthetic Publisher", title: `Synthetic source document for ${id}`, source_id: sourceId, retrieved_at: "2026-08-10" },
      geography: { level: pick(rng, GEO_LEVELS) },
      population: [`synthetic population group ${1 + Math.floor(rng() * 5)}`],
      domain: pickN(rng, DOMAINS, 1 + Math.floor(rng() * 2)),
      observation: { summary: `Synthetic observation summary for ${id}, generated deterministically for RE-05 scale benchmarking.` },
      evidence_nature: pick(rng, EVD_NATURE),
      strength: pick(rng, EVD_STRENGTH),
      personal_data: { present: false, retained: false },
    };
    if (additional.length > 0) rec.additional_sources = additional;
    if (hasAnalysis) {
      rec.analysis = {
        related_problems: relatedProblems,
        contribution: [pick(rng, CONTRIBUTION)],
        friction_types: [pick(rng, FRICTION)],
      };
    }
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
      geography: { level: pick(rng, GEO_LEVELS) },
      affected_populations: [`synthetic affected population ${1 + Math.floor(rng() * 4)}`],
      problem_statement: `Synthetic problem statement body for ${id}, deterministically generated for RE-05 scale benchmarking.`,
      evidence: pickN(rng, evdIds, evCount),
      evidence_status: pick(rng, PRB_EVIDENCE_STATUS),
      validation_status: pick(rng, PRB_VALIDATION_STATUS),
      digital_tractability: pick(rng, DIGITAL_TRACT),
      existing_solutions: pick(rng, EXIST_SOL),
      status: pick(rng, PRB_STATUS),
    };
    fs.writeFileSync(path.join(outDir, "problems", `${id}.yaml`), toYaml(rec));
  }

  // --- NOTE (schema-conforming future/unknown type) ------------------------
  for (let i = 0; i < noteIds.length; i++) {
    const id = noteIds[i];
    const rec = { note_id: id, title: `Synthetic future-type note ${id}` };
    if (rng() < 0.6) rec.subject = pick(rng, prbIds);
    if (rng() < 0.5) rec.tags = pickN(rng, DOMAINS, 1 + Math.floor(rng() * 2));
    fs.writeFileSync(path.join(outDir, "notes", `${id}.yaml`), toYaml(rec));
  }

  return { src, evd, prb, note, total: src + evd + prb + note };
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
