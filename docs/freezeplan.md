# Open Évora FREEZE Plan

Status: owner-approved programme record.

This document is the durable canonical reference for the Open Évora FREEZE
programme identifiers (FZ-01 … FZ-11) and for the approved CRR review-tooling
migration that runs alongside it. References such as "FZ-02" or "CRR-04" in
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
- Until CRR cutover, authorized canonical direct changes continue through the
  currently enforced Lane B.
- PRB-0002 is explicitly authorized to continue through current Lane B.
- FZ-02 does not depend on CRR.
- The owner remains the final merge authority.

Lane A was genuinely used historically. Its retirement is a controlled
migration (see §3 and §4), not removal on the assumption that it was unused.

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
  through the current Lane B.

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

Live Source availability is a monitoring concern, not a semantic-review gate.
FZ-08 is the destination for availability checks removed from the old Lane A
safety-admission path (see §4).

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

## 3. CRR migration relationship

CRR is review-tooling work carried out during the FREEZE. It does not block
FZ-02 or PRB-0002.

### 3.1 Implementation order

1. CRR-01 — Extract shared review kernel.
2. CRR-04 — Compact receipt + full review artifact.
3. CRR-05 — Deterministic PT-PT CI summary.
4. CRR-02 — Reverse EVD→PRB impact review.
5. CRR-03 — Reduced reviewer input.
6. CRR-06 — Owner-controlled review lifecycle.
7. CRR-07 — Equivalence benchmark.
8. OWNER CUTOVER decision.
9. CRR-08 — Cut over CI/docs/commands.
10. CRR-09 — Remove Lane-A-only machinery.

Git history is the archive. No `archive/` directory is created for retired
machinery.

### 3.2 CRR-02 — Reverse EVD→PRB impact review

When an EVD changes:

- every PRB referencing that EVD becomes an impacted review subject, even when
  the PRB file itself is unchanged;
- the impacted PRB is reviewed against **all** of its linked EVDs;
- the changed EVD is explicitly marked in the reviewer input;
- FZ-01 PRB scope signals run on those impacted PRBs;
- a regression is added: "EVD scope becomes narrower while an unchanged PRB
  now exceeds the Evidence."

### 3.3 CRR-03 — Reduced reviewer input

- The reviewer sees the complete authored text of changed records as context.
- Mandatory signal dispositions are required only for the relevant signal set,
  with signals grouped over changed fields.
- Preserve the layering SRC → EVD → PRB.
- PRB review must receive sufficient bounded EVD context.
- EVD review must receive bounded Source/SVS context where Source fidelity
  requires it.

### 3.4 CRR-04 — Compact receipt + full review artifact

The PR receipt becomes compact and contains only the necessary binding data:

- outcome;
- base Git SHA;
- exact changed-record blobs;
- reviewer-input fingerprint;
- hash of the complete review artifact.

The complete review lives in a CI-verifiable governance artifact.

CRR-04 must also update `AGENTS.md` with the rule that agents do not read,
quote, summarise or use the complete review artifact unless the owner
explicitly asks for inspection of a specific artifact. (Recorded here as a
CRR-04 requirement only; `AGENTS.md` is not changed by this document.)

### 3.5 CRR-05 — Deterministic PT-PT CI summary

CI generates/updates a short PT-PT PR summary deterministically and without an
agent. It shows:

- review result;
- disposition counts by type;
- `INSUFFICIENT_EVIDENCE` dispositions with justification;
- `NOT_APPLICABLE` dispositions with justification;
- blocking findings where present.

CRR-04 and CRR-05 change transport/visibility, not semantic detection, so they
do not wait for CRR-07 equivalence testing.

### 3.6 CRR-06 — Owner-controlled review lifecycle (attempt contract)

- The owner explicitly declares when content is ready for semantic review.
- Semantic attempt 1 runs on that declared final version.
- If there are substantive findings, one bounded correction is allowed;
  semantic attempt 2 may then run.
- If attempt 2 still has a substantive non-CONCUR result, return to the owner.
- A structurally invalid reviewer response receives one technical retry
  against the **same** immutable semantic input. That technical retry does
  **not** count as a semantic attempt.
- If the technical retry is also structurally invalid, report a
  tooling/runtime failure for investigation. Do not classify it as owner
  escalation.
- Any canonical-content change after CONCUR invalidates the binding.

### 3.7 CRR-07 — Equivalence benchmark

Run the current/reference package and the reduced package **three times
each** for every benchmark case.

Required cases:

1. **PR #191, pre-correction version** — detection case.
2. **PR #211** — detection case. The historical "Centro Histórico" PRB layer
   leak via SVS escaped the original semantic review; **both** benchmark
   variants must detect it.
3. **PR #204** — false-blocker/control case.
4. **Synthetic reverse-impact regression** — an EVD scope is narrowed while an
   unchanged linked PRB becomes broader than the Evidence.

Rules:

- Compare detection per expected material defect, not only total finding
  count.
- The reduced package may cut over only if it detects **no fewer** expected
  material defects than the reference package.
- Also record false blockers on expected-CONCUR/control material.

## 4. Safety-admission migration decisions

Owner-approved decisions for retiring the Lane A safety-admission path:

1. **Claim authority**
   - Remove the deterministic blocker for `claim_authority != authoritative`.
   - Add a CONSULTATIVE signal when an EVD with `evidence_nature=claim` and
     non-authoritative authority supports a PRB.
   - Semantic review judges attribution/scope.

2. **Inference limits**
   - Remove the separate human-resolution mechanism triggered merely because
     `inference_limits` is non-empty.
   - `inference_limits` remain mandatory reviewer context and constrain
     EVD/PRB wording.

3. **Private Sources**
   - Remove the blanket `PRIVATE_SOURCE` semantic-review blocker.
   - Replace it with publication-safety enforcement.
   - **Before CRR cutover**, present the owner with the exact rule and a
     regression proving both:
     a. a canonical record may reference a private Source where otherwise
        permitted;
     b. attempting to publish raw/private Source content is blocked.
   - The current publication guard is path-oriented and is **not** claimed to
     already prove (b); this may require an extension or an additional
     deterministic publication-safety check.

4. **Source availability**
   - Move live Source availability/freshness monitoring to FZ-08.
   - Transient HTTP availability must not determine semantic-review outcome.

5. **Publication guard**
   - Retain fail-closed publication protection.

Preserved throughout the migration: schema/reference/prospective-corpus
validation, CLEC, PRB→EVD evidence boundaries, SVS base-only rules and
independent semantic review.
