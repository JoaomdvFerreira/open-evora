/**
 * Shared synthetic fixtures for tools/research/gate/*.test.ts. Not a test
 * file itself (no `node --test` assertions here) — a fixture-only module,
 * matching the pattern already used by canonical-promoter.test.ts's own
 * local fixture() helpers, just factored out because multiple gate test
 * files need the identical synthetic RCS/package/corpus shape.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCorpusIndex } from "../core/corpus.ts";
import type { CorpusIndex } from "../core/types.ts";
import type { CanonicalIntegrationPlan } from "../integration/canonical-integration-plan.ts";
import type { GenerationManifest, IndependentReviewResult, ResearchChangeSet } from "../orchestrate/types.ts";
import { sha256Hex } from "../orchestrate/fingerprint.ts";
import { buildHumanGatePackage } from "./package-builder.ts";
import type { HumanGatePackage } from "./types.ts";

export const SHA_A = "0123456789abcdef0123456789abcdef01234567";
export const SHA_B = "abcdef0123456789abcdef0123456789abcdef01";

export function sourceYaml(id: string, name = "Synthetic source"): string {
  return `source_id: ${id}\nname: ${name}\nresource_type: document\nscope:\n  geography:\n    level: municipality\n    area: Évora\n  domains:\n    - MOB\naccess:\n  level: public\n  availability: available\n  machine_readable: false\nacquisition:\n  method: public_web\nlicensing:\n  status: unknown\n  reuse: unknown\ntemporal:\n  last_checked_at: 2026-08-27\n`;
}

/** A minimal, git-initialized fixture repository shaped like the real repo's research/ tree. */
export interface GitFixture {
  root: string;
  research: string;
  cleanup(): void;
  head(): string;
  commit(message: string): void;
}

export function gitFixture(): GitFixture {
  const root = mkdtempSync(join(tmpdir(), "open-evora-gate-test-"));
  const research = join(root, "research");
  mkdirSync(join(research, "sources"), { recursive: true });
  mkdirSync(join(research, "evidence"), { recursive: true });
  mkdirSync(join(research, "problems"), { recursive: true });
  const schemas = join(research, "schemas");
  mkdirSync(schemas);
  for (const name of ["source.schema.json", "evidence.schema.json", "problem.schema.json"]) {
    copyFileSync(join(process.cwd(), "research", "schemas", name), join(schemas, name));
  }
  writeFileSync(join(research, "sources", "SRC-BASE.yaml"), sourceYaml("SRC-BASE", "Before"));
  execFileSync("git", ["init", "--quiet", root]);
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "initial"]);
  return {
    root,
    research,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
    head: () => execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    commit: (message) => {
      execFileSync("git", ["-C", root, "add", "."]);
      execFileSync("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", message]);
    },
  };
}

/**
 * A gitFixture() with a local bare "origin" remote wired up, plus a fake
 * `gh` executable on PATH backed by a JSON state file the test controls
 * (test-fake-gh.ts). Used by git-orchestrator.test.ts/promote.test.ts to
 * exercise the real branch/commit/push/PR/CI code path end-to-end without
 * ever touching a real GitHub remote — per the contract's requirement that
 * tests must not require destructive interaction with a real repository or
 * remote.
 */
export interface FakeGhPr {
  number: number;
  url: string;
  headRefName: string;
  baseRefName: string;
}

export interface RemoteGitFixture extends GitFixture {
  remoteDir: string;
  fakeGhStatePath: string;
  /** Environment overrides (PATH + FAKE_GH_STATE) to pass to spawnSync calls under test. */
  env: NodeJS.ProcessEnv;
  setFakeGhCiState(state: "SUCCESS" | "FAILURE" | "PENDING" | "NONE"): void;
  setFakeGhFailPrCreate(fail: boolean): void;
  /** Seeds an existing PR directly into the fake gh state, e.g. to simulate a prior run's PR with a different base branch. */
  seedFakeGhPr(pr: FakeGhPr): void;
  readFakeGhState(): { prs: FakeGhPr[]; ciState: string; nextPrNumber: number; failPrCreate?: boolean };
}

const NODE_EXECUTABLE = process.execPath;
const FAKE_GH_SOURCE = fileURLToPath(new URL("./test-fake-gh.ts", import.meta.url));

export function remoteGitFixture(): RemoteGitFixture {
  const base = gitFixture();
  const remoteDir = mkdtempSync(join(tmpdir(), "open-evora-gate-remote-"));
  execFileSync("git", ["init", "--quiet", "--bare", remoteDir]);
  execFileSync("git", ["-C", base.root, "remote", "add", "origin", remoteDir]);

  const binDir = mkdtempSync(join(tmpdir(), "open-evora-gate-bin-"));
  const fakeGhStatePath = join(binDir, "gh-state.json");
  writeFileSync(fakeGhStatePath, JSON.stringify({ prs: [], ciState: "SUCCESS", nextPrNumber: 1 }), "utf8");

  const isWindows = process.platform === "win32";
  const shimPath = join(binDir, isWindows ? "gh.cmd" : "gh");
  // On Windows, embedding a non-ASCII absolute path (e.g. a username with a
  // diacritic) literally inside the .cmd file text is unreliable: cmd.exe
  // parses batch-file content using the legacy system codepage, not UTF-8,
  // and can corrupt non-ASCII bytes even when the file itself is saved as
  // UTF-8. Passing both paths through environment variables instead avoids
  // ever writing non-ASCII bytes into the batch file at all — the file
  // content is pure ASCII, only the process environment carries the
  // (correctly-encoded, since Node sets it directly rather than parsing it
  // from a file) real paths.
  const shimContents = isWindows
    ? `@echo off\r\n"%FAKE_GH_NODE%" --experimental-strip-types "%FAKE_GH_SCRIPT%" %*\r\n`
    : `#!/bin/sh\nexec "${NODE_EXECUTABLE}" --experimental-strip-types "${FAKE_GH_SOURCE}" "$@"\n`;
  writeFileSync(shimPath, shimContents, "utf8");
  if (!isWindows) execFileSync("chmod", ["+x", shimPath]);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${binDir}${isWindows ? ";" : ":"}${process.env.PATH ?? ""}`,
    FAKE_GH_STATE: fakeGhStatePath,
    ...(isWindows ? { FAKE_GH_NODE: NODE_EXECUTABLE, FAKE_GH_SCRIPT: FAKE_GH_SOURCE } : {}),
  };

  return {
    ...base,
    remoteDir,
    fakeGhStatePath,
    env,
    cleanup: () => {
      base.cleanup();
      rmSync(remoteDir, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    },
    setFakeGhCiState: (state) => {
      const current = JSON.parse(readFileSync(fakeGhStatePath, "utf8"));
      writeFileSync(fakeGhStatePath, JSON.stringify({ ...current, ciState: state }), "utf8");
    },
    setFakeGhFailPrCreate: (fail) => {
      const current = JSON.parse(readFileSync(fakeGhStatePath, "utf8"));
      writeFileSync(fakeGhStatePath, JSON.stringify({ ...current, failPrCreate: fail }), "utf8");
    },
    seedFakeGhPr: (pr) => {
      const current = JSON.parse(readFileSync(fakeGhStatePath, "utf8"));
      writeFileSync(
        fakeGhStatePath,
        JSON.stringify({ ...current, prs: [...current.prs, pr], nextPrNumber: Math.max(current.nextPrNumber, pr.number + 1) }),
        "utf8"
      );
    },
    readFakeGhState: () => JSON.parse(readFileSync(fakeGhStatePath, "utf8")),
  };
}

export function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-gate-cycle-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function manifest(overrides: Partial<GenerationManifest> = {}): GenerationManifest {
  return {
    schemaVersion: "1",
    mode: "daily-discovery",
    investigationQuestion: "What changed for waste collection this week?",
    candidateFiles: ["SRC-NEW.yaml"],
    claimedRecordIds: ["SRC-NEW"],
    rationale: "Synthetic fixture rationale.",
    ...overrides,
  };
}

function independentReview(overrides: Partial<IndependentReviewResult> = {}): IndependentReviewResult {
  return {
    schemaVersion: "1",
    outcome: "CONCUR",
    rationale: "Independent reviewer found no disagreement.",
    ...overrides,
  };
}

/**
 * Builds a complete, internally-consistent synthetic ResearchChangeSet for
 * a single SRC- CREATE, against an already-loaded CorpusIndex, without
 * going through the full orchestrate/ pipeline (these gate/ tests exercise
 * WU046, not WU045's own already-tested assembly path).
 */
export interface SyntheticRcsOverrides {
  manifest?: Partial<GenerationManifest>;
  independentReview?: Partial<IndependentReviewResult>;
  validation?: ResearchChangeSet["validation"];
}

export function syntheticResearchChangeSet(
  index: CorpusIndex,
  baseGitSha: string,
  id = "SRC-NEW",
  overrides: SyntheticRcsOverrides = {}
): ResearchChangeSet {
  const candidate = { recordFamily: "SRC-", fields: { source_id: id, name: "Created", resource_type: "document", scope: { geography: { level: "municipality", area: "Évora" }, domains: ["MOB"] }, access: { level: "public", availability: "available", machine_readable: false }, acquisition: { method: "public_web" }, licensing: { status: "unknown", reuse: "unknown" }, temporal: { last_checked_at: "2026-08-27" } } };
  const delta = { recordFamily: "SRC-", id, action: "CREATE" as const };
  const plan: CanonicalIntegrationPlan = {
    baseGitSha,
    deltas: [delta],
    operations: [{ recordFamily: "SRC-", id, action: "CREATE", targetFile: `sources/${id}.yaml`, yaml: sourceYaml(id, "Created") }],
  };
  const m = manifest({ claimedRecordIds: [id], candidateFiles: [`${id}.yaml`], ...overrides.manifest });
  const ir = independentReview(overrides.independentReview);

  const core = {
    schemaVersion: "1" as const,
    baseGitSha,
    manifest: m,
    candidates: [candidate],
    deltas: [delta],
    validation: overrides.validation ?? { errors: [], totalRecords: index.totalRecords },
    readiness: "READY_FOR_INTEGRATION_GATE" as const,
    independentReview: ir,
    integrationPlan: plan,
    safetyAdmission: { disposition: "ELIGIBLE" as const, findings: [], evaluatedAt: "2026-09-15T12:00:00.000Z" },
  };
  const fingerprint = sha256Hex({
    baseGitSha: core.baseGitSha,
    manifest: core.manifest,
    candidates: core.candidates,
    deltas: core.deltas,
    validation: core.validation,
    readiness: core.readiness,
    independentReview: core.independentReview,
    integrationPlan: core.integrationPlan,
    safetyAdmission: { disposition: core.safetyAdmission.disposition, findings: core.safetyAdmission.findings },
  });
  return { ...core, packageId: `RCS-${fingerprint.slice(0, 16)}`, preparationFingerprint: fingerprint };
}

/** Builds and returns a valid Human Gate package (throws via assert-like behavior if assembly fails — tests should check `errors`). */
export function syntheticHumanGatePackage(index: CorpusIndex, baseGitSha: string, id = "SRC-NEW"): HumanGatePackage {
  const changeSet = syntheticResearchChangeSet(index, baseGitSha, id);
  const built = buildHumanGatePackage(index, changeSet);
  if (built.errors.length > 0 || !built.pkg) {
    throw new Error(`syntheticHumanGatePackage fixture failed to assemble: ${built.errors.join("; ")}`);
  }
  return built.pkg;
}

export function loadIndexFor(researchRoot: string): CorpusIndex {
  return loadCorpusIndex(resolve(researchRoot));
}
