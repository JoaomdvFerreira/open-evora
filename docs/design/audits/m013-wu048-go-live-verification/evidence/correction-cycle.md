# WU048 evidence-correction cycle (sanitized)

Execution window: 2026-09-15 13:39–13:53 WEST. This is verification evidence, not product remediation.

## Fresh synthetic scenarios

All scenarios used disposable local state and synthetic text only. Every cycle was removed; no canonical file, Git remote, PR, or public research artifact was created.

| Case | Actual result | Classification |
| --- | --- | --- |
| 5 | A PRB candidate with `contradiction_search` reached `READY_FOR_HUMAN_REVIEW`. The raw candidate retained the field, but rendered Human Gate Markdown omitted its summary and the package had no risk entry. | FAIL — contradiction is not surfaced in the human review view. |
| 7 | A valid synthetic Source with `access.level: private` reached `READY_FOR_HUMAN_REVIEW` with no risk entry. | FAIL — private/non-public input is not blocked. |
| 9 | A Source was materialized as `available`, then changed to `unavailable` before independent review. The frozen snapshot still reached `READY_FOR_HUMAN_REVIEW`. | FAIL — disappearance is not surfaced or failed closed. |
| 22 | An allegation used `evidence_nature: claim`, `claim_authority: unknown`, and an explicit inference limit. It reached `READY_FOR_HUMAN_REVIEW` with no risk/HOLD/escalation entry. | FAIL — high-risk handling is absent. |

The scenario runner used the same runtime code as the bound revision. The only files differing between the bound commit and correction HEAD are AIQT state and WU048 evidence; no runtime or product file differs.

## Fresh command evidence

| Command | Result | Sanitized terminal facts |
| --- | --- | --- |
| `npm run research:check` | PASS | 391 passed, 0 failed, 1 skipped; canonical validation: 274 records OK. |
| `npm run explorer:build` — clean fixture | FAIL (environmental) | Typecheck passed; Vitest could not resolve `/src/test-setup.ts` through temporary dependency junctions. |
| `npm run explorer:build` — normal checkout retry | PASS | 520 passed, 0 failed, 1 skipped; Vite build completed. Only governance/evidence files differ from bound SHA. |
| `git diff --check` | PASS | No whitespace errors after correction evidence creation. |

## Replacement-candidate attempt ledger

All attempts used source SHA `add597da2510056d0f05d7b090d9a75828686f79`, the existing `open-evora` project, production target, `--skip-domain`, and no environment/project/protection setting mutation. Attempts 1–3 occurred in the 13:46–13:48 WEST correction window; the local CLI did not emit a durable per-attempt timestamp, so minute-exact timestamps are intentionally not invented.

| Attempt | Method/result | Deployment |
| --- | --- | --- |
| 1 | `--archive` omitted its required format argument; local CLI rejected before upload. | None. |
| 2 | Archive filename supplied where CLI requires format; rejected before upload. | None. |
| 3 | `.tgz` filename supplied where CLI requires format; rejected before upload. | None. |
| 4 | `--archive tgz` submitted and built. CLI output recorded archive extraction and the returned inspect URL. | `dpl_4RgDRBjSoBdTqEqnLo5fo9j3ZRec`, created 2026-09-15 13:48:34 WEST, `Ready`. |

## Candidate provenance and posture

Before local linking, the detached checkout reported HEAD `add597da2510056d0f05d7b090d9a75828686f79`, clean tracked status, Git tree `d0b530bc07a37b7f489de25086c4083f8a8fc524`, 623 tracked files, and deterministic Git archive SHA-256 `3651d159c36d94838208ce424fdaf91218dad8a0c9367e897c86fb2073ada4ce`.

The final CLI request attached these SHA/tree/archive values as deployment metadata and returned the immutable candidate identity above. Vercel did not expose source commit metadata (`sourceCommit: (unavailable)`). Temporary local linking modified ignored/local files before directory-based archive upload, so this record cannot prove Vercel received exactly the previously hashed clean Git archive. Case 17 remains FAIL; no SHA mismatch is asserted.

Unauthenticated candidate access returned Vercel SSO protection and `noindex`. Authenticated read-only requests returned expected metadata, `robots.txt`, and a six-route sitemap. Production remains `dpl_9arvHhYKtzfa6raiPZFupu5UcRnm`; its root uses the older title and both `/robots.txt` and `/sitemap.xml` return `NOT_FOUND`.

No token, cookie, account identity, request nonce, authenticated URL, private fixture content, or environment value is retained.
