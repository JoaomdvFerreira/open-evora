# WU048 execution baseline (sanitized)

- Execution window: 2026-09-15 13:03–13:16 WEST.
- Bound source revision: `add597da2510056d0f05d7b090d9a75828686f79`.
- Local fixture: a detached Git worktree in the operating-system temporary
  directory at that revision. It used only the repository's synthetic test
  doubles and temporary Git/GitHub fakes. Its path, its `.vercel/` link, and
  all raw test artifacts are intentionally not retained.
- Candidate attempts: two client-side attempts created no usable artifact
  (obsolete CLI; then invalid personal-account `--scope`). The third attempt
  used the same detached source and existing linked project and created the
  candidate listed in the report. No retry followed a usable artifact.
- No credentials, cookies, protection-bypass values, request IDs, private
  fixture data, raw AI material, or token-bearing URLs are retained here.

## Command results

| Command | Result |
| --- | --- |
| `npm run research:check` | PASS: typecheck, full tests, and canonical validation completed; 274 canonical records validated. |
| `npm run explorer:build` | INCONCLUSIVE: read-model generation and Explorer typecheck passed; the local Vitest runner did not return a terminal result within the executor limit. The remote candidate build later reached `Ready`, but does not replace the required local command result. |
| `git diff --check` | PASS: no whitespace errors. |

## Read-only deployment observations

- Candidate `dpl_14PbNjRhei3m9pfjmzFKXGNTQNHb` was created at 2026-09-15
  13:10:43 WEST, target `production`, and later inspected `Ready`.
- Its immutable URL is recorded in `report.md`; direct unauthenticated access
  received Vercel SSO protection and `X-Robots-Tag: noindex`. Authenticated
  read-only deployment requests returned the expected launch metadata,
  `robots.txt`, and a six-route sitemap.
- The remote build logged `sourceCommit: (unavailable)`. Therefore the
  deployment service did not independently attest the bound Git SHA.
- The current Production alias resolved read-only to prior deployment
  `dpl_9arvHhYKtzfa6raiPZFupu5UcRnm`, created 2026-09-12 23:47:15 WEST,
  not the candidate. Its observed HTML title differed from the candidate and
  direct `/robots.txt` and `/sitemap.xml` requests returned `NOT_FOUND`.
