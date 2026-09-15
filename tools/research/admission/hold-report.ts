/** Safe, local-only artifact for a WU049 HOLD. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SafetyAdmission } from "./safety-admission.ts";

export function writeSafetyHoldReport(cycleDir: string, baseGitSha: string, admission: SafetyAdmission): string {
  const report = { disposition: admission.disposition, timestamp: admission.evaluatedAt, baseGitSha, humanResolutionCategory: "PRE_GATE_SAFETY_REVIEW", findings: admission.findings.map(({ code, subjectId, severity, summary }) => ({ code, subjectId, severity, summary })) };
  mkdirSync(cycleDir, { recursive: true });
  const file = join(cycleDir, "pre-gate-safety-hold.json");
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return file;
}
