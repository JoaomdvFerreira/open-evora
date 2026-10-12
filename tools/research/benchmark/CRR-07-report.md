# CRR-07 staged benchmark report

## Decision and scope

The owner-approved amendment replaces the fixed 24-run plan with one REFERENCE and one REDUCED execution per case initially. Repeat only an ambiguous, inconsistent, discrepant, or tooling/reviewer-unstable case, up to three executions per profile for that case. Stage 1 therefore comprised exactly eight reviewer executions. Case #191 was accepted for benchmark use on best available historical evidence: `CASE191_RECONSTRUCTION_ACCEPTED_ON_BEST_AVAILABLE_HISTORICAL_EVIDENCE`. Its reconstructed attempt-1 fingerprint matches all 12 recorded prefix characters (`8e7ebdb9683c`); attempt 2 independently reproduced its full historical fingerprint. No further search for the missing attempt-1 fingerprint was made.

## Stage 1 matrix

| Case | Expected material defects | REFERENCE detection | REDUCED detection | Stage 1 assessment |
| --- | --- | ---: | ---: | --- |
| PR #191, reconstructed pre-correction | D1, D2, D3 | 0/3 | 0/3 | Both missed all expected defects; profile outcomes differed (`DISAGREEMENT_FOUND` / `INSUFFICIENT_EVIDENCE`). |
| PR #211 | D1 | 1/1 | 1/1 | Both detected the expected defect; outcomes differed (`DISAGREEMENT_FOUND` / `INSUFFICIENT_EVIDENCE`). |
| PR #204 control | No expected material defect | N/A | N/A | REFERENCE `CONCUR`, no false blocker; REDUCED `DISAGREEMENT_FOUND` with a false blocker. |
| Synthetic reverse-impact | SYN-D1 | 1/1 | 1/1 | Both detected the expected defect; both returned `DISAGREEMENT_FOUND`. |

Detection counts are expected-defect detection, not raw finding counts. The control has no expected defect to detect.

## Repetitions and reliability

Three cases were repeated: PR #191 because the profile outcomes differed and all expected defects were missed; PR #204 because the control result included a REDUCED false blocker and reviewer variability; and synthetic reverse-impact because structural/tooling failures prevented a stable comparison. Each was repeated to the three-run-per-profile cap. PR #211 was clear on expected-defect detection and was not repeated. Total: 20 benchmark executions (10 per profile). Reviewer-process retries resulted in 33 process calls; five structural failures were recorded.

The synthetic REFERENCE output repeatedly flagged changed-EVD source fidelity. REDUCED's initial output was structurally valid and did not flag that issue, while both REDUCED repeat attempts failed structural validation. These failures leave the cross-profile result unresolved. PR #191's expected defects remained undetected in all valid outputs. PR #204 showed reviewer variability. No repeat changed these cases into a clear equivalent result.

## Conclusion

`BENCHMARK_INCONCLUSIVE`

Decision: `NO CUTOVER`. REDUCED remains non-operational. This benchmark does not authorize operationalization, lifecycle changes, or changes to canonical research records or SVS.

The first sandbox attempt at `npm run research:check` failed with `spawn EPERM`. The authorized rerun outside the sandbox completed successfully: 843 passed, 1 skipped, 0 failed; 279 records validated. `git diff --check` passed. No benchmark reviewer calls were made for this report-only correction.
