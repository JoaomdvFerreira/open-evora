/**
 * Reads already-authored candidate YAML files from a local, gitignored
 * cycle directory into the CandidateRecord shape candidate-delta.ts and
 * prospective-validation.ts already consume. This module performs no
 * classification, validation, or canonical-write decision of its own — it
 * only reads files and infers each candidate's schema-declared record
 * family from its own canonical ID field, using the already-loaded
 * CorpusIndex as the sole source of known record families (never a second,
 * parallel prefix table).
 */
import { readFileSync } from "node:fs";

import type { CandidateRecord } from "../integration/candidate-delta.ts";
import { getRecordField } from "../core/record-fields.ts";
import type { CorpusIndex } from "../core/types.ts";
import { parseRecordYaml } from "../core/yaml.ts";
import { resolveContainedPath } from "./path-containment.ts";

export interface CandidateLoadFailure {
  file: string;
  message: string;
}

export interface CandidateLoadResult {
  candidates: CandidateRecord[];
  failures: CandidateLoadFailure[];
}

function inferRecordFamily(index: CorpusIndex, fields: Record<string, unknown>): string | undefined {
  for (const [prefix, recordIndex] of index.byPrefix) {
    const id = getRecordField(fields, recordIndex.schema.idField);
    if (typeof id === "string" && id.startsWith(prefix)) return prefix;
  }
  return undefined;
}

/**
 * Loads exactly the candidate files listed by the manifest (never an entire
 * directory scan) so an orchestration run only ever considers candidates
 * the AI-assisted authoring pass explicitly declared. Every failure
 * (missing file, malformed YAML, unrecognized record family) is collected
 * rather than thrown, so the caller can report every problem and fail
 * closed in one pass (§11 fail-closed requirement).
 *
 * `candidateFiles` entries are untrusted AI-authored input (WU045-B01
 * independent-review remediation, finding 2): each is resolved through
 * resolveContainedPath() before being read, so a traversal/absolute/rooted
 * path — or a path that resolves outside `candidatesDir` via a symlink —
 * fails closed as a load failure rather than reading arbitrary filesystem
 * content. This is the same containment helper materializeAuthoringEnvelope()
 * (run-cycle.ts) uses on the write side, so read/write containment can never
 * diverge.
 */
export function loadCandidates(index: CorpusIndex, candidatesDir: string, candidateFiles: readonly string[]): CandidateLoadResult {
  const candidates: CandidateRecord[] = [];
  const failures: CandidateLoadFailure[] = [];

  for (const relativeFile of candidateFiles) {
    const containment = resolveContainedPath(candidatesDir, relativeFile);
    if (!containment.ok) {
      failures.push({ file: relativeFile, message: `refusing to read candidate file: ${containment.reason}` });
      continue;
    }
    const absolutePath = containment.absolutePath;
    let text: string;
    try {
      text = readFileSync(absolutePath, "utf8");
    } catch (error) {
      failures.push({ file: relativeFile, message: `could not read candidate file: ${(error as Error).message}` });
      continue;
    }

    let fields: Record<string, unknown>;
    try {
      fields = parseRecordYaml(text);
    } catch (error) {
      failures.push({ file: relativeFile, message: `could not parse candidate YAML: ${(error as Error).message}` });
      continue;
    }

    const recordFamily = inferRecordFamily(index, fields);
    if (!recordFamily) {
      failures.push({ file: relativeFile, message: "candidate record does not resolve to a known canonical record family" });
      continue;
    }

    candidates.push({ recordFamily, fields });
  }

  return { candidates, failures };
}
