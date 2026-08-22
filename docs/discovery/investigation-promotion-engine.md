# Investigation & Promotion Engine (IPE) — v0 Contract Foundation

**Version:** 0.1
**Status:** IPE-01 (contract foundation) and IPE-02 (deterministic verifier,
`tools/evaluate-research-decisions.js`) are both implemented.

## 1. Purpose

The Investigation & Promotion Engine (IPE) is a deterministic verifier of explicitly
authored research decisions. **IPE-02 v0 verifies exactly two questions, both scoped to a
single `PRB-*`:**

1. **PRB Eligibility** — is there sufficient explicitly authored structural basis on
   record for the human PRB-promotion gate to consider this a distinct, well-formed
   problem of investigation? (§4.1, §10)
2. **Corroboration** — is there sufficient explicitly authored structural basis on record
   for the corroboration claim (`evidence_status`) associated with this `PRB-*`? (§4.2,
   §10)

It checks that the explicit basis for these two questions is present, structurally
well-formed, and internally consistent — not that the underlying decision is *correct*,
and not any other question. There is no `VALIDATION-v0` contract in IPE-02: `PRB-*.
validation_status` (`unvalidated`/`partially_validated`/`validated`), D5 validation
sufficiency, and `ASM.triage: PROCEED` are not evaluated by IPE-02 at all — they remain
governed entirely by the existing D5 / ASM human process
(`docs/discovery/research-methodology.md` §13.7, `docs/models/assessment-model.md`
"Interpretation rules"). `decision_basis` may support broader public explainability of a
`PRB-*` (§4.5), but IPE-02 must not be read as verifying contracts it does not implement.

IPE never decides whether a problem is real, whether corroboration is sufficient, whether
a root cause is right, or whether a problem should be promoted. Those remain human,
project-owner judgements recorded in `PRB-*`/`ASM-*`, exactly as today
(`docs/discovery/d3-execution-protocol.md` §6, `docs/models/assessment-model.md`
"Interpretation rules"). IPE only checks that, when such a judgement is recorded, the
explicit basis for it is present, structurally well-formed, and internally consistent —
so a reader (human or tooling) can see *why* a decision was made without re-deriving it
from prose scattered across `possible_root_causes` and `notes`.

This document is the IPE-01 contract: what `decision_basis` means, what it does and does
not represent, and the non-goals that keep IPE (IPE-01's schema/hygiene work and the
IPE-02 deterministic verifier built on top of it) from growing into a semantic
decision-maker or an automatic promotion mechanism. IPE-01 itself adds no verifier — only
the schema extension and corpus-hygiene hardening needed for IPE-02 to be well-scoped;
IPE-02 (§10) is the deterministic verifier, implemented in
`tools/evaluate-research-decisions.js`.

## 2. Relationship to PRB / EVD / ASM

```text
SRC → EVD(+analysis) → PRB(+decision_basis) → ASM → HYP → Experiment → Project → Outcome
```

- `EVD-*` remains the atomic, provenance-carrying observation record.
- `ASM-*` remains the qualitative Problem Assessment that routes a problem to
  `STOP`/`WATCH`/`DEEPEN`/`PROCEED` (`docs/models/assessment-model.md`).
- `PRB-*` gains one new **optional** structure, `decision_basis`, that records the
  explicit basis for the problem's own Eligibility (readiness for the human
  PRB-promotion gate) and Corroboration (`evidence_status: corroborated`) claims — not a
  replacement for `ASM-*`, and not a new record type. `decision_basis` does not verify or
  structurally justify `validation_status`; that remains solely a D5-governed human
  judgement (§4.1, §4.4).

`decision_basis` is a projection of reasoning the researcher already has to do under the
existing methodology (`docs/discovery/research-methodology.md` §3 "Evidence convergence",
§13.7 "D5 decision record"). IPE-01 gives that reasoning a structured home on the `PRB-*`
record itself so it is addressable and machine-checkable, instead of only living in
free-text `notes` and `possible_root_causes` prose. `decision_basis` may still support
broader human/public understanding of a problem's overall diagnosis — including context
relevant to a `validation_status` judgement a human makes elsewhere — but IPE-02 itself
verifies only Eligibility and Corroboration, never `validation_status` (§1).

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

"Eligibility" is readiness for the human PRB-promotion gate: whether a `PRB-*` has
sufficient explicitly authored structural basis on record to be treated as a distinct,
well-formed problem of investigation — not whether the underlying civic problem is real
or important, and not a verification of `validation_status`. `validation_status` is a
separate, D5-governed human judgement that IPE-02 does not read or verify (§1); Eligibility
is answered from the structural completeness of `decision_basis` (manifestation,
consequence, currentness, contradiction search, overlap check — §10), the existing
structural ASM-existence dependency (§4.6), and one plain `PRB-*` field outside
`decision_basis`: `PRB.affected_populations` must contain at least one non-empty value
(`MISSING_AFFECTED_POPULATION` otherwise) — a structural-completeness check only; IPE-02
never assesses whether the listed population is correct or sufficiently representative.
`decision_basis` stays optional and corpus-valid without it (§5, §7): a problem can be a
legitimate `STOP`/`WATCH` with no `decision_basis` at all, and that record remains a
valid, publishable part of the corpus. But once the IPE-02 verifier
(`tools/evaluate-research-decisions.js`) is asked to evaluate a given `PRB-*`, there is no
"not applicable" outcome — an absent `decision_basis` is itself the `REVIEW_REQUIRED` /
`NO_DECISION_BASIS` finding for both Eligibility and Corroboration, never `N/A`.
Optional-to-author and evaluated-as-review-required are not in tension: the first is
about what the corpus requires to be valid; the second is about what the verifier
reports when asked to check a specific record.

### 4.2 Corroboration

"Corroboration" is the structural verification associated with the explicitly authored
basis for the `PRB-*`'s corroboration claim (`evidence_status: corroborated`) — not a
judgement that the corroboration is actually sufficient or that the cited evidence is
actually independent. Corroboration basis records *which* independent evidence classes
converge (`docs/discovery/research-methodology.md` §3) and *why* they are treated as
independent rather than restating the same underlying source (mirroring the existing
`analysis.lineage_id` / `ASM.evidence_confidence.independence` distinction —
`docs/discovery/d3-execution-protocol.md` §4.2, §5). `decision_basis` does not introduce a
second independence mechanism; it references the same concept at problem level. IPE-02
checks only that this basis is present, structurally well-formed, and internally
consistent (§10); it never itself asserts independence or corroboration sufficiency.

### 4.3 Human gates

Every field that changes programme posture (`PRB.status`, `PRB.evidence_status`,
`PRB.validation_status`, `ASM.triage`) remains a human/project-owner decision, exactly as
today. `decision_basis` records the basis a human already relied on; it never triggers,
infers, or automatically applies a status change. Writing a `decision_basis` block does
not itself change `evidence_status` or `validation_status` — the two are edited
independently, by the same human judgement that has always made these calls.

### 4.4 Deterministic-verifier boundary

The IPE-02 verifier (not built in IPE-01) is scoped to answer only structural and
referential questions about the two questions in §1 — Eligibility and Corroboration —
for example: *is `decision_basis` present at all? do the referenced `EVD-*`/`SRC-*` IDs
exist? is `corroboration_basis` non-empty? is `scope.bounded` explicitly authored?* It
evaluates every `PRB-*` the same way regardless of its current `validation_status`/
`evidence_status` (§1) — it is never conditioned on those fields' values. It is explicitly
never scoped to answer semantic questions such as *is this corroboration actually
independent? is this evidence actually sufficient? should this problem be promoted? is
`validation_status: validated` correctly assigned?* — those stay human judgement, recorded
as the content of `decision_basis` or decided directly on `PRB-*`/`ASM-*`, not computed by
IPE.

### 4.5 Decision basis / explainability

The purpose of `decision_basis` is public explainability: a reader of the published
research corpus should be able to see, for a problem with a recorded Eligibility or
Corroboration claim, an explicit, structured account of what was checked, not just a
status field and prose. This directly supports the repository's canonical-integrity
guardrail (`AGENTS.md` §8) by making the evidence for a promotion-relevant claim
inspectable rather than implicit. This explainability purpose is broader than what
IPE-02 itself verifies (§1): `decision_basis` content may be read and cited by humans or
other tooling as context for a separate `validation_status` judgement, but IPE-02's own
pass/fail output never verifies or structurally justifies `validation_status` — that
remains solely the D5 process's responsibility (`docs/models/problem-model.md`
"Validation-status contract").

### 4.6 ASM structural dependency

Both Eligibility and Corroboration currently require at least one `ASM-*` record on file
that references the target `PRB-*` (`docs/models/assessment-model.md` — "One active
`ASM-*` is intended per canonical active `PRB-*`"). This is a structural-existence check
only: the IPE-02 verifier confirms an `ASM-*` record referencing the `PRB-*` exists; it
never reads or requires any particular `ASM.assessment_status`, `ASM.triage`, or
`decision_gates.*` value. An existing `PRB-*` with no `ASM-*` on file at all fails this
check (`MISSING_REQUIRED_ASM`) for both questions; an `ASM-*` in any `assessment_status`,
with any `triage` value (including `STOP`/`WATCH`), satisfies it.

## 5. `decision_basis` — v0 shape (optional, on `PRB-*`)

`decision_basis` is entirely optional in IPE-01. Its absence is valid for every existing
canonical `PRB-*` and remains valid for any problem that stays `unvalidated`/`discovered`
or resolves to a terminal non-`validated` outcome. It is intended to be populated only
when a researcher is asserting readiness for the human PRB-promotion gate (Eligibility)
and/or `evidence_status: corroborated` (Corroboration) and wants to record the explicit
basis for that assertion. It is not intended as a basis for `validation_status`, which
remains solely a D5-governed human judgement outside IPE's scope (§1, §4.1).

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
    bounded: false

  limitations: ""
```

### 5.1 Field notes

- **`contract_version`** — the `decision_basis` contract version this record was authored
  against (starts at `"0.1"`, matching this document). Lets IPE-02 (or a future revision)
  distinguish records written under different `decision_basis` contracts without guessing
  from shape alone.
- **`eligibility_basis`** — free text: why the researcher considers the problem ready for
  the human PRB-promotion gate — i.e. a distinct, well-formed problem of investigation
  (§4.1) — not a basis for `validation_status`.
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
  `PRB-*`, and which ones were considered. This gates Eligibility, not Corroboration
  (§10): overlap/deduplication is a question of whether this `PRB-*` should exist as a
  distinct record at all, which is settled before corroborating evidence for it is
  checked, so the IPE-02 verifier requires `overlap_check` to be explicitly authored only
  when evaluating Eligibility.
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
  checked. `scope.bounded` (added IPE-02, `docs/discovery/investigation-promotion-engine.md`
  §10) is an explicit human-authored boolean: `true` when the researcher considers this
  scope narrower/more limited than the problem's general framing, `false` otherwise. It is
  never inferred from the wording of `geography`/`population`/`temporal` — the researcher
  states it directly, the same way every other `decision_basis` judgement is stated, not
  detected from prose. `scope.bounded` is optional the same way the rest of `decision_basis`
  is for corpus validity (§5, §7) — but the IPE-02 verifier requires it to be explicitly
  authored (`true` or `false`) whenever it evaluates a Corroboration basis; its absence is
  `REVIEW_REQUIRED`, not silently treated as `false` (§10).
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
  record's own Eligibility and `evidence_status: corroborated` claims, not the full D3
  decision-gate analysis, and not `validation_status`.
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

- add a *semantic* decision-maker or an automatic promotion mechanism — IPE-02 is a
  deterministic, structural verifier (§4.4, §10); it never itself decides that a problem
  is real, sufficient, or promotable, and it never triggers a status change;
- infer semantic truth, causality, prevalence, or independence from evidence content;
- make or suggest a promotion decision, or assign a score/confidence number;
- introduce a new canonical record type, database, service, workflow engine, or claim
  graph;
- use an LLM judge or any domain-specific rule engine;
- automatically change `evidence_status`, `validation_status`, `PRB.status`, or
  `ASM.triage`;
- verify `validation_status: validated` or `validation_status: partially_validated`, D5
  validation sufficiency, or `ASM.triage: PROCEED` — IPE-02 v0 verifies only PRB
  Eligibility and Corroboration (§1); there is no `VALIDATION-v0` contract in IPE-02, and
  these remain entirely governed by the existing D5 / ASM human process;
- backfill or mutate any existing `PRB-*`, `EVD-*`, `SRC-*`, or `ASM-*` record;
- change the Research Explorer UI or any runtime application code;
- require `decision_basis` on any record — it stays optional through IPE-01 (and IPE-02
  evaluates it as-authored, never backfilling it), and its eventual corpus-validity
  enforcement scope (if any) remains an open question (§9).

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

These are explicitly not resolved by IPE-01. IPE-02 (§10) resolves one related question
that surfaced during implementation — whether an authored `scope` with `bounded` absent
may be read as `false` — no: absence is `REVIEW_REQUIRED`. The three questions above
remain open.

## 10. IPE-02 contract clarification — `scope.bounded` and the Eligibility/Corroboration boundary

IPE-02 (`tools/evaluate-research-decisions.js`) implements the deterministic verifier
scoped by §4.4. One of its required checks is "bounded/limited bases have explicit
limitations" — this needs a deterministic, non-semantic way to know whether a basis is
"bounded" at all. Detecting this from the wording of `scope.geography`/`population`/
`temporal` (e.g. matching "limited"/"partial" in free text) would be exactly the kind of
semantic inference over prose this verifier is barred from performing (§4.4, §7), so
IPE-02 adds one field to the `decision_basis.scope` shape (§5) instead:

```yaml
scope:
  geography: ""
  population: ""
  temporal: ""
  bounded: false
```

- **`scope.bounded`** — an explicit human-authored boolean. `true` means the researcher
  considers this decision's scope narrower/more limited than the problem's general
  framing (e.g. one parish surveyed out of the whole municipality); `false` means it is
  not. It is never inferred from `geography`/`population`/`temporal` content, from
  `boundary_evidence`, or from `contradiction_search` — those may be present independently
  of scope boundedness and are not used as a proxy for it; when present it is a plain
  boolean like `contradiction_search.performed` and `overlap_check.performed`.

`scope.bounded` is schema-optional the same way the rest of `decision_basis` is (§5, §7):
a `PRB-*` with no `scope` block, or a `scope` block with no `bounded` key, remains a valid
corpus record. **`scope`/`scope.bounded` gates Corroboration, not Eligibility.** The
IPE-02 verifier requires `scope` (`geography`, `population`, `temporal`) and an explicit
`scope.bounded` (`true` or `false`) only when evaluating a `PRB-*`'s Corroboration basis;
an authored `scope` with `bounded` absent is `REVIEW_REQUIRED` for Corroboration,
resolving IPE-01 §9's open question of whether boundedness may be silently read as
`false` — it may not. Eligibility does not require `scope` or `scope.bounded` at all: a
structurally complete Eligibility basis with no `scope` block is `READY`. This is a
verifier-evaluation requirement, not a corpus-validity requirement; the two remain
distinct exactly as `NO_DECISION_BASIS` is a verifier finding rather than a validation
error (§4.1).

The verifier's rule, once `scope` is present and `bounded` is explicitly authored (for
Corroboration): if `scope.bounded: true`, `limitations` must be a non-empty string
(`BOUNDED_SCOPE_WITHOUT_LIMITATIONS` otherwise); if `scope.bounded: false`, `limitations`
is not required by this check (though it may still be authored).

Symmetrically, **`overlap_check` gates Eligibility, not Corroboration.** Whether a
`PRB-*` overlaps/duplicates another problem is a question of whether it is eligible to
exist as a distinct record, settled before its corroborating evidence is evaluated — so
the IPE-02 verifier requires `overlap_check.performed` to be explicitly authored only when
evaluating Eligibility; Corroboration does not read `overlap_check` at all.
`contradiction_search` is the only one of these three checks Eligibility and Corroboration
both require, since both ask independently whether a deliberate search for
counterevidence was performed for their respective claim.

`scope.bounded` is the only schema-shape addition IPE-02 makes to `decision_basis`; every
other IPE-02 check reads fields already defined in IPE-01 §5. Corroboration reuses the
same human-authored `currentness` and `contradiction_search` fields Eligibility already
reads (§5) rather than introducing a second currentness/contradiction mechanism. Wherever
`overlap_check` or `contradiction_search` is required (per the split above),
`performed: false` is recorded as a valid but not gate-ready structured fact
(`OVERLAP_CHECK_NOT_PERFORMED` / `CONTRADICTION_SEARCH_NOT_PERFORMED`, or their
Corroboration-scoped equivalents) rather than an error.

### 10.1 IPE-02 contract clarification — `contract_version`

`decision_basis.contract_version` (§5) is schema-optional the same way the rest of
`decision_basis` is. Once a `decision_basis` block is present, the IPE-02 verifier
requires `contract_version` to be explicitly authored as a non-empty string for both
Eligibility and Corroboration: a present `decision_basis` with an absent or empty
`contract_version` is `REVIEW_REQUIRED` / `MISSING_CONTRACT_VERSION`. A non-empty version
string is sufficient for IPE-02 v0 — the verifier does not compare the authored version
against its own expected contract version, or reject a mismatch. Whether a
`contract_version` mismatch between a record and the running verifier should be a hard
error or a warning remains an explicitly open question (§9), not resolved here.
