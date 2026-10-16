# Open Évora FREEZE Plan

Status: historical record of a closed programme. The owner lifted the FREEZE;
no FREEZE-specific gate remains active.

This document is the durable canonical reference for the Open Évora FREEZE
programme identifiers (FZ-01 … FZ-11) and the historical CRR review-tooling
migration decisions. References such as "FZ-02" or "CRR-04" in
commits, pull requests and issues resolve here and must not depend on
conversation history.

This document records historical programme scope, sequencing and owner decisions. It does
**not** replace the semantic contracts owned by `AGENTS.md`,
`docs/investigationstrategy.md`, `docs/datamodel.md` or
`docs/explorerarchitecture.md`. Where this document and those contracts appear
to differ, those contracts govern until they are changed through their own
process.

## 1. Historical FREEZE operating boundary

The FREEZE formerly governed canonical research publication and integration;
it did not freeze all repository work. Its restrictions and sequencing no
longer control current work. The owner closed the programme without changing
the recorded status of each FZ item or automatically authorizing any pending
research integration. Current publication, review and merge safeguards are
owned by `AGENTS.md` and `docs/investigationstrategy.md` §12.

## 2. FZ programme items

### FZ-01 — PRB→EVD review-boundary hardening

- Linked EVDs are the complete evidential boundary for PRB wording.
- SRC and Source Verification Support must never directly justify PRB text.
- Preserve CLEC scope/layer-integrity rules.
- Status: complete; merged in PR #214.

### FZ-02 — Layer-leak audit

- Audit PRB wording against the EVD boundary.
- Detect Source/SVS detail that leaks into PRB wording, and other cases where
  PRB wording exceeds linked Evidence.
- Lexical signals alone are not sufficient.
- Status: audit completed; resulting remediation proceeds independently.
- FZ-02 did not depend on the CRR migration.

### FZ-03 — PRB-0002 integrity repair

- Repair confirmed evidence-boundary/layer-integrity defects without weakening
  uncertainty or broadening claims.
- Status at programme closure: content-approved draft; canonical integration
  remained pending. Any later integration follows `docs/investigationstrategy.md` §12.

### FZ-04 — PT-PT canonical repair

- Correct citizen-facing canonical research wording to PT-PT where required.
- Must not alter evidence scope or meaning.

### FZ-05 — PRB-0002 boundary decision

- Primary boundary: Évora city / urban TREVO service.
- TPAC evidence remains contextual.
- Status at programme closure: decision reflected in the approved draft;
  canonical integration remained pending.

### FZ-06 — Material-omission review

- Check whether omitting materially relevant linked Evidence would make a PRB
  reading misleading.
- Must cover semantic omissions that lexical signals cannot detect.

### FZ-07 — PRB-0002 source refresh

- Proportionate current-source research for PRB-0002.
- Preserve unresolved current state where it remains unresolved.
- Required SVS support is merged, including SRC-0018 via PR #216.
- The municipal documentary request remains prepared but unsent unless
  explicitly owner-authorized.

### FZ-08 — Source monitoring cycle

Historically covered Source-health monitoring:

- canonical-reference availability;
- redirects/status;
- broken-source follow-up;
- freshness / `last_checked_at` maintenance.

The FZ-08 monitoring remit did not make live Source availability or freshness
semantic-review gates.

### FZ-09 — Institutional diligence model

- Govern institutional contact, clarification and follow-up.
- Contact is not Evidence.
- Non-response is not Evidence.

### FZ-10 — Citizen reading improvements

- Improve public PRB comprehension without weakening evidential meaning.
- FZ-10a (PRB-details presentation work) is complete and merged in PR #215.
- FZ-10 was still open as a broader item when the programme closed; closure
  does not itself complete that work.

### FZ-11 — Static subscriptions

- Define a bounded way for readers to follow Problem updates without
  introducing a second research-state source of truth.

## 3. Historical review-tooling decisions

CRR experiments are historical. CRR-07 concluded `BENCHMARK_INCONCLUSIVE / NO CUTOVER`. The automated semantic-review and attestation machinery was subsequently retired. Semantic review remains independent of the implementing agent and owner-side. Git history preserves implementation detail; the active workflow is owned by `docs/investigationstrategy.md` §12.

The historical safety-admission decisions were: source availability/freshness was assigned to FZ-08; non-authoritative claim authority was not an automatic blocker; non-empty inference limits did not require a separate human-resolution process. Current private/publication safety is governed by `AGENTS.md` and the surviving publication-safety checks.

Preserved safeguards include canonical schema/reference and Source Verification Support validation, the CLEC, PRB-to-EVD evidence boundaries, independent owner-side semantic review, fail-closed publication-path checks, and owner publication/merge authority.
