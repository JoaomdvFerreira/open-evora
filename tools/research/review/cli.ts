#!/usr/bin/env node
/** Direct, exact-content independent semantic review for canonical research changes. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { LocalCommandAiInvoker, loadLocalCommandAiInvokerConfigFromEnv } from "../ai/invoker.ts";
import { sha256Hex } from "../core/fingerprint.ts";
import { validateIndependentReview } from "./independent-review.ts";
import { invokeIndependentReview } from "./independent-review-invocation.ts";
import { assertResearchPublicationPaths, gitChangedPaths } from "../publication-safety.ts";
import type { IndependentReviewResult } from "./types.ts";
import { CONTEXT_FREE_BLOCK, contextFreeBlockers, describeContextFreeBlockers } from "../language/signals.ts";
import { pullRequestBase, resolveCommit, resolveReviewUnit, type ChangedCanonicalRecord, type CanonicalReviewUnit } from "./review-unit.ts";

export const REVIEW_ATTESTATION_PATH = ".research-review-attestation.json";

export interface ResearchReviewAttestation {
  schemaVersion: "1";
  reviewerProfile: "REFERENCE";
  outcome: "CONCUR";
  baseGitSha: string;
  reviewerInputFingerprint: string;
  changedRecords: ChangedCanonicalRecord[];
  independentReview: IndependentReviewResult;
  integritySha256: string;
}

type AttestationPayload = Omit<ResearchReviewAttestation, "integritySha256">;

function fail(code: string, message: string): never {
  throw new Error(`FAILED [${code}]: ${message}`);
}

function recordIds(unit: Extract<CanonicalReviewUnit, { status: "REVIEW_REQUIRED" }>): string {
  return unit.changedRecords.map((record) => record.id).join(", ");
}

function contextFreeBlock(unit: Extract<CanonicalReviewUnit, { status: "REVIEW_REQUIRED" }>): string | undefined {
  const blockers = contextFreeBlockers(unit.reviewerInput.signals);
  return blockers.length > 0 ? `${CONTEXT_FREE_BLOCK}: ${describeContextFreeBlockers(blockers)}` : undefined;
}

function review(repoRoot: string, baseRef: string | undefined): void {
  if (!baseRef) fail("USAGE", "Usage: npm run research:review -- --base <ref>");
  const baseGitSha = pullRequestBase(repoRoot, resolveCommit(repoRoot, baseRef), resolveCommit(repoRoot, "HEAD"));
  assertResearchPublicationPaths(gitChangedPaths(repoRoot, baseGitSha));
  const unit = resolveReviewUnit({ repoRoot, baseGitSha, head: { kind: "working-tree" } });
  if (unit.status === "NO_CANONICAL_CHANGE") {
    console.log(`NO_CANONICAL_CHANGE: no canonical PRB/EVD/SRC record changed against ${baseGitSha}.`);
    return;
  }
  if (unit.status === "UNSUPPORTED_DELETION") fail("UNSUPPORTED_CANONICAL_DELETION", unit.paths.join(", "));
  if (unit.status === "SOURCE_VERIFICATION_NOT_SEPARATE") fail("SOURCE_VERIFICATION_NOT_SEPARATE", `canonical records and Source Verification Support must be changed separately: ${unit.recordPaths.join(", ")}; ${unit.supportPaths.join(", ")}`);
  const blocked = contextFreeBlock(unit);
  if (blocked) fail("CONTEXT_FREE_BLOCK", blocked);

  const config = loadLocalCommandAiInvokerConfigFromEnv();
  if (!config) fail("AI_RUNTIME_NOT_CONFIGURED", "RESEARCH_AI_COMMAND is not set; independent review requires the configured INDEPENDENT_REVIEWER command.");
  const result = invokeIndependentReview(new LocalCommandAiInvoker(config), unit.reviewerInput);
  if (result.status === "FAILED") fail(result.failedCheck, result.message);
  if (result.review.outcome !== "CONCUR") {
    for (const finding of result.review.findings) {
      console.error(`${finding.findingId} ${finding.severity} ${finding.kind} ${finding.recordId} ${finding.field} [${finding.dimension}]: ${finding.reason}`);
      console.error(`  correction: ${finding.correctionDirection}`);
    }
    fail("INDEPENDENT_REVIEW_NOT_CONCUR", `independent review outcome is ${result.review.outcome}; correct the records and review again.`);
  }
  const payload: AttestationPayload = {
    schemaVersion: "1",
    reviewerProfile: "REFERENCE",
    outcome: "CONCUR",
    baseGitSha: unit.baseGitSha,
    reviewerInputFingerprint: unit.reviewerInputFingerprint,
    changedRecords: structuredClone(unit.changedRecords),
    independentReview: result.review,
  };
  const attestation: ResearchReviewAttestation = { ...payload, integritySha256: sha256Hex(payload) };
  writeFileSync(resolve(repoRoot, REVIEW_ATTESTATION_PATH), `${JSON.stringify(attestation, null, 2)}\n`, "utf8");
  console.log(`CONCUR: base ${unit.baseGitSha}, records ${recordIds(unit)}. Exact-content attestation written to ${REVIEW_ATTESTATION_PATH}.`);
  console.log("Any canonical-content change requires a new review. CONCUR is not owner authorization or approval.");
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function verifyResearchReviewAttestation(unit: CanonicalReviewUnit, raw: unknown): string[] {
  if (unit.status === "NO_CANONICAL_CHANGE") return [];
  if (unit.status === "UNSUPPORTED_DELETION") return [`canonical record deletion or rename is unsupported: ${unit.paths.join(", ")}`];
  if (unit.status === "SOURCE_VERIFICATION_NOT_SEPARATE") return ["canonical records and Source Verification Support must be changed separately"];
  const errors: string[] = [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return ["attestation must be a JSON object"];
  const value = raw as Record<string, unknown>;
  const keys = ["schemaVersion", "reviewerProfile", "outcome", "baseGitSha", "reviewerInputFingerprint", "changedRecords", "independentReview", "integritySha256"];
  for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`attestation has unknown field ${JSON.stringify(key)}`);
  for (const key of keys) if (!(key in value)) errors.push(`attestation is missing field ${JSON.stringify(key)}`);
  if (value.schemaVersion !== "1") errors.push('attestation.schemaVersion must be exactly "1"');
  if (value.reviewerProfile !== "REFERENCE") errors.push('attestation.reviewerProfile must be exactly "REFERENCE"');
  if (value.outcome !== "CONCUR") errors.push('attestation.outcome must be exactly "CONCUR"');
  if (value.baseGitSha !== unit.baseGitSha) errors.push(`attestation base ${String(value.baseGitSha)} does not match reconstructed base ${unit.baseGitSha}`);
  if (value.reviewerInputFingerprint !== unit.reviewerInputFingerprint) errors.push("attestation reviewer-input fingerprint is stale");
  if (!sameJson(value.changedRecords, unit.changedRecords)) errors.push("attestation changed-record set or content is stale");
  if (typeof value.integritySha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.integritySha256)) {
    errors.push("attestation.integritySha256 must be a 64-character sha256 hex digest");
  } else {
    const payload = { ...value };
    delete payload.integritySha256;
    if (sha256Hex(payload) !== value.integritySha256) errors.push("attestation integrity binding does not match its contents");
  }
  const blocked = contextFreeBlock(unit);
  if (blocked) errors.push(blocked);
  const validation = validateIndependentReview(value.independentReview, unit.reviewerInput);
  errors.push(...validation.errors);
  if ((value.independentReview as { outcome?: unknown } | undefined)?.outcome !== "CONCUR") errors.push("only a validated CONCUR review is eligible for human review");
  return errors;
}

function check(repoRoot: string, eventPath: string | undefined): void {
  if (!eventPath) fail("USAGE", "Usage: npm run research:review -- --event-path <github-event.json>");
  const event = JSON.parse(readFileSync(eventPath, "utf8")) as { pull_request?: { base?: { sha?: unknown }; head?: { sha?: unknown } } };
  const pr = event.pull_request;
  if (typeof pr?.base?.sha !== "string" || typeof pr.head?.sha !== "string") fail("NOT_A_PULL_REQUEST_EVENT", "event file has no pull_request base/head SHA");
  const headSha = resolveCommit(repoRoot, pr.head.sha);
  const baseGitSha = pullRequestBase(repoRoot, resolveCommit(repoRoot, pr.base.sha), headSha);
  assertResearchPublicationPaths(gitChangedPaths(repoRoot, baseGitSha, headSha));
  const unit = resolveReviewUnit({ repoRoot, baseGitSha, head: { kind: "commit", sha: headSha } });
  if (unit.status === "NO_CANONICAL_CHANGE") {
    console.log("PASS: no canonical PRB/EVD/SRC records changed; no attestation is required.");
    return;
  }
  if (unit.status === "UNSUPPORTED_DELETION") fail("UNSUPPORTED_CANONICAL_DELETION", unit.paths.join(", "));
  if (unit.status === "SOURCE_VERIFICATION_NOT_SEPARATE") fail("SOURCE_VERIFICATION_NOT_SEPARATE", "canonical records and Source Verification Support must be changed separately");
  const path = resolve(repoRoot, REVIEW_ATTESTATION_PATH);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail("ATTESTATION_MISSING_OR_INVALID", `${REVIEW_ATTESTATION_PATH}: ${(error as Error).message}`);
  }
  const errors = verifyResearchReviewAttestation(unit, raw);
  if (errors.length > 0) fail("ATTESTATION_INVALID", errors.join("\n  "));
  console.log(`PASS: independent review CONCUR bound to base ${baseGitSha} covering ${unit.changedRecords.map((record) => record.id).join(", ")}; eligible for human review.`);
}

function main(): void {
  const args = process.argv.slice(2);
  const value = (flag: string) => {
    const index = args.indexOf(flag);
    return index < 0 ? undefined : args[index + 1];
  };
  try {
    const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    if (args.includes("--event-path")) check(repoRoot, value("--event-path"));
    else review(repoRoot, value("--base"));
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
