# Investigation & Promotion Engine (IPE) — v0 Contract Foundation

**Version:** 0.1
**Status:** IPE-01 — contract foundation only. No verifier implemented.

## 1. Purpose

The Investigation & Promotion Engine (IPE) is a deterministic verifier of explicitly
authored research decisions. It checks that a promotion-relevant decision (e.g. a `PRB-*`
reaching `validated`, or a `triage` of `PROCEED`) is backed by an explicit, structured
record of the basis for that decision — not that the decision is *correct*.

IPE never decides whether a problem is real, whether corroboration is sufficient, whether
a root cause is right, or whether a problem should be promoted. Those remain human,
project-owner judgements recorded in `PRB-*`/`ASM-*`, exactly as today
(`docs/discovery/d3-execution-protocol.md` §6, `docs/models/assessment-model.md`
"Interpretation rules"). IPE only checks that, when such a judgement is recorded, the
explicit basis for it is present, structurally well-formed, and internally consistent —
so a reader (human or tooling) can see *why* a decision was made without re-deriving it
from prose scattered across `possible_root_causes` and `notes`.

This document is the IPE-01 contract: what `decision_basis` means, what it does and does
not represent, and the non-goals that keep IPE-02 (the deterministic verifier itself)
from growing into a semantic decision-maker. IPE-01 adds no verifier — only the schema
extension and corpus-hygiene hardening needed for IPE-02 to be well-scoped.

## 2. Relationship to PRB / EVD / ASM

```text
SRC → EVD(+analysis) → PRB(+decision_basis) → ASM → HYP → Experiment → Project → Outcome
```

- `EVD-*` remains the atomic, provenance-carrying observation record.
- `ASM-*` remains the qualitative Problem Assessment that routes a problem to
  `STOP`/`WATCH`/`DEEPEN`/`PROCEED` (`docs/models/assessment-model.md`).
- `PRB-*` gains one new **optional** structure, `decision_basis`, that records the
  explicit basis for the problem's own promotion-relevant fields (chiefly
  `evidence_status: corroborated` and `validation_status: validated`) — not a
  replacement for `ASM-*`, and not a new record type.

`decision_basis` is a projection of reasoning the researcher already has to do under the
existing methodology (`docs/discovery/research-methodology.md` §3 "Evidence convergence",
§13.7 "D5 decision record"; `docs/models/problem-model.md` "Validation-status contract").
IPE-01 gives that reasoning a structured home on the `PRB-*` record itself so it is
addressable and machine-checkable, instead of only living in free-text `notes` and
`possible_root_causes` prose.

## 3. Scope of IPE-01

IPE-01 delivers:

1. This contract document.
2. An optional `decision_basis` structure on the `PRB-*` schema (§5).
3. A validator hardening: empty strings inside reference lists (e.g. a stray `""` in
   `evidence`) are now validation errors, not silently skipped (§6).
4. Tests for both.

IPE-01 does **not** deliver a verifier. No tooling in IPE-01 reads `decision_basis` and
produces a pass/fail judgement, a score, or a promotion recommendation. That is IPE-02.

## 4. Concepts

### 4.1 PRB Eligibility

"Eligibility" is whether a `PRB-*` has the *explicit basis on record* to support its
current `evidence_status`/`validation_status` claim — not whether the underlying civic
problem is real or important. A problem can be a legitimate `STOP`/`WATCH` with no
`decision_basis` at all; eligibility only becomes a relevant question once a researcher
asserts `corroborated` or `validated`.

### 4.2 Corroboration

Corroboration basis records *which* independent evidence classes converge
(`docs/discovery/research-methodology.md` §3) and *why* they are treated as independent
rather than restating the same underlying source (mirroring the existing
`analysis.lineage_id` / `ASM.evidence_confidence.independence` distinction —
`docs/discovery/d3-execution-protocol.md` §4.2, §5). `decision_basis` does not introduce a
second independence mechanism; it references the same concept at problem level.

### 4.3 Human gates

Every field that changes programme posture (`PRB.status`, `PRB.evidence_status`,
`PRB.validation_status`, `ASM.triage`) remains a human/project-owner decision, exactly as
today. `decision_basis` records the basis a human already relied on; it never triggers,
infers, or automatically applies a status change. Writing a `decision_basis` block does
not itself change `evidence_status` or `validation_status` — the two are edited
independently, by the same human judgement that has always made these calls.

### 4.4 Deterministic-verifier boundary

The IPE-02 verifier (not built in IPE-01) is scoped to answer only structural and
referential questions, for example: *is `decision_basis` present when
`validation_status: validated`? do the referenced `EVD-*`/`SRC-*` IDs exist? is
`corroboration_basis` non-empty when `evidence_status: corroborated`?* It is explicitly
never scoped to answer semantic questions such as *is this corroboration actually
independent? is this evidence actually sufficient? should this problem be promoted?* —
those stay human judgement, recorded as the content of `decision_basis`, not computed by
IPE.

### 4.5 Decision basis / explainability

The purpose of `decision_basis` is public explainability: a reader of the published
research corpus should be able to see, for any `validated` problem, an explicit,
structured account of what was checked, not just a status field and prose. This directly
supports the repository's canonical-integrity guardrail (`AGENTS.md` §8) by making the
evidence for a promotion-relevant claim inspectable rather than implicit.

## 5. `decision_basis` — v0 shape (optional, on `PRB-*`)

`decision_basis` is entirely optional in IPE-01. Its absence is valid for every existing
canonical `PRB-*` and remains valid for any problem that stays `unvalidated`/`discovered`
or resolves to a terminal non-`validated` outcome. It is intended to be populated only
when a researcher is asserting `evidence_status: corroborated` and/or
`validation_status: validated`/`partially_validated` and wants to record the explicit
basis for that assertion.

The shape below uses only nested maps, scalars, and scalar lists — the structures already
supported by `tools/validate-research.js`'s YAML subset. No list of objects is
introduced.

```yaml
decision_basis:
  contract_version: "0.1"

  eligibility_basis: ""
  corroboration_basis: ""

  manifestation:
    kind: ""
    summary: ""
    evidence: []

  consequence:
    summary: ""
    evidence: []

  currentness:
    assessment: ""
    evidence: []

  contradiction_search:
    performed: false
    summary: ""
    evidence: []

  overlap_check:
    performed: false
    summary: ""
    related_problems: []

  corroboration_statement: ""

  supporting_evidence: []
  boundary_evidence: []

  independence_assessment: ""

  scope:
    geography: ""
    population: ""
    temporal: ""

  limitations: ""
```

### 5.1 Field notes

- **`contract_version`** — the `decision_basis` contract version this record was authored
  against (starts at `"0.1"`, matching this document). Lets IPE-02 (or a future revision)
  distinguish records written under different `decision_basis` contracts without guessing
  from shape alone.
- **`eligibility_basis`** — free text: why the researcher considers the problem eligible
  for its current `evidence_status`/`validation_status` claim.
- **`corroboration_basis`** — free text: which evidence classes converge and why they are
  treated as corroborating (see §4.2).
- **`manifestation`** — how the problem actually shows up (`kind`, e.g. "access failure",
  "information gap"; `summary`; and the `EVD-*` IDs that show it).
- **`consequence`** — what happens as a result, and the evidence for that consequence.
- **`currentness`** — an explicit currentness call (mirrors
  `ASM.evidence_confidence.currentness`, but scoped to this problem's decision, not the
  whole assessment) and the evidence behind it.
- **`contradiction_search`** — whether a deliberate search for contradicting or
  current-state-changing evidence was performed (`performed: true|false`), a summary of
  what was found (or that nothing was found), and supporting `EVD-*` IDs. This is the
  structured trace of the D5 "actively seek counterexamples" requirement
  (`docs/discovery/research-methodology.md` §13.1, §13.6).
- **`overlap_check`** — whether the researcher checked for overlap/duplication with other
  `PRB-*`, and which ones were considered.
- **`corroboration_statement`** — a snapshot sentence stating the corroboration claim as
  of `as_of`-style authoring time (a frozen statement, not a live pointer — later evidence
  changes do not retroactively edit this snapshot; a fresh decision requires a fresh
  `decision_basis` update).
- **`supporting_evidence`** / **`boundary_evidence`** — `EVD-*` IDs that support the
  decision, and IDs that mark its edge cases or limits (evidence that narrows, qualifies,
  or partially cuts against the claim without being a full contradiction).
- **`independence_assessment`** — free text: the explicit judgement of whether the cited
  evidence is independent (echoes `ASM.evidence_confidence.independence`'s meaning at
  problem-decision level, not a new independence mechanism).
- **`scope`** — the geography, population, and temporal bounds the decision is actually
  good for, kept explicit so a `validated` status is never read as broader than what was
  checked.
- **`limitations`** — free text: known gaps, caveats, or things the decision does not
  cover.

### 5.2 Reference fields

`manifestation.evidence`, `consequence.evidence`, `currentness.evidence`,
`contradiction_search.evidence`, `supporting_evidence`, and `boundary_evidence` are scalar
lists of `EVD-*` IDs, the same convention `PRB.evidence` already uses (no mixed-prefix
reference lists exist anywhere in the current schemas — a record needing to cite a
`SRC-*` directly rather than through an `EVD-*` should do so in the relevant free-text
field, e.g. `eligibility_basis` or `limitations`). `overlap_check.related_problems` is a
scalar list of `PRB-*` IDs. All are validated the same way `PRB.evidence` already is:
broken references are errors, and — per §6 below — an empty-string entry is now also an
error.

### 5.3 What `decision_basis` is not

- Not a score. No field in `decision_basis` is numeric or produces a numeric aggregate.
- Not a new record type. It lives inline on the existing `PRB-*` YAML file.
- Not a replacement for `ASM-*`. `ASM-*` remains the qualitative assessment and triage
  mechanism; `decision_basis` is narrower — it documents the basis for the `PRB-*`
  record's own `evidence_status`/`validation_status`, not the full D3 decision-gate
  analysis.
- Not retroactive. Existing canonical `PRB-*` records are not backfilled with
  `decision_basis` as part of IPE-01 (see §7).

## 6. Validator hardening (IPE-01)

`tools/validate-research.js`'s cross-reference check previously skipped empty-string
entries in reference lists silently:

```js
if (typeof t !== "string" || t.trim() === "") continue;
```

An empty string in a reference list (e.g. `evidence: ["EVD-000034", ""]`) is not a valid
absence — the list already has a defined "no references" representation (`[]` or
omission). A stray empty string is corpus noise, most often from an accidental trailing
comma or a copy-paste artifact, and previously passed validation unnoticed. IPE-01 changes
this so an empty or whitespace-only string inside any declared reference-list field is
reported as a validation error, for every schema's `references` entries (`PRB.evidence`,
`EVD.additional_sources`, `EVD.analysis.related_problems`, and any future
`decision_basis` reference field), not only newly-added ones.

This is corpus hygiene, not a semantic check: it does not infer whether a reference
*should* exist, only that a present list entry must be a real, non-empty ID.

## 7. Non-goals (explicit anti-overengineering)

IPE-01, and IPE generally, does **not**:

- add a decision verifier (IPE-02's job, not built here);
- infer semantic truth, causality, prevalence, or independence from evidence content;
- make or suggest a promotion decision, or assign a score/confidence number;
- introduce a new canonical record type, database, service, workflow engine, or claim
  graph;
- use an LLM judge or any domain-specific rule engine;
- automatically change `evidence_status`, `validation_status`, `PRB.status`, or
  `ASM.triage`;
- backfill or mutate any existing `PRB-*`, `EVD-*`, `SRC-*`, or `ASM-*` record;
- change the Research Explorer UI or any runtime application code;
- require `decision_basis` on any record — it stays optional through IPE-01, and its
  eventual enforcement scope (if any) is an IPE-02+ decision, not assumed here.

## 8. Public explainability

Because this repository is public and every committed record is a publication action
(`AGENTS.md` §1, `docs/governance/data-publication-and-agent-safety.md` §1),
`decision_basis` fields must follow the same publication-safety rules as every other
canonical field: no private/raw material, no unnecessary personal identifiers, and
permission uncertainty fails closed (`AGENTS.md` §2–§4). `decision_basis` text should cite
`EVD-*`/`SRC-*` IDs and summarize their content the way `possible_root_causes` already
does today — it does not create a new channel for information that would not already be
publishable in an existing field.

## 9. Open design questions carried to IPE-02

Recorded here so IPE-02 does not have to rediscover them:

- Whether `decision_basis` should eventually be required (not merely present-if-used) for
  `validation_status: validated`, and under what grandfathering rule for the existing
  corpus.
- Whether `contract_version` mismatches between a record and the running verifier should
  be a hard error or a warning.
- How `overlap_check` should interact with a future structural-decision process
  (`docs/discovery/d3-execution-protocol.md` §10) without duplicating it.

These are explicitly not resolved by IPE-01.
