# M013 / WU048 — End-to-End Dry Run & Independent Go-Live Verification

**Original execution window:** 2026-09-15 13:03–13:16 WEST
**Evidence-correction window:** 2026-09-15 13:39–13:53 WEST
**Bound SHA:** `add597da2510056d0f05d7b090d9a75828686f79`
**Terminal verification verdict:** `NOT_READY`

This is a verification-only record. No runtime or research data was changed,
no Production alias was assigned, and a READY verdict is not asserted.

## Historical correction

The original execution reported 19/22 PASS. Independent review found that only
16 matrix PASS claims were supportable: cases 5 and 7 were overstated, cases
9, 17, and 22 were unsupported, and local `explorer:build` was inconclusive.
This correction cycle adds explicit synthetic scenarios and sanitized command
evidence. It does not rewrite that history.

## Provenance, fixture, and freshness

The disposable, non-public fixture was a detached worktree at the bound SHA.
It used safe synthetic inputs, temporary Git repositories, and the existing
fake GitHub boundary. See [execution baseline](evidence/execution-baseline.md).
It was created after EVT-316 and did not write canonical data or external
research state.

The candidate was created after EVT-316 and inspected in this execution cycle,
so its status/protection observations are fresh. However, the remote build
reported `sourceCommit: (unavailable)`; the service therefore does not provide
independent immutable SHA attestation. Local upload provenance alone cannot
satisfy the required independent candidate-SHA verification. The replacement
candidate and its provenance assessment are in
[correction-cycle evidence](evidence/correction-cycle.md); it also fails the
exact immutable input-to-deployment proof requirement.

## Case matrix

`PASS` means the named synthetic test path completed in `research:check`.
`FAIL` is an observed verification gap; it was not remediated.

| # | Expected outcome | Actual outcome | Result | Evidence / freshness | Finding |
| --- | --- | --- | --- | --- | --- |
| 1 | Trigger reaches `READY_FOR_HUMAN_REVIEW` without pre-Gate handoff. | Normal-path orchestration test passed. | PASS | `research-change-set.test.ts`; fresh synthetic fixture | — |
| 2 | Approved dry run reaches exactly `READY_FOR_OWNER_MERGE`; no merge. | Human Gate/promotion and Git-orchestrator tests passed. | PASS | `promote.test.ts`, `git-orchestrator.test.ts`; fresh | — |
| 3 | Duplicate source is `NO_CHANGE`. | Deterministic candidate-delta no-change test passed. | PASS | `candidate-delta.test.ts`; fresh | — |
| 4 | Thin source is held/reviewed, never silently promoted. | Eligibility/corroboration tests reported missing decision-basis checks and Gate tests prevented unapproved promotion. | PASS | `readiness.test.ts`, `promote.test.ts`; fresh | — |
| 5 | Contradiction is surfaced in review package. | Fresh contradictory PRB candidate reached a package, but its summary was absent from rendered Human Gate Markdown and risks. | FAIL | `evidence/correction-cycle.md`; fresh | P1: required human-review surfacing absent. |
| 6 | Structurally invalid candidate stops before Gate 1. | Invalid-candidate test passed. | PASS | `research-change-set.test.ts`; fresh | — |
| 7 | Non-public material is blocked before publication. | Fresh valid private Source reached `READY_FOR_HUMAN_REVIEW`; it was not rejected. | FAIL | `evidence/correction-cycle.md`; fresh | P1: private/non-public input is not blocked. |
| 8 | Stale base SHA blocks before promotion. | Stale-base tests passed before writes. | PASS | `repository-state.test.ts`, `promote.test.ts`; fresh | — |
| 9 | Mid-cycle unavailable source is surfaced. | Fresh source changed from available to unavailable after snapshot; workflow still reached `READY_FOR_HUMAN_REVIEW`. | FAIL | `evidence/correction-cycle.md`; fresh | P1: unavailable transition is not surfaced. |
| 10 | Weakly supported Problem requires human judgement. | Readiness tests retain human-owned judgement and Gate rejects implicit approval. | PASS | `readiness.test.ts`, `decision.test.ts`; fresh | — |
| 11 | Independent-review disagreement reaches human, not auto-resolution. | `DISAGREEMENT_FOUND` preservation/surfacing tests passed. | PASS | `research-change-set.test.ts`, `package-builder.test.ts`; fresh | — |
| 12 | Deterministic validation failure blocks progress. | Prospective and RCS validation failure tests passed. | PASS | `prospective-validation.test.ts`, `rcs-validator.test.ts`; fresh | — |
| 13 | Mid-write promotion failure rolls back exactly. | Canonical-promoter rollback test passed and orchestration failure stays failed. | PASS | `canonical-promoter.test.ts`, `promote.test.ts`; fresh | — |
| 14 | Post-promotion build failure cannot reach green/owner-merge state. | Build-failure orchestration test passed. | PASS | `promote.test.ts`; fresh | — |
| 15 | PR/CI failure cannot reach `READY_FOR_OWNER_MERGE`. | CI and push/PR failure tests passed. | PASS | `git-orchestrator.test.ts`; fresh | — |
| 16 | Leakage path is blocked; no automated path succeeds. | Traversal/workbench/publication-guard tests passed. | PASS | `run-cycle.test.ts`, `publication-guard.test.ts`; fresh | — |
| 17 | Real built artifact matches WU047 delivered state. | Replacement candidate is Ready, protected, and serves expected launch surfaces, but no immutable exact-input-to-deployment SHA chain is established. Production separately lacks required endpoints. | FAIL | `evidence/correction-cycle.md`; fresh | P1: provenance absent; P1: current Production posture fails separately. |
| 18 | APPROVE + public HOLD remains private and resumable only with separate approval. | Private-hold tests passed; no promoter, push, or PR. | PASS | `promote.test.ts`, `decision.test.ts`; fresh | — |
| 19 | Malformed structured AI output fails closed before delta/promotion. | Malformed/missing manifest and reviewer-output tests passed. | PASS | `research-change-set.test.ts`, `run-cycle.test.ts`; fresh | — |
| 20 | Identical pre-Gate rerun is idempotent/non-public. | Deterministic fingerprint/package-id rerun tests passed. | PASS | `research-change-set.test.ts`, `run-cycle.test.ts`; fresh | — |
| 21 | Partial post-approval failure/retry resumes safely or visibly fails, with no duplicate PR/branch. | Compatible branch/PR retry and failure tests passed. | PASS | `git-orchestrator.test.ts`; fresh | — |
| 22 | High-risk claim gets authority/currentness/limits, HOLD/escalation, and no leak. | Fresh allegation with unknown authority and explicit limit reached `READY_FOR_HUMAN_REVIEW` without a risk/HOLD/escalation entry. | FAIL | `evidence/correction-cycle.md`; fresh | P1: high-risk handling absent. |

**Corrected totals:** 17 PASS, 5 FAIL, 22 exercised/assessed. Deterministic mandatory
coverage is below 100%; therefore the acceptance contract requires `NOT_READY`.

## Technical validation

- `npm run research:check`: fresh PASS (391 passed, 0 failed, 1 skipped; 274 records validated).
- `npm run explorer:build`: fresh PASS on the normal checkout (520 passed, 0 failed, 1 skipped; Vite completed). The clean-fixture attempt failed only because temporary dependency junctions broke Vitest path resolution; both results are retained in correction evidence.
- `git diff --check`: PASS.

## Candidate and protection

| Field | Value |
| --- | --- |
| Deployment ID | `dpl_14PbNjRhei3m9pfjmzFKXGNTQNHb` |
| Immutable URL | `https://open-evora-bg3wal1cz-joaomdvferreiras-projects.vercel.app` |
| Requested source SHA | `add597da2510056d0f05d7b090d9a75828686f79` |
| Created | 2026-09-15 13:10:43 WEST |
| Inspected status | `Ready` in the same cycle |
| Target | `production` candidate, not Production alias |
| Protection | Direct unauthenticated request received Vercel SSO and `noindex`; authenticated read-only Vercel request could inspect it. |

The candidate was uploaded from the exact detached SHA, but Vercel's remote
build did not expose a source SHA. This is an absence of independent proof,
not a claim that another SHA was deployed.

### Replacement candidate

`dpl_4RgDRBjSoBdTqEqnLo5fo9j3ZRec` — `https://open-evora-99xjybay8-joaomdvferreiras-projects.vercel.app` — created 2026-09-15 13:48:34 WEST and inspected `Ready`. It is protected and not the Production alias. Its archive/provenance chain remains insufficient for case 17; see `evidence/correction-cycle.md`.

## Current Production, read-only

`https://open-evora.vercel.app` was re-inspected read-only and resolved to
`dpl_9arvHhYKtzfa6raiPZFupu5UcRnm`, created 2026-09-12 23:47:15 WEST. It is
not either candidate. This non-promotion is expected under EVT-316 and is not itself a finding. Separately, its old title and `NOT_FOUND` direct robots/sitemap endpoints fail the current required public posture. No attempt was made to
promote, alias, configure, or otherwise change it.

## Reused checkpoint evidence

- **C047 / WU046:** accepted Human Gate hash binding, private HOLD, stale-base,
  publication-guard and owner-merge boundary evidence; re-exercised here with
  fresh synthetic tests for cases 2, 7–8 and 13–21 where relevant.
- **C048 / WU047:** accepted launch hardening evidence; case 17 fresh candidate
  inspection confirms its intended surfaces, while the read-only Production
  observation shows the public alias remains the earlier artifact.

## Findings and risk disposition

- **P0:** none.
- **P1:** cases 5, 7, 9, 17 and 22 fail; case 17 lacks immutable source-input provenance and current Production separately lacks required public endpoints. These are unresolved and block readiness. Candidate non-promotion is not a P1 finding.
- **P2:** none newly accepted. The prior custom-domain P2 is recorded in C048
  as `OWNER_ACCEPTED_DEFER`; it does not cure P1 findings.
- **P3:** the C048 favicon and narrow-navigation observations remain deferred
  and out of scope.

## Boundary, sanitization, and cleanup

External mutation performed: the original three candidate-creation attempts, plus four correction-cycle replacement attempts (three local CLI rejections without deployment allocation; one Ready replacement candidate).
No promotion, Production-alias assignment, push, PR, merge, DNS/domain,
environment, project-setting, or protection change occurred. No raw fixture,
credentials, cookies, bypass values, external dumps, or sensitive research
content are retained. `.vscode/` is not staged. WU048 remains `in_progress`;
no checkpoint or successor was created.

Final lifecycle diagnostics and the commit/working-tree state are recorded in
the hand-off associated with this report.
