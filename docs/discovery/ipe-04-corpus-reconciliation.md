# IPE-04 — Corpus Reconciliation

**Type:** Approved wording/`evidence_status` reconciliation across canonical `PRB-0001`–`PRB-0010` — not an IPE-01/IPE-02 schema or verifier change, not a D5/D6 milestone action.
**As of:** 2026-08-23
**Scope:** This record is the dedicated audit trail for the IPE-04 reconciliation: fixed human-gate outcomes, `evidence_status` transitions, approved wording changes, `decision_basis` readiness observations, and provenance. It authors no `decision_basis` and changes no `validation_status`, schema, enum, `EVD-*`, or `ASM-*` record.

## 1. Why this reconciliation

`decision_basis` (IPE-01, `docs/discovery/investigation-promotion-engine.md`) formalized what
structural basis Eligibility and Corroboration claims require. Reviewing the canonical
`PRB-0001`–`PRB-0010` corpus against that contract surfaced two separate kinds of drift that
this reconciliation fixes without touching the contract itself:

1. Several `PRB-*` titles/statements asserted a current-state civic problem in stronger,
   more settled terms than the cited evidence (institutional planning documents,
   single/unverified public signals, historical persistence data) actually supports as a
   present-day, characterized magnitude.
2. `evidence_status: corroborated` had been applied to several of those same records
   without an explicit, on-record account of which evidence classes converge
   independently on the claim as framed
   (`docs/discovery/investigation-promotion-engine.md` §4.2) — i.e. the corroboration
   claim outran the explicit basis for it.

This reconciliation brings wording and `evidence_status` into alignment with what is
actually on record today. It is a hygiene/precision pass over existing canonical text and
one enum field per affected record — not new research, not new evidence, and not a
`validation_status` action (`validation_status` is untouched everywhere in this
reconciliation; see §5).

## 2. Fixed human-gate outcomes

Recorded as given by the project owner; this document does not re-derive or second-guess
them. Two values per row: the Eligibility human-gate outcome, and the Corroboration
human-gate outcome.

| PRB | Eligibility human gate | Corroboration human gate |
|---|---|---|
| PRB-0001 | PASS | PASS_BOUNDED |
| PRB-0002 | HOLD | HOLD |
| PRB-0003 | HOLD | PASS_BOUNDED |
| PRB-0004 | HOLD | HOLD |
| PRB-0005 | HOLD | HOLD |
| PRB-0006 | PASS | PASS_BOUNDED |
| PRB-0007 | HOLD | HOLD |
| PRB-0008 | HOLD | HOLD |
| PRB-0009 | PASS | PASS_BOUNDED |
| PRB-0010 | PASS | HOLD |

Eligibility concerns the record's readiness for the human PRB-promotion gate
(`docs/discovery/investigation-promotion-engine.md` §4.1). Corroboration concerns human
approval of the evidence basis for the *current* problem claim/scope, i.e. the basis for
`evidence_status: corroborated` (§4.2 of the same document). These are two distinct human
judgements, not two readings of the same wording/evidence-status change.

`PASS_BOUNDED` on the Corroboration gate means Corroboration is human-approved only within
the explicitly bounded claim/scope recorded for that `PRB-*` — not as an unbounded or
general claim. `HOLD` on either gate means that gate's readiness remains open for that
record; it is not a judgement that the underlying civic problem is false, unimportant, or
unlikely to be real.

## 2a. Public-impact findings

The approved IPE-04 human review classified the following `PRB-*` records `MATERIAL`
for public-impact purposes:

- PRB-0001
- PRB-0003
- PRB-0007

Approved reason per record:

- **PRB-0001** — the previous title was stronger than the bounded time/territory service
  variation supported by the evidence.
- **PRB-0003** — the previous title asserted present causal impact while persistence of
  specific current barriers remains to be validated.
- **PRB-0007** — the previous framing foregrounded information/navigation despite
  evidence that other caregiver needs may be more prevalent and causality with formal
  support non-use is unresolved.

This classification documents public-meaning rationale only. It does not alter
`evidence_status`, `validation_status`, or any `EVD-*`/`ASM-*` record.

## 3. `evidence_status` transitions applied

| PRB | Old | New |
|---|---|---|
| PRB-0002 | corroborated | discovered |
| PRB-0004 | corroborated | discovered |
| PRB-0005 | corroborated | discovered |
| PRB-0007 | corroborated | discovered |
| PRB-0008 | corroborated | discovered |
| PRB-0010 | corroborated | discovered |

Kept `corroborated` (no change):

- PRB-0001
- PRB-0003
- PRB-0006
- PRB-0009

Rationale for the six transitions: each of PRB-0002, PRB-0004, PRB-0005, PRB-0007,
PRB-0008, and PRB-0010 changed from `corroborated` to `discovered` because its fixed
IPE-03 human Corroboration outcome (§2) was `HOLD` for the current claim/scope. No `EVD-*`
or `ASM-*` content was modified to produce these transitions. The status changes record the
approved human epistemic judgement produced by the read-only IPE-03 review and reconciled
here in IPE-04 — a deliberate human determination that the explicit basis for treating the
evidence as convergent/independent on the *current* framing was not established for these
six records, not merely a structural re-reading of existing text.
`validation_status: unvalidated` is unchanged on every one of these six records and was
never part of this evaluation (§5).

## 4. Wording reconciliation applied

Only `title` and, where listed, `problem_statement` changed. No `possible_root_causes`,
`evidence`, `affected_populations`, `domain`, `geography`, `digital_tractability`,
`existing_solutions`, or `status` field was touched by this reconciliation.

- **PRB-0001** — title reworded to state the practical-utility variance claim without
  asserting a uniform service failure; `problem_statement` unchanged.
- **PRB-0002** — title and `problem_statement` reworded to separate the documented
  information-environment gaps (stop-level heterogeneity, planned-but-unconfirmed
  real-time improvements) from the unestablished question of how much these gaps actually
  affect passenger journeys (frequency, severity, concrete failure points).
- **PRB-0003** — title reworded to flag that current persistence of the documented
  barriers is not yet validated; `problem_statement` unchanged.
- **PRB-0004** — title and `problem_statement` reworded to attribute the
  limited/discontinuous/insufficiently-connected description to institutional planning
  material and to state explicitly that the concrete daily journeys affected, and the
  practical reduction in network usefulness, are not yet established.
- **PRB-0005** — no wording change; `evidence_status` transition only.
- **PRB-0006** — no wording change.
- **PRB-0007** — title and `problem_statement` reworded to keep the three underlying
  evidence sources (the 68-caregiver/89-cared-for study, the focus-group material, and the
  133-caregiver survey) explicitly distinct rather than merged into one aggregate claim,
  to attribute the 35% non-utilization figure to its specific sample rather than
  generalizing it, and to state plainly that no causal link between information
  fragmentation and non-utilization of formal support is established, and that
  direct-care/respite/financial/psychological needs remain a plausible, possibly more
  prevalent, alternative explanation.
- **PRB-0008** — title and `problem_statement` reworded to frame skills/employer-needs
  alignment as an active institutional workstream rather than an unresolved crisis, and to
  state explicitly that the specific skills/professions in shortage in Évora (as distinct
  from the existing Alentejo-region shortage list) are not yet established.
- **PRB-0009** — no wording change. Title kept exactly as
  `"Fiabilidade e qualidade dos serviços de higiene urbana e de recolha de resíduos"`.
- **PRB-0010** — title and `problem_statement` reworded to state the extent of current
  degradation as unconfirmed beyond the specific petition and the one unverified
  subsequent public signal, while preserving that these elements do evidence a real
  pavement-degradation and maintenance-reliability problem.

## 5. `decision_basis` readiness

No `decision_basis` block is authored by this reconciliation on any record (§7). The
following is a readiness observation only — what basis-authoring work remains open for a
future, separate decision — not a `decision_basis` value, not a promotion, and not a
`validation_status` action.

- **Full `decision_basis` readiness later:** PRB-0001, PRB-0006, PRB-0009 — these three
  keep `evidence_status: corroborated` under this reconciliation and their existing
  canonical history already documents convergent evidence classes; both Eligibility and
  Corroboration basis could plausibly be authored from what is already on record, subject
  to whoever authors `decision_basis` verifying that directly.
- **Corroboration-only basis readiness later:** PRB-0003 — corroboration basis appears
  plausibly authorable from the existing APCE/CME institutional-response and
  factual-corroboration evidence already on record, but Eligibility basis is not yet
  clearly settled: consequence evidence for the record's claimed impact is insufficient
  and not yet concretely evidenced, which is the primary blocker rather than
  `overlap_check` or currentness.
- **Eligibility-only basis readiness later:** PRB-0010 — the manifestation/consequence
  basis for treating this as a distinct, well-formed problem (promoted from a
  NEW-CANDIDATE per the WU-D3-03 record) appears plausibly authorable, but Corroboration
  basis is not, since the record's own evidence is explicitly a single petition plus one
  unverified subsequent public signal — not yet a convergent, independent basis.
- **Blocked (neither basis plausibly ready from current record):** PRB-0002, PRB-0004,
  PRB-0005, PRB-0007, PRB-0008 — each record's own history documents an open current-state,
  magnitude, or independence question that would need to be resolved (by further D2/D5
  work, not by this reconciliation) before either basis could be authored.

These readiness observations are descriptive of the current corpus only; they do not
authorize anyone to author `decision_basis`, and authoring it later remains a separate,
deliberate act governed entirely by IPE-01/IPE-02 (`docs/discovery/investigation-promotion-engine.md`
§4.1–§4.6, §10).

## 6. Historical/provenance note

- IPE-01 (`decision_basis`/schema foundation, implemented) and IPE-02
  (`tools/evaluate-research-decisions.js`, deterministic structural verification,
  implemented) preceded this reconciliation.
- IPE-03 was the read-only human-gate review of `PRB-0001`–`PRB-0010`: it inspected the
  relevant `PRB-*`/`ASM-*`/`EVD-*`/`SRC-*` material for each record and produced the fixed
  Eligibility and Corroboration outcomes recorded in §2 of this document. IPE-03 made no
  edits to any canonical record.
- IPE-04 (this document) applies the approved corpus wording and `evidence_status`
  reconciliation derived from those IPE-03 outcomes. IPE-04 itself does not modify `EVD-*`
  or `ASM-*` evidence.
- The wording and `evidence_status` changes applied here were approved by the project
  owner prior to this document's authoring; this document is the audit record of that
  approval being applied, not the approval decision itself.
- `possible_root_causes` on every affected record is preserved verbatim and unedited by
  this reconciliation. This document — not `possible_root_causes` — is the durable home
  for the governance/history narrative behind these wording and `evidence_status`
  changes, per the explicit instruction that governance/history notes do not belong in
  `possible_root_causes`.

## 7. Constraints observed

- No `decision_basis` authored on any record (§5).
- No schema or enum changed (`docs/models/problem-model.md`'s `evidence_status` enum
  values, `discovered | corroborated`, are unchanged; only the contract clarification
  prose was added).
- No `validation_status` changed on any of the ten canonical `PRB-*` records; every record
  keeps its existing `unvalidated` value untouched.
- No `EVD-*` or `ASM-*` record changed.
- No D5 route or state altered (WU022/WU023/WU024 and related D5 material are untouched).
- No D6 work started.
- No new evidence added to any record's `evidence` list.
- No unrelated cleanup performed on any touched file beyond the specified `title`/
  `problem_statement`/`evidence_status` edits.

## 8. Integrity check

- Canonical `research/problems/PRB-0001.yaml`…`PRB-0010.yaml`: `title`/`problem_statement`
  changed only where listed in §4; `evidence_status` changed only where listed in §3;
  `validation_status`, `possible_root_causes`, `evidence`, `affected_populations`,
  `domain`, `geography`, `digital_tractability`, `existing_solutions`, `status` unchanged
  on every record.
- `docs/models/problem-model.md`: `evidence_status` contract clarification added; no
  schema/enum change.
- `EVD-*`, `ASM-*`, `.aiqt/state.json`: unchanged.
- `decision_basis`: absent on all ten records, as before this reconciliation.
