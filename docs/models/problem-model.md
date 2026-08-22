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
own `evidence_status`/`validation_status` claim — eligibility basis, corroboration basis,
manifestation, consequence, currentness, contradiction/current-state search, overlap
check, a corroboration-statement snapshot, supporting/boundary evidence, an independence
assessment, geography/population/temporal scope (with an explicit `scope.bounded` flag,
added IPE-02), and limitations. It is never required, no existing canonical `PRB-*` is
backfilled with it, and writing it never itself changes `evidence_status` or
`validation_status` — both remain independent human decisions. Full
contract: `docs/discovery/investigation-promotion-engine.md`.

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
