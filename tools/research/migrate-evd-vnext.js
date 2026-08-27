#!/usr/bin/env node
/* Deterministic one-shot materializer for the approved frozen EVD vNext manifest. */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import YAML from "yaml";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error("Usage: node tools/research/migrate-evd-vnext.js <frozen-manifest.yaml>");
const manifest = YAML.parse(fs.readFileSync(manifestPath, "utf8"));
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
if (head !== manifest.baseline.ref) throw new Error(`Frozen baseline mismatch: expected ${manifest.baseline.ref}, got ${head}`);

function readYaml(file) { return YAML.parse(fs.readFileSync(file, "utf8")); }
function get(obj, dotted) { return dotted.split(".").reduce((v, k) => v && typeof v === "object" ? v[k] : undefined, obj); }
function set(obj, dotted, value) {
  const parts = dotted.split("."); let cursor = obj;
  for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {};
  cursor[parts.at(-1)] = value;
}
function resolve(spec, baseline) {
  if (Object.hasOwn(spec, "literal")) return spec.literal;
  if (spec.copy_from_baseline) {
    const value = get(baseline, spec.copy_from_baseline);
    if (value === undefined && !spec.optional) throw new Error(`Missing baseline value: ${spec.copy_from_baseline}`);
    return value;
  }
  if (spec.resolver === "legacy_source_ids") {
    const ids = [get(baseline, "source.source_id"), ...(get(baseline, "additional_sources") || [])]
      .filter((id) => typeof id === "string" && id !== "");
    const unique = [...new Set(ids)];
    if (!unique.length) throw new Error(`No legacy source IDs for ${baseline.evidence_id}`);
    return unique;
  }
  throw new Error(`Unsupported field resolver: ${JSON.stringify(spec)}`);
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function replaceEverywhere(value, from, to, remove = false) {
  if (Array.isArray(value)) {
    const next = value.map((v) => replaceEverywhere(v, from, to, remove)).filter((v) => !(remove && v === undefined));
    return [...new Set(next.map((v) => JSON.stringify(v)))].map(JSON.parse);
  }
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceEverywhere(v, from, to, remove)]));
  if (value === from) return remove ? undefined : to;
  return value;
}
function setBracketPath(obj, dotted, value) {
  const parts = dotted.split("."); let cursor = obj;
  for (const part of parts.slice(0, -1)) {
    const match = part.match(/^(.*)\[(\d+)\]$/);
    if (match) cursor = cursor[match[1]][Number(match[2])]; else cursor = cursor[part];
    if (cursor === undefined) throw new Error(`Patch path does not exist: ${dotted}`);
  }
  const final = parts.at(-1); const match = final.match(/^(.*)\[(\d+)\]$/);
  if (match) cursor[match[1]][Number(match[2])] = value; else cursor[final] = value;
}

const evidenceDir = path.join(repo, "research", "evidence");
const sourceDir = path.join(repo, "research", "sources");
const problemDir = path.join(repo, "research", "problems");
const baselineRecords = Object.fromEntries(fs.readdirSync(evidenceDir).filter((f) => f.endsWith(".yaml")).map((f) => {
  const record = readYaml(path.join(evidenceDir, f)); return [record.evidence_id, record];
}));
if (Object.keys(baselineRecords).length !== manifest.baseline.input_evd_count) throw new Error("Frozen baseline EVD count mismatch");

for (const [id, target] of Object.entries(manifest.target_records)) {
  const baseline = baselineRecords[target.baseline_record || target.derived_from?.[0]];
  if (!baseline) throw new Error(`Missing frozen baseline source for ${id}`);
  const record = {};
  for (const [field, spec] of Object.entries(target.fields)) {
    const value = resolve(spec, baseline);
    if (value !== undefined) set(record, field, clone(value));
  }
  fs.writeFileSync(path.join(evidenceDir, `${id}.yaml`), YAML.stringify(record));
}
for (const id of Object.keys(baselineRecords)) if (!Object.hasOwn(manifest.target_records, id)) fs.unlinkSync(path.join(evidenceDir, `${id}.yaml`));

for (const [id, record] of Object.entries(manifest.target_sources)) fs.writeFileSync(path.join(sourceDir, `${id}.yaml`), YAML.stringify(record));
const src069 = readYaml(path.join(sourceDir, "SRC-0069.yaml"));
set(src069, "temporal.published_at", manifest.source_corrections["SRC-0069"]["temporal.published_at"]);
fs.writeFileSync(path.join(sourceDir, "SRC-0069.yaml"), YAML.stringify(src069));

for (const [id, target] of Object.entries(manifest.target_prbs)) {
  const file = path.join(problemDir, `${id}.yaml`); let prb = readYaml(file);
  prb.evidence = clone(target.evidence);
  for (const patch of target.patches || []) {
    if (patch.op === "replace_id_everywhere") prb = replaceEverywhere(prb, patch.from, patch.to);
    else if (patch.op === "remove_id_everywhere") prb = replaceEverywhere(prb, patch.evidence_id, undefined, true);
    else if (patch.op === "assert_absent_everywhere") {
      if (JSON.stringify(prb).includes(patch.evidence_id)) throw new Error(`${id}: expected ${patch.evidence_id} to be absent`);
    } else if (patch.op === "set") setBracketPath(prb, patch.path, clone(patch.value));
    else if (patch.op === "append_unique") {
      const existing = get(prb, patch.path); if (!Array.isArray(existing)) throw new Error(`Patch path is not an array: ${patch.path}`);
      setBracketPath(prb, patch.path, [...new Set([...existing, ...patch.values])]);
    } else if (patch.op === "replace_text") {
      const current = get(prb, patch.path); const count = typeof current === "string" ? current.split(patch.match).length - 1 : 0;
      if (count !== patch.require_exactly) throw new Error(`${id}: replacement mismatch at ${patch.path}`);
      setBracketPath(prb, patch.path, current.replace(patch.match, patch.replacement));
    } else throw new Error(`Unsupported PRB patch: ${patch.op}`);
  }
  fs.writeFileSync(file, YAML.stringify(prb));
}
