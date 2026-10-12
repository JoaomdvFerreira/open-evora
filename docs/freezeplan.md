# Open Évora FREEZE Plan

Status: owner-approved programme record.

This document is the durable canonical reference for the Open Évora FREEZE
programme identifiers (FZ-01 … FZ-11) and the historical CRR review-tooling
migration decisions. References such as "FZ-02" or "CRR-04" in
commits, pull requests and issues resolve here and must not depend on
conversation history.

This document records programme scope, sequencing and owner decisions. It does
**not** replace the semantic contracts owned by `AGENTS.md`,
`docs/investigationstrategy.md`, `docs/datamodel.md` or
`docs/explorerarchitecture.md`. Where this document and those contracts appear
to differ, those contracts govern until they are changed through their own
process.

## 1. FREEZE operating boundary

- The FREEZE concerns canonical research publication and integration. It does
  not freeze all repository work.
- Noncanonical drafts, deterministic checks, tooling, Explorer work and
  authorized support-only Source Verification Support (SVS) work may proceed.
- Canonical PRB/EVD/SRC changes require explicit owner authorization.
- The owner-approved Phase 1 target for authorized canonical direct changes is
  `research:validate` → `research:review -- --base <ref>` → `research:check`,
  followed by explicit owner publication authorization before any push or PR.
- PRB-0002's historical authorization does not resume FZ-02 in this action.
- This plan does not start or resume FZ-02; its status remains as recorded in
  the FZ-02 section.
- FZ-02 does not depend on CRR.
- The owner remains the final merge authority.

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
- FZ-02 does not depend on the CRR migration.

### FZ-03 — PRB-0002 integrity repair

- Repair confirmed evidence-boundary/layer-integrity defects without weakening
  uncertainty or broadening claims.
- Status: content-approved draft; canonical integration remains pending
  through the active direct review workflow defined in `docs/investigationstrategy.md` §12.

### FZ-04 — PT-PT canonical repair

- Correct citizen-facing canonical research wording to PT-PT where required.
- Must not alter evidence scope or meaning.

### FZ-05 — PRB-0002 boundary decision

- Primary boundary: Évora city / urban TREVO service.
- TPAC evidence remains contextual.
- Status: decision reflected in the approved draft; canonical integration
  pending.

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

Owns Source-health monitoring:

- canonical-reference availability;
- redirects/status;
- broken-source follow-up;
- freshness / `last_checked_at` maintenance.

Live Source availability and freshness are FZ-08 monitoring concerns, not semantic-review gates.

### FZ-09 — Institutional diligence model

- Govern institutional contact, clarification and follow-up.
- Contact is not Evidence.
- Non-response is not Evidence.

### FZ-10 — Citizen reading improvements

- Improve public PRB comprehension without weakening evidential meaning.
- FZ-10a (PRB-details presentation work) is complete and merged in PR #215.
- FZ-10 remains open as the broader programme item.

### FZ-11 — Static subscriptions

- Define a bounded way for readers to follow Problem updates without
  introducing a second research-state source of truth.

## 3. Historical review-tooling decisions

The owner approved the direct review control plane now documented in `docs/investigationstrategy.md` §12. This section records only programme history; it is not an operator procedure. Git history preserves implementation detail.

- CRR-02 reverse EVD-to-PRB impact review and CRR-03 bounded reviewer context were incorporated into the active REFERENCE review.
- CRR-04/05 receipt and summary proposals were superseded by the exact-content attestation and CI verification path.
- CRR-06 semantic-attempt lifecycle tooling was retired; only a same-input technical retry for structurally invalid reviewer output remains.
- CRR-07 concluded `BENCHMARK_INCONCLUSIVE`; the owner decision is `NO CUTOVER`. REFERENCE remains the only active profile.
- Lane A, Human Gate, admission/HOLD, lifecycle, and REDUCED benchmark machinery were retired after the direct control plane was established.

The historical safety-admission decisions remain: source availability/freshness belongs to FZ-08; non-authoritative claim authority is not an automatic blocker; non-empty inference limits do not require a separate human-resolution process; private/publication safety is governed by `AGENTS.md` and the surviving publication-safety checks.

Preserved safeguards include canonical schema/reference/prospective-corpus validation, CLEC review, PRB-to-EVD evidence boundaries, base-only Source Verification Support semantics, independent semantic review, fail-closed publication-path checks, exact-content attestation verification, and owner publication/merge authority.
