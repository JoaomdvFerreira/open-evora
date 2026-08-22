# Problem Model

**Identifier prefix:** `PRB-`

## Purpose

Problem records consolidate multiple evidence items describing the same underlying civic friction.

Solutions must not be embedded in the problem statement.

## Draft schema

```yaml
problem_id: PRB-0001

title: ""

domain: ""

geography:
  level: municipality
  area: ""

affected_populations: []

problem_statement: ""

current_journey: null

reported_consequences: []

possible_root_causes: []

evidence: []

evidence_status:
  discovered | corroborated
  # see "evidence_status contract" below

validation_status:
  unvalidated | partially_validated | validated

digital_tractability:
  not_assessed | low | medium | high

existing_solutions:
  not_assessed | assessed

status:
  OPEN | REJECTED | DUPLICATE | NON_DIGITAL |
  ALREADY_SOLVED | INSUFFICIENT_EVIDENCE

# Optional (IPE-01, v0) — see docs/discovery/investigation-promotion-engine.md
decision_basis: null
```

## `decision_basis` (optional, IPE-01)

`decision_basis` is an optional structure recording the explicit basis for this record's
own Eligibility (readiness for the human PRB-promotion gate) and Corroboration
(`evidence_status: corroborated`) claims — eligibility basis, corroboration basis,
manifestation, consequence, currentness, contradiction/current-state search, overlap
check, a corroboration-statement snapshot, supporting/boundary evidence, an independence
assessment, geography/population/temporal scope (with an explicit `scope.bounded` flag,
added IPE-02), and limitations. It is never required, no existing canonical `PRB-*` is
backfilled with it, and writing it never itself changes `evidence_status` or
`validation_status` — both remain independent human decisions. `decision_basis` does not
verify or structurally justify `validation_status`: that remains solely the D5 process's
responsibility (see "Validation-status contract" below); the IPE-02 verifier has no
`VALIDATION-v0` contract. Full contract: `docs/discovery/investigation-promotion-engine.md`.

## Lifecycle

```text
DISCOVERED
    ↓
CORROBORATED
    ↓
VALIDATED
    ↓
ROOT_CAUSE_UNDERSTOOD
    ↓
TRACTABILITY_ASSESSED
    ↓
CANDIDATE
```

The lifecycle is analytical, not necessarily a strict automatic state machine.

## Problem-statement rule

Prefer:

> Residents in area X cannot reliably determine Y before starting journey Z.

Avoid:

> Évora needs an app for Y.

## Valid terminal outcomes

A problem may legitimately end as:

- `REJECTED`;
- `DUPLICATE`;
- `NON_DIGITAL`;
- `ALREADY_SOLVED`;
- `INSUFFICIENT_EVIDENCE`.

These outcomes prevent solutionism and wasted development.

## `evidence_status` contract

Canonicalized as part of the IPE-04 corpus reconciliation
(`docs/discovery/ipe-04-corpus-reconciliation.md`). No schema change — this clarifies the
existing `discovered` / `corroborated` enum; it does not add a state and does not alter
`validation_status`, which remains a fully separate, D5-governed contract (see below).

### `discovered`

`discovered` means the CURRENT corroboration claim does not presently carry a
human-approved Corroboration decision (the human Corroboration gate,
`docs/discovery/investigation-promotion-engine.md` §4.2, is not `PASS`/`PASS_BOUNDED` for
the claim/scope as currently framed).

`discovered` does NOT mean the evidence is thin, weak, single-source, or structurally
incomplete. A record may have extensive evidence, or even a structurally complete
`decision_basis`, and still be `discovered` if the human Corroboration gate outcome for it
is `HOLD` — Corroboration is a deliberate human approval, not a derived count or structural
score.

### `corroborated`

`corroborated` means the evidence basis for the CURRENT claim and scope has received a
deliberate human Corroboration approval (§4.2). The supporting evidence, its independence
across sources, and the scope it is approved for must be explicit enough for that human
decision to have been made — whether or not that basis is additionally captured in a
`decision_basis.corroboration_basis` field. `decision_basis` remains optional
(`docs/discovery/investigation-promotion-engine.md` §5), and its verifier result never
automatically changes `evidence_status`.

Neither state implies anything about `validation_status`: a `discovered` problem can
still be a legitimate, publishable `STOP`/`WATCH`, and moving from `discovered` to
`corroborated` (or the reverse) is always a deliberate, recorded human judgement, never
an automatic transition inferred from evidence count or wording.

## Validation-status contract (D5)

Canonicalized as part of the D5 Execution Strategy (`docs/discovery/research-methodology.md` §D5). No schema change — this clarifies the existing `unvalidated` / `partially_validated` / `validated` enum.

Participant count is never the criterion for any of the three states.

### `unvalidated`

No deliberate D5 challenge has been completed; direct evidence is insufficient to support the current framing; or D5 materially contradicts the framing and the problem must first be refined/rejected. `unvalidated` does not mean the problem is false.

### `partially_validated`

One or more material parts of the diagnosis have been directly challenged and supported/refined, but at least one decision-critical dimension remains unresolved — e.g. current journey supported but root cause uncertain; operator confirms a process failure but affected-user materiality is unknown; one material context is supported while another remains uncertain.

### `validated`

Use only when the current canonical problem framing, at the level needed for the next programme decision, has survived proportionate direct challenge. Required conditions:

1. the key current-journey/problem claim has been challenged;
2. relevant negative cases/counterexamples were actively sought;
3. material operator/process/causal claims required by the diagnosis were challenged with an appropriate source where feasible;
4. important contradictions are resolved, incorporated as refinements, or explicitly bounded;
5. no unresolved HIGH-impact critical unknown remains that could plausibly reverse the core diagnosis;
6. currentness is sufficient for the next-phase decision;
7. the remaining gap is sufficiently supported to justify tractability/evaluability assessment.

`validated` does not mean statistically representative prevalence, causal proof of every root cause, solution validation, or digital tractability.

If D5 falsifies the current framing, preserve the contradiction and use/refine the separate `status` contract (§ Valid terminal outcomes above) rather than redefining `validated` to mean "validated rejection." No automatic validation-status transition is allowed — every change is a deliberate, recorded decision.
